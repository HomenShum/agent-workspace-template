import type { Pack } from "@/lib/pack-schema";

/**
 * Nine Context Sources pack.
 *
 * Reference for the 9 ordered context sources Claude Code assembles
 * before every model call, the 4-level CLAUDE.md hierarchy, and the
 * file-based memory model (no embeddings, no vector DB). Derived from
 * VILA-Lab Dive-into-Claude-Code (arXiv 2604.14228) §Context Construction
 * and Memory. Frames the pack around the paper's "Critical design choice":
 * CLAUDE.md is USER CONTEXT (probabilistic compliance), NOT system prompt
 * (deterministic). The deterministic enforcement layer is permission rules.
 * This is the single most-misunderstood Claude Code design decision.
 */
export const nineContextSources: Pack = {
  slug: "nine-context-sources",
  name: "Nine Context Sources",
  tagline:
    "CLAUDE.md is user context, not system prompt. 9 sources, 4 hierarchy levels, zero embeddings.",
  summary:
    "Reference for the 9 ordered context sources Claude Code assembles before every model call, and the 4-level CLAUDE.md hierarchy that feeds one of them. Derived from the VILA-Lab Dive-into-Claude-Code paper (arXiv 2604.14228), whose anchor finding is that Claude Code is ~1.6% AI decision logic and ~98.4% deterministic infrastructure. The pack's entire frame is the paper's explicitly-labeled 'Critical design choice' from §Context Construction: CLAUDE.md is user context (probabilistic compliance by the model), NOT system prompt (deterministic enforcement by the runtime). Permission rules are the deterministic layer; CLAUDE.md instructs but does not enforce. The pack enumerates the 9 sources in order (system prompt → environment info → CLAUDE.md hierarchy → path-scoped rules → auto-memory → tool metadata → conversation history → tool results → compact summaries), breaks the CLAUDE.md hierarchy into its 4 precedence levels (/etc managed, ~/.claude user, project, .local gitignored), and documents the file-based memory model that replaces vector DB / embedding approaches with an LLM-based scan of up to 5 memory-file headers on demand. Fully inspectable, editable, and version-controllable by the user — and one of the paper's three recurring design commitments (append-only auditability over query power) made concrete. Target: an agent engineer who keeps hearing 'just put it in CLAUDE.md' as a fix and needs to understand why that is wrong for safety-critical rules.",
  packType: "reference",
  canonicalPattern: "n/a",
  version: "0.1.0",

  trust: "Community",
  status: "Recommended",
  featured: false,
  publisher: "Agent Workspace",
  gradient: "from-amber-500 via-yellow-500 to-lime-600",
  updatedAt: "2026-04-19",
  compatibility: ["claude-code", "cursor", "codex"],
  tags: [
    "reference",
    "context",
    "claude-md",
    "memory",
    "claude-code-internals",
    "dive-into-claude-code",
  ],

  installCommand: "npx attrition-sh pack install nine-context-sources",
  claudeCodeSnippet:
    "Skill `nine-context-sources` is installed at .claude/skills/nine-context-sources/SKILL.md. Invoke when the user or the agent is about to put a 'hard rule' in CLAUDE.md. CLAUDE.md is user context — the model complies probabilistically, not deterministically. Any hard rule (permission, secret boundary, destructive-op guard) belongs in permission rules, hooks, or tool allow-lists, not in CLAUDE.md. Use CLAUDE.md for style, conventions, and run commands; use deterministic layers for safety.",
  rawMarkdownPath: "/packs/nine-context-sources/raw",

  useWhen: [
    "A team is about to adopt CLAUDE.md and needs to understand what it is and is not.",
    "Someone is proposing a vector-DB memory system because 'CLAUDE.md doesn't scale' — verify whether that claim matches the file-based memory model.",
    "A security reviewer is asking why a rule 'is in CLAUDE.md but the agent ignored it' — this is expected behavior; the enforcement is supposed to happen elsewhere.",
    "Cloning Claude Code's context-assembly step into another harness (claw-code, nano-claude-code, open-claude-code).",
    "Debugging context precedence: a path-scoped rule silently overrides a global rule and you want to know why.",
  ],
  avoidWhen: [
    "You need a cookbook recipe for writing one specific CLAUDE.md — use claude-code-guide for that.",
    "Your harness has no memory layer and no per-project config — this pack is overkill; start with a single AGENTS.md.",
    "You are building a fully deterministic rules engine with no LLM context — the 9 sources don't apply.",
  ],
  keyOutcomes: [
    "Team internalizes: CLAUDE.md is user context (probabilistic), permission rules are deterministic.",
    "CLAUDE.md files are free of secrets, PII, and hard safety guards — those belong in permission rules or hooks.",
    "The 9 sources are assembled in the documented order; path-scoped rules do not silently shadow globals.",
    "File-based memory works without a vector DB; the LLM scans up to 5 relevant memory-file headers on demand.",
    "Reviewers can trace any context-related agent behavior back to a specific source in the 9.",
  ],

  minimalInstructions: `## Minimal mental model — the one sentence

> **CLAUDE.md is user context (probabilistic compliance). Permission rules are system enforcement (deterministic).**

Put **instructions** in CLAUDE.md. Put **guards** in permission rules, PreToolUse hooks, or tool allow-lists.

### What belongs in CLAUDE.md

- Style preferences ("TypeScript strict mode, no \`any\`").
- Run commands ("pnpm test runs vitest").
- Conventions ("colocate tests next to source").
- Directory maps ("/app is Next.js routes, /server is tRPC").
- Known landmines as prose ("never run prisma migrate reset on dev").

### What does NOT belong in CLAUDE.md

- Secrets or credentials — CLAUDE.md is fed to the model verbatim on every turn.
- Hard safety rules that MUST hold ("never write to /etc") — those need a PreToolUse hook that returns deny.
- Destructive-op guards ("never run rm -rf") — those need a permission deny rule, not a prose instruction.
- PII or user-specific identifiers that must not leak across sessions.

### The 9 sources in order

1. System prompt (CLI-bundled, immutable).
2. Environment info (cwd, OS, time).
3. CLAUDE.md hierarchy (4 levels — see below).
4. Path-scoped rules (\`.claude/rules/**/*.md\`, scoped to a directory).
5. Auto-memory (LLM scans up to 5 memory-file headers on demand — no embeddings).
6. Tool metadata (schemas of tools in the current permission scope).
7. Conversation history (prior user + assistant messages).
8. Tool results (outputs of tools called earlier this session).
9. Compact summaries (if compaction fired, the model-generated summary).

### The 4-level CLAUDE.md hierarchy

| Level | Path | Scope |
|---|---|---|
| Managed | /etc/claude-code/CLAUDE.md | System-wide (enterprise) |
| User | ~/.claude/CLAUDE.md | Per-user |
| Project | CLAUDE.md, .claude/CLAUDE.md, .claude/rules/*.md | Per-project |
| Local | CLAUDE.local.md | Personal (gitignored) |

Later layers specialize; they do not silently override. If you need a deterministic override, use permission rules.`,

  fullInstructions: `## Full reference: the 9 context sources

### 1. Anchor statistic and the critical design choice

The VILA-Lab Dive-into-Claude-Code paper (arXiv 2604.14228) concluded that Claude Code is ~1.6% AI decision logic and ~98.4% deterministic infrastructure. The context-construction subsystem is an instance of that split: the 9 sources are deterministic (merged in a fixed order, by a fixed algorithm), but the model's compliance with the instructions inside them is probabilistic.

The paper's §Context Construction explicitly names this as the **Critical design choice**: "CLAUDE.md is user context (probabilistic compliance), NOT system prompt (deterministic). Permission rules provide the deterministic enforcement layer."

This is, in our reading, the single most-misunderstood Claude Code design decision. Teams adopt CLAUDE.md, put a "never delete the database" line in it, and are surprised when the model occasionally does exactly that. The model was never going to enforce that rule deterministically. The enforcement belongs in permission rules, PreToolUse hooks, or the tool allow-list.

The paper also names three recurring design commitments across the codebase: graduated layering over monolithic mechanisms; append-only designs favoring auditability over query power; and model judgment within a deterministic harness. The context system instantiates all three — especially the append-only commitment, visible in the file-based memory model.

### 2. The 9 ordered context sources (architecture.md §9 Ordered Context Sources)

Before every model call, the harness assembles context from these 9 sources in order:

1. **System prompt** — CLI-bundled, immutable. Safety and tone rules live here. Users cannot override.
2. **Environment info** — cwd, OS, wall-clock time, version string. Small, always present.
3. **CLAUDE.md hierarchy** — 4 levels merged in precedence order (see §4).
4. **Path-scoped rules** — files under \`.claude/rules/**/*.md\` that apply only when the agent is working in the matching directory subtree.
5. **Auto-memory** — memory files discovered on demand; see §5 (file-based memory).
6. **Tool metadata** — the schema of every tool in the current permission scope. Layer 1 of the safety layers (pre-filtering) strips denied tools from this list.
7. **Conversation history** — prior user and assistant messages, subject to the 5 shapers (see turn-execution-pipeline pack).
8. **Tool results** — outputs of tools called earlier in the session. Treat as untrusted content (see injection-surface-audit).
9. **Compact summaries** — if Auto-Compact fired, the model-generated summary of compressed history.

Ordering rationale:

- System prompt first so the model sees safety rules before anything else.
- Environment, hierarchy, rules, and memory are the "stable" context — they change at most per-session.
- Tool metadata comes before history so the model knows its affordances before seeing what has happened.
- History and tool results are the dynamic part of the turn.
- Compact summaries are last because they are the lossiest representation; the model should prefer raw history when available.

Re-ordering these in a clone is an anti-pattern — the order encodes trust (safety rules first, untrusted tool results after).

### 3. CLAUDE.md as user context — the full argument

CLAUDE.md is injected as part of the user-visible context, not into the immutable system prompt. Practical consequences:

- **Probabilistic compliance** — the model treats CLAUDE.md as guidance, not constraint. Adherence is statistical.
- **Overridable by later messages** — a user can ask the model to ignore a CLAUDE.md instruction, and the model may comply. In the system prompt, that wouldn't be possible.
- **Visible in every turn** — CLAUDE.md content enters every model call. Anything sensitive leaks every turn.
- **Probabilistic behavior is fine for style, bad for safety** — "prefer Edit over Write" is fine; "never drop the production DB" is not.

The deterministic layer is permission rules (see seven-safety-layers pack). Rules can \`deny\` a tool call; CLAUDE.md cannot.

Concretely, if you need the agent to NEVER do X:

- Add a deny rule that matches X at the tool-argument level.
- Add a PreToolUse hook that returns \`permissionDecision: deny\` for X.
- Remove the capability from the tool allow-list entirely.

If you merely prefer the agent to usually do Y:

- Write it in CLAUDE.md as a convention.
- Add a short rationale so the model can explain a deviation.

### 4. The 4-level CLAUDE.md hierarchy (architecture.md §CLAUDE.md Hierarchy)

| Level | Path | Scope | Typical use |
|---|---|---|---|
| Managed | /etc/claude-code/CLAUDE.md | System-wide (enterprise) | Org policies; not writable by the user |
| User | ~/.claude/CLAUDE.md | Per-user | Personal style preferences across all projects |
| Project | CLAUDE.md, .claude/CLAUDE.md, .claude/rules/*.md | Per-project | Project conventions, run commands, directory map |
| Local | CLAUDE.local.md | Personal (gitignored) | Local overrides; not committed |

Precedence rule: later layers specialize. They do not silently override. If two layers contradict, the model has to reconcile, and the outcome is probabilistic — not the determinism you wanted. If you actually need a deterministic override, use permission rules at the level that should win.

Path-scoped rules live under \`.claude/rules/**/*.md\`; they apply only when the agent is working in the matching directory subtree. A file at \`.claude/rules/server/api.md\` applies when the agent edits \`server/api/**\`; it does not apply when the agent edits \`client/**\`. Path-scoped rules silently shadowing global rules is a common source of confusion — log which scoped rules fired in the transcript header.

### 5. File-based memory (architecture.md §File-Based Memory)

Claude Code's memory subsystem is deliberately anti-RAG: **no embeddings, no vector DB.** Instead, an LLM-based scan inspects up to 5 memory-file headers on demand and decides which to load fully into context.

Why this works:

- **Inspectable** — memory is just files. Open in your editor; grep by name.
- **Editable** — fix a bad memory by editing a file. No re-indexing step.
- **Version-controllable** — commit memories that belong to the repo; gitignore those that don't.
- **Auditable** — the paper's append-only commitment applied: you can diff memory across sessions.
- **Good enough at Claude Code's scale** — the paper notes that 5 relevant files on demand covers the common case; embeddings pay for the long tail, and the long tail is not where the value is.

Anti-pattern: bolting a vector DB onto a clone "because CLAUDE.md doesn't scale." Measure first. Most teams who reach for a vector DB never hit the limit of the file-based approach; they inherit latency, a new failure mode, and an opaque retrieval step in exchange for a scale they don't need.

When you might legitimately want a vector DB:

- Memory count exceeds ~500 files per project.
- You have explicit latency SLOs that the LLM-scan can't meet.
- You need cross-project retrieval beyond the ~/.claude user layer.

Even then, the vector DB should sit beside the file-based memory, not replace it. File-based is the source of truth; the vector DB is a derived index that can be rebuilt.

### 6. Path-scoped rules and precedence (architecture.md §CLAUDE.md Hierarchy)

\`.claude/rules/**/*.md\` files are scoped to a path subtree. They are loaded only when the agent's current working context matches the scope. This is useful for:

- Language-specific conventions in monorepos (\`.claude/rules/python/\` vs \`.claude/rules/typescript/\`).
- Module-level landmines (\`.claude/rules/server/billing.md\` — "never change the charge flow without a security review").
- Per-surface style (\`.claude/rules/ui/\` vs \`.claude/rules/server/\`).

Known pitfall: a path-scoped rule can silently contradict a global rule. The model has to reconcile; the outcome is probabilistic. Prevention:

- Log which scoped rules fired per turn; include in the transcript header.
- Treat path-scoped rules as a linter's lens, not a hard override.
- For hard overrides, use permission rules scoped by tool argument, not content-level conventions.

### 7. Cross-references

- **turn-execution-pipeline** — step 3 of the 9-step pipeline is "context assembly." This pack expands that step.
- **seven-safety-layers** — permission rules are the deterministic layer that CLAUDE.md deliberately is not.
- **claude-code-guide** — the operator's view of AGENTS.md / CLAUDE.md; this pack is the architectural view of why the files behave as they do.
- **injection-surface-audit** — tool results (source 8) are untrusted; the audit documents the envelope pattern.

### 8. Clone checklist

If you are porting Claude Code's context system to another harness:

1. Assemble 9 sources in the documented order; do not reorder.
2. Implement the 4-level CLAUDE.md precedence; merge, do not silently override.
3. Make memory file-based first; add vector DB only if you measure a limit.
4. Path-scoped rules log which scope fired; transcript header records it.
5. CLAUDE.md content is treated as user context — any test that asserts the model "must never do X because CLAUDE.md says so" is a test design bug; rewrite with a deterministic enforcement path.

### 9. Honest limitations

- **Probabilistic compliance is genuinely probabilistic** — the model will, on some tasks and some seeds, ignore a CLAUDE.md rule. This is not a bug; it is the design. If that is unacceptable for your rule, it is not a CLAUDE.md rule.
- **File-based memory has a scale ceiling** — 5 files scanned on demand does not cover every workload. Measure before you jump to a vector DB.
- **Precedence is merge-with-specialization, not strict override** — two contradictory rules at different levels do not resolve deterministically.
- **CLAUDE.md in the context window is a token tax** — every turn pays it. Keep CLAUDE.md terse; offload long content to skills or path-scoped rules.

### 10. License + attribution

This pack paraphrases and cites architecture content from VILA-Lab/Dive-into-Claude-Code (arXiv 2604.14228, CC-BY-NC-SA-4.0). Attribution to VILA-Lab is required; non-commercial + share-alike terms inherited on any verbatim excerpts. Paraphrased summaries are original and credited per the license. Do not remove the attribution entry from \`sources[]\`.`,

  evaluationChecklist: [
    "Team can state aloud: CLAUDE.md is user context (probabilistic); permission rules are deterministic.",
    "CLAUDE.md files in the repo contain no secrets, credentials, or PII.",
    "Any 'hard rule' in the codebase is enforced via permission rules, PreToolUse hooks, or tool allow-lists — not via CLAUDE.md prose.",
    "9 context sources are assembled in the documented order; transcript header records the fired sources.",
    "4-level CLAUDE.md hierarchy is merged with precedence; path-scoped-rule firings are logged per turn.",
    "Memory system is file-based first; vector DB (if present) is a derived index, not a replacement.",
    "New team members pass a quick quiz: 'where does the never-drop-prod-DB rule live?' — answer is not CLAUDE.md.",
  ],
  failureModes: [
    {
      symptom:
        "Agent deleted data that CLAUDE.md explicitly said to protect; team is surprised",
      trigger:
        "CLAUDE.md was treated as a hard guard; in fact it is user context with probabilistic compliance — the model does not deterministically enforce it",
      preventionCheck:
        "For any rule that MUST hold, use a deny permission rule or a PreToolUse hook; use CLAUDE.md only for style/conventions; add a quiz question to onboarding",
      tier: "mid",
    },
    {
      symptom:
        "Credential leaked to model logs via CLAUDE.md content on every turn",
      trigger:
        "Secret pasted into CLAUDE.md as 'just for now'; CLAUDE.md enters every model call verbatim; secret now visible in the transcript and the model provider's logs",
      preventionCheck:
        "CI lint blocks commit of CLAUDE.md files containing anything matching secret patterns; onboarding teaches: CLAUDE.md is context, not config; use env vars for secrets",
      tier: "sr",
    },
    {
      symptom:
        "Team spent 3 engineer-weeks on a vector-DB memory layer that ultimately got deprecated",
      trigger:
        "Someone claimed CLAUDE.md / file-based memory 'doesn't scale' without measuring; team bolted on vector DB; added latency and opaque retrieval; still had the file-based memory as a source of truth",
      preventionCheck:
        "Measure memory count and retrieval latency against the file-based baseline first; vector DB is a derived index beside files, never a replacement; alert on retrieval-mismatch between index and file truth",
      tier: "sr",
    },
    {
      symptom:
        "A safety convention in the root CLAUDE.md is silently overridden when agent works in a subdirectory; nobody knows why",
      trigger:
        "A path-scoped rule under .claude/rules/ contradicted the global rule; precedence is merge-with-specialization, not strict override — the model reconciled probabilistically and chose the scoped rule",
      preventionCheck:
        "Log per-turn which scoped rules fired; audit path-scoped rules for implicit contradictions with globals; use permission rules for hard constraints",
      tier: "mid",
    },
    {
      symptom:
        "Model cites 'CLAUDE.md says...' when refusing a task, then the next turn ignores the same file",
      trigger:
        "Probabilistic compliance is genuinely probabilistic — same seed, same prompt can yield different outcomes across turns; CLAUDE.md is guidance, not constraint",
      preventionCheck:
        "Accept that CLAUDE.md compliance is statistical; for rules that cannot tolerate variance, move enforcement to permission rules or hooks; surface the variance in evals, do not paper over it",
      tier: "mid",
    },
  ],

  securityReview: {
    injectionSurface: "low",
    toolAllowList: [],
    lastScanned: "2026-04-19",
    knownIssues: [
      "This is a reference pack with no executable code; injection surface is low because the pack itself does not fetch, execute, or parse untrusted input.",
      "The patterns described here (CLAUDE.md as user context) carry risks the pack discusses explicitly: secrets in CLAUDE.md leak to the model on every turn; path-scoped rules can shadow globals.",
    ],
  },

  rediscoveryCost: {
    tokens: 42000,
    minutes: 95,
    measuredAt: "2026-04-19",
    methodology:
      "Prompted a fresh Claude Sonnet 4.6 with 'enumerate Claude Code's context assembly sources in order, describe the CLAUDE.md hierarchy with precedence, and explain why CLAUDE.md is NOT a system prompt — citable from primary sources'. Measured tokens until the output covered the 9 sources in order, the 4 hierarchy levels with paths, the file-based memory model (no embeddings, up to 5 files on demand), and the critical distinction that CLAUDE.md is probabilistic user context while permission rules are deterministic. Cross-referenced against VILA-Lab architecture.md §Context Construction and Memory and §CLAUDE.md Hierarchy. Averaged over 3 runs plus ~20 minutes of reading time in the source paper and companion docs.",
  },

  relatedPacks: [
    "claude-code-guide",
    "turn-execution-pipeline",
    "seven-safety-layers",
  ],
  requires: [],
  conflictsWith: [],
  supersedes: [],
  comparesWith: [
    {
      slug: "claude-code-guide",
      axis: "maintainability",
      winner: "tie",
      note: "Claude Code Guide is the operator recipe (how to write AGENTS.md/CLAUDE.md); this pack is the architectural why (what CLAUDE.md is and is not). Use the guide to write the file, this pack to decide what belongs in it.",
    },
    {
      slug: "rag-hybrid-bm25-vector",
      axis: "complexity",
      winner: "self",
      note: "Vector-DB RAG is the canonical retrieval pattern; Claude Code's file-based memory is the opposite bet (no embeddings, LLM scan of up to 5 file headers). Compare costs: vector adds index + latency + opacity; file-based is simple and auditable. Start with file-based; measure before adopting vector.",
    },
    {
      slug: "seven-safety-layers",
      axis: "accuracy",
      winner: "other",
      note: "Safety layers are where enforcement lives deterministically; CLAUDE.md is where instruction lives probabilistically. For hard rules, safety-layers wins on accuracy because it actually blocks calls; this pack explains why CLAUDE.md can't.",
    },
  ],

  changelog: [
    {
      version: "0.1.0",
      date: "2026-04-19",
      added: [
        "All 9 context sources in assembly order with rationale",
        "4-level CLAUDE.md hierarchy (managed / user / project / local) with paths and scopes",
        "File-based memory model explained (no embeddings, LLM scan of up to 5 file headers on demand)",
        "Critical design choice foregrounded: CLAUDE.md is user context (probabilistic), permission rules are deterministic",
        "Path-scoped rules precedence and the silent-shadowing pitfall",
        "5 tiered failure modes including secrets-in-CLAUDE.md and vector-DB-premature-optimization cases",
      ],
      removed: [],
      reason: "Initial publish, sourced from VILA-Lab Dive-into-Claude-Code",
    },
  ],

  metrics: [
    { label: "Context sources", value: "9" },
    { label: "CLAUDE.md levels", value: "4" },
    { label: "Memory scan depth", value: "≤5 files" },
    { label: "Embeddings required", value: "0" },
  ],

  sources: [
    {
      label: "VILA-Lab — Dive into Claude Code (arXiv 2604.14228)",
      url: "https://arxiv.org/abs/2604.14228",
      note: "Primary source. Licensed CC-BY-NC-SA-4.0 — attribution to VILA-Lab required for all derived packs; non-commercial + share-alike terms inherited on verbatim excerpts. Anchor statistic (~1.6% AI / 98.4% infrastructure) and the 'CLAUDE.md is user context, not system prompt' design choice cited from this paper.",
    },
    {
      label: "VILA-Lab — architecture.md §Context Construction and Memory",
      url: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/architecture.md#context-construction-and-memory",
      note: "Section-level source for the 9 ordered context sources, the 4-level CLAUDE.md hierarchy, and the file-based memory model documented in this pack.",
    },
    {
      label: "Anthropic — Claude Code memory and context docs",
      url: "https://docs.anthropic.com/en/docs/claude-code/memory",
      note: "Vendor reference for CLAUDE.md discovery, memory file conventions, and context-assembly behavior.",
    },
    {
      label: "AGENTS.md — cross-tool convention site",
      url: "https://agents.md/",
      note: "Cross-tool specification for the AGENTS.md/CLAUDE.md file; adopted by Claude Code, Codex CLI, Cursor, Aider, Continue.",
    },
  ],
  examples: [
    {
      label: "architecture.md — Context Construction and Memory",
      href: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/architecture.md#context-construction-and-memory",
      external: true,
    },
    {
      label: "claude-code-guide — how to write AGENTS.md in practice",
      href: "/packs/claude-code-guide",
      external: false,
    },
  ],
};

export default nineContextSources;
