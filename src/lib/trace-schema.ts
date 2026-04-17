/**
 * Canonical ChangeTrace schema for Pillar 2 — the change-trace catalog.
 *
 * A trace captures one coding session's changes as rows:
 *   Scenario / Files / Changes / Why (+ optional FailureModes).
 *
 * See docs/CHANGE_TRACE.md §3 for the source-of-truth type definitions
 * and §4 for the Why-pedagogy schema (plain/analogy/principle/hook with
 * hard word limits).
 *
 * FailureMode is imported from pack-schema.ts — shared vocabulary with
 * Pack.failureModes so catalog-wide queries (symbol across packs + traces)
 * have one shape.
 */

import type { FailureMode } from "@/lib/pack-schema";

export type { FailureMode };

/**
 * The 4-line pedagogical Why. Word limits are enforced at capture time
 * by the CLI (future M7b); schema leaves them as strings to stay
 * permissive on read (a legacy row with a 17-word Plain should still
 * be queryable, not hidden).
 */
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
  diffSummary: string;        // 1–3 lines
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
  packsReferenced: string[];   // slugs — cross-ref into Pillar 1
};

// ---------- Slug / id validation ----------

/**
 * Trace id pattern. Strict: two forms allowed.
 *   ct_YYYY-MM-DD              — "ct_2026-04-17"
 *   ct_YYYY-MM-DD_<suffix>     — "ct_2026-04-17_a7f3"
 * Suffix is kebab-case alnum, 1–40 chars.
 *
 * Single chokepoint for route handlers and accessors. Prevents path
 * traversal, SQL-ish injection strings, and absurdly long ids from
 * reaching the registry.
 */
const TRACE_ID_PATTERN = /^ct_\d{4}-\d{2}-\d{2}(_[a-z0-9-]{1,40})?$/;
const TRACE_ID_MAX_LEN = 60;

export function isValidTraceId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= TRACE_ID_MAX_LEN &&
    TRACE_ID_PATTERN.test(id)
  );
}
