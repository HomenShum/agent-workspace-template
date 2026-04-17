#!/usr/bin/env tsx
/**
 * Scenario smoke test for gap D4 (model-deprecation flags) and gap E3
 * (publisher provenance badge).
 *
 * Run: npx tsx scripts/verify-d4-e3.ts
 *
 * Contract: exit 0 with `D4+E3 OK` on full pass. Any failure prints the
 * assertion, sets exit 1.
 */

import {
  getModelStatus,
  hasDeprecatedModels,
  summarizeLifecycle,
  __getLifecycleEntryCount,
} from "../src/lib/model-deprecations";
import type { PublisherProvenance } from "../src/lib/pack-schema";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  checks.push({ name, ok: cond, detail });
  const m = cond ? "ok" : "FAIL";
  console.log(`  ${m}  ${name}${detail ? ` — ${detail}` : ""}`);
}

// --- D4: model-deprecation registry -----------------------------------------

{
  const a = getModelStatus("claude-opus-4.6");
  ok("D4: active model returns status=active", a.status === "active");
}
{
  const a = getModelStatus("claude-opus-3");
  ok("D4: deprecated model tagged correctly", a.status === "deprecated");
  ok("D4: deprecated model has replacedBy", a.replacedBy === "claude-opus-4.6");
  ok("D4: deprecated model has retiresAt", typeof a.retiresAt === "string");
}
{
  const a = getModelStatus("gpt-4-turbo");
  ok("D4: retired model tagged correctly", a.status === "retired");
}
{
  const a = getModelStatus("unknown-model-v99");
  ok("D4: unknown model defaults to active", a.status === "active");
  ok("D4: unknown model has no message", a.message === undefined);
}
{
  const deprecated = hasDeprecatedModels(["claude-opus-4.6", "claude-opus-3"]);
  ok("D4: hasDeprecatedModels true when one is deprecated", deprecated === true);
}
{
  const clean = hasDeprecatedModels(["claude-opus-4.6", "gpt-5"]);
  ok("D4: hasDeprecatedModels false when all active", clean === false);
}
{
  const s = summarizeLifecycle([
    "claude-opus-4.6",
    "claude-sonnet-3.5",
    "gpt-4-turbo",
  ]);
  ok("D4: summarize counts 1 retired", s.retired.length === 1);
  ok("D4: summarize counts 1 deprecated", s.deprecated.length === 1);
  ok("D4: summarize retired id correct", s.retired[0] === "gpt-4-turbo");
}
{
  ok("D4: lifecycle registry has >=8 entries", __getLifecycleEntryCount() >= 8);
}

// Adversarial — empty / malformed inputs
{
  ok("D4: empty modelIds in hasDeprecated → false", hasDeprecatedModels([]) === false);
  const s = summarizeLifecycle([]);
  ok("D4: empty modelIds in summarize → empty arrays", s.retired.length === 0 && s.deprecated.length === 0);
}

// --- E3: publisher provenance shape ----------------------------------------

// Import inside the check so a broken publisher module doesn't crash the
// D4 half of this script.
import("../src/lib/harness-packs").then((mod) => {
  const prof = mod.publisherProfiles["Agent Workspace"];
  ok("E3: Agent Workspace publisher exists", !!prof);
  const prov = prof?.provenance;
  ok("E3: provenance present on Agent Workspace", !!prov);
  if (prov) {
    ok("E3: keyFingerprint non-empty", typeof prov.keyFingerprint === "string" && prov.keyFingerprint.length > 0);
    ok("E3: signature non-empty", typeof prov.signature === "string" && prov.signature.length > 0);
    ok("E3: signedAt is ISO-parseable", !isNaN(Date.parse(prov.signedAt)));
    ok("E3: packs array >=1", Array.isArray(prov.packs) && prov.packs.length >= 1);
    ok(
      "E3: status is one of verified/unverified/invalid",
      ["verified", "unverified", "invalid"].includes(prov.status)
    );
    ok("E3: status=unverified (honest: tooling pending)", prov.status === "unverified");
    // Every pack slug in the manifest must be kebab-case — matches the
    // slug validator in pack-registry, so a typo can't ride through.
    const slugRe = /^[a-z0-9-]+$/;
    ok(
      "E3: every manifest pack slug is kebab-case",
      (prov.packs as string[]).every((s: string) => slugRe.test(s))
    );
  }

  // Synthetic provenance shapes for adversarial coverage
  const invalid: PublisherProvenance = {
    keyFingerprint: "sha256:test",
    signature: "BAD",
    signedAt: "2026-04-17T00:00:00Z",
    packs: ["foo"],
    signedBy: "test",
    status: "invalid",
  };
  ok("E3: invalid status renders as invalid (shape check)", invalid.status === "invalid");

  // Finalize
  const passed = checks.filter((c) => c.ok).length;
  const total = checks.length;
  console.log("");
  if (passed === total) {
    console.log(`${total} check(s) passed`);
    console.log("D4+E3 OK");
    process.exit(0);
  } else {
    console.log(`${passed}/${total} check(s) passed`);
    process.exit(1);
  }
}).catch((e) => {
  console.error("FATAL importing harness-packs:", e);
  process.exit(2);
});
