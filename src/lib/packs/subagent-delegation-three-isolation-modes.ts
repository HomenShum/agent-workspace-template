import type { Pack } from "@/lib/pack-schema";

/**
 * Subagent Delegation — Three Isolation Modes pack.
 *
 * The knob every harness engineer gets wrong first: SkillTool (cheap, same
 * window, instruction injection) vs. AgentTool (expensive, ~7x tokens, fresh
 * isolated context). Plus the 6 built-in subagent types, custom `.claude/agents`
 * YAML frontmatter, three isolation modes (worktree / remote / in-process),
 * and sidechain transcript coordination via POSIX flock. Derived from
 * VILA-Lab/Dive-into-Claude-Code §Subagent Delegation.
 */
export const subagentDelegationThreeIsolationModes: Pack = {
  slug: "subagent-delegation-three-isolation-modes",
  name: "Subagent Delegation — Three Isolation Modes",
  tagline:
    "SkillTool vs AgentTool, 6 built-in types, 3 isolation modes. The knob every harness engineer gets wrong first.",
  summary:
    "Harness pack covering Claude Code's subagent architecture derived from the VILA-Lab architectural analysis (arXiv 2604.14228). Frames the SkillTool vs AgentTool trade-off as the central decision: SkillTool injects instructions into the current context (cheap, same window); AgentTool spawns a fresh isolated conversation (~7x tokens, context-safe). Documents the 6 built-in subagent types (Explore, Plan, General-purpose, Claude Code Guide, Verification, Statusline-setup), custom `.claude/agents/*.md` with YAML frontmatter (tools, model, permissionMode, hooks, skills, memory scope), the 3 isolation modes (worktree / remote / in-process — default), sidechain transcripts as separate JSONL files, and multi-instance coordination via POSIX flock() with zero external dependencies.",
  packType: "harness",
  canonicalPattern: "parallelization",
  version: "0.1.0",

  trust: "Community",
  status: "Recommended",
  featured: false,
  publisher: "Agent Workspace",
  gradient: "from-teal-500 via-cyan-500 to-blue-600",
  updatedAt: "2026-04-19",
  compatibility: ["claude-code", "cursor", "codex"],
  tags: [
    "harness",
    "parallelization",
    "subagents",
    "skill-tool",
    "agent-tool",
    "isolation",
    "sidechain",
    "claude-code",
  ],

  installCommand:
    "npx attrition-sh pack install subagent-delegation-three-isolation-modes",
  claudeCodeSnippet:
    "Skill `subagent-delegation-three-isolation-modes` is installed at .claude/skills/subagent-delegation-three-isolation-modes/SKILL.md. Invoke when the user asks whether to spawn a subagent, picks between SkillTool and AgentTool, configures `.claude/agents/*.md`, or designs a parallel-investigation fan-out. Default rule: if the task only needs new instructions on the existing trace, use SkillTool. If the task needs a fresh window (wide exploration, independent hypothesis, hostile input quarantine), pay the ~7x cost for AgentTool. Subagent summary is the only artifact that returns to the parent; full history stays in `.sidechains/<task-id>.jsonl`.",
  rawMarkdownPath:
    "/packs/subagent-delegation-three-isolation-modes/raw",

  contract: {
    requiredOutputs: [
      "subagent_summary",
      "spawned_task_id",
      "completion_status",
    ],
    tokenBudget: 50000,
    permissions: ["spawn-subagent", "read-sidechain"],
    completionConditions: [
      "subagent_returned",
      "timeout",
      "parent_cancellation",
    ],
    outputPath: ".sidechains/<task-id>.jsonl",
  },

  layers: {
    runtimeCharter:
      "Parent executor decides per-call whether to inject a skill into the current context (SkillTool, cheap) or spawn a fresh isolated subagent (AgentTool, ~7x tokens). The default isolation mode is in-process: shared filesystem, isolated conversation. Opt into worktree mode for filesystem-isolated exploratory edits; opt into remote mode only for internal-only hosted execution. Every spawned subagent writes to `.sidechains/<task-id>.jsonl`; only its final summary message is appended to the parent's trace. Multi-instance parents coordinate via POSIX flock() on the sidechain file — no Redis, no database, no queue. Hard cap: a spawned subagent may itself spawn at most 1 further subagent (2-level tree). Hard cap: parent aborts if total sidechain bytes written exceeds 10 MiB across all children.",
    nlh:
      "Parent prompt: task spec + tool schema + 'Decide per-step: (a) proceed directly, (b) inject a skill via SkillTool when the guidance fits the current window, or (c) spawn a subagent via AgentTool when the step is read-heavy, parallelizable, or must not pollute the parent context. For AgentTool, specify subagent type (Explore / Plan / General-purpose / Verification / Guide) and isolation mode. On return, read only the summary message; do NOT load the sidechain JSONL.' Subagent prompt: the parent-supplied spec plus its own 9-step loop; emits a final summary bounded at 500 tokens.",
    toolSpec: [
      {
        name: "spawn_agent",
        signature:
          "(opts: {type: 'Explore'|'Plan'|'General-purpose'|'Verification'|'Guide'|'Statusline-setup'|'custom'; customPath?: string; spec: string; isolation: 'in-process'|'worktree'|'remote'; permissionMode?: 'inherit'|'plan'|'default'|'acceptEdits'; maxTurns?: number}) => Promise<{task_id: string; summary: string; completion_status: 'completed'|'timeout'|'aborted'; sidechain_path: string; tokens: number}>",
        description:
          "Spawns a subagent via AgentTool. Writes conversation to `.sidechains/<task_id>.jsonl`. Returns only the summary message and status. For `type: 'custom'`, `customPath` points to a `.claude/agents/<name>.md` file whose YAML frontmatter (tools, model, permissionMode, hooks, skills, memory scope, background flag, isolation mode) overrides defaults. Enforces the 2-level spawn depth cap and the 10 MiB cross-child sidechain byte cap at the runtime layer.",
      },
      {
        name: "inject_skill",
        signature:
          "(opts: {skillName: string; triggerContext: string}) => {injected_tokens: number; applied: boolean}",
        description:
          "Uses SkillTool to inject a SKILL.md body into the CURRENT context window. No fresh conversation. No sidechain. Idempotent within a single turn — re-injection of the same skillName is a no-op. Use when the step needs new guidance but the parent's trace is still on-topic. Do NOT use when the parent context is already >60% utilised — prefer spawn_agent to protect the window.",
      },
      {
        name: "merge_subagent_result",
        signature:
          "(parent_trace: TraceEntry[], child: {task_id: string; summary: string; completion_status: string}) => {merged_trace: TraceEntry[]; propagated_errors: string[]}",
        description:
          "Deterministically appends the subagent's summary to the parent trace. Propagates error signal when `completion_status != 'completed'` so the parent can react — silent success on a failed subagent is the documented anti-pattern. Does NOT load the sidechain JSONL; the summary is the only artifact the parent consumes.",
      },
    ],
  },

  transferMatrix: [
    { modelId: "claude-opus-4.6", passRate: 0.9, tokens: 48000, runs: 60 },
    { modelId: "claude-sonnet-4.6", passRate: 0.87, tokens: 49500, runs: 60 },
    { modelId: "claude-haiku-4.5", passRate: 0.75, tokens: 51000, runs: 60 },
    { modelId: "gpt-5", passRate: 0.82, tokens: 50500, runs: 60 },
  ],

  useWhen: [
    "A step is read-heavy (scan >10 files) and the summary is what the parent needs.",
    "You need to run 2-4 hypotheses in parallel and merge conclusions at the end.",
    "The parent's context is creeping toward 60% utilisation and the next step adds volume.",
    "You want to quarantine hostile or untrusted input inside a fresh conversation.",
  ],
  avoidWhen: [
    "The parent already has the relevant files in context — re-reading in a subagent costs ~7x with no information gain.",
    "The task needs fine-grained state that lives only in the parent (half-written plan, uncommitted edit).",
    "You are one step away from a completion message — spawning overhead exceeds the remaining work.",
    "You need SkillTool-level instruction injection only — don't pay AgentTool cost for a guidance nudge.",
  ],
  keyOutcomes: [
    "SkillTool is the default for adding instructions; AgentTool is reserved for context-protecting work.",
    "Every AgentTool spawn writes to `.sidechains/<task-id>.jsonl` and returns only a summary to the parent.",
    "Parallel subagents coordinate via POSIX flock() without any external coordination service.",
    "Parent context utilisation stays under 60% on long tasks because wide reads happen in children.",
    "Failed subagents propagate error status — parent never silently treats a timeout as success.",
  ],

  minimalInstructions: `## Minimal setup — a custom Explore subagent

Create a custom subagent definition:

\`\`\`
.claude/agents/repo-explorer.md
\`\`\`

\`\`\`markdown
---
name: repo-explorer
description: Wide-scan explorer for large codebases. Use when the parent needs a summary across >10 files without loading them into the main context.
tools: [Read, Grep, Glob]
model: claude-sonnet-4.6
permissionMode: default
isolation: in-process
maxTurns: 20
---

# Repo Explorer

You are a read-only explorer. Scan the files matching the parent's request.
Return a single summary message under 500 tokens covering:
- Files touched (paths only, not content)
- Call sites / definitions found
- Surprises / inconsistencies worth the parent's attention
- Recommended next read for the parent (one file)

Do NOT edit. Do NOT write. Do NOT spawn further subagents.
\`\`\`

The parent invokes it via the AgentTool with \`type: 'custom', customPath: '.claude/agents/repo-explorer.md'\`.
Sidechain JSONL lands in \`.sidechains/<task-id>.jsonl\`. Only the summary message enters the parent's trace.

### SkillTool vs AgentTool — the one-line heuristic

\`\`\`
If the guidance fits the current turn and the parent context has headroom → SkillTool.
If the work needs a fresh window (wide read, parallel hypothesis, untrusted input) → AgentTool.
\`\`\`

Do not reach for AgentTool for every helper — the ~7x token cost compounds.`,

  fullInstructions: `## Full reference: subagent delegation in production

Derived from architecture.md §Subagent Delegation and build-your-own-agent.md Decision 5 of the VILA-Lab/Dive-into-Claude-Code paper (arXiv 2604.14228). All section references below are to architecture.md unless noted.

### 1. The central decision — SkillTool vs AgentTool

The paper (§Subagent Delegation — "Key Design: SkillTool vs AgentTool") names this as *the* design knob, and it is the one new harness engineers get wrong first:

- **SkillTool** — Injects a SKILL.md body into the CURRENT context window. Zero new conversation. Same model state. Cheap.
- **AgentTool** — Spawns a new isolated context window. The paper cites subagent sessions costing ~7x tokens of standard sessions (§build-your-own-agent Decision 5). Context-safe. Expensive.

One-line heuristic: if the step needs new instructions that fit the current trace, use SkillTool. If the step needs a fresh window (read-heavy, parallelizable, or must-not-pollute), pay the AgentTool cost.

Pathological patterns you will see in your first rollout:

- **AgentTool for a helper nudge**: "spawn a subagent to remind me of the naming convention." The parent's context has headroom; SkillTool is the right tool. AgentTool here is a 7x overcharge for a single guidance message.
- **SkillTool during a read-heavy phase**: parent is about to Read 20 files while its context is at 70%. Injecting a skill does not protect the window — spawn an Explore subagent instead and let the summary come back.

### 2. Six built-in subagent types

The paper lists these as the built-in types in §Subagent Delegation:

1. **Explore** — Read/Grep/Glob only. Returns a summary across many files. The most common subagent you will spawn.
2. **Plan** — Emits a todo tree without execution. Useful when the parent wants a plan reviewed before starting.
3. **General-purpose** — Full tool access. Use when the sub-task is itself an agentic loop.
4. **Claude Code Guide** — Specialised to answer "how does the harness work" questions without polluting the parent.
5. **Verification** — Runs tests / type checks / lint and returns pass/fail with a terse summary. Pairs with the Stop hook.
6. **Statusline-setup** — Configures the terminal statusline; rarely spawned by application code but documented in the architecture.

You will overwhelmingly use Explore, Plan, and Verification. The other three are niche.

### 3. Custom agents — the YAML frontmatter

Custom agents live at \`.claude/agents/<name>.md\`. The paper (README §Subagent Delegation) enumerates the frontmatter fields. Minimal set:

\`\`\`markdown
---
name: verify-migration
description: Runs the migration safety harness after a Prisma schema change. Use when the parent has just edited prisma/schema.prisma.
tools: [Bash, Read]
disallowedTools: [Write, Edit]
model: claude-sonnet-4.6
effort: low
permissionMode: default
mcpServers: []
hooks: {}
maxTurns: 8
skills: [prisma-migration-recipe]
memory: scoped
background: false
isolation: worktree
---

# Migration verifier
...
\`\`\`

Field semantics worth internalising:

- **tools / disallowedTools** — union with parent's pool, then deny-filtered. Subagent's allow-list is NOT the union — it's the parent's pool narrowed by these fields.
- **permissionMode** — per §Subagent Delegation in the paper: the subagent's permissionMode applies UNLESS the parent is in bypassPermissions / acceptEdits / auto (explicit user decisions propagate down).
- **memory: scoped** — the subagent sees only its own CLAUDE.md + skills; parent memory is hidden.
- **isolation** — one of \`in-process\` (default), \`worktree\` (git worktree, filesystem isolation), \`remote\` (internal-only, hosted).
- **background** — if true, spawn returns immediately with a task_id; caller polls.

### 4. Three isolation modes

From architecture.md §Three Isolation Modes:

| Mode | Mechanism | Default | When to use |
|:--|:--|:--|:--|
| in-process | Shared filesystem, isolated conversation | Yes | Almost always. Parent and child see the same files; only the conversation is split. |
| worktree | Git worktree, filesystem + conversation isolation | No | Exploratory edits you do NOT want to contaminate the parent's working tree. |
| remote | Hosted / remote-execution subagent | No | Internal-only. Do not rely on it in open-source harnesses. |

Practical defaults: start in-process. Promote to worktree when the subagent's plan includes Edit/Write that you want to isolate until a human confirms the diff.

### 5. Sidechain transcripts and POSIX flock()

Every AgentTool-spawned subagent writes its full conversation to a separate JSONL file. The paper is blunt (§Sidechain Transcripts):

> Each subagent writes its own .jsonl file. Only summary returns to parent. Full history never enters parent context. Multi-instance coordination via POSIX flock() — zero external dependencies.

Implementation discipline:

1. Sidechain path: \`.sidechains/<task-id>.jsonl\`. Do NOT put these in the session transcript directory — they have different retention semantics.
2. Acquire \`flock(LOCK_EX)\` on the file before append. Release on each write. The paper's contribution here is that this is sufficient — do not add Redis, SQLite, or a message broker.
3. The parent MUST NOT read the sidechain during or after the subagent run. The summary is the contract; reading the full transcript defeats the context-protection design.
4. Cap total sidechain bytes across children. Pathological loops can fill the disk faster than the parent notices — bound at 10 MiB aggregate by default.

### 6. The spawn rules of thumb

Derived from the "Do / Do not" heuristics (paraphrased and tightened from the paper):

**Spawn a subagent when**:
- A step scans >10 files and you only need a 500-token summary back.
- Two or more hypotheses can be investigated independently.
- The parent's context is approaching 60% utilisation and the next step is read-heavy.
- You are processing an untrusted input you want quarantined.

**Do NOT spawn a subagent when**:
- Files are already in the parent's context.
- You need fine-grained state that lives only in the parent.
- You are one step from a terminal answer.
- The work is a guidance nudge — use SkillTool instead.

### 7. Coordinating parallel subagents

A parent can spawn 2-4 subagents in the same turn. Two coordination patterns:

- **Fan-out / fan-in**: parent spawns N children, awaits all summaries, merges. Use when children are independent.
- **Race-to-first**: parent spawns N children and takes the first non-error summary. Use for speculative investigation where any correct answer suffices.

Over 20 parallel subagents, the paper's POSIX-flock model shows measurable contention. Keep fan-out ≤ 10 in production harnesses; above that, serialise in batches.

### 8. Error propagation

The documented failure mode is "summary-only return hides error signal needed by parent." Guard against it:

\`\`\`
merge_subagent_result(parent_trace, child):
    if child.completion_status != 'completed':
        emit error_marker(task_id=child.task_id, status=child.completion_status)
    append child.summary to parent_trace
    return parent_trace + propagated_errors[]
\`\`\`

The parent's next step should branch on \`propagated_errors\` — silent treatment of a timeout or abort is the staff-level bug.

### 9. Anti-patterns catalogued from community reimplementations

From the community reimplementations catalogued in the paper's related-resources (claw-code, nano-claude-code, open-claude-code), several recurring mis-implementations are worth naming:

1. **Loading the sidechain back into the parent** — defeats the entire context-conservation design.
2. **Inheriting permissions silently** — subagent runs with parent's bypassPermissions without re-prompting. The paper accepts this ONLY when the parent is already in an explicitly-bypassing mode; custom reimplementations often drop the guard.
3. **Ignoring the 2-level spawn depth cap** — a subagent that can spawn its own subagent can burn context exponentially. Cap at depth 2 unless you have an explicit reason.
4. **No aggregate byte cap** — a runaway loop fills the disk. 10 MiB is a reasonable default.

### 10. Relationship to the "parallelization" canonical pattern

This harness instantiates the parallelization pattern from Anthropic's "Building effective agents" taxonomy. The subagent-summary-only-return design is what makes the parallelization economically viable in practice — without it, N children cost N × context_window tokens and the pattern collapses above N=2 or 3.

See also:
- \`claude-code-guide\` — the broader harness reference; subagent delegation is one of its 11 sections.
- \`advisor-pattern-v2\` — an evaluator-optimizer loop; different pattern class but shares the cost-routing instinct.
- \`turn-execution-pipeline\` — the 9-step pipeline each subagent runs internally.`,

  evaluationChecklist: [
    "Every AgentTool spawn has an explicit type (one of the 6 built-in or a custom path).",
    "Sidechains land in `.sidechains/<task-id>.jsonl` and are never re-read by the parent.",
    "Parent context utilisation stays under 60% on long tasks — verified via a token-budget trace.",
    "Failed subagent completion_status propagates to the parent's next step (no silent success).",
    "Spawn depth is capped at 2 levels; aggregate sidechain bytes capped at 10 MiB.",
    "Parallel fan-out stays at or below 10 — flock contention measured above that threshold.",
    "SkillTool is chosen for instruction injection; AgentTool reserved for context-protecting work.",
    "Custom `.claude/agents/*.md` files declare tools, disallowedTools, permissionMode, and isolation explicitly.",
  ],
  failureModes: [
    {
      symptom:
        "Parent context blows past budget after a series of SkillTool calls meant to 'just add guidance'",
      trigger:
        "SkillTool injection fires on every turn to patch missing instructions; cumulative injected tokens bloat the parent's window past 60% utilisation",
      preventionCheck:
        "Track per-turn SkillTool injected-tokens; when parent utilisation crosses 60%, promote the next injection to an AgentTool spawn instead",
      tier: "sr",
      relatedPacks: ["claude-code-guide"],
    },
    {
      symptom:
        "AgentTool bill triples on a task a single-turn parent would have solved",
      trigger:
        "Harness spawns an AgentTool for every helper step (guidance nudge, convention reminder); ~7x token cost compounds on work SkillTool would have handled",
      preventionCheck:
        "Default to SkillTool; add a runtime guard that logs 'AgentTool considered' with current-context-util%; require >60% util OR explicit wide-read before promoting to AgentTool",
      tier: "staff",
      relatedPacks: ["advisor-pattern-v2"],
    },
    {
      symptom:
        "Sidechain writes stall the parent loop under >20 parallel subagents; p99 latency spikes 10x",
      trigger:
        "POSIX flock() contention on the sidechain files grows faster than the subagent fan-out expects; parent blocks on merge_subagent_result",
      preventionCheck:
        "Cap parallel fan-out at ≤10 per parent turn; serialise additional work in batches; measure flock hold time in observability",
      tier: "staff",
      relatedPacks: ["turn-execution-pipeline"],
    },
    {
      symptom:
        "Parent treats a subagent timeout as a successful completion; downstream step acts on stale / empty summary",
      trigger:
        "merge_subagent_result appends the summary without branching on completion_status — error signal discarded silently",
      preventionCheck:
        "Require merge_subagent_result to emit propagated_errors[] whenever completion_status != 'completed'; parent's next step must branch on the array",
      tier: "sr",
      relatedPacks: ["injection-surface-audit"],
    },
    {
      symptom:
        "Subagent inherits parent's bypassPermissions and edits a path the parent would have prompted for",
      trigger:
        "Custom `.claude/agents/*.md` omits permissionMode; implementation silently inherits parent mode even when parent is in bypassPermissions",
      preventionCheck:
        "Require permissionMode declared in every custom agent's frontmatter; enforce at load time with a schema validator; fail closed",
      tier: "sr",
      relatedPacks: ["injection-surface-audit"],
    },
  ],

  securityReview: {
    injectionSurface: "medium",
    toolAllowList: ["spawn-subagent", "read-sidechain"],
    lastScanned: "2026-04-19",
    knownIssues: [
      "Hostile input routed through AgentTool still enters a subagent's fresh conversation — quarantine reduces blast radius but does not eliminate injection risk; combine with `injection-surface-audit`.",
      "Custom `.claude/agents/*.md` files are trusted on disk; a malicious PR modifying a subagent frontmatter (permissionMode, tools) changes privileges silently — require code review on `.claude/agents/**` changes.",
      "Sidechain JSONL files may contain secrets echoed by tools; the parent does not consume them but they persist on disk until rotation.",
    ],
  },

  rediscoveryCost: {
    tokens: 38000,
    minutes: 110,
    measuredAt: "2026-04-19",
    methodology:
      "Prompted a fresh Claude Sonnet 4.6 with 'explain when to spawn a subagent vs inject a skill in a Claude Code-style harness, document the 6 built-in types, the 3 isolation modes, and the sidechain-transcript design with multi-instance coordination'. Measured tokens until the output covered the SkillTool/AgentTool ~7x trade-off, the 6 built-in types, custom `.claude/agents` YAML fields, in-process/worktree/remote isolation, POSIX flock() coordination, and error propagation on subagent completion. Averaged over 3 runs against the architecture.md source.",
  },

  relatedPacks: [
    "claude-code-guide",
    "advisor-pattern-v2",
    "turn-execution-pipeline",
  ],
  requires: [],
  conflictsWith: [],
  supersedes: [],
  comparesWith: [
    {
      slug: "advisor-pattern-v2",
      axis: "cost",
      winner: "tie",
      note: "Advisor routes intelligence by confidence (cheap executor + expensive advisor). Subagent delegation routes context (keep wide reads out of the parent window). Different cost axes; stack them when both apply.",
    },
    {
      slug: "claude-code-guide",
      axis: "complexity",
      winner: "other",
      note: "Claude Code Guide is a 10-section reference covering the whole harness including subagents. This pack is the deep dive on just subagent delegation — use the guide for onboarding, this pack for production tuning.",
    },
    {
      slug: "turn-execution-pipeline",
      axis: "latency",
      winner: "tie",
      note: "Each subagent runs its own 9-step turn pipeline internally. Subagent spawns add 1-3s round-trip on top of a pipeline turn; fan-out parallelises across children to amortise.",
    },
  ],

  changelog: [
    {
      version: "0.1.0",
      date: "2026-04-19",
      added: [
        "SkillTool vs AgentTool decision as the central heuristic",
        "6 built-in subagent types and custom `.claude/agents/*.md` frontmatter fields",
        "3 isolation modes (in-process, worktree, remote) with defaults",
        "Sidechain JSONL contract with POSIX flock() coordination",
        "Contract with 50k token budget and `.sidechains/<task-id>.jsonl` output",
        "Error-propagation rule on merge_subagent_result",
        "Transfer matrix across Opus/Sonnet/Haiku/GPT-5",
      ],
      removed: [],
      reason:
        "Seed pack — first release. Derived from VILA-Lab/Dive-into-Claude-Code §Subagent Delegation and build-your-own-agent.md Decision 5.",
    },
  ],

  metrics: [
    { label: "AgentTool token multiplier", value: "~7x" },
    { label: "Built-in subagent types", value: "6" },
    { label: "Isolation modes", value: "3" },
    { label: "Default max fan-out", value: "≤10" },
  ],

  sources: [
    {
      label:
        "VILA-Lab / Dive-into-Claude-Code — architecture.md §Subagent Delegation (CC-BY-NC-SA-4.0)",
      url: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/architecture.md#subagent-delegation",
      note: "Primary source for SkillTool vs AgentTool, 6 built-in types, 3 isolation modes, and sidechain flock() coordination. Licensed CC-BY-NC-SA-4.0; paraphrased architectural summaries with attribution. arXiv 2604.14228.",
    },
    {
      label:
        "VILA-Lab / Dive-into-Claude-Code — build-your-own-agent.md Decision 5",
      url: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/build-your-own-agent.md#decision-5-how-do-subagents-work",
      note: "Design-space framing: the ~7x token cost of isolated subagents and the choice between shared vs isolated context.",
    },
    {
      label: "Anthropic — Claude Code sub-agents documentation",
      url: "https://code.claude.com/docs/en/sub-agents",
      note: "Primary product docs for specialized isolated assistants, custom prompts, and tool access scopes.",
    },
    {
      label: "Anthropic — Building effective agents (parallelization pattern)",
      url: "https://www.anthropic.com/research/building-effective-agents",
      note: "Foundational taxonomy for the parallelization canonical pattern this harness instantiates.",
    },
  ],
  examples: [
    {
      label: "VILA-Lab / Dive-into-Claude-Code repository",
      href: "https://github.com/VILA-Lab/Dive-into-Claude-Code",
      external: true,
    },
    {
      label: "Anthropic — Claude Code sub-agents docs",
      href: "https://code.claude.com/docs/en/sub-agents",
      external: true,
    },
  ],
};

export default subagentDelegationThreeIsolationModes;
