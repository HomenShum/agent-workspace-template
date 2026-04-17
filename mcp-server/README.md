# attrition-mcp

MCP server for the [attrition.sh](https://agentworkspace.attrition.sh) agent harness catalog. Lets Claude Code, Cursor, and Codex browse, resolve, and pull production patterns (harness, UI, RAG, eval, design, security) the same way Context7 serves library docs.

- **Transport:** stdio
- **Registry:** `ATTRITION_REGISTRY_URL` env var, default `https://agentworkspace.attrition.sh`
- **Timeout:** 10 s per fetch (AbortController)
- **Bounded reads:** 1 MB markdown cap, 5 MB JSON cap
- **No filesystem writes, no shell out, no network calls off the registry**

Catalog: <https://agentworkspace.attrition.sh>

## Install

```bash
npx attrition-mcp
```

Or install locally:

```bash
npm install -g attrition-mcp
attrition-mcp
```

## Claude Code config

Add to `~/.claude.json` (global) or `.claude.json` in your repo:

```json
{
  "mcpServers": {
    "attrition": {
      "command": "npx",
      "args": ["-y", "attrition-mcp"],
      "env": {
        "ATTRITION_REGISTRY_URL": "https://agentworkspace.attrition.sh"
      }
    }
  }
}
```

For Cursor, the equivalent lives in `~/.cursor/mcp.json` with the same shape. For Codex and other MCP-capable clients, use the same `command` / `args` / `env` payload — consult your client's MCP config docs for the exact filename.

## Tools

### `resolve_pack_id(query)`

Fuzzy-match a free-text query against pack names, taglines, and tags. Mirrors Context7's `resolve-library-id` UX.

**Example args:** `{ "query": "hybrid bm25 vector rag" }`

**Input:** `{ query: string }`
**Output:**
```json
{
  "candidates": [
    { "slug": "advisor-pattern", "name": "Advisor Pattern", "tagline": "...", "packType": "harness", "score": 2 }
  ]
}
```

Ranked by substring-hit count over tokens. Ties break toward the `Verified` trust tier. Always returns at most 5 candidates.

### `get_pack(slug)`

Fetch the full Pack JSON by slug.

**Example args:** `{ "slug": "rag-hybrid-bm25-vector" }`

**Input:** `{ slug: string }` (slug must match `^[a-z0-9-]+$`)
**Output:** `{ pack: Pack }`
**Errors:** `INVALID_SLUG`, `NOT_FOUND`, `TIMEOUT`, `UPSTREAM_ERROR`

### `get_pack_section(slug, section)`

Fetch a single H2 section from a pack's raw markdown. Use this to pull just the piece you need (e.g. `contract`, `layers`, `evaluation-checklist`) instead of paying tokens for the whole pack. Payload target: under 3k tokens.

**Example args:** `{ "slug": "rag-hybrid-bm25-vector", "section": "contract" }`

**Input:** `{ slug: string, section: SectionName }`
**Valid sections:** `summary`, `install`, `contract`, `layers`, `use-when`, `avoid-when`, `key-outcomes`, `minimal-instructions`, `full-instructions`, `evaluation-checklist`, `failure-modes`, `transfer-matrix`, `telemetry`, `security-review`, `compares-with`, `related-packs`, `changelog`, `sources`, `examples`
**Output:** `{ slug, section, content: string }`
**Errors:** `INVALID_SLUG`, `INVALID_SECTION`, `NOT_FOUND`, `PAYLOAD_TOO_LARGE`, `TIMEOUT`

### `search_packs(query?, packType?, canonicalPattern?, trust?, limit?)`

Typed directory query. Limit is capped at 50.

**Input:**
```json
{
  "query": "advisor",
  "packType": "harness",
  "canonicalPattern": "evaluator-optimizer",
  "trust": "Verified",
  "limit": 10
}
```
**Output:** `{ packs: Pack[], total: number }`

### `compare_packs(slugA, slugB, axis?)`

Merge `comparesWith` axes from two packs. Optionally scope to a single axis.

**Example args:** `{ "slugA": "advisor-pattern", "slugB": "scout-pattern", "axis": "cost" }`

**Input:** `{ slugA: string, slugB: string, axis?: "cost" | "latency" | "complexity" | "accuracy" | "a11y" | "maintainability" }`
**Output:**
```json
{
  "a": { "...full pack A..." },
  "b": { "...full pack B..." },
  "comparison": {
    "axes": [{ "axis": "cost", "winnerSlug": "advisor-pattern", "note": "..." }],
    "verdict": "advisor-pattern wins 3/5 axes; scout-pattern wins 1."
  }
}
```

## Change-trace tools (Pillar 2)

The three tools below query the change-trace catalog — per-session records of scenario / files touched / changes / why. They complement the five pack tools above; both sets share the same `ATTRITION_REGISTRY_URL` env var and run in the same MCP server process.

### `search_change_traces(query, project?, symbol?, sinceDate?, limit?)`

Full-text search over scenarios / changes / why. Returns ranked snippets plus matching-row indexes so an agent can skip straight to the relevant row without pulling a whole trace. Payload target under 2 k tokens for top 20 matches. Limit capped at 50.

**Example args:** `{ "query": "atomicWriteFile", "project": "agent-workspace-template", "limit": 10 }`

**Output:**
```json
{
  "traces": [
    {
      "id": "ct_2026-04-17",
      "project": "agent-workspace-template",
      "createdAt": "2026-04-17T10:00:00Z",
      "matchingRows": [0],
      "snippet": "Wire atomicWriteFile into trace writer..."
    }
  ],
  "total": 1
}
```

Ranked by matching-row count, then `createdAt` desc. Honest-status: if the registry returns no per-row match info, `matchingRows` is `[]`.

### `get_trace(id)`

Fetch a full `ChangeTrace` JSON object by id.

**Example args:** `{ "id": "ct_2026-04-17" }`

**Input:** `{ id: string }` (must match `^ct_\d{4}-\d{2}-\d{2}(_[a-z0-9-]{1,40})?$`)
**Output:** `{ trace: ChangeTrace }`
**Errors:** `INVALID_TRACE_ID`, `NOT_FOUND`, `TIMEOUT`, `PAYLOAD_TOO_LARGE`, `UPSTREAM_ERROR`

### `get_row(id, rowIndex)`

Fetch a single row from a trace plus resolved cross-references (referenced pack slugs and related rows in the same trace that share a touched file). Bounds-checked `rowIndex`. Payload target under 3 k tokens.

**Example args:** `{ "id": "ct_2026-04-17", "rowIndex": 0 }`

**Output:**
```json
{
  "trace": "ct_2026-04-17",
  "rowIndex": 0,
  "scenario": "...",
  "filesTouched": ["..."],
  "changes": [ /* ChangeDetail[] */ ],
  "why": { "plain": "...", "analogy": "...", "principle": "...", "hook": "..." },
  "crossReferences": {
    "packs": ["advisor-pattern"],
    "relatedRows": [ { "trace": "ct_2026-04-17", "row": 1, "reason": "shared file: ..." } ]
  }
}
```

**Errors:** `INVALID_TRACE_ID`, `ROW_OUT_OF_RANGE`, `NOT_FOUND`, `TIMEOUT`, `UPSTREAM_ERROR`

## Error envelope

Every tool returns a structured envelope on failure — never thrown to the transport:

```json
{ "error": { "code": "INVALID_SLUG", "message": "..." } }
```

| Code | Meaning |
|---|---|
| `EMPTY_QUERY` | Query string was empty or whitespace |
| `INVALID_SLUG` | Slug failed `^[a-z0-9-]+$` |
| `INVALID_SECTION` | Section not in the enum |
| `INVALID_INPUT` | Input schema mismatch |
| `NOT_FOUND` | Registry returned 404 |
| `TIMEOUT` | Registry exceeded 10 s budget |
| `PAYLOAD_TOO_LARGE` | Response exceeded 1 MB (md) or 5 MB (json) |
| `UPSTREAM_ERROR` | Registry returned 5xx / invalid JSON |
| `NETWORK_ERROR` | Transport-level failure |
| `INVALID_TRACE_ID` | Trace id failed `^ct_\d{4}-\d{2}-\d{2}(_[a-z0-9-]{1,40})?$` |
| `ROW_OUT_OF_RANGE` | `rowIndex` is past the end of the trace's rows |

## Dev

```bash
npm install
npm run build                       # tsc -> dist/
npm run dev                         # tsx src/index.ts (stdio loop)
npm run verify                      # pack-tool scenarios -> "MCP OK"
npx tsx scripts/verify-trace-mcp.ts # change-trace scenarios -> "TRACE MCP OK"
```

## Shape sync

`src/types.ts` mirrors the canonical `Pack` type from the parent repo at `src/lib/pack-schema.ts`. `src/trace-types.ts` mirrors `src/lib/trace-schema.ts` and the `FailureMode` shape from `src/lib/pack-schema.ts`. Both are deliberately inlined so this package stays standalone — when the parent schemas change, update both. The trace registry client accepts both `{ trace: ... }` / `{ traces, total }` envelopes and bare `ChangeTrace` / `ChangeTrace[]` responses so shape drift between M-milestones fails loud at the verify script instead of silently breaking production.
