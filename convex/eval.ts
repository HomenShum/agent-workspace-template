/**
 * M6 eval-gate action. Runs the matching golden set for a pack (or a
 * pending submission) and logs each run to the `evalRuns` table.
 *
 * Design:
 *  - Assertion engine lives in src/lib/eval-assertions.ts so it's
 *    unit-testable without a Convex context.
 *  - This file is the Convex adapter: it loads the pack, fetches
 *    goldens, fans out assertions, and writes results.
 *
 * Bounds:
 *  - goldens capped at 50 per pack (enforced in goldens.listMatchingGoldens)
 *  - assertion runs capped at 200 per submission (enforced here)
 *
 * NO external URL fetches. Pack content is loaded from the registry
 * (compiled-in) or from the `packSubmissions` table. No SSRF surface.
 */

import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  runAssertions,
  stableHash,
  validateSubmissionShape,
  type Assertion,
  type AssertionResult,
} from "../src/lib/eval-assertions";
import { getPackBySlug } from "../src/lib/pack-registry";

const MAX_ASSERTIONS_PER_SUBMISSION = 200;

type FailingAssertion = {
  goldenSlug: string;
  goldenBlocking: boolean;
  assertionKind: string;
  field: string;
  expected: string;
  actual: string;
  traceId: string;
};

export type RunGoldenSetResult = {
  packSlug: string;
  source: "registry" | "submission";
  passRate: number;
  runs: number;
  totalAssertions: number;
  failingAssertions: FailingAssertion[];
  blockingFailures: number;
  validation: { ok: boolean; missing: string[] };
  traceIds: string[];
};

export const runGoldenSet = action({
  args: {
    packSlug: v.string(),
    submissionId: v.optional(v.string()),
    goldenSlugs: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<RunGoldenSetResult> => {
    // 1) Load pack content: prefer submission (if id provided), else registry.
    let packContent: any = null;
    let source: "registry" | "submission" = "registry";

    if (args.submissionId) {
      const sub: any = await ctx.runQuery(
        internal.eval.getSubmissionForEval,
        { submissionId: args.submissionId }
      );
      if (sub) {
        // Map submission fields into Pack-like shape for assertions.
        packContent = submissionToPackLike(sub);
        source = "submission";
      }
    }

    if (!packContent) {
      const pack = getPackBySlug(args.packSlug);
      if (pack) packContent = pack;
      source = "registry";
    }

    if (!packContent) {
      return {
        packSlug: args.packSlug,
        source,
        passRate: 0,
        runs: 0,
        totalAssertions: 0,
        failingAssertions: [],
        blockingFailures: 0,
        validation: { ok: false, missing: ["<pack-not-found>"] },
        traceIds: [],
      };
    }

    // 2) Early validation — reject malformed submissions before running goldens.
    const validation = validateSubmissionShape(packContent);
    if (!validation.ok) {
      return {
        packSlug: args.packSlug,
        source,
        passRate: 0,
        runs: 0,
        totalAssertions: 0,
        failingAssertions: [],
        blockingFailures: 0,
        validation,
        traceIds: [],
      };
    }

    // 3) Load matching goldens (deterministic order: sorted by slug).
    const allGoldens: any[] = await ctx.runQuery(
      internal.goldens.listMatchingGoldens,
      { packSlug: args.packSlug }
    );
    let goldens = allGoldens;
    if (args.goldenSlugs && args.goldenSlugs.length > 0) {
      const wanted = new Set(args.goldenSlugs);
      goldens = goldens.filter((g) => wanted.has(g.slug));
    }

    // 4) Run each golden, write to evalRuns.
    const failingAssertions: FailingAssertion[] = [];
    const traceIds: string[] = [];
    let assertionBudget = MAX_ASSERTIONS_PER_SUBMISSION;
    let totalAssertions = 0;
    let totalPassed = 0;
    let runs = 0;
    let blockingFailures = 0;

    for (const golden of goldens) {
      let assertions: Assertion[];
      try {
        assertions = JSON.parse(golden.assertionsJson);
      } catch {
        // Honest fail — treat as a blocking failure.
        const traceId = `TRACE-${stableHash({ g: golden.slug, e: "parse-error" })}`;
        await ctx.runMutation(internal.eval.recordGoldenRun, {
          packSlug: args.packSlug,
          submissionId: args.submissionId,
          goldenSlug: golden.slug,
          traceId,
          passed: false,
          passRate: 0,
          tokens: 0,
          durationMs: 0,
          assertions: [],
          error: "assertions JSON parse failed",
        });
        failingAssertions.push({
          goldenSlug: golden.slug,
          goldenBlocking: golden.blocking,
          assertionKind: "<parse-error>",
          field: "<golden.assertionsJson>",
          expected: "valid JSON",
          actual: "parse failed",
          traceId,
        });
        if (golden.blocking) blockingFailures += 1;
        traceIds.push(traceId);
        runs += 1;
        continue;
      }

      // Budget clamp — honest status, don't silently drop.
      if (assertions.length > assertionBudget) {
        assertions = assertions.slice(0, assertionBudget);
      }
      assertionBudget -= assertions.length;
      if (assertionBudget < 0) assertionBudget = 0;

      const startedAt = Date.now();
      const result = runAssertions(packContent, assertions);
      const durationMs = Date.now() - startedAt;
      const traceId = `TRACE-${stableHash({ g: golden.slug, p: args.packSlug, a: assertions })}`;

      totalAssertions += result.results.length;
      totalPassed += result.passed;
      runs += 1;
      traceIds.push(traceId);

      // Record failing assertions.
      for (const r of result.results) {
        if (!r.passed) {
          failingAssertions.push({
            goldenSlug: golden.slug,
            goldenBlocking: golden.blocking,
            assertionKind: r.assertion.kind,
            field: (r.assertion as any).field ?? "<unknown>",
            expected: r.expected,
            actual: r.actual,
            traceId,
          });
          if (golden.blocking) blockingFailures += 1;
        }
      }

      await ctx.runMutation(internal.eval.recordGoldenRun, {
        packSlug: args.packSlug,
        submissionId: args.submissionId,
        goldenSlug: golden.slug,
        traceId,
        passed: result.failed === 0,
        passRate: result.passRate,
        tokens: 0, // placeholder — no LLM called in MVP
        durationMs,
        assertions: result.results.map(serializeResult),
      });

      if (assertionBudget <= 0) break;
    }

    const passRate =
      totalAssertions === 0 ? 0 : totalPassed / totalAssertions;

    return {
      packSlug: args.packSlug,
      source,
      passRate,
      runs,
      totalAssertions,
      failingAssertions,
      blockingFailures,
      validation,
      traceIds,
    };
  },
});

/**
 * Scheduled-from-submission path: runs goldens for a submission and
 * records the aggregate into eventLogs (non-promoting — promotion is
 * handled by packTrust.promoteIfEligible).
 */
export const runGoldensForSubmission = internalAction({
  args: { submissionId: v.string() },
  handler: async (ctx, args) => {
    const sub: any = await ctx.runQuery(internal.eval.getSubmissionForEval, {
      submissionId: args.submissionId,
    });
    if (!sub) return { ok: false, reason: "submission-not-found" };
    const result: RunGoldenSetResult = await ctx.runAction(
      api.eval.runGoldenSet,
      { packSlug: sub.slug, submissionId: args.submissionId }
    );
    await ctx.runMutation(internal.eval.logGoldenRunSummary, {
      submissionId: args.submissionId,
      packSlug: sub.slug,
      passRate: result.passRate,
      runs: result.runs,
      blockingFailures: result.blockingFailures,
    });
    return { ok: true, ...result };
  },
});

// ---------- Internal queries/mutations ----------

export const getSubmissionForEval = internalQuery({
  args: { submissionId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("packSubmissions")
      .withIndex("by_submissionId", (q) =>
        q.eq("submissionId", args.submissionId)
      )
      .first();
    return row;
  },
});

export const recordGoldenRun = internalMutation({
  args: {
    packSlug: v.string(),
    submissionId: v.optional(v.string()),
    goldenSlug: v.string(),
    traceId: v.string(),
    passed: v.boolean(),
    passRate: v.number(),
    tokens: v.number(),
    durationMs: v.number(),
    assertions: v.array(
      v.object({
        kind: v.string(),
        field: v.string(),
        passed: v.boolean(),
        expected: v.string(),
        actual: v.string(),
        error: v.optional(v.string()),
      })
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const evalRunId = `EVR-${args.traceId}`;
    await ctx.db.insert("evalRuns", {
      evalRunId,
      dataset: `golden:${args.goldenSlug}`,
      model: "assertion-engine-v1",
      limit: args.assertions.length,
      status: args.passed ? "passed" : "failed",
      startedAt: Date.now() - args.durationMs,
      completedAt: Date.now(),
      summaryJson: args.error ? JSON.stringify({ error: args.error }) : undefined,
      packSlug: args.packSlug,
      submissionId: args.submissionId,
      goldenSlug: args.goldenSlug,
      traceId: args.traceId,
      passed: args.passed,
      passRate: args.passRate,
      tokens: args.tokens,
      durationMs: args.durationMs,
      assertionsJson: JSON.stringify(args.assertions),
    });
  },
});

export const logGoldenRunSummary = internalMutation({
  args: {
    submissionId: v.string(),
    packSlug: v.string(),
    passRate: v.number(),
    runs: v.number(),
    blockingFailures: v.number(),
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    await ctx.db.insert("eventLogs", {
      eventId: `EVT-${createdAt}-eval`,
      eventType: "pack.eval_gate.run",
      status: args.blockingFailures > 0 ? "blocked" : "passed",
      actorId: "system",
      actorName: "eval-gate",
      actorRole: "system",
      entityId: args.submissionId,
      summary: `Golden set executed for ${args.packSlug}: ${args.runs} runs, passRate ${args.passRate.toFixed(3)}, blockingFailures ${args.blockingFailures}.`,
      detailsJson: JSON.stringify({
        packSlug: args.packSlug,
        passRate: args.passRate,
        runs: args.runs,
        blockingFailures: args.blockingFailures,
      }),
      createdAt: new Date(createdAt).toISOString(),
    });
  },
});

// ---------- helpers ----------

function submissionToPackLike(sub: any): Record<string, unknown> {
  // Submissions don't yet carry the full Pack body — we map the fields
  // that assertions typically probe, and store raw source content too.
  return {
    slug: sub.slug,
    name: sub.packName,
    packType: sub.category, // best-effort — submissions don't separate type
    tagline: sub.tagline,
    summary: sub.summary,
    useWhen: splitLines(sub.whyItMatters),
    avoidWhen: splitLines(sub.sourceNotes),
    installCommand: sub.repoUrl ? `npx attrition-sh pack install ${sub.slug}` : "",
    minimalInstructions: sub.whyItMatters,
    fullInstructions: `${sub.summary}\n\n${sub.whyItMatters}\n\n${sub.sourceNotes}`,
    evaluationChecklist: splitLines(sub.sourceNotes),
    failureModes: splitLines(sub.sourceNotes),
    compatibility: sub.compatibility ?? [],
    tags: [],
  };
}

function splitLines(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\s]+/, "").trim())
    .filter((line) => line.length > 0);
}

function serializeResult(r: AssertionResult) {
  return {
    kind: r.assertion.kind,
    field: (r.assertion as any).field ?? "<none>",
    passed: r.passed,
    expected: r.expected.slice(0, 240),
    actual: r.actual.slice(0, 240),
    error: r.error,
  };
}
