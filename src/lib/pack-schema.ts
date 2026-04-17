/**
 * Canonical Pack schema for Agent Workspace / attrition.sh catalog.
 * Supersedes src/lib/harness-packs.ts HarnessPack type.
 *
 * Packs are the universal unit of "installable production pattern" —
 * harness, UI, data, RAG, eval, design, security, or reference.
 * Same shape across all types; only body content differs.
 */

import type { PackArtworkVariant } from "@/lib/pack-art-types";

export type PackType =
  | "harness"
  | "ui"
  | "reference"
  | "data"
  | "rag"
  | "eval"
  | "design"
  | "security";

export type CanonicalPattern =
  | "prompt-chaining"
  | "routing"
  | "parallelization"
  | "orchestrator-workers"
  | "evaluator-optimizer"
  | "hybrid"
  | "n/a";

export type TrustTier = "Verified" | "Community";

export type PackStatus = "Production-ready" | "Recommended" | "Experimental";

export type ComparisonAxis =
  | "cost"
  | "latency"
  | "complexity"
  | "accuracy"
  | "a11y"
  | "maintainability";

/**
 * Execution contract (Tongyi NLA pattern). Turns fuzzy LLM calls
 * into bounded agent invocations.
 */
export type PackContract = {
  requiredOutputs: string[];
  tokenBudget: number;
  permissions: string[];
  completionConditions: string[];
  outputPath: string;
};

/**
 * Three-layer harness split. Enables ablation: swap NLH while fixing
 * runtimeCharter, or vice versa.
 */
export type PackLayers = {
  runtimeCharter: string;
  nlh: string;
  toolSpec: Array<{ name: string; signature: string; description: string }>;
};

/**
 * D4 — model-deprecation flag. Mirrors Anthropic/OpenAI/Google retirement
 * calendars. `"deprecated"` = still callable but retired soon; `"retired"`
 * = calls will 404 / 410. UI surfaces warnings so packs pinned to retired
 * models are visibly stale.
 */
export type ModelStatus = "active" | "deprecated" | "retired";

export type TransferMatrixEntry = {
  modelId: string;
  passRate: number;
  tokens: number;
  runs: number;
};

export type Telemetry = {
  lastNRuns: number;
  avgTokens: number;
  avgCost: number;
  passRate: number;
  avgToolCalls?: number;
  avgDurationSec?: number;
  lastUpdated: string;
};

export type SecurityReview = {
  injectionSurface: "low" | "medium" | "high";
  toolAllowList: string[];
  lastScanned: string;
  knownIssues: string[];
};

export type PackComparison = {
  slug: string;
  axis: ComparisonAxis;
  winner: "self" | "other" | "tie";
  note: string;
};

/**
 * Measured cost of rediscovering this pattern from scratch via
 * deep-research prompts. This is the baseline the pack saves.
 */
export type RediscoveryCost = {
  tokens: number;
  minutes: number;
  measuredAt: string;
  methodology: string;
};

export type ChangelogEntry = {
  version: string;
  date: string;
  added: string[];
  removed: string[];
  reason: string;
};

export type PackSource = {
  label: string;
  url: string;
  note: string;
};

/**
 * Accumulated scar tissue. Every mature check in the catalog exists because
 * someone got paged at 3am. Attach the failure class to the pack so a
 * junior consulting it gains the senior's instinct without the page.
 * Shared vocabulary with ChangeRow.failureModes (see docs/CHANGE_TRACE.md).
 */
export type FailureModeTier = "jr" | "mid" | "sr" | "staff";

export type FailureMode = {
  symptom: string;                    // "Service OK for 2h then OOM"
  trigger: string;                    // "Unbounded Map grew silently"
  preventionCheck: string;            // "Soak test 24h + mem watcher"
  tier: FailureModeTier;              // who learns this at what career stage
  relatedPacks?: string[];            // other catalog entries addressing this class
};

export type PackExample = {
  label: string;
  href: string;
  external?: boolean;
};

export type PackMetric = {
  label: string;
  value: string;
};

/**
 * E4 — consumers reverse index. Records that project X installed pack Y at
 * version V via target T. Surfaced on the pack detail page as
 * "Used in N projects: floorai, propertyai, …".
 *
 * Populated from aggregated lockfiles (Convex packConsumers table or a
 * file-backed fallback at `.attrition/consumers.json`). The schema field on
 * `Pack` is intentionally optional and never synthesized — `undefined` means
 * no data source, not "zero consumers".
 */
export type ConsumerProject = {
  projectId: string; // machine id, e.g. "floorai"
  project: string; // display label, e.g. "FloorAI"
  version: string; // pack version the consumer pinned
  installedAt: string; // ISO timestamp
  target: "claude-code" | "cursor";
};

/**
 * The full pack. Most fields are required at the Verified tier.
 * Community packs may omit telemetry/transferMatrix/securityReview
 * until measured by attrition.sh.
 */
export type Pack = {
  // --- core identity ---
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  packType: PackType;
  canonicalPattern: CanonicalPattern;
  version: string; // semver

  // --- discovery / trust ---
  trust: TrustTier;
  status: PackStatus;
  featured: boolean;
  publisher: string;
  gradient: string;
  artworkVariant?: PackArtworkVariant;
  updatedAt: string;
  compatibility: string[];
  tags: string[];

  // --- install surfaces ---
  installCommand: string; // e.g. "npx attrition-sh pack install advisor-pattern"
  claudeCodeSnippet: string; // AGENTS.md fragment
  rawMarkdownPath: string; // e.g. "/packs/advisor-pattern.md"

  // --- harness-specific (optional for non-harness types) ---
  contract?: PackContract;
  layers?: PackLayers;
  transferMatrix?: TransferMatrixEntry[];

  // --- body content ---
  useWhen: string[];
  avoidWhen: string[];
  keyOutcomes: string[];
  minimalInstructions: string;
  fullInstructions: string;
  evaluationChecklist: string[];
  failureModes: FailureMode[];

  // --- trust / proof ---
  telemetry?: Telemetry;
  securityReview?: SecurityReview;
  rediscoveryCost?: RediscoveryCost;

  // --- relationships ---
  relatedPacks: string[];
  requires: string[];
  conflictsWith: string[];
  supersedes: string[];
  comparesWith: PackComparison[];

  // --- history ---
  changelog: ChangelogEntry[];

  // --- distribution telemetry (gap J) ---
  // Cumulative install count, populated at render-time from file-backed or
  // Convex counter. Optional — packs never self-report this; the registry does.
  installCount?: number;

  // --- consumers reverse index (gap E4) ---
  // List of projects that installed this pack, populated at render-time from
  // file-backed or Convex source. Optional — `undefined` means "no data
  // source wired", not "zero consumers". Hydrated by the pack registry.
  consumers?: ConsumerProject[];

  // --- card-surface metrics ---
  metrics: PackMetric[];

  // --- references ---
  sources: PackSource[];
  examples: PackExample[];
};

export type PublisherProfile = {
  slug: string;
  name: string;
  initials: string;
  status: "Verified publisher" | "Community publisher";
  description: string;
  href: string;
  /**
   * E3 — publisher provenance. Optional signed manifest that cryptographically
   * asserts which packs this publisher has authored. When present, the registry
   * displays a verified-provenance badge. When absent, packs are accepted but
   * surface an "unsigned" badge. Never synthesized.
   */
  provenance?: PublisherProvenance;
};

/**
 * E3 — publisher-signing manifest. Minimal shape inspired by sigstore: a
 * fingerprint + signature over the list of packs the publisher claims, plus
 * a timestamp and the tool that issued it. Verification is out-of-scope for
 * this MVP (we surface the manifest presence on the UI); the next milestone
 * wires signature verification into the registry eval gate.
 */
export type PublisherProvenance = {
  /** SHA-256 fingerprint of the publisher's public key. */
  keyFingerprint: string;
  /** Ed25519 signature over the concatenated sorted slug list. */
  signature: string;
  /** ISO timestamp the manifest was signed. */
  signedAt: string;
  /** Pack slugs covered by this manifest. */
  packs: string[];
  /** Tool that generated the signature. */
  signedBy: string;
  /** Current verification state. "unverified" = parsed but not yet checked. */
  status: "verified" | "unverified" | "invalid";
};

/**
 * Type guard — narrows to packs that include harness-specific fields.
 */
export function isHarnessPack(
  pack: Pack
): pack is Pack & { contract: PackContract; layers: PackLayers } {
  return pack.packType === "harness" && !!pack.contract && !!pack.layers;
}
