# Dive-into-Claude-Code — Follow-up findings from paper PDF

**Date:** 2026-04-19
**Extends:** `docs/PACK_PROPOSALS_FROM_DIVE.md`
**Scope:** Paper sections 1–2 extracted via `pdftotext`; Sections 10 + 12 skimmed. Total PDF 2,826 lines.

## Previously unread: the conceptual backbone

The paper (Section 2) names **5 human values** and **13 design principles** that operationalize them. None of the 9 packs I shipped earlier today captures this framework explicitly — it lives at a higher abstraction layer than any of them.

### The 5 values
1. **Human Decision Authority** — principal hierarchy (Anthropic → operators → users); observe, approve, interrupt, audit
2. **Safety, Security, and Privacy** — protect even when the human is inattentive
3. **Reliable Execution** — single-turn correctness + long-horizon coherence; generation separated from evaluation
4. **Capability Amplification** — deterministic infrastructure over decision scaffolding
5. **Contextual Adaptability** — extension surface at multiple context costs; autonomy is co-constructed

Plus a **6th evaluative lens**: long-term human capability preservation (explicitly NOT a design driver but applied as a cross-cutting concern).

### The 13 principles (verbatim from Table 1)

1. Deny-first with human escalation
2. Graduated trust spectrum
3. Defense in depth with layered mechanisms
4. Externalized programmable policy
5. Context as scarce resource with progressive management
6. Append-only durable state
7. Minimal scaffolding, maximal operational harness
8. Values over rules
9. Composable multi-mechanism extensibility
10. Reversibility-weighted risk assessment
11. Transparent file-based configuration and memory
12. Isolated subagent boundaries
13. Graceful recovery and resilience

## Hard stats newly captured (paper-cited, citable verbatim in pack summaries)

| Statistic | Source | Usable in |
|---|---|---|
| **93% of permission prompts approved** | Hughes 2026 | `seven-safety-layers`, `agent-design-space-six-decisions` — frames why "deny-first + defined boundaries" beats per-action prompts |
| **27% of tasks wouldn't have been attempted without Claude Code** | Huang et al. 2025 (Anthropic 132-engineer internal survey) | ROI framing across all catalog pages; pairs with our rediscoveryCost pitch |
| **Auto-approve rates grow 20% (<50 sessions) → 40%+ (≥750 sessions)** | McCain et al. 2026 | `session-persistence-three-channels`, `seven-safety-layers` — trust is a trajectory not a state |
| **Developers in AI-assisted conditions score 17% lower on comprehension** | Shen & Tamkin 2026 | Evaluative-lens callout on any "outsource thinking to the agent" pattern |

## New pack candidates (3)

### Pack 10 — `five-values-thirteen-principles`
- packType: `"reference"`, canonicalPattern: `"n/a"`
- Subject: the conceptual backbone of Claude Code's architecture. Ties every design choice back to a value through an operationalizing principle. Frame it as the architect's orientation before reading any implementation-level pack.
- **Position:** should be featured alongside `four-design-questions` — they are complementary (4 questions = the functional map; 5 values / 13 principles = the ethical map).
- Content: Table 1 of the paper (reproduce with attribution), the 5 values' sources, the "what the architecture does NOT do" callouts (no explicit planning graphs, no unified extension mechanism, no restoration of session-scoped trust on resume).
- **Critical:** include the 6th evaluative lens (long-term capability preservation) as a section — it's the paper's self-critique and pairs with honest failure-mode framing we already use.
- Expected rediscoveryCost: ~35,000 tokens / ~90 min (shorter than agent-design-space because the framework is tighter).

### Pack 11 — `openclaw-contrast-six-dimensions`
- packType: `"reference"`, canonicalPattern: `"n/a"`
- Subject: Section 10 of the paper. Claude Code vs OpenClaw (multi-channel personal assistant gateway) across 6 design dimensions. Demonstrates how the same questions resolve differently under different deployment contexts — from per-action safety evaluation to perimeter-level access control, from single CLI loop to embedded runtime within a gateway control plane.
- Why it matters: our catalog's thesis ("same scaffold, different body content") is the product expression of what the paper's OpenClaw contrast shows architecturally. This pack is the theoretical foundation of `packType` pluralism.
- Dependency: needs Section 10 to be fully read (I've only skimmed its existence). ~20 mins to extract content.

### Pack 12 — `six-open-directions` (research-agenda pack)
- packType: `"reference"`, canonicalPattern: `"n/a"`
- Subject: Section 12 of the paper — 6 open design directions for future agent systems:
  1. Observability-evaluation gap
  2. Cross-session persistence
  3. Harness boundary evolution
  4. Horizon scaling
  5. Governance
  6. Evaluative lens
- Position: the "what's next" pack. Each direction seeds a Pillar 2 change-trace thread when we build it (open research questions become candidate future work rows).
- Dependency: needs Section 12 to be fully read.

## Also surfaced from `related-resources.md` (still packable)

Three community-surface packs worth authoring when bandwidth allows:

| Candidate | Source | Distinct from existing? |
|---|---|---|
| `three-layer-memory-architecture` | MindStudio deep-dive (cited as "Best single resource on memory") — in-context + MEMORY.md pointer index + CLAUDE.md static config | YES — finer-grain than `nine-context-sources`; specifically about the runtime memory tier |
| `dual-model-opus-haiku-split` | George Sung "Tracing Claude Code's LLM Traffic" — Opus for main loop, Haiku for metadata | YES — not covered by any existing harness pack; pairs with `advisor-pattern-v2` |
| `prompt-caching-mechanics` | ClaudeCodeCamp "How Prompt Caching Actually Works" + WaveSpeedAI three-layer compression | YES — orthogonal surface; the `turn-execution-pipeline` pack names compaction but not caching |

## Source-enrichment targets (no new packs, just richer citations)

Academic papers now authoritatively cited in the paper's §Related Work — add to existing packs' `sources[]`:

- **arXiv 2511.09268** "Decoding the Configuration of AI Coding Agents" (328 CC config files empirical study) → `claude-code-guide`
- **arXiv 2509.14744** "On the Use of Agentic Coding Manifests" (253 CLAUDE.md files analyzed) → `nine-context-sources`
- **OpenHands, ICLR 2025** (arXiv 2407.16741) → comparison citation in `advisor-pattern-v2`
- **SWE-Agent, NeurIPS 2024** (arXiv 2405.15793) → alternative safety posture citation in `seven-safety-layers`
- **OpenHands SDK** (arXiv 2511.03690) → composable SDK reference in `extensibility-four-mechanisms`

These are NOT new packs — they're 3-5 URL additions across existing packs. Low-cost, high-credibility.

## Updated catalog roadmap

- 17 packs shipped (8 original + 9 dive-sourced today)
- +3 candidates strongly surfaced by the paper (`five-values-thirteen-principles`, `openclaw-contrast-six-dimensions`, `six-open-directions`)
- +3 candidates surfaced by `related-resources.md` specialized deep-dives (`three-layer-memory-architecture`, `dual-model-opus-haiku-split`, `prompt-caching-mechanics`)
- = **23 packs total** would cover the dive-sourced surface comprehensively

## Still not read

- Paper §3–9 (per-subsystem deep dives — architecture.md is a partial summary)
- Paper §10 full OpenClaw contrast body
- Paper §11 evaluative-lens application
- Paper §12 six open directions body
- Paper appendix (methodology, evidence base)

Next session should run a focused pass on §§3–9 for implementation-grade details before authoring the remaining 6 candidate packs — the summary docs only gave 60–70% fidelity to what's in the paper body.
