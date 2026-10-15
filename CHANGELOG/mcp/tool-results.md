# MCP tool-result history

## 2026-10-15 — Signal existing tool failures to MCP clients

A coding agent receiving invalid input previously got the error only inside
text, with no protocol error flag. Mark existing error envelopes centrally with
`isError: true`; keep the serialized error and successful tool payloads unchanged.

**Validation**: the same actual SDK stdio invalid-slug probe moved from exit 2
(missing flag) to exit 0. `npm run verify` additionally checks invalid trace IDs,
not-found errors, timeout flags, successful controls and recovery in one session.
The unchanged two-second stdio smoke still lists eight tools.
**Base**: `4d1e0fa05a4304bb2ee0a6ca8a45ba9cad553ac2`.
