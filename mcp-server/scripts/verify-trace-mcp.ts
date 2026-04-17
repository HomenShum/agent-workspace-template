/**
 * verify-trace-mcp — scenario-based smoke test for the change-trace (Pillar 2)
 * tools of attrition-mcp.
 *
 * Persona: an agent investigating "why did atomicWriteFile break?" reaches
 * for the catalog — calls `search_change_traces`, drills into one with
 * `get_trace`, then pulls the offending row with `get_row`. We run that
 * flow against a mocked registry and layer adversarial cases an agent loop
 * could trigger.
 *
 * Scenarios (10):
 *   happy         search_change_traces returns >=1 hit with matchingRows populated
 *   happy         get_trace returns a canonical envelope whose rows match
 *   happy         get_row returns scenario + why + crossReferences
 *   sad           empty query -> EMPTY_QUERY
 *   sad           rowIndex 999 -> ROW_OUT_OF_RANGE
 *   sad           unknown id -> NOT_FOUND
 *   adversarial   "../etc/passwd" -> INVALID_TRACE_ID
 *   adversarial   "ct_2026-04-17; DROP" -> INVALID_TRACE_ID
 *   adversarial   >5MB JSON response -> PAYLOAD_TOO_LARGE
 *   long-running  registry 12s -> TIMEOUT at 10s
 *   forward-compat bare ChangeTrace (no envelope) still parsed
 *
 * Prints "TRACE MCP OK" on full pass.
 */

import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";

// --- Fixtures --------------------------------------------------------------

const FIXTURE_TRACE = {
  id: "ct_2026-04-17",
  project: "agent-workspace-template",
  sessionId: "sess_demo",
  createdAt: "2026-04-17T10:00:00Z",
  tags: ["pillar-2", "mcp"],
  packsReferenced: ["advisor-pattern"],
  rows: [
    {
      scenario:
        "Wire atomicWriteFile into trace writer to avoid torn JSON on crash",
      filesTouched: ["src/lib/atomicWriteFile.ts", "cli/src/write-trace.ts"],
      changes: [
        {
          path: "src/lib/atomicWriteFile.ts",
          symbolsAdded: ["atomicWriteFile"],
          symbolsRenamed: [],
          symbolsRemoved: [],
          diffSummary: "New atomicWriteFile helper using rename() semantics.",
        },
      ],
      why: {
        plain: "Write to temp then rename so crash never leaves half a file.",
        analogy: "Draft the letter, then swap for the old one only when done.",
        principle: "All-or-nothing writes beat partial state.",
        hook: "rename-not-write",
      },
      failureModes: [
        {
          symptom: "Corrupt JSON after crash during write.",
          trigger: "Non-atomic fs.writeFile interrupted mid-flush.",
          preventionCheck: "Soak test with SIGKILL during writer loop.",
          tier: "sr" as const,
        },
      ],
    },
    {
      scenario: "Add rowIndex bounds check to CLI read command",
      filesTouched: ["cli/src/read-trace.ts"],
      changes: [
        {
          path: "cli/src/read-trace.ts",
          symbolsAdded: [],
          symbolsRenamed: [],
          symbolsRemoved: [],
          diffSummary: "Reject rowIndex >= rows.length with exit code 2.",
        },
      ],
      why: {
        plain: "Off-by-one on rowIndex fetched wrong row silently.",
        analogy: "Asking for page 10 of a 5-page book shouldn't give page 1.",
        principle: "Bound every index read.",
        hook: "bound-index-reads",
      },
    },
  ],
};

type Mode =
  | { kind: "normal" }
  | { kind: "huge-json" }
  | { kind: "slow"; delayMs: number }
  | { kind: "bare-trace" };

function startMockServer(mode: Mode): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createHttpServer((req, res) => {
      const url = req.url ?? "/";

      if (mode.kind === "slow") {
        setTimeout(() => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ traces: [], total: 0 }));
        }, mode.delayMs);
        return;
      }

      if (url.startsWith("/api/traces") && !url.startsWith("/api/traces/")) {
        if (mode.kind === "huge-json") {
          // Stream >5MB to trip PAYLOAD_TOO_LARGE in the bounded reader.
          res.writeHead(200, { "content-type": "application/json" });
          res.write('{"traces":[');
          const bigStr = "x".repeat(64 * 1024);
          let sent = 0;
          const target = 6 * 1024 * 1024;
          const pump = () => {
            while (sent < target) {
              if (!res.write(`"${bigStr}",`)) {
                res.once("drain", pump);
                return;
              }
              sent += bigStr.length + 3;
            }
            res.end('""]}');
          };
          pump();
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            traces: [FIXTURE_TRACE],
            total: 1,
            filters: {},
          })
        );
        return;
      }

      if (url.startsWith("/api/traces/")) {
        const id = decodeURIComponent(url.replace("/api/traces/", ""));
        if (id !== FIXTURE_TRACE.id) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        if (mode.kind === "bare-trace") {
          // Forward-compat: return bare ChangeTrace, no envelope.
          res.end(JSON.stringify(FIXTURE_TRACE));
          return;
        }
        res.end(JSON.stringify({ trace: FIXTURE_TRACE }));
        return;
      }

      if (url.startsWith("/traces/") && url.endsWith("/raw")) {
        res.writeHead(200, { "content-type": "text/markdown" });
        res.end(
          "# ct_2026-04-17\n\n## Scenario\nrow 0 scenario...\n\n## Why\n- plain\n"
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
    return await fn();
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

// --- Handler loader --------------------------------------------------------

type Handlers = typeof import("../src/index.js");

async function loadHandlers(): Promise<Handlers> {
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
  // 1. Happy: search_change_traces
  await withServer({ kind: "normal" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleSearchChangeTraces({
      query: "atomicWriteFile",
    })) as {
      traces?: Array<{ id: string; matchingRows: number[]; snippet: string }>;
      total?: number;
    };
    assertOk(
      Array.isArray(out.traces) && out.traces.length >= 1,
      "happy: search_change_traces returns >=1 hit",
      out
    );
    assertOk(
      typeof out.total === "number",
      "happy: search_change_traces total is a number",
      out
    );
    const first = out.traces?.[0];
    assertOk(
      Array.isArray(first?.matchingRows) && (first?.matchingRows.length ?? 0) >= 1,
      "happy: top hit has matchingRows populated",
      first
    );
    assertOk(
      typeof first?.snippet === "string" && first.snippet.length > 0,
      "happy: top hit has a non-empty snippet",
      first
    );
  });

  // 2. Happy: get_trace
  await withServer({ kind: "normal" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleGetTrace({ id: "ct_2026-04-17" })) as {
      trace?: { id: string; rows: unknown[] };
    };
    assertOk(
      out.trace?.id === "ct_2026-04-17",
      "happy: get_trace envelope has matching id",
      out
    );
    assertOk(
      Array.isArray(out.trace?.rows) && (out.trace?.rows.length ?? 0) >= 1,
      "happy: get_trace envelope has populated rows",
      out
    );
  });

  // 3. Happy: get_row
  await withServer({ kind: "normal" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleGetRow({
      id: "ct_2026-04-17",
      rowIndex: 0,
    })) as {
      scenario?: string;
      filesTouched?: string[];
      why?: { plain?: string };
      crossReferences?: { packs: string[]; relatedRows: unknown[] };
    };
    assertOk(
      typeof out.scenario === "string" && out.scenario.length > 0,
      "happy: get_row returns a scenario",
      out
    );
    assertOk(
      Array.isArray(out.filesTouched) && out.filesTouched.length >= 1,
      "happy: get_row returns filesTouched",
      out
    );
    assertOk(
      typeof out.why?.plain === "string" && out.why.plain.length > 0,
      "happy: get_row returns why.plain",
      out
    );
    assertOk(
      Array.isArray(out.crossReferences?.packs) &&
        (out.crossReferences?.packs ?? []).includes("advisor-pattern"),
      "happy: get_row resolves packsReferenced into crossReferences.packs",
      out
    );
    assertOk(
      Array.isArray(out.crossReferences?.relatedRows),
      "happy: get_row returns relatedRows array",
      out
    );
  });

  // 4. Sad: empty query
  await withServer({ kind: "normal" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleSearchChangeTraces({ query: "   " })) as {
      error?: { code: string };
    };
    assertOk(
      out.error?.code === "EMPTY_QUERY",
      "sad: empty query -> EMPTY_QUERY",
      out
    );
  });

  // 5. Sad: rowIndex 999 -> ROW_OUT_OF_RANGE
  await withServer({ kind: "normal" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleGetRow({
      id: "ct_2026-04-17",
      rowIndex: 999,
    })) as { error?: { code: string } };
    assertOk(
      out.error?.code === "ROW_OUT_OF_RANGE",
      "sad: rowIndex 999 -> ROW_OUT_OF_RANGE",
      out
    );
  });

  // 6. Sad: unknown id -> NOT_FOUND
  await withServer({ kind: "normal" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleGetTrace({ id: "ct_2099-12-31" })) as {
      error?: { code: string };
    };
    assertOk(
      out.error?.code === "NOT_FOUND",
      "sad: unknown id -> NOT_FOUND",
      out
    );
  });

  // 7. Adversarial: path-traversal id
  await withServer({ kind: "normal" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleGetTrace({ id: "../etc/passwd" })) as {
      error?: { code: string };
    };
    assertOk(
      out.error?.code === "INVALID_TRACE_ID",
      "adversarial: '../etc/passwd' -> INVALID_TRACE_ID",
      out
    );
  });

  // 8. Adversarial: injection-looking id
  await withServer({ kind: "normal" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleGetTrace({
      id: "ct_2026-04-17; DROP",
    })) as { error?: { code: string } };
    assertOk(
      out.error?.code === "INVALID_TRACE_ID",
      "adversarial: 'ct_2026-04-17; DROP' -> INVALID_TRACE_ID",
      out
    );
  });

  // 9. Adversarial: oversized JSON response
  await withServer({ kind: "huge-json" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleSearchChangeTraces({
      query: "anything",
    })) as { error?: { code: string } };
    assertOk(
      out.error?.code === "PAYLOAD_TOO_LARGE",
      "adversarial: >5MB registry JSON aborts with PAYLOAD_TOO_LARGE",
      out
    );
  });

  // 10. Long-running: 15s -> TIMEOUT at 10s
  await withServer({ kind: "slow", delayMs: 15_000 }, async () => {
    const h = await loadHandlers();
    const started = Date.now();
    const out = (await h.handleGetTrace({
      id: "ct_2026-04-17",
    })) as { error?: { code: string } };
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

  // 11. Forward-compat: bare ChangeTrace response
  await withServer({ kind: "bare-trace" }, async () => {
    const h = await loadHandlers();
    const out = (await h.handleGetTrace({ id: "ct_2026-04-17" })) as {
      trace?: { id: string; rows: unknown[] };
    };
    assertOk(
      out.trace?.id === "ct_2026-04-17",
      "forward-compat: bare ChangeTrace still unwrapped into {trace}",
      out
    );
  });

  console.log("\nTRACE MCP OK");
}

run().catch((err) => {
  console.error("verify-trace-mcp crashed:", err);
  process.exit(1);
});
