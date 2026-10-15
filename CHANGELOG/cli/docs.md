# CLI documentation history

## 2026-10-15 — Align package and executable examples

Developers and coding agents copying the CLI instructions now see `attrition-sh`, the package and executable declared by `cli/package.json`. Corrected the package label in the [project README](../../README.md), installed commands in the [CLI README](../../cli/README.md), and package, executable, npm and tarball examples in the [publishing guide](../../docs/PUBLISHING.md). Kept Attrition branding, existing correct npx quickstarts, registry URLs, managed fragments, `.attrition` paths and the arbitrary MCP configuration key.

Validation compares the documentation with the unchanged manifest and rejects a deliberately stale invocation in memory. This documentation check does not establish npm publication, ownership, package availability or installed-package usability; no registry or publishing command was run.
