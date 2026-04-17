/**
 * Inline mirror of the canonical ChangeTrace types from the parent repo
 * at `src/lib/trace-schema.ts` (and the `FailureMode` shape from
 * `src/lib/pack-schema.ts`).
 *
 * SYNC REQUIREMENT: This file must be manually kept in shape-parity with
 * the parent `src/lib/trace-schema.ts` and the `FailureMode` / `FailureModeTier`
 * types in `src/lib/pack-schema.ts`. The MCP server is published as a
 * standalone npm package (`attrition-mcp`) and deliberately does NOT
 * import across the package boundary. When the parent schema changes,
 * update here too. (The M2↔M4 drift that broke the CLI is not allowed
 * to repeat — the verify script exercises forward-compat unwrapping to
 * make shape drift fail loud.)
 *
 * Trace id pattern is duplicated here (not imported) for the same reason:
 *   ct_YYYY-MM-DD              — "ct_2026-04-17"
 *   ct_YYYY-MM-DD_<suffix>     — "ct_2026-04-17_a7f3"
 *   suffix is kebab-case alnum, 1–40 chars.
 */

export type FailureModeTier = "jr" | "mid" | "sr" | "staff";

export type FailureMode = {
  symptom: string;
  trigger: string;
  preventionCheck: string;
  tier: FailureModeTier;
  relatedPacks?: string[];
};

export type WhyExplanation = {
  plain: string;      // ≤15 words, no jargon
  analogy: string;    // ≤20 words, physical/social
  principle: string;  // ≤20 words, invariant rule
  hook: string;       // ≤6 words, imperative, ctrl+F anchor
};

export type ChangeDetail = {
  path: string;
  symbolsAdded: string[];
  symbolsRenamed: Array<{ from: string; to: string }>;
  symbolsRemoved: string[];
  diffSummary: string;
};

export type ChangeRow = {
  scenario: string;
  filesTouched: string[];
  changes: ChangeDetail[];
  why: WhyExplanation;
  failureModes?: FailureMode[];
};

export type ChangeTrace = {
  id: string;                  // "ct_YYYY-MM-DD[_suffix]"
  project: string;
  sessionId: string;
  createdAt: string;           // ISO
  rows: ChangeRow[];
  tags: string[];
  packsReferenced: string[];   // pack slugs — cross-ref into Pillar 1
};

// ---------- Trace id validation ----------

/**
 * Strict trace id pattern. Single chokepoint for route handlers and
 * accessors. Prevents path traversal, injection strings, and absurdly
 * long ids from reaching the registry or being logged.
 */
export const TRACE_ID_PATTERN = /^ct_\d{4}-\d{2}-\d{2}(_[a-z0-9-]{1,40})?$/;
export const TRACE_ID_MAX_LEN = 60;

export function isValidTraceId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= TRACE_ID_MAX_LEN &&
    TRACE_ID_PATTERN.test(id)
  );
}

// ---------- List filter & tool I/O shapes ----------

export type TraceListFilter = {
  query?: string;
  project?: string;
  symbol?: string;
  sinceDate?: string;   // ISO date, forwarded as `since` query param
  limit?: number;
  offset?: number;
};

/**
 * Canonical list envelope returned by `/api/traces`.
 * We accept either `{ traces, total, filters? }` OR a bare `ChangeTrace[]`
 * (forward-compat — same lenience as the pack registry client).
 */
export type TraceListResponse = {
  traces: ChangeTrace[];
  total: number;
  filters?: Record<string, unknown>;
};

/**
 * Per-row matching metadata the `search_change_traces` tool surfaces.
 * Honest-status: if the registry returns no per-row metadata, we return
 * `matchingRows: []` rather than synthesizing one.
 */
export type TraceSearchHit = {
  id: string;
  project: string;
  createdAt: string;
  matchingRows: number[];
  snippet: string;
};

/**
 * Structured error envelope returned from every trace tool on failure.
 * Superset of the pack-tool error codes — never thrown to the transport.
 */
export type McpTraceError = {
  error: {
    code:
      | "EMPTY_QUERY"
      | "INVALID_INPUT"
      | "INVALID_TRACE_ID"
      | "ROW_OUT_OF_RANGE"
      | "NOT_FOUND"
      | "TIMEOUT"
      | "PAYLOAD_TOO_LARGE"
      | "UPSTREAM_ERROR"
      | "NETWORK_ERROR";
    message: string;
  };
};
