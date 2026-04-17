/**
 * E4 — consumers reverse index.
 *
 * Records which projects have installed which packs and at what version/target.
 * Populated from aggregated CLI lockfiles (over time, via `recordConsumer`);
 * read by the pack detail page to render "Used in N projects: …".
 *
 * Contract:
 *  - recordConsumer({slug, projectId, project, version, target}) upserts one
 *    row per (slug, projectId). Re-recording updates version/target/installedAt.
 *  - listConsumersForPack({slug}) returns ConsumerProject[] for one pack.
 *  - listPacksForProject({projectId}) returns the slug list a project installed.
 *
 * Hygiene: slug/projectId/target validated. All write paths fail loudly on
 * bad input (honest-status rule) — no silent 2xx. Capped at BATCH_MAX to
 * bound read cost.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const SLUG_MAX_LEN = 100;
const PROJECT_ID_PATTERN = /^[a-z0-9-]+$/;
const PROJECT_ID_MAX_LEN = 100;
const PROJECT_LABEL_MAX = 120;
const VERSION_MAX = 40;
const TARGETS = new Set(["claude-code", "cursor"]);

const BATCH_MAX = 500;

function validSlug(slug: string): boolean {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= SLUG_MAX_LEN &&
    SLUG_PATTERN.test(slug)
  );
}

function validProjectId(id: string): boolean {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= PROJECT_ID_MAX_LEN &&
    PROJECT_ID_PATTERN.test(id)
  );
}

function validTarget(t: string): t is "claude-code" | "cursor" {
  return TARGETS.has(t);
}

export const recordConsumer = mutation({
  args: {
    slug: v.string(),
    projectId: v.string(),
    project: v.string(),
    version: v.string(),
    target: v.string(),
  },
  handler: async (ctx, { slug, projectId, project, version, target }) => {
    if (!validSlug(slug)) throw new Error(`invalid slug: ${slug}`);
    if (!validProjectId(projectId)) throw new Error(`invalid projectId: ${projectId}`);
    if (!validTarget(target)) throw new Error(`invalid target: ${target}`);

    const safeLabel = String(project).slice(0, PROJECT_LABEL_MAX);
    const safeVersion = String(version).slice(0, VERSION_MAX);
    const now = Date.now();

    const existing = await ctx.db
      .query("packConsumers")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .filter((q) => q.eq(q.field("projectId"), projectId))
      .unique();

    if (!existing) {
      await ctx.db.insert("packConsumers", {
        slug,
        projectId,
        project: safeLabel,
        version: safeVersion,
        target,
        installedAt: now,
      });
      return { slug, projectId, upserted: "insert" as const };
    }

    await ctx.db.patch(existing._id, {
      project: safeLabel,
      version: safeVersion,
      target,
      installedAt: now,
    });
    return { slug, projectId, upserted: "update" as const };
  },
});

export const listConsumersForPack = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    if (!validSlug(slug)) return [];
    const rows = await ctx.db
      .query("packConsumers")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .take(BATCH_MAX);
    return rows.map((r) => ({
      projectId: r.projectId,
      project: r.project,
      version: r.version,
      installedAt: new Date(r.installedAt).toISOString(),
      target: r.target as "claude-code" | "cursor",
    }));
  },
});

export const listPacksForProject = query({
  args: { projectId: v.string() },
  handler: async (ctx, { projectId }) => {
    if (!validProjectId(projectId)) return [];
    const rows = await ctx.db
      .query("packConsumers")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(BATCH_MAX);
    return rows.map((r) => r.slug);
  },
});
