import type { Pack } from "@/lib/pack-schema";

/**
 * Pattern Decision Tree pack.
 *
 * A meta-pack about picking packs. Given a constraint (cost, latency,
 * accuracy, complexity tolerance), which canonical pattern fits?
 * Maps constraints → prompt-chaining / routing / parallelization /
 * orchestrator-workers / evaluator-optimizer.
 */
export const patternDecisionTree: Pack = {
  slug: "pattern-decision-tree",
  name: "Pattern Decision Tree",
  tagline: "Which canonical pattern? A constraint-first tree.",
  summary:
    "A reference pack that helps you pick a canonical agent pattern given your hard constraint. Starts from cost / latency / accuracy / complexity tolerance and walks to prompt-chaining, routing, parallelization, orchestrator-workers, or evaluator-optimizer. Grounded in Anthropic's 'Building effective agents', the Tongyi NLA paper, and Stanford's meta-harness work.",
  packType: "reference",
  canonicalPattern: "n/a",
  version: "0.1.0",

  trust: "Community",
  status: "Recommended",
  featured: false,
  publisher: "Agent Workspace",
  gradient: "from-lime-400 via-green-500 to-teal-600",
  updatedAt: "2026-04-16",
  compatibility: ["claude-code", "cursor"],
  tags: ["reference", "decision-tree", "canonical-patterns", "meta", "architecture"],

  installCommand: "npx attrition-sh pack install pattern-decision-tree",
  claudeCodeSnippet:
    "Skill `pattern-decision-tree` is installed at .claude/skills/pattern-decision-tree/SKILL.md. Invoke when the user is choosing between agent architectures, asking 'should I use X or Y pattern', or scoping a new agent feature. Walk the constraint-first tree below before recommending a pack; cite the specific branch you chose.",
  rawMarkdownPath: "/packs/pattern-decision-tree/raw",

  useWhen: [
    "Starting a new agent feature and unsure which pattern fits.",
    "Auditing an existing agent that feels overcomplicated or underpowered.",
    "Choosing between two candidate architectures with a real tradeoff.",
    "Onboarding a new engineer who needs the pattern vocabulary in one place.",
  ],
  avoidWhen: [
    "You already have a working pattern and measurable quality — don't re-architect on vibes.",
    "You're early prototyping — ship a single prompt first, add structure when it fails.",
    "The task is a pure tool call — don't dress up 'call API, return result' as an agent.",
    "You lack any eval — pick any pattern and iterate; this tree helps only if you can measure.",
  ],
  keyOutcomes: [
    "A defensible pattern choice with a recorded constraint (why this branch, not that one).",
    "Links to the specific canonical pack that implements the chosen pattern.",
    "Explicit acknowledgement of which patterns were considered and rejected, with the reason.",
    "A budget (tokens, latency, cost) associated with the chosen pattern up front.",
  ],

  minimalInstructions: `## Quick pick

Name your **one** hardest constraint. Then pick:

| Constraint | Pick | Pack |
|---|---|---|
| p95 latency <1s | **Routing** | \`routing-by-intent\` |
| Budget <$0.005/request | **Routing** (cheap-first), **Prompt-chaining** (Haiku legs) | \`routing-by-intent\`, \`advisor-pattern\` |
| Accuracy must be >95% | **Evaluator-optimizer** | \`evaluator-optimizer-gan\`, \`golden-eval-harness\` |
| Task decomposes into 2–5 fixed steps | **Prompt-chaining** | \`advisor-pattern\` |
| Task has N independent sub-queries | **Parallelization** | \`parallel-map-reduce\` |
| Task requires dynamic subtask planning | **Orchestrator-workers** | \`orchestrator-workers\` |
| Mixed (some easy, some hard) | **Routing** → specialised patterns | \`routing-by-intent\` |

If two constraints tie, pick the one the user will notice first (usually latency or correctness over cost).`,

  fullInstructions: `## Full reference: a constraint-first decision tree

### 1. Frame the problem in one sentence

Write this down before picking anything:

> *"Given <inputs>, produce <required outputs> within <budget> at <accuracy bar>."*

If you can't fill all four blanks, stop and go define them. Pattern choice without a constraint is architecture-astronauting.

### 2. The constraint axes

Every agent design lives in a four-dimensional constraint space. Rank them in order; only the top-1 or top-2 matter.

| Axis | Typical symptom | Dominant pattern |
|---|---|---|
| **Latency** | User-facing UI, streaming chat, p95 budget <2s | Routing, single-shot, caching |
| **Cost** | High volume (>10k req/day), margin-sensitive | Routing (cheap-first), model stepping |
| **Accuracy** | Must not hallucinate; ≥95% bar | Evaluator-optimizer, rerank, human-in-loop |
| **Complexity** | Task spans tools, pages, time | Orchestrator-workers, prompt-chaining |

### 3. The tree

\`\`\`
START
  │
  ├─ Is the task a single well-defined call?
  │    └─ YES → Do NOT build an agent. Call the tool directly. Stop.
  │
  ├─ Is top constraint LATENCY (<2s p95)?
  │    ├─ Multiple task types, some cheap? → ROUTING  (cheap fast, expensive slow)
  │    └─ One task, just needs to be fast? → SINGLE-SHOT with strong prompt + cache
  │
  ├─ Is top constraint COST (per-request <$0.01)?
  │    ├─ Mixed difficulty?             → ROUTING  (Haiku first, escalate)
  │    └─ Multi-step but each is small? → PROMPT-CHAINING with Haiku legs
  │
  ├─ Is top constraint ACCURACY (>95% required)?
  │    ├─ Have a golden set & rubric?    → EVALUATOR-OPTIMIZER  (candidate + judge loop)
  │    └─ No golden set yet              → STOP. Build one first. Then re-enter.
  │
  ├─ Is top constraint COMPLEXITY?
  │    ├─ Fixed N steps, known in advance?   → PROMPT-CHAINING
  │    ├─ N independent sub-queries?         → PARALLELIZATION (map-reduce)
  │    └─ Dynamic subtasks, depends on data? → ORCHESTRATOR-WORKERS
  │
  └─ Multiple constraints tie?
       └─ Pick the one the user will notice first. Usually:
            user-facing  → latency
            analytics    → cost
            agentic      → accuracy
\`\`\`

### 4. Canonical patterns — 1-line definitions

Sourced from Anthropic's *Building effective agents* (Dec 2024) and aligned across the Tongyi NLA and Stanford meta-harness work.

- **Prompt-chaining** — fixed sequence of LLM calls, each step's output feeds the next. Use when you know the sub-steps.
- **Routing** — classifier picks which specialised prompt/model to hand off to. Use to save cost/latency on mixed task types.
- **Parallelization** — run N sub-tasks concurrently, then combine. Includes map-reduce and ensemble voting.
- **Orchestrator-workers** — a planner LLM spawns subtask LLMs dynamically. Use when the decomposition depends on the input.
- **Evaluator-optimizer** — candidate produces an output; evaluator judges; retry until it passes. Use when you can cheaply score outputs and can't tolerate misses.
- **Hybrid** — any composition of the above (e.g. router → orchestrator-workers → evaluator-optimizer).

### 5. Cost & latency envelopes (rough, order-of-magnitude)

| Pattern | Tokens per request | Latency p95 | Best when |
|---|---|---|---|
| Single-shot | 1× | ~1s | Simple, uniform tasks |
| Prompt-chaining (3 steps) | 3× | ~3s | Fixed pipeline |
| Routing | 1.1× (classifier + one leg) | 0.5–2s | Mixed difficulty |
| Parallelization (N=5) | 5× | ~1.5s (max leg) | Independent sub-tasks |
| Orchestrator-workers | 5–20× | 5–30s | Dynamic plans |
| Evaluator-optimizer (avg 1.5 retries) | 3–5× | 2–8s | Accuracy-critical |

### 6. Anti-patterns

- **Orchestrator-workers on fixed 3-step pipelines** → over-engineered; use prompt-chaining.
- **Evaluator-optimizer without a golden set** → the judge is unvalidated; you're measuring noise.
- **Routing with a too-expensive classifier** → classifier cost exceeds the savings. Classifier must be ≤1/4 of the cheap leg's cost.
- **Parallelization where sub-tasks share state** → you need orchestrator-workers instead; parallel assumes independence.
- **Single-shot when constraint is accuracy** → you can't hit >95% without a loop or a rerank.

### 7. Working example: "summarise this PDF with citations"

- Constraint rank: accuracy > cost > latency.
- Task decomposition: (1) chunk PDF, (2) retrieve relevant chunks, (3) generate summary with inline citations.
- Sub-task (2) is independent per chunk → **parallelization**.
- Sub-task (3) needs citation correctness → **evaluator-optimizer** wrapping the generator.
- Overall: **hybrid** — parallel retrieve → evaluator-optimizer generate. Pack recommendation: \`rag-hybrid-bm25-vector\` for retrieval + \`evaluator-optimizer-gan\` for the generator loop + \`golden-eval-harness\` for the CI gate.

### 8. When the tree says "don't build it"

If you land at "call the tool directly; stop" — that's a correct answer. Most "agent" features are better served by a direct API call and a good error message. Build an agent when the task is genuinely open-ended or branching; don't dress up procedural code as an agent to seem modern.

### 9. How to cite your choice in a PR

Include a block like:

> **Pattern:** routing → evaluator-optimizer.
> **Top constraint:** accuracy (>97% required).
> **Rejected:** single-shot (can't hit bar), orchestrator-workers (overkill; task is fixed-shape).
> **Budget:** 6k tokens, 3s p95, $0.012/request.
> **Pack:** \`evaluator-optimizer-gan\` for the loop; \`routing-by-intent\` for the upstream classifier.

This one paragraph has saved more re-architecture than any diagram.`,

  evaluationChecklist: [
    "A single top-constraint is named before any pattern is chosen.",
    "The chosen pattern's typical token / latency envelope matches the stated budget.",
    "At least one other pattern is listed as 'rejected' with a one-line reason.",
    "The PR / design doc links to the concrete pack implementing the chosen pattern.",
    "Any 'orchestrator-workers' or 'evaluator-optimizer' choice has a cost ceiling documented.",
    "No agent is built where a direct tool call would suffice.",
  ],
  failureModes: [
    {
      symptom: "Team agreed on pattern X but the code that shipped uses pattern Y",
      trigger: "Stated constraint (e.g. 'accuracy') silently shifted mid-sprint to 'ship fast'",
      preventionCheck: "Pin the constraint in the PR description; require a new PR to change it",
      tier: "staff",
    },
    {
      symptom: "Simple prompt-chaining flows get called 'orchestrator-workers' in docs",
      trigger: "Pattern-name inflation — terms used without their defining trigger",
      preventionCheck: "Require the trigger ('dynamic subtasks depending on input') to be named explicitly",
      tier: "sr",
    },
    {
      symptom: "Evaluator-optimizer shipped but the judge has never been verified",
      trigger: "Judge added without its own validation step",
      preventionCheck: "Require a judge smoke test before merging",
      tier: "sr",
      relatedPacks: ["golden-eval-harness"],
    },
  ],

  securityReview: {
    injectionSurface: "low",
    toolAllowList: [],
    lastScanned: "2026-04-16",
    knownIssues: [],
  },

  rediscoveryCost: {
    tokens: 30000,
    minutes: 60,
    measuredAt: "2026-04-16",
    methodology:
      "Prompted a fresh Claude Sonnet 4.6 with 'which canonical agent pattern should I use given constraints X and Y?'. Measured tokens until the output correctly distinguished prompt-chaining / routing / parallelization / orchestrator-workers / evaluator-optimizer with the right trigger conditions for each. Averaged over 3 runs.",
  },

  relatedPacks: [
    "advisor-pattern",
    "routing-by-intent",
    "parallel-map-reduce",
    "orchestrator-workers",
    "evaluator-optimizer-gan",
    "golden-eval-harness",
    "rag-hybrid-bm25-vector",
    "linear-command-palette",
    "shadcn-data-table",
  ],
  requires: [],
  conflictsWith: [],
  supersedes: [],
  comparesWith: [
    {
      slug: "pattern-cheatsheet-poster",
      axis: "complexity",
      winner: "self",
      note: "Tree enforces a constraint-first choice; a flat cheatsheet leaves the user to pick via vibes.",
    },
  ],

  changelog: [
    {
      version: "0.1.0",
      date: "2026-04-16",
      added: [
        "Initial pack with constraint-first decision tree",
        "Cost / latency envelope table per pattern",
        "Anti-pattern list and worked example",
      ],
      removed: [],
      reason: "Seed pack — first release.",
    },
  ],

  metrics: [
    { label: "Patterns covered", value: "6" },
    { label: "Typical tokens saved", value: "30k" },
    { label: "Decision time", value: "~5 min" },
  ],

  sources: [
    {
      label: "Anthropic — Building effective agents",
      url: "https://www.anthropic.com/research/building-effective-agents",
      note: "Primary source for the five canonical workflows (prompt-chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer).",
    },
    {
      label: "Anthropic — Effective agents cookbook",
      url: "https://github.com/anthropics/anthropic-cookbook/tree/main/patterns/agents",
      note: "Runnable reference implementations of each canonical pattern.",
    },
    {
      label: "Qwen / Tongyi — Natural Language Agents",
      url: "https://arxiv.org/abs/2402.18679",
      note: "NLA paper formalising the contract/charter/tool-spec layering that lets this tree recommend packs with real execution budgets.",
    },
    {
      label: "Stanford — Meta-Harness for Agent Evaluation",
      url: "https://arxiv.org/abs/2402.03820",
      note: "Academic framing for comparing harnesses along accuracy/cost/latency axes — basis for the envelope table.",
    },
  ],
  examples: [
    {
      label: "Anthropic cookbook — pattern recipes",
      href: "https://github.com/anthropics/anthropic-cookbook/tree/main/patterns/agents",
      external: true,
    },
    {
      label: "Building effective agents (blog)",
      href: "https://www.anthropic.com/research/building-effective-agents",
      external: true,
    },
  ],
};

export default patternDecisionTree;
