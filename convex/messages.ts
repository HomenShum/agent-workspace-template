import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireWorkspaceAccess } from "./access";

export const send = mutation({
  args: {
    role: v.string(),
    content: v.string(),
    senderName: v.optional(v.string()),
    status: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    sessionId: v.string(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    references: v.optional(v.array(v.string())),
    sourceUrls: v.optional(v.array(v.string())),
    fileIds: v.optional(v.array(v.string())),
    metadataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", args);
  },
});

export const createDraftAssistant = mutation({
  args: {
    sessionId: v.string(),
    workspaceId: v.optional(v.string()),
    createdAt: v.number(),
    metadataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      role: "assistant",
      content: "",
      status: "streaming",
      sessionId: args.sessionId,
      workspaceId: args.workspaceId,
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
      metadataJson: args.metadataJson,
    });
  },
});

export const updateAssistantDraft = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.optional(v.string()),
    appendText: v.optional(v.string()),
    status: v.optional(v.string()),
    updatedAt: v.number(),
    references: v.optional(v.array(v.string())),
    sourceUrls: v.optional(v.array(v.string())),
    fileIds: v.optional(v.array(v.string())),
    metadataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.messageId);
    if (!existing) {
      throw new Error("Message not found.");
    }

    const nextContent =
      args.appendText !== undefined
        ? `${existing.content || ""}${args.appendText}`
        : args.content !== undefined
          ? args.content
          : existing.content;

    await ctx.db.patch(args.messageId, {
      content: nextContent,
      status: args.status ?? existing.status,
      updatedAt: args.updatedAt,
      references: args.references ?? existing.references,
      sourceUrls: args.sourceUrls ?? existing.sourceUrls,
      fileIds: args.fileIds ?? existing.fileIds,
      metadataJson: args.metadataJson ?? existing.metadataJson,
    });
  },
});

export const appendEvent = mutation({
  args: {
    messageId: v.id("messages"),
    sessionId: v.string(),
    workspaceId: v.optional(v.string()),
    eventType: v.string(),
    sequence: v.number(),
    summary: v.string(),
    payloadJson: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messageEvents", args);
  },
});

export const getBySession = query({
  args: {
    operatorId: v.string(),
    sessionId: v.string(),
    workspaceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.workspaceId) {
      await requireWorkspaceAccess(ctx, args.operatorId, args.workspaceId);
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const getEventsBySession = query({
  args: {
    operatorId: v.string(),
    sessionId: v.string(),
    workspaceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.workspaceId) {
      await requireWorkspaceAccess(ctx, args.operatorId, args.workspaceId);
    }

    return await ctx.db
      .query("messageEvents")
      .withIndex("by_session_and_sequence", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});
