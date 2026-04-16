import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireOperator, requireWorkspaceAccess } from "./access";

async function nextEventId(ctx: any) {
  const rows = await ctx.db.query("eventLogs").collect();
  const nextNumber =
    rows
      .map((row: any) => Number(String(row.eventId).replace("EVT-", "")))
      .filter((value: number) => !Number.isNaN(value))
      .reduce((max: number, value: number) => Math.max(max, value), 0) + 1;
  return `EVT-${String(nextNumber).padStart(4, "0")}`;
}

export const record = internalMutation({
  args: {
    actorId: v.string(),
    eventType: v.string(),
    status: v.string(),
    summary: v.string(),
    workspaceId: v.optional(v.string()),
    entityId: v.optional(v.string()),
    detailsJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const operator = await requireOperator(ctx, args.actorId);
    const eventId = await nextEventId(ctx);
    await ctx.db.insert("eventLogs", {
      eventId,
      eventType: args.eventType,
      status: args.status,
      actorId: operator.operatorId,
      actorName: operator.name,
      actorRole: operator.role,
      workspaceId: args.workspaceId,
      entityId: args.entityId,
      summary: args.summary,
      detailsJson: args.detailsJson,
      createdAt: new Date().toISOString(),
    });
    return { eventId };
  },
});

export const listRecent = query({
  args: {
    operatorId: v.string(),
    workspaceId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.workspaceId) {
      await requireWorkspaceAccess(ctx, args.operatorId, args.workspaceId);
    }
    const rows = await ctx.db.query("eventLogs").collect();
    return rows
      .filter((row: any) => {
        if (args.workspaceId) return row.workspaceId === args.workspaceId;
        return row.actorId === args.operatorId;
      })
      .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, args.limit ?? 12);
  },
});
