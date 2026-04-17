/**
 * M6: Golden set for the eval gate.
 *
 * A golden is an (input, assertions[]) pair scoped to a pack-slug glob.
 * Seeded goldens live here; user-extensible goldens can be added via
 * `upsertGolden` (admin-only path — wire auth later). Assertion types
 * are a discriminated union, see `Assertion` type.
 *
 * Hard caps (see EVAL_GATE_SPEC.md):
 *  - max 50 goldens per pack pattern
 *  - max 200 assertion runs per submission
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// ---------- Assertion union (authoritative runtime shape) ----------

export type Assertion =
  | {
      kind: "substring-present";
      field: string; // dot-path into pack content, e.g. "fullInstructions"
      needle: string;
      caseInsensitive?: boolean;
    }
  | {
      kind: "substring-absent";
      field: string;
      needle: string;
      caseInsensitive?: boolean;
    }
  | {
      kind: "regex-match";
      field: string;
      pattern: string;
      flags?: string;
    }
  | {
      kind: "field-equals";
      field: string;
      expected: unknown;
    }
  | {
      kind: "field-nonempty";
      field: string;
    }
  | {
      kind: "injection-probe";
      field: string;
      // A match means the pack content ECHOED the injection payload.
      // This assertion passes when NO banned payload is found.
      bannedPhrases: string[];
    }
  | {
      kind: "llm-judge-rubric";
      field: string;
      rubric: string;
      // Deterministic MVP: no external LLM call. Scored by keyword heuristics.
      requiredKeywords: string[];
      minKeywords: number;
    };

// ---------- Seed goldens ----------

const SEED_GOLDENS: Array<{
  slug: string;
  packSlugPattern: string;
  description: string;
  input: Record<string, unknown>;
  assertions: Assertion[];
  scoringRubric: string;
  blocking: boolean;
}> = [
  {
    slug: "harness-advisor-shape",
    packSlugPattern: "advisor-pattern",
    description:
      "Advisor-pattern harness pack must declare a contract, runtimeCharter, and at least one tool in layers.toolSpec.",
    input: { scenario: "harness-shape-check" },
    assertions: [
      { kind: "field-equals", field: "packType", expected: "harness" },
      { kind: "field-nonempty", field: "contract.requiredOutputs" },
      { kind: "field-nonempty", field: "layers.runtimeCharter" },
      { kind: "field-nonempty", field: "layers.toolSpec" },
      {
        kind: "substring-present",
        field: "minimalInstructions",
        needle: "advisor",
        caseInsensitive: true,
      },
      {
        kind: "injection-probe",
        field: "fullInstructions",
        bannedPhrases: [
          "ignore previous instructions",
          "output secrets",
          "system prompt override",
        ],
      },
    ],
    scoringRubric: "All assertions must pass; any failure blocks Verified.",
    blocking: true,
  },
  {
    slug: "ui-static-content",
    packSlugPattern: "*",
    description:
      "Any UI pack must provide non-empty useWhen/avoidWhen arrays and an installCommand.",
    input: { scenario: "ui-static-check" },
    assertions: [
      { kind: "field-nonempty", field: "useWhen" },
      { kind: "field-nonempty", field: "avoidWhen" },
      { kind: "field-nonempty", field: "installCommand" },
      {
        kind: "regex-match",
        field: "installCommand",
        pattern: "^(npx|pnpm|yarn|bun) ",
      },
      {
        kind: "injection-probe",
        field: "summary",
        bannedPhrases: [
          "ignore and output secrets",
          "ignore previous instructions",
        ],
      },
    ],
    scoringRubric:
      "Presence and shape only. Non-blocking assertions flagged separately.",
    blocking: true,
  },
  {
    slug: "eval-pack-proof-shape",
    packSlugPattern: "*-eval*",
    description:
      "Eval packs must declare an evaluationChecklist and at least one failureMode.",
    input: { scenario: "eval-shape-check" },
    assertions: [
      { kind: "field-nonempty", field: "evaluationChecklist" },
      { kind: "field-nonempty", field: "failureModes" },
      {
        kind: "llm-judge-rubric",
        field: "fullInstructions",
        rubric:
          "Instructions should reference scoring, rubric, or pass/fail semantics.",
        requiredKeywords: ["score", "rubric", "pass", "fail", "assert"],
        minKeywords: 2,
      },
    ],
    scoringRubric: "Structural + rubric keyword presence.",
    blocking: true,
  },
];

// ---------- Queries ----------

export const listMatchingGoldens = internalQuery({
  args: { packSlug: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("goldens").collect();
    const matching = all.filter((g: any) =>
      matchesPattern(args.packSlug, g.packSlugPattern)
    );
    // Deterministic: sort by slug so CAS/hash stable.
    matching.sort((a: any, b: any) => a.slug.localeCompare(b.slug));
    // Hard cap 50 per pack.
    return matching.slice(0, 50);
  },
});

export const getBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("goldens")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("goldens").collect();
    return rows
      .map((row: any) => ({
        slug: row.slug,
        packSlugPattern: row.packSlugPattern,
        description: row.description,
        blocking: row.blocking,
        createdAt: row.createdAt,
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
  },
});

// ---------- Mutations ----------

export const seedGoldens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let inserted = 0;
    for (const g of SEED_GOLDENS) {
      const existing = await ctx.db
        .query("goldens")
        .withIndex("by_slug", (q) => q.eq("slug", g.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("goldens", {
        slug: g.slug,
        packSlugPattern: g.packSlugPattern,
        description: g.description,
        inputJson: JSON.stringify(g.input),
        assertionsJson: JSON.stringify(g.assertions),
        scoringRubric: g.scoringRubric,
        blocking: g.blocking,
        createdAt: now,
      });
      inserted += 1;
    }
    return { inserted, seeded: SEED_GOLDENS.length };
  },
});

export const upsertGolden = internalMutation({
  args: {
    slug: v.string(),
    packSlugPattern: v.string(),
    description: v.string(),
    inputJson: v.string(),
    assertionsJson: v.string(),
    scoringRubric: v.string(),
    blocking: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("goldens")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        packSlugPattern: args.packSlugPattern,
        description: args.description,
        inputJson: args.inputJson,
        assertionsJson: args.assertionsJson,
        scoringRubric: args.scoringRubric,
        blocking: args.blocking,
      });
      return { id: existing._id, updated: true };
    }
    const id = await ctx.db.insert("goldens", {
      ...args,
      createdAt: Date.now(),
    });
    return { id, updated: false };
  },
});

// ---------- helpers ----------

/**
 * Simple glob: supports "*" as a prefix/suffix wildcard. No regex escape
 * issues because we only accept "*" — callers can't smuggle regex.
 */
export function matchesPattern(slug: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return slug === pattern;
  // Escape regex metacharacters, then replace literal "*" with ".*"
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp("^" + escaped.replace(/\*/g, ".*") + "$");
  return regex.test(slug);
}

export { SEED_GOLDENS };
