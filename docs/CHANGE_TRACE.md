# Change-Trace Catalog — Pillar 2

**Last updated:** 2026-04-17
**Status:** Design complete. M7 not built.
**Consolidates:** `CHANGE_TRACE_CATALOG.md` + `CHANGE_TRACE_MOCK.md` + `CHANGE_TRACE_WHY_PEDAGOGY.md` + `ADR-001-CHANGE_TRACE_STORAGE.md`

---

## 1. Thesis

Setup is cheap now (Pillar 1 — install a pack). Understanding what you + your agent actually changed across a long session is *expensive*. Vibe-coding and agent-assisted dev produce drift: you adopt a pattern, cross-reference to three more, refactor twice, and at the end you can't ctrl+F to the moment a constant got renamed or a scenario broke.

**Pillar 2 = a searchable change-trace catalog.** A LightRAG-shaped human-readable graph that is actually just a 4-column table — indexed, browseable, queryable from CC / Cursor / Codex.

**Pitch line:**
> "Install patterns like Convex Components. Then ctrl+F your own session like LightRAG. Same catalog."

---

## 2. The 4-column row (atomic unit)

| Column | Content |
|---|---|
| **Scenario** | User-facing, concrete. "User clicked *Export CSV* on `/packs/advisor-pattern`, typed a filename, expected download — but got a 500 because `rawMarkdownPath` was null on legacy packs." |
| **Files touched** | Absolute/repo-relative paths. Each path is a search anchor. |
| **Code changes** | Diff summary + key renamed symbols (functions, consts, vars). Searchable tokens. |
| **Why** | **4-line pedagogical format (§4).** Plain + Analogy + Principle + Hook. Not what — why, for a beginner. |

---

## 3. Data model

Extends the existing Pack/Registry infra. Same scaffold, new content type.

```ts
type ChangeTrace = {
  id: string;              // "ct_2026-04-17_a7f3"
  project: string;         // "floorai"
  sessionId: string;       // CC/Codex session ref
  createdAt: string;
  rows: ChangeRow[];
  tags: string[];
  packsReferenced: string[];  // slugs — cross-ref into Pillar 1
};

type ChangeRow = {
  scenario: string;
  filesTouched: string[];
  changes: ChangeDetail[];
  why: WhyExplanation;          // structured per §4
  failureModes?: FailureMode[]; // what production incident forces this check (see §4.5)
};

/**
 * Every mature check in the catalog exists because someone got paged at 3am.
 * Attach the scar tissue to the row so juniors don't have to re-learn by incident.
 */
type FailureMode = {
  symptom: string;                                  // "Service ran fine 2h then OOMed"
  trigger: string;                                  // "Unbounded Map grew silently"
  preventionCheck: string;                          // "Soak test 24h + memory watcher"
  tier: "jr" | "mid" | "sr" | "staff";             // learning-path maturity
  relatedPacks?: string[];                          // cross-ref into Pillar 1 (catalog entries that address this failure class)
};

type ChangeDetail = {
  path: string;
  symbolsAdded: string[];
  symbolsRenamed: Array<{ from: string; to: string }>;
  symbolsRemoved: string[];
  diffSummary: string;        // 1–3 lines
};

type WhyExplanation = {
  plain: string;      // ≤15 words, no jargon
  analogy: string;    // ≤20 words, physical/social
  principle: string;  // ≤20 words, invariant rule
  hook: string;       // ≤6 words, imperative, ctrl+F anchor
};
```

---

## 4. The Why column — pedagogical schema (for beginners, first-principles)

Research foundation (4 techniques, combined):

| Technique | Contribution |
|---|---|
| Thompson, *Calculus Made Easy* (1910) — "What one fool can do, another can" | Strip jargon. Prefer short Germanic words. ≤15 words/sentence. |
| Gentner structure-mapping (1983) | Analogies transfer structure. Map new onto existing schema. |
| First principles (Aristotle → Feynman) | Reduce cause to invariant rule, not surface instance. |
| Retrieval cues (Atkinson & Shiffrin; Ebbinghaus) | Short tag restores full chunk. Mnemonic density > length. |

Supporting: Bruner enactive→iconic→symbolic, Sweller cognitive load, Bjork desirable difficulty, Minto pyramid.

### The 4-line format (fixed labels, hard word limits)

```
Plain:      ≤15 words, no jargon — explain to a beginner who just joined
Analogy:    ≤20 words, physical/social — mail, houses, tools, people
Principle:  ≤20 words, invariant rule — reusable across projects
Hook:       ≤6 words, imperative — becomes the ctrl+F index
```

### Rules
- No type names, framework names, acronyms without unpacking once.
- Analogy must be *physical* or *social* — picturable by a non-programmer.
- Principle must be *reusable*, not repo-specific.
- Hook is imperative ("Do X when Y"). Hooks are the ctrl+F retrieval anchors.

### Four real examples (from the session that built this catalog)

**Row 1 — "Pack payload missing slug"**

| | |
|---|---|
| Plain | Two workers built opposite sides of the same pipe but wrapped their data differently, so nothing flowed. |
| Analogy | Like two people mailing the same letter — one puts it in an envelope, the other hands it bare. Receiver only opens envelopes. |
| Principle | When modules talk, the *shape* of the message is part of the contract. Mocks hide shape drift; only a real handshake reveals it. |
| **Hook** | **Mocks lie. Dogfood the handshake.** |

**Row 2 — Raw MD path at `/api/…` instead of `/packs/…`**

| | |
|---|---|
| Plain | The CLI asked for the file at the wrong address. Right house, wrong street. |
| Analogy | Like mailing a letter to "42 Main" when the house is "42 Elm." Post office returns it even though the building exists. |
| Principle | URLs group by content type, not by caller. `/api` means data; `/packs` means content. |
| **Hook** | **Group by content type, not caller.** |

**Row 3 — `trust: "Verified"` at seed time**

| | |
|---|---|
| Plain | A pack marked itself five-star before any reviews existed. |
| Analogy | A brand-new restaurant hanging a "5 stars" sign on opening day before anyone tasted the food. |
| Principle | Trust must be measured by a third party, not declared by the subject. Self-asserted trust decays to lies. |
| **Hook** | **Claims aren't proof. Measurements are.** |

**Row 4 — Windows `EPERM` on concurrent `fs.rename`**

| | |
|---|---|
| Plain | Five installs ran at once and Windows said "busy" even though nothing was wrong. |
| Analogy | Five people trying to swap the same bookmark in one book. Only one swap at a time — others wait a beat. |
| Principle | Atomicity on rename is OS-dependent. When the OS serializes a shared resource, a small retry turns the race into a queue. |
| **Hook** | **If the OS says "busy," wait a beat.** |

### Quality bar — reject a Why row if
- Plain contains type name or un-unpacked acronym
- Analogy is programming-internal ("like a hash map") — not physical
- Principle is tautological ("handle errors") — not mechanistic
- Hook is ≥ 8 words or unmemorable
- Any line mentions a file path (that's what Files Touched is for)

Good row: reads clean to a non-programmer in under 20 seconds AND still resolves to the exact row on a single-word search 6 months later.

### One-line design thesis

> Scenario asks *what*. Files ask *where*. Changes ask *how*. Why asks *so I never have to learn this twice*.

---

## 5. Storage — ADR-001 (Accepted)

### Decision

**Primary: relational (Convex tables / Postgres / SQLite FTS5).**
**Secondary (optional, later): pgvector / sqlite-vec for "find similar scenario."**
**Not a graph DB. Not JSON-only. Not agent-only retrieval.**

### Why

1. **The user spec is already "4 columns."** Take the mental model at face value.
2. **95% of queries are filter + FTS.** "Every row touching `cli/src/registry.ts`", "every rename `foo → bar`", "every trace using pack X" — sub-ms in Postgres/SQLite. No graph needed.
3. **Browsability is a hard requirement.** Ctrl+F without an agent in the loop → graph DB and JSON+agent-only both break this.
4. **Graph DBs are 10× ops complexity** for 2–3 hop queries max that are `JOIN`s in SQL. They also push teams toward LLM-only query entry → regresses browsability.
5. **JSON + agent-only stalls.** Every query = LLM round-trip. No exact match. Non-deterministic. No reproducibility.
6. **Convex gives us relational + FTS built-in.** Self-host fallback: SQLite FTS5.
7. **Vector is a secondary concern.** Add sidecar embeddings later if measured demand exists.

### What's rejected
- Neo4j / LightRAG as primary store
- JSON documents queried only via agent tool calls
- Pure vector DB (Pinecone / Weaviate / Chroma) as primary

### One-line verdict
> A 4-column table is a table. Put it in a table. Add vectors if measured, not imagined. Never a graph DB for this.

---

## 6. Surfaces (reuses Pillar 1 infra)

| Surface | Endpoint / tool |
|---|---|
| Browser | `/traces` directory · `/traces/<id>` detail · filter by project + tag + date + symbol |
| MCP | `search_change_traces(query, project?, symbol?, sinceDate?)` · `get_trace(id)` · `get_row(id, idx)` |
| CLI | `attrition trace log` (append) · `attrition trace search <q>` · `attrition trace show <id>` |
| Raw MD | `GET /traces/<id>.md` — 4-column markdown table, ctrl+F friendly |
| API | `GET /api/traces?project=&symbol=&q=&since=` |

---

## 7. Mock views (ASCII)

### 7.1 Directory `/traces`

```
╭─ attrition.sh / traces ─────────────────────────────────────────────────────────────────────╮
│                                                                                             │
│   Search  ⌕  rename                                         [ Project: all ▾ ] [ ⌘K ]       │
│   Filters  ▸  #advisor-pattern  #interface-drift  ⊕ add chip                                │
│                                                                                             │
│   Apr 2026  ▓▓▓▒▒░░░░░░░░░  ← date scrubber                                                 │
│                                                                                             │
│   ID             Project     Rows   Scenario (head)                           Packs         │
│   ───────────    ────────    ────   ─────────────────────────────────────     ────────      │
│   ct_2026-04-17  aw-template   4    M2↔M4 interface-drift + Verified dem…    3             │
│   ct_2026-04-16  floorai       1    Installed rag-hybrid + golden-eval +…    3             │
│   ct_2026-04-15  propertyai    7    Spun up from floorai; renamed stores…    –             │
│   ct_2026-04-14  floorai       3    Convex schema: added answerPackets…     1 (eval-…)      │
│   ct_2026-04-13  floorai       9    Advisor-pattern wired into agent.ts…    2 (advis…)      │
│   ct_2026-04-12  nodebench-qa  2    Attrition.sh infra for advisor patte…   –              │
│                                                                                             │
│   Showing 6 of 34 · 127 rows total · 54 unique symbols · 22 files                           │
╰─────────────────────────────────────────────────────────────────────────────────────────────╯
```

### 7.2 Trace detail `/traces/ct_2026-04-17`

```
╭─ ct_2026-04-17  ·  agent-workspace-template  ·  session 45328ba3…  ·  Apr 17 ──────────────╮
│  Tags: #interface-drift #atomic-write #eval-gate                                            │
│  Packs referenced: advisor-pattern@0.1.0, golden-eval-harness@0.1.0, rag-hybrid@0.1.0       │
│  Rows: 4 · Files: 3 · Symbols: 7 · Duration: 3h 14m                                         │
╰─────────────────────────────────────────────────────────────────────────────────────────────╯
```

| # | Scenario | Files touched | Code changes | Why (plain) | Why (hook) |
|---|---|---|---|---|---|
| 1 | `[INVALID] Pack payload missing slug` on first CLI install | `cli/src/registry.ts` | `RegistryClient.get()`: added `{pack}` envelope unwrap | Two workers wrapped the data differently so nothing flowed | **Mocks lie. Dogfood the handshake.** |
| 2 | `[NOT_FOUND] /api/packs/<slug>/raw` on raw-MD fetch | `cli/src/registry.ts` | `getRawMarkdown()`: path `/api/packs/*/raw` → `/packs/*/raw` | CLI asked for the file at the wrong address | **Group by content type, not caller.** |
| 3 | `golden-eval-harness` Verified before any eval runs | `src/lib/packs/golden-eval-harness.ts` | `trust: "Verified"` → `"Community"` | A pack marked itself five-star before any reviews existed | **Claims aren't proof. Measurements are.** |
| 4 | Random Windows `EPERM` under 5 concurrent installs | `cli/src/install.ts` | `atomicWriteFile()`: EPERM/EACCES/EBUSY retry + backoff | Five installs ran at once and the OS said "busy" | **If the OS says "busy," wait a beat.** |

Expanded row view (per the catalog UI) shows full diff, symbols added/renamed/removed, full 4-line Why, and cross-references. Every token is a filter link.

### 7.3 Symbol filter (click `atomicWriteFile`)

```
╭─ ⌕ symbol:atomicWriteFile ─────────────────────────────────────────────────────────────────╮
│  3 rows · 2 traces                                                                          │
│  ct_2026-04-17 #4   Windows EPERM under 5 concurrent installs       Apr 17                  │
│  ct_2026-04-16 #1   atomic write primitive added                    Apr 16                  │
│  ct_2026-04-16 #3   Lockfile race on parallel installs              Apr 16                  │
│                                                                                             │
│  Callers:  install() in cli/src/install.ts                                                  │
│  Related:  resolveSafe · buildFragment · upsertFragment                                     │
╰─────────────────────────────────────────────────────────────────────────────────────────────╯
```

### 7.4 File filter (click `cli/src/registry.ts`)

```
╭─ ⌕ file:cli/src/registry.ts ───────────────────────────────────────────────────────────────╮
│  4 rows · 2 traces · 3 symbols modified · 1 version bump                                    │
│                                                                                             │
│   Apr 17  ct_2026-04-17 #1   get()                 envelope-unwrap                           │
│   Apr 17  ct_2026-04-17 #2   getRawMarkdown()      path remap                                │
│   Apr 16  ct_2026-04-16 #2   constructor           ATTRITION_REGISTRY_URL                    │
│   Apr 16  ct_2026-04-16 #1   request()             10s AbortController                       │
│                                                                                             │
│  Current version: 0.1.1  ·  2 behavioral changes since last release                         │
╰─────────────────────────────────────────────────────────────────────────────────────────────╯
```

### 7.5 Raw MD export `/traces/ct_2026-04-17.md`

```markdown
---
id: ct_2026-04-17
project: agent-workspace-template
session: 45328ba3-bd9b-41bd-aca1-845c50dce134
createdAt: 2026-04-17T00:43:24Z
tags: [interface-drift, atomic-write, eval-gate]
packsReferenced: [advisor-pattern, golden-eval-harness, rag-hybrid-bm25-vector]
---

# Trace ct_2026-04-17 — M2↔M4 drift + Verified demotion + Windows race

| # | Scenario | Files touched | Code changes | Why |
|---|---|---|---|---|
| 1 | CLI install failed: "Pack payload missing slug" | cli/src/registry.ts | RegistryClient.get(): {pack} envelope unwrap | Plain: Two workers wrapped data differently. Analogy: Letter in/out of envelope. Principle: Shape is contract. Hook: Mocks lie. Dogfood the handshake. |
| 2 | CLI install failed: raw MD 404 at /api/packs/<slug>/raw | cli/src/registry.ts | getRawMarkdown(): path /api/packs/*/raw → /packs/*/raw | Plain: Wrong address. Analogy: Wrong street. Principle: Group by content type. Hook: Group by content type, not caller. |
| 3 | Seed pack asserted trust: Verified before earning | src/lib/packs/golden-eval-harness.ts | trust: "Verified" → "Community" | Plain: Five-star before reviews. Analogy: Restaurant stars on opening day. Principle: Trust is measured. Hook: Claims aren't proof. Measurements are. |
| 4 | Random Windows EPERM on concurrent installs | cli/src/install.ts | atomicWriteFile(): EPERM retry + backoff | Plain: OS said busy. Analogy: Five people, one bookmark. Principle: Atomicity is OS-dependent. Hook: If the OS says "busy," wait a beat. |
```

### 7.6 MCP response shapes

```jsonc
// search_change_traces({ query: "atomicWriteFile" })
{
  "traces": [
    {"id": "ct_2026-04-17", "matchingRows": [4], "snippet": "Windows EPERM under 5 concurrent installs"},
    {"id": "ct_2026-04-16", "matchingRows": [1, 3], "snippet": "atomic write primitive added"}
  ],
  "total": 2
}

// get_row({ id: "ct_2026-04-17", rowIndex: 1 })
{
  "scenario": "User ran `attrition pack install rag-hybrid-bm25-vector` … [INVALID] Pack payload missing slug",
  "filesTouched": ["cli/src/registry.ts"],
  "changes": [{"path": "cli/src/registry.ts", "symbolsModified": ["RegistryClient.get"], "diffSummary": "added {pack}-envelope unwrap"}],
  "why": {
    "plain": "Two workers wrapped the data differently so nothing flowed.",
    "analogy": "Like mailing a letter — one uses an envelope, the other hands it bare. Receiver only opens envelopes.",
    "principle": "Shape is part of the contract. Mocks hide shape drift.",
    "hook": "Mocks lie. Dogfood the handshake."
  },
  "crossReferences": {
    "packs": ["rag-hybrid-bm25-vector@0.1.0"],
    "relatedRows": [{"trace": "ct_2026-04-17", "row": 2, "reason": "same-class-drift"}]
  }
}
```

---

## 8. Capture workflows

### 8.1 Manual (ship first) — `attrition trace log`

```
$ attrition trace log --row
? Scenario (user-facing, what they tried, what broke):
  > ...
? Files touched (comma-separated):
  > cli/src/registry.ts
? Code change summary (diff or symbols modified):
  > RegistryClient.get() — added {pack} envelope unwrap
? Why · plain (≤15 words, no jargon):
  > Two workers wrapped the data differently so nothing flowed through.
? Why · analogy (≤20 words, physical/social):
  > Like mailing a letter — one uses an envelope, the other hands it bare.
? Why · principle (≤20 words, invariant):
  > Shape is part of the contract. Mocks hide shape drift.
? Why · hook (≤6 words, imperative):
  > Mocks lie. Dogfood the handshake.
✓ Row logged as ct_2026-04-17#5
```

Enforce word limits at capture time. Warn but don't block if exceeded.

### 8.2 Post-session extractor (add when manual earns it)

1. Pull scenario from the user's failing prompt or error output.
2. Pull files + diff from `git diff` over the session range.
3. Draft Why with an LLM pass constrained to the 4-line format + word limits.
4. Human 10-second review. Reject → regenerate.

Extractor prompt lives as `attrition:trace-extractor@0.1.0` pack in the catalog — dogfoods Pillar 1.

### 8.3 Hook-integrated (add when draft acceptance ≥ 80%)

CC `PostToolUse` hook for `Edit`/`Write` accumulates candidate rows; `SessionEnd` hook ships the trace.

---

## 9. Cross-reference with Pillar 1

`ChangeTrace.packsReferenced[]` links a session to the packs it consumed:
- Pack detail page → "Used in N traces" (real adoption signal)
- Trace detail page → "Packs used: …" (narrative)
- Regression in a trace → auto-flag the pack version active at the time

---

## 10. Milestone M7 — first ship

1. Type + Convex schema (`changeTraces`, `changeRows`) — 0.5 day
2. Manual capture CLI `attrition trace log` — 1 day
3. MCP `search_change_traces` + `get_row` tools — 1 day
4. `/traces` directory + detail page + raw `.md` export — 1 day
5. One seeded trace from the session that built the catalog — 0.5 day (meta-dogfood)

**Total:** 3–4 days.

---

## 11. Open questions

- Auto-capture trust boundary: when does a draft trace need human review?
- Privacy: default private-per-project, opt-in publish publicly.
- Schema stability for symbol renames across languages (start TS/JS, extend via tree-sitter grammars).
