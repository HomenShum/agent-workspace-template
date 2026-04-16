import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const startRun = internalMutation({
  args: {
    evalRunId: v.string(),
    dataset: v.string(),
    model: v.string(),
    limit: v.number(),
    status: v.string(),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("evalRuns", args);
    return { evalRunId: args.evalRunId };
  },
});

export const recordCase = internalMutation({
  args: {
    evalRunId: v.string(),
    caseId: v.string(),
    scenario: v.string(),
    query: v.string(),
    responsePreview: v.string(),
    refScore: v.number(),
    foundRefs: v.array(v.string()),
    missingRefs: v.array(v.string()),
    criteriaResultsJson: v.string(),
    judgeScoresJson: v.string(),
    sessionId: v.optional(v.string()),
    messageId: v.optional(v.id("messages")),
    answerPacketId: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("evalCases", args);
  },
});

export const completeRun = internalMutation({
  args: {
    evalRunId: v.string(),
    status: v.string(),
    completedAt: v.number(),
    summaryJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("evalRuns")
      .withIndex("by_evalRunId", (q) => q.eq("evalRunId", args.evalRunId))
      .first();

    if (!run) {
      throw new Error(`Eval run ${args.evalRunId} not found.`);
    }

    await ctx.db.patch(run._id, {
      status: args.status,
      completedAt: args.completedAt,
      summaryJson: args.summaryJson,
    });
  },
});

export const getRunDetails = internalQuery({
  args: {
    evalRunId: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("evalRuns")
      .withIndex("by_evalRunId", (q) => q.eq("evalRunId", args.evalRunId))
      .first();
    const cases = await ctx.db
      .query("evalCases")
      .withIndex("by_evalRunId", (q) => q.eq("evalRunId", args.evalRunId))
      .collect();

    return {
      run,
      cases: cases.sort((a: any, b: any) => a.caseId.localeCompare(b.caseId)),
    };
  },
});
