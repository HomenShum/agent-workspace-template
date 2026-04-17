/**
 * D1 / J: install counter mutations and batch query.
 *
 * Mirror of src/lib/install-counts.ts but backed by Convex. Either surface
 * may front the UI; the file-backed counter is for CLI/local dev, and the
 * Convex counter is for the hosted marketplace.
 *
 * Contract:
 *  - recordInstall({slug, source}) increments the per-slug counter row,
 *    creating it on first touch. Bounded at PER_SLUG_CAP = 1_000_000.
 *  - getInstallCountsBatch({slugs}) returns Record<slug, number>, with 0
 *    for slugs that have never been installed. Accepts up to 200 slugs in
 *    a single query to bound read cost.
 *
 * Slug hygiene: rejects anything outside `^[a-z0-9-]+$` / >100 chars.
 * Source hygiene: free-form label ("cli", "web", etc.), trimmed and capped
 * at 64 chars. Not persisted per-event in this table — this is a counter,
 * not a log. (A separate events table can be added later if we need
 * unaggregated attribution.)
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Must match src/lib/install-counts.ts — documented cap.
const PER_SLUG_CAP = 1_000_000;
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const SLUG_MAX_LEN = 100;
const BATCH_MAX_SLUGS = 200;

function validSlug(slug: string): boolean {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= SLUG_MAX_LEN &&
    SLUG_PATTERN.test(slug)
  );
}

export const recordInstall = mutation({
  args: {
    slug: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, { slug, source: _source }) => {
    if (!validSlug(slug)) {
      // Honest status — refuse the write, don't pretend success.
      throw new Error(`invalid slug: ${slug}`);
    }

    const existing = await ctx.db
      .query("installCounts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    const now = Date.now();

    if (!existing) {
      await ctx.db.insert("installCounts", {
        slug,
        count: 1,
        updatedAt: now,
      });
      return { slug, count: 1, capped: false };
    }

    if (existing.count >= PER_SLUG_CAP) {
      // Honest: do not lie about incrementing. Return current value + capped flag.
      return { slug, count: PER_SLUG_CAP, capped: true };
    }

    const next = existing.count + 1;
    await ctx.db.patch(existing._id, { count: next, updatedAt: now });
    return { slug, count: next, capped: false };
  },
});

export const getInstallCountsBatch = query({
  args: { slugs: v.array(v.string()) },
  handler: async (ctx, { slugs }) => {
    if (slugs.length > BATCH_MAX_SLUGS) {
      throw new Error(`too many slugs: ${slugs.length} > ${BATCH_MAX_SLUGS}`);
    }
    const result: Record<string, number> = {};
    // De-dupe up front so callers don't amplify reads by sending duplicates.
    const unique = Array.from(new Set(slugs)).filter(validSlug);
    for (const slug of unique) {
      const row = await ctx.db
        .query("installCounts")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      result[slug] = row ? Math.min(row.count, PER_SLUG_CAP) : 0;
    }
    // Slugs that failed validation or were duplicates still get a 0 entry
    // so the caller can key into the returned map safely.
    for (const slug of slugs) {
      if (!(slug in result)) result[slug] = 0;
    }
    return result;
  },
});

export const getInstallCount = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    if (!validSlug(slug)) return 0;
    const row = await ctx.db
      .query("installCounts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    return row ? Math.min(row.count, PER_SLUG_CAP) : 0;
  },
});
