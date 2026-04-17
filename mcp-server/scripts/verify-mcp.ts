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

  console.log("\nMCP OK");
}

run().catch((err) => {
  console.error("verify-mcp crashed:", err);
  process.exit(1);
});
