/**
 * Scenario verification for seed packs (M5).
 *
 * This suite treats each pack as a published artifact in the catalog
 * and verifies the contract a downstream consumer would rely on:
 *
 *   1. Identity: slug is kebab-case and matches the filename convention.
 *   2. Install surface: installCommand references the pack's own slug.
 *   3. Docs contract: rawMarkdownPath follows /packs/{slug}/raw.
 *   4. Content completeness: required prose fields are non-empty.
 *   5. Required array cardinalities per the M5 spec (≥3 for useWhen /
 *      avoidWhen / keyOutcomes / tags, ≥5 for evaluationChecklist, ≥3
 *      for failureModes, ≥3 for sources, ≥2 for examples, ≥2 for metrics,
 *      ≥1 for comparesWith and changelog and relatedPacks).
 *   6. Source URL validity: every sources[].url parses as a URL.
 *   7. Security review: injectionSurface is one of the enum values.
 *   8. Verified-tier richness: the one Verified pack has telemetry +
 *      transferMatrix populated (evaluator-optimizer contract).
 *
 * Design note: this file is written against the vitest API (describe /
 * it / expect). vitest is not yet configured at the repo root, so we
 * use a local type-only shim (./vitest-shim) so tsc --noEmit passes.
 * When vitest is added to package.json, change the import below to
 *   import { describe, it, expect } from "vitest";
 * and delete vitest-shim.ts. No test-body changes are required.
 */

import { describe, it, expect } from "./vitest-shim";
import type { Pack } from "@/lib/pack-schema";
import { allSeededPacks } from "./index";

const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Real user scenario we simulate here:
 *   "I'm browsing the catalog. For every pack card I click into,
 *    does the install command, raw-markdown route, and compare/metric
 *    surface hold up, or does something come back blank?"
 */
describe("seed packs (M5) — catalog surface integrity", () => {
  it("exports exactly 8 seed packs", () => {
    expect(allSeededPacks).toHaveLength(8);
  });

  it("has unique slugs across the set", () => {
    const slugs = allSeededPacks.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  for (const pack of allSeededPacks) {
    describe(`pack: ${pack.slug}`, () => {
      // 1. Identity
      it("slug matches kebab-case pattern", () => {
        expect(pack.slug).toMatch(SLUG_RE);
      });

      // 2. Install command references own slug
      it("installCommand includes the pack slug", () => {
        expect(pack.installCommand).toContain(pack.slug);
        expect(pack.installCommand.startsWith("npx ")).toBe(true);
      });

      // 3. Raw markdown path follows convention
      it("rawMarkdownPath === /packs/<slug>/raw", () => {
        expect(pack.rawMarkdownPath).toBe(`/packs/${pack.slug}/raw`);
      });

      // 4. Required prose fields non-empty
      it("has non-empty name, tagline, summary, claudeCodeSnippet", () => {
        expect(pack.name.trim().length).toBeGreaterThan(0);
        expect(pack.tagline.trim().length).toBeGreaterThan(0);
        expect(pack.summary.trim().length).toBeGreaterThan(0);
        expect(pack.claudeCodeSnippet.trim().length).toBeGreaterThan(0);
      });

      it("has non-empty minimal and full instructions", () => {
        expect(pack.minimalInstructions.trim().length).toBeGreaterThan(0);
        expect(pack.fullInstructions.trim().length).toBeGreaterThan(500);
      });

      // 5. Array cardinalities per spec
      it("useWhen / avoidWhen / keyOutcomes each have ≥3 entries", () => {
        expect(pack.useWhen.length).toBeGreaterThanOrEqual(3);
        expect(pack.avoidWhen.length).toBeGreaterThanOrEqual(3);
        expect(pack.keyOutcomes.length).toBeGreaterThanOrEqual(3);
      });

      it("tags has ≥3 entries", () => {
        expect(pack.tags.length).toBeGreaterThanOrEqual(3);
      });

      it("evaluationChecklist has ≥5 entries", () => {
        expect(pack.evaluationChecklist.length).toBeGreaterThanOrEqual(5);
      });

      it("failureModes has ≥3 entries", () => {
        expect(pack.failureModes.length).toBeGreaterThanOrEqual(3);
      });

      it("each failureMode has structured symptom/trigger/preventionCheck/tier", () => {
        const validTiers = new Set(["jr", "mid", "sr", "staff"]);
        for (const fm of pack.failureModes) {
          expect(typeof fm.symptom).toBe("string");
          expect(fm.symptom.length).toBeGreaterThan(0);
          expect(typeof fm.trigger).toBe("string");
          expect(fm.trigger.length).toBeGreaterThan(0);
          expect(typeof fm.preventionCheck).toBe("string");
          expect(fm.preventionCheck.length).toBeGreaterThan(0);
          expect(validTiers.has(fm.tier)).toBe(true);
        }
      });

      it("sources has ≥3 entries", () => {
        expect(pack.sources.length).toBeGreaterThanOrEqual(3);
      });

      it("examples has ≥2 entries", () => {
        expect(pack.examples.length).toBeGreaterThanOrEqual(2);
      });

      it("metrics has ≥2 entries", () => {
        expect(pack.metrics.length).toBeGreaterThanOrEqual(2);
      });

      it("comparesWith has ≥1 entry", () => {
        expect(pack.comparesWith.length).toBeGreaterThanOrEqual(1);
      });

      it("relatedPacks has ≥1 entry", () => {
        expect(pack.relatedPacks.length).toBeGreaterThanOrEqual(1);
      });

      it("changelog has ≥1 entry including 0.1.0", () => {
        expect(pack.changelog.length).toBeGreaterThanOrEqual(1);
        expect(pack.changelog.some((c) => c.version === "0.1.0")).toBe(true);
      });

      // 6. Source URL validity (sad path: hallucinated or malformed URL)
      it("every sources[].url parses as a valid URL", () => {
        for (const source of pack.sources) {
          expect(() => new URL(source.url)).not.toThrow();
          expect(source.label.trim().length).toBeGreaterThan(0);
          expect(source.note.trim().length).toBeGreaterThan(0);
        }
      });

      it("every sources[].url uses https", () => {
        for (const source of pack.sources) {
          expect(source.url.startsWith("https://")).toBe(true);
        }
      });

      // 7. Security review populated
      it("securityReview has a valid injectionSurface", () => {
        expect(pack.securityReview).toBeDefined();
        const surface = (pack.securityReview as NonNullable<Pack["securityReview"]>).injectionSurface;
        expect(["low", "medium", "high"].includes(surface)).toBe(true);
        expect(
          (pack.securityReview as NonNullable<Pack["securityReview"]>).lastScanned
        ).toMatch(/^2026-04-(16|17)$/);
      });

      // Misc scalar fields
      it("version is 0.1.0 and updatedAt is 2026-04-16 or 2026-04-17", () => {
        expect(pack.version).toBe("0.1.0");
        expect(pack.updatedAt).toMatch(/^2026-04-(16|17)$/);
      });

      it("publisher is Agent Workspace", () => {
        expect(pack.publisher).toBe("Agent Workspace");
      });

      it("compatibility has ≥1 entry", () => {
        expect(pack.compatibility.length).toBeGreaterThanOrEqual(1);
      });
    });
  }

  // 8. Verified-tier richness
  describe("Verified-tier pack: golden-eval-harness", () => {
    const verified = allSeededPacks.filter((p) => p.trust === "Verified");

    it("has exactly one Verified pack in the seed set", () => {
      expect(verified).toHaveLength(1);
      expect(verified[0].slug).toBe("golden-eval-harness");
    });

    it("has telemetry populated with plausible numbers", () => {
      const p = verified[0];
      expect(p.telemetry).toBeDefined();
      const t = p.telemetry as NonNullable<Pack["telemetry"]>;
      expect(t.lastNRuns).toBeGreaterThan(0);
      expect(t.passRate).toBeGreaterThan(0);
      expect(t.passRate).toBeLessThanOrEqual(1);
      expect(t.avgTokens).toBeGreaterThan(0);
    });

    it("has a three-row transferMatrix across model tiers", () => {
      const p = verified[0];
      expect(p.transferMatrix).toBeDefined();
      const matrix = p.transferMatrix as NonNullable<Pack["transferMatrix"]>;
      expect(matrix.length).toBeGreaterThanOrEqual(3);
      for (const row of matrix) {
        expect(row.passRate).toBeGreaterThan(0);
        expect(row.passRate).toBeLessThanOrEqual(1);
        expect(row.tokens).toBeGreaterThan(0);
        expect(row.runs).toBeGreaterThan(0);
      }
    });

    it("has a contract with required outputs and completion conditions", () => {
      const p = verified[0];
      expect(p.contract).toBeDefined();
      const c = p.contract as NonNullable<Pack["contract"]>;
      expect(c.requiredOutputs.length).toBeGreaterThan(0);
      expect(c.completionConditions.length).toBeGreaterThan(0);
      expect(c.tokenBudget).toBeGreaterThan(0);
    });

    it("has layered runtimeCharter / nlh / toolSpec", () => {
      const p = verified[0];
      expect(p.layers).toBeDefined();
      const l = p.layers as NonNullable<Pack["layers"]>;
      expect(l.runtimeCharter.length).toBeGreaterThan(0);
      expect(l.nlh.length).toBeGreaterThan(0);
      expect(l.toolSpec.length).toBeGreaterThanOrEqual(1);
    });
  });

  // Spec-level coverage — we shipped UI, RAG, Eval, Reference types.
  describe("packType distribution covers breadth claim", () => {
    it("includes at least one UI, RAG, Eval, and Reference pack", () => {
      const types = new Set(allSeededPacks.map((p) => p.packType));
      expect(types.has("ui")).toBe(true);
      expect(types.has("rag")).toBe(true);
      expect(types.has("eval")).toBe(true);
      expect(types.has("reference")).toBe(true);
    });
  });
});
