import type { Pack } from "@/lib/pack-schema";
import { linearCommandPalette } from "./linear-command-palette";
import { shadcnDataTable } from "./shadcn-data-table";
import { ragHybridBm25Vector } from "./rag-hybrid-bm25-vector";
import { goldenEvalHarness } from "./golden-eval-harness";
import { patternDecisionTree } from "./pattern-decision-tree";
import { claudeCodeGuide } from "./claude-code-guide";
import { advisorPatternV2 } from "./advisor-pattern-v2";
import { injectionSurfaceAudit } from "./injection-surface-audit";

// Dive-into-Claude-Code sourced packs (arXiv 2604.14228, CC-BY-NC-SA-4.0).
// Authored 2026-04-19. See docs/PACK_PROPOSALS_FROM_DIVE.md for provenance.
import { fourDesignQuestions } from "./four-design-questions";
import { turnExecutionPipeline } from "./turn-execution-pipeline";
import { sevenSafetyLayers } from "./seven-safety-layers";
import { nineContextSources } from "./nine-context-sources";
import { subagentDelegationThreeIsolationModes } from "./subagent-delegation-three-isolation-modes";
import { extensibilityFourMechanisms } from "./extensibility-four-mechanisms";
import { sessionPersistenceThreeChannels } from "./session-persistence-three-channels";
import { agentDesignSpaceSixDecisions } from "./agent-design-space-six-decisions";
import { cvePreTrustWindow } from "./cve-pre-trust-window";

export {
  linearCommandPalette,
  shadcnDataTable,
  ragHybridBm25Vector,
  goldenEvalHarness,
  patternDecisionTree,
  claudeCodeGuide,
  advisorPatternV2,
  injectionSurfaceAudit,
  fourDesignQuestions,
  turnExecutionPipeline,
  sevenSafetyLayers,
  nineContextSources,
  subagentDelegationThreeIsolationModes,
  extensibilityFourMechanisms,
  sessionPersistenceThreeChannels,
  agentDesignSpaceSixDecisions,
  cvePreTrustWindow,
};

/**
 * Aggregate of all seed packs. Published order is deliberate:
 *   1. `fourDesignQuestions` — entry-point, featured, 2-minute orienting read
 *   2. Original breadth (UI → RAG → Eval → Reference → Harness → Security)
 *   3. Dive-sourced architecture packs (harness / reference / security)
 */
export const allSeededPacks: Pack[] = [
  fourDesignQuestions,
  linearCommandPalette,
  shadcnDataTable,
  ragHybridBm25Vector,
  goldenEvalHarness,
  patternDecisionTree,
  claudeCodeGuide,
  advisorPatternV2,
  injectionSurfaceAudit,
  turnExecutionPipeline,
  sevenSafetyLayers,
  nineContextSources,
  subagentDelegationThreeIsolationModes,
  extensibilityFourMechanisms,
  sessionPersistenceThreeChannels,
  agentDesignSpaceSixDecisions,
  cvePreTrustWindow,
];
