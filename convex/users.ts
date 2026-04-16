import { query } from "./_generated/server";
import { v } from "convex/values";

export const listAvailable = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const getById = query({
  args: { operatorId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .first();
  },
});
