import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceAccess } from "./access";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("workspaces").collect();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getById = query({
  args: { workspaceId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
  },
});

export const getByIdForOperator = query({
  args: {
    operatorId: v.string(),
    workspaceId: v.string(),
  },
  handler: async (ctx, args) => {
    const { workspace } = await requireWorkspaceAccess(ctx, args.operatorId, args.workspaceId);
    return workspace;
  },
});
