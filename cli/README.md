# attrition

CLI for the [attrition.sh](https://agentworkspace.attrition.sh) Agent Workspace catalog. Installs agent harness, UI, RAG, and eval patterns from the catalog into `.claude/skills/` and `AGENTS.md` in under 2 minutes, cold.

Catalog: <https://agentworkspace.attrition.sh>

## Quick start

```bash
npx attrition-sh pack install rag-hybrid-bm25-vector
```

`rag-hybrid-bm25-vector` is a real slug in the catalog — swap it for any pack returned by `attrition pack list`.

This creates:

- `.claude/skills/<slug>/SKILL.md` — the skill, with frontmatter
- `AGENTS.md` — appended with a managed fragment between `<!-- attrition:pack:<slug>:start -->` / `:end` markers
- `.attrition/installed.json` — lockfile for drift detection

Re-running the same install is **idempotent**: the AGENTS.md fragment is replaced in place (no duplicates) and the SKILL.md is overwritten atomically.

## Commands

- `attrition pack install <slug>` — install a pack (default target: Claude Code)
- `attrition pack install <slug> --target=cursor` — install as a Cursor rule (`.cursor/rules/<slug>.mdc`)
- `attrition pack list` — list all registry packs
- `attrition pack search <query>` — search packs
- `attrition pack verify` — compare installed versions against the registry

## Cursor users

```bash
npx attrition-sh pack install rag-hybrid-bm25-vector --target=cursor
```

With `--target=cursor`, the CLI writes:

- `.cursor/rules/<slug>.mdc` — the rule, with Cursor-style MDC frontmatter (`description`, `globs`, `alwaysApply: false`). Cursor picks up any file under `.cursor/rules/*.mdc` automatically — no additional project config required.
- `.attrition/installed.json` — the same lockfile as the Claude Code target, but with `target: "cursor"` recorded per pack so `attrition pack verify` and the catalog reverse-index can tell the targets apart.

No `AGENTS.md` is created or modified with `--target=cursor`. Claude Code and Cursor can coexist in the same repo: install pack A to `claude-code` and pack B to `cursor` and both end up tracked in the same lockfile with distinct `target` fields.

## Global flags

- `--registry <url>` — override `ATTRITION_REGISTRY_URL`
- `--dry-run` — print planned changes without writing
- `--no-telemetry` — disable anonymous install ping
- `--json` — emit machine-readable JSON output

## Environment variables

- `ATTRITION_REGISTRY_URL` — base URL for the pack registry (default: `https://agentworkspace.attrition.sh`)

## Safety guarantees

- Slug validation (`^[a-z0-9][a-z0-9-]{0,99}$`) at every entry point.
- Path resolution via `path.resolve` + `path.relative` — no writes escape cwd.
- Atomic file writes (tmp file + rename) — never partial on crash.
- AGENTS.md marker corruption is detected BEFORE any writes; installs abort loudly.
- Re-installing the same slug is idempotent — single fragment in AGENTS.md.
- Registry errors produce non-zero exit codes; no partial state.
- Telemetry is fire-and-forget; failures never block install.

## Dev

```bash
cd cli
npm install
npm run build
npm test
npm run dev -- pack list
```
