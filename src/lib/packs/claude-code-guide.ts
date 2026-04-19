import type { Pack } from "@/lib/pack-schema";

/**
 * Claude Code Guide pack.
 *
 * Reference pack documenting how Claude Code's agent harness actually
 * works in production: AGENTS.md discovery, .claude/skills convention,
 * subagent delegation via the Task tool, PostToolUse hooks, session
 * memory, context window strategies, and the Edit-vs-Write decision.
 */
export const claudeCodeGuide: Pack = {
  slug: "claude-code-guide",
  name: "Claude Code Guide",
  tagline: "How the Claude Code harness actually works — AGENTS.md, skills, hooks, subagents.",
  summary:
    "Reference guide to the Claude Code harness in production use. Covers the AGENTS.md convention (now adopted in 60k+ repos), the .claude/skills directory structure, subagent delegation via the Task tool, PostToolUse hooks for automation, session memory layout, context-window tactics, and the decision tree between Edit and Write. Written for teams onboarding Claude Code into a real codebase, not for demos.",
  packType: "reference",
  canonicalPattern: "n/a",
  version: "0.1.0",

  trust: "Community",
  status: "Recommended",
  featured: true,
  publisher: "Agent Workspace",
  gradient: "from-emerald-500 via-teal-500 to-cyan-600",
  updatedAt: "2026-04-17",
  compatibility: ["claude-code", "cursor", "codex-cli"],
  tags: ["reference", "claude-code", "agents-md", "skills", "hooks", "subagents"],

  installCommand: "npx attrition-sh pack install claude-code-guide",
  claudeCodeSnippet:
    "Skill `claude-code-guide` is installed at .claude/skills/claude-code-guide/SKILL.md. Invoke whenever the user asks how Claude Code discovers project instructions, how skills get loaded, how subagents are spawned, or how to wire PostToolUse hooks. Prefer Edit over Write for existing files; escalate to a subagent whenever a read-heavy exploration step would burn more than ~10k of the main thread's context.",
  rawMarkdownPath: "/packs/claude-code-guide/raw",

  useWhen: [
    "Onboarding a new team to Claude Code and you need a durable reference on harness mechanics.",
    "You're debugging why a skill isn't loading or an AGENTS.md instruction is being ignored.",
    "You want to add PostToolUse hooks for lint/format/test without rewriting the runbook each time.",
    "You need to decide when to delegate to a subagent vs stay on the main thread.",
  ],
  avoidWhen: [
    "You're using a different harness (Cursor-only, Continue, Aider) — the mechanics differ substantively.",
    "You only need a quick copy-paste snippet — this is a reference pack, not a recipe.",
    "You're building a non-agentic chat product — the skills and hooks model doesn't apply.",
  ],
  keyOutcomes: [
    "Every repo has an AGENTS.md at the root and a matching .claude/skills/ layout.",
    "PostToolUse hooks run format + type-check without polluting the agent's context window.",
    "Subagent delegation keeps the main thread's context under 60% utilisation on long tasks.",
    "Edit is used for in-place file mutation; Write is reserved for new files or full rewrites.",
  ],

  minimalInstructions: `## Minimal setup — an AGENTS.md + one skill

Create two files in your repo root:

\`\`\`
AGENTS.md
.claude/
  skills/
    repo-conventions/
      SKILL.md
\`\`\`

\`AGENTS.md\` is the project charter. Keep it under 200 lines. Cover: how to run tests, lint, and build; naming conventions; where to put new code; what NOT to touch. Claude Code auto-loads this on every session in the repo.

\`.claude/skills/repo-conventions/SKILL.md\` is a "skill" — a short markdown file with YAML frontmatter describing when the skill applies. Example:

\`\`\`markdown
---
name: repo-conventions
description: Use this skill when writing or modifying code in this repo. Enforces naming, imports, and test placement conventions.
---

# Repo conventions

- TypeScript strict mode. No \`any\`.
- Tests colocated: \`foo.ts\` next to \`foo.test.ts\`.
- Import sort: external, then internal (\`@/lib/...\`), then relative.
- Never edit \`*_generated.ts\` by hand.
\`\`\`

That's the 80% setup. Claude Code will surface the skill whenever the description matches the task.

### Optional: one PostToolUse hook

In \`.claude/settings.json\`:

\`\`\`json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "npx prettier --write \\"$CLAUDE_FILE_PATHS\\"" }]
      }
    ]
  }
}
\`\`\`

This runs Prettier on every file touched by Edit or Write — the agent never has to remember to format.`,

  fullInstructions: `## Full reference: Claude Code in production

### 1. Discovery order

Claude Code loads context in this precedence, highest first:

1. System prompt (CLI-bundled, immutable).
2. \`~/.claude/CLAUDE.md\` — user-global instructions across every project.
3. \`<repo>/AGENTS.md\` (or \`CLAUDE.md\` — both are honoured; AGENTS.md is the cross-tool convention).
4. \`<repo>/.claude/skills/**/SKILL.md\` — surfaced on-demand when the frontmatter \`description\` matches the task.
5. User messages in the chat.

Practical consequence: put universal style preferences in \`~/.claude/CLAUDE.md\`, project-specific rules in \`AGENTS.md\`, and task-scoped recipes in skills. Do not duplicate across layers — later layers should specialise, not override.

### 2. AGENTS.md — the project charter

The AGENTS.md convention was introduced by Anthropic and subsequently adopted by OpenAI's Codex CLI, Cursor, Aider, Continue, and many others. As of early 2026 the file is committed in 60,000+ public GitHub repos.

Keep it terse. An effective AGENTS.md covers:

- **Run commands**: test, lint, build, dev server.
- **Directory map**: one line per top-level directory.
- **Conventions**: naming, imports, test placement, forbidden patterns.
- **Definition of done**: what passes before a task is considered complete.
- **Known landmines**: "never run \`prisma migrate reset\` — it drops the dev seed."

Anti-patterns:

- Dumping the entire style guide. Link to it instead.
- Storing secrets or anything that must not appear in logs. AGENTS.md content is visible in every agent run.
- Marketing copy. The agent doesn't care that your product is "delightful."

### 3. Skills — scoped, on-demand expertise

A skill is a directory under \`.claude/skills/<name>/\` containing at least a \`SKILL.md\`. The frontmatter \`description\` is a retrieval key — Claude Code loads the body when a task matches it.

\`\`\`markdown
---
name: migrate-prisma
description: Use this skill when adding a Prisma migration. Enforces naming, reversibility, and CI smoke-test update.
---

# Prisma migration recipe
1. \`pnpm prisma migrate dev --name <slug>\`
2. Review generated SQL for destructive ops; abort if any \`DROP\`.
3. Update \`scripts/smoke-test.ts\` to exercise the new columns.
4. Commit migration + smoke test together.
\`\`\`

Skills can include \`scripts/\` and \`references/\` subdirectories. The agent can read them on demand with the Read tool — they do NOT all enter context at invocation. That is the unlock: dozens of skills cost zero baseline context.

### 4. Subagent delegation (Task tool)

The Task tool spawns a subagent with its own isolated context. The subagent runs to completion and returns a single text message to the parent.

Use it when:

- **Wide exploration**: "find every call site of this function" — subagent reads 50 files, parent gets a 500-token summary.
- **Parallel investigation**: three subagents in parallel, each chasing a hypothesis.
- **Context hygiene**: the parent's context is getting long and the upcoming step is read-heavy.

Do not use it when:

- The main thread already has the files in context — re-reading in a subagent wastes tokens.
- The task requires state that lives only in the parent (a half-written plan, an uncommitted edit).
- One step away from done.

### 5. Hooks — PostToolUse, PreToolUse, Stop

Configured in \`.claude/settings.json\`:

\`\`\`json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "pnpm lint --fix \\"$CLAUDE_FILE_PATHS\\"" },
          { "type": "command", "command": "pnpm tsc --noEmit" }
        ]
      }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "pnpm test --run" }] }
    ]
  }
}
\`\`\`

Key facts:

- Hook stdout is fed back into the agent's context as tool output.
- Hook stderr with non-zero exit causes the agent to see a failure and react.
- \`$CLAUDE_FILE_PATHS\` is injected for Edit/Write matchers; space-separated.
- PreToolUse can block a call by exiting non-zero — used to enforce "never edit \`_generated/\` files."

The practical wedge: hooks take the "did the agent remember to run the tests" problem off the table. The harness runs them every time.

### 6. Session memory

Claude Code persists three kinds of state across a session:

- **Conversation history**: full turn log, kept until compaction.
- **Plans**: if the agent writes a plan via the todo tool, it survives.
- **Scratch files** in \`.claude/scratch/\`: optional, project-local.

When the context window gets tight, the harness runs auto-compaction: older turns are replaced by a summary. You can force it earlier with \`/compact\`.

### 7. Context-window tactics

At 200k tokens the budget feels infinite. It is not — large repos blow through it.

- **Read less, search more**: prefer Grep / smart_search over Read when you don't know the file.
- **Unfold, don't Read**: structural tools like \`smart_outline\` + \`smart_unfold\` return only the symbol you need.
- **Delegate wide reads**: subagent returns a summary, parent keeps the synthesis.
- **Edit, don't Write**: Edit sends only the diff; Write ships the whole file back into context.
- **Prune plans**: drop completed todos; don't let the list grow unboundedly.

### 8. Edit vs Write — the decision tree

\`\`\`
Does the file already exist?
├─ No  → Write
└─ Yes → Are you changing <30% of the content?
          ├─ Yes → Edit (with replace_all if mass rename)
          └─ No  → Write only if a full rewrite is clearly simpler; otherwise a
                   sequence of Edit calls stays cheaper on the context budget.
\`\`\`

Edit failures usually mean the \`old_string\` isn't unique — widen the context before retrying. If three Edits in a row fail, step back and Read the current state.

### 9. The todo tool

Claude Code ships a built-in todo tool. Use it when:

- The task is ≥3 distinct steps.
- You need visible progress for the user.
- You want a durable plan that survives compaction.

Do not use it for:

- Single-step tasks — visible noise.
- Exploratory work where the steps aren't yet known.

Always maintain exactly one \`in_progress\` todo at a time. Mark complete the moment a task finishes — batch completions erode trust.

### 10. Installation and updates

\`\`\`bash
npm install -g @anthropic-ai/claude-code
claude  # launches the CLI in the current directory
\`\`\`

Version and harness identifier surface via \`claude --version\`. Pin the version in CI if hook behaviour matters.

### 11. Common misunderstandings

1. "Skills are auto-loaded into context." No. The frontmatter is indexed; the body loads on demand.
2. "AGENTS.md overrides the system prompt." No. The system prompt safety rules are immutable.
3. "Subagents share memory with the parent." No. Only the return text enters the parent's context.
4. "Hooks run in the agent's turn." Hooks are external processes; they don't count against model tokens but their output does.
5. "CLAUDE.md and AGENTS.md are different." In Claude Code they are equivalent; AGENTS.md is preferred because other tools honour it.`,

  evaluationChecklist: [
    "Repo has AGENTS.md (or CLAUDE.md) at the root with run commands and conventions.",
    ".claude/skills/ contains at least one skill with valid YAML frontmatter and description.",
    "PostToolUse hooks auto-run formatter and type-check on Edit/Write.",
    "Subagent delegation is used for any read-heavy exploration >10 files.",
    "Agent prefers Edit over Write for existing files; Write reserved for new files.",
    "Todo tool is used on tasks with ≥3 steps and kept to one in-progress item at a time.",
    "AGENTS.md does not contain secrets or sensitive identifiers.",
  ],
  failureModes: [
    {
      symptom: "Skill body never appears in context even though the task matches",
      trigger: "SKILL.md frontmatter description is vague ('useful for coding') so the retriever doesn't match",
      preventionCheck: "Write descriptions as 'Use this skill when <concrete trigger phrase>'; include 2-3 synonyms",
      tier: "mid",
    },
    {
      symptom: "Agent keeps running tests twice or reformats on every turn",
      trigger: "PostToolUse hook matcher is too broad (e.g. '.*'), firing on Read/Grep tools",
      preventionCheck: "Scope the matcher to 'Edit|Write' only; validate with a dry-run on a scratch branch",
      tier: "mid",
    },
    {
      symptom: "Main thread runs out of context at 40% of the task",
      trigger: "Every file read happens on the main thread; no subagent delegation for wide explorations",
      preventionCheck: "Delegate any >10-file read to a subagent; parent keeps only the summary",
      tier: "sr",
    },
    {
      symptom: "Agent edits a _generated file and CI breaks",
      trigger: "No PreToolUse guard blocking writes to generated paths",
      preventionCheck: "Add PreToolUse hook that exits non-zero when matcher is Edit|Write and path matches generated globs",
      tier: "sr",
    },
  ],

  securityReview: {
    injectionSurface: "medium",
    toolAllowList: ["Read", "Edit", "Write", "Grep", "Glob", "Bash", "Task"],
    lastScanned: "2026-04-17",
    knownIssues: [
      "AGENTS.md contents are trusted by the agent; a malicious PR that modifies AGENTS.md is an injection vector — require code review on AGENTS.md changes.",
    ],
  },

  rediscoveryCost: {
    tokens: 45000,
    minutes: 90,
    measuredAt: "2026-04-17",
    methodology:
      "Prompted a fresh Claude Sonnet 4.6 with 'explain how Claude Code discovers project instructions, how skills load, how subagents work, and how PostToolUse hooks are configured, with working config snippets'. Measured tokens until the output covered AGENTS.md precedence, skill frontmatter retrieval, Task tool isolation, hook matchers, and Edit vs Write heuristics. Averaged over 3 runs.",
  },

  relatedPacks: ["pattern-decision-tree", "golden-eval-harness"],
  requires: [],
  conflictsWith: [],
  supersedes: [],
  comparesWith: [
    {
      slug: "cursor-rules-guide",
      axis: "maintainability",
      winner: "self",
      note: "AGENTS.md is honoured by Claude Code, Codex CLI, Cursor, Aider, and Continue. Cursor .cursorrules is single-tool.",
    },
    {
      slug: "pattern-decision-tree",
      axis: "complexity",
      winner: "tie",
      note: "Decision-tree covers WHICH pattern to pick; this pack covers HOW the Claude Code harness executes the chosen pattern. Use together.",
    },
  ],

  changelog: [
    {
      version: "0.1.0",
      date: "2026-04-17",
      added: [
        "AGENTS.md precedence and authoring guidance",
        "Skills directory layout and frontmatter retrieval notes",
        "Subagent delegation heuristics (Task tool)",
        "PostToolUse / PreToolUse / Stop hook examples",
        "Edit vs Write decision tree and context-window tactics",
      ],
      removed: [],
      reason: "Seed pack — first release. Reference material for teams onboarding Claude Code.",
    },
  ],

  metrics: [
    { label: "Typical tokens saved", value: "45k" },
    { label: "Rediscovery time", value: "~90 min" },
    { label: "AGENTS.md adoption", value: "60k+ repos" },
  ],

  sources: [
    {
      label: "Anthropic — Claude Agent SDK docs",
      url: "https://docs.anthropic.com/en/docs/claude-code/overview",
      note: "Primary source for Claude Code harness behaviour, hook types, and the Task/subagent model.",
    },
    {
      label: "AGENTS.md — convention site",
      url: "https://agents.md/",
      note: "Cross-tool AGENTS.md specification adopted by Codex CLI, Cursor, Aider, Continue, and Claude Code.",
    },
    {
      label: "LangChain — DeepAgents blog post",
      url: "https://blog.langchain.com/deep-agents/",
      note: "Overview of the subagent delegation pattern that Claude Code's Task tool implements.",
    },
    {
      label: "Anthropic — Claude Code settings reference",
      url: "https://docs.anthropic.com/en/docs/claude-code/settings",
      note: "Canonical reference for .claude/settings.json hook matchers and configuration surface.",
    },
    {
      label: "Decoding the Configuration of AI Coding Agents (arXiv 2511.09268)",
      url: "https://arxiv.org/abs/2511.09268",
      note: "Empirical study of 328 Claude Code configuration files — surfaces SE concerns and co-occurrence patterns in real-world usage.",
    },
  ],
  examples: [
    {
      label: "AGENTS.md spec and examples",
      href: "https://agents.md/",
      external: true,
    },
    {
      label: "Anthropic Claude Code docs",
      href: "https://docs.anthropic.com/en/docs/claude-code/overview",
      external: true,
    },
  ],
};

export default claudeCodeGuide;
