import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireWorkspaceAccess } from "./access";

export const create = internalMutation({
  args: {
    answerPacketId: v.string(),
    messageId: v.optional(v.id("messages")),
    sessionId: v.string(),
    operatorId: v.string(),
    workspaceId: v.optional(v.string()),
    query: v.string(),
    answer: v.string(),
    references: v.array(v.string()),
    sourceUrls: v.array(v.string()),
    qualityStatus: v.string(),
    qualitySummary: v.optional(v.string()),
    qualityChecksJson: v.string(),
    briefJson: v.optional(v.string()),
    traceJson: v.optional(v.string()),
    model: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("answerPackets", args);
    return { answerPacketId: args.answerPacketId };
  },
});

export const getLatestBySession = query({
  args: {
    operatorId: v.string(),
    sessionId: v.string(),
    workspaceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.workspaceId) {
      await requireWorkspaceAccess(ctx, args.operatorId, args.workspaceId);
    }

    const packets = await ctx.db
      .query("answerPackets")
      .withIndex("by_session_and_createdAt", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return packets.sort((a: any, b: any) => b.createdAt - a.createdAt)[0] ?? null;
  },
});
