/**
 * D4 — model deprecation registry.
 *
 * Authoritative list of model IDs with their lifecycle status. Consumed by
 * the pack detail page's TransferMatrixTable to flag packs pinned to models
 * that are deprecated or retired.
 *
 * Source-of-truth policy: update this file when vendors announce deprecations.
 * Eventually this will become a Convex table populated from vendor APIs; for
 * MVP it's a hand-maintained manifest so the catalog can flag stale packs
 * without a network round-trip on every render.
 *
 * Shape: { modelId: { status, message?, replacedBy? } }.
 */

import type { ModelStatus } from "@/lib/pack-schema";

type ModelLifecycleEntry = {
  status: ModelStatus;
  /** Short human-readable reason. Rendered beside the chip on hover. */
  message?: string;
  /** Successor model id, when one exists. */
  replacedBy?: string;
  /** ISO date after which the model stops accepting calls. */
  retiresAt?: string;
};

/**
 * Hand-curated lifecycle manifest. Keep this conservative: a false deprecation
 * flag is worse than a missed one because it will push publishers to ratchet
 * version bumps for non-reasons.
 */
const MODEL_LIFECYCLE: Record<string, ModelLifecycleEntry> = {
  // Anthropic
  "claude-opus-4.6": { status: "active" },
  "claude-sonnet-4.6": { status: "active" },
  "claude-haiku-4.5": { status: "active" },
  "claude-opus-3": {
    status: "deprecated",
    message: "Deprecated in favor of Opus 4.x.",
    replacedBy: "claude-opus-4.6",
    retiresAt: "2026-09-30",
  },
  "claude-sonnet-3.5": {
    status: "deprecated",
    message: "Deprecated; migrate to Sonnet 4.x.",
    replacedBy: "claude-sonnet-4.6",
    retiresAt: "2026-07-31",
  },

  // OpenAI
  "gpt-5": { status: "active" },
  "gpt-4o": {
    status: "deprecated",
    message: "Deprecated; migrate to GPT-5.",
    replacedBy: "gpt-5",
    retiresAt: "2026-08-31",
  },
  "gpt-4-turbo": {
    status: "retired",
    message: "Retired. Calls return 410.",
    replacedBy: "gpt-5",
  },

  // Google
  "gemini-2.5-pro": { status: "active" },
  "gemini-2.0-pro": {
    status: "deprecated",
    message: "Deprecated; migrate to 2.5.",
    replacedBy: "gemini-2.5-pro",
    retiresAt: "2026-10-15",
  },
};

/**
 * Look up the lifecycle status for a model id. Unknown ids default to
 * `"active"` — NOT `"deprecated"` — because we cannot honestly claim
 * knowledge about every vendor model. Callers that need strict matching
 * should inspect the returned `.message` for `undefined` as the "unknown" tell.
 */
export function getModelStatus(modelId: string): ModelLifecycleEntry {
  return MODEL_LIFECYCLE[modelId] ?? { status: "active" };
}

/**
 * True when the pack references at least one retired or deprecated model.
 * UI uses this to surface a page-level banner.
 */
export function hasDeprecatedModels(modelIds: string[]): boolean {
  return modelIds.some((id) => getModelStatus(id).status !== "active");
}

/**
 * Summarize lifecycle flags for a list of model ids.
 * Returns `{ retired: [...], deprecated: [...] }`.
 */
export function summarizeLifecycle(modelIds: string[]): {
  retired: string[];
  deprecated: string[];
} {
  const retired: string[] = [];
  const deprecated: string[] = [];
  for (const id of modelIds) {
    const s = getModelStatus(id).status;
    if (s === "retired") retired.push(id);
    else if (s === "deprecated") deprecated.push(id);
  }
  return { retired, deprecated };
}

/**
 * Test-only helper — expose the manifest size so tests can assert the
 * registry is populated without hard-coding model ids.
 */
export function __getLifecycleEntryCount(): number {
  return Object.keys(MODEL_LIFECYCLE).length;
}
