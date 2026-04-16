import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOperator } from "./access";

async function nextSubmissionId(ctx: any) {
  const rows = await ctx.db.query("packSubmissions").collect();
  const nextNumber =
    rows
      .map((row: any) => Number(String(row.submissionId).replace("SUB-", "")))
      .filter((value: number) => !Number.isNaN(value))
      .reduce((max: number, value: number) => Math.max(max, value), 0) + 1;
  return `SUB-${String(nextNumber).padStart(4, "0")}`;
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("packSubmissions").collect();
    return rows
      .sort((left: any, right: any) => right.createdAt - left.createdAt)
      .slice(0, args.limit ?? 12);
  },
});

export const submitPack = mutation({
  args: {
    operatorId: v.string(),
    packName: v.string(),
    tagline: v.string(),
    summary: v.string(),
    category: v.string(),
    compatibility: v.array(v.string()),
    repoUrl: v.optional(v.string()),
    docsUrl: v.optional(v.string()),
    whyItMatters: v.string(),
    sourceNotes: v.string(),
  },
  handler: async (ctx, args) => {
    const operator = await requireOperator(ctx, args.operatorId);
    const submissionId = await nextSubmissionId(ctx);
    const createdAt = Date.now();
    const slug = normalizeSlug(args.packName);

    await ctx.db.insert("packSubmissions", {
      submissionId,
      operatorId: operator.operatorId,
      submitterName: operator.name,
      submitterEmail: operator.email,
      packName: args.packName.trim(),
      slug,
      tagline: args.tagline.trim(),
      summary: args.summary.trim(),
      category: args.category.trim(),
      compatibility: args.compatibility,
      repoUrl: args.repoUrl?.trim() || undefined,
      docsUrl: args.docsUrl?.trim() || undefined,
      whyItMatters: args.whyItMatters.trim(),
      sourceNotes: args.sourceNotes.trim(),
      status: "pending_review",
      createdAt,
      updatedAt: createdAt,
    });

    const eventId = `EVT-${createdAt}`;
    await ctx.db.insert("eventLogs", {
      eventId,
      eventType: "pack.submitted",
      status: "pending_review",
      actorId: operator.operatorId,
      actorName: operator.name,
      actorRole: operator.role,
      workspaceId: undefined,
      entityId: submissionId,
      summary: `Submitted harness pack ${args.packName.trim()} for review.`,
      detailsJson: JSON.stringify({
        submissionId,
        slug,
        category: args.category.trim(),
        compatibility: args.compatibility,
      }),
      createdAt: new Date(createdAt).toISOString(),
    });

    return { submissionId, slug };
  },
});
