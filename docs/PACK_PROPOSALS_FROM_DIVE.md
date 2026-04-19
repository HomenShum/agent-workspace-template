# Pack proposals mined from VILA-Lab/Dive-into-Claude-Code

**Source:** https://github.com/VILA-Lab/Dive-into-Claude-Code (arXiv 2604.14228 · 266★ · Apr 19 2026)
**TL;DR of the paper:** Claude Code is 98.4% deterministic infrastructure, 1.6% AI decision logic. The loop is trivial; the *cross-cutting harness* (hooks, classifier, compaction, isolation) is what resists reimplementation.

## Coverage honesty

| Source | Coverage |
|---|---|
| `docs/architecture.md` (10kB) | **fully read** (all 211 lines) |
| `docs/build-your-own-agent.md` (10kB) | **sampled** — all 8 `##` sections + Meta-Pattern body in full |
| `docs/related-resources.md` (11kB) | **sampled** — first 50 lines (3 of 6 tables) |
| `README.md` (28kB) | **first 3000 chars** (TL;DR + TOC + Key Highlights) |
| `paper/Dive_into_Claude_Code.pdf` (1.2MB) | not read |
| `CITATION.cff` | not read |

Proposals below reflect the **read** content. A second pass on the paper PDF would likely surface 2–3 more pack candidates around the `queryLoop` internals, classifier design, and compaction algorithm details.

## The paper's big claims (to cite verbatim-safely in pack summaries)

1. **~1.6% AI / 98.4% infrastructure** — the anchor statistic for the whole catalog's framing.
2. **Three recurring design commitments** (build-your-own-agent §Meta-Pattern):
   - Graduated layering over monolithic mechanisms
   - Append-only designs favoring auditability over query power
   - Model judgment within a deterministic harness
3. **CLAUDE.md is user context, NOT system prompt** (architecture.md §Context Construction) — probabilistic compliance vs. deterministic enforcement. This clarifies a common agent-design mistake.
4. **File-based memory without embeddings or vector DB** — LLM scans headers of up to 5 relevant files on demand. Inspectable, editable, version-controllable. Anti-RAG for per-user memory.

The paper + 3 companion docs map directly onto our `packType` enum. 9 high-value pack candidates below (updated from 8).

## Proposed new packs

| # | Slug | Type / Pattern | Source sections | Why it belongs |
|---|---|---|---|---|
| 1 | `turn-execution-pipeline` | `harness` · orchestrator-workers | architecture.md §Turn Execution 9-Step · Pre-Model Context Shapers | Canonical loop shape. Exemplar of the "simple loop, hard harness" thesis. |
| 2 | `seven-safety-layers` | `security` · n/a | architecture.md §Seven Independent Safety Layers · §Permission System · Auto-Mode Classifier | Defense-in-depth pattern with honest failure modes: "all layers share perf constraints; 50+ subcommands bypass". |
| 3 | `nine-context-sources` | `reference` · n/a | architecture.md §Context Construction · CLAUDE.md 4-Level Hierarchy · File-Based Memory | The ordered-context spec every agent harness reimplements badly. Ships the correct order. |
| 4 | `subagent-delegation-three-isolation-modes` | `harness` · parallelization | architecture.md §Subagent Delegation · SkillTool vs AgentTool · Sidechain Transcripts | 6 built-in types + custom agents + 3 isolation modes. Directly maps to `orchestrating-swarms` territory. |
| 5 | `extensibility-four-mechanisms` | `reference` · n/a | architecture.md §MCP, Plugins, Skills, Hooks · Graduated Context Cost · Tool Pool 5-step · Three Injection Points | Decision tree for *which* extension mechanism to reach for — most misunderstood CC surface. |
| 6 | `session-persistence-three-channels` | `harness` · n/a | architecture.md §Session Persistence · "Permissions Never Restored on Resume" | Captures the safety design trade-off explicitly — a rare pack about a deliberate *non-feature*. |
| 7 | `agent-design-space-six-decisions` | `reference` · n/a | build-your-own-agent.md all 6 decisions + Meta-Pattern: Three Recurring Commitments | The "pattern-decision-tree" pack's big brother — framed as architect's choices, not cookbook. |
| 8 | `cve-pre-trust-window` | `security` · n/a | README §Key Highlights · 4 CVEs referenced | Concrete prompt-injection + extension-execution surface. Pairs with `injection-surface-audit`. |
| 9 | `four-design-questions` | `reference` · n/a | architecture.md §Four Design Questions table | Short, high-leverage artifact: 4 questions × 2–3 answers each (Claude Code vs LangGraph, Devin, SWE-Agent, Aider). Perfect entry-level pack — reads in 2 min, re-frames every later pack. |

## Additional corrections to the first draft

After fully reading `architecture.md`, two of the original proposals need sharpening:

- **Pack #3 `nine-context-sources`** — must explicitly include the CLAUDE.md-as-user-context distinction. That is the single most-misunderstood design choice in community reimplementations, and the paper calls it out as "Critical design choice." Moving this to the pack's **summary**, not a footnote.
- **Pack #4 `subagent-delegation`** — add the **SkillTool vs AgentTool** trade-off (same-window cheap injection vs. ~7× token isolated spawn) as the central decision point. This is the knob every harness engineer will get wrong first.

## Concrete `consumers[]` candidates from related-resources

Read the first 3 tables. Clean-room reimplementations are natural `consumers[]` entries once `claude-code-guide` and `turn-execution-pipeline` publish:

- **claw-code** (Rust, 179K★ in 9 days, 512K LoC TS → ~20K Rust)
- **nano-claude-code** (Python, ~5K lines)
- **open-claude-code** (nightly auto-decompile, 903+ tests, 25 tools, 4 MCP transports, 6 permission modes)
- **claude-code-working** (Bun-runnable, 450+ chunks, 30 feature flags)
- **T-Lab-CUHKSZ/claude-code** (research fork)

Plus 3 tutorial / guide repos usable as `examples[]` entries:
- **shareAI-lab/learn-claude-code** — "Bash is all you need", 19-chapter Python course
- **claude-code-ultimate-guide** — production templates + cheatsheets
- **everything-claude-code** — agent-harness optimization, 50K+★

## Each pack inherits our existing scaffolding

For every proposal:
- **Rediscovery cost** — can claim ~20–40k tokens measurable (user would otherwise read the 57-page paper + 3 companion docs).
- **Sources** — arXiv paper, 3 companion `.md` files in the repo, plus community analyses `related-resources.md` already catalogs (open-source reimplementations, blog posts, pre/post-leak reverse-engineering).
- **Failure modes** — the paper documents them explicitly (shared perf constraints across safety layers, 50+ bypass subcommands, CVE pre-trust window).
- **Transfer matrix** — n/a for most (these are *about* Claude Code, not harnesses to run).
- **Compares with** — cross-reference `advisor-pattern-v2`, `claude-code-guide`, `pattern-decision-tree`, `injection-surface-audit`.

## Also catalog-worthy (not new packs, but enrichment)

- `related-resources.md` lists open-source Claude Code reimplementations. These become `consumers[]` entries once we add `claude-code-guide` visibility.
- CITATION.cff provides a clean academic citation — add to `sources[]` on `claude-code-guide` and `pattern-decision-tree`.
- `assets/main_structure.png` is a labeled system diagram — useful as a pack detail-page hero image for `turn-execution-pipeline`.

## Next step

Spawn one seed-pack agent per proposal (or bundle in groups of 3) using the same prompt shape as the Wave 5F F-pack agent that produced `claude-code-guide`/`advisor-pattern-v2`/`injection-surface-audit`. Expected effort: ~3 days for all 8, parallelizable.

## License note

Repo is CC-BY-NC-SA-4.0. Our packs must **attribute VILA-Lab + the paper + the ~2604.14228 arXiv ID** on every derived pack's `sources[]` and must inherit the NC-SA terms for any verbatim excerpts. Paraphrased architectural summaries with citation are fine.
