/**
 * M7a: Change-trace catalog (Pillar 2) — Convex queries + mutations.
 *
 * Mirrors the in-process registry (src/lib/trace-registry.ts) so the
 * site + CLI can back onto Convex once the MVP settles. Schemas are
 * defined in convex/schema.ts (changeTraces + changeRows).
 *
 * Id validation here is belt + suspenders: routes already guard on
 * isValidTraceId before calling these. Re-check at the write boundary.
 *
 * Hard caps (BOUND — agentic reliability):
 *   - listTraces: return at most 200 headers + their rows
 *   - searchTraces: return at most 50 hits
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

const TRACE_ID_PATTERN = /^ct_\d{4}-\d{2}-\d{2}(_[a-z0-9-]{1,40})?$/;
const TRACE_ID_MAX_LEN = 60;
const LIST_MAX = 200;
const SEARCH_MAX = 50;

function isValidTraceId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= TRACE_ID_MAX_LEN &&
    TRACE_ID_PATTERN.test(id)
  );
}

/**
 * Rebuild a ChangeTrace-shaped object from the split header + rows.
 * Row rawJson round-trips the canonical shape with any extra fields
 * not denormalized in the row table (e.g. failureModes, changes[]).
 */
function hydrateTrace(
  header: {
    traceId: string;
    project: string;
    sessionId: string;
    createdAt: number;
    tags: string[];
    packsReferenced: string[];
  },
  rows: Array<{ rowIndex: number; rawJson: string }>
) {
  const sortedRows = [...rows].sort((a, b) => a.rowIndex - b.rowIndex);
  const parsedRows: unknown[] = [];
  for (const r of sortedRows) {
    try {
      parsedRows.push(JSON.parse(r.rawJson));
    } catch {
      // Malformed row — skip rather than crash the whole read.
    }
  }
  return {
    id: header.traceId,
    project: header.project,
    sessionId: header.sessionId,
    createdAt: new Date(header.createdAt).toISOString(),
    rows: parsedRows,
    tags: header.tags,
    packsReferenced: header.packsReferenced,
  };
}

// ---------- Queries ----------

export const listTraces = query({
  args: {
    project: v.optional(v.string()),
    sinceMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, LIST_MAX);
    let headers;
    if (args.project) {
      headers = await ctx.db
        .query("changeTraces")
        .withIndex("by_project", (q) => q.eq("project", args.project!))
        .collect();
    } else {
      headers = await ctx.db.query("changeTraces").collect();
    }
    if (args.sinceMs != null) {
      const since = args.sinceMs;
      headers = headers.filter((h: any) => h.createdAt >= since);
    }
    // Newest first.
    headers.sort((a: any, b: any) => b.createdAt - a.createdAt);
    const paged = headers.slice(0, limit);

    const traces = [];
    for (const h of paged) {
      const rows = await ctx.db
        .query("changeRows")
        .withIndex("by_traceId", (q) => q.eq("traceId", h.traceId))
        .collect();
      traces.push(
        hydrateTrace(
          {
            traceId: h.traceId,
            project: h.project,
            sessionId: h.sessionId,
            createdAt: h.createdAt,
            tags: h.tags,
            packsReferenced: h.packsReferenced,
          },
          rows as any
        )
      );
    }
    // Canonical envelope — no bare arrays.
    return { traces, total: headers.length };
  },
});

export const getTraceById = query({
  args: { traceId: v.string() },
  handler: async (ctx, args) => {
    if (!isValidTraceId(args.traceId)) return null;
    const header = await ctx.db
      .query("changeTraces")
      .withIndex("by_traceId", (q) => q.eq("traceId", args.traceId))
      .first();
    if (!header) return null;
    const rows = await ctx.db
      .query("changeRows")
      .withIndex("by_traceId", (q) => q.eq("traceId", args.traceId))
      .collect();
    return hydrateTrace(
      {
        traceId: header.traceId,
        project: header.project,
        sessionId: header.sessionId,
        createdAt: header.createdAt,
        tags: header.tags,
        packsReferenced: header.packsReferenced,
      },
      rows as any
    );
  },
});

export const searchTraces = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const needle = args.query.trim().toLowerCase();
    if (!needle) return { traces: [], total: 0 };

    const rowsAll = await ctx.db.query("changeRows").collect();
    const matchingTraceIds = new Set<string>();
    for (const r of rowsAll as any[]) {
      const hay =
        r.scenario + " " + r.whyHook + " " + r.whyPlain + " " + (r.rawJson ?? "");
      if (hay.toLowerCase().includes(needle)) {
        matchingTraceIds.add(r.traceId);
      }
      if (matchingTraceIds.size >= SEARCH_MAX) break;
    }

    const hits = [];
    for (const traceId of matchingTraceIds) {
      const h = await ctx.db
        .query("changeTraces")
        .withIndex("by_traceId", (q) => q.eq("traceId", traceId))
        .first();
      if (!h) continue;
      const rows = await ctx.db
        .query("changeRows")
        .withIndex("by_traceId", (q) => q.eq("traceId", traceId))
        .collect();
      hits.push(
        hydrateTrace(
          {
            traceId: h.traceId,
            project: h.project,
            sessionId: h.sessionId,
            createdAt: h.createdAt,
            tags: h.tags,
            packsReferenced: h.packsReferenced,
          },
          rows as any
        )
      );
    }
    return { traces: hits, total: hits.length };
  },
});

// ---------- Mutations ----------

/**
 * Upsert a trace header. Creates if missing, patches if present.
 * Called by the CLI (M7b — `attrition trace log`).
 * Does NOT touch rows — call `recordRow` per row separately.
 */
export const upsertTrace = mutation({
  args: {
    traceId: v.string(),
    project: v.string(),
    sessionId: v.string(),
    createdAtIso: v.string(),
    tags: v.array(v.string()),
    packsReferenced: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isValidTraceId(args.traceId)) {
      throw new Error(`Invalid traceId: ${args.traceId}`);
    }
    const createdAt = Date.parse(args.createdAtIso);
    if (!Number.isFinite(createdAt)) {
      throw new Error(`Invalid createdAtIso: ${args.createdAtIso}`);
    }
    const existing = await ctx.db
      .query("changeTraces")
      .withIndex("by_traceId", (q) => q.eq("traceId", args.traceId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        project: args.project,
        sessionId: args.sessionId,
        createdAt,
        tags: args.tags,
        packsReferenced: args.packsReferenced,
      });
      return { id: existing._id, updated: true };
    }
    const id = await ctx.db.insert("changeTraces", {
      traceId: args.traceId,
      project: args.project,
      sessionId: args.sessionId,
      createdAt,
      tags: args.tags,
      packsReferenced: args.packsReferenced,
    });
    return { id, updated: false };
  },
});

/**
 * Append (or overwrite by rowIndex) a single row under a trace.
 * Denormalizes hot fields for filter/FTS; stashes full canonical row
 * as JSON for schema evolution.
 */
export const recordRow = mutation({
  args: {
    traceId: v.string(),
    rowIndex: v.number(),
    scenario: v.string(),
    filesTouched: v.array(v.string()),
    whyPlain: v.string(),
    whyHook: v.string(),
    whyAnalogy: v.string(),
    whyPrinciple: v.string(),
    rawJson: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isValidTraceId(args.traceId)) {
      throw new Error(`Invalid traceId: ${args.traceId}`);
    }
    // Deterministic overwrite: find existing by (traceId, rowIndex).
    const existing = (
      await ctx.db
        .query("changeRows")
        .withIndex("by_traceId", (q) => q.eq("traceId", args.traceId))
        .collect()
    ).find((r: any) => r.rowIndex === args.rowIndex);
    if (existing) {
      await ctx.db.patch(existing._id, {
        scenario: args.scenario,
        filesTouched: args.filesTouched,
        whyPlain: args.whyPlain,
        whyHook: args.whyHook,
        whyAnalogy: args.whyAnalogy,
        whyPrinciple: args.whyPrinciple,
        rawJson: args.rawJson,
      });
      return { id: existing._id, updated: true };
    }
    const id = await ctx.db.insert("changeRows", {
      traceId: args.traceId,
      rowIndex: args.rowIndex,
      scenario: args.scenario,
      filesTouched: args.filesTouched,
      whyPlain: args.whyPlain,
      whyHook: args.whyHook,
      whyAnalogy: args.whyAnalogy,
      whyPrinciple: args.whyPrinciple,
      rawJson: args.rawJson,
    });
    return { id, updated: false };
  },
});

export const __internalDeleteAllForTest = internalMutation({
  args: {},
  handler: async (ctx) => {
    const headers = await ctx.db.query("changeTraces").collect();
    for (const h of headers) await ctx.db.delete(h._id);
    const rows = await ctx.db.query("changeRows").collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return { deleted: headers.length + rows.length };
  },
});
