/**
 * verify-mcp — scenario-based smoke test for attrition-mcp.
 *
 * Persona: a Claude Code user in a fresh repo calls `resolve_pack_id("advisor")`
 * to find the right pack to install. We run that flow end-to-end against a
 * mocked registry, plus adversarial cases that an agent loop could trigger.
 *
 * Scenarios:
 *   happy          resolve_pack_id("advisor") returns >=1 candidate
 *   sad            resolve_pack_id("") -> EMPTY_QUERY
 *   adversarial    get_pack("../etc/passwd") -> INVALID_SLUG
 *   adversarial    5MB markdown response -> PAYLOAD_TOO_LARGE
 *   long-running   registry takes 12s -> TIMEOUT at 10s
 *
 * On full pass: prints "MCP OK" and exits 0. On any fail: prints the
 * failure envelope and exits non-zero.
 */

import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { AddressInfo } from "node:net";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as traceRegistry from "../src/trace-registry.js";

// --- Mocked registry fixtures ---------------------------------------------

const FIXTURE_PACKS = [
  {
    slug: "advisor-pattern",
    name: "Advisor Pattern",
    tagline: "Structured advisor harness for decision support",
    summary: "Advisor harness with runtime charter and NLH.",
    packType: "harness",
    canonicalPattern: "evaluator-optimizer",
    version: "1.0.0",
    trust: "Verified",
    status: "Production-ready",
    featured: true,
    publisher: "attrition.sh",
    gradient: "",
    updatedAt: "2026-04-10",
    compatibility: [],
    tags: ["advisor", "harness", "decision"],
    installCommand: "npx attrition-sh pack install advisor-pattern",
    claudeCodeSnippet: "",
    rawMarkdownPath: "/packs/advisor-pattern.md",
    useWhen: [],
    avoidWhen: [],
    keyOutcomes: [],
    minimalInstructions: "",
    fullInstructions: "",
    evaluationChecklist: [],
    failureModes: [],
    relatedPacks: [],
    requires: [],
    conflictsWith: [],
    supersedes: [],
    comparesWith: [],
    changelog: [],
    metrics: [],
    sources: [],
    examples: [],
  },
  {
    slug: "scout-pattern",
    name: "Scout Pattern",
    tagline: "Lightweight scout for quick context gathering",
    summary: "Scout pattern for pre-planning recon.",
    packType: "harness",
    canonicalPattern: "prompt-chaining",
    version: "0.9.0",
    trust: "Community",
    status: "Recommended",
    featured: false,
    publisher: "community",
    gradient: "",
    updatedAt: "2026-03-01",
    compatibility: [],
    tags: ["scout", "advisor"],
    installCommand: "npx attrition-sh pack install scout-pattern",
    claudeCodeSnippet: "",
    rawMarkdownPath: "/packs/scout-pattern.md",
    useWhen: [],
    avoidWhen: [],
    keyOutcomes: [],
    minimalInstructions: "",
    fullInstructions: "",
    evaluationChecklist: [],
    failureModes: [],
    relatedPacks: [],
    requires: [],
    conflictsWith: [],
    supersedes: [],
    comparesWith: [],
    changelog: [],
    metrics: [],
    sources: [],
    examples: [],
  },
];

type Mode =
  | { kind: "normal" }
  | { kind: "huge-md" }
  | { kind: "slow"; delayMs: number };

function startMockServer(mode: Mode): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createHttpServer((req, res) => {
      const url = req.url ?? "/";

      if (mode.kind === "slow") {
        // Never respond; let the client abort at its 10s budget.
        setTimeout(() => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ packs: [] }));
        }, mode.delayMs);
        return;
      }

      if (url.startsWith("/api/packs") && !url.includes("/packs/")) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ packs: FIXTURE_PACKS }));
        return;
      }

      if (url.startsWith("/api/packs/")) {
        const slug = decodeURIComponent(url.replace("/api/packs/", ""));
        const pack = FIXTURE_PACKS.find((p) => p.slug === slug);
        if (!pack) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ pack }));
        return;
      }

      if (url.startsWith("/packs/") && url.endsWith(".md")) {
        if (mode.kind === "huge-md") {
          // Stream >1MB of garbage so the bounded reader aborts.
          res.writeHead(200, { "content-type": "text/markdown" });
          const chunk = "x".repeat(64 * 1024);
          let sent = 0;
          const target = 5 * 1024 * 1024;
          const pump = () => {
            while (sent < target) {
              if (!res.write(chunk)) {
                res.once("drain", pump);
                return;
              }
              sent += chunk.length;
            }
            res.end();
          };
          pump();
          return;
        }
        res.writeHead(200, { "content-type": "text/markdown" });
        res.end(
          "# Advisor Pattern\n\n## Summary\nAn advisor harness.\n\n## Contract\n- requiredOutputs: plan\n\n## Layers\nCharter, NLH, tools.\n"
        );
        return;
      }

      res.writeHead(404).end();
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function baseUrl(server: HttpServer): string {
  const addr = server.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
}

async function withServer<T>(mode: Mode, fn: () => Promise<T>): Promise<T> {
  const server = await startMockServer(mode);
  process.env.ATTRITION_REGISTRY_URL = baseUrl(server);
  try {
    // Force a fresh module load so the handler reads the new env URL.
    return await fn();
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

// --- Scenarios -------------------------------------------------------------

type Handlers = typeof import("../src/index.js");

async function loadHandlers(): Promise<Handlers> {
  // Bust cache so each scenario re-reads env in registry.ts's getBaseUrl.
  return await import("../src/index.js");
}

function assertOk(cond: unknown, label: string, detail: unknown): void {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    console.error(JSON.stringify(detail, null, 2));
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}

async function run(): Promise<void> {
  // 1. Happy path: resolve_pack_id("advisor")
  await withServer({ kind: "normal" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleResolvePackId({ query: "advisor" })) as {
      candidates?: Array<{ slug: string }>;
    };
    assertOk(
      Array.isArray(out.candidates) && out.candidates.length >= 1,
      "happy: resolve_pack_id('advisor') returns >=1 candidate",
      out
    );
    assertOk(
      out.candidates?.[0]?.slug === "advisor-pattern",
      "happy: top candidate is advisor-pattern (Verified wins tie)",
      out
    );
  });

  // 2. Sad path: empty query
  await withServer({ kind: "normal" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleResolvePackId({ query: "   " })) as {
      error?: { code: string };
    };
    assertOk(
      out.error?.code === "EMPTY_QUERY",
      "sad: empty query returns EMPTY_QUERY",
      out
    );
  });

  // 3. Adversarial: path-traversal slug
  await withServer({ kind: "normal" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleGetPack({ slug: "../etc/passwd" })) as {
      error?: { code: string };
    };
    assertOk(
      out.error?.code === "INVALID_SLUG",
      "adversarial: '../etc/passwd' returns INVALID_SLUG",
      out
    );
  });

  // 3b. Adversarial: slug with uppercase / special chars
  await withServer({ kind: "normal" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleGetPack({ slug: "Foo_Bar!" })) as {
      error?: { code: string };
    };
    assertOk(
      out.error?.code === "INVALID_SLUG",
      "adversarial: 'Foo_Bar!' returns INVALID_SLUG",
      out
    );
  });

  // 4. Adversarial: 5MB markdown -> PAYLOAD_TOO_LARGE
  await withServer({ kind: "huge-md" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleGetPackSection({
      slug: "advisor-pattern",
      section: "summary",
    })) as { error?: { code: string } };
    assertOk(
      out.error?.code === "PAYLOAD_TOO_LARGE",
      "adversarial: 5MB markdown aborts with PAYLOAD_TOO_LARGE",
      out
    );
  });

  // 5. Long-running: 12s registry -> TIMEOUT at 10s
  // We shorten the test: mock never responds, client aborts at 10s.
  await withServer({ kind: "slow", delayMs: 15_000 }, async () => {
    const h = await loadHandlers();
    const started = Date.now();
    const out = (await h.handleGetPack({ slug: "advisor-pattern" })) as {
      error?: { code: string };
    };
    const elapsed = Date.now() - started;
    assertOk(
      out.error?.code === "TIMEOUT",
      "long-running: 10s budget fires TIMEOUT",
      { out, elapsedMs: elapsed }
    );
    assertOk(
      elapsed < 12_000,
      `long-running: aborted before 12s (actual ${elapsed}ms)`,
      { elapsedMs: elapsed }
    );
  });

  await verifyReliability();
  console.log("\nMCP OK");
}

/** A coding agent must distinguish failure and continue working while peers stall. */
async function verifyReliability(): Promise<void> {
  const trace = { id: "ct_2026-04-17", rows: [] };
  let stalled = false;
  let headersSent = 0;
  let bodiesClosed = 0;
  const closures: Promise<void>[] = [];
  const server = createHttpServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const control = url.pathname === "/api/packs/control-pack";
    if (url.pathname === "/api/packs/missing-pack") {
      res.writeHead(404).end();
      return;
    }
    const markdown = url.pathname.startsWith("/packs/") || url.pathname.endsWith("/raw");
    res.writeHead(200, { "content-type": markdown ? "text/markdown" : "application/json" });
    if (stalled && !control) {
      closures.push(new Promise<void>((resolve) => res.once("close", () => {
        bodiesClosed++;
        resolve();
      })));
      res.flushHeaders();
      res.write(markdown ? "# Partial body\n" : '{"partial":');
      headersSent++;
      return; // The application deadline, not the fixture, must end this body.
    }
    if (markdown) res.end("## Summary\nReady\n");
    else if (url.pathname === "/api/packs") res.end(JSON.stringify({ packs: FIXTURE_PACKS }));
    else if (url.pathname.startsWith("/api/packs/")) {
      res.end(JSON.stringify({ pack: { ...FIXTURE_PACKS[0], ...(control ? { slug: "control-pack" } : {}) } }));
    } else if (url.pathname === "/api/traces") res.end(JSON.stringify({ traces: [], total: 0 }));
    else res.end(JSON.stringify({ trace }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const fixture = baseUrl(server);
  process.env.ATTRITION_REGISTRY_URL = fixture;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ATTRITION_REGISTRY_URL: fixture },
    stderr: "pipe",
  });
  transport.stderr?.resume();
  const client = new Client({ name: "mcp-reliability-verifier", version: "1.0.0" });
  let childClosed = false;
  try {
    await client.connect(transport, { timeout: 3_000 });
    const previousClose = transport.onclose;
    transport.onclose = () => { childClosed = true; previousClose?.(); };
    const tools = await client.listTools({}, { timeout: 3_000 });
    assert.equal(tools.tools.length, 8);
    const h = await loadHandlers();
    const call = (name: string, args: Record<string, unknown>) =>
      client.callTool({ name, arguments: args }, undefined, { timeout: 13_000 });
    const success = await call("get_pack", { slug: "advisor-pattern" });
    assert.notEqual(success.isError, true);
    assert.deepEqual(success.content, [{ type: "text", text: JSON.stringify(await h.handleGetPack({ slug: "advisor-pattern" })) }]);
    for (const [name, args, code] of [
      ["get_pack", { slug: "../etc/passwd" }, "INVALID_SLUG"],
      ["get_trace", { id: "../etc/passwd" }, "INVALID_TRACE_ID"],
      ["get_pack", { slug: "missing-pack" }, "NOT_FOUND"],
    ] as const) {
      const result = await call(name, args);
      assert.equal(result.isError, true, `${name}: wire tool error flag`);
      const text = result.content.find((item) => item.type === "text");
      assert(text && text.type === "text");
      assert.equal(JSON.parse(text.text).error.code, code);
    }
    console.log("PASS: actual SDK stdio handshake, eight tools, unchanged success payload and explicit pack/trace errors");

    const operations: Array<[string, () => Promise<unknown>]> = [
      ["pack list JSON", () => h.handleResolvePackId({ query: "advisor" })],
      ["pack get JSON", () => h.handleGetPack({ slug: "advisor-pattern" })],
      ["pack Markdown", () => h.handleGetPackSection({ slug: "advisor-pattern", section: "summary" })],
      ["trace list JSON", () => h.handleSearchChangeTraces({ query: "fixture" })],
      ["trace get JSON", () => h.handleGetTrace({ id: trace.id })],
      // No current tool calls getRawTrace; directly cover its shared body reader.
      ["trace Markdown", () => traceRegistry.getRawTrace(trace.id)],
    ];
    for (let wave = 1; wave <= 2; wave++) {
      stalled = true;
      const first = closures.length;
      const started = performance.now();
      let watchdog: ReturnType<typeof setTimeout>;
      const expired = new Promise<never>((_, reject) => {
        watchdog = setTimeout(() => reject(new Error("External 13s watchdog: application failed to finish")), 13_000);
      });
      try {
        const pending = operations.map(async ([label, operation]) => {
          const value = await operation().catch((err: unknown) => err);
          const code = value instanceof traceRegistry.TraceRegistryError
            ? value.code : (value as { error?: { code: string } }).error?.code;
          assert.equal(code, "TIMEOUT", label);
          assert(performance.now() - started < 12_000, `${label}: application deadline before 12s`);
        });
        for (const [name, args] of [
          ["get_pack", { slug: "advisor-pattern" }],
          ["get_trace", { id: trace.id }],
        ] as const) {
          pending.push((async () => {
            const result = await call(name, args);
            assert.equal(result.isError, true, `${name}: wire timeout flag`);
            const text = result.content.find((item) => item.type === "text");
            assert(text && text.type === "text");
            assert.equal(JSON.parse(text.text).error.code, "TIMEOUT");
            assert(performance.now() - started < 12_000, `${name}: wire timeout before 12s`);
          })());
        }
        const healthyStarted = performance.now();
        const healthy = await call("get_pack", { slug: "control-pack" });
        assert.notEqual(healthy.isError, true);
        assert(performance.now() - healthyStarted < 3_000, "healthy peer progresses during stalls");
        await Promise.race([Promise.all(pending), expired]);
        assert.equal(closures.length - first, 8, "all eight responses actually sent partial bodies");
        await Promise.race([Promise.all(closures.slice(first)), expired]);
        assert.equal(bodiesClosed, headersSent, "application abort closes all stalled responses");
        console.log(`PASS: body-stall wave ${wave}: eight concurrent JSON/Markdown and stdio TIMEOUTs in ${Math.round(performance.now() - started)}ms; healthy peer and body cleanup`);
      } finally {
        clearTimeout(watchdog!);
        stalled = false;
      }
      const recovered = await call("get_pack", { slug: "advisor-pattern" });
      assert.deepEqual(recovered, success, "same session recovers with unchanged success payload");
    }
  } finally {
    // Destroy only this fixture's connections even if a regression leaves bodies pending.
    await client.close();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
  assert(childClosed, "owned stdio child close observed");
  assert(!server.listening, "owned loopback server closed");
  console.log("PASS: repeated-wave recovery, owned stdio child and loopback fixture cleanup");
}

run().catch((err) => {
  console.error("verify-mcp crashed:", err);
  process.exit(1);
});
