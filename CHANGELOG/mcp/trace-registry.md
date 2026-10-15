# MCP trace-registry history

## 2026-10-15 — Apply the body deadline to the parallel trace client

The trace client had the same header-only timer lifecycle as the pack client.
Keep its existing 10,000ms budget through body reads and preserve typed errors,
response formats and JSON/Markdown byte caps.

**Validation**: `npm run verify` covers trace list/get handlers and directly calls
the currently unused raw-Markdown reader in both concurrent stalled-body waves;
actual stdio calls verify trace error flags and timeouts. All responses closed,
healthy peers progressed and the session recovered. The unchanged
`node_modules/.bin/tsx scripts/verify-trace-mcp.ts` also passed its happy, invalid,
oversize, slow-header and bare-trace scenarios (20 PASS assertions). No new
production caller, dependency, public API or configuration was added.
**Base**: `4d1e0fa05a4304bb2ee0a6ca8a45ba9cad553ac2`.
