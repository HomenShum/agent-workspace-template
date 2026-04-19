import type { Pack } from "@/lib/pack-schema";

/**
 * Seven Safety Layers pack.
 *
 * Security reference for Claude Code's defense-in-depth permission
 * architecture. Derived from VILA-Lab Dive-into-Claude-Code
 * (arXiv 2604.14228) §Seven Independent Safety Layers, §Permission
 * System Deep Dive, and §Auto-Mode Classifier. Names each layer,
 * the 7 permission modes, the 4-stage authorization pipeline, and
 * the honest failure modes the paper documents (shared perf
 * constraints, 50+ bypass subcommands, classifier timeout race,
 * pre-trust window CVEs).
 */
export const sevenSafetyLayers: Pack = {
  slug: "seven-safety-layers",
  name: "Seven Safety Layers",
  tagline:
    "Defense-in-depth for tool execution. Deny > ask > allow. All 7 layers, in order, with honest failure modes.",
  summary:
    "Security reference for Claude Code's 7-layer permission architecture, derived from the VILA-Lab Dive-into-Claude-Code paper (arXiv 2604.14228). The paper's anchor finding is that Claude Code is ~1.6% AI decision logic and ~98.4% deterministic infrastructure; the safety layers are a large slice of that infrastructure. The pack enumerates the 7 independent layers in order — (1) tool pre-filtering, (2) deny-first rule evaluation, (3) permission mode constraints across 7 modes (plan, default, acceptEdits, auto, dontAsk, bypassPermissions, bubble), (4) auto-mode ML classifier (yoloClassifier.ts two-stage fast-filter + chain-of-thought with a timeout race against a pre-computed classification), (5) shell sandboxing for filesystem and network isolation, (6) non-restoration on resume (permissions re-established each session; trust is not persistent), (7) PreToolUse hooks with permissionDecision return values. It also names the 4-stage authorization pipeline (pre-filter → hooks → rules → handler with 4 branches). The pack carries the paper's three recurring design commitments — graduated layering, append-only auditability, model judgment inside a deterministic harness — and documents the honest failure modes the paper flags: ~50 subcommands bypass shell-layer analysis, the classifier's timeout race can leave decisions ambiguous, and the pre-trust window allowed 4 published CVEs where extensions executed before the trust dialog appeared. Target: a staff engineer or security lead reviewing an agent's tool-execution surface before shipping.",
  packType: "security",
  canonicalPattern: "n/a",
  version: "0.1.0",

  trust: "Community",
  status: "Recommended",
  featured: false,
  publisher: "Agent Workspace",
  gradient: "from-rose-500 via-red-500 to-orange-600",
  updatedAt: "2026-04-19",
  compatibility: ["claude-code", "cursor", "codex"],
  tags: [
    "security",
    "permissions",
    "defense-in-depth",
    "claude-code-internals",
    "dive-into-claude-code",
    "ssrf-and-sandbox",
  ],

  installCommand: "npx attrition-sh pack install seven-safety-layers",
  claudeCodeSnippet:
    "Skill `seven-safety-layers` is installed at .claude/skills/seven-safety-layers/SKILL.md. Invoke whenever the agent is about to ship a new tool, change permission mode defaults, accept a third-party MCP server, or review a permission-related CVE. Treat each layer as independent; do not collapse them into a single check. Prefer deny-first rules over allow-first; log every PreToolUse hook return; never rely on session-resume to restore trust.",
  rawMarkdownPath: "/packs/seven-safety-layers/raw",

  useWhen: [
    "Pre-ship review for any agent product that executes tools on behalf of a user.",
    "Evaluating a third-party MCP server, skill, or plugin that adds new tools to the registry.",
    "Configuring permission modes for a team (who gets plan vs acceptEdits vs auto vs bypassPermissions).",
    "Triaging a permission-related bug or CVE — map the failure to the layer it escaped.",
    "Cloning Claude Code's permission system into another harness (claw-code, nano-claude-code, open-claude-code).",
  ],
  avoidWhen: [
    "You are building a read-only research agent with no mutating tools — most layers are overkill.",
    "You are using a harness without a permission system at all (single-user CLI toys) — add the layers first, then audit.",
    "You need a formal pentest — this is a defensive architecture review, not an adversarial engagement; use injection-surface-audit for a self-review checklist.",
  ],
  keyOutcomes: [
    "Every tool call passes through all 7 layers; any single layer can block.",
    "Deny-first rule evaluation: deny always overrides allow, even when allow is more specific.",
    "Permission mode is explicit per session; bypassPermissions still enforces safety-critical checks.",
    "PreToolUse hooks can return permissionDecision; return values are logged and audited.",
    "Trust is never restored on resume; permission dialogs re-fire every session.",
  ],

  minimalInstructions: `## Minimal self-audit — half an hour

Walk your harness against these 7 checks. If any answer is "I don't know," treat that as a FAIL until verified.

1. **Tool pre-filtering** — Is your tool registry a static allow-list at module top? If yes, PASS. If tools can register at runtime from skill content or MCP negotiation, FAIL.
2. **Deny-first rule evaluation** — When a deny rule and an allow rule both match a call, does deny win? If yes, PASS. If the more-specific rule wins, FAIL (you have an allow-first system, which is strictly weaker).
3. **Permission mode constraints** — Can you name the active permission mode for the current session in one word? Can you enumerate the modes (plan, default, acceptEdits, auto, dontAsk, bypassPermissions, bubble)? If yes to both, PASS.
4. **Auto-mode classifier** — If you use auto mode, does the classifier have both a fast-filter path AND a chain-of-thought path? Does it race against a timeout? If yes, PASS.
5. **Shell sandboxing** — Do shell commands run with filesystem + network isolation? Can you name which subcommands bypass the analysis (there are ~50)? If yes, PASS.
6. **Non-restoration on resume** — After /resume, does trust have to be re-established? If yes, PASS. If acceptEdits survives resume silently, FAIL.
7. **PreToolUse hook coverage** — Do hooks fire on every tool call? Does a hook return of \`permissionDecision: deny\` actually block? If yes, PASS.

All 7 PASS ships. Any FAIL blocks until addressed or explicitly waived by the owner.`,

  fullInstructions: `## Full reference: the 7 layers

### 1. Why layered defense

The VILA-Lab Dive-into-Claude-Code paper (arXiv 2604.14228) concluded that Claude Code is ~1.6% AI decision logic and ~98.4% deterministic infrastructure. The permission system is a large share of that infrastructure — the paper's §Seven Independent Safety Layers lists seven independent layers, any one of which can block a call. This is the graduated-layering commitment applied to security: no single layer is the guard; the stacked probability of bypass is the guard.

The paper names three recurring design commitments that this architecture instantiates: graduated layering over monolithic mechanisms; append-only designs favoring auditability over query power; model judgment within a deterministic harness. Safety layers are where the "deterministic harness" part is most visible — the model proposes, the harness disposes.

### 2. Layer 1 — Tool pre-filtering (architecture.md §Authorization Pipeline)

Blanket-denied tools are stripped from the model's view entirely before the model call. The model cannot even name a tool it is not allowed to call. This is the earliest and cheapest layer; it prevents the model from "trying its luck" on a denied tool and polluting the transcript.

Implementation requirements:

- Tool registry is a static module-level list. No runtime \`eval\` or string-matched names.
- Pre-filtering is a pure function of (registry, denyRules, permissionMode).
- The filtered list is what gets serialized into the tool schema in the model call.

### 3. Layer 2 — Deny-first rule evaluation (architecture.md §Seven Independent Safety Layers)

Deny always overrides allow, even when allow is more specific. This is the canonical deny-first default safety posture — the paper's fourth design question answers this explicitly: "Default safety posture? Deny-first: deny > ask > allow. Strictest rule wins."

Concretely:

- Rules are (matcher, decision) pairs.
- Matching applies all rules; any deny wins.
- The allow-first alternative (where the more-specific rule wins) is strictly weaker and is the default in many naïve implementations — do not copy it.

### 4. Layer 3 — Permission mode constraints

7 documented modes (architecture.md §7 Permission Modes):

| Mode | Behavior | Trust Level |
|---|---|---|
| plan | User approves all plans before execution | Lowest |
| default | Standard interactive approval | Low |
| acceptEdits | File edits + filesystem shell auto-approved | Medium |
| auto | ML classifier evaluates tool safety | High |
| dontAsk | No prompting, deny rules still enforced | Higher |
| bypassPermissions | Skips most prompts, safety-critical checks remain | Highest |
| bubble | Internal: subagent escalation to parent | Special |

Rules of engagement:

- Mode is explicit per session. Default to \`default\`.
- \`bypassPermissions\` still enforces safety-critical checks — it is not a no-op bypass. Explicitly document which checks remain.
- \`bubble\` is internal-only: subagents escalate to their parent's mode, not to the user.
- Shipping a team default of \`auto\` requires auditing the classifier's failure modes first (see layer 4).

### 5. Layer 4 — Auto-mode ML classifier (architecture.md §Auto-Mode Classifier)

\`yoloClassifier.ts\` loads a base system prompt plus permission templates (separate internal and external variants). Two-stage evaluation:

1. **Fast-filter** — cheap predicate-style checks on the tool + args.
2. **Chain-of-thought** — short LLM reasoning pass on the uncertain cases.

The classifier races a pre-computed classification against a timeout. If the pre-computed result is available in time, it wins; if the timeout fires first, the live classification is used; if both fail, the call falls back to interactive approval.

Failure modes documented in the paper:

- Timeout race can leave decisions ambiguous when the pre-computed classification is partially written.
- Classifier is itself an LLM call; it consumes tokens and latency.
- Adversarial input can be designed to force the chain-of-thought path, inflating cost.

### 6. Layer 5 — Shell sandboxing

Filesystem and network isolation for shell commands. Commands run in a scoped environment: the agent cannot read outside the workspace or reach private network ranges without explicit allow.

Known bypass class: the paper documents that approximately 50 shell subcommands bypass the standard analysis (because the sandbox's policy engine does not know them, or because their syntax defeats the argument parser). This is a non-negligible attack surface. Mitigations:

- Maintain a list of known-bypass subcommands; require explicit approval for any shell invocation whose command name is on the list.
- Prefer structured tools (read_file, write_file, list_dir) over raw shell whenever possible.
- Log every shell invocation with full argv; audit weekly for new subcommands appearing.

### 7. Layer 6 — Non-restoration on resume

Permissions never persist across session boundaries. When the user runs \`/resume\`, the previous session's granted permissions are NOT automatically restored; the user re-establishes trust per session.

This is a deliberate non-feature. The paper's §Session Persistence notes the safety design trade-off: restoring permissions across resumes would reduce friction but eliminate the per-session trust re-check. Do not "fix" this by adding permission persistence to your clone.

Related CVE class: **pre-trust window** — the paper references 4 published CVEs in which extensions executed during a window before the trust dialog appeared. Mitigation: no extension runs any code until the trust dialog has been shown and acknowledged.

### 8. Layer 7 — PreToolUse hooks (architecture.md §Authorization Pipeline)

PreToolUse hooks run before a tool is executed. They can return a \`permissionDecision\`:

- \`allow\` — proceed to the next layer.
- \`deny\` — block the call immediately.
- \`ask\` — surface to the user for interactive approval.

Hooks are the user's override point. The canonical example: a PreToolUse hook that blocks any Edit whose path matches \`**/_generated/**\`, returning deny with a message.

Hook safety notes:

- A hook that returns \`allow\` silently escalates — the call still has to pass the other layers, but the hook can short-circuit the user prompt. Log every allow decision.
- Hooks are user-authored; a malicious or sloppy hook is a hole. Treat the hook directory like code; require review.
- Hooks can time out; define the timeout policy explicitly. Default to "deny on timeout," not "allow on timeout."

### 9. The 4-stage authorization pipeline

Every tool call flows through:

1. **Pre-filtering** — denied tools are stripped before model sees the schema (layer 1).
2. **PreToolUse hooks** — user hooks can return permissionDecision (layer 7).
3. **Rule evaluation** — deny-first (layer 2), mode-aware (layer 3).
4. **Permission handler** — 4 branches: **coordinator** (main session with an interactive user), **swarm worker** (subagent; decisions bubble up via mode \`bubble\`), **speculative classifier** (auto mode; layer 4's classifier), **interactive** (fallback; user approves).

Layer 5 (shell sandboxing) runs inside the tool execution step, not the authorization step. Layer 6 (non-restoration) runs at session start, not per-call.

### 10. Failure modes the paper calls out explicitly

1. **Shared perf constraints across layers** — all 7 layers share the turn's perf budget. A slow layer stalls the whole turn. If layer 4's classifier is flaky, layer 3's mode check gets slower too. Document the per-layer budget; alert on regressions.
2. **50+ shell subcommands bypass analysis** — layer 5 is not complete. Maintain the bypass list.
3. **Classifier timeout race** — layer 4 can leave decisions ambiguous when the pre-computed race tie-breaks badly.
4. **Pre-trust window CVEs** — 4 published CVEs. Extensions must not execute pre-trust.
5. **Hook permissionDecision silent escalation** — a user hook returning allow can short-circuit the user prompt. Log it.
6. **Deny-rule missing overrides** — allow-first systems are strictly weaker; if you copied the rules but not the evaluation order, deny rules silently lose.

### 11. Cross-references

- **injection-surface-audit** — this pack is the architecture; injection-surface-audit is the checklist. Use together.
- **turn-execution-pipeline** — describes where the permission gate fits in the 9-step loop (step 7).
- **nine-context-sources** — CLAUDE.md is user context, not system prompt; permission rules are the deterministic enforcement layer. This distinction is named there in full.

### 12. Cadence

- **Per-PR**: CI linter asserts that tool registry is static and deny-first matches the rule evaluation order.
- **Pre-release**: walk all 7 layers; require PASS on each.
- **Quarterly**: rotate the reviewer; diff the bypass list for layer 5; replay classifier traces for layer 4.
- **Post-CVE**: treat every permission CVE in a neighboring product as a prompt to re-audit your own harness.

### 13. License + attribution

This pack paraphrases and cites architecture content from VILA-Lab/Dive-into-Claude-Code (arXiv 2604.14228, CC-BY-NC-SA-4.0). Attribution to VILA-Lab is required; non-commercial + share-alike terms inherited on any verbatim excerpts. Paraphrased summaries are original and credited per the license. Do not remove the attribution entry from \`sources[]\`.`,

  evaluationChecklist: [
    "Tool registry is static at module top; runtime additions are disallowed.",
    "Rule evaluation is deny-first; unit-tested with deny + allow both matching.",
    "Active permission mode is explicit per session and logged in the transcript header.",
    "Auto-mode classifier is wired with two-stage fast-filter + chain-of-thought and a timeout fallback.",
    "Shell sandbox enforces filesystem + network isolation; a known-bypass list is maintained and reviewed.",
    "Session resume does NOT restore prior-session permissions; trust re-establishes on each resume.",
    "PreToolUse hooks' permissionDecision return is logged for every call; allow decisions audited weekly.",
    "4-stage authorization pipeline (pre-filter → hooks → rules → handler) is visible in the code and traceable per call.",
  ],
  failureModes: [
    {
      symptom:
        "Turn latency p95 doubled after a seemingly unrelated feature flag flip; no single layer failed",
      trigger:
        "All 7 safety layers share the turn's perf budget; a slow layer (usually layer 4 classifier) stalls the whole turn end-to-end",
      preventionCheck:
        "Per-layer latency budget with alerts; dashboard showing layer-4 classifier p95 separately; fallback to interactive when classifier exceeds its budget",
      tier: "staff",
    },
    {
      symptom:
        "Shell command did something unexpected; sandbox analysis didn't flag it",
      trigger:
        "Approximately 50 shell subcommands bypass the sandbox's analysis (the policy engine does not know them or the argument parser missed the syntax); command landed outside the scoped environment",
      preventionCheck:
        "Maintain a bypass-subcommand list; require explicit approval for any invocation whose name is on the list; prefer structured tools to raw shell",
      tier: "staff",
    },
    {
      symptom:
        "Auto mode sometimes approves, sometimes asks, on what looks like the same tool call",
      trigger:
        "Layer 4 classifier's timeout race tie-breaks differently depending on pre-computed availability; partial write of the pre-computed classification leaves the handler reading ambiguous state",
      preventionCheck:
        "Classifier writes are atomic; timeout race has a documented winner policy (pre-computed if complete, else live, else interactive); log the winner per call",
      tier: "sr",
    },
    {
      symptom:
        "A deny rule was present but the tool call went through anyway",
      trigger:
        "Rule evaluation was allow-first (most-specific wins); an allow rule was more specific than the deny and took precedence",
      preventionCheck:
        "Evaluation order is deny-first — deny always wins regardless of specificity; unit tests include (deny + more-specific allow) cases",
      tier: "sr",
    },
    {
      symptom:
        "Extension executed arbitrary code before the trust dialog appeared (pre-trust window)",
      trigger:
        "Extension bundle loaded and ran a module-top-level side effect during initialization, before the user clicked 'trust this workspace'",
      preventionCheck:
        "No extension code runs until the trust dialog has been shown and acknowledged; CI lint for module-top-level side effects in extensions; this class has ≥4 published CVEs",
      tier: "staff",
    },
    {
      symptom:
        "PreToolUse hook returned allow and skipped the user prompt; user had not consented",
      trigger:
        "Hook returned permissionDecision: allow silently without surfacing to the user; audit log didn't record the allow",
      preventionCheck:
        "Log every hook permissionDecision return with rationale; weekly review of allow counts; alert on allow-rate > N per hour",
      tier: "sr",
    },
  ],

  securityReview: {
    injectionSurface: "medium",
    toolAllowList: [],
    lastScanned: "2026-04-19",
    knownIssues: [
      "This is a meta-pack about permission architecture; it does not ship executable code, so it has no tool surface of its own.",
      "The 7-layer architecture is not a ceiling — novel bypasses appear (e.g. the ~50 shell subcommands, pre-trust window). Treat the layers as a floor.",
      "Layer 4's ML classifier is itself an LLM call; adversarial inputs can drive it into the expensive chain-of-thought path to inflate cost.",
    ],
  },

  rediscoveryCost: {
    tokens: 52000,
    minutes: 120,
    measuredAt: "2026-04-19",
    methodology:
      "Prompted a fresh Claude Sonnet 4.6 with 'describe Claude Code's permission architecture: enumerate every independent safety layer, every permission mode, the authorization pipeline stages, and the classifier design, with cited failure modes'. Measured tokens until the output covered all 7 layers in order, all 7 modes with trust levels, the 4-stage pipeline, the classifier's two-stage design with timeout race, and the honest failure modes (50+ bypass subcommands, pre-trust window CVEs, classifier ambiguity). Cross-referenced against VILA-Lab architecture.md §Seven Independent Safety Layers, §Permission System Deep Dive, and §Auto-Mode Classifier. Averaged over 3 runs plus ~30 minutes of reading time in the source paper and companion docs.",
  },

  relatedPacks: [
    "injection-surface-audit",
    "turn-execution-pipeline",
    "claude-code-guide",
  ],
  requires: [],
  conflictsWith: [],
  supersedes: [],
  comparesWith: [
    {
      slug: "injection-surface-audit",
      axis: "maintainability",
      winner: "tie",
      note: "This pack is the architecture; injection-surface-audit is the checklist. Use the architecture for design decisions, the checklist for per-release audits. Complementary, not substitutes.",
    },
    {
      slug: "turn-execution-pipeline",
      axis: "complexity",
      winner: "other",
      note: "Turn pipeline describes the outer 9-step loop; this pack expands step 7 (permission gate) into its 7-layer decomposition. Pipeline is simpler because it treats the gate as one step; safety layers are the hard part.",
    },
    {
      slug: "owasp-llm-top10",
      axis: "accuracy",
      winner: "self",
      note: "OWASP LLM Top 10 is a vocabulary for LLM-app vulnerabilities; this pack is a specific architecture. Use OWASP to name the risks, this pack to verify the layers.",
    },
  ],

  changelog: [
    {
      version: "0.1.0",
      date: "2026-04-19",
      added: [
        "All 7 independent safety layers in order with per-layer requirements",
        "All 7 permission modes with behaviors and trust levels",
        "4-stage authorization pipeline (pre-filter → hooks → rules → handler with 4 branches)",
        "Auto-mode classifier design (two-stage + timeout race)",
        "Honest failure modes cited from the paper: ~50 bypass subcommands, pre-trust window CVEs, classifier ambiguity",
        "6 tiered failure modes including staff-level cross-layer perf regressions",
      ],
      removed: [],
      reason: "Initial publish, sourced from VILA-Lab Dive-into-Claude-Code",
    },
  ],

  metrics: [
    { label: "Safety layers", value: "7" },
    { label: "Permission modes", value: "7" },
    { label: "Authorization stages", value: "4" },
    { label: "Referenced CVEs", value: "4 (pre-trust)" },
  ],

  sources: [
    {
      label: "VILA-Lab — Dive into Claude Code (arXiv 2604.14228)",
      url: "https://arxiv.org/abs/2604.14228",
      note: "Primary source. Licensed CC-BY-NC-SA-4.0 — attribution to VILA-Lab required for all derived packs; non-commercial + share-alike terms inherited on verbatim excerpts. Anchor statistic (~1.6% AI / 98.4% infrastructure) and the 7-layer architecture cited from this paper.",
    },
    {
      label: "VILA-Lab — architecture.md §Seven Independent Safety Layers",
      url: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/architecture.md#seven-independent-safety-layers",
      note: "Section-level source for the 7 layers, the 4-stage authorization pipeline, and the auto-mode classifier design.",
    },
    {
      label: "Anthropic — Claude Code permissions and safety",
      url: "https://docs.anthropic.com/en/docs/claude-code/security",
      note: "Vendor reference for the public-facing permission modes, hook types, and sandbox behavior.",
    },
    {
      label: "OWASP — Top 10 for Large Language Model Applications",
      url: "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
      note: "Canonical vocabulary for LLM-application vulnerabilities; maps to the threat classes this 7-layer architecture defends against.",
    },
  ],
  examples: [
    {
      label: "architecture.md — Permission System Deep Dive",
      href: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/architecture.md#permission-system-deep-dive",
      external: true,
    },
    {
      label: "injection-surface-audit — the checklist companion",
      href: "/packs/injection-surface-audit",
      external: false,
    },
  ],
};

export default sevenSafetyLayers;
