#!/usr/bin/env tsx
/**
 * Scenario smoke test for the directory landing (/) redesign.
 *
 * Covers the Pillar-1 landing contract:
 *   - Every seeded + legacy pack surfaces in the grid.
 *   - Live count chips: `Packs · N`, `Traces · N`, `Publishers · N`.
 *   - Type / Pattern / Tag / Trust chips render with live counts.
 *   - The dive-into-claude-code tag chip is pinned with its count.
 *   - URL params (`?tag=…`, `?trust=…`) filter the grid correctly.
 *   - Combined filters that yield zero matches render the empty state.
 *   - Featured ordering: `four-design-questions` (featured=true, Community)
 *     lands in the top slot when no filters are active.
 *
 * Strategy:
 *   `PacksDirectory` is a `"use client"` component that calls
 *   `useRouter`/`usePathname`/`useSearchParams` from `next/navigation`.
 *   The real hooks read three Next.js internal React contexts
 *   (`AppRouterContext`, `PathnameContext`, `SearchParamsContext`).
 *   We import those contexts from their shared-runtime modules and
 *   wrap the component in matching providers so the real hooks return
 *   our test values without booting a Next.js server.
 *
 * Run:  npx tsx --tsconfig scripts/tsconfig.json scripts/verify-directory-live.ts
 * Exit: 0 on pass (prints "DIRECTORY LIVE OK"), non-zero on any miss.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Next.js internal contexts — imported from the shared-runtime modules that
// next/navigation consumes at hook call time. These paths are stable enough
// that verify-pack-page.ts / verify-traces-ui.ts would also break if Next
// shifted them; in that case all *-ui.ts scripts update together.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  AppRouterContext,
} = require("next/dist/shared/lib/app-router-context.shared-runtime");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  PathnameContext,
  SearchParamsContext,
} = require("next/dist/shared/lib/hooks-client-context.shared-runtime");

import { buildDirectoryData } from "../src/app/directory-data";
import { pickTagChipSet, PINNED_TAG } from "../src/lib/directory-tags";
import { PacksDirectory } from "../src/components/PacksDirectory";

// ---------- Mock router object ----------

const mockRouter = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  prefetch: () => Promise.resolve(),
  back: () => {},
  forward: () => {},
} as const;

// ---------- Render helper: wraps PacksDirectory with context providers ----------

function render(rawSearchParams: string = ""): string {
  const searchParams = new URLSearchParams(rawSearchParams);
  const data = buildDirectoryData();

  const tree = React.createElement(
    AppRouterContext.Provider,
    { value: mockRouter },
    React.createElement(
      PathnameContext.Provider,
      { value: "/" },
      React.createElement(
        SearchParamsContext.Provider,
        { value: searchParams },
        React.createElement(PacksDirectory, {
          packs: data.packs,
          traceCount: data.traceCount,
          publisherCount: data.publisherCount,
          allTagsByCount: data.allTagsByCount,
        }),
      ),
    ),
  );

  return renderToStaticMarkup(tree);
}

// ---------- Tiny harness ----------

type Check = { name: string; fn: () => void | Promise<void> };
const checks: Check[] = [];
function check(name: string, fn: Check["fn"]) {
  checks.push({ name, fn });
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
function contains(html: string, needle: string, label: string) {
  if (!html.includes(needle)) {
    throw new Error(`${label}: expected HTML to contain ${JSON.stringify(needle)}`);
  }
}
function notContains(html: string, needle: string, label: string) {
  if (html.includes(needle)) {
    throw new Error(
      `${label}: expected HTML NOT to contain ${JSON.stringify(needle)}`,
    );
  }
}

// ---------- Canonical pack-slug roster ----------

const REQUIRED_SEEDED_SLUGS = [
  "four-design-questions",
  "turn-execution-pipeline",
  "seven-safety-layers",
  "cve-pre-trust-window",
  "shadcn-data-table",
  "linear-command-palette",
  "rag-hybrid-bm25-vector",
  "golden-eval-harness",
  "pattern-decision-tree",
  "claude-code-guide",
  "advisor-pattern-v2",
  "injection-surface-audit",
  "nine-context-sources",
  "subagent-delegation-three-isolation-modes",
  "extensibility-four-mechanisms",
  "session-persistence-three-channels",
  "agent-design-space-six-decisions",
];

const DIVE_PACK_SLUGS = [
  "four-design-questions",
  "turn-execution-pipeline",
  "seven-safety-layers",
  "nine-context-sources",
  "subagent-delegation-three-isolation-modes",
  "extensibility-four-mechanisms",
  "session-persistence-three-channels",
  "agent-design-space-six-decisions",
  "cve-pre-trust-window",
];

// ---------- Pure data-builder checks ----------

check("buildDirectoryData returns all 17 seeded slugs", () => {
  const data = buildDirectoryData();
  for (const slug of REQUIRED_SEEDED_SLUGS) {
    assert(
      data.packs.some((p) => p.slug === slug),
      `missing seeded slug ${slug}`,
    );
  }
});

check("buildDirectoryData surfaces >= 23 total packs", () => {
  const data = buildDirectoryData();
  assert(
    data.packs.length >= 23,
    `expected >=23 packs, got ${data.packs.length}`,
  );
});

check("traceCount is a non-negative integer derived from trace registry", () => {
  const data = buildDirectoryData();
  assert(
    Number.isInteger(data.traceCount) && data.traceCount >= 0,
    `traceCount invalid: ${data.traceCount}`,
  );
});

check("publisherCount >= 1 and reflects merged catalog distinct publishers", () => {
  const data = buildDirectoryData();
  const distinctFromPacks = new Set(data.packs.map((p) => p.publisher)).size;
  assert(
    data.publisherCount === distinctFromPacks && data.publisherCount >= 1,
    `publisherCount ${data.publisherCount} vs distinct ${distinctFromPacks}`,
  );
});

check("dive-into-claude-code tag counts to exactly 9", () => {
  const data = buildDirectoryData();
  const entry = data.allTagsByCount.find((t) => t.tag === PINNED_TAG);
  assert(entry, "dive-into-claude-code tag should be present in allTagsByCount");
  assert(
    entry.count === DIVE_PACK_SLUGS.length,
    `expected count=${DIVE_PACK_SLUGS.length}, got ${entry.count}`,
  );
});

check("pickTagChipSet always includes the pinned dive tag", () => {
  const data = buildDirectoryData();
  const chips = pickTagChipSet(data.allTagsByCount);
  assert(
    chips.some((c) => c.tag === PINNED_TAG),
    "dive-into-claude-code not present in chip set",
  );
});

// ---------- Render checks against the canonical Pack[] ----------

check("landing renders every seeded pack slug as a card link", () => {
  const html = render("");
  for (const slug of REQUIRED_SEEDED_SLUGS) {
    contains(html, `/packs/${slug}`, `card link for ${slug}`);
  }
});

check("landing renders live count chip 'Packs · N' with live N", () => {
  const data = buildDirectoryData();
  const html = render("");
  contains(html, `Packs · ${data.packs.length}`, "Packs count chip");
  contains(html, `Traces · ${data.traceCount}`, "Traces count chip");
  contains(
    html,
    `Publishers · ${data.publisherCount}`,
    "Publishers count chip",
  );
});

check("type chip 'harness' present with count >= 4", () => {
  const data = buildDirectoryData();
  const harnessCount = data.packs.filter((p) => p.packType === "harness").length;
  assert(harnessCount >= 4, `expected harness >=4, got ${harnessCount}`);
  const html = render("");
  contains(html, 'data-testid="type-chip-harness"', "harness type chip present");
});

check("pattern chip 'orchestrator-workers' present (not filtered by n/a)", () => {
  const html = render("");
  contains(
    html,
    'data-testid="pattern-chip-orchestrator-workers"',
    "orchestrator-workers pattern chip present",
  );
  notContains(html, 'data-testid="pattern-chip-n/a"', "n/a pattern must be filtered");
});

check("tag chip row shows 'dive-into-claude-code · 9'", () => {
  const html = render("");
  contains(html, "dive-into-claude-code · 9", "dive tag chip label");
  contains(
    html,
    'data-testid="tag-chip-dive-into-claude-code"',
    "dive tag chip data-testid",
  );
});

check("?tag=dive-into-claude-code filters the grid to the 9 dive packs", () => {
  const html = render("tag=dive-into-claude-code");
  for (const slug of DIVE_PACK_SLUGS) {
    contains(html, `/packs/${slug}`, `dive pack ${slug} present`);
  }
  // Non-dive seeded pack must be absent
  notContains(html, "/packs/linear-command-palette", "non-dive pack filtered out");
  notContains(html, "/packs/golden-eval-harness", "non-dive pack filtered out");
});

check(
  "?tag=dive-into-claude-code&trust=Verified → zero matches + empty state",
  () => {
    const html = render("tag=dive-into-claude-code&trust=Verified");
    contains(
      html,
      'data-testid="directory-empty-state"',
      "empty-state rendered",
    );
    contains(html, "No packs match", "empty-state heading");
    // The tag-chip row still shows the dive chip link, but the GRID must be
    // empty. Assert the card <a href="/packs/..."> entries are absent by
    // checking the grid container is not rendered.
    notContains(
      html,
      'data-testid="directory-grid"',
      "grid container should be absent under empty state",
    );
  },
);

check(
  "first card of the whole page (Featured section) is four-design-questions",
  () => {
    const html = render("");
    // The Featured section "Start here" precedes the directory grid. The
    // first `/packs/...` link in the full page HTML must be the entry-point
    // `four-design-questions` pack (registry index 0, `featured: true`).
    const data = buildDirectoryData();
    const slugs = data.packs.map((p) => p.slug);
    const positions = slugs
      .map((slug) => ({ slug, idx: html.indexOf(`href="/packs/${slug}"`) }))
      .filter((entry) => entry.idx >= 0)
      .sort((a, b) => a.idx - b.idx);
    assert(positions.length > 0, "no pack-card href found in rendered HTML");
    assert(
      positions[0].slug === "four-design-questions",
      `top slot expected four-design-questions, got ${positions[0].slug}`,
    );
  },
);

check("?q=dive filters to packs mentioning 'dive' and retains tag chip row", () => {
  const html = render("q=dive");
  contains(html, "/packs/four-design-questions", "dive pack should match q=dive");
  contains(
    html,
    'data-testid="directory-tag-chip-row"',
    "tag chip row still rendered under q filter",
  );
});

check(
  "featured section 'Start here' renders four-design-questions at top",
  () => {
    const html = render("");
    const featuredIdx = html.indexOf("Start here");
    const firstCardIdx = html.indexOf("/packs/four-design-questions");
    assert(featuredIdx >= 0, "Featured section missing");
    assert(firstCardIdx >= 0, "four-design-questions card missing");
    assert(
      firstCardIdx > featuredIdx,
      `first card should follow the Featured label (featuredIdx=${featuredIdx}, cardIdx=${firstCardIdx})`,
    );
  },
);

// ---------- Run ----------

(async () => {
  let failed = 0;
  for (const c of checks) {
    try {
      await c.fn();
      console.log(`  ok  ${c.name}`);
    } catch (err) {
      failed++;
      console.error(`  FAIL ${c.name}:`, (err as Error).message);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log(`\n${checks.length} check(s) passed`);
  console.log("DIRECTORY LIVE OK");
})();
