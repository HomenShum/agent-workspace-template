#!/usr/bin/env tsx
/**
 * Scenario smoke test for /compare (gap I — cross-reference surfaces).
 *
 * Run command (JSX requires the script tsconfig):
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/verify-compare.ts
 *
 * Strategy mirrors scripts/verify-traces-ui.ts:
 *   - Happy paths render the real page component against the real
 *     registry.
 *   - Sad / adversarial paths exercise the same page — slug validation
 *     is a single chokepoint (`getPackBySlug` → `isValidSlug`) so the
 *     picker-error state must render cleanly for every invalid shape.
 *
 * No Next.js runtime is booted; the page is invoked as a plain async
 * function and fed to renderToStaticMarkup.
 *
 * Run:  npx tsx --tsconfig scripts/tsconfig.json scripts/verify-compare.ts
 * Exit: 0 on pass (prints "COMPARE OK"), non-zero on any miss.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ComparePage from "../src/app/compare/page";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type SP = Record<string, string | string[] | undefined>;

async function renderCompare(searchParams: SP): Promise<string> {
  const el = await (
    ComparePage as unknown as (args: {
      searchParams: Promise<SP>;
    }) => Promise<React.ReactElement>
  )({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(el);
}

type Check = { name: string; fn: () => Promise<void> };
const checks: Check[] = [];
function check(name: string, fn: () => Promise<void>) {
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
    throw new Error(`${label}: expected HTML NOT to contain ${JSON.stringify(needle)}`);
  }
}

// -----------------------------------------------------------------------------
// Scenario 1: Happy — both slugs resolve, both columns + merged table render.
// -----------------------------------------------------------------------------
check(
  "happy: /compare?a=rag-hybrid-bm25-vector&b=golden-eval-harness renders both columns",
  async () => {
    const html = await renderCompare({
      a: "rag-hybrid-bm25-vector",
      b: "golden-eval-harness",
    });
    contains(html, "rag-hybrid-bm25-vector", "A slug missing");
    contains(html, "golden-eval-harness", "B slug missing");
    contains(html, "Merged comparisons", "merged table heading missing");
    contains(html, "Shared shape", "shared-fields section missing");
    contains(html, "Diff highlights", "diff highlights section missing");
    // Swap link present.
    contains(
      html,
      "/compare?a=golden-eval-harness&amp;b=rag-hybrid-bm25-vector",
      "swap link should be rendered"
    );
  }
);

// -----------------------------------------------------------------------------
// Scenario 2: Happy — only `a` specified → picker shown, `b` highlighted.
// -----------------------------------------------------------------------------
check(
  "happy: /compare?a=X only → picker with b-dropdown highlighted",
  async () => {
    const html = await renderCompare({ a: "golden-eval-harness" });
    contains(html, "Pick two packs to compare", "picker heading missing");
    // b-dropdown ring shows highlight class.
    contains(html, "ring-amber-400", "b-dropdown should be highlighted");
    // Error message references the resolved A by name.
    contains(html, "Pick a second pack", "prompt copy for b missing");
  }
);

// -----------------------------------------------------------------------------
// Scenario 3: Happy — nothing specified → picker for both.
// -----------------------------------------------------------------------------
check("happy: /compare (no params) → picker landing", async () => {
  const html = await renderCompare({});
  contains(html, "Pick two packs to compare", "picker heading missing");
  contains(html, "Pack A", "A label missing");
  contains(html, "Pack B", "B label missing");
  // No merged table on landing — check for the dedicated test id on the
  // swap link, which only exists in the happy-render path.
  notContains(html, 'data-testid="compare-swap"', "swap link should not appear on landing");
});

// -----------------------------------------------------------------------------
// Scenario 4: Sad — nonexistent slug on one side.
// -----------------------------------------------------------------------------
check(
  "sad: /compare?a=nonexistent&b=golden-eval-harness → error references missing slug",
  async () => {
    const html = await renderCompare({
      a: "nonexistent-pack",
      b: "golden-eval-harness",
    });
    contains(html, "Could not find pack", "miss error copy missing");
    contains(html, "nonexistent-pack", "missing slug not surfaced in error");
    contains(html, "Pick two packs to compare", "should fall back to picker");
  }
);

// -----------------------------------------------------------------------------
// Scenario 5: Sad — same slug on both sides.
// -----------------------------------------------------------------------------
check("sad: /compare?a=X&b=X → 'pick two different packs' copy", async () => {
  const html = await renderCompare({
    a: "golden-eval-harness",
    b: "golden-eval-harness",
  });
  contains(html, "Pick two different packs", "same-slug error copy missing");
  notContains(html, 'data-testid="compare-swap"', "swap link should not render");
});

// -----------------------------------------------------------------------------
// Scenario 6: Adversarial — path traversal slug.
// -----------------------------------------------------------------------------
check(
  "adversarial: /compare?a=../etc/passwd&b=x → registry rejects, picker rendered",
  async () => {
    const html = await renderCompare({
      a: "../etc/passwd",
      b: "x",
    });
    // Registry's isValidSlug rejects both → picker with miss error.
    contains(html, "Could not find pack", "miss error copy missing");
    contains(html, "Pick two packs to compare", "should show picker");
    // Page never 500s; the unsafe characters must not appear un-escaped
    // as HTML control chars. React's escaping handles this automatically
    // for anything rendered via text children / attrs.
    notContains(html, "<script", "no raw <script injected");
  }
);

// -----------------------------------------------------------------------------
// Scenario 7: Adversarial — XSS payload in slug.
// -----------------------------------------------------------------------------
check(
  "adversarial: XSS payload in slug is escaped (never renders as HTML)",
  async () => {
    const payload = "<img src=x onerror=alert(1)>";
    const html = await renderCompare({ a: payload, b: "golden-eval-harness" });
    // React escapes text children / attrs by default. Defensive strip
    // in the page also removes angle brackets before the slug is shown
    // in the error message.
    notContains(html, payload, "raw payload should not round-trip");
    notContains(html, "onerror=", "onerror attr must not be present");
    contains(html, "Could not find pack", "should fall through to picker error");
  }
);

// -----------------------------------------------------------------------------
// Scenario 8: Happy — overlong slug → picker error, no crash.
// -----------------------------------------------------------------------------
check("adversarial: overlong slug is rejected by registry, picker rendered", async () => {
  const html = await renderCompare({
    a: "a".repeat(500),
    b: "golden-eval-harness",
  });
  contains(html, "Could not find pack", "miss error copy missing");
  contains(html, "Pick two packs to compare", "should show picker");
});

// -----------------------------------------------------------------------------
// Run.
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
    console.error(`\n${failed}/${checks.length} check(s) failed`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`\n${checks.length} check(s) passed`);
  // eslint-disable-next-line no-console
  console.log("\nCOMPARE OK");
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("fatal:", e);
  process.exit(2);
});
