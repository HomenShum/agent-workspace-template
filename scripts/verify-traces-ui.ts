#!/usr/bin/env tsx
/**
 * Scenario smoke test for /traces UI (M7d).
 *
 * Strategy:
 *   - Happy + sad paths use the REAL registry with the seeded trace
 *     `ct_2026-04-17` (the canonical MVP seed).
 *   - Adversarial / edge paths render the presentational server
 *     components directly against synthesized fixtures. This avoids
 *     the ESM "cannot redefine read-only binding" problem that blocks
 *     in-process module mocking.
 *
 * No Next.js runtime is booted; we invoke the page components as
 * plain async functions and call renderToStaticMarkup.
 *
 * Run: npx tsx --tsconfig scripts/tsconfig.json scripts/verify-traces-ui.ts
 * Exit: 0 on pass (prints "TRACES UI OK"), non-zero on any miss.
 *
 * Note: scripts/tsconfig.json flips `jsx` from "preserve" (for Next.js
 * to consume) to "react-jsx" (so esbuild-via-tsx can actually execute
 * the JSX in this script at runtime).
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  ChangeRow,
  ChangeTrace,
  FailureMode,
  WhyExplanation,
} from "../src/lib/trace-schema";

// Page components (real registry)
import TracesDirectoryPage from "../src/app/traces/page";
import TraceDetailPage from "../src/app/traces/[id]/page";

// Presentational components (fixture-driven)
import {
  CrossReferences,
  FailureModeChip,
  RowTable,
  TraceHeader,
  WhyDL,
} from "../src/app/traces/[id]/page-sections";

// -----------------------------------------------------------------------------
// Fixtures for presentational tests
// -----------------------------------------------------------------------------

function makeWhy(overrides: Partial<WhyExplanation> = {}): WhyExplanation {
  return {
    plain: "plain",
    analogy: "analogy",
    principle: "principle",
    hook: "hook",
    ...overrides,
  };
}

function makeRow(overrides: Partial<ChangeRow> = {}): ChangeRow {
  return {
    scenario: "scenario",
    filesTouched: ["src/foo.ts"],
    changes: [
      {
        path: "src/foo.ts",
        symbolsAdded: ["Foo"],
        symbolsRenamed: [],
        symbolsRemoved: [],
        diffSummary: "added Foo",
      },
    ],
    why: makeWhy(),
    ...overrides,
  };
}

function makeTrace(overrides: Partial<ChangeTrace> = {}): ChangeTrace {
  return {
    id: "ct_2099-01-01",
    project: "fixture-project",
    sessionId: "fixture-session",
    createdAt: "2099-01-01T00:00:00Z",
    tags: ["fixture"],
    packsReferenced: ["some-pack"],
    rows: [makeRow()],
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// Tiny test harness
// -----------------------------------------------------------------------------

type Check = { name: string; fn: () => Promise<void> | void };
const checks: Check[] = [];
function check(name: string, fn: Check["fn"]) {
  checks.push({ name, fn });
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
function contains(html: string, needle: string, label: string) {
  if (!html.includes(needle)) {
    throw new Error(`${label}: expected HTML to contain "${needle}"`);
  }
}
function notContains(html: string, needle: string, label: string) {
  if (html.includes(needle)) {
    throw new Error(`${label}: expected HTML NOT to contain "${needle}"`);
  }
}
function render(el: React.ReactElement): string {
  return renderToStaticMarkup(el);
}
async function renderAsyncComponent(
  factory: () => Promise<React.ReactElement>,
): Promise<string> {
  const el = await factory();
  return renderToStaticMarkup(el);
}

// -----------------------------------------------------------------------------
// Happy: directory page with real registry
// -----------------------------------------------------------------------------

check("happy: directory renders header + seeded row + footer; no raw-md link", async () => {
  const html = await renderAsyncComponent(() =>
    TracesDirectoryPage({ searchParams: Promise.resolve({}) }),
  );
  contains(html, "Change traces", "dir header");
  contains(html, "ct_2026-04-17", "seeded row id present");
  contains(html, "agent-workspace-template", "project cell for seed");
  contains(html, "Every coding session captured", "explanatory copy");
  contains(html, "Last 7 days", "range filter chip");
  contains(html, "Project", "project filter label");
  notContains(html, "Download raw .md", "directory should not show raw-md link");
  contains(html, "total rows", "footer summary stats text");
});

// -----------------------------------------------------------------------------
// Happy: detail page for seeded trace
// -----------------------------------------------------------------------------

check("happy: detail renders seeded rows + packsReferenced + raw-md + hook", async () => {
  const html = await renderAsyncComponent(() =>
    TraceDetailPage({ params: Promise.resolve({ id: "ct_2026-04-17" }) }),
  );
  contains(html, "ct_2026-04-17", "detail id in header");
  contains(html, "Download raw .md", "detail raw-md link");
  // packsReferenced from seed
  contains(html, "golden-eval-harness", "packsReferenced chip");
  // Known scenarios from seed (rows 1, 9, 10, 11 in the MD)
  contains(html, "Five parallel workers", "row 1 scenario");
  contains(html, "First real CLI install failed", "row 9 scenario");
  contains(html, "Retry after the envelope fix", "row 10 scenario");
  contains(html, "concurrent install tests hit random Windows EPERM", "row 11 scenario");
  // Prominent why-hook from row 1
  contains(html, "Pin the shape before the work.", "why-hook row 1 prominent");
  // Tier chips — row 1 is "mid", row 9 is "sr"
  const tierLabels = ["Mid", "Senior"];
  for (const label of tierLabels) {
    contains(html, label, `tier label: ${label}`);
  }
});

// -----------------------------------------------------------------------------
// Happy: symbol filter link exists on detail page
// -----------------------------------------------------------------------------

check("happy: symbol filter link exists for a row symbol", async () => {
  const html = await renderAsyncComponent(() =>
    TraceDetailPage({ params: Promise.resolve({ id: "ct_2026-04-17" }) }),
  );
  // Seed has symbolsAdded: ["Pack", "PackContract", ...]
  contains(html, "/traces?symbol=Pack", "symbol filter link for Pack");
  contains(html, "/traces?file=", "file filter link on a filesTouched chip");
});

// -----------------------------------------------------------------------------
// Sad: /traces/nonexistent → notFound() throws
// -----------------------------------------------------------------------------

check("sad: /traces/nonexistent → notFound() is invoked", async () => {
  let threw: unknown = null;
  try {
    await renderAsyncComponent(() =>
      TraceDetailPage({ params: Promise.resolve({ id: "ct_9999-99-99" }) }),
    );
  } catch (err) {
    threw = err;
  }
  assert(threw, "notFound() should throw when trace id missing");
});

// -----------------------------------------------------------------------------
// Sad: empty-state copy renders from the directory EmptyState branch
// (We test via the directory page's internal rendering — force it by
//  querying for something impossible; the filter yields 0 matches.)
// -----------------------------------------------------------------------------

check("sad: no matches → empty-state copy is rendered by the directory", async () => {
  const html = await renderAsyncComponent(() =>
    TracesDirectoryPage({
      searchParams: Promise.resolve({ q: "zzz_impossible_needle_string_zzz" }),
    }),
  );
  contains(html, "No traces match", "empty state title");
  contains(html, "Start your first one", "empty state copy");
  contains(html, "attrition trace log", "cli hint");
});

// -----------------------------------------------------------------------------
// Adversarial: RowTable with one row that has no failureModes.
// Section must be omitted; scenario still renders.
// -----------------------------------------------------------------------------

check("adversarial: row without failureModes renders without crash + no panel", () => {
  const row = makeRow({
    scenario: "no-failures scenario",
    failureModes: undefined,
  });
  const html = render(React.createElement(RowTable, { rows: [row] }));
  contains(html, "no-failures scenario", "scenario rendered");
  notContains(html, "Failure modes", "Failure-modes section should be absent");
});

// -----------------------------------------------------------------------------
// Adversarial: XSS in why-hook must be escaped.
// -----------------------------------------------------------------------------

check("adversarial: <script> in WhyDL hook is escaped, not executed", () => {
  const why = makeWhy({ hook: "<script>alert(1)</script>" });
  const html = render(React.createElement(WhyDL, { why }));
  contains(html, "&lt;script&gt;", "script tag escaped in DOM output");
  notContains(html, "<script>alert(1)</script>", "raw script tag must not appear");
});

check("adversarial: <script> in scenario via RowTable is escaped", () => {
  const row = makeRow({ scenario: "<script>alert(2)</script>" });
  const html = render(React.createElement(RowTable, { rows: [row] }));
  contains(html, "&lt;script&gt;alert(2)&lt;/script&gt;", "scenario escaped");
  notContains(html, "<script>alert(2)</script>", "raw scenario script must not appear");
});

// -----------------------------------------------------------------------------
// Edge: trace with 0 rows
// -----------------------------------------------------------------------------

check("edge: RowTable with 0 rows renders 'No rows yet' copy", () => {
  const html = render(React.createElement(RowTable, { rows: [] }));
  contains(html, "No rows yet", "zero-row empty state");
});

// -----------------------------------------------------------------------------
// Sanity: TraceHeader + CrossReferences + FailureModeChip render standalone
// -----------------------------------------------------------------------------

check("sanity: TraceHeader renders id, tags, packs chips, raw-md link", () => {
  const trace = makeTrace();
  const html = render(
    React.createElement(TraceHeader, {
      trace,
      rawPath: `/traces/${trace.id}/raw`,
      stats: { rows: trace.rows.length, files: 1, symbols: 1 },
    }),
  );
  contains(html, trace.id, "id");
  contains(html, "#fixture", "tag chip");
  contains(html, "/packs/some-pack", "packsReferenced chip link");
  contains(html, "Download raw .md", "raw-md link");
});

check("sanity: CrossReferences omits when no packs + no tags", () => {
  const trace = makeTrace({ packsReferenced: [], tags: [] });
  const html = render(React.createElement(CrossReferences, { trace }));
  // When empty, component returns null → empty string
  assert(html === "", "CrossReferences should render nothing when empty");
});

check("sanity: FailureModeChip renders each tier with its label", () => {
  const tiers: FailureMode["tier"][] = ["jr", "mid", "sr", "staff"];
  const expected: Record<FailureMode["tier"], string> = {
    jr: "Junior",
    mid: "Mid",
    sr: "Senior",
    staff: "Staff",
  };
  for (const tier of tiers) {
    const html = render(React.createElement(FailureModeChip, { tier }));
    contains(html, expected[tier], `tier chip label for ${tier}`);
  }
});

// -----------------------------------------------------------------------------
// Run
// -----------------------------------------------------------------------------

(async () => {
  let failed = 0;
  for (const c of checks) {
    try {
      await c.fn();
      // eslint-disable-next-line no-console
      console.log(`  ok  ${c.name}`);
    } catch (err) {
      failed++;
      // eslint-disable-next-line no-console
      console.error(`  FAIL ${c.name}:`, (err as Error).message);
    }
  }
  if (failed > 0) {
    // eslint-disable-next-line no-console
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`\n${checks.length} check(s) passed`);
  // eslint-disable-next-line no-console
  console.log("TRACES UI OK");
})();
