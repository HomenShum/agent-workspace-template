#!/usr/bin/env node
/**
 * attrition-mcp — MCP server for the attrition.sh pack catalog.
 *
 * Transport: stdio
 * Tools:
 *   - resolve_pack_id     Fuzzy-match a free-text query to pack slugs (Context7 parity)
 *   - get_pack            Fetch a full Pack JSON object by slug
 *   - get_pack_section    Fetch a single H2 section (summary, contract, layers, ...)
 *   - search_packs        Typed directory query (packType, canonicalPattern, trust)
 *   - compare_packs       Merge `comparesWith` axes from two packs
 *
 * Error contract: tools never throw to the transport. They return
 * `{ content: [{ type: "text", text: JSON }] }` where the JSON is either
 * the success shape or `{ error: { code, message } }`.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import * as registry from "./registry.js";
import { RegistryError } from "./registry.js";
import * as traceRegistry from "./trace-registry.js";
import { TraceRegistryError } from "./trace-registry.js";
import {
  extractSection,
  isSectionName,
  SECTION_ENUM,
  type SectionName,
} from "./sections.js";
import type { Pack, PackComparison, McpError } from "./types.js";
import {
  isValidTraceId,
  type ChangeTrace,
  type ChangeRow,
  type McpTraceError,
  type TraceSearchHit,
} from "./trace-types.js";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9-]+$/;

const SlugSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(SLUG_RE, "INVALID_SLUG");

const PackTypeSchema = z.enum([
  "harness",
  "ui",
  "reference",
  "data",
  "rag",
  "eval",
  "design",
  "security",
]);

const CanonicalPatternSchema = z.enum([
  "prompt-chaining",
  "routing",
  "parallelization",
  "orchestrator-workers",
  "evaluator-optimizer",
  "hybrid",
  "n/a",
]);

const TrustSchema = z.enum(["Verified", "Community"]);

const SectionSchema = z.enum(SECTION_ENUM);

const ComparisonAxisSchema = z.enum([
  "cost",
  "latency",
  "complexity",
  "accuracy",
  "a11y",
  "maintainability",
]);

const ResolveInput = z.object({
  query: z.string(),
});

const GetPackInput = z.object({
  slug: z.string(),
});

const GetSectionInput = z.object({
  slug: z.string(),
  section: z.string(),
});

const SearchInput = z.object({
  query: z.string().optional(),
  packType: z.string().optional(),
  canonicalPattern: z.string().optional(),
  trust: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const CompareInput = z.object({
  slugA: z.string(),
  slugB: z.string(),
  axis: z.string().optional(),
});

// ---- Change-trace (Pillar 2) input schemas --------------------------------

const SearchTracesInput = z.object({
  query: z.string(),
  project: z.string().max(128).optional(),
  symbol: z.string().max(256).optional(),
  sinceDate: z.string().max(32).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const GetTraceInput = z.object({
  id: z.string(),
});

const GetRowInput = z.object({
  id: z.string(),
  rowIndex: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Tool definitions (JSON Schema for MCP ListTools)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "resolve_pack_id",
    description:
      "Fuzzy-match a free-text query against pack names, taglines, and tags. Returns up to 5 candidate packs ranked by substring-hit score (Verified tier wins ties). Mirrors the Context7 resolve-library-id UX for pack discovery.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Free-text search over name, tagline, and tags.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_pack",
    description:
      "Fetch a full Pack JSON object by slug. Returns the canonical Pack shape (identity, trust, contract, layers, body content, telemetry, relationships).",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Pack slug (lowercase, hyphens only).",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "get_pack_section",
    description:
      "Fetch a single H2 section from a pack's raw markdown. Use this to stream just the piece you need (e.g. `contract`, `layers`, `evaluation-checklist`) instead of paying for the whole pack. Payload target: under 3k tokens.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Pack slug." },
        section: {
          type: "string",
          description: "Section anchor (slugified H2 heading).",
          enum: [...SECTION_ENUM],
        },
      },
      required: ["slug", "section"],
    },
  },
  {
    name: "search_packs",
    description:
      "Typed directory query. Filter by packType, canonicalPattern, trust tier, or free-text query. Limit capped at 50.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        packType: {
          type: "string",
          enum: [
            "harness",
            "ui",
            "reference",
            "data",
            "rag",
            "eval",
            "design",
            "security",
          ],
        },
        canonicalPattern: {
          type: "string",
          enum: [
            "prompt-chaining",
            "routing",
            "parallelization",
            "orchestrator-workers",
            "evaluator-optimizer",
            "hybrid",
            "n/a",
          ],
        },
        trust: { type: "string", enum: ["Verified", "Community"] },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: "compare_packs",
    description:
      "Merge `comparesWith` axes from two packs. Optionally filter to a single axis (cost, latency, complexity, accuracy, a11y, maintainability). Returns both pack objects plus a normalized comparison block.",
    inputSchema: {
      type: "object",
      properties: {
        slugA: { type: "string" },
        slugB: { type: "string" },
        axis: {
          type: "string",
          enum: [
            "cost",
            "latency",
            "complexity",
            "accuracy",
            "a11y",
            "maintainability",
          ],
        },
      },
      required: ["slugA", "slugB"],
    },
  },
  {
    name: "search_change_traces",
    description:
      "Search the change-trace catalog (Pillar 2). Full-text over scenario / changes / why, filterable by project, symbol, sinceDate. Returns ranked snippets + matching-row indexes so agents can pull just the rows they need. Payload <2k tokens for top 20 matches. Limit capped at 50.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Free-text search over trace content.",
        },
        project: { type: "string", description: "Filter by project slug." },
        symbol: {
          type: "string",
          description: "Filter to traces touching this symbol / function name.",
        },
        sinceDate: {
          type: "string",
          description: "ISO date floor (e.g. '2026-01-01').",
        },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      required: ["query"],
    },
  },
  {
    name: "get_trace",
    description:
      "Fetch a full ChangeTrace JSON object by id. Id must match `ct_YYYY-MM-DD[_<suffix>]`. Returns `{ trace }` envelope with rows, tags, and packsReferenced cross-references into Pillar 1.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Trace id (format: ct_YYYY-MM-DD[_suffix]).",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_row",
    description:
      "Fetch a single row from a trace plus resolved cross-references (referenced packs + related rows in other traces). Bounds-checked rowIndex. Payload target <3k tokens.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Trace id." },
        rowIndex: {
          type: "integer",
          minimum: 0,
          description: "Zero-based row index within the trace.",
        },
      },
      required: ["id", "rowIndex"],
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toContent(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
  };
}

function mcpError(code: McpError["error"]["code"], message: string): McpError {
  return { error: { code, message } };
}

function mapRegistryError(err: unknown): McpError {
  if (err instanceof RegistryError) {
    return mcpError(err.code, err.message);
  }
  const e = err as Error;
  return mcpError("UPSTREAM_ERROR", e?.message ?? "Unknown upstream error");
}

function mcpTraceError(
  code: McpTraceError["error"]["code"],
  message: string
): McpTraceError {
  return { error: { code, message } };
}

function mapTraceRegistryError(err: unknown): McpTraceError {
  if (err instanceof TraceRegistryError) {
    return mcpTraceError(err.code, err.message);
  }
  if (err instanceof RegistryError) {
    // Shared error vocabulary — safe to re-tag.
    return mcpTraceError(err.code, err.message);
  }
  const e = err as Error;
  return mcpTraceError(
    "UPSTREAM_ERROR",
    e?.message ?? "Unknown upstream error"
  );
}

function validateTraceId(raw: string): string | McpTraceError {
  if (!isValidTraceId(raw)) {
    return mcpTraceError(
      "INVALID_TRACE_ID",
      `Trace id must match ct_YYYY-MM-DD[_<suffix>] (got: ${JSON.stringify(raw).slice(0, 64)})`
    );
  }
  return raw;
}

function validateSlug(raw: string): string | McpError {
  const parsed = SlugSchema.safeParse(raw);
  if (!parsed.success) {
    return mcpError(
      "INVALID_SLUG",
      `Slug must match ${SLUG_RE.source} (got: ${JSON.stringify(raw).slice(0, 64)})`
    );
  }
  return parsed.data;
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/**
 * Simple substring-hit scorer. One point per query token that appears
 * anywhere in the searchable blob. Verified tier wins ties. No fuzzy
 * edit-distance — callers who want that can run it client-side.
 */
function scoreCandidate(pack: Pack, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const blob = [
    pack.name,
    pack.tagline,
    pack.slug,
    ...(pack.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (blob.includes(t)) score += 1;
  }
  return score;
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

export async function handleResolvePackId(
  rawInput: unknown
): Promise<object> {
  const parsed = ResolveInput.safeParse(rawInput);
  if (!parsed.success) {
    return mcpError("INVALID_INPUT", "Expected { query: string }");
  }
  const query = parsed.data.query.trim();
  if (query.length === 0) {
    return mcpError("EMPTY_QUERY", "Query must be a non-empty string");
  }

  let packs: Pack[];
  try {
    packs = await registry.list({ query });
  } catch (err) {
    return mapRegistryError(err);
  }

  const tokens = tokenize(query);
  const scored = packs
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      packType: p.packType,
      trust: p.trust,
      score: scoreCandidate(p, tokens),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Verified wins ties
      if (a.trust !== b.trust) return a.trust === "Verified" ? -1 : 1;
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, 5)
    .map(({ trust: _trust, ...rest }) => rest);

  return { candidates: scored };
}

export async function handleGetPack(rawInput: unknown): Promise<object> {
  const parsed = GetPackInput.safeParse(rawInput);
  if (!parsed.success) {
    return mcpError("INVALID_INPUT", "Expected { slug: string }");
  }
  const slugOrErr = validateSlug(parsed.data.slug);
  if (typeof slugOrErr !== "string") return slugOrErr;

  try {
    const pack = await registry.get(slugOrErr);
    return { pack };
  } catch (err) {
    return mapRegistryError(err);
  }
}

export async function handleGetPackSection(
  rawInput: unknown
): Promise<object> {
  const parsed = GetSectionInput.safeParse(rawInput);
  if (!parsed.success) {
    return mcpError(
      "INVALID_INPUT",
      "Expected { slug: string, section: string }"
    );
  }
  const slugOrErr = validateSlug(parsed.data.slug);
  if (typeof slugOrErr !== "string") return slugOrErr;

  const section = parsed.data.section.trim().toLowerCase();
  const sectionCheck = SectionSchema.safeParse(section);
  if (!sectionCheck.success || !isSectionName(section)) {
    return mcpError(
      "INVALID_SECTION",
      `Section must be one of: ${SECTION_ENUM.join(", ")}`
    );
  }

  let markdown: string;
  try {
    markdown = await registry.getRawMarkdown(slugOrErr);
  } catch (err) {
    return mapRegistryError(err);
  }

  const content = extractSection(markdown, section);
  if (content === null) {
    return mcpError(
      "NOT_FOUND",
      `Section "${section}" not found in pack "${slugOrErr}"`
    );
  }
  return {
    slug: slugOrErr,
    section: section as SectionName,
    content,
  };
}

export async function handleSearchPacks(
  rawInput: unknown
): Promise<object> {
  const parsed = SearchInput.safeParse(rawInput);
  if (!parsed.success) {
    return mcpError(
      "INVALID_INPUT",
      "Expected { query?, packType?, canonicalPattern?, trust?, limit? }"
    );
  }
  const { query, packType, canonicalPattern, trust, limit } = parsed.data;

  if (packType !== undefined && !PackTypeSchema.safeParse(packType).success) {
    return mcpError("INVALID_INPUT", `Invalid packType: ${packType}`);
  }
  if (
    canonicalPattern !== undefined &&
    !CanonicalPatternSchema.safeParse(canonicalPattern).success
  ) {
    return mcpError(
      "INVALID_INPUT",
      `Invalid canonicalPattern: ${canonicalPattern}`
    );
  }
  if (trust !== undefined && !TrustSchema.safeParse(trust).success) {
    return mcpError("INVALID_INPUT", `Invalid trust: ${trust}`);
  }

  const cappedLimit = Math.min(limit ?? 50, 50);

  try {
    const packs = await registry.list({
      query,
      packType: packType as Pack["packType"] | undefined,
      canonicalPattern: canonicalPattern as Pack["canonicalPattern"] | undefined,
      trust: trust as Pack["trust"] | undefined,
      limit: cappedLimit,
    });
    const bounded = packs.slice(0, cappedLimit);
    return { packs: bounded, total: packs.length };
  } catch (err) {
    return mapRegistryError(err);
  }
}

export async function handleComparePacks(
  rawInput: unknown
): Promise<object> {
  const parsed = CompareInput.safeParse(rawInput);
  if (!parsed.success) {
    return mcpError(
      "INVALID_INPUT",
      "Expected { slugA: string, slugB: string, axis? }"
    );
  }
  const aOrErr = validateSlug(parsed.data.slugA);
  if (typeof aOrErr !== "string") return aOrErr;
  const bOrErr = validateSlug(parsed.data.slugB);
  if (typeof bOrErr !== "string") return bOrErr;

  let axis: string | undefined = parsed.data.axis;
  if (axis !== undefined) {
    const axisCheck = ComparisonAxisSchema.safeParse(axis);
    if (!axisCheck.success) {
      return mcpError("INVALID_INPUT", `Invalid axis: ${axis}`);
    }
  }

  let a: Pack;
  let b: Pack;
  try {
    [a, b] = await Promise.all([registry.get(aOrErr), registry.get(bOrErr)]);
  } catch (err) {
    return mapRegistryError(err);
  }

  const aAgainstB = (a.comparesWith ?? []).filter(
    (c: PackComparison) => c.slug === b.slug
  );
  const bAgainstA = (b.comparesWith ?? []).filter(
    (c: PackComparison) => c.slug === a.slug
  );

  type MergedAxis = { axis: string; winnerSlug: string | null; note: string };
  const axisMap = new Map<string, MergedAxis>();

  for (const c of aAgainstB) {
    if (axis && c.axis !== axis) continue;
    const winner =
      c.winner === "self" ? a.slug : c.winner === "other" ? b.slug : null;
    axisMap.set(c.axis, { axis: c.axis, winnerSlug: winner, note: c.note });
  }
  for (const c of bAgainstA) {
    if (axis && c.axis !== axis) continue;
    const winner =
      c.winner === "self" ? b.slug : c.winner === "other" ? a.slug : null;
    const existing = axisMap.get(c.axis);
    if (!existing) {
      axisMap.set(c.axis, { axis: c.axis, winnerSlug: winner, note: c.note });
    } else if (existing.winnerSlug === null && winner !== null) {
      axisMap.set(c.axis, { axis: c.axis, winnerSlug: winner, note: existing.note || c.note });
    }
  }

  const axes = Array.from(axisMap.values());
  const aWins = axes.filter((x) => x.winnerSlug === a.slug).length;
  const bWins = axes.filter((x) => x.winnerSlug === b.slug).length;
  let verdict: string;
  if (axes.length === 0) {
    verdict = `No direct comparison data between ${a.slug} and ${b.slug}.`;
  } else if (aWins > bWins) {
    verdict = `${a.slug} wins ${aWins}/${axes.length} axes; ${b.slug} wins ${bWins}.`;
  } else if (bWins > aWins) {
    verdict = `${b.slug} wins ${bWins}/${axes.length} axes; ${a.slug} wins ${aWins}.`;
  } else {
    verdict = `Split decision: ${a.slug} and ${b.slug} each win ${aWins}/${axes.length} axes.`;
  }

  return {
    a,
    b,
    comparison: { axes, verdict },
  };
}

// ---------------------------------------------------------------------------
// Change-trace (Pillar 2) handlers
// ---------------------------------------------------------------------------

/**
 * Build an honest snippet for a search hit. We DO NOT synthesize
 * matching-row indexes — if the registry didn't tag rows, we return [].
 * The snippet is the first row's scenario (capped at 160 chars) or empty.
 */
function buildSearchHit(
  trace: ChangeTrace,
  tokens: string[]
): TraceSearchHit {
  // Honest-status: matching-row detection is best-effort over the
  // registry's response. If the registry doesn't tell us which rows
  // matched, we look at each row's scenario / diffSummary / why.plain
  // for a token hit. An empty token list yields no hits.
  const matchingRows: number[] = [];
  if (tokens.length > 0) {
    for (let i = 0; i < trace.rows.length; i++) {
      const row = trace.rows[i];
      if (!row) continue;
      const blob = [
        row.scenario,
        ...row.filesTouched,
        row.why?.plain ?? "",
        row.why?.hook ?? "",
        ...row.changes.flatMap((c) => [
          c.path,
          c.diffSummary,
          ...c.symbolsAdded,
          ...c.symbolsRemoved,
          ...c.symbolsRenamed.flatMap((r) => [r.from, r.to]),
        ]),
      ]
        .join(" ")
        .toLowerCase();
      if (tokens.some((t) => blob.includes(t))) {
        matchingRows.push(i);
      }
    }
  }
  const firstMatch =
    matchingRows.length > 0 ? trace.rows[matchingRows[0] ?? 0] : trace.rows[0];
  const rawSnippet = firstMatch?.scenario ?? "";
  const snippet =
    rawSnippet.length > 160 ? `${rawSnippet.slice(0, 157)}...` : rawSnippet;
  return {
    id: trace.id,
    project: trace.project,
    createdAt: trace.createdAt,
    matchingRows,
    snippet,
  };
}

export async function handleSearchChangeTraces(
  rawInput: unknown
): Promise<object> {
  const parsed = SearchTracesInput.safeParse(rawInput);
  if (!parsed.success) {
    return mcpTraceError(
      "INVALID_INPUT",
      "Expected { query: string, project?, symbol?, sinceDate?, limit? }"
    );
  }
  const query = parsed.data.query.trim();
  if (query.length === 0) {
    return mcpTraceError("EMPTY_QUERY", "Query must be a non-empty string");
  }
  const cappedLimit = Math.min(parsed.data.limit ?? 20, 50);

  let listed;
  try {
    listed = await traceRegistry.listTraces({
      query,
      project: parsed.data.project,
      symbol: parsed.data.symbol,
      sinceDate: parsed.data.sinceDate,
      limit: cappedLimit,
    });
  } catch (err) {
    return mapTraceRegistryError(err);
  }

  const tokens = tokenize(query);
  const hits = listed.traces.map((t) => buildSearchHit(t, tokens));

  // Rank by matching-row count desc, then createdAt desc, then id asc.
  hits.sort((a, b) => {
    if (b.matchingRows.length !== a.matchingRows.length) {
      return b.matchingRows.length - a.matchingRows.length;
    }
    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? 1 : -1;
    }
    return a.id.localeCompare(b.id);
  });

  const bounded = hits.slice(0, cappedLimit);
  return {
    traces: bounded,
    total: typeof listed.total === "number" ? listed.total : hits.length,
  };
}

export async function handleGetTrace(rawInput: unknown): Promise<object> {
  const parsed = GetTraceInput.safeParse(rawInput);
  if (!parsed.success) {
    return mcpTraceError("INVALID_INPUT", "Expected { id: string }");
  }
  const idOrErr = validateTraceId(parsed.data.id);
  if (typeof idOrErr !== "string") return idOrErr;
  try {
    const trace = await traceRegistry.getTrace(idOrErr);
    return { trace };
  } catch (err) {
    return mapTraceRegistryError(err);
  }
}

export async function handleGetRow(rawInput: unknown): Promise<object> {
  const parsed = GetRowInput.safeParse(rawInput);
  if (!parsed.success) {
    return mcpTraceError(
      "INVALID_INPUT",
      "Expected { id: string, rowIndex: integer >= 0 }"
    );
  }
  const idOrErr = validateTraceId(parsed.data.id);
  if (typeof idOrErr !== "string") return idOrErr;

  const { rowIndex } = parsed.data;

  let trace: ChangeTrace;
  try {
    trace = await traceRegistry.getTrace(idOrErr);
  } catch (err) {
    return mapTraceRegistryError(err);
  }

  if (!Array.isArray(trace.rows) || rowIndex >= trace.rows.length) {
    return mcpTraceError(
      "ROW_OUT_OF_RANGE",
      `rowIndex ${rowIndex} out of range (trace has ${trace.rows?.length ?? 0} rows)`
    );
  }
  const row = trace.rows[rowIndex] as ChangeRow;

  // Cross-references: referenced pack slugs from the parent trace
  // (honest — just the slugs the author recorded; no synthesis), plus
  // related rows in the same trace that share a filesTouched entry.
  const relatedRows: Array<{ trace: string; row: number; reason: string }> = [];
  for (let i = 0; i < trace.rows.length; i++) {
    if (i === rowIndex) continue;
    const other = trace.rows[i];
    if (!other) continue;
    const shared = row.filesTouched.find((f) => other.filesTouched.includes(f));
    if (shared) {
      relatedRows.push({
        trace: trace.id,
        row: i,
        reason: `shared file: ${shared}`,
      });
    }
  }

  return {
    trace: trace.id,
    rowIndex,
    scenario: row.scenario,
    filesTouched: row.filesTouched,
    changes: row.changes,
    why: row.why,
    ...(row.failureModes ? { failureModes: row.failureModes } : {}),
    crossReferences: {
      packs: Array.isArray(trace.packsReferenced) ? trace.packsReferenced : [],
      relatedRows,
    },
  };
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

export function createServer(): Server {
  const server = new Server(
    {
      name: "attrition-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      switch (name) {
        case "resolve_pack_id":
          return toContent(await handleResolvePackId(args));
        case "get_pack":
          return toContent(await handleGetPack(args));
        case "get_pack_section":
          return toContent(await handleGetPackSection(args));
        case "search_packs":
          return toContent(await handleSearchPacks(args));
        case "compare_packs":
          return toContent(await handleComparePacks(args));
        case "search_change_traces":
          return toContent(await handleSearchChangeTraces(args));
        case "get_trace":
          return toContent(await handleGetTrace(args));
        case "get_row":
          return toContent(await handleGetRow(args));
        default:
          return toContent(
            mcpError("INVALID_INPUT", `Unknown tool: ${name}`)
          );
      }
    } catch (err) {
      // Error boundary — never throw to the transport.
      return toContent(mapRegistryError(err));
    }
  });

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr only — stdout is the MCP channel.
  process.stderr.write("[attrition-mcp] ready on stdio\n");
}

// Only boot when run as a script, not when imported for tests.
const isDirectInvocation =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("index.js") ||
  process.argv[1]?.endsWith("index.ts");

if (isDirectInvocation) {
  main().catch((err) => {
    process.stderr.write(
      `[attrition-mcp] fatal: ${(err as Error).message}\n`
    );
    process.exit(1);
  });
}
