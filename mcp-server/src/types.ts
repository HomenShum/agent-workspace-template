/**
 * Inline mirror of the canonical Pack type from the parent repo at
 * `src/lib/pack-schema.ts`.
 *
 * SYNC REQUIREMENT: This file must be manually kept in shape-parity with
 * `src/lib/pack-schema.ts`. The MCP server is published as a standalone
 * npm package (`attrition-mcp`) and deliberately does NOT import across
 * the package boundary. When the parent schema changes, update here too.
 *
 * Only the registry's public JSON surface is required — the `PackArtworkVariant`
 * import from the parent is replaced with a string alias here (the MCP
 * server never renders artwork, it only forwards the value).
 */

export type PackArtworkVariant = string;

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

export type PackContract = {
  requiredOutputs: string[];
  tokenBudget: number;
  permissions: string[];
  completionConditions: string[];
  outputPath: string;
};

export type PackLayers = {
  runtimeCharter: string;
  nlh: string;
  toolSpec: Array<{ name: string; signature: string; description: string }>;
};

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

export type PackExample = {
  label: string;
  href: string;
  external?: boolean;
};

export type PackMetric = {
  label: string;
  value: string;
};

export type Pack = {
  // --- core identity ---
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  packType: PackType;
  canonicalPattern: CanonicalPattern;
  version: string;

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
  installCommand: string;
  claudeCodeSnippet: string;
  rawMarkdownPath: string;

  // --- harness-specific ---
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
  failureModes: string[];

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
};

export type DirectoryFilter = {
  query?: string;
  packType?: PackType;
  canonicalPattern?: CanonicalPattern;
  trust?: TrustTier;
  limit?: number;
};

/**
 * Structured error envelope returned from every tool on failure.
 * Never thrown to the transport — always wrapped in content.
 */
export type McpError = {
  error: {
    code:
      | "EMPTY_QUERY"
      | "INVALID_SLUG"
      | "INVALID_SECTION"
      | "INVALID_INPUT"
      | "NOT_FOUND"
      | "TIMEOUT"
      | "PAYLOAD_TOO_LARGE"
      | "UPSTREAM_ERROR"
      | "NETWORK_ERROR";
    message: string;
  };
};
