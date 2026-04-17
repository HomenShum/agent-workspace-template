# Agent Workspace / attrition.sh — docs index

| Doc | Covers |
|---|---|
| [`PRODUCT.md`](./PRODUCT.md) | Thesis, full gap list A–J, milestones M1–M7 with status, personas P1–P6, ASCII catalog mock, Definition of Done |
| [`CHANGE_TRACE.md`](./CHANGE_TRACE.md) | Pillar 2 — 4-column change-trace catalog: schema, Why pedagogy, storage ADR, mock views, capture workflows |
| [`EVAL_GATE_SPEC.md`](./EVAL_GATE_SPEC.md) | M6 submission eval gate — goldens, assertion union, promotion rule |
| [`PUBLISHING.md`](./PUBLISHING.md) | npm publish procedure for `attrition` + `attrition-mcp` |
| [`ADOPT_THIS_TEMPLATE.md`](./ADOPT_THIS_TEMPLATE.md) | Forking the template into a vertical repo |

Two pillars:

1. **Pack catalog** — installable production patterns (harness / UI / RAG / eval / reference). [`PRODUCT.md`](./PRODUCT.md)
2. **Change-trace catalog** — searchable 4-column session log (Scenario / Files / Changes / Why). [`CHANGE_TRACE.md`](./CHANGE_TRACE.md)

Both pillars share the same infra: Convex tables, MCP server, CLI, raw `.md` export.
