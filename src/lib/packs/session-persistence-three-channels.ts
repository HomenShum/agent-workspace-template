import type { Pack } from "@/lib/pack-schema";

/**
 * Session Persistence — Three Channels pack.
 *
 * Harness pack documenting the three persistence channels (append-only
 * session JSONL, global history.jsonl, subagent sidechains), the append-only
 * chain-patching compaction model, and the deliberate non-feature: permissions
 * never restore on resume. Derived from VILA-Lab/Dive-into-Claude-Code
 * §Session Persistence.
 */
export const sessionPersistenceThreeChannels: Pack = {
  slug: "session-persistence-three-channels",
  name: "Session Persistence — Three Channels",
  tagline:
    "Append-only JSONL across 3 channels. Permissions never restore on resume — the friction IS the safety.",
  summary:
    "Harness pack covering Claude Code's session persistence design derived from the VILA-Lab architectural analysis (arXiv 2604.14228). Documents the three persistence channels: append-only session JSONL transcripts (full conversation with chain-patched compaction boundaries), global `history.jsonl` for cross-session prompt recall (reverse-read for Up-arrow), and subagent sidechains as separate JSONL per subagent. Frames the critical deliberate non-feature: permissions are never restored on resume — trust is always re-established in the current session. The paper presents this as a design choice, not a UX bug: the user friction is the cost of maintaining the safety invariant. The pack also captures the append-only / chain-patching trade-off — auditability and simplicity over query power.",
  packType: "harness",
  canonicalPattern: "n/a",
  version: "0.1.0",

  trust: "Community",
  status: "Recommended",
  featured: false,
  publisher: "Agent Workspace",
  gradient: "from-slate-500 via-zinc-500 to-stone-600",
  updatedAt: "2026-04-19",
  compatibility: ["claude-code", "cursor", "codex"],
  tags: [
    "harness",
    "persistence",
    "session",
    "append-only",
    "jsonl",
    "safety",
    "resume",
    "claude-code",
  ],

  installCommand:
    "npx attrition-sh pack install session-persistence-three-channels",
  claudeCodeSnippet:
    "Skill `session-persistence-three-channels` is installed at .claude/skills/session-persistence-three-channels/SKILL.md. Invoke when the user asks about session resume, fork, compaction boundaries, `history.jsonl`, subagent sidechains, or 'why do permissions prompt me again after resume.' Explain the three channels (session transcript, global history, sidechains), the append-only + chain-patching compaction model, and the deliberate choice that permissions never restore on resume. Do NOT propose 'fixing' the resume prompt — it is a safety invariant, not a UX bug.",
  rawMarkdownPath: "/packs/session-persistence-three-channels/raw",

  contract: {
    requiredOutputs: [
      "transcript_path",
      "history_offset",
      "checkpoint_hash",
    ],
    tokenBudget: 0,
    permissions: ["fs-write"],
    completionConditions: ["transcript_flushed", "history_appended"],
    outputPath: ".transcripts/<session>.jsonl",
  },

  layers: {
    runtimeCharter:
      "Persistence is append-only across three isolated channels. (1) Session transcripts: one JSONL per session at `.transcripts/<session>.jsonl`. Every turn, every tool call, every result is appended. Compaction boundaries are recorded as chain-patch markers (headUuid / anchorUuid / tailUuid); the on-disk log is never destructively edited. (2) Global prompt history: a single `history.jsonl` with every user prompt across every session on this machine, reverse-read for Up-arrow recall. Append-only; retention is the user's responsibility. (3) Subagent sidechains: a separate JSONL per spawned subagent at `.sidechains/<task-id>.jsonl`; see the subagent-delegation pack. Hard invariant: permissions are never restored on resume. The resumed session starts with fresh trust and re-prompts for every non-auto-approved action. This is the deliberate UX-cost-of-safety; do NOT 'fix' it by persisting permissions.",
    nlh:
      "Session boundary spec: on session start, the loader creates `.transcripts/<session>.jsonl` and appends a header event with session_id, start_ts, resumed_from (nullable). On every turn, events are appended in order {type, ts, uuid, prev_uuid, payload}. On compaction, the compactor appends a compaction-boundary event with {headUuid, anchorUuid, tailUuid, summary_event_uuid} — it does NOT rewrite earlier events. On session end (clean exit), append a terminator event with end_ts and flush. On resume: read the latest session JSONL, walk chain-patches to reconstruct the effective message chain, re-apply any compaction summaries virtually, and begin a new session with a fresh permission ledger. On crash: the transcript may be missing a terminator; the loader accepts this as a valid recoverable state.",
    toolSpec: [
      {
        name: "append_transcript",
        signature:
          "(opts: {session_id: string; event: {type: string; payload: unknown; uuid: string; prev_uuid?: string}}) => Promise<{byte_offset: number; line_number: number}>",
        description:
          "Appends a single event to `.transcripts/<session_id>.jsonl`. Write is atomic at the line level (O_APPEND). Returns the byte offset for indexing. Does NOT read back; never reads for validation. The caller is responsible for uuid + prev_uuid consistency. Idempotent on `(session_id, event.uuid)` — repeated writes with the same uuid are a no-op.",
      },
      {
        name: "read_history",
        signature:
          "(opts: {limit?: number; reverse?: boolean}) => Promise<Array<{prompt: string; ts: string; session_id: string; offset: number}>>",
        description:
          "Reads from global `history.jsonl`. Default reverse=true, limit=50 — matches Up-arrow recall semantics. Read-only; never writes. Does NOT participate in the current session's transcript. Respects an optional retention window via `HISTORY_RETAIN_DAYS` env, but default is unbounded (user's retention responsibility).",
      },
    ],
  },

  // Transfer matrix deliberately omitted: persistence is not model-dependent.

  useWhen: [
    "You are designing resume, fork, or replay semantics for an agent harness.",
    "You want every session action to be reconstructable from disk without specialised tooling.",
    "You need a simple coordination primitive for multi-instance scenarios (JSONL + flock).",
    "Your team is debating whether to persist permissions across resume — reach this pack first.",
  ],
  avoidWhen: [
    "You need high-throughput queries over historical sessions — JSONL scans will not keep up; use a database.",
    "You are building a multi-tenant hosted harness where sessions must be cryptographically isolated — append-only JSONL on shared disk is not the right substrate.",
    "You need to redact events after the fact for legal or privacy reasons — append-only makes redaction operationally expensive.",
  ],
  keyOutcomes: [
    "Every session event is human-readable and reconstructable without specialised tooling.",
    "Compaction NEVER rewrites the on-disk log; it appends chain-patch markers instead.",
    "Resume starts with fresh permissions — the user re-establishes trust every session.",
    "The three channels (session, history, sidechains) do not leak into each other.",
    "Crash recovery is a valid state: a missing terminator event is accepted as recoverable.",
  ],

  minimalInstructions: `## Minimal setup — an append-only transcript

The design is radically simple. A minimal reimplementation is ~80 lines.

\`\`\`python
# transcripts.py
import json, os, uuid, time
from pathlib import Path

TRANSCRIPT_DIR = Path(".transcripts")
HISTORY_FILE = Path.home() / ".claude" / "history.jsonl"
TRANSCRIPT_DIR.mkdir(exist_ok=True)
HISTORY_FILE.parent.mkdir(exist_ok=True)

def append_transcript(session_id: str, event_type: str, payload: dict, prev_uuid: str | None = None) -> str:
    path = TRANSCRIPT_DIR / f"{session_id}.jsonl"
    event = {
        "uuid": uuid.uuid4().hex,
        "ts": time.time(),
        "type": event_type,
        "prev_uuid": prev_uuid,
        "payload": payload,
    }
    # O_APPEND is atomic at the line level on POSIX
    with path.open("a") as f:
        f.write(json.dumps(event, separators=(",", ":")) + "\\n")
    return event["uuid"]

def append_history(prompt: str, session_id: str) -> None:
    with HISTORY_FILE.open("a") as f:
        f.write(json.dumps({
            "ts": time.time(),
            "prompt": prompt,
            "session_id": session_id,
        }) + "\\n")

def read_history(limit: int = 50, reverse: bool = True) -> list[dict]:
    if not HISTORY_FILE.exists():
        return []
    lines = HISTORY_FILE.read_text().splitlines()
    entries = [json.loads(l) for l in lines if l.strip()]
    return entries[-limit:][::-1] if reverse else entries[:limit]
\`\`\`

Resume:

\`\`\`python
def resume(session_id: str) -> list[dict]:
    path = TRANSCRIPT_DIR / f"{session_id}.jsonl"
    events = [json.loads(l) for l in path.read_text().splitlines() if l.strip()]
    # Chain-patch: later compaction events may redirect prev_uuid walks.
    # Permissions: DO NOT restore. Start a fresh permission ledger.
    return events
\`\`\`

That is the whole persistence layer. Everything else is discipline.`,

  fullInstructions: `## Full reference: session persistence as a deliberate design

Derived from architecture.md §Session Persistence and build-your-own-agent.md Decision 6 of the VILA-Lab/Dive-into-Claude-Code paper (arXiv 2604.14228). All section references below are to architecture.md unless noted.

### 1. Why this pack exists

Most harness engineers see "permissions prompt me again after resume" and file it as a UX bug. It is not. It is a named safety invariant in the paper (§Session Persistence):

> Permissions Never Restored on Resume — Trust is always re-established in the current session. This accepts user friction as the cost of maintaining the safety invariant.

The first-week fix for every new harness team is "remember the user's last-session allow rules." That change looks like a 10-line improvement. In practice it is a silent privilege escalation: a malicious prompt from the last session (or an injected CLAUDE.md delta, or a compromised tool output that steered the user into an unwise allow) continues to hold privilege after the user thought they had closed the door. The paper accepts the friction to keep that door closed.

This pack is the artifact to hand to a colleague who is about to file that "bug."

### 2. Three persistence channels

From architecture.md §Three Persistence Channels:

| Channel | Format | Purpose |
|:--|:--|:--|
| Session transcripts | Append-only JSONL | Full conversation, chain-patched compaction boundaries |
| Global prompt history | \`history.jsonl\` | Cross-session prompt recall (reverse-read for Up-arrow) |
| Subagent sidechains | Separate JSONL per subagent | Isolated subagent histories |

Each channel has a distinct failure isolation boundary. Corruption of the global history does not affect a live session. Corruption of a sidechain does not affect the parent. A crashed session leaves a recoverable tail in its own transcript without blocking new sessions from starting.

### 3. Append-only + chain patching

The paper's §Chain Patching section (paraphrased) describes the compaction model: compact boundaries record headUuid / anchorUuid / tailUuid. The session loader patches the message chain at read time. Nothing is destructively edited on disk.

This is the critical invariant. A naive compactor rewrites the transcript to replace a span of old messages with a summary. That destroys replay: you can no longer reconstruct what the agent saw before compaction. The Claude Code design instead appends a compaction marker — on read, the loader follows the chain patches to project the effective message sequence. The on-disk log remains the ground truth.

Practical consequences:

- Debugging a past run: you can always read the original events, even through multiple compaction passes.
- Forking: copy the transcript to a new path; no in-place mutation means no race.
- Version control: the transcript is safe to check into git for post-mortems (after redaction).

### 4. Checkpoints

Checkpoints live at \`~/.claude/file-history/<sessionId>/\` (README §Session Persistence). They support \`--rewind-files\`: the harness can revert filesystem state to a prior checkpoint without rewinding the conversation. Two implications:

- Checkpoint storage is per-session, per-machine; it does not travel across machines.
- The checkpoint hash is part of the session's required outputs in this pack's contract.

### 5. Why JSONL

From build-your-own-agent.md Decision 6 and architecture.md §Design Trade-off:

> Append-only JSONL favors auditability and simplicity over query power. Every event is human-readable, version-controllable, and reconstructable without specialized tooling.

Trade-off inventory:

- Gains: transparency, trivial crash recovery, no schema migration, no DB operational burden, portable across machines.
- Losses: no SQL queries, no indexes, no server-side aggregation, O(n) scans for anything non-trivial.

The paper frames this as a deliberate choice: the production harness optimises for the case where a human or an agent needs to reconstruct what happened. For analytics, emit a secondary stream to a queryable store — do NOT promote the transcript into the primary database.

### 6. The deliberate non-feature: permissions do not restore

The failure mode to avoid here is "resume restores permissions automatically (UX fix that breaks safety)." Why this is a staff-level trap:

- The "fix" looks trivial — add a permission ledger to the transcript, read it on resume.
- It defeats the per-session trust re-establishment the paper names as an invariant.
- It creates a compounding-privilege attack: each session inherits the previous session's allows, so an allow granted under duress (hostile CLAUDE.md, compromised tool output, social-engineered user) persists indefinitely.
- The 7-safety-layers design (architecture.md §Seven Independent Safety Layers) lists "non-restoration on resume" as layer 6 of 7. Removing it removes a layer.

If you must reduce the re-prompt burden, do it by:

1. Scoping user-initiated allow rules to a settings file the user explicitly reviews (not an implicit ledger).
2. Using auto-mode classifier (see \`injection-surface-audit\` pack) to raise the automation floor without persisting allows.
3. Keeping the per-session re-prompt for any action with irreversible consequences.

Do NOT quietly roll permissions forward from session to session.

### 7. Global prompt history

\`history.jsonl\` is the Up-arrow buffer. A single file, append-only, one entry per user prompt. Retention is the user's responsibility. The file grows unboundedly unless a rotation policy is in place — a documented failure mode for long-lived installations.

Suggested retention (not enforced by the harness): rotate at 10 MiB or 10k entries, keep the last file in a \`history.jsonl.1\` rollover, delete older on a monthly sweep.

### 8. Subagent sidechains

Documented in detail in the \`subagent-delegation-three-isolation-modes\` pack. The relevant persistence notes here:

- Sidechains live at \`.sidechains/<task-id>.jsonl\`, distinct directory from session transcripts.
- Parent never reads a child's sidechain; only the summary returns to the parent transcript.
- Sidechain byte caps are a cross-child aggregate — a runaway can fill the disk. Monitor.
- On a crashed subagent, flush discipline becomes critical: a sidechain never flushed is lost context. Use \`fsync\` on subagent exit.

### 9. Crash recovery

The crash-recovery model is intentionally simple:

1. Session transcript ends without a terminator event → loader treats the last valid line as the final event and opens a new session.
2. Mid-turn tool call interrupted → the incomplete tool-call event is present but no tool-result event; resume sees the gap and retries the call.
3. Compaction interrupted → a partial chain-patch marker is present; the loader falls back to pre-compaction chain walk.
4. Sidechain never flushed → parent's summary is lost; the specific subagent's output is gone (documented failure mode).

None of these require a journal, WAL, or database transaction. The append-only model degrades to a lossy-at-the-tail state that is the same as the normal crash semantics of any O_APPEND log.

### 10. What NOT to do

Catalogued from community reimplementations and documented anti-patterns:

1. **Mutating compaction boundaries in-place** — destroys replay.
2. **Persisting permissions across resume** — erases safety invariant.
3. **No retention on history.jsonl** — grows unboundedly over years.
4. **Forgetting to fsync a crashed subagent's sidechain** — silent context loss.
5. **Re-reading the transcript on every turn** — O(n) scan on every model call, catastrophic tail latency.
6. **Using the transcript as the primary analytics store** — it is optimised for audit, not aggregation.

### 11. Relationship to other packs

- \`subagent-delegation-three-isolation-modes\` — covers sidechains in depth; this pack covers sessions + history.
- \`claude-code-guide\` — onboarding reference that cites session memory as one section; this pack is the dedicated persistence specification.
- \`injection-surface-audit\` — the permissions-non-restoration invariant is one of the audit's checks.`,

  evaluationChecklist: [
    "Every session event is appended, never in-place edited; compaction uses chain-patch markers.",
    "Permissions are NOT restored on resume; the harness explicitly starts with a fresh permission ledger.",
    "The three channels (session transcript, global history, subagent sidechains) live in distinct directories and never cross-write.",
    "`history.jsonl` has a documented retention policy (rotation at 10 MiB or 10k entries, monthly sweep).",
    "Subagent sidechains fsync on subagent exit; crashed subagents do not silently drop context.",
    "Crash recovery is tested: a transcript missing its terminator is accepted as a valid recoverable state.",
    "Transcripts are not re-read on every turn; the loader reads once on session start.",
    "Checkpoints at `~/.claude/file-history/<sessionId>/` support `--rewind-files` independent of conversation rewind.",
  ],
  failureModes: [
    {
      symptom:
        "Debugging a regression, engineer cannot reconstruct what the agent saw three turns ago — data is gone",
      trigger:
        "Compactor rewrote the transcript in-place to replace old messages with a summary; destructive edit",
      preventionCheck:
        "Enforce append-only writes at the storage layer; compaction only appends chain-patch markers with headUuid/anchorUuid/tailUuid; loader reconstructs effective chain at read time; CI test that compaction does not shrink the on-disk file",
      tier: "staff",
      relatedPacks: ["claude-code-guide"],
    },
    {
      symptom:
        "After shipping 'resume remembers your allows' UX improvement, a hostile CLAUDE.md edit from a prior session silently retains privilege",
      trigger:
        "Permissions persisted across resume; trust was not re-established in the current session; the safety invariant (layer 6 of 7) was removed",
      preventionCheck:
        "Explicit architectural rule: permission ledger is session-scoped, never persisted; code review gate that flags any PR adding permissions to the transcript or a cross-session store; security review signs off on the non-restoration invariant",
      tier: "staff",
      relatedPacks: ["injection-surface-audit"],
    },
    {
      symptom:
        "Long-lived developer workstation: `history.jsonl` grows to >1 GiB over two years; Up-arrow recall becomes slow; disk pressure",
      trigger:
        "No retention policy on global prompt history; append-only without rotation",
      preventionCheck:
        "Rotate at 10 MiB or 10k entries; keep `history.jsonl.1` rollover; monthly sweep deletes older rollovers; surface a warning when approaching 10 MiB",
      tier: "sr",
      relatedPacks: ["claude-code-guide"],
    },
    {
      symptom:
        "Subagent produced a summary but parent receives an empty string; sidechain is missing the last events",
      trigger:
        "Subagent crashed before flushing the sidechain JSONL; no fsync on subagent exit path",
      preventionCheck:
        "Wrap the subagent's sidechain writer in an fsync on exit; add a finalise hook on subagent SIGTERM; parent checks `completion_status` and propagates errors to its next step",
      tier: "sr",
      relatedPacks: ["subagent-delegation-three-isolation-modes"],
    },
    {
      symptom:
        "First turn of every resume takes 8+ seconds; profiler shows transcript deserialisation dominating",
      trigger:
        "Loader re-reads and re-parses the full transcript on every turn, not just on session start",
      preventionCheck:
        "Cache the reconstructed message chain in-memory after session start; only re-read on explicit `--rewind` or compaction-boundary event",
      tier: "mid",
      relatedPacks: ["claude-code-guide"],
    },
  ],

  securityReview: {
    injectionSurface: "low",
    toolAllowList: ["fs-write"],
    lastScanned: "2026-04-19",
    knownIssues: [
      "Transcripts may contain tool outputs that include secrets; they persist on disk until rotation — operators should gitignore `.transcripts/` and document a redaction process for incident post-mortems.",
      "Global `history.jsonl` contains every user prompt across every session on the machine; treat it as sensitive on shared workstations.",
      "The 'permissions never restored on resume' invariant depends on correct code review — a PR that adds a cross-session allow store silently regresses the safety model.",
    ],
  },

  rediscoveryCost: {
    tokens: 33000,
    minutes: 95,
    measuredAt: "2026-04-19",
    methodology:
      "Prompted a fresh Claude Sonnet 4.6 with 'design session persistence for a Claude Code-style agent harness: how many channels, append-only vs mutable, what happens on resume, compaction, subagent transcripts, and why permissions would or would not persist'. Measured tokens until the output covered the three channels (session JSONL, global history, sidechains), append-only + chain-patch compaction, the deliberate choice of not restoring permissions on resume, file-history checkpoints, and retention / crash-recovery heuristics. Averaged over 3 runs against the architecture.md source.",
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
      note: "Claude Code Guide covers session memory in one section; this pack is the dedicated persistence specification with the deliberate-non-feature framing.",
    },
    {
      slug: "subagent-delegation-three-isolation-modes",
      axis: "maintainability",
      winner: "tie",
      note: "This pack documents session + global channels; subagent-delegation documents the sidechain channel. Stack them for full 3-channel coverage.",
    },
    {
      slug: "injection-surface-audit",
      axis: "accuracy",
      winner: "tie",
      note: "The permissions-non-restoration invariant is one of the audit's checks. This pack names the invariant; that pack verifies nothing erodes it.",
    },
  ],

  changelog: [
    {
      version: "0.1.0",
      date: "2026-04-19",
      added: [
        "Three persistence channels (session, global history, subagent sidechains)",
        "Append-only + chain-patching compaction model",
        "The deliberate non-feature: permissions never restore on resume",
        "File-history checkpoints at `~/.claude/file-history/<sessionId>/`",
        "Crash-recovery model for missing terminators and partial compaction",
        "Retention policy recommendation for `history.jsonl`",
      ],
      removed: [],
      reason:
        "Seed pack — first release. Derived from VILA-Lab/Dive-into-Claude-Code §Session Persistence and build-your-own-agent.md Decision 6.",
    },
  ],

  metrics: [
    { label: "Persistence channels", value: "3" },
    { label: "Destructive edits on disk", value: "0" },
    { label: "Permissions restored on resume", value: "never" },
    { label: "Suggested history.jsonl rotation", value: "10 MiB / 10k entries" },
  ],

  sources: [
    {
      label:
        "VILA-Lab / Dive-into-Claude-Code — architecture.md §Session Persistence (CC-BY-NC-SA-4.0)",
      url: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/architecture.md#session-persistence",
      note: "Primary source for the three channels, append-only chain-patching, and the permissions-never-restored invariant. Licensed CC-BY-NC-SA-4.0; paraphrased architectural summaries with attribution. arXiv 2604.14228.",
    },
    {
      label:
        "VILA-Lab / Dive-into-Claude-Code — build-your-own-agent.md Decision 6",
      url: "https://github.com/VILA-Lab/Dive-into-Claude-Code/blob/main/docs/build-your-own-agent.md#decision-6-how-do-sessions-persist",
      note: "Design-space framing for append-only vs database vs stateless, and the 'never restore permissions on resume' key insight.",
    },
    {
      label: "Anthropic — Claude Code memory documentation",
      url: "https://code.claude.com/docs/en/memory",
      note: "Canonical reference for session-scoped memory, CLAUDE.md hierarchy, and auto-memory semantics that surround the persistence layer.",
    },
    {
      label: "arXiv 2604.14228 — Dive into Claude Code (paper)",
      url: "https://arxiv.org/abs/2604.14228",
      note: "Academic paper from which this pack is derived. Cite as Liu, Zhao, Shang, Shen 2026.",
    },
  ],
  examples: [
    {
      label: "VILA-Lab / Dive-into-Claude-Code repository",
      href: "https://github.com/VILA-Lab/Dive-into-Claude-Code",
      external: true,
    },
    {
      label: "Anthropic — Claude Code memory docs",
      href: "https://code.claude.com/docs/en/memory",
      external: true,
    },
  ],
};

export default sessionPersistenceThreeChannels;
