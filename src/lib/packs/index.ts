import type { Pack } from "@/lib/pack-schema";
import { linearCommandPalette } from "./linear-command-palette";
import { shadcnDataTable } from "./shadcn-data-table";
import { ragHybridBm25Vector } from "./rag-hybrid-bm25-vector";
import { goldenEvalHarness } from "./golden-eval-harness";
import { patternDecisionTree } from "./pattern-decision-tree";
import { claudeCodeGuide } from "./claude-code-guide";
import { advisorPatternV2 } from "./advisor-pattern-v2";
import { injectionSurfaceAudit } from "./injection-surface-audit";

export {
  linearCommandPalette,
  shadcnDataTable,
  ragHybridBm25Vector,
  goldenEvalHarness,
  patternDecisionTree,
  claudeCodeGuide,
  advisorPatternV2,
  injectionSurfaceAudit,
};

/**
 * Aggregate of all seed packs (M5 breadth). Published order is
 * deliberate: UI → UI → RAG → Eval → Reference, to demonstrate that
 * the catalog covers more than just agent harnesses.
 */
export const allSeededPacks: Pack[] = [
  linearCommandPalette,
  shadcnDataTable,
  ragHybridBm25Vector,
  goldenEvalHarness,
  patternDecisionTree,
  claudeCodeGuide,
  advisorPatternV2,
  injectionSurfaceAudit,
];
