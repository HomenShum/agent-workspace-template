#!/usr/bin/env tsx
/**
 * Scenario-level verification for D1 (telemetry badges) and J (install /
 * tokens-saved badges) on pack cards.
 *
 * Does not spin up Next.js. Tests operate against:
 *   - The server-rendered PackCard (React.renderToStaticMarkup)
 *   - The file-backed install-counts module (src/lib/install-counts.ts)
 *   - The pure formatters exported from PackCard for overflow / bound checks
 *
 * Scenarios covered:
 *   Happy   — pack with telemetry + rediscoveryCost + installCount: card
 *             renders passRate, avgTokens, avgCost, install count, tokens-saved.
 *   Sad     — pack with no telemetry: "Not yet measured" muted text present.
 *   Sad     — pack with no installCount: renders "~0 installs" (no crash).
 *   Adv     — malformed install-counts.json: module load returns 0 for all slugs.
 *   Adv     — installCount = 999_999_999: bounded to PER_SLUG_CAP, format does
 *             not overflow (renders "~1M installs").
 *
 * Run: npx tsx scripts/verify-d1-j.ts
 * Exit: 0 on pass (prints "D1+J OK"), non-zero on miss.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Import the pure strips directly. Rendering the full PackCard pulls in
// next/link + PackArtwork, which don't ship a React import and thus crash
// under tsx's classic JSX runtime. The strips are the D1+J surface under
// test, so we exercise them in isolation — the string-search below proves
// PackCard wires them in.
import {
  TelemetryStrip,
  InstallBadge,
  __formatters,
} from "../src/components/PackCard";
import {
  getInstallCount,
  incrementInstallCount,
  __resetInstallCountsCacheForTests,
  PER_SLUG_CAP,
} from "../src/lib/install-counts";
import type {
  Pack,
  Telemetry,
  RediscoveryCost,
} from "../src/lib/pack-schema";

const ROOT = resolve(__dirname, "..");
const COUNTS_DIR = join(ROOT, ".attrition");
const COUNTS_FILE = join(COUNTS_DIR, "install-counts.json");

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  const mark = ok ? "✓" : "✗";
  // Deliberately plain — no ANSI, no unicode that might trip Windows shells.
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

// Integration guard: prove the strips are wired into PackCard. If someone
// later removes them, this script fails even though the unit-level strip
// renders still pass.
{
  const packCardSrc = readFileSync(
    resolve(__dirname, "..", "src", "components", "PackCard.tsx"),
    "utf8",
  );
  const telemetryWired =
    packCardSrc.includes("<TelemetryStrip") ||
    packCardSrc.includes("TelemetryStrip(");
  const installBadgeWired =
    packCardSrc.includes("<InstallBadge") ||
    packCardSrc.includes("InstallBadge(");
  checks.push({
    name: "integration: PackCard renders TelemetryStrip",
    ok: telemetryWired,
  });
  checks.push({
    name: "integration: PackCard renders InstallBadge",
    ok: installBadgeWired,
  });
  console.log(telemetryWired ? "✓" : "✗", "integration: PackCard renders TelemetryStrip");
  console.log(installBadgeWired ? "✓" : "✗", "integration: PackCard renders InstallBadge");
}

function makePack(overrides: Partial<Pack>): Pack {
  const base: Pack = {
    slug: "test-pack",
    name: "Test Pack",
    tagline: "tagline",
    summary: "summary",
    packType: "ui",
    canonicalPattern: "hybrid",
    version: "0.1.0",
    trust: "Verified",
    status: "Production-ready",
    featured: false,
    publisher: "Agent Workspace",
    gradient: "linear-gradient(135deg, #fff, #fff)",
    updatedAt: "2026-04-17",
    compatibility: ["Claude Code"],
    tags: ["tag-a"],
    installCommand: "npx attrition-sh pack install test-pack",
    claudeCodeSnippet: "",
    rawMarkdownPath: "/packs/test-pack/raw",
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
  };
  return { ...base, ...overrides };
}

function saveCountsFile(contents: string) {
  if (!existsSync(COUNTS_DIR)) mkdirSync(COUNTS_DIR, { recursive: true });
  writeFileSync(COUNTS_FILE, contents, "utf8");
  __resetInstallCountsCacheForTests();
}

function removeCountsFile() {
  try {
    if (existsSync(COUNTS_FILE)) unlinkSync(COUNTS_FILE);
  } catch {
    // ignore
  }
  __resetInstallCountsCacheForTests();
}

// --- preserve any pre-existing counts file so the script is non-destructive ---
const hadPreexisting = existsSync(COUNTS_FILE);
const preexisting = hadPreexisting ? readFileSync(COUNTS_FILE, "utf8") : null;

function restore() {
  if (hadPreexisting && preexisting !== null) {
    saveCountsFile(preexisting);
  } else {
    removeCountsFile();
  }
}

process.on("exit", restore);
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});

// ---------- Happy path ----------
{
  const telemetry: Telemetry = {
    lastNRuns: 50,
    avgTokens: 8_400,
    avgCost: 0.08,
    passRate: 0.94,
    lastUpdated: "2026-04-01",
  };
  const rediscovery: RediscoveryCost = {
    tokens: 12_000,
    minutes: 45,
    measuredAt: "2026-04-01",
    methodology: "deep-research prompt baseline",
  };
  // sanity: pack construction should not throw for the canonical shape
  const pack = makePack({
    slug: "happy-pack",
    telemetry,
    rediscoveryCost: rediscovery,
    installCount: 42,
  });
  record("happy: pack has telemetry", !!pack.telemetry);

  const telHtml = render(React.createElement(TelemetryStrip, { telemetry }));
  const badgeHtml = render(
    React.createElement(InstallBadge, {
      installCount: 42,
      rediscoveryCost: rediscovery,
    }),
  );

  record(
    "happy: passRate rendered as 94%",
    telHtml.includes("pass 94%"),
    telHtml.includes("pass 94%") ? undefined : "missing 'pass 94%'",
  );
  record(
    "happy: avgTokens rendered as 8.4k tok",
    telHtml.includes("8.4k tok"),
    telHtml.includes("8.4k tok") ? undefined : "missing '8.4k tok'",
  );
  record(
    "happy: avgCost rendered as $0.08",
    telHtml.includes("$0.08"),
    telHtml.includes("$0.08") ? undefined : "missing '$0.08'",
  );
  record("happy: install count visible", badgeHtml.includes("~42 installs"));
  record(
    "happy: tokens-saved badge visible (42 * 12_000 = 504_000 = 504k)",
    badgeHtml.includes("~504k tokens saved"),
    badgeHtml.includes("~504k tokens saved") ? undefined : "missing saved-tokens",
  );
  record(
    "happy: telemetry strip did NOT render 'Not yet measured'",
    !telHtml.includes("Not yet measured"),
  );
}

// ---------- Sad: no telemetry ----------
{
  const telHtml = render(
    React.createElement(TelemetryStrip, { telemetry: undefined }),
  );
  record(
    "sad(no-telemetry): 'Not yet measured' present",
    telHtml.includes("Not yet measured"),
  );
  record(
    "sad(no-telemetry): muted class present",
    telHtml.includes("text-slate-400"),
    "expected muted telemetry row to use text-slate-400",
  );
}

// ---------- Sad: no installCount ----------
{
  const badgeHtml = render(
    React.createElement(InstallBadge, {
      installCount: 0,
      rediscoveryCost: undefined,
    }),
  );
  record(
    "sad(no-installCount): renders '~0 installs' without crashing",
    badgeHtml.includes("~0 installs"),
  );
  record(
    "sad(no-installCount): omits tokens-saved clause (honest)",
    !badgeHtml.includes("tokens saved"),
  );
}

// ---------- Adversarial: malformed install-counts.json ----------
{
  saveCountsFile("{not valid json}}");
  const loaded = getInstallCount("anything");
  record(
    "adv(malformed-json): getInstallCount returns 0 for any slug",
    loaded === 0,
    `loaded=${loaded}`,
  );

  // Also: a non-object root (array) — should safe-default to 0.
  saveCountsFile("[1,2,3]");
  const loaded2 = getInstallCount("anything");
  record(
    "adv(array-root): getInstallCount returns 0",
    loaded2 === 0,
    `loaded=${loaded2}`,
  );

  // Tampered-up value beyond cap — load-time clamp applies.
  saveCountsFile(JSON.stringify({ tampered: 10_000_000_000 }));
  const loaded3 = getInstallCount("tampered");
  record(
    "adv(tampered-overflow): load-time clamp applied to PER_SLUG_CAP",
    loaded3 === PER_SLUG_CAP,
    `loaded=${loaded3}`,
  );
}

// ---------- Adversarial: increment cap is honored ----------
{
  saveCountsFile(JSON.stringify({ near_cap: PER_SLUG_CAP - 1 }));
  const one = incrementInstallCount("near_cap");
  record(
    "adv(cap-approach): increment to exactly cap succeeds",
    one === PER_SLUG_CAP,
    `got=${one}`,
  );
  const two = incrementInstallCount("near_cap");
  record(
    "adv(cap-hit): further increments are no-op and return cap",
    two === PER_SLUG_CAP,
    `got=${two}`,
  );
}

// ---------- Adversarial: 999_999_999 in Pack.installCount does not overflow card ----------
{
  const rediscovery: RediscoveryCost = {
    tokens: 5_000,
    minutes: 10,
    measuredAt: "2026-04-01",
    methodology: "deep research",
  };
  const badgeHtml = render(
    React.createElement(InstallBadge, {
      installCount: 999_999_999,
      rediscoveryCost: rediscovery,
    }),
  );
  // boundedCount caps to 1_000_000 which formatCount renders as "1M".
  record(
    "adv(installCount-overflow): count is bounded and formatted without overflow",
    badgeHtml.includes("~1M installs"),
    badgeHtml.includes("~1M installs")
      ? undefined
      : "expected '~1M installs' in html",
  );
  // 1_000_000 * 5_000 = 5_000_000_000 = 5B tokens.
  record(
    "adv(installCount-overflow): tokens-saved stays formatted (5B)",
    badgeHtml.includes("~5B tokens saved"),
    badgeHtml.includes("~5B tokens saved")
      ? undefined
      : "expected '~5B tokens saved'",
  );
}

// ---------- Formatter unit smoke (defense-in-depth) ----------
{
  const { formatCount, formatTokens, formatPercent, formatCost, boundedCount } =
    __formatters;
  record("fmt: formatCount(0) == '0'", formatCount(0) === "0");
  record("fmt: formatCount(999) == '999'", formatCount(999) === "999");
  record("fmt: formatCount(1234) == '1.2k'", formatCount(1234) === "1.2k");
  record("fmt: formatCount(1_000_000) == '1M'", formatCount(1_000_000) === "1M");
  record("fmt: formatTokens(8400) == '8.4k'", formatTokens(8400) === "8.4k");
  record("fmt: formatTokens(504_000) == '504k'", formatTokens(504_000) === "504k");
  record("fmt: formatTokens(5_000_000_000) == '5B'", formatTokens(5_000_000_000) === "5B");
  record("fmt: formatPercent(0.94) == '94%'", formatPercent(0.94) === "94%");
  record("fmt: formatPercent(94) == '94%' (defensive)", formatPercent(94) === "94%");
  record("fmt: formatCost(0.08) == '$0.08'", formatCost(0.08) === "$0.08");
  record("fmt: boundedCount(-5) == 0", boundedCount(-5) === 0);
  record(
    "fmt: boundedCount(NaN) == 0",
    boundedCount(Number.NaN as unknown as number) === 0,
  );
}

// ---------- Finalize ----------
const passed = checks.filter((c) => c.ok).length;
const total = checks.length;
console.log("");
console.log(`${passed}/${total} D1+J checks passed`);
if (passed === total) {
  console.log("D1+J OK");
  restore();
  process.exit(0);
} else {
  console.log("D1+J FAIL");
  restore();
  process.exit(1);
}
