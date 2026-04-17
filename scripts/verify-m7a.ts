/**
 * M7a verification script — Change-Trace data layer (Pillar 2).
 *
 * Run with:
 *   npx tsx scripts/verify-m7a.ts
 *
 * Exits non-zero on any failure, prints "M7A OK" on success.
 *
 * Covers:
 *   Happy: getAllTraces() >= 1, getTraceById returns seed with rows+packs,
 *          traceToMarkdown has H2 anchors + YAML frontmatter,
 *          /api/traces envelope {traces,total,filters},
 *          /api/traces/<id> envelope {trace},
 *          /traces/<id>/raw returns text/markdown.
 *   Sad:   nonexistent id -> null.
 *   Adv:   path traversal, SQL-ish injection, 2000-char id -> null.
 *
 * Non-goals for this script:
 *   - does not require a running Next dev server (endpoint behavior is
 *     verified via direct GET handler invocation).
 */

import {
  getAllTraces,
  getTraceById,
  searchTraces,
} from "@/lib/trace-registry";
import { isValidTraceId } from "@/lib/trace-schema";
import { traceToMarkdown } from "@/lib/trace-markdown";
import { GET as apiTracesGET } from "@/app/api/traces/route";
import { GET as apiTraceByIdGET } from "@/app/api/traces/[id]/route";
import { GET as rawTraceGET } from "@/app/traces/[id]/raw/route";

type Check = { label: string; ok: boolean; detail?: string };

function check(label: string, ok: boolean, detail?: string): Check {
  return { label, ok, detail };
}
function assertTrue(label: string, cond: boolean, detail?: string): Check {
  return check(label, cond, detail);
}

async function main(): Promise<number> {
  const results: Check[] = [];

  // --- Happy: registry returns seed ---
  const all = getAllTraces();
  results.push(
    assertTrue("getAllTraces() returns >=1 entry", all.length >= 1, `got ${all.length}`)
  );

  const seed = getTraceById("ct_2026-04-17");
  results.push(
    assertTrue("getTraceById('ct_2026-04-17') returns seed", seed !== null)
  );
  if (seed) {
    results.push(
      assertTrue("seed has >=4 rows", seed.rows.length >= 4, `got ${seed.rows.length}`)
    );
    results.push(
      assertTrue(
        "seed packsReferenced >=3",
        seed.packsReferenced.length >= 3,
        `got ${seed.packsReferenced.length}`
      )
    );
    const everyRowHasWhy = seed.rows.every(
      (r) => !!r.why.plain && !!r.why.analogy && !!r.why.principle && !!r.why.hook
    );
    results.push(assertTrue("every row has full WhyExplanation", everyRowHasWhy));
    const rowsWithFailureModes = seed.rows.filter(
      (r) => (r.failureModes?.length ?? 0) > 0
    ).length;
    results.push(
      assertTrue(
        ">=2 rows carry failureModes",
        rowsWithFailureModes >= 2,
        `got ${rowsWithFailureModes}`
      )
    );
  }

  // --- Markdown shape ---
  if (seed) {
    const md = traceToMarkdown(seed);
    const required = [
      "## Scenario",
      "## Files Touched",
      "## Changes",
      "## Why",
      "## Failure Modes",
      "## Packs Referenced",
      "## Tags",
      "## Cross-References",
    ];
    for (const h of required) {
      results.push(assertTrue(`markdown contains '${h}'`, md.includes(h)));
    }
    results.push(assertTrue("markdown has YAML frontmatter open", md.startsWith("---\n")));
    results.push(
      assertTrue(
        "markdown frontmatter contains id",
        md.includes(`id: "${seed.id}"`)
      )
    );
    results.push(
      assertTrue(
        "markdown frontmatter contains packsReferenced",
        md.includes("packsReferenced:")
      )
    );
  }

  // --- Search works ---
  const hitsOnHook = searchTraces("mocks lie");
  results.push(
    assertTrue(
      "searchTraces('mocks lie') finds the seed via hook",
      hitsOnHook.some((t) => t.id === "ct_2026-04-17")
    )
  );
  const hitsOnSymbol = searchTraces("atomicWriteFile");
  results.push(
    assertTrue(
      "searchTraces('atomicWriteFile') finds seed via symbol/diff",
      hitsOnSymbol.some((t) => t.id === "ct_2026-04-17")
    )
  );
  results.push(
    assertTrue(
      "searchTraces('') returns no hits (guard)",
      searchTraces("").length === 0
    )
  );

  // --- Sad: nonexistent + invalid ids ---
  results.push(
    assertTrue("getTraceById('nonexistent') returns null", getTraceById("nonexistent") === null)
  );
  results.push(
    assertTrue(
      "getTraceById('../etc/passwd') returns null",
      getTraceById("../etc/passwd") === null
    )
  );
  results.push(
    assertTrue(
      "getTraceById('ct_2026-04-17; DROP TABLE') returns null",
      getTraceById("ct_2026-04-17; DROP TABLE") === null
    )
  );
  const longId = "ct_2026-04-17_" + "a".repeat(2000);
  results.push(
    assertTrue(
      "getTraceById(2000-char id) returns null",
      getTraceById(longId) === null
    )
  );

  // --- isValidTraceId guard coverage ---
  results.push(assertTrue("isValidTraceId accepts seed id", isValidTraceId("ct_2026-04-17")));
  results.push(
    assertTrue(
      "isValidTraceId accepts suffixed id",
      isValidTraceId("ct_2026-04-17_a7f3")
    )
  );
  results.push(assertTrue("isValidTraceId rejects empty", !isValidTraceId("")));
  results.push(assertTrue("isValidTraceId rejects bad prefix", !isValidTraceId("xx_2026-04-17")));
  results.push(
    assertTrue("isValidTraceId rejects uppercase", !isValidTraceId("CT_2026-04-17"))
  );
  results.push(
    assertTrue(
      "isValidTraceId rejects traversal chars",
      !isValidTraceId("../etc/passwd")
    )
  );

  // --- /api/traces envelope ---
  {
    const req = new Request("http://localhost:3000/api/traces?limit=10");
    const res = await apiTracesGET(req);
    const json: any = await res.json();
    results.push(
      assertTrue("/api/traces has .traces array", Array.isArray(json?.traces))
    );
    results.push(
      assertTrue(
        "/api/traces has .total number",
        typeof json?.total === "number"
      )
    );
    results.push(assertTrue("/api/traces has .filters object", !!json?.filters));
    results.push(
      assertTrue(
        "/api/traces envelope is not a bare array",
        !Array.isArray(json)
      )
    );
    results.push(
      assertTrue(
        "/api/traces Cache-Control is set",
        res.headers.get("cache-control")?.includes("max-age=60") ?? false
      )
    );
    results.push(
      assertTrue(
        "/api/traces filters.limit echoes parsed value",
        json?.filters?.limit === 10
      )
    );
  }

  // Empty-match — honest empty envelope, not an error.
  {
    const req = new Request(
      "http://localhost:3000/api/traces?project=no-such-project"
    );
    const res = await apiTracesGET(req);
    const json: any = await res.json();
    results.push(
      assertTrue(
        "/api/traces empty filter returns {traces:[], total:0}",
        Array.isArray(json?.traces) &&
          json.traces.length === 0 &&
          json.total === 0
      )
    );
    results.push(
      assertTrue(
        "/api/traces empty filter still 200",
        res.status === 200
      )
    );
  }

  // --- /api/traces/<id> envelope ---
  {
    const res = await apiTraceByIdGET(
      new Request("http://localhost:3000/api/traces/ct_2026-04-17"),
      { params: Promise.resolve({ id: "ct_2026-04-17" }) }
    );
    results.push(assertTrue("/api/traces/<id> status 200", res.status === 200));
    const json: any = await res.json();
    results.push(
      assertTrue(
        "/api/traces/<id> wrapped in {trace}",
        !!json?.trace && !Array.isArray(json)
      )
    );
    results.push(
      assertTrue(
        "/api/traces/<id> trace.id matches",
        json?.trace?.id === "ct_2026-04-17"
      )
    );
    // Canonical check: the response must not BE the trace directly.
    results.push(
      assertTrue(
        "/api/traces/<id> does not expose bare ChangeTrace",
        !("rows" in (json ?? {})) && !("packsReferenced" in (json ?? {}))
      )
    );
  }

  // --- /api/traces/<id> 404 on invalid ---
  {
    const res = await apiTraceByIdGET(
      new Request("http://localhost:3000/api/traces/nope"),
      { params: Promise.resolve({ id: "nope" }) }
    );
    results.push(
      assertTrue("/api/traces/<bad> returns 404", res.status === 404)
    );
  }
  {
    const res = await apiTraceByIdGET(
      new Request("http://localhost:3000/api/traces/..%2Fetc"),
      { params: Promise.resolve({ id: "../etc" }) }
    );
    results.push(
      assertTrue("/api/traces/<traversal> returns 404", res.status === 404)
    );
  }

  // --- /traces/<id>/raw returns text/markdown ---
  {
    const res = await rawTraceGET(
      new Request("http://localhost:3000/traces/ct_2026-04-17/raw"),
      { params: Promise.resolve({ id: "ct_2026-04-17" }) }
    );
    results.push(assertTrue("/traces/<id>/raw status 200", res.status === 200));
    const ct = res.headers.get("content-type") ?? "";
    results.push(
      assertTrue(
        "/traces/<id>/raw Content-Type is text/markdown",
        ct.includes("text/markdown"),
        ct
      )
    );
    const body = await res.text();
    results.push(
      assertTrue(
        "/traces/<id>/raw body contains YAML frontmatter",
        body.startsWith("---\n")
      )
    );
    results.push(
      assertTrue(
        "/traces/<id>/raw body contains '## Scenario'",
        body.includes("## Scenario")
      )
    );
  }
  {
    const res = await rawTraceGET(
      new Request("http://localhost:3000/traces/bad/raw"),
      { params: Promise.resolve({ id: "bad" }) }
    );
    results.push(
      assertTrue("/traces/<bad>/raw returns 404", res.status === 404)
    );
  }

  // --- Report ---
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    const prefix = r.ok ? "PASS" : "FAIL";
    const suffix = r.detail ? ` (${r.detail})` : "";
    console.log(`[${prefix}] ${r.label}${suffix}`);
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed.`);
    return 1;
  }

  console.log("\nM7A OK");
  return 0;
}

main().then((code) => process.exit(code));
