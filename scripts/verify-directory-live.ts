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
 *   PacksDirectory is NOW a pure server component that reads its filter
 *   state from a `searchParams` prop. We render it with `renderToStaticMarkup`
 *   for fast unit-style coverage. The tree embeds DirectorySearchBox — a
 *   client island that calls `useSearchParams` — so we still wrap the tree
 *   in the Next.js App Router contexts so the hook inside that island returns
 *   a stable URLSearchParams value.
 *
 *   Three NEW checks additionally boot `next start` and curl the live server
 *   to prove the chip row, tag chips, and narrowed grid all arrive in the
 *   initial SSR HTML response — before any client hydration. These are the
 *   assertions that would have failed against the previous "use client"
 *   + Suspense-fallback implementation.
 *
 * Run:  npx tsx --tsconfig scripts/tsconfig.json scripts/verify-directory-live.ts
 * Exit: 0 on pass (prints "DIRECTORY LIVE OK"), non-zero on any miss.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";

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
import {
  PacksDirectory,
  type DirectorySearchParams,
} from "../src/components/PacksDirectory";

// ---------- Mock router object (for DirectorySearchBox client island) ----------

const mockRouter = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  prefetch: () => Promise.resolve(),
  back: () => {},
  forward: () => {},
} as const;

// ---------- Render helper: server component + embedded client island ----------

function render(rawSearchParams: string = ""): string {
  const urlParams = new URLSearchParams(rawSearchParams);
  const data = buildDirectoryData();

  const directorySearchParams: DirectorySearchParams = {
    q: urlParams.get("q") ?? undefined,
    tag: urlParams.get("tag") ?? undefined,
    type: urlParams.get("type") ?? undefined,
    pattern: urlParams.get("pattern") ?? undefined,
    trust: urlParams.get("trust") ?? undefined,
    publisher: urlParams.get("publisher") ?? undefined,
    sort: urlParams.get("sort") ?? undefined,
  };

  const tree = React.createElement(
    AppRouterContext.Provider,
    { value: mockRouter },
    React.createElement(
      PathnameContext.Provider,
      { value: "/" },
      React.createElement(
        SearchParamsContext.Provider,
        { value: urlParams },
        React.createElement(PacksDirectory, {
          packs: data.packs,
          traceCount: data.traceCount,
          publisherCount: data.publisherCount,
          allTagsByCount: data.allTagsByCount,
          searchParams: directorySearchParams,
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
  // Non-dive seeded packs must be absent from the grid. Parse card hrefs
  // and ensure only dive packs appear as card links.
  const cardHrefRegex = /href="\/packs\/([a-z0-9-]+)"/g;
  const renderedSlugs = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = cardHrefRegex.exec(html)) !== null) {
    renderedSlugs.add(m[1]);
  }
  assert(
    !renderedSlugs.has("linear-command-palette"),
    "non-dive pack linear-command-palette filtered out",
  );
  assert(
    !renderedSlugs.has("golden-eval-harness"),
    "non-dive pack golden-eval-harness filtered out",
  );
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
    // empty. Assert the grid container is not rendered.
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

// ---------- Live-server SSR checks ----------
//
// These assert the EXACT bug being fixed: the above in-process tests use
// renderToStaticMarkup which has no Suspense fallback concept, so they'd
// have passed even against the old "use client" implementation. The live
// tests curl `next start` and prove the SSR response body (before any
// hydration JS runs) already contains the chip row, tag chips, and the
// narrowed pack grid.
//
// Boot a Next.js production server on a sidecar port to avoid clashing
// with `verify-e2e.ts` if both are run concurrently.

const ROOT = resolve(__dirname, "..");
const LIVE_PORT = Number.parseInt(
  process.env.DIRECTORY_LIVE_PORT ?? "3018",
  10,
);
const LIVE_URL = `http://localhost:${LIVE_PORT}`;

async function waitFor(url: string, timeoutMs = 120_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(4_000) });
      if (r.status < 500) return true;
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

let liveServer: ChildProcess | null = null;

async function startLiveServer(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (process.env.DIRECTORY_LIVE_SKIP_BUILD !== "1") {
    console.log("→ building Next.js production bundle...");
    const build = spawnSync("npm", ["run", "build"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      encoding: "utf8",
    });
    if (build.status !== 0) {
      const tail = (build.stderr || build.stdout || "").slice(-500);
      return { ok: false, reason: `build failed: ${tail}` };
    }
  } else {
    console.log("→ skipping build (DIRECTORY_LIVE_SKIP_BUILD=1)");
  }

  console.log(`→ starting next start on :${LIVE_PORT}...`);
  liveServer = spawn("npm", ["run", "start", "--", "-p", String(LIVE_PORT)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    env: { ...process.env, PORT: String(LIVE_PORT) },
  });
  let stderr = "";
  liveServer.stderr?.on("data", (b) => (stderr += b.toString()));
  liveServer.stdout?.on("data", () => {
    // drain pipe
  });

  const ready = await waitFor(`${LIVE_URL}/`, 90_000);
  if (!ready) {
    return { ok: false, reason: `server not ready: ${stderr.slice(-400)}` };
  }
  return { ok: true };
}

function stopLiveServer() {
  if (liveServer?.pid) {
    try {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(liveServer.pid), "/f", "/t"]);
      } else {
        process.kill(liveServer.pid);
      }
    } catch {
      // already dead
    }
  }
  liveServer = null;
}

async function fetchHtml(path: string): Promise<string> {
  const r = await fetch(`${LIVE_URL}${path}`);
  if (!r.ok) {
    throw new Error(`GET ${path} → ${r.status}`);
  }
  return r.text();
}

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

  // Live-server SSR assertions. Skip with DIRECTORY_LIVE_SKIP_SERVER=1
  // for local iteration when only the in-process checks are desired.
  if (process.env.DIRECTORY_LIVE_SKIP_SERVER !== "1") {
    const boot = await startLiveServer();
    if (!boot.ok) {
      failed++;
      console.error(`  FAIL live server boot: ${boot.reason}`);
    } else {
      try {
        process.on("exit", stopLiveServer);
        process.on("SIGINT", () => {
          stopLiveServer();
          process.exit(130);
        });

        // SSR check #1: chip row + tag chips + first 5 pack cards ship in
        // the initial SSR HTML — BEFORE any hydration.
        try {
          const html = await fetchHtml("/");
          contains(
            html,
            'data-testid="directory-count-chips"',
            "SSR HTML has directory-count-chips",
          );
          contains(
            html,
            'data-testid="tag-chip-dive-into-claude-code"',
            "SSR HTML has tag-chip-dive-into-claude-code",
          );
          contains(html, 'data-testid="tag-chip-all"', "SSR HTML has tag-chip-all");
          const firstFive = [
            "four-design-questions",
            "turn-execution-pipeline",
            "seven-safety-layers",
            "nine-context-sources",
            "subagent-delegation-three-isolation-modes",
          ];
          for (const slug of firstFive) {
            contains(
              html,
              `href="/packs/${slug}"`,
              `SSR HTML has card link for ${slug}`,
            );
          }
          notContains(
            html,
            "Loading the latest harness packs",
            "SSR HTML must not be the Suspense fallback",
          );
          console.log(`  ok  SSR GET / contains chips+tags+first 5 cards`);
        } catch (err) {
          failed++;
          console.error(
            `  FAIL SSR GET / contains chips+tags+first 5 cards:`,
            (err as Error).message,
          );
        }

        // SSR check #2: ?tag=dive-into-claude-code narrows card set to the
        // 9 dive pack slugs.
        try {
          const html = await fetchHtml("/?tag=dive-into-claude-code");
          const cardHrefRegex = /href="\/packs\/([a-z0-9-]+)"/g;
          const matches = new Set<string>();
          let m: RegExpExecArray | null;
          while ((m = cardHrefRegex.exec(html)) !== null) {
            matches.add(m[1]);
          }
          for (const slug of DIVE_PACK_SLUGS) {
            assert(
              matches.has(slug),
              `SSR tag=dive filter expected ${slug} in card set`,
            );
          }
          assert(
            !matches.has("linear-command-palette"),
            "SSR tag=dive filter must exclude linear-command-palette",
          );
          assert(
            !matches.has("golden-eval-harness"),
            "SSR tag=dive filter must exclude golden-eval-harness",
          );
          console.log(
            `  ok  SSR GET /?tag=dive-into-claude-code narrows to 9 dive packs`,
          );
        } catch (err) {
          failed++;
          console.error(
            `  FAIL SSR GET /?tag=dive-into-claude-code narrows to 9 dive packs:`,
            (err as Error).message,
          );
        }

        // SSR check #3: ?q=rag surfaces the rag-hybrid-bm25-vector pack card.
        try {
          const html = await fetchHtml("/?q=rag");
          contains(
            html,
            'href="/packs/rag-hybrid-bm25-vector"',
            "SSR q=rag must include rag-hybrid-bm25-vector card",
          );
          console.log(`  ok  SSR GET /?q=rag includes rag-hybrid-bm25-vector`);
        } catch (err) {
          failed++;
          console.error(
            `  FAIL SSR GET /?q=rag includes rag-hybrid-bm25-vector:`,
            (err as Error).message,
          );
        }
      } finally {
        stopLiveServer();
      }
    }
  } else {
    console.log("  (skipped live SSR checks — DIRECTORY_LIVE_SKIP_SERVER=1)");
  }

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log(`\nall checks passed`);
  console.log("DIRECTORY LIVE OK");
})();
