import type { PackArtworkVariant } from "@/lib/pack-art-types";

export type HarnessPackSource = {
  label: string;
  url: string;
  note: string;
};

export type HarnessPackExample = {
  label: string;
  href: string;
  external?: boolean;
};

export type HarnessPack = {
  slug: PackArtworkVariant;
  name: string;
  tagline: string;
  summary: string;
  category: string;
  trust: "Verified" | "Community";
  status: "Production-ready" | "Recommended" | "Experimental";
  featured: boolean;
  publisher: string;
  gradient: string;
  updatedAt: string;
  compatibility: string[];
  tags: string[];
  metrics: {
    label: string;
    value: string;
  }[];
  useWhen: string[];
  avoidWhen: string[];
  keyOutcomes: string[];
  minimalInstructions: string;
  fullInstructions: string;
  evaluationChecklist: string[];
  failureModes: string[];
  sources: HarnessPackSource[];
  examples: HarnessPackExample[];
};

import type { PublisherProvenance } from "@/lib/pack-schema";

export type PublisherProfile = {
  slug: string;
  name: string;
  initials: string;
  status: "Verified publisher" | "Community publisher";
  description: string;
  href: string;
  /**
   * E3 — optional signed manifest. See PublisherProvenance in pack-schema.
   * Kept as re-export so existing callers `getPublisherProfile(name)` keep
   * returning the same shape with the new optional field.
   */
  provenance?: PublisherProvenance;
};

export const publisherProfiles: Record<string, PublisherProfile> = {
  "Agent Workspace": {
    slug: "agent-workspace",
    name: "Agent Workspace",
    initials: "AW",
    status: "Verified publisher",
    description: "Core catalog publisher for the template runtime, UI patterns, and evaluation packs.",
    href: "https://github.com/HomenShum/agent-workspace-template",
    // E3 — provenance manifest. `unverified` is honest: the manifest is
    // present (renderable as "Signed (unverified)") but signature
    // verification is not yet wired into the registry. Promoting to
    // "verified" is the next milestone — do not flip without Ed25519 checks.
    provenance: {
      keyFingerprint: "sha256:placeholder-ed25519-fingerprint-2026-04-17",
      signature: "placeholder-signature-base64-pending-tooling",
      signedAt: "2026-04-17T00:00:00Z",
      packs: [
        "advisor-pattern",
        "advisor-pattern-v2",
        "operator-chat-rail",
        "planning-and-worker-flow",
        "answer-review-and-quality-checks",
        "golden-eval-harness",
        "rag-hybrid-bm25-vector",
        "shadcn-data-table",
        "linear-command-palette",
        "pattern-decision-tree",
        "claude-code-guide",
        "injection-surface-audit",
      ],
      signedBy: "attrition-sign@0.1.0",
      status: "unverified",
    },
  },
  "Agent Workspace Labs": {
    slug: "agent-workspace-labs",
    name: "Agent Workspace Labs",
    initials: "AL",
    status: "Verified publisher",
    description: "Experimental orchestration and runtime patterns that are still source-backed and vetted.",
    href: "https://github.com/HomenShum/agent-workspace-template",
  },
  "Open Workflow Lab": {
    slug: "open-workflow-lab",
    name: "Open Workflow Lab",
    initials: "OW",
    status: "Community publisher",
    description: "Community-authored operating-system and workflow specification patterns.",
    href: "https://github.com/HomenShum/agent-workspace-template",
  },
};

export const harnessPacks: HarnessPack[] = [
  {
    slug: "operator-chat-rail",
    name: "Operator Chat Rail",
    tagline: "Shared chat plus traceable assistant rail for high-context workflows.",
    summary:
      "A proven interface pattern for apps that need collaborative chat in the center and a persistent agent rail for plan trace, tool execution, telemetry, sources, and quality checks.",
    category: "Interface",
    trust: "Verified",
    status: "Production-ready",
    featured: true,
    publisher: "Agent Workspace",
    gradient: "linear-gradient(135deg, rgba(255,229,202,0.96), rgba(255,247,238,0.98))",
    updatedAt: "2026-04-15",
    compatibility: ["Claude Code", "Codex", "Cursor", "Convex"],
    tags: ["chat", "trace", "sources", "telemetry", "quality"],
    metrics: [
      { label: "UI shape", value: "center + rail" },
      { label: "Trace depth", value: "plan to eval" },
      { label: "Fit", value: "ops / support / review" },
    ],
    useWhen: [
      "Users need to collaborate in a shared thread without losing assistant observability.",
      "You need durable streaming, not just a final answer blob.",
      "Operators must inspect plan steps, tool calls, sources, and quality checks after the run.",
    ],
    avoidWhen: [
      "The task is a single-user consumer chat with no need for traceability.",
      "The product does not require source auditability or operator cross-reference behavior.",
    ],
    keyOutcomes: [
      "The assistant becomes reviewable instead of magical.",
      "Streaming deltas map directly to visible plan and execution events.",
      "The same UI contract works across shared chat, workspace pages, and evaluation playback.",
    ],
    minimalInstructions: `Build the UI around two persistent surfaces:
- centered shared thread for human conversation
- expandable right rail for assistant trace

The rail must show:
- plan summary
- planned and executed steps
- tool call summaries
- sources and clickable references
- telemetry and quality checks

Do not collapse all of this into one final markdown blob.`,
    fullInstructions: `You are building an operator-facing agent interface.

Primary UX contract:
1. Keep the human conversation in the center of the screen.
2. Keep the assistant state in a dedicated right rail.
3. Stream state changes as durable events, not ephemeral UI-only spinners.

The assistant rail should reveal:
- what the assistant planned to do
- what it actually executed
- which tools were called and with what purpose
- what sources were used
- what quality or policy checks passed or failed

The final answer should remain readable by itself, but the rail must preserve enough structure for an operator to verify the answer after the fact.`,
    evaluationChecklist: [
      "Does the answer remain readable without opening the trace?",
      "Can an operator inspect the exact plan and executed steps?",
      "Are citations or references visible and clickable when sources exist?",
      "Does the rail degrade gracefully when the run is deterministic or source-free?",
    ],
    failureModes: [
      "All trace data is dumped as raw JSON instead of operator-readable cards.",
      "The chat waits for a final answer instead of streaming plan and execution deltas.",
      "Sources exist in metadata but are not visible to the operator.",
    ],
    sources: [
      {
        label: "Convex AI platform overview",
        url: "https://www.convex.dev/ai",
        note: "Explains Convex AI building blocks such as AI Agent and Persistent Text Streaming.",
      },
      {
        label: "Persistent Text Streaming component",
        url: "https://github.com/get-convex/persistent-text-streaming",
        note: "Reference implementation for durable text streaming.",
      },
      {
        label: "FloorAI case study repo",
        url: "https://github.com/HomenShum/floorai",
        note: "Proof that the centered thread + agent rail pattern works in a full application.",
      },
    ],
    examples: [
      { label: "Open shared studio", href: "/chat" },
      { label: "FloorAI reference", href: "https://github.com/HomenShum/floorai", external: true },
    ],
  },
  {
    slug: "planning-and-worker-flow",
    name: "Planning and Worker Flow",
    tagline: "Tiered orchestration for questions that are too broad for a single call.",
    summary:
      "A multi-step harness pattern that uses a narrow planning pass, typed worker calls, and a constrained synthesis pass instead of letting one prompt attempt everything at once.",
    category: "Orchestration",
    trust: "Verified",
    status: "Recommended",
    featured: true,
    publisher: "Agent Workspace Labs",
    gradient: "linear-gradient(135deg, rgba(255,210,160,0.92), rgba(255,244,233,0.98))",
    updatedAt: "2026-04-15",
    compatibility: ["Claude Code", "Codex", "LangGraph", "Convex"],
    tags: ["planning", "workers", "parallelism", "synthesis"],
    metrics: [
      { label: "Passes", value: "3" },
      { label: "Worker style", value: "typed outputs" },
      { label: "Best for", value: "broad synthesis" },
    ],
    useWhen: [
      "The user asks a broad or multi-entity question.",
      "You need cross-tool synthesis with traceable intermediate outputs.",
      "A single-shot answer tends to overgeneralize or hallucinate missing evidence.",
    ],
    avoidWhen: [
      "A deterministic query or a single issue packet already contains everything needed.",
      "The overhead of planning exceeds the complexity of the task.",
    ],
    keyOutcomes: [
      "Broad questions are decomposed into smaller evidence-gathering steps.",
      "Worker outputs stay typed and auditable before synthesis.",
      "The final answer is grounded in a bounded set of prior results instead of hidden chain-of-thought.",
    ],
    minimalInstructions: `Use a three-phase harness:
1. Plan the smallest useful set of steps.
2. Execute workers with typed outputs and explicit dependencies.
3. Synthesize only from validated worker results.

Do not let the model answer broad questions directly when multiple tools or scopes are involved.`,
    fullInstructions: `You are implementing a harness for questions that exceed a safe single-call boundary.

Phase 1: Plan
- decide which tools or internal workers are required
- keep the plan narrow
- include dependencies and step purpose

Phase 2: Execute
- run steps by tier
- allow parallel workers only when outputs are independent
- persist success, failure, duration, and result summary

Phase 3: Synthesize
- read only validated worker outputs
- cite the evidence sources or record IDs used
- do not invent facts not present in worker results

Favor typed worker outputs over freeform intermediate prose.`,
    evaluationChecklist: [
      "Was planning narrower than the original question?",
      "Did each worker have a clear scope and output contract?",
      "Did synthesis only use worker results and cited evidence?",
      "Could the run recover or re-plan if a worker failed?",
    ],
    failureModes: [
      "Planner creates too many steps with no dependency discipline.",
      "Workers return unstructured prose that is hard to validate.",
      "Synthesis ignores worker results and drifts back into generic model prose.",
    ],
    sources: [
      {
        label: "Anthropic: Building effective agents",
        url: "https://www.anthropic.com/research/building-effective-agents",
        note: "Canonical workflow patterns such as prompt chaining, routing, parallelization, and evaluator loops.",
      },
      {
        label: "LangGraph overview",
        url: "https://docs.langchain.com/oss/python/langgraph",
        note: "Reference for controlled multi-step and multi-agent orchestration.",
      },
      {
        label: "LangGraph product page",
        url: "https://www.langchain.com/langgraph",
        note: "High-level framing for reliable agent orchestration.",
      },
    ],
    examples: [
      { label: "Builder preview workspace", href: "/workspace-a" },
      { label: "Reviewer preview workspace", href: "/workspace-b" },
    ],
  },
  {
    slug: "answer-review-and-quality-checks",
    name: "Answer Review and Quality Checks",
    tagline: "Persist the answer as a reviewable artifact, not just a message string.",
    summary:
      "A runtime pattern that persists final answers, quality checks, evaluation metadata, and downstream review state as first-class records instead of burying them in message text.",
    category: "Evaluation",
    trust: "Verified",
    status: "Production-ready",
    featured: true,
    publisher: "Agent Workspace",
    gradient: "linear-gradient(135deg, rgba(212,236,255,0.96), rgba(247,250,255,0.98))",
    updatedAt: "2026-04-15",
    compatibility: ["Convex", "Claude Code", "Codex"],
    tags: ["quality", "packets", "eval", "review"],
    metrics: [
      { label: "Artifact", value: "answerPacket" },
      { label: "Checks", value: "runtime + eval" },
      { label: "Fit", value: "production gating" },
    ],
    useWhen: [
      "Answers may need post-run review, escalation, or auditing.",
      "You want live evaluation to exercise the same runtime as the product.",
      "The app needs a deploy gate or quality dashboard.",
    ],
    avoidWhen: [
      "The output is disposable and does not need later inspection.",
      "You are still in the earliest sketch phase and do not yet know the domain rubric.",
    ],
    keyOutcomes: [
      "Quality becomes measurable and replayable.",
      "The answer contract is separated from the chat transcript.",
      "Runtime checks and eval checks can share a common packet shape.",
    ],
    minimalInstructions: `Persist a final answer packet for every meaningful run.

The packet should include:
- final answer
- scope and references
- quality checks
- trace pointers
- evaluation linkage

Do not rely on chat text alone as the system of record.`,
    fullInstructions: `Treat the answer as a durable application artifact.

For every non-trivial run:
1. Persist the final answer to an answer packet.
2. Attach references, quality checks, and trace metadata.
3. Link eval runs and live scoring back to the same packet shape.
4. Surface packet status in the UI so operators can see whether the answer passed or failed checks.

This should support:
- replay
- review
- later analytics
- quality gating before deployment`,
    evaluationChecklist: [
      "Is there a persisted answer packet for each completed assistant run?",
      "Do runtime checks and eval checks share a visible schema?",
      "Can a later reviewer inspect packet quality without reading the raw message transcript?",
    ],
    failureModes: [
      "Quality checks exist only in logs, not in app data.",
      "The final answer is stored as unstructured chat text only.",
      "Evaluation runs test a different runtime than the product uses.",
    ],
    sources: [
      {
        label: "FloorAI repo",
        url: "https://github.com/HomenShum/floorai",
        note: "Reference implementation with answer packets, quality checks, and eval persistence.",
      },
      {
        label: "Agent Workspace template repo",
        url: "https://github.com/HomenShum/agent-workspace-template",
        note: "Reusable platform extraction for packet and eval persistence.",
      },
    ],
    examples: [
      { label: "Open shared studio", href: "/chat" },
      { label: "Template repo", href: "https://github.com/HomenShum/agent-workspace-template", external: true },
    ],
  },
  {
    slug: "workflow-elicitation",
    name: "Workflow Elicitation",
    tagline: "Capture operator judgment before you automate it.",
    summary:
      "A future-facing pattern for teams that need to externalize tacit expertise into reusable operating instructions before they try to scale an agent across a domain.",
    category: "Specification",
    trust: "Community",
    status: "Experimental",
    featured: false,
    publisher: "Open Workflow Lab",
    gradient: "linear-gradient(135deg, rgba(223,248,238,0.95), rgba(248,255,252,0.98))",
    updatedAt: "2026-04-15",
    compatibility: ["Claude Code", "Codex", "OpenClaw", "Convex"],
    tags: ["elicitation", "operating-system", "knowledge-capture"],
    metrics: [
      { label: "Goal", value: "spec before runtime" },
      { label: "Outputs", value: "charter + rules" },
      { label: "Fit", value: "expert workflows" },
    ],
    useWhen: [
      "The team has experienced operators whose judgment is hard to explain.",
      "Prompts keep getting longer because the real operating system is still implicit.",
      "You need a reusable role charter, escalation rules, and preferred answer shape.",
    ],
    avoidWhen: [
      "The workflow is already explicit and encoded in deterministic rules.",
      "You only need a lightweight prototype with minimal domain nuance.",
    ],
    keyOutcomes: [
      "Tacit knowledge is converted into reusable instructions and decision boundaries.",
      "The runtime gets better because the operating system is clearer.",
      "Model choice becomes less important than task specification quality.",
    ],
    minimalInstructions: `Do not start with the assistant.

Start with an elicitation pass that captures:
- the role charter
- recurring decisions
- escalation boundaries
- trusted sources
- preferred response structure

Treat that operating system as an input to the runtime harness.`,
    fullInstructions: `When the workflow depends on expert judgment, add an elicitation stage before building the main assistant.

The elicitation stage should capture:
- what the operator is trying to optimize for
- what facts must be cited
- what decisions can be taken autonomously
- what requires escalation
- what sources outrank others
- what a successful answer looks like

Persist those outputs in a structured operating-system layer. Then feed that layer into the runtime harness, evaluation rubric, and role-specific UI.`,
    evaluationChecklist: [
      "Can the operating system be read without talking to the original expert?",
      "Are escalation rules and trusted sources explicit?",
      "Do runtime instructions reference this operating system instead of ad hoc prompt additions?",
    ],
    failureModes: [
      "The team keeps patching prompts instead of capturing the missing workflow rules.",
      "Expert operators agree on outcomes but disagree on undocumented intermediate judgment.",
      "The operating system is freeform notes with no reusable structure.",
    ],
    sources: [
      {
        label: "OpenClaw ecosystem notes",
        url: "https://docs.openclaw.ai/index",
        note: "Useful context for structured agent instructions and operating patterns.",
      },
      {
        label: "Agent Workspace README",
        url: "https://github.com/HomenShum/agent-workspace-template",
        note: "Shows how a reusable platform can sit underneath multiple domain implementations.",
      },
    ],
    examples: [
      { label: "Template repo", href: "https://github.com/HomenShum/agent-workspace-template", external: true },
    ],
  },
  {
    slug: "hybrid-runtime",
    name: "Hybrid Runtime",
    tagline: "Use rules for known packets, use synthesis only when ambiguity is real.",
    summary:
      "A disciplined runtime pattern that reserves deterministic rendering for tightly scoped known cases and uses an LLM only for bounded synthesis, not as the default execution path for every question.",
    category: "Runtime",
    trust: "Verified",
    status: "Recommended",
    featured: false,
    publisher: "Agent Workspace Labs",
    gradient: "linear-gradient(135deg, rgba(236,230,255,0.95), rgba(251,249,255,0.99))",
    updatedAt: "2026-04-15",
    compatibility: ["Claude Code", "Codex", "Gemini", "Convex"],
    tags: ["deterministic", "hybrid", "routing", "cost"],
    metrics: [
      { label: "Cheap path", value: "rules first" },
      { label: "LLM path", value: "bounded synthesis" },
      { label: "Best for", value: "ops guidance" },
    ],
    useWhen: [
      "Many requests map to known issue packets or stable policies.",
      "The team wants lower cost and more predictable answers for common cases.",
      "The same answer shape needs to hold across both deterministic and synthesized runs.",
    ],
    avoidWhen: [
      "The domain is highly unstructured and almost every request is novel.",
      "The deterministic path is weak enough that it adds noise instead of reliability.",
    ],
    keyOutcomes: [
      "Routine questions become cheaper and more stable.",
      "The model is reserved for where synthesis adds value.",
      "The runtime has a cleaner boundary between retrieval, rendering, and reasoning.",
    ],
    minimalInstructions: `Route the request first.

If the request matches a known packet with explicit policy or action steps:
- answer deterministically

If the request spans multiple packets or requires ambiguity handling:
- run the bounded synthesis path

Do not default to a full agent run for every request.`,
    fullInstructions: `Build a hybrid runtime.

Path A: deterministic
- use canonical issue or entity packets
- render from rules and trusted fields
- cite exact identifiers and thresholds

Path B: bounded LLM synthesis
- only after routing decides deterministic coverage is insufficient
- limit the model to the validated evidence set
- preserve the same answer packet and quality gate shape

The value is not fewer models. The value is a cleaner decision boundary.`,
    evaluationChecklist: [
      "Do known packets render without unnecessary model usage?",
      "Does the LLM path only activate when the request exceeds deterministic coverage?",
      "Do both paths emit the same answer packet shape and review metadata?",
    ],
    failureModes: [
      "Everything routes to the model because deterministic coverage is not well defined.",
      "Deterministic answers are too brittle because packets are incomplete.",
      "The two paths produce different output contracts and confuse the UI.",
    ],
    sources: [
      {
        label: "Anthropic: Building effective agents",
        url: "https://www.anthropic.com/research/building-effective-agents",
        note: "Use workflows where they are sufficient; escalate to agents only when needed.",
      },
      {
        label: "FloorAI repo",
        url: "https://github.com/HomenShum/floorai",
        note: "Reference implementation of deterministic and synthesized answer paths in one runtime.",
      },
    ],
    examples: [
      { label: "Builder preview workspace", href: "/workspace-a" },
    ],
  },
  {
    slug: "durable-streaming",
    name: "Durable Streaming",
    tagline: "Stream plan and execution state through stored events, not transient sockets alone.",
    summary:
      "A transport and persistence pattern for agents that need progressive rendering, reconnect safety, and post-run replay without losing the benefits of token or step streaming.",
    category: "Streaming",
    trust: "Verified",
    status: "Production-ready",
    featured: false,
    publisher: "Agent Workspace",
    gradient: "linear-gradient(135deg, rgba(251,232,207,0.95), rgba(255,251,245,0.98))",
    updatedAt: "2026-04-15",
    compatibility: ["Convex", "Vercel AI SDK", "Claude Code", "Codex"],
    tags: ["streaming", "events", "durability", "replay"],
    metrics: [
      { label: "Storage", value: "messageEvents" },
      { label: "UX", value: "delta rendering" },
      { label: "Fit", value: "operator apps" },
    ],
    useWhen: [
      "The app needs live progress plus later replay or audit.",
      "Users may reconnect mid-run or review the run after completion.",
      "You want plan, steps, and final answer to stream through one event system.",
    ],
    avoidWhen: [
      "A simple transient text stream is enough and replay is unnecessary.",
      "The app has no need to surface intermediate state to the user.",
    ],
    keyOutcomes: [
      "Streaming survives beyond one network response.",
      "The same event log powers UX, audit, and evaluation playback.",
      "Step state is visible before the final answer completes.",
    ],
    minimalInstructions: `Persist streaming as ordered events.

Emit events such as:
- run.started
- plan.created
- step.started
- step.completed
- text.delta
- quality.checked
- run.completed

Render the UI from stored events, not just an in-flight response.`,
    fullInstructions: `Implement streaming as a durable event log.

When a run starts:
1. create a draft assistant message
2. append ordered events for plan, steps, deltas, and completion
3. update the message as text accumulates
4. finalize the answer packet at completion

The UI should subscribe to event state and progressively render:
- draft answer text
- planned steps
- executed steps
- source additions
- quality checks

Prefer durability over pure SSE when operator review matters.`,
    evaluationChecklist: [
      "Can the UI recover mid-run if the page reconnects?",
      "Are plan and step states visible before the final answer completes?",
      "Does the final packet reconcile cleanly with the streamed events?",
    ],
    failureModes: [
      "The app shows a spinner until completion and hides real state changes.",
      "Streaming works only during the request and cannot be replayed later.",
      "The final answer and event stream diverge because there is no final reconciliation step.",
    ],
    sources: [
      {
        label: "Persistent Text Streaming component",
        url: "https://github.com/get-convex/persistent-text-streaming",
        note: "Reference implementation for durable streaming with Convex.",
      },
      {
        label: "Convex AI platform overview",
        url: "https://www.convex.dev/ai",
        note: "Shows persistent text streaming as a first-class AI building block.",
      },
    ],
    examples: [
      { label: "Open shared studio", href: "/chat" },
    ],
  },
];

export const packCategories = Array.from(
  new Set(harnessPacks.map((pack) => pack.category)),
).sort((left, right) => left.localeCompare(right));

export function getHarnessPack(slug: string) {
  return harnessPacks.find((pack) => pack.slug === slug);
}

export function getPublisherProfile(name: string) {
  return publisherProfiles[name];
}

export function getPublisherProfileBySlug(slug: string) {
  return Object.values(publisherProfiles).find((publisher) => publisher.slug === slug);
}

export function getPacksByPublisher(name: string) {
  return harnessPacks.filter((pack) => pack.publisher === name);
}
