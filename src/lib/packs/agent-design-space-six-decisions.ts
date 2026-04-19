import type { Pack } from "@/lib/pack-schema";

/**
 * Agent Design Space — Six Decisions pack.
 *
 * The architect's framework. Primary source:
 * VILA-Lab/Dive-into-Claude-Code docs/build-your-own-agent.md — all 6
 * decisions + the Meta-Pattern of three recurring commitments
 * (graduated layering, append-only, model-judgment + deterministic
 * harness). CC-BY-NC-SA-4.0, arXiv 2604.14228.
 *
 * This is the pack about picking packs. A builder answers these six
 * questions for their own system before the catalog can recommend
 * specific patterns. Pair with `four-design-questions` (shorter
 * orientation) and `pattern-decision-tree` (pattern-level choice).
 */
export const agentDesignSpaceSixDecisions: Pack = {
  slug: "agent-design-space-six-decisions",
  name: "Agent Design Space — Six Decisions",
  tagline: "The architect's framework: answer these six before picking a pattern.",
  summary:
    "A reference pack that walks builders through the six recurring design decisions every production coding agent must answer: reasoning placement, safety posture, context management, extensibility, subagent architecture, and session persistence. Each decision pairs Claude Code's answer with realistic alternatives from LangGraph, Devin, SWE-Agent, OpenHands, and Aider, then closes with a Meta-Pattern of three commitments (graduated layering, append-only, model-judgment + deterministic harness). Frame this as 'the pack about picking packs' — answer all six first, then let the catalog serve specific patterns that match your posture. Sourced from VILA-Lab/Dive-into-Claude-Code build-your-own-agent.md (arXiv 2604.14228, CC-BY-NC-SA-4.0).",
  packType: "reference",
  canonicalPattern: "n/a",
  version: "0.1.0",

  trust: "Community",
  status: "Recommended",
  featured: false,
  publisher: "Agent Workspace",
  gradient: "from-fuchsia-500 via-purple-500 to-indigo-600",
  updatedAt: "2026-04-19",
  compatibility: ["claude-code", "cursor", "codex"],
  tags: [
    "reference",
    "architecture",
    "design-space",
    "decision-framework",
    "harness",
    "meta-pattern",
    "dive-into-claude-code",
  ],

  installCommand: "npx attrition-sh pack install agent-design-space-six-decisions",
  claudeCodeSnippet:
    "Skill `agent-design-space-six-decisions` is installed at .claude/skills/agent-design-space-six-decisions/SKILL.md. Invoke at the start of any agent architecture review, RFP, or when the team is about to commit to a harness shape. Walk all six decisions with the user before recommending other packs; each later pack should cite which of the six decisions it implements. Escalate to the Meta-Pattern section when the team is tempted to rebuild Claude Code — they almost always miss the three recurring commitments.",
  rawMarkdownPath: "/packs/agent-design-space-six-decisions/raw",

  useWhen: [
    "Opening a new agent-system architecture review or RFP.",
    "The team is debating which canonical harness to copy (Claude Code? LangGraph? Devin?). Walk the six decisions first.",
    "Auditing an existing agent that works but feels overcomplicated — usually one or two decisions drifted without being restated.",
    "A staff engineer wants to rebuild Claude Code — route them through the Meta-Pattern first; most skip the three commitments.",
    "Before installing any other dive-sourced harness pack — this frames which decision that pack implements.",
  ],
  avoidWhen: [
    "You need the 2-minute orientation instead of the 20-minute architect's framework — use `four-design-questions` first.",
    "You need the pattern-level choice (prompt-chaining vs routing vs evaluator-optimizer) — use `pattern-decision-tree`.",
    "You are still prototyping a single prompt — don't invoke architecture-level framing before you have a failing single-shot.",
    "The system is a CRUD tool call dressed up as 'an agent' — the answer is 'don't build an agent'.",
  ],
  keyOutcomes: [
    "Design doc has one-paragraph answers to all six decisions, each linked to the concrete pack that implements it.",
    "Each later pack added to the system cites which decision it answers.",
    "The Meta-Pattern's three commitments are explicitly accepted or explicitly declined with a reason.",
    "Team has a shared vocabulary for 'graduated layering', 'append-only', and 'model-judgment within a deterministic harness'.",
    "Mid-sprint drift on any of the six decisions is caught by PR review, not by an outage.",
  ],

  minimalInstructions: `## The 6 decisions, quick form

Answer each. The answer is a one-liner plus the pack that implements it.

1. **Where does reasoning live?** — model vs harness split. Claude Code: ~1.6% model / 98.4% harness.
2. **What is your safety posture?** — deny-first (Claude Code, 7 layers) / container (SWE-Agent, OpenHands) / rollback (Aider) / approval-only (chatbots).
3. **How do you manage context?** — 5-shaper graduated pipeline (Claude Code) / simple truncation / sliding window / RAG / single summarization.
4. **How do you handle extensibility?** — hooks (zero cost) + skills (low) + plugins (medium) + MCP (high) four-mechanism stack (Claude Code) vs a plugin monoculture.
5. **How do subagents work?** — shared context (cheap, fills fast) / isolated context + summary return (Claude Code, ~7× tokens) / message-passing actors.
6. **How do sessions persist?** — append-only JSONL (Claude Code) / database / stateless.

Then commit to the **Meta-Pattern**: (a) graduated layering over monolithic mechanisms, (b) append-only over query-optimized, (c) model judgment within a deterministic harness. If you reject any of the three, state why.`,

  fullInstructions: `## Full reference: the six design decisions

This pack is the architect's framework. Every production coding agent must answer the six questions below. Claude Code is one set of answers. LangGraph, Devin, SWE-Agent, OpenHands, and Aider are alternative answers. Your system is another — but your answers must be explicit, or you will discover them by outage.

Derived from VILA-Lab/Dive-into-Claude-Code build-your-own-agent.md (CC-BY-NC-SA-4.0, arXiv 2604.14228). Paraphrased with citation; specific numbers and layer counts are quoted from the paper.

### Decision 1: Where does reasoning live?

**The question:** How much decision-making is in the model vs. in your harness code?

| Approach | Example | Trade-off |
|---|---|---|
| Minimal scaffolding | Claude Code (~1.6% AI logic, 98.4% infrastructure) | Model has maximum latitude; harness enforces boundaries. Bets on model capability improving over time. |
| Explicit state graphs | LangGraph | Developer controls flow; easier to debug and predict. Constrains the model and requires updating as capabilities improve. |
| Heavy planning scaffolding | Devin | Multi-step planners + task trackers. More reliable for complex workflows; the scaffolding itself becomes maintenance burden. |

**Key insight (paper):** As frontier models converge in capability (top 3 within 1% on SWE-bench), the *operational harness* becomes the differentiator, not the model or the scaffolding. Investing in deterministic infrastructure (context management, safety, recovery) may yield greater reliability than adding planning constraints.

**Questions to ask yourself:**
- How capable is the model you're targeting? More capable models need less scaffolding.
- How predictable must your workflows be? Regulated domains may need explicit graphs.
- How fast is model capability improving? Heavy scaffolding becomes tech debt if models outgrow it.

### Decision 2: What is your safety posture?

**The question:** How do you prevent the agent from doing harmful things?

| Approach | Example | Trade-off |
|---|---|---|
| Deny-first with layered enforcement | Claude Code (7 independent layers) | Very safe; can create approval fatigue (93% of prompts approved without review). Requires graduated trust mechanisms. |
| Container isolation | SWE-Agent, OpenHands (Docker) | Strong boundary, coarse-grained. Everything inside container is allowed; nothing outside reachable. |
| VCS rollback | Aider (git-based) | Lightweight; only protects against file changes. Doesn't prevent network requests, data exfiltration, or shell side effects. |
| Approval-only | Basic chatbots | Simple; behaviorally unreliable at scale. Users stop reading prompts. |

**Key insight (paper):** Defense-in-depth only works when safety layers have *independent failure modes*. Claude Code's layers share an economic constraint (token costs) — commands exceeding 50 subcommands bypass security analysis entirely because per-subcommand parsing would starve the event loop. Design your layers to fail independently.

**On approval fatigue:** Users approve 93% of permission prompts. The fix is not more warnings but restructured boundaries — sandboxing and classifiers that create safe zones for autonomous operation.

**Questions to ask yourself:**
- What is the worst thing your agent could do? (Delete production data? Send emails? Exfiltrate code?)
- Can sandboxing reduce the number of decisions users must make?
- Do your safety layers share failure modes (e.g., all depend on token budget)?

### Decision 3: How do you manage context?

**The question:** The context window is finite. How do you decide what the model sees?

| Approach | Example | Trade-off |
|---|---|---|
| Graduated compaction pipeline | Claude Code (5 layers) | Preserves most information for longest time. Complex to implement and debug. Compression invisible to users. |
| Simple truncation | Many basic agents | Easy. Loses potentially critical early context. |
| Sliding window | Some chat apps | Predictable. No semantic awareness of what matters. |
| RAG (retrieval-augmented) | Some IDE integrations | Can access entire codebase. Retrieval quality is a bottleneck, chunks may lack surrounding context. |
| Single summarization | Some agents | One summary pass. A single compression can lose critical details. |

**Key insight (paper):** Context is the *binding constraint* that shapes nearly every other architectural decision. Lazy loading, deferred tool schemas, summary-only subagent returns, and per-tool-result budgets all exist because context is scarce. Design for context scarcity from day one.

**The graduated approach:** Apply the least disruptive compression first. Budget Reduction (cheap) → History trim / Snip (cheap) → Microcompact (cache-aware, medium) → Context Collapse (virtual projection, medium) → Auto-Compact (full model summary, expensive last resort).

**Questions to ask yourself:**
- What is your context window size? This determines how aggressive your compression needs to be.
- Do you need to support long sessions (hours of work)? Single-pass truncation won't survive.
- Can you separate 'guidance' context (instructions) from 'working' context (conversation)?

**Warning:** Answering Decision 3 without a measured token-budget ceiling is guessing. Pair with \`nine-context-sources\` for the order, \`turn-execution-pipeline\` for where the shapers run.

### Decision 4: How do you handle extensibility?

**The question:** How do external tools, custom instructions, and user customizations plug into your system?

| Approach | Example | Trade-off |
|---|---|---|
| Graduated context-cost mechanisms | Claude Code (hooks=0, skills=low, plugins=medium, MCP=high) | Different extensions at different costs. Complex to manage; scales. |
| Single unified API | Many tool-use frameworks | Simple. Every extension consumes context, limiting scalability. |
| Plugin marketplace (monoculture) | IDE extensions | Rich ecosystem potential. Quality control and security review become bottlenecks. |

**Key insight (paper):** Not all extensions need to consume context tokens. Hooks (zero cost) handle lifecycle events without touching the context window. Skills (low cost) inject only when relevant. Reserve high-context-cost mechanisms (MCP) for genuinely new tool surfaces.

**The three injection points:** Every agent loop has three places where extensions can intervene:
1. **assemble()** — what the model sees (instructions, tool schemas).
2. **model()** — what the model can reach (available tools).
3. **execute()** — whether/how an action runs (permission gates, pre/post hooks).

**Questions to ask yourself:**
- How many tools will your agent need to support? More tools = more context pressure.
- Do you need third-party extensions? Plan for security and quality control (see \`cve-pre-trust-window\`).
- Can you defer tool schema loading until the model actually needs the tool?

### Decision 5: How do subagents work?

**The question:** When the agent spawns sub-tasks, do they share context or run in isolation?

| Approach | Example | Trade-off |
|---|---|---|
| Isolated context + summary return | Claude Code (sidechain transcripts) | Prevents context explosion (~7× token cost). Subagents can't share fine-grained state. |
| Shared context | Some multi-agent frameworks | Full information sharing. Context fills up fast with N agents. |
| Message passing | Actor-model systems | Clean boundaries. Requires explicit protocol design. |

**Key insight (paper):** Subagent sessions cost ~7× the tokens of standard sessions. In Claude Code, only summaries return to the parent — full history never enters the parent context. This is essential for context conservation.

**SkillTool vs AgentTool (the knob you will get wrong first):** SkillTool injects instructions into the current context (cheap, same window). AgentTool spawns a new isolated context window (expensive, ~7× tokens, context-safe). Reach for SkillTool for small deterministic behaviors; AgentTool only when the subagent genuinely needs its own context.

**Questions to ask yourself:**
- Do your sub-tasks need to see each other's work?
- How do you prevent N subagents from consuming N × context-window tokens?
- Do subagents inherit parent permissions, or establish their own?

### Decision 6: How do sessions persist?

**The question:** What happens when a session ends? What carries over?

| Approach | Example | Trade-off |
|---|---|---|
| Append-only JSONL | Claude Code | Auditable, reconstructable, simple. Poor query power. |
| Database | Some enterprise agents | Rich queries, fast lookups. Adds infrastructure dependency, reduces transparency. |
| Stateless | Most chat APIs | Simplest. No resume, no fork, no audit trail. |

**Key insight (paper):** **Never restore permissions on resume.** Trust is always re-established in the current session. Security state should not persist implicitly across session boundaries.

**On auditability:** Append-only JSONL means every event is human-readable, version-controllable, and reconstructable without specialized tooling. The slight loss in query power is worth the transparency.

**Questions to ask yourself:**
- Can your sessions be paused and resumed? If yes, what MUST not carry over (permissions, secrets, classifier state)?
- Do you need to diff two sessions to debug a regression? JSONL is greppable; a DB requires a query.
- Who reads the transcript? If the answer is 'only the system,' a DB is fine. If it's 'a human on call,' JSONL wins.

## The Meta-Pattern: three recurring design commitments

Across all six decisions, three patterns recur in Claude Code's architecture. Staff engineers rebuilding Claude Code almost always miss these. If you are copying Claude Code's answers without these three commitments, you are copying the shape without the spine.

1. **Graduated layering over monolithic mechanisms** — safety, context, and extensibility all use *stacked independent stages* rather than single solutions. Seven safety layers, five compaction shapers, four extension mechanisms. Layers fail independently; monoliths fail all at once.

2. **Append-only designs favoring auditability over query power** — session transcripts, prompt history, subagent sidechains, file-history checkpoints: all append-only. Nothing is destructively edited. You trade query power for reconstructability and transparency. Agents amplify every bug, so 'what happened' must be recoverable from disk without a specialized tool.

3. **Model judgment within a deterministic harness** — the model decides freely; the harness enforces boundaries. The 1.6% / 98.4% ratio is not accidental. If you find yourself writing a planning graph to constrain the model, ask whether a deterministic harness enforcing post-conditions would do the same job without fighting the model.

## How to use this pack in practice

1. At the top of the architecture doc, write one paragraph per decision.
2. Link each paragraph to the pack that implements your answer.
3. Explicitly name the Meta-Pattern commitments you accept or decline. Declining is fine; silently declining is not.
4. In PR review, any change that touches one of the six decisions must update the paragraph. Mid-sprint drift is the number-one cause of 'we agreed on X but shipped Y'.
5. Cite this pack in your PR description when you argue for an answer.

## When 'rebuild Claude Code' comes up

A staff engineer proposes rebuilding Claude Code. Route the conversation through the Meta-Pattern first. Ask:
- Will you commit to graduated layering everywhere? (If not, defense-in-depth will degrade.)
- Will you commit to append-only everywhere? (If not, your audit trail is a lie.)
- Will the harness be deterministic around a freely-judging model? (If not, you are building a state graph, not a harness.)

If the team rejects any of the three, the answer is usually 'build something else.' Most 'rebuild Claude Code' attempts miss at least one of the three commitments and ship a product that looks like Claude Code but doesn't survive contact with users.

Sourced from VILA-Lab/Dive-into-Claude-Code (CC-BY-NC-SA-4.0, arXiv 2604.14228). The six decisions and the Meta-Pattern are paraphrased with citation; percentages and layer counts quoted from build-your-own-agent.md.`,

  evaluationChecklist: [
    "Design doc contains a paragraph per decision, each linked to the pack that implements it.",
    "Safety posture (Decision 2) has its dominant failure mode named alongside it.",
    "Context management (Decision 3) has a measured token ceiling, not a vibe — p95 turn tokens and session-peak tokens.",
    "Extension plan (Decision 4) names all four context costs (hooks / skills / plugins / MCP) or explicitly states why a simpler mechanism is enough.",
    "Subagent decision (Decision 5) has an explicit ~7× token multiplier accounted for, or an explicit policy capping N subagents.",
    "Session persistence (Decision 6) explicitly re-establishes permissions on resume.",
    "The three Meta-Pattern commitments are accepted or declined with a written reason.",
    "Any pack added to the system cites which of the six decisions it implements in its install PR.",
  ],
  failureModes: [
    {
      symptom: "Team wrote paragraphs for all six decisions at kickoff and by sprint 3 the code has drifted from four of them",
      trigger: "Decisions were written once, never linked to PR review; mid-sprint scope creep silently flipped answers",
      preventionCheck: "Require any PR touching reasoning, safety, context, extensibility, subagents, or persistence to update the corresponding paragraph; block merge if the paragraph is stale",
      tier: "staff",
    },
    {
      symptom: "Engineer copied a canonical pattern from the catalog without declaring which of the six decisions it answers",
      trigger: "Catalog browsed by vibe, not by decision; the pattern solves a problem the team does not have",
      preventionCheck: "Require each catalog install PR to name the decision it implements; reviewers reject installs that don't",
      tier: "sr",
    },
    {
      symptom: "Team rebuilt Claude Code's shape (deny-first, 5 compaction layers, sidechain subagents) but the product is flaky and hard to debug",
      trigger: "Copied all six answers without committing to the Meta-Pattern; graduated layering degraded into monolithic layers, append-only shortcuts became destructive edits, harness got 'just one' planning graph",
      preventionCheck: "Before any 'rebuild Claude Code' sprint, accept or decline each of the three Meta-Pattern commitments in writing; staff engineer signs",
      tier: "staff",
    },
    {
      symptom: "Context management strategy chosen, agent ships, one week later OOMs on a real user session",
      trigger: "Decision 3 answered without a measured token-budget ceiling; team assumed 'we have enough context' without measurement",
      preventionCheck: "Require a p95 turn token count and a session-peak token count before launch; release-blocking if either is unmeasured",
      tier: "sr",
      relatedPacks: ["turn-execution-pipeline"],
    },
  ],

  securityReview: {
    injectionSurface: "low",
    toolAllowList: [],
    lastScanned: "2026-04-19",
    knownIssues: [
      "Reference pack; ships no runtime code and has no injection surface of its own.",
      "Decision 4 (extensibility) and Decision 2 (safety) both require pairing with security packs — see cve-pre-trust-window and injection-surface-audit.",
      "Derived from CC-BY-NC-SA-4.0 source; downstream uses must preserve attribution and NC-SA terms for any verbatim excerpts.",
    ],
  },

  rediscoveryCost: {
    tokens: 48000,
    minutes: 120,
    measuredAt: "2026-04-19",
    methodology:
      "Prompted a fresh Claude Sonnet 4.6 with 'what are the recurring design decisions every production coding agent must answer, how does Claude Code answer each, and what are the Meta-Pattern commitments that make the answers cohere?'. Measured tokens until the output named reasoning placement, safety posture, context management, extensibility, subagents, and session persistence with Claude Code-specific numbers (1.6% / 98.4% ratio, 7 safety layers, 5-shaper compaction pipeline, 4-mechanism extensibility stack, ~7× subagent token cost, append-only JSONL) and the three Meta-Pattern commitments. Averaged over 3 runs.",
  },

  relatedPacks: [
    "pattern-decision-tree",
    "claude-code-guide",
    "turn-execution-pipeline",
    "extensibility-four-mechanisms",
  ],
  requires: [],
  conflictsWith: [],
  supersedes: [],
  comparesWith: [
    {
      slug: "four-design-questions",
      axis: "complexity",
      winner: "other",
      note: "Four-design-questions is the 2-minute orientation; this pack is the 20-minute architect's framework. Start there, graduate here. Winner: four-design-questions for speed; this pack for depth.",
    },
    {
      slug: "pattern-decision-tree",
      axis: "maintainability",
      winner: "other",
      note: "Pattern-decision-tree walks canonical workflow patterns (prompt-chaining / routing / evaluator-optimizer etc.). This pack walks harness-level design choices. Pattern-decision-tree maintains better because it has a tighter, more testable output; this pack maintains best when paired with enforceable PR review.",
    },
  ],

  changelog: [
    {
      version: "0.1.0",
      date: "2026-04-19",
      added: [
        "Six-decision walkthrough with Claude Code's answers and alternatives from LangGraph, Devin, SWE-Agent, OpenHands, and Aider",
        "Per-decision 'questions to ask yourself' and 'key insight' blocks quoted from the paper",
        "Meta-Pattern section on the three recurring design commitments (graduated layering, append-only, model-judgment within a deterministic harness)",
        "Practical usage: design-doc template, PR-review linkage, 'rebuild Claude Code' routing script",
      ],
      removed: [],
      reason: "Seed pack — first release. The architect's framework derived from VILA-Lab/Dive-into-Claude-Code build-your-own-agent.md.",
    },
  ],

  metrics: [
    { label: "Decisions covered", value: "6" },
    { label: "Meta-Pattern commitments", value: "3" },
    { label: "Alternative harnesses compared", value: "5" },
    { label: "Typical tokens saved", value: "48k" },
    { label: "Walkthrough time", value: "~20 min" },
  ],

  sources: [
    {
      label: "VILA-Lab — Dive into Claude Code (CC-BY-NC-SA-4.0)",
      url: "https://github.com/VILA-Lab/Dive-into-Claude-Code",
      note: "Primary source. Paraphrased with citation under CC-BY-NC-SA-4.0. Verbatim excerpts preserve NC-SA terms. The six decisions and Meta-Pattern are lifted from docs/build-your-own-agent.md.",
    },
    {
      label: "Dive into Claude Code — paper (arXiv 2604.14228)",
      url: "https://arxiv.org/abs/2604.14228",
      note: "Academic reference for the values → principles → implementation framework. Cite in downstream work; preserves NC-SA for excerpts.",
    },
    {
      label: "Dive into Claude Code — build-your-own-agent.md",
      url: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/build-your-own-agent.md",
      note: "Primary companion doc. All six decisions, the alternatives columns, and the Meta-Pattern section are paraphrased from here.",
    },
    {
      label: "LangGraph — explicit state graphs",
      url: "https://github.com/langchain-ai/langgraph",
      note: "Alternative answer to Decision 1 (reasoning placement) referenced throughout: explicit state graphs vs. minimal scaffolding.",
    },
    {
      label: "SWE-Agent (NeurIPS 2024)",
      url: "https://arxiv.org/abs/2405.15793",
      note: "Alternative answer to Decision 2 (safety posture) — Docker-based container isolation. Referenced in the safety table.",
    },
    {
      label: "Aider",
      url: "https://github.com/Aider-AI/aider",
      note: "Alternative answer to Decision 2 (safety posture) — VCS / git-based rollback. Referenced in the safety table.",
    },
    {
      label: "OpenHands (ICLR 2025)",
      url: "https://arxiv.org/abs/2407.16741",
      note: "Open-source AI coding agent, container-isolation approach. Referenced in Decision 2 and Decision 4.",
    },
  ],
  examples: [
    {
      label: "VILA-Lab/Dive-into-Claude-Code — build-your-own-agent.md",
      href: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/build-your-own-agent.md",
      external: true,
    },
    {
      label: "arXiv 2604.14228 — Dive into Claude Code",
      href: "https://arxiv.org/abs/2604.14228",
      external: true,
    },
    {
      label: "Anthropic — Building Effective Agents",
      href: "https://www.anthropic.com/research/building-effective-agents",
      external: true,
    },
  ],
};

export default agentDesignSpaceSixDecisions;
