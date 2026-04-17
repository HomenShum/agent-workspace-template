/**
 * Fork-to-workspace: Convex mutations + queries for per-operator editable
 * copies of catalog packs.
 *
 * Keyed by (operatorSessionId, slug). One row per fork.
 *
 * Contract:
 *   createOrReplaceFork({operatorSessionId, slug, markdown, sourceVersion})
 *     — idempotent upsert. Refuses oversized markdown (>100kB) with
 *       FORK_TOO_LARGE. Refuses invalid slug / session id.
 *   deleteFork({operatorSessionId, slug}) — no-op if missing. Never throws
 *       on miss (returns {deleted: false}).
 *   getFork({operatorSessionId, slug}) — returns row or null.
 *   listForksForSession({operatorSessionId}) — returns array, capped at
 *       PER_SESSION_FORK_CAP.
 *
 * Honest status: every rejection throws a typed Error. No silent truncation.
 * Caller is responsible for surfacing the error to the user.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Hard caps. These mirror src/lib/fork-storage.ts — any change must be paired.
const MAX_MARKDOWN_BYTES = 100 * 1024; // 100kB
const PER_SESSION_FORK_CAP = 200;
const SLUG_PATTERN = /^[a-z0-9-]+$/;
const SLUG_MAX_LEN = 100;
const SESSION_ID_MAX_LEN = 200;

function isValidSlug(slug: string): boolean {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= SLUG_MAX_LEN &&
    SLUG_PATTERN.test(slug)
  );
}

function isValidSessionId(id: string): boolean {
  // Non-empty, bounded, printable. Reject anything with path separators or
  // null bytes so this can safely key a filesystem directory in the fallback.
  if (typeof id !== "string") return false;
  if (id.length === 0 || id.length > SESSION_ID_MAX_LEN) return false;
  if (id.includes("/") || id.includes("\\") || id.includes("\0")) return false;
  if (id === "." || id === "..") return false;
  // Only word chars, dashes, underscores, colons, and dots mid-string. Keeps
  // it broad enough to accept existing operatorIds but tight enough to reject
  // traversal probes.
  return /^[a-zA-Z0-9_\-:.]+$/.test(id);
}

function byteLength(s: string): number {
  // Markdown is stored as UTF-8; use TextEncoder to measure honestly.
  return new TextEncoder().encode(s).length;
}

export const createOrReplaceFork = mutation({
  args: {
    operatorSessionId: v.string(),
    slug: v.string(),
    markdown: v.string(),
    sourceVersion: v.string(),
  },
  handler: async (ctx, { operatorSessionId, slug, markdown, sourceVersion }) => {
    if (!isValidSessionId(operatorSessionId)) {
      throw new Error("INVALID_SESSION_ID");
    }
    if (!isValidSlug(slug)) {
      throw new Error("INVALID_SLUG");
    }
    if (typeof markdown !== "string") {
      throw new Error("INVALID_MARKDOWN");
    }
    if (byteLength(markdown) > MAX_MARKDOWN_BYTES) {
      throw new Error("FORK_TOO_LARGE");
    }
    if (typeof sourceVersion !== "string" || sourceVersion.length === 0 || sourceVersion.length > 64) {
      throw new Error("INVALID_SOURCE_VERSION");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("userPackForks")
      .withIndex("by_session_slug", (q) =>
        q.eq("operatorSessionId", operatorSessionId).eq("slug", slug),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        markdown,
        sourceVersion,
        updatedAt: now,
      });
      return { slug, created: false, updatedAt: now };
    }

    // Count forks for this session before inserting a new one. Honest cap:
    // refuse to create beyond PER_SESSION_FORK_CAP instead of silently losing.
    const existingCount = await ctx.db
      .query("userPackForks")
      .withIndex("by_session", (q) => q.eq("operatorSessionId", operatorSessionId))
      .collect();
    if (existingCount.length >= PER_SESSION_FORK_CAP) {
      throw new Error("PER_SESSION_FORK_CAP_REACHED");
    }

    await ctx.db.insert("userPackForks", {
      operatorSessionId,
      slug,
      markdown,
      sourceVersion,
      createdAt: now,
      updatedAt: now,
    });
    return { slug, created: true, updatedAt: now };
  },
});

export const deleteFork = mutation({
  args: {
    operatorSessionId: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, { operatorSessionId, slug }) => {
    if (!isValidSessionId(operatorSessionId)) {
      throw new Error("INVALID_SESSION_ID");
    }
    if (!isValidSlug(slug)) {
      throw new Error("INVALID_SLUG");
    }
    const existing = await ctx.db
      .query("userPackForks")
      .withIndex("by_session_slug", (q) =>
        q.eq("operatorSessionId", operatorSessionId).eq("slug", slug),
      )
      .unique();
    if (!existing) {
      return { deleted: false };
    }
    await ctx.db.delete(existing._id);
    return { deleted: true };
  },
});

export const getFork = query({
  args: {
    operatorSessionId: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, { operatorSessionId, slug }) => {
    if (!isValidSessionId(operatorSessionId)) return null;
    if (!isValidSlug(slug)) return null;
    const row = await ctx.db
      .query("userPackForks")
      .withIndex("by_session_slug", (q) =>
        q.eq("operatorSessionId", operatorSessionId).eq("slug", slug),
      )
      .unique();
    if (!row) return null;
    return {
      slug: row.slug,
      markdown: row.markdown,
      sourceVersion: row.sourceVersion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
});

export const listForksForSession = query({
  args: { operatorSessionId: v.string() },
  handler: async (ctx, { operatorSessionId }) => {
    if (!isValidSessionId(operatorSessionId)) return [];
    const rows = await ctx.db
      .query("userPackForks")
      .withIndex("by_session", (q) => q.eq("operatorSessionId", operatorSessionId))
      .collect();
    // Capped return — same bound as the cap on writes.
    return rows.slice(0, PER_SESSION_FORK_CAP).map((r) => ({
      slug: r.slug,
      sourceVersion: r.sourceVersion,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },
});

// Exposed for scripts / external verifiers that want to sanity-check the
// caps without duplicating the constants.
export const __caps = {
  MAX_MARKDOWN_BYTES,
  PER_SESSION_FORK_CAP,
};
