import type { Pack } from "@/lib/pack-schema";

/**
 * Four Design Questions pack.
 *
 * The 2-minute entry-level reference. Derived from architecture.md
 * §Four Design Questions Every Coding Agent Must Answer in
 * VILA-Lab/Dive-into-Claude-Code (CC-BY-NC-SA-4.0, arXiv 2604.14228).
 *
 * Read this before any other dive-sourced pack. It re-frames the
 * whole catalog as answers to four recurring architectural questions,
 * and forces the reader to name their own answers before copying ours.
 */
export const fourDesignQuestions: Pack = {
  slug: "four-design-questions",
  name: "Four Design Questions",
  tagline: "The 2-minute orientation: every coding agent answers the same 4 questions.",
  summary:
    "A short reference pack that frames every coding-agent architecture as an answer to four recurring questions: where reasoning lives, how many execution engines, the default safety posture, and the binding resource constraint. Sourced from VILA-Lab's Dive into Claude Code (arXiv 2604.14228, CC-BY-NC-SA-4.0). Read this first — every other dive-sourced pack in the catalog is a zoom-in on one row of this table.",
  packType: "reference",
  canonicalPattern: "n/a",
  version: "0.1.0",

  trust: "Community",
  status: "Recommended",
  featured: true,
  publisher: "Agent Workspace",
  gradient: "from-sky-500 via-blue-500 to-cyan-600",
  updatedAt: "2026-04-19",
  compatibility: ["claude-code", "cursor", "codex"],
  tags: [
    "reference",
    "architecture",
    "entry-level",
    "design-questions",
    "harness",
    "dive-into-claude-code",
  ],

  installCommand: "npx attrition-sh pack install four-design-questions",
  claudeCodeSnippet:
    "Skill `four-design-questions` is installed at .claude/skills/four-design-questions/SKILL.md. Invoke at the start of any agent design review or before recommending another harness pack. Answer all four questions for the user's system before suggesting specific patterns or packs; cite this pack when the user has not yet named their binding resource constraint.",
  rawMarkdownPath: "/packs/four-design-questions/raw",

  useWhen: [
    "Onboarding a new engineer to agent-harness thinking — this is the 2-minute primer.",
    "Opening a design review for a new agent feature; answer all four before proposing an architecture.",
    "Auditing an existing agent that 'works but feels wrong' — usually one of the four has drifted.",
    "Before installing any other dive-sourced pack — this frames what question that pack is answering.",
  ],
  avoidWhen: [
    "You already have clear answers to all four questions written down and cited in your PRs.",
    "You need implementation detail — this is an orientation pack; pair with deeper packs for code.",
    "The task is a single tool call, not an agent — don't invoke architecture-level framing for a CRUD endpoint.",
  ],
  keyOutcomes: [
    "Your system has a one-line answer to each of the four questions, written in the design doc.",
    "The chosen safety posture is named (deny-first / container / rollback / approval-only) with its known failure modes.",
    "The binding resource constraint is named (context window / compute / explicit scratchpad) with a numeric ceiling.",
    "Reader knows which deeper pack in the catalog zooms into each answer.",
  ],

  minimalInstructions: `## The 4 questions, with Claude Code's answers

Read this table. Then write your own answer next to each row before proposing any architecture.

| Question | Claude Code's Answer | Alternatives |
|---|---|---|
| **Where does reasoning live?** | Model reasons; harness enforces. ~1.6% AI logic, 98.4% infrastructure. | LangGraph: explicit state graphs. Devin: multi-step planners. |
| **How many execution engines?** | One \`queryLoop\` for CLI, SDK, IDE. | Mode-specific engines per surface. |
| **What is the default safety posture?** | Deny-first: deny > ask > allow. Strictest rule wins. | Container isolation (SWE-Agent), git rollback (Aider). |
| **What is the binding resource constraint?** | ~200K-token context window. 5 compaction strategies run before every model call. | Compute budget, explicit scratchpad. |

If you can't answer one row, stop and pick the deeper pack that zooms into that row before writing code.`,

  fullInstructions: `## Full reference: the four design questions

Every coding-agent architecture — Claude Code, LangGraph, Devin, SWE-Agent, Aider, whatever you are building — answers the same four questions. The answers are not interchangeable. This pack is the 2-minute orientation; every other dive-sourced pack in the catalog is a zoom-in on one row.

### 1. Where does reasoning live?

**The question:** How much decision-making goes into the model, and how much into deterministic harness code?

**Claude Code's answer:** Roughly 1.6% of the codebase is AI decision logic; 98.4% is harness — permission gates, context management, tool routing, recovery logic. The agent loop is a simple while-loop. Engineering complexity lives around it.

**Alternatives:** LangGraph pins reasoning into explicit state graphs (developer controls flow, easier to debug, constrains the model). Devin uses multi-step planners and task trackers (more reliable for complex workflows, scaffolding becomes maintenance burden).

**Implications for your agent:**
- More capable models need less scaffolding — if you target Claude 4.6 / GPT-5, over-scaffolding becomes tech debt.
- Regulated domains (finance, healthcare) may justify explicit state graphs for auditability even at the cost of model headroom.
- If you find your harness code is <5% of your codebase, you are probably under-investing in determinism; expect flakiness.

### 2. How many execution engines?

**The question:** Do all interfaces (CLI, SDK, IDE) share one engine, or does each surface get its own?

**Claude Code's answer:** One \`queryLoop\` for every surface — interactive CLI, headless (\`claude -p\`), Agent SDK, IDE. \`QueryEngine\` is a conversation wrapper, not the engine itself.

**Alternatives:** Mode-specific engines per surface (common in products that bolt on an IDE after shipping a CLI; leads to behavior drift where the CLI does one thing and the IDE does another).

**Implications for your agent:**
- A single engine makes every regression reproducible on every surface. Diverging engines produce "works on CLI, broken in IDE" tickets.
- Shared engine forces shared permission, context, and recovery semantics — a feature, not a bug.
- If you already have two engines, treat consolidation as a top-3 backlog item; the drift cost compounds.

### 3. What is the default safety posture?

**The question:** How do you prevent the agent from doing harmful things by default?

**Claude Code's answer:** Deny-first. The order is deny > ask > allow. A broad deny always overrides a narrow allow. Seven independent safety layers stack on top — any one can block. Trust is never restored on resume.

**Alternatives:** Container isolation (SWE-Agent, OpenHands) — strong coarse boundary, everything inside the container is allowed. Git rollback (Aider) — lightweight, only protects file changes, doesn't stop network or shell side effects. Approval-only (basic chatbots) — simple but users approve 93% of prompts without reading.

**Implications for your agent:**
- Copying the posture without the layers that make it work is worse than picking a simpler posture. If you pick deny-first, you also need pre-filtering, classifier, sandboxing, and the six other layers — see \`seven-safety-layers\`.
- Container isolation looks like a shortcut but commits you to a rebuild every time a permission changes.
- Whichever posture you pick, name the failure mode. Deny-first fails on approval fatigue and shared-token-budget bypasses. Containers fail on egress. Rollback fails on non-file side effects.

### 4. What is the binding resource constraint?

**The question:** Which resource runs out first, and what shapes every architectural decision downstream?

**Claude Code's answer:** The context window. ~200K tokens (older models; up to 1M on 4.6 series). Five compaction strategies run sequentially before every model call — Budget Reduction → Snip → Microcompact → Context Collapse → Auto-Compact. Context is the *binding* constraint; lazy loading, deferred tool schemas, and subagent summary-only returns all exist because context is scarce.

**Alternatives:** Compute budget (when you're running a local model and tokens are cheap but GPU time is the bottleneck). Explicit scratchpad (when the harness externalizes state to disk and context is only the working set).

**Implications for your agent:**
- **Context budget is not compute budget.** Agents with a big compute budget and a small context window need compaction; agents with a big context window and a small compute budget need caching and parallelism. Do not confuse the two.
- Pick one binding constraint and design to it. If you pick context, every feature must answer "what does this cost in tokens per turn" before shipping.
- If your answer is "we don't have one yet," measure — a p95 turn token count and a session-peak token count are the minimum.

### How to use this pack in a design review

At the top of the design doc, write:

> **Our four answers:**
> 1. Reasoning lives in: [model / harness / explicit graph] — because [one line].
> 2. Execution engines: [one / N, and why].
> 3. Safety posture: [deny-first / container / rollback / approval] + known failure mode.
> 4. Binding constraint: [context window size / compute budget / scratchpad] — measured ceiling is [number].

If you cannot fill a row, the review is not ready. Send the author to the deeper pack for that row:
- Row 1 → \`agent-design-space-six-decisions\` or \`pattern-decision-tree\`
- Row 2 → \`turn-execution-pipeline\`
- Row 3 → \`seven-safety-layers\` and \`injection-surface-audit\`
- Row 4 → \`nine-context-sources\` or \`claude-code-guide\`

### Anti-patterns

- **Copying Claude Code's posture without its layers.** Deny-first without the seven-layer stack degrades into approval fatigue.
- **Two execution engines with no consolidation plan.** Drift compounds; every feature now costs 2×.
- **Treating context budget as compute budget.** You end up with a caching strategy when you needed compaction, or vice versa.
- **Writing the architecture diagram before answering these four.** Diagrams without stated constraints document a guess.

Sourced from VILA-Lab/Dive-into-Claude-Code (CC-BY-NC-SA-4.0, arXiv 2604.14228). Paraphrased with citation; Claude Code percentages and layer counts quoted from the paper's §Four Design Questions and §Key Highlights sections.`,

  evaluationChecklist: [
    "Design doc has a one-line answer to each of the four questions before implementation starts.",
    "The chosen safety posture's dominant failure mode is named alongside it.",
    "The binding resource constraint has a measured numeric ceiling, not a vibe.",
    "At least one deeper pack is linked per row for the engineers who own that layer.",
    "If 'we have two execution engines', a consolidation plan exists in the backlog with an owner.",
    "Reasoning-placement decision is re-visited on model upgrade — scaffolding stays proportionate to model capability.",
  ],
  failureModes: [
    {
      symptom: "Team picks an architectural pattern without naming which of the four questions it answers",
      trigger: "Design review opens with a diagram instead of a constraint; reviewers cannot challenge the unstated assumption",
      preventionCheck: "Require all four answers written at the top of the design doc before a diagram is reviewed",
      tier: "sr",
    },
    {
      symptom: "Deny-first posture adopted but approval fatigue and shared-token-budget bypasses land within a quarter",
      trigger: "Copied Claude Code's Q3 answer without copying the seven layers that make it functional",
      preventionCheck: "Pair this pack with seven-safety-layers; block merge if deny-first is selected but fewer than three independent safety layers exist",
      tier: "sr",
      relatedPacks: ["seven-safety-layers", "injection-surface-audit"],
    },
    {
      symptom: "Agent runs fine in dev, dies on a real user session with context overflow",
      trigger: "Team assumed context budget equals compute budget; never measured a session-peak token count",
      preventionCheck: "Require a measured ceiling for Q4 before launch — p95 turn tokens and session-peak tokens as release-blocking metrics",
      tier: "mid",
    },
  ],

  securityReview: {
    injectionSurface: "low",
    toolAllowList: [],
    lastScanned: "2026-04-19",
    knownIssues: [
      "This is a reference pack; it ships no runtime code and has no injection surface of its own.",
      "Derived from CC-BY-NC-SA-4.0 source; downstream uses must preserve attribution and the NC-SA terms for any verbatim excerpts.",
    ],
  },

  rediscoveryCost: {
    tokens: 22000,
    minutes: 45,
    measuredAt: "2026-04-19",
    methodology:
      "Prompted a fresh Claude Sonnet 4.6 with 'what are the recurring architectural questions every coding agent must answer, and how do Claude Code / LangGraph / Devin / SWE-Agent / Aider each answer them?'. Measured tokens until the output named reasoning placement, engine count, safety posture, and binding resource constraint with Claude Code's specific answers (1.6%/98.4% ratio, single queryLoop, deny-first with 7 layers, 200K context with 5 compaction stages). Averaged over 3 runs.",
  },

  relatedPacks: [
    "agent-design-space-six-decisions",
    "pattern-decision-tree",
    "claude-code-guide",
  ],
  requires: [],
  conflictsWith: [],
  supersedes: [],
  comparesWith: [
    {
      slug: "agent-design-space-six-decisions",
      axis: "complexity",
      winner: "self",
      note: "Four questions is the 2-minute orientation; six decisions is the 20-minute architect's framework. Start here, graduate there.",
    },
    {
      slug: "pattern-decision-tree",
      axis: "maintainability",
      winner: "other",
      note: "Pattern decision tree is broader — it picks between canonical workflow patterns. This pack is narrower — it frames harness-level design choices. Use pattern-decision-tree once you know your four answers.",
    },
  ],

  changelog: [
    {
      version: "0.1.0",
      date: "2026-04-19",
      added: [
        "Four-question table with Claude Code's answers and 2–3 alternatives per row",
        "Per-question implication block with concrete advice for the reader's own agent",
        "Design-review template at the end of fullInstructions",
        "Pointers to deeper packs per row",
      ],
      removed: [],
      reason: "Seed pack — first release. Entry-level orientation derived from VILA-Lab/Dive-into-Claude-Code architecture.md §Four Design Questions.",
    },
  ],

  metrics: [
    { label: "Questions covered", value: "4" },
    { label: "Read time", value: "~2 min" },
    { label: "Typical tokens saved", value: "22k" },
    { label: "Words in fullInstructions", value: "~800" },
  ],

  sources: [
    {
      label: "VILA-Lab — Dive into Claude Code (CC-BY-NC-SA-4.0)",
      url: "https://github.com/VILA-Lab/Dive-into-Claude-Code",
      note: "Primary source. Paraphrased with citation under CC-BY-NC-SA-4.0; verbatim excerpts preserve the NC-SA terms. Four Design Questions table lifted from architecture.md §Four Design Questions Every Coding Agent Must Answer.",
    },
    {
      label: "Dive into Claude Code — paper (arXiv 2604.14228)",
      url: "https://arxiv.org/abs/2604.14228",
      note: "Academic reference for the values → principles → implementation framework that grounds the four questions. Cite in downstream work.",
    },
    {
      label: "Dive into Claude Code — architecture.md",
      url: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/architecture.md",
      note: "Companion doc containing the four-question table and the 5-layer subsystem decomposition referenced for the 'binding constraint' row.",
    },
    {
      label: "Anthropic — Building Effective Agents",
      url: "https://www.anthropic.com/research/building-effective-agents",
      note: "Foundational Anthropic piece on simple composable patterns over heavy frameworks; grounds the reasoning-placement question at industry level.",
    },
  ],
  examples: [
    {
      label: "VILA-Lab/Dive-into-Claude-Code — architecture.md",
      href: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/architecture.md",
      external: true,
    },
    {
      label: "arXiv 2604.14228 — Dive into Claude Code",
      href: "https://arxiv.org/abs/2604.14228",
      external: true,
    },
  ],
};

export default fourDesignQuestions;
