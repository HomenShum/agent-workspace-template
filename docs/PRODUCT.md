# Agent Workspace / attrition.sh — Product (Pillar 1: Pack Catalog)

**Last updated:** 2026-04-17
**Consolidates:** `PRODUCT_DIRECTION_AND_GAPS.md` + `BUILD_AND_VERIFY_PLAN.md`

---

## 0. Thesis

**Problem — repeated deep-research tax.** Every new project (interview prep, quick demo, real workflow pain point) currently requires re-running a multi-minute, multi-thousand-token "deep wide search against latest industry-wide production patterns" in Claude Code / Codex / Cursor. This tax is paid for harness patterns, UI/UX patterns, production-app references, and cross-reference comparisons — UI realignment often costs more tokens than the logic.

**Solution — a browseable, retrievable, installable catalog** that collapses the deep-research step into one fetch:

1. **Browse** like `convex.dev/components`
2. **Retrieve** like Context7 (MCP: `resolve → get → section`)
3. **Download** as plain `.md` (portable, exportable, no lock-in)
4. **Install** into `.claude/skills/` or `AGENTS.md` directly

**Scope — not agent-only.** `packType: "harness" | "ui" | "reference" | "data" | "rag" | "eval" | "design" | "security"`. Same scaffold, different body content. The Pack is the universal unit.

**Positioning:** `agentworkspace.attrition.sh` = Convex Components × Context7 hybrid for production patterns. Attrition.sh is the telemetry/trust layer; Agent Workspace is the discovery + install surface.

**ROI framing.** If one pack fetch saves ~30k tokens of deep research × N projects × M engineers, break-even is trivial. attrition.sh measures the delta.

---

## 1. ASCII browsable catalog (what the product looks like)

### Directory — `agentworkspace.attrition.sh`

```
╭─────────────────────────────────────────────────────────────────────────────────────────────────╮
│  agentworkspace.attrition.sh                                                          ⌘K        │
│  catalog of production patterns · installable from Claude Code / Cursor / Codex                 │
│                                                                                                  │
│  [ Packs · 23 ] [ Traces · 34 ] [ Publishers · 3 ]                      ⌕ dive                  │
│                                                                                                  │
│  Type:     [ harness · 10 ] [ ref · 6 ] [ security · 3 ] [ ui · 2 ] [ rag · 1 ] [ eval · 1 ]    │
│  Pattern:  [ orchestrator-workers ] [ evaluator-optimizer ] [ parallelization ] [ hybrid ]      │
│  Trust:    [ Verified · 3 ] [ Community · 20 ]                                                  │
│  Tag:      [ dive-into-claude-code · 9 ] [ ui-patterns · 2 ] [ eval · 1 ]                       │
│  Model:    [ opus-4.6 ] [ sonnet-4.6 ] [ haiku-4.5 ] [ gpt-5 ]                                  │
│                                                                                                  │
│ ─────────────────────────────────────────────────────────────────────────────────────────────── │
│                                                                                                  │
│  SLUG                          TYPE    PATTERN             TRUST      v      SAVES     USED IN  │
│  ──────────────────────        ──────  ──────────────────  ─────────  ──── ────────────────────  │
│  ★ four-design-questions       ref     n/a                 Community  0.1.0 ~22k tok  floorai+1 │
│  advisor-pattern               harn.   orchestrator-work.  Verified   0.3.2 ~40k tok  floorai+2 │
│  advisor-pattern-v2            harn.   evaluator-optim.    Community  0.1.0 ~55k tok  —         │
│  evaluator-optimizer-gan       harn.   evaluator-optim.    Verified   0.2.1 ~55k tok  propertyai│
│  operator-chat-rail            harn.   prompt-chaining     Verified   0.1.0 ~18k tok  floorai   │
│  planning-and-worker-flow      harn.   orchestrator-work.  Community  0.1.0 ~30k tok  —         │
│  answer-review-quality-check   harn.   evaluator-optim.    Community  0.1.0 ~22k tok  —         │
│  turn-execution-pipeline       harn.   orchestrator-work.  Community  0.1.0 ~48k tok  —         │
│  subagent-delegation-isolation harn.   parallelization     Community  0.1.0 ~38k tok  —         │
│  session-persistence-3-channel harn.   n/a                 Community  0.1.0 ~33k tok  —         │
│  golden-eval-harness           eval    evaluator-optim.    Community  0.1.0 ~55k tok  floorai   │
│  rag-hybrid-bm25-vector        rag     hybrid              Community  0.1.0 ~35k tok  floorai   │
│  shadcn-data-table             ui      n/a                 Community  0.1.0 ~25k tok  —         │
│  linear-command-palette        ui      n/a                 Community  0.1.0 ~28k tok  floorai   │
│  pattern-decision-tree         ref     n/a                 Community  0.1.0 ~20k tok  floorai   │
│  claude-code-guide             ref     n/a                 Community  0.1.0 ~45k tok  —         │
│  nine-context-sources          ref     n/a                 Community  0.1.0 ~42k tok  —         │
│  extensibility-four-mechanisms ref     n/a                 Community  0.1.0 ~42k tok  —         │
│  agent-design-space-6-decisns  ref     n/a                 Community  0.1.0 ~48k tok  —         │
│  injection-surface-audit       sec     n/a                 Community  0.1.0 ~40k tok  —         │
│  seven-safety-layers           sec     n/a                 Community  0.1.0 ~52k tok  —         │
│  cve-pre-trust-window          sec     n/a                 Community  0.1.0 ~52k tok  —         │
│  (plus durable-streaming · hybrid-runtime · workflow-elicitation — legacy harness)              │
│                                                                                                  │
│ ─────────────────────────────────────────────────────────────────────────────────────────────── │
│                                                                                                  │
│  RECENT TRACES   (cross-link to Pillar 2)                                                        │
│  ct_2026-04-19  aw-template · 9 new dive-sourced packs + arxiv refs wired                        │
│  ct_2026-04-17  aw-template · 4 rows · drift + eval-gate + win-race                              │
│  ct_2026-04-16  floorai     · 1 row  · installed 3 packs via CLI                                 │
│  ct_2026-04-15  propertyai  · 7 rows · spun from floorai; renamed stores → properties            │
│                                                                                                  │
│  Tokens saved this week: ~1.6M · Installs: 52 · New packs: 11 · Publishers: 3                   │
╰─────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### Pack detail — `/packs/advisor-pattern`

```
╭─ /packs/advisor-pattern · v0.3.2 ─────────────────────────────────────────────────────────────╮
│  Harness · orchestrator-workers · Verified · Agent Workspace · Updated 2026-04-15              │
│                                                                                                 │
│  ┌─ INSTALL ────────────────────────────────────────────────────────────────────┐              │
│  │  $ npx attrition-sh pack install advisor-pattern                                │              │
│  │                                                                               │              │
│  │  Writes:  .claude/skills/advisor-pattern/SKILL.md                             │              │
│  │           AGENTS.md  (idempotent fragment)                                    │              │
│  │           .attrition/installed.json                                           │              │
│  │                                                                               │              │
│  │  [ copy cmd ]  [ copy AGENTS.md snippet ]  [ ↓ download .md ]                │              │
│  └──────────────────────────────────────────────────────────────────────────────┘              │
│                                                                                                 │
│  ┌─ TELEMETRY (last 100 runs, measured by attrition.sh) ───────────────────────┐              │
│  │  pass rate     94%       avg tokens       8,400       tool calls    22       │              │
│  │  avg cost     $0.08      duration         1m 42s      updated       Apr 16   │              │
│  └──────────────────────────────────────────────────────────────────────────────┘              │
│                                                                                                 │
│  ⚡ Installing this saves ~40k tokens / ~55 min of deep research per new project.              │
│                                                                                                 │
│  CONTRACT                                                                                       │
│  ──────────                                                                                     │
│  required-outputs:  [ diagnosis, recommendation, tradeoffs ]                                    │
│  token-budget:      8,000                                                                       │
│  permissions:       [ read-files, web-search ]                                                  │
│  completion:        advisor returns recommendation with ≥3 tradeoffs                            │
│  output-path:       .advisor/<task-id>.json                                                     │
│                                                                                                 │
│  LAYERS                                                                                         │
│  ──────                                                                                         │
│  ▸ Runtime Charter  (universal physics of the harness)                                          │
│  ▸ NLH              (task-specific control logic)                                               │
│  ▸ Tool Spec        (4 tools: diagnose, recommend, compare, write_advisor)                      │
│                                                                                                 │
│  TRANSFER MATRIX                                                                                │
│  model              pass     tokens    runs                                                     │
│  ──────────────    ─────    ──────    ─────                                                     │
│  opus-4.6          96%       7,800    120                                                       │
│  sonnet-4.6        94%       8,400    340                                                       │
│  haiku-4.5         85%       9,200     82                                                       │
│  gpt-5             91%       8,900    110                                                       │
│                                                                                                 │
│  COMPARES WITH                                                                                  │
│  vs evaluator-optimizer-gan     axis: cost       winner: self   — cheaper for advisory flows    │
│  vs single-model-cot            axis: accuracy   winner: self   — +7pp on diagnostic tasks      │
│  vs orchestrator-workers-v1     axis: complexity winner: other  — simpler for one-off queries   │
│                                                                                                 │
│  USED IN   floorai · propertyai · nodebench-qa                                                  │
│  RELATED   operator-chat-rail · evaluator-optimizer-gan · pattern-decision-tree                 │
│                                                                                                 │
│  SECURITY REVIEW     injection-surface: medium · 6 tool allow-list · last scan 2026-04-14      │
│  CHANGELOG          v0.3.2 — pruned redundant verifier (−800 tokens, same pass rate)            │
╰─────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### Filter interaction — click `[ ui ]` tag

```
╭─ type:ui · 2 packs ────────────────────────────────────────────────────────────────────────╮
│  shadcn-data-table           Community   ~25k tok saved   a11y-sortable, skeleton, empty    │
│  linear-command-palette      Community   ~28k tok saved   cmdk + combobox + debounced       │
│                                                                                             │
│  Compare side-by-side: [ ✓ ] [ ✓ ]  →  [ Compare packs ]                                   │
╰─────────────────────────────────────────────────────────────────────────────────────────────╯
```

Every token in the ASCII views is a live filter link. Graph-ness emerges from cross-linking, not a graph DB.

---

## 2. Current state (status as of 2026-04-17)

| Layer | What exists | Status |
|---|---|---|
| Schema | `src/lib/pack-schema.ts` — canonical `Pack` type with contract/layers/transferMatrix/telemetry/securityReview/rediscoveryCost/comparesWith/changelog | ✅ |
| Legacy packs | `src/lib/harness-packs.ts` (6 packs) adapted via registry | ✅ |
| Seed packs | `src/lib/packs/` — 5 packs across ui/rag/eval/reference | ✅ |
| Registry | `src/lib/pack-registry.ts` unified accessor + slug validation | ✅ |
| Directory UI | `/`, `PacksDirectory.tsx`, filter chips | ✅ (pre-existing) |
| Pack detail UI | `src/app/packs/[slug]/page.tsx` with 19 ordered sections | ✅ |
| Raw MD endpoint | `GET /packs/<slug>/raw` | ✅ |
| JSON API | `GET /api/packs?type=&pattern=&trust=&q=&limit=&offset=`, `GET /api/packs/<slug>` | ✅ |
| MCP server | `attrition-mcp` — 5 tools (resolve / get / section / search / compare) | ✅ |
| CLI | `attrition` — `pack install / list / search / verify` | ✅ |
| Eval gate | `convex/goldens.ts` + `eval.ts` + `packTrust.ts` promotion rule | ✅ |
| E2E contract test | `scripts/verify-e2e.ts` — 19/19 passing | ✅ |
| Dogfood | FloorAI installed 3 packs via CLI | ✅ |
| npm publish prep | LICENSE + .npmignore + README + PUBLISHING.md | ✅ (not published yet) |
| **Pillar 2: change-trace catalog** | specced in `CHANGE_TRACE.md` | 🟡 design complete, M7 not built |

---

## 3. Full gap list (grouped A–J)

Gaps still open are marked 🟡; closed ✅.

### A. Context7-parity — the retrieval layer
| # | Gap | Fix | Status |
|---|---|---|---|
| A1 | MCP server | `attrition-mcp` 5 tools | ✅ |
| A2 | Chunked retrieval per section | `get_pack_section` with H2 enum | ✅ |
| A3 | Fuzzy resolve | `resolve_pack_id` with Verified-wins tiebreak | ✅ |
| A4 | Cross-reference graph | `relatedPacks`, `requires`, `conflictsWith`, `supersedes` | ✅ |

### B. Convex-Components-parity — install layer
| # | Gap | Fix | Status |
|---|---|---|---|
| B1 | Copy-paste install block | Hero on detail page | ✅ |
| B2 | CC install path | `npx attrition-sh pack install` | ✅ |
| B3 | Raw `.md` download | `GET /packs/<slug>/raw` | ✅ |
| B4 | Isolated namespace | Skill dir + allow-list | ✅ |
| B5 | Submission eval gate | M6 goldens + `promoteIfEligible` | ✅ |

### C. Harness-science (Tongyi / Stanford)
| # | Gap | Fix | Status |
|---|---|---|---|
| C1 | Execution contract | `PackContract` | ✅ |
| C2 | Three-layer split | `PackLayers` (charter / NLH / toolSpec) | ✅ |
| C3 | Canonical-pattern enum | 5 + hybrid | ✅ |
| C4 | Attempt-loop exemplars | 3 reference packs | 🟡 |
| C5 | Subtraction log | `changelog[].removed[]` | ✅ |
| C6 | Model-transfer matrix | `transferMatrix` | ✅ |

### D. Trust / proof
| # | Gap | Fix | Status |
|---|---|---|---|
| D1 | Telemetry badges on cards | Registry join to `evalRuns` | 🟡 |
| D2 | Verified = earned, not asserted | M6 rule + seed demotion | ✅ |
| D3 | Security review field | `SecurityReview` | ✅ |
| D4 | Model-deprecation flags | auto-flag retired model IDs | 🟡 |

### E. Distribution / dogfooding
| # | Gap | Fix | Status |
|---|---|---|---|
| E1 | Verticals as consumers, not forks | FloorAI installs 3 packs via CLI | ✅ (partial — 3 of 5 target) |
| E2 | CC-native discovery | MCP server | ✅ |
| E3 | Publisher signing / provenance | sigstore-style signed manifests | 🟡 |
| E4 | Reverse index (`consumers[]`) | Vertical lockfile aggregation | 🟡 |

### F. Agent-harness content
- 🟡 `claude-code-guide` reference pack
- 🟡 Evaluator-optimizer runnable-golden pack
- 🟡 Advisor-pattern pack as a first-class seeded pack (currently legacy)
- 🟡 Native-code → NLH migration pack

### G. Scope expansion (beyond harnesses)
- ✅ UI packs (shadcn-data-table, linear-command-palette)
- ✅ RAG pack (rag-hybrid-bm25-vector)
- ✅ Eval pack (golden-eval-harness)
- ✅ Reference pack (pattern-decision-tree)
- 🟡 Design-system pack
- 🟡 Security / compliance pack
- 🟡 Production-app-reference packs ("How Linear does X")

### H. Retrieval surfaces
- ✅ Browser · ✅ MCP · ✅ Raw `.md` · ✅ CLI install · ✅ API
- 🟡 `.cursor/rules/` generator
- 🟡 Claude Code `/attrition` slash-command plugin

### I. Cross-reference & comparison
- ✅ `comparesWith` field + table on detail page
- ✅ Relationship arrays + chips
- 🟡 `/compare?a=X&b=Y` route
- 🟡 Decision-tree packs-about-packs (stub exists in `pattern-decision-tree`)

### J. ROI metering
- ✅ `rediscoveryCost` schema field
- 🟡 Install counter surfaced on card ("installed 1,284× — est 38M tokens saved")
- 🟡 Attrition.sh dashboard cumulative tokens-saved per org

---

## 4. Milestones & status

| M | Deliverable | Status |
|---|---|---|
| M1 | Schema + exemplar advisor-pattern end-to-end | ✅ |
| M2 | Raw `.md` + typed JSON API | ✅ |
| M3 | `attrition-mcp` server (5 tools) | ✅ |
| M4 | `attrition` CLI (install / list / search / verify) | ✅ |
| M5 | Seed 5 breadth packs across packTypes | ✅ |
| M6 | Submission eval gate + promotion rule | ✅ |
| **M7** | **Pillar 2 change-trace catalog** — see [`CHANGE_TRACE.md`](./CHANGE_TRACE.md) | 🟡 |

---

## 5. Personas & verification scenarios

| # | Persona | Channel | Scenario target |
|---|---|---|---|
| P1 | Interview-prep Builder (11pm) | Claude Code | TTFWA < 2 min cold |
| P2 | UI Realigner | Cursor via MCP | section fetch < 3k tokens |
| P3 | Registry Publisher | `/submit` | eval gate → Verified at pass rate ≥ 95% / ≥ 10 runs |
| P4 | Vertical Consumer (FloorAI / etc) | CI lockfile | ≥ 5 packs per vertical |
| P5 | Agent-as-user | MCP client | autonomous resolve → install → retry |
| P6 | Long-running / concurrent / degraded | Cron + CDN | nightly transfer matrix, static fallback, idempotent installs |

Scoring rubric and adversarial seed (injection / SSRF / oversized / slug traversal / tool allow-list abuse / model-ID squatting / signature tampering / clone-replace / install-path escape / submission flood) are tracked in `scripts/verify-e2e.ts` and the M6 verify script. E2E contract test currently 19/19.

---

## 6. Definition of done (full product)

- M1–M7 shipped
- All P1–P6 scenarios pass
- Red-team script green
- ≥ 1 vertical consumes ≥ 5 packs via lockfile
- attrition.sh dashboard shows measured tokens-saved > 0 for ≥ 10 distinct users
- npm packages published; one-line `.claude.json` snippet in README

---

## 7. Next wedges

1. **Ship M7** — change-trace catalog MVP (see [`CHANGE_TRACE.md`](./CHANGE_TRACE.md))
2. **Publish `attrition` + `attrition-mcp` to npm** — unlocks P1 adoption
3. **Telemetry badges on cards (D1)** + **install counter (J)** — ROI visibility
4. **FloorAI → consume 2 more packs** to hit the "≥ 5 per vertical" DoD bar
