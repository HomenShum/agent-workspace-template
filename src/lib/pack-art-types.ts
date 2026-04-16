export type ArtworkVariant =
  | "directory"
  | "grounded-operator-rail"
  | "planner-workers-synthesizer"
  | "answer-packets-quality-gates"
  | "elicitation-first-operating-system"
  | "deterministic-plus-llm-hybrid"
  | "durable-streaming-events";

export type PackArtworkVariant = Exclude<ArtworkVariant, "directory">;
