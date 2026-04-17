/**
 * GET /api/traces
 *
 * Typed JSON directory of change-traces. Filters applied in-memory
 * (catalog is small and fully typed).
 *
 * Query params:
 *   ?project=<substring>          case-insensitive includes
 *   ?symbol=<substring>           case-insensitive includes against any
 *                                   ChangeDetail symbol (added/renamed/removed)
 *   ?q=<substring>                case-insensitive includes against scenario,
 *                                   hook, tags, file paths, symbols
 *   ?since=<ISO-date>             only traces with createdAt >= since
 *   ?limit=<1..200>               default 50
 *   ?offset=<>=0>                 default 0
 *
 * Response (canonical envelope — never a bare array):
 *   { traces: ChangeTrace[], total: number, filters: { project, symbol, q, since, limit, offset } }
 *
 * `total` is the count BEFORE pagination.
 */

import { NextResponse } from "next/server";
import type { ChangeTrace } from "@/lib/trace-schema";
import { getAllTraces, searchTraces } from "@/lib/trace-registry";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseIntClamped(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function matchesProject(trace: ChangeTrace, needle: string): boolean {
  return trace.project.toLowerCase().includes(needle.toLowerCase());
}

function matchesSymbol(trace: ChangeTrace, needle: string): boolean {
  const n = needle.toLowerCase();
  for (const row of trace.rows) {
    for (const c of row.changes) {
      if (c.symbolsAdded.some((s) => s.toLowerCase().includes(n))) return true;
      if (c.symbolsRemoved.some((s) => s.toLowerCase().includes(n))) return true;
      for (const rn of c.symbolsRenamed) {
        if (
          rn.from.toLowerCase().includes(n) ||
          rn.to.toLowerCase().includes(n)
        )
          return true;
      }
    }
  }
  return false;
}

function matchesSince(trace: ChangeTrace, since: string): boolean {
  // Lexicographic compare on ISO-8601 is chronological-safe.
  return trace.createdAt >= since;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const projectParam = params.get("project")?.trim() ?? "";
  const symbolParam = params.get("symbol")?.trim() ?? "";
  const qParam = params.get("q")?.trim() ?? "";
  const sinceParam = params.get("since")?.trim() ?? "";

  const limit = parseIntClamped(params.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = parseIntClamped(
    params.get("offset"),
    0,
    0,
    Number.MAX_SAFE_INTEGER
  );

  // Start from search if q provided (cheaper); otherwise full list.
  let filtered: ChangeTrace[] = qParam ? searchTraces(qParam) : getAllTraces();

  if (projectParam) {
    filtered = filtered.filter((t) => matchesProject(t, projectParam));
  }
  if (symbolParam) {
    filtered = filtered.filter((t) => matchesSymbol(t, symbolParam));
  }
  if (sinceParam) {
    filtered = filtered.filter((t) => matchesSince(t, sinceParam));
  }

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  const body = {
    traces: page,
    total,
    filters: {
      project: projectParam || null,
      symbol: symbolParam || null,
      q: qParam || null,
      since: sinceParam || null,
      limit,
      offset,
    },
  };

  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=60",
    },
  });
}
