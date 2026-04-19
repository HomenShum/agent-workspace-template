import type { Pack } from "@/lib/pack-schema";

/**
 * Extensibility — Four Mechanisms pack.
 *
 * Decision tree for Hooks / Skills / Plugins / MCP Servers at graduated
 * context cost, the 5-step tool pool assembly (base enumeration up to 54
 * tools → mode filtering → deny pre-filter → MCP integration → dedup), and
 * the three injection points (assemble / model / execute). Reference pack
 * derived from VILA-Lab/Dive-into-Claude-Code §Extensibility.
 */
export const extensibilityFourMechanisms: Pack = {
  slug: "extensibility-four-mechanisms",
  name: "Extensibility — Four Mechanisms",
  tagline:
    "Hooks → Skills → Plugins → MCP. Graduated context cost, three injection points, one decision tree.",
  summary:
    "Reference pack covering Claude Code's four extension mechanisms derived from the VILA-Lab architectural analysis (arXiv 2604.14228). Frames the graduated context-cost hierarchy — Hooks (zero context, 27 events, 4 exec types) → Skills (low, SKILL.md with 15+ YAML fields, injected via SkillTool) → Plugins (medium, 10 component types) → MCP Servers (high, 7 transport types). Documents the 5-step tool pool assembly (base enumeration up to 54 tools → mode filtering → deny pre-filter → MCP integration → dedup) and the three injection points in the loop: assemble() (what the model sees), model() (what it can reach), execute() (whether/how it runs). The pack is a decision tree: which mechanism should you reach for, and why reaching for MCP first is the most common mistake.",
  packType: "reference",
  canonicalPattern: "n/a",
  version: "0.1.0",

  trust: "Community",
  status: "Recommended",
  featured: false,
  publisher: "Agent Workspace",
  gradient: "from-emerald-500 via-green-500 to-teal-600",
  updatedAt: "2026-04-19",
  compatibility: ["claude-code", "cursor", "codex"],
  tags: [
    "reference",
    "extensibility",
    "hooks",
    "skills",
    "plugins",
    "mcp",
    "tool-pool",
    "claude-code",
    "dive-into-claude-code",
  ],

  installCommand: "npx attrition-sh pack install extensibility-four-mechanisms",
  claudeCodeSnippet:
    "Skill `extensibility-four-mechanisms` is installed at .claude/skills/extensibility-four-mechanisms/SKILL.md. Invoke when the user asks how to extend the harness — adding a lint-on-save behaviour, a new tool, a project-scoped recipe, or a third-party integration. Traverse the decision tree top-down: Hook (lifecycle, zero context) → Skill (on-demand instructions, low context) → Plugin (bundle of components, medium) → MCP Server (new tool surface, high). The most common mis-reach is starting at MCP when a Hook or Skill would have been sufficient.",
  rawMarkdownPath: "/packs/extensibility-four-mechanisms/raw",

  useWhen: [
    "You need to add an automated behaviour (format on save, run tests on stop) and want zero context overhead.",
    "You have project-specific recipes you want the agent to consult on demand without bloating every session.",
    "You want to distribute a coherent bundle of commands + skills + hooks + MCP as a single installable unit.",
    "You need to integrate an external tool surface the harness does not already offer.",
  ],
  avoidWhen: [
    "You are debating which LLM to route to — that is the advisor-pattern-v2 territory, not extensibility.",
    "You need short-term, single-session guidance only — a CLAUDE.md note is cheaper than any of the four mechanisms.",
    "You need to constrain output shape or contract — that is a pack-contract concern, not an extension mechanism.",
  ],
  keyOutcomes: [
    "Every new behaviour is implemented at the lowest-cost mechanism that satisfies its requirement.",
    "Tool-pool assembly is understood: base → mode filter → deny → MCP → dedup, in that order.",
    "Each extension is placed at the correct injection point (assemble / model / execute).",
    "MCP is reserved for genuinely new tool surfaces; Hooks and Skills cover the rest.",
    "Plugins ship as coherent bundles only when multiple component types must install together.",
  ],

  minimalInstructions: `## Minimal setup — one Hook, one Skill, and knowing when to stop

Start at the lowest-cost mechanism and only promote when it can't carry the load.

\`\`\`
.claude/
  settings.json              # Hooks
  skills/
    repo-conventions/
      SKILL.md              # Skill
\`\`\`

\`.claude/settings.json\`:

\`\`\`json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "pnpm lint --fix \\"$CLAUDE_FILE_PATHS\\"" }
        ]
      }
    ]
  }
}
\`\`\`

\`.claude/skills/repo-conventions/SKILL.md\`:

\`\`\`markdown
---
name: repo-conventions
description: Use this skill when writing or modifying code in this repo. Enforces naming, imports, and test placement.
---

# Repo conventions
- TypeScript strict, no \`any\`.
- Tests colocated: \`foo.ts\` next to \`foo.test.ts\`.
\`\`\`

That covers ~80% of extensibility needs at zero + low context cost.
Only reach for Plugin or MCP once you've confirmed Hooks and Skills cannot.`,

  fullInstructions: `## Full reference: extensibility in production

Derived from architecture.md §Extensibility: MCP, Plugins, Skills, and Hooks and §Tool Pool Assembly, plus build-your-own-agent.md Decision 4, in the VILA-Lab/Dive-into-Claude-Code paper (arXiv 2604.14228). All section references below are to architecture.md unless noted.

### 1. The graduated context-cost hierarchy

The paper (§Four Extension Mechanisms) is explicit about the cost tiers:

| Mechanism | Context Cost | Key Capability |
|:--|:--|:--|
| Hooks | Zero | 27 events, 4 execution types (shell, LLM, webhook, subagent verifier) |
| Skills | Low | SKILL.md with 15+ YAML frontmatter fields, injected via SkillTool meta-tool |
| Plugins | Medium | 10 component types (commands, agents, skills, hooks, MCP, LSP, styles, channels, settings, user config) |
| MCP Servers | High | External tools via 7 transport types (stdio, SSE, HTTP, WebSocket, SDK, IDE) |

The cost tiers are not cosmetic. Every pool-assembly decision in the harness honors them — Hooks never touch the context window, Skills inject only on demand, Plugins consume budget proportional to their active components, and every MCP tool carries schema and resource tokens on every turn it is active.

### 2. Decision tree — which mechanism to reach for

Traverse top-down. Stop at the first mechanism that satisfies the requirement.

\`\`\`
Does the behaviour happen AROUND tool calls (before, after, on stop)?
├─ Yes → Hook.
└─ No  → Is it project-specific guidance the agent should consult on demand?
         ├─ Yes → Skill.
         └─ No  → Does it bundle multiple component types (commands + agents + hooks + MCP)?
                  ├─ Yes → Plugin.
                  └─ No  → Does it expose a NEW tool surface (API the harness doesn't know)?
                           ├─ Yes → MCP Server.
                           └─ No  → You don't need an extension. Use CLAUDE.md or a chat message.
\`\`\`

The most common mis-reach: starting at MCP when a Hook or Skill would suffice. A server that runs Prettier is a Hook, not an MCP. A recipe for Prisma migrations is a Skill, not an MCP. Reach for MCP when and only when the capability is a tool the harness does not already have — and even then, check whether a \`Bash\` invocation from a Hook would carry less context cost.

### 3. Hooks — 27 events, 4 execution types

From architecture.md §Four Extension Mechanisms:

- **27 hook events** across 5 categories (PreToolUse, PostToolUse, Stop, SubagentStop, and lifecycle phases). The paper references this exact count — resist the urge to invent new events.
- **4 execution types**: shell commands, LLM-evaluated expressions, webhook calls, subagent verifiers. Shell is the default; LLM-evaluated fires a small model call against the hook's condition.
- Configured in \`.claude/settings.json\`. Matcher syntax is a regex against tool names (\`Edit|Write\`) or path globs.
- Stdout is fed back to the agent as tool output; non-zero exit on a PreToolUse hook blocks the call.

Canonical uses:

\`\`\`json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "node .claude/deny-generated.js \\"$CLAUDE_FILE_PATHS\\"" }] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "pnpm lint --fix \\"$CLAUDE_FILE_PATHS\\"" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "pnpm test --run" }] }
    ]
  }
}
\`\`\`

Hook anti-patterns documented by the paper and community:

- Firing a hook that triggers another hook without idempotency — a loop.
- Matcher \`.*\` on PostToolUse, causing every Read/Grep to spawn side effects.
- Hooks that mutate files the agent is mid-editing; PostToolUse runs before the next Read.

### 4. Skills — low context, on-demand injection

Skills live at \`.claude/skills/<name>/SKILL.md\`. The paper (§Extensibility) cites "15+ YAML frontmatter fields." Minimum viable frontmatter is \`name\` + \`description\`; practical sets include \`tools\`, \`disallowedTools\`, \`version\`, \`model\`, and \`scope\`.

Injection semantics (architecture.md §Three Injection Points — \`assemble()\`):

- The frontmatter \`description\` is indexed.
- The body loads on demand when the description matches the current task.
- SkillTool is the meta-tool that performs the injection.
- The subdirectories \`scripts/\` and \`references/\` are available to Read but do not enter context on invocation.

Classifier drift is the dominant failure mode (see failure modes below): if the frontmatter \`description\` says one thing and the body does another, the SkillTool classifier mis-routes. Write descriptions as "Use this skill when <concrete trigger phrase>" and mirror the trigger language in the body's first heading.

### 5. Plugins — 10 component types

The paper cites 10 component types in a plugin manifest: commands, agents, skills, hooks, MCP servers, LSP servers, output styles, channels, settings, user config. A plugin is the right mechanism when multiple component types must install together as a coherent bundle.

Sizing rule of thumb:

- 1-2 components → ship them directly (a hook in \`.claude/settings.json\`, a skill in \`.claude/skills/\`). No plugin wrapper.
- 3+ components that share a theme → plugin.
- Plugin with only hooks, nothing else → still a plugin only if the hooks need to be versioned and distributed; otherwise commit them to the repo.

The failure mode to watch: plugin bloat. An installed plugin's components all count toward the pool even when not triggered. Trim aggressively.

### 6. MCP Servers — 7 transport types

From architecture.md §Four Extension Mechanisms, MCP transports are \`stdio\`, \`SSE\`, \`HTTP\`, \`WebSocket\`, \`SDK\`, and \`IDE\` (the paper cites 7; implementations may pack variants into a single label). The paper is explicit that MCP is the highest-cost mechanism and should be reserved for genuinely new tool surfaces.

Practical MCP discipline:

- Each MCP server's tool schemas count against the context window every turn they are active.
- The harness's built-in tool count is already up to 54 (architecture.md §Tool Pool Assembly). Adding 20 MCP tools on top meaningfully shrinks usable context.
- MCP tools run under the same permission gate as built-ins — deny rules apply across the whole pool.
- The 7 transport variants matter for latency and reliability, not for what the model sees; pick stdio locally and HTTP/SSE for remote.

### 7. Tool pool assembly — 5 steps

From architecture.md §Tool Pool Assembly (5-step pipeline):

1. **Base enumeration** (up to 54 tools)
2. **Mode filtering** (active permission mode decides which classes are visible)
3. **Deny rule pre-filtering** (blanket-denied tools removed entirely)
4. **MCP integration** (MCP tools added after deny-filter)
5. **Deduplication**

Two consequences worth internalising:

- Deny rules are enforced BEFORE the model ever sees the tool. Denied tools are not in the pool; the model cannot ask for them. This is the paper's paragraph on "strip denied tools from the model's view entirely" (§Permission System).
- MCP tools come in AFTER the deny-filter pass. If you want to block an MCP tool, add an explicit deny rule — the MCP server's own allow-list does not run first.

### 8. Three injection points

The paper (§Three Injection Points) names the three places a mechanism can intervene:

- **assemble()** — What the model sees. Hooks inject context here, skills load SKILL.md bodies here, CLAUDE.md gets read here.
- **model()** — What the model can reach. Tool pool assembly happens here; MCP tools and skill-tool meta-tools become visible.
- **execute()** — Whether/how an action runs. Permission rules, PreToolUse / PostToolUse hooks, Stop hooks.

Mapping mechanisms to injection points:

| Mechanism | assemble | model | execute |
|:--|:--:|:--:|:--:|
| Hooks | yes (context injection) | - | yes (pre/post) |
| Skills | yes (SKILL.md body) | yes (SkillTool meta) | - |
| Plugins | inherits from components | inherits | inherits |
| MCP Servers | yes (tool schemas) | yes (tools) | - |

This map is the reason Hooks are zero-cost at assemble() and Skills are low-cost — they do not pre-populate the context.

### 9. Cost-budgeting rule of thumb

For a session that is expected to last >10 turns:

- Hooks: unlimited.
- Skills: hundreds are fine; only frontmatter descriptions are indexed baseline.
- Plugins: enumerate active components; budget per MCP server, per always-on Skill.
- MCP: budget as if every tool schema adds ~200-400 tokens to every turn. 20 MCP tools means ~4-8k tokens per turn before the conversation starts.

### 10. Common misunderstandings

1. "MCP is 'the' extension mechanism." No. MCP is the highest-cost one and the last one to reach for.
2. "Skills all load at startup." No. Only the frontmatter descriptions are indexed; bodies load on demand via SkillTool.
3. "Hooks fire in the model's turn and cost tokens." Hooks run externally; their stdout enters context as tool output but the hook execution itself is free.
4. "Plugin component counts are additive with no penalty." Every plugin component contributes to pool assembly; unused plugins still claim budget.

### 11. Relationship to other packs

- \`claude-code-guide\` — the broader reference; extensibility is one of its sections.
- \`subagent-delegation-three-isolation-modes\` — subagents are spawned via AgentTool (a tool-pool entry); this pack explains where it sits in the pool.
- \`injection-surface-audit\` — MCP and hook-injected context are injection surfaces; this pack places them, that pack audits them.`,

  evaluationChecklist: [
    "Every new behaviour was evaluated top-down: Hook → Skill → Plugin → MCP, with the lowest-cost match taken.",
    "PostToolUse and PreToolUse matchers are scoped (not `.*`) and idempotent.",
    "Skill frontmatter `description` starts with 'Use this skill when <trigger phrase>' and mirrors the body's first heading.",
    "Plugins are used only when ≥3 component types must install together.",
    "MCP servers are reserved for genuinely new tool surfaces; built-in + Bash coverage is verified first.",
    "Tool pool assembly order (base → mode → deny → MCP → dedup) is understood by the team.",
    "Per-turn MCP schema cost is measured; total stays under 15% of the effective context budget.",
    "Each extension is mapped to its injection point (assemble / model / execute) in the repo's design notes.",
  ],
  failureModes: [
    {
      symptom:
        "Every feature request ships as a new MCP server; monthly token spend grows 3x over a quarter even though traffic is flat",
      trigger:
        "MCP-everything pattern — team reaches for MCP first because it feels 'proper'; each active server's schemas consume context every turn",
      preventionCheck:
        "Require a filed rationale that Hooks + Skills cannot satisfy the need before approving an MCP server; measure per-turn MCP schema bytes; cap at 15% of context budget",
      tier: "staff",
      relatedPacks: ["claude-code-guide"],
    },
    {
      symptom:
        "Pool assembly takes longer every week; context ballooned with plugin components that never fire",
      trigger:
        "Plugin bloat — plugins installed for one use case but their other components (always-on skills, always-on MCP) consume budget on every turn",
      preventionCheck:
        "Audit installed plugins quarterly; uninstall or narrow scope for any component that did not execute in the last 90 days; enforce via telemetry",
      tier: "sr",
      relatedPacks: ["claude-code-guide"],
    },
    {
      symptom:
        "Skill body never loads even though the task clearly matches; SkillTool classifier picks a different skill",
      trigger:
        "Skill description drift — SKILL.md frontmatter `description` says one thing; body heading and content say another; classifier mis-routes on the description's stale wording",
      preventionCheck:
        "Require body's first heading to mirror the trigger phrase in frontmatter description; add a CI check that diffs description keywords against body headings",
      tier: "sr",
      relatedPacks: ["claude-code-guide"],
    },
    {
      symptom:
        "A hook fires infinitely, stalling the loop; CPU pegged on the developer's machine",
      trigger:
        "Hook that spawns a hook — PostToolUse on Edit calls Prettier which edits the file, which re-triggers PostToolUse; no idempotency guard",
      preventionCheck:
        "Every hook command must check a marker file / hash / timestamp and skip if the file state is already post-hook; CI dry-run on a sample repo before shipping",
      tier: "staff",
      relatedPacks: ["claude-code-guide"],
    },
    {
      symptom:
        "MCP tool appears in the pool despite a deny rule in settings; model calls it and the call succeeds",
      trigger:
        "Deny rule targets the MCP server's internal name, not the tool name exposed after MCP integration step; deny-filter ran before MCP integration and therefore missed the tool",
      preventionCheck:
        "Write deny rules against the post-integration tool name (the name the model sees); verify with `claude tools list` after enabling the MCP server",
      tier: "sr",
      relatedPacks: ["injection-surface-audit"],
    },
  ],

  securityReview: {
    injectionSurface: "high",
    toolAllowList: [],
    lastScanned: "2026-04-19",
    knownIssues: [
      "MCP and hook-injected context are both injection surfaces — hostile output from an external MCP tool enters the context; use with `injection-surface-audit`.",
      "Plugin installs can carry hooks that run before the trust dialog (the paper's documented pre-trust execution CVE class); require code review on every plugin manifest.",
      "Skill frontmatter is parsed at load time; a malicious SKILL.md with over-broad `description` can hijack the SkillTool classifier's routing.",
    ],
  },

  rediscoveryCost: {
    tokens: 42000,
    minutes: 120,
    measuredAt: "2026-04-19",
    methodology:
      "Prompted a fresh Claude Sonnet 4.6 with 'explain the four extension mechanisms in a Claude Code-style harness (hooks, skills, plugins, MCP), their graduated context cost, when to reach for which, and the tool-pool assembly pipeline'. Measured tokens until the output covered all four tiers with context-cost ordering, the 27 hook events and 4 execution types, SKILL.md frontmatter and SkillTool injection, the 10 plugin component types, the 7 MCP transports, and the 5-step pool assembly (base → mode → deny → MCP → dedup) with the three injection points. Averaged over 3 runs against the architecture.md source.",
  },

  relatedPacks: [
    "claude-code-guide",
    "subagent-delegation-three-isolation-modes",
    "injection-surface-audit",
  ],
  requires: [],
  conflictsWith: [],
  supersedes: [],
  comparesWith: [
    {
      slug: "claude-code-guide",
      axis: "complexity",
      winner: "other",
      note: "Claude Code Guide is the 10-section onboarding reference; extensibility is one section. This pack is the decision tree for choosing among Hooks/Skills/Plugins/MCP specifically.",
    },
    {
      slug: "injection-surface-audit",
      axis: "accuracy",
      winner: "tie",
      note: "This pack places extensions at injection points; injection-surface-audit audits them for hostile content. Use this to choose, that to harden.",
    },
    {
      slug: "pattern-decision-tree",
      axis: "maintainability",
      winner: "tie",
      note: "Pattern decision tree picks an agent pattern; this pack picks an extensibility mechanism. Orthogonal decisions; use both.",
    },
  ],

  changelog: [
    {
      version: "0.1.0",
      date: "2026-04-19",
      added: [
        "Graduated context-cost hierarchy (Hooks → Skills → Plugins → MCP)",
        "Decision tree traversal rule with worked examples",
        "Tool pool assembly 5-step pipeline and ordering consequences",
        "Three injection points (assemble / model / execute) with mechanism mapping",
        "Anti-pattern catalogue (MCP-everything, plugin bloat, description drift, hook loops)",
      ],
      removed: [],
      reason:
        "Seed pack — first release. Derived from VILA-Lab/Dive-into-Claude-Code §Extensibility, §Tool Pool Assembly, and build-your-own-agent.md Decision 4.",
    },
  ],

  metrics: [
    { label: "Extension mechanisms", value: "4" },
    { label: "Hook events", value: "27" },
    { label: "Plugin component types", value: "10" },
    { label: "MCP transport types", value: "7" },
    { label: "Max built-in tools", value: "54" },
  ],

  sources: [
    {
      label:
        "VILA-Lab / Dive-into-Claude-Code — architecture.md §Extensibility (CC-BY-NC-SA-4.0)",
      url: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/architecture.md#extensibility-mcp-plugins-skills-and-hooks",
      note: "Primary source for the four-mechanism hierarchy, the 5-step tool pool assembly, and the three injection points. Licensed CC-BY-NC-SA-4.0; paraphrased architectural summaries with attribution. arXiv 2604.14228.",
    },
    {
      label:
        "VILA-Lab / Dive-into-Claude-Code — build-your-own-agent.md Decision 4",
      url: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/build-your-own-agent.md#decision-4-how-do-you-handle-extensibility",
      note: "Design-space framing for extensibility cost tiers and the three-injection-point model.",
    },
    {
      label: "Anthropic — Claude Code hooks documentation",
      url: "https://code.claude.com/docs/en/hooks",
      note: "Canonical 27-event hook reference and execution model.",
    },
    {
      label: "Model Context Protocol — specification",
      url: "https://modelcontextprotocol.io/",
      note: "Primary reference for MCP transports and the tool-surface extension semantics.",
    },
    {
      label: "The OpenHands Software Agent SDK (arXiv 2511.03690)",
      url: "https://arxiv.org/abs/2511.03690",
      note: "Composable SDK reference — alternative extensibility model to Claude Code's graduated-cost Hook/Skill/Plugin/MCP layering.",
    },
  ],
  examples: [
    {
      label: "VILA-Lab / Dive-into-Claude-Code repository",
      href: "https://github.com/VILA-Lab/Dive-into-Claude-Code",
      external: true,
    },
    {
      label: "Anthropic — Claude Code hooks docs",
      href: "https://code.claude.com/docs/en/hooks",
      external: true,
    },
  ],
};

export default extensibilityFourMechanisms;
