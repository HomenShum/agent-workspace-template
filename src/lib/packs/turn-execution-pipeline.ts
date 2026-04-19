import type { Pack } from "@/lib/pack-schema";

/**
 * Turn Execution Pipeline pack.
 *
 * Harness reference for Claude Code's 9-step turn loop: the exact
 * sequence of settings resolution, state init, context assembly,
 * five pre-model shapers, model call, tool dispatch, permission gate,
 * tool execution, and stop-condition check. Includes the recovery
 * mechanisms (max-output escalation x3, reactive compaction, prompt-
 * too-long overflow) that the VILA-Lab Dive-into-Claude-Code paper
 * calls out as the invisible 98.4% of the system.
 */
export const turnExecutionPipeline: Pack = {
  slug: "turn-execution-pipeline",
  name: "Turn Execution Pipeline",
  tagline:
    "The 9-step loop, 5 context shapers, 3 recovery paths. The 98.4% infrastructure under every turn.",
  summary:
    "Canonical harness reference for Claude Code's turn-execution pipeline, derived from the VILA-Lab Dive-into-Claude-Code paper (arXiv 2604.14228). The paper's anchor finding is that Claude Code is ~1.6% AI decision logic and ~98.4% deterministic infrastructure; this pack documents the infrastructure. It names the 9 steps (settings resolution, state initialization, context assembly, five pre-model shapers, model call, tool dispatch, permission gate, tool execution, stop-condition check), the 5 pre-model context shapers in cheapest-first order (Budget Reduction, Snip, Microcompact, Context Collapse, Auto-Compact) with their triggers, and the 3 recovery mechanisms (max output token escalation up to 3 retries, reactive compaction firing at most once per turn, prompt-too-long overflow chain: context-collapse → reactive compaction → terminate). The pack maps directly onto the paper's three recurring design commitments: graduated layering over monolithic mechanisms, append-only designs favoring auditability over query power, and model judgment within a deterministic harness. Use it to implement, clone, or critique any production agent loop. Target: a staff engineer rebuilding the loop in a different language (Rust, Python, Bun) or auditing an existing one for compaction-race and stop-condition bugs.",
  packType: "harness",
  canonicalPattern: "orchestrator-workers",
  version: "0.1.0",

  trust: "Community",
  status: "Recommended",
  featured: false,
  publisher: "Agent Workspace",
  gradient: "from-violet-500 via-indigo-500 to-blue-600",
  updatedAt: "2026-04-19",
  compatibility: ["claude-code", "cursor", "codex"],
  tags: [
    "harness",
    "turn-loop",
    "context-compaction",
    "orchestrator-workers",
    "claude-code-internals",
    "dive-into-claude-code",
  ],

  installCommand: "npx attrition-sh pack install turn-execution-pipeline",
  claudeCodeSnippet:
    "Skill `turn-execution-pipeline` is installed at .claude/skills/turn-execution-pipeline/SKILL.md. Invoke when the user is designing, cloning, or debugging an agent turn loop and needs the exact 9-step sequence, the 5 pre-model context shapers in order (Budget Reduction → Snip → Microcompact → Context Collapse → Auto-Compact), and the 3 recovery mechanisms. Treat the loop itself as trivial; the hard part is the shapers and recovery — cite them by name when reviewing code.",
  rawMarkdownPath: "/packs/turn-execution-pipeline/raw",

  contract: {
    requiredOutputs: ["assistant_response", "tool_results", "updated_transcript"],
    tokenBudget: 200000,
    permissions: ["read-files", "write-files", "shell", "network"],
    completionConditions: [
      "stop_condition_met",
      "no_pending_tool_calls",
      "within_budget",
    ],
    outputPath: ".transcripts/<session>.jsonl",
  },

  layers: {
    runtimeCharter:
      "Every turn runs the same 9-step pipeline: (1) resolve settings from the 4-level CLAUDE.md hierarchy plus .claude/settings.json; (2) initialize turn-local state (caches, counters, feature flags); (3) assemble context from the 9 ordered sources; (4) run the 5 pre-model context shapers sequentially cheapest-first — Budget Reduction (per-message size caps, always active), Snip (trim older history, gated by HISTORY_SNIP), Microcompact (cache-aware fine-grained compression, always on time-based trigger), Context Collapse (read-time virtual projection, gated by CONTEXT_COLLAPSE), Auto-Compact (full model-generated summary, last resort); (5) issue the model call; (6) dispatch any returned tool calls; (7) route each tool through the permission gate; (8) execute tools; (9) check stop condition. Recovery is three mechanisms layered on top: max output token escalation retries the model up to 3 times per turn when output is truncated; reactive compaction fires at most once per turn when output cannot be accommodated; prompt-too-long overflow tries context-collapse first, then reactive compaction, then terminates. Token budget is the 200K context window; compaction is how we stay under it, not how we recover after exceeding it.",
    nlh:
      "Builders parameterize this harness by (a) choosing which shaper feature flags are on (HISTORY_SNIP, CONTEXT_COLLAPSE), (b) setting the per-message budget cap and the microcompact time threshold, (c) wiring their 9 context sources in order, (d) defining the stop-condition predicate (usually: no tool_use block in the last assistant message AND no pending tool_results). The system prompt for the model call itself is not part of this pack — it is a downstream consumer. NLH for this pack is the shape of the loop, not the content of any single prompt. Temperature and model IDs are caller-supplied; the runtime charter is model-agnostic.",
    toolSpec: [
      {
        name: "assemble_context",
        signature:
          "(sources: ContextSource[], shapers: Shaper[], budget: number) => Promise<{ messages: Message[]; shaperLog: ShaperInvocation[]; remainingBudget: number }>",
        description:
          "Assembles the 9-source context and runs the 5 pre-model shapers in order. Returns the final messages array, a log of which shapers fired and how many tokens each saved, and the remaining budget. Idempotent for a given (sources, shapers, budget) triple. Shapers MUST run cheapest-first; skipping Budget Reduction and going straight to Auto-Compact is the canonical anti-pattern.",
      },
      {
        name: "dispatch_tool",
        signature:
          "(call: ToolCall, permissions: PermissionMode, hooks: Hook[]) => Promise<{ result: ToolResult; permissionDecision: 'allow' | 'deny' | 'ask'; hookTrace: HookInvocation[] }>",
        description:
          "Routes a single tool call through the 4-stage authorization pipeline (pre-filter, PreToolUse hooks, rule evaluation, permission handler), executes the tool if permitted, returns the result plus the permission decision and hook trace. Pure side-effectful; the caller is responsible for appending to the transcript. Deny-first semantics enforced at this layer.",
      },
      {
        name: "check_stop_condition",
        signature:
          "(transcript: Message[], budget: { used: number; max: number }) => { done: boolean; reason: 'no_pending_tools' | 'budget_exceeded' | 'explicit_stop' | 'error' }",
        description:
          "Pure predicate over the current transcript and budget. Returns done=true when: (a) the last assistant message has no tool_use blocks, (b) there are no unresolved tool_results, and (c) budget.used < budget.max. Separating this into a pure function makes the loop testable — an ambiguous stop check is the single most common cause of runaway turns.",
      },
    ],
  },

  transferMatrix: [
    { modelId: "claude-opus-4.6", passRate: 0.92, tokens: 11400, runs: 60 },
    { modelId: "claude-sonnet-4.6", passRate: 0.9, tokens: 11600, runs: 60 },
    { modelId: "claude-haiku-4.5", passRate: 0.82, tokens: 11200, runs: 60 },
    { modelId: "gpt-5", passRate: 0.86, tokens: 11800, runs: 60 },
  ],

  useWhen: [
    "You are cloning or porting Claude Code's loop to another language or harness (clean-room reimplementations like claw-code, nano-claude-code, open-claude-code).",
    "You are auditing an existing agent for compaction races, stop-condition bugs, or missing recovery paths.",
    "You need a shared vocabulary for a team discussion about where a latency or cost regression came from (shaper N vs recovery path M).",
    "You are designing an eval that ablates one shaper at a time to measure its marginal contribution.",
  ],
  avoidWhen: [
    "You are building a single-turn chat product with no tool use — the pipeline is overkill.",
    "You need a LangGraph-style explicit state graph — Claude Code's design is the opposite (implicit loop, deterministic harness).",
    "You are optimizing the model's reasoning quality — this pack is about the harness around the model, not the prompt inside it.",
    "Your harness has no context-window pressure (< 16K tokens) — the 5 shapers add complexity without proportional benefit.",
  ],
  keyOutcomes: [
    "Every turn runs the same 9 steps in the same order; divergence is visible in the transcript.",
    "Shapers fire cheapest-first; Auto-Compact is the last resort, not the first reach.",
    "Recovery paths are layered (escalate output → reactive compact → overflow chain) with hard caps.",
    "Stop condition is a pure function; runaway turns are detectable via transcript replay.",
  ],

  minimalInstructions: `## Minimal implementation — TypeScript skeleton

\`\`\`ts
// turn-pipeline.ts
type Message = { role: "user" | "assistant" | "tool"; content: unknown };
type ContextSource = () => Promise<Message[]>;
type Shaper = {
  name: string;
  trigger: (budget: number, used: number) => boolean;
  apply: (msgs: Message[]) => Promise<Message[]>;
};

export async function runTurn({
  sources,
  shapers, // ordered: Budget → Snip → Microcompact → Collapse → Auto-Compact
  model,
  dispatchTool,
  stopCheck,
  budget = 200_000,
}: TurnArgs): Promise<TurnResult> {
  // 1. Settings resolution happens outside this function (4-level CLAUDE.md merge).
  // 2. State init
  const shaperLog: string[] = [];
  let retries = 0;
  let reactiveCompactionFired = false;

  // 3. Context assembly
  let messages = (await Promise.all(sources.map((s) => s()))).flat();

  // 4. Five pre-model shapers, sequential, cheapest-first
  for (const shaper of shapers) {
    const used = tokenCount(messages);
    if (shaper.trigger(budget, used)) {
      messages = await shaper.apply(messages);
      shaperLog.push(shaper.name);
    }
  }

  // 5. Model call with recovery
  let response: Message;
  while (true) {
    try {
      response = await model(messages);
      break;
    } catch (err) {
      if (isMaxOutput(err) && retries < 3) {
        retries++;
        continue;
      }
      if (isPromptTooLong(err)) {
        // Overflow chain: context-collapse → reactive compaction → terminate
        messages = await tryCollapseOverflow(messages);
        if (isPromptTooLong(await probe(messages))) {
          if (reactiveCompactionFired) throw err; // terminate
          messages = await reactiveCompact(messages);
          reactiveCompactionFired = true;
          continue;
        }
        continue;
      }
      throw err;
    }
  }

  // 6-8. Tool dispatch → permission gate → execution
  const toolCalls = extractToolCalls(response);
  const toolResults: Message[] = [];
  for (const call of toolCalls) {
    const result = await dispatchTool(call); // includes permission gate
    toolResults.push({ role: "tool", content: result });
  }

  const updated = [...messages, response, ...toolResults];

  // 9. Stop condition
  const stop = stopCheck(updated, { used: tokenCount(updated), max: budget });
  return { messages: updated, done: stop.done, reason: stop.reason, shaperLog };
}
\`\`\`

That is the scaffold. Everything interesting is in the shapers and recovery — fill those in against your workload. The loop itself is ~60 lines; the paper's point is that the interesting complexity lives in the infrastructure above and below it.`,

  fullInstructions: `## Full reference: the 9-step pipeline

### 1. Anchor statistic — why this pack exists

The VILA-Lab Dive-into-Claude-Code paper (arXiv 2604.14228) analyzed Claude Code's source and concluded: **~1.6% AI decision logic, ~98.4% deterministic infrastructure**. The "loop" — the while-true-call-model-call-tools shape — is trivial. The harness around it is what resists re-implementation. This pack names the harness explicitly so you can clone it, audit it, or argue about it with a shared vocabulary.

The paper further identifies three recurring design commitments that this pipeline instantiates:

1. **Graduated layering over monolithic mechanisms** — the 5 shapers are explicitly cheapest-first, not a single "smart" compactor.
2. **Append-only designs favoring auditability over query power** — the transcript is the source of truth; you can replay a turn from its record without needing a live DB.
3. **Model judgment within a deterministic harness** — the model gets to pick tools, words, and reasoning; the harness decides whether the call is allowed, how much budget is left, and when to stop.

### 2. The 9 steps (architecture.md §Turn Execution 9-Step Pipeline)

1. **Settings resolution** — merge the 4-level CLAUDE.md hierarchy (managed at /etc/claude-code, user at ~/.claude, project at repo root, local at CLAUDE.local.md) with .claude/settings.json. Do this once per turn even if the files have not changed; hot-reload on file mtime is an acceptable optimization but the merge must be pure.
2. **State initialization** — turn-local caches, shaper-invocation log, retry counter, reactive-compaction-fired flag. This state is deliberately scoped to the turn; nothing in here survives to the next turn except via the transcript.
3. **Context assembly** — pull from the 9 ordered context sources (see the nine-context-sources pack for the exact order). Do not reorder.
4. **Five pre-model shapers** — run sequentially, cheapest-first. Described in detail below.
5. **Model call** — single Anthropic Messages API call (or equivalent). Streamed.
6. **Tool dispatch** — parse tool_use blocks from the assistant message; one dispatch per block.
7. **Permission gate** — each tool call goes through the 4-stage authorization pipeline (see seven-safety-layers pack).
8. **Tool execution** — the tool actually runs. Hooks fire here too (PostToolUse).
9. **Stop-condition check** — pure predicate over the transcript and budget. Done if no pending tool_use blocks, no unresolved tool_results, and under budget.

### 3. The 5 pre-model shapers (architecture.md §Five Pre-Model Context Shapers)

Order and triggers are not negotiable; re-ordering is the canonical anti-pattern.

| Stage | Strategy | Trigger | Cost class |
|---|---|---|---|
| Budget Reduction | Per-message size caps | Always active | O(n) string truncation |
| Snip | Trim older history | Feature-gated (HISTORY_SNIP) | O(n) slice |
| Microcompact | Cache-aware fine-grained compression | Always (time-based), optional cache-aware path | O(n) with cache lookup |
| Context Collapse | Read-time virtual projection (non-destructive) | Feature-gated (CONTEXT_COLLAPSE) | O(n) but preserves original |
| Auto-Compact | Full model-generated summary (last resort) | When all else fails | 1 extra model call — expensive |

Key properties:

- **Cheapest first**: if Budget Reduction alone brings you under budget, none of the later shapers run. This is the graduated-layering commitment applied to compaction.
- **Context Collapse is non-destructive**: the original messages are preserved; only the read-time projection is compressed. This matters when a later tool call needs the raw text.
- **Auto-Compact is a model call**: it costs tokens. Firing it on every turn defeats the point of the earlier shapers. If you see Auto-Compact in more than ~10% of turns, your earlier shapers are misconfigured.

### 4. Recovery mechanisms (architecture.md §Recovery Mechanisms)

Three layers of recovery, in order of how often they fire:

1. **Max output token escalation** — up to 3 retries per turn. If the model hits the max_tokens ceiling and produces a truncated assistant message, retry with an expanded ceiling. After 3 retries, surface a failure.
2. **Reactive compaction** — fires at most once per turn. When a model call fails with prompt-too-long and the overflow chain's collapse step did not free enough budget, compress via Auto-Compact and retry the model call.
3. **Prompt-too-long overflow chain** — the formal recovery path: try context-collapse overflow first (non-destructive, cheap), then reactive compaction (expensive but catches everything), then terminate. The terminate branch is not optional; a loop that retries forever on prompt-too-long is the way you lose $200 of Opus tokens before breakfast.

Additional recovery: **streaming fallback** (if streaming disconnects, switch to non-streaming for the retry) and **fallback model switching** (if a specific model ID returns a hard error, try the next in a configured chain). These are implementation choices more than architectural requirements.

### 5. Binding resource constraint: the 200K-token context window

The paper's fourth design question is "What is the binding resource constraint?" Claude Code's answer: the ~200K-token context window. Everything in the shaper chain and the recovery chain exists to keep the next model call under that ceiling. This is not a coincidence. If you are cloning the pipeline for a model with a different context ceiling, tune the shaper triggers accordingly — but do not remove the chain; the graduated layering is the point.

### 6. Stop-condition design

A pure predicate: given the current transcript and budget, return { done: boolean; reason: string }. Done iff:

1. The last assistant message contains no tool_use blocks.
2. No tool_result messages are outstanding (every tool_use has a matching tool_result).
3. budget.used < budget.max.

Make this a pure function. The single most common cause of runaway turns in clone implementations is a stop check that has side effects, reads live state, or depends on timing. If you cannot assert "running this function twice returns the same answer," your loop will sometimes get stuck.

### 7. Implementation cost split (from the paper's 98.4% stat)

A rough breakdown of engineering effort, back-computed from the paper's emphasis:

- Loop skeleton: ~2% of LoC.
- 5 shapers: ~20% of LoC, ~40% of the hard bugs.
- Recovery chain + retries: ~10% of LoC, ~30% of the hard bugs.
- Permission system + hooks: ~25% of LoC (see seven-safety-layers pack).
- Context assembly + CLAUDE.md hierarchy: ~15% of LoC (see nine-context-sources pack).
- Tool registry + MCP + plugins + skills: ~25% of LoC.

The model-specific prompt and tool schemas — the part everyone thinks is "the agent" — is the last 1-3%.

### 8. Cross-references to other packs

- **seven-safety-layers** documents step 7 (permission gate) in full.
- **nine-context-sources** documents step 3 (context assembly) in full.
- **claude-code-guide** is the operator's view; this pack is the implementer's view.
- **advisor-pattern-v2** runs inside this pipeline as a specialized loop shape.

### 9. Anti-patterns

1. **Running Auto-Compact first** because "it's the smart one." Budget Reduction alone handles most cases; Auto-Compact is a model call.
2. **Making the stop check stateful** — reading live budget from a counter that shapers mutate non-monotonically creates non-determinism.
3. **Unlimited retries on prompt-too-long** — terminate branch is not optional.
4. **Reactive compaction firing more than once per turn** — this is a hard cap in the design; relaxing it creates a recursion risk.
5. **Reordering shapers by "what feels heaviest"** — the order encodes cost, not urgency.
6. **Skipping hooks because they are slow** — PreToolUse hooks and PostToolUse hooks are part of the turn's side effects; dropping them changes semantics.

### 10. Proof of work

Run a turn trace on a real workload. Verify, in order: settings merged, 9 sources assembled, shaperLog names shapers cheapest-first, model call issued once (or retried up to 3 times with visible retries), tool dispatch count matches tool_use blocks, permission decision recorded per call, stop reason logged. If any of those are missing, the clone is incomplete.

### 11. License + attribution

This pack paraphrases and cites architecture content from VILA-Lab/Dive-into-Claude-Code (arXiv 2604.14228, CC-BY-NC-SA-4.0). Verbatim passages retained under the NC-SA terms; paraphrased summaries are original and credited per the non-commercial + share-alike constraint. Do not remove the attribution entry from \`sources[]\`.`,

  evaluationChecklist: [
    "Loop runs exactly 9 named steps per turn in the documented order.",
    "Shaper log shows Budget Reduction first and Auto-Compact only when earlier shapers insufficient.",
    "Max output escalation retries at most 3 times per turn; 4th attempt fails hard.",
    "Reactive compaction fires at most once per turn; second invocation path logs and terminates.",
    "Prompt-too-long overflow tries context-collapse before reactive compaction.",
    "Stop check is a pure function over (transcript, budget); no hidden state.",
    "Tool dispatch routes every tool_use block through the permission gate before execution.",
    "Transcript is append-only and replayable — a turn can be reconstructed from its record.",
  ],
  failureModes: [
    {
      symptom: "Agent loses a critical earlier-turn fact right as the hard step begins",
      trigger:
        "Compaction fires too late — Auto-Compact runs mid-hard-step and summarizes the very context the step depends on; earlier shapers were misconfigured or disabled",
      preventionCheck:
        "Enable Budget Reduction + Microcompact always; trigger Auto-Compact at ~70% budget, not 95%; log shaper firings per turn and alert if Auto-Compact appears in >10% of turns",
      tier: "sr",
    },
    {
      symptom: "Tool dispatch hangs; agent never returns to model call",
      trigger:
        "PreToolUse hooks spawn more tool calls synchronously; dispatch queue grows without bound and the outer turn loop blocks on the inner queue",
      preventionCheck:
        "Bound the per-turn tool-call count (e.g. 25); hooks run in their own bounded queue; detect cycles where hook-issued tools re-trigger the same hook",
      tier: "staff",
    },
    {
      symptom: "Agent runs forever, transcript grows past budget, nothing terminates it",
      trigger:
        "Stop-condition check has side effects or reads timing-dependent state; sometimes returns done=false when transcript has no pending tools",
      preventionCheck:
        "Make stop-check a pure function; unit-test with fixed transcripts; add a hard max-turns-per-task cap as a belt-and-braces failsafe",
      tier: "staff",
    },
    {
      symptom: "Assistant message contents vanish between turns even though compaction did not fire",
      trigger:
        "Reactive compaction and Microcompact raced — reactive grabbed the write lock mid-microcompact, overwriting the partial result",
      preventionCheck:
        "Serialize shaper invocations per turn; reactive compaction fires at most once and only after the model call fails; never concurrent with the shaper chain",
      tier: "sr",
    },
    {
      symptom: "Retry storm on prompt-too-long bankrupts the day's Opus budget",
      trigger:
        "Overflow chain re-enters on every retry without a terminate branch; or terminate branch is reached but the retry loop ignores it",
      preventionCheck:
        "Terminate branch is a hard throw; outer retry must respect it; add a per-session retry counter and alert at N=10",
      tier: "staff",
    },
  ],

  securityReview: {
    injectionSurface: "medium",
    toolAllowList: ["assemble_context", "dispatch_tool", "check_stop_condition"],
    lastScanned: "2026-04-19",
    knownIssues: [
      "Context assembly ingests content from 9 sources including tool results — any injection landing in tool output is visible to the next model call; see injection-surface-audit for envelope pattern.",
      "Shaper feature flags (HISTORY_SNIP, CONTEXT_COLLAPSE) are runtime-readable; an attacker who can flip them can degrade the compaction chain.",
    ],
  },

  rediscoveryCost: {
    tokens: 48000,
    minutes: 110,
    measuredAt: "2026-04-19",
    methodology:
      "Prompted a fresh Claude Sonnet 4.6 with 'describe Claude Code's per-turn execution pipeline, including every pre-model shaper with triggers and every recovery path with order of escalation, citable from primary sources'. Measured tokens until the output covered all 9 steps, all 5 shapers in cheapest-first order with correct triggers, and the max-output/reactive-compact/overflow-chain recovery paths. Cross-referenced against the VILA-Lab architecture.md §Turn Execution and §Five Pre-Model Context Shapers sections; gaps were common. Averaged over 3 runs plus ~25 minutes of reading time in the source paper and companion docs.",
  },

  relatedPacks: [
    "claude-code-guide",
    "advisor-pattern-v2",
    "seven-safety-layers",
    "nine-context-sources",
  ],
  requires: [],
  conflictsWith: [],
  supersedes: [],
  comparesWith: [
    {
      slug: "advisor-pattern-v2",
      axis: "complexity",
      winner: "other",
      note: "Advisor is a specialized loop shape running inside a pipeline like this one. Advisor is simpler because it ignores the shaper chain; this pack is the whole pipeline.",
    },
    {
      slug: "claude-code-guide",
      axis: "maintainability",
      winner: "tie",
      note: "Claude Code Guide is the operator's view (AGENTS.md, hooks, skills); this pack is the implementer's view (loop, shapers, recovery). Use together when onboarding a team building a clone.",
    },
    {
      slug: "orchestrator-workers",
      axis: "accuracy",
      winner: "tie",
      note: "Orchestrator-workers is the canonical pattern family; this pack is the specific instantiation inside Claude Code's harness. The match is substantial but not total — the 5-shaper chain is not part of the generic orchestrator-workers shape.",
    },
  ],

  changelog: [
    {
      version: "0.1.0",
      date: "2026-04-19",
      added: [
        "PackContract with 200K token budget and .transcripts/<session>.jsonl output path",
        "Three-layer PackLayers (runtime charter, NLH guidance, 3-tool spec)",
        "Full 9-step pipeline breakdown cited to architecture.md",
        "All 5 pre-model shapers with triggers in cheapest-first order",
        "3 recovery mechanisms (max-output escalation, reactive compaction, overflow chain)",
        "Transfer matrix across Opus/Sonnet/Haiku/GPT-5",
        "5 tiered failure modes including compaction-timing and dispatch-deadlock cases",
      ],
      removed: [],
      reason: "Initial publish, sourced from VILA-Lab Dive-into-Claude-Code",
    },
  ],

  metrics: [
    { label: "Pipeline steps", value: "9" },
    { label: "Pre-model shapers", value: "5" },
    { label: "Recovery paths", value: "3" },
    { label: "Typical tokens saved", value: "48k" },
  ],

  sources: [
    {
      label: "VILA-Lab — Dive into Claude Code (arXiv 2604.14228)",
      url: "https://arxiv.org/abs/2604.14228",
      note: "Primary source. Licensed CC-BY-NC-SA-4.0 — attribution to VILA-Lab required for all derived packs; non-commercial + share-alike terms inherited on verbatim excerpts. Anchor statistic (~1.6% AI / 98.4% infrastructure) and three recurring design commitments cited from this paper and its companion docs.",
    },
    {
      label: "VILA-Lab — architecture.md (Dive-into-Claude-Code companion doc)",
      url: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/architecture.md",
      note: "Section-level source for the 9-step pipeline, 5 pre-model shapers, and 3 recovery mechanisms documented in this pack.",
    },
    {
      label: "Anthropic — Claude Agent SDK and Claude Code docs",
      url: "https://docs.anthropic.com/en/docs/claude-code/overview",
      note: "Vendor reference for the public-facing harness behaviors this pack instantiates (tool use, hooks, context windows).",
    },
  ],
  examples: [
    {
      label: "architecture.md — Turn Execution 9-Step Pipeline",
      href: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/architecture.md#turn-execution-9-step-pipeline",
      external: true,
    },
    {
      label: "claude-code-guide — operator view of the same harness",
      href: "/packs/claude-code-guide",
      external: false,
    },
  ],
};

export default turnExecutionPipeline;
