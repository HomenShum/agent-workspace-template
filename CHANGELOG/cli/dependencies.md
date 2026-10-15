# CLI dependency history

## 2026-10-15 — Resolve the patched source-map reader

Update transitive `source-map-js` from 1.2.1 to 1.2.2 within PostCSS's existing
range. Preserve the original platform metadata of unchanged optional packages;
the manifest, CLI source and tests are unchanged.

**Validation**: the unchanged `npm audit --audit-level=low` moved from one high
finding (exit 1) to zero findings (exit 0). Fresh `npm ci`, all 43 CLI tests and
`npm run build` passed; the install and checks left the lockfile unchanged.
**Base**: `de3bf2f889b1d2645253b5c63a3428e48db6b962`.
**Touches**: [MCP dependencies](../mcp/dependencies.md).
