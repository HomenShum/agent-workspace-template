export type ArtworkVariant =
  | "directory"
  | "operator-chat-rail"
  | "planning-and-worker-flow"
  | "answer-review-and-quality-checks"
  | "workflow-elicitation"
  | "hybrid-runtime"
  | "durable-streaming";

export type PackArtworkVariant = Exclude<ArtworkVariant, "directory">;
