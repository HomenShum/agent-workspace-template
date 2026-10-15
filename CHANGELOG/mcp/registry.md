# MCP pack-registry history

## 2026-10-15 — Keep the deadline active through response bodies

An upstream registry can send headers and then stop sending data. The old timer
ended at headers. Use the existing 10,000ms budget through the body and map abort
and timeout errors to the existing `TIMEOUT` response. Byte caps are unchanged.

**Validation**: before editing, the successful control completed but the partial
body remained pending at 10,501ms and required the external 13-second watchdog
(exit 2). The same probe then returned `TIMEOUT` at 10,116ms without the watchdog
(exit 0). `npm run verify` passed two eight-request concurrent body-stall waves,
including JSON/Markdown, healthy peers, recovery and connection cleanup. Build,
unchanged audit threshold and two-second stdio smoke passed. These are local
fixture results, not provider or production certification.
**Base**: `4d1e0fa05a4304bb2ee0a6ca8a45ba9cad553ac2`.
