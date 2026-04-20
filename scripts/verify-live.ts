#!/usr/bin/env tsx
/**
 * verify-live.ts — the "did it actually ship?" check.
 *
 * Rule (from ~/.claude/CLAUDE.md · Live-DOM verification):
 *   Never claim "deployed" or "live" based on CLI exit codes or build logs alone.
 *   Fetch the live URL and grep for a concrete content signal.
 *
 * This script is the mechanical form of that rule for the Agent Workspace catalog.
 * It fetches production, cache-busts, and asserts the DOM contains the signals
 * that every live deploy must carry. If any check fails, exit 1 — the change
 * did NOT ship, regardless of what `git push` / `vercel --prod` reported.
 *
 * Run:  npx tsx scripts/verify-live.ts [--url=https://agentworkspace.attrition.sh]
 * Exit: 0 on full pass (prints "LIVE OK"); 1 on any miss (prints the delta).
 */

const DEFAULT_URL = "https://agentworkspace.attrition.sh";
const urlArg = process.argv.find((a) => a.startsWith("--url="))?.split("=")[1];
const ROOT = urlArg ?? DEFAULT_URL;

type Check = { name: string; re: RegExp; invert?: boolean; note?: string };

// Canonical content signals the catalog's landing must always SSR.
// When you change a signal, update this list BEFORE shipping.
const HOME_CHECKS: Check[] = [
  {
    name: "SSR fallback absent",
    re: /Loading the latest harness packs and shareable browse filters/,
    invert: true,
    note: "If this fires, PacksDirectory reverted to client-only render",
  },
  { name: "count-chip row container",       re: /data-testid="directory-count-chips"/ },
  { name: "count-packs value present",      re: /data-testid="count-packs-value"/ },
  { name: "count-traces value present",     re: /data-testid="count-traces-value"/ },
  { name: "count-publishers value present", re: /data-testid="count-publishers-value"/ },
  { name: "tag-chip 'all' rendered",        re: /data-testid="tag-chip-all"/ },
  { name: "dive-into-claude-code chip pinned", re: /data-testid="tag-chip-dive-into-claude-code"/ },
  { name: "search form rendered",           re: /data-testid="directory-search-form"/ },
  { name: "featured entry-point card",      re: /href="\/packs\/four-design-questions"/ },
];

async function fetchBust(path: string): Promise<string> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${ROOT}${path}${sep}t=${Date.now()}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.text();
}

function check(body: string, c: Check): boolean {
  const present = c.re.test(body);
  return c.invert ? !present : present;
}

async function main() {
  let passed = 0;
  let failed = 0;
  const fails: string[] = [];

  console.log(`→ verifying ${ROOT}`);

  // 1. Home page core signals
  const home = await fetchBust("/");
  for (const c of HOME_CHECKS) {
    if (check(home, c)) {
      passed++;
      console.log(`  ✓ ${c.name}`);
    } else {
      failed++;
      fails.push(c.name + (c.note ? ` — ${c.note}` : ""));
      console.log(`  ✗ ${c.name}${c.note ? `  — ${c.note}` : ""}`);
    }
  }

  // 2. Pack card rendering — count unique /packs/<slug> links
  const cards = new Set(home.match(/href="\/packs\/[a-z0-9-]+"/g) || []);
  const cardCount = cards.size;
  if (cardCount >= 20) {
    passed++;
    console.log(`  ✓ ≥20 pack cards SSR'd (got ${cardCount})`);
  } else {
    failed++;
    fails.push(`pack-card-count ${cardCount} < 20`);
    console.log(`  ✗ expected ≥20 pack cards, got ${cardCount}`);
  }

  // 3. Tag filter narrows in raw HTML (not post-hydration)
  const filtered = await fetchBust("/?tag=dive-into-claude-code");
  const fCards = new Set(filtered.match(/href="\/packs\/[a-z0-9-]+"/g) || []);
  if (fCards.size === 9) {
    passed++;
    console.log(`  ✓ ?tag=dive-into-claude-code narrows SSR to exactly 9 cards`);
  } else {
    failed++;
    fails.push(`tag-filter SSR cards=${fCards.size}, expected 9`);
    console.log(`  ✗ tag filter returned ${fCards.size} cards, expected 9`);
  }

  // 4. Pack detail route resolves
  const detail = await fetch(`${ROOT}/packs/four-design-questions`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (detail.status === 200) {
    passed++;
    console.log(`  ✓ /packs/four-design-questions → 200`);
  } else {
    failed++;
    fails.push(`/packs/four-design-questions → ${detail.status}`);
    console.log(`  ✗ /packs/four-design-questions → ${detail.status}`);
  }

  // 5. /traces directory shows the latest trace
  const traces = await fetchBust("/traces");
  if (traces.includes("ct_2026-04-19")) {
    passed++;
    console.log(`  ✓ latest trace ct_2026-04-19 visible on /traces`);
  } else {
    failed++;
    fails.push("ct_2026-04-19 missing from /traces");
    console.log(`  ✗ latest trace ct_2026-04-19 missing from /traces`);
  }

  const total = passed + failed;
  console.log(`\n${passed}/${total} live checks passed`);
  if (failed === 0) {
    console.log("LIVE OK");
    process.exit(0);
  } else {
    console.log("LIVE FAIL\n" + fails.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});
