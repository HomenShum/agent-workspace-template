/**
 * GET /api/packs
 *
 * Typed JSON directory of packs. Filters are applied in-memory
 * (catalog is small and fully typed).
 *
 * Query params:
 *   ?type=harness|ui|rag|eval|reference|data|design|security
 *   ?pattern=prompt-chaining|routing|parallelization|orchestrator-workers|evaluator-optimizer|hybrid
 *   ?trust=Verified|Community
 *   ?q=<substring>  (case-insensitive includes against name/tagline/summary/tags)
 *   ?limit=<1..200>  (default 50)
 *   ?offset=<>=0>    (default 0)
 *
 * Response:
 *   { packs: Pack[], total: number, filters: { type, pattern, trust, q, limit, offset } }
 *
 * `total` is the count BEFORE pagination.
 */

import { NextResponse } from "next/server";
import type { Pack, PackType, CanonicalPattern, TrustTier } from "@/lib/pack-schema";
import { getAllPacks } from "@/lib/pack-registry";

const VALID_TYPES: PackType[] = [
  "harness",
  "ui",
  "reference",
  "data",
  "rag",
  "eval",
  "design",
  "security",
];

const VALID_PATTERNS: CanonicalPattern[] = [
  "prompt-chaining",
  "routing",
  "parallelization",
  "orchestrator-workers",
  "evaluator-optimizer",
  "hybrid",
  "n/a",
];

const VALID_TRUST: TrustTier[] = ["Verified", "Community"];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseIntClamped(raw: string | null, fallback: number, min: number, max: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function matchQuery(pack: Pack, q: string): boolean {
  const needle = q.toLowerCase();
  if (pack.name.toLowerCase().includes(needle)) return true;
  if (pack.tagline.toLowerCase().includes(needle)) return true;
  if (pack.summary.toLowerCase().includes(needle)) return true;
  if (pack.tags.some((tag) => tag.toLowerCase().includes(needle))) return true;
  return false;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const typeParam = params.get("type");
  const patternParam = params.get("pattern");
  const trustParam = params.get("trust");
  const qParam = params.get("q")?.trim() ?? "";

  const limit = parseIntClamped(params.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = parseIntClamped(params.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

  const typeFilter: PackType | null =
    typeParam && (VALID_TYPES as string[]).includes(typeParam) ? (typeParam as PackType) : null;
  const patternFilter: CanonicalPattern | null =
    patternParam && (VALID_PATTERNS as string[]).includes(patternParam)
      ? (patternParam as CanonicalPattern)
      : null;
  const trustFilter: TrustTier | null =
    trustParam && (VALID_TRUST as string[]).includes(trustParam) ? (trustParam as TrustTier) : null;

  let filtered: Pack[] = getAllPacks();
  if (typeFilter) filtered = filtered.filter((p) => p.packType === typeFilter);
  if (patternFilter) filtered = filtered.filter((p) => p.canonicalPattern === patternFilter);
  if (trustFilter) filtered = filtered.filter((p) => p.trust === trustFilter);
  if (qParam) filtered = filtered.filter((p) => matchQuery(p, qParam));

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  const body = {
    packs: page,
    total,
    filters: {
      type: typeFilter,
      pattern: patternFilter,
      trust: trustFilter,
      q: qParam || null,
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
