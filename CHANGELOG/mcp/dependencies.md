# MCP dependency history

## 2026-10-15 — Resolve compatible patched registry dependencies

Update SDK 1.29.0 to 1.32.1, `fast-uri` 3.1.7 to 3.1.8, `ip-address` 10.7.0
to 10.7.4 and `proxy-addr` 2.0.7 to 2.0.8 within existing parent ranges.
Only those four lock entries change; the manifest, handlers and tests are unchanged.

**Validation**: the unchanged `npm audit --audit-level=low` moved from four
findings (one critical, one high, two moderate; exit 1) to zero (exit 0).
Fresh `npm ci`, build, bounded mock-handler verification and the unchanged stdio
smoke passed; the handshake still lists eight tools. Checks left the lockfile
unchanged. These local checks do not certify provider or production behavior.
**Base**: `de3bf2f889b1d2645253b5c63a3428e48db6b962`.
**Touches**: [CLI dependencies](../cli/dependencies.md).
