# Publishing `attrition-mcp` and `attrition`

This repo ships two npm packages:

| Package | Dir | Purpose |
|---|---|---|
| `attrition-mcp` | `mcp-server/` | MCP stdio server for the attrition.sh catalog |
| `attrition` | `cli/` | CLI for installing catalog packs into `.claude/skills/` |

Both are TypeScript ESM, Node >= 20, publish compiled `dist/` plus `README.md` and `LICENSE` only. `prepublishOnly` runs `npm run build` automatically — you cannot ship a stale `dist/`.

---

## Pre-publish checklist

Run in order, per package:

1. **All tests pass.** CLI: `cd cli && npm test`. MCP: `cd mcp-server && npm run verify` (expects a reachable registry — point `ATTRITION_REGISTRY_URL` at staging if prod is offline).
2. **Version bumped.** `npm version patch|minor|major` inside the package dir. This updates `package.json` and creates a local git tag.
3. **CHANGELOG updated.** Add a dated entry at the top. One-line bullets per change. Link PRs.
4. **`dist/` is clean.** `rm -rf dist && npm run build`. Confirm `dist/index.js` exists and is executable (shebang present).
5. **`npm pack --dry-run`** — read the file list. It should contain `dist/**`, `README.md`, `LICENSE`, `package.json`. It should NOT contain `src/`, `node_modules/`, `tsconfig.json`, `scripts/`, or any dotfile.
6. **Tarball sanity test.** `npm pack` then install the resulting `.tgz` globally in a scratch dir (see below).

Only after all six pass, publish.

---

## Publish commands (in order)

```bash
# MCP server first — the CLI doesn't currently depend on it, but by convention publish the lower-level artifact first.
cd mcp-server
npm publish --access public

cd ../cli
npm publish --access public
```

Both packages are published under their owner account's public scope (no `@scope/` prefix — they're flat names `attrition` and `attrition-mcp`). `publishConfig.access` is pinned to `public` in both `package.json` files, so the `--access public` flag is redundant but harmless.

After publish:

- `git push && git push --tags` to sync the version tag created by `npm version`.
- Verify the published artifact on npm: `npm view attrition` and `npm view attrition-mcp`. Check `dist-tags.latest` matches the version you just shipped.
- Smoke test the published tarball: `npx -y attrition-mcp@latest --help` and `npx -y attrition@latest pack list`.

---

## Testing from an unpublished tarball

Before every publish, install the tarball into a scratch project to catch `files:` misses and shebang breakage.

```bash
# In the package dir
cd cli
npm run build
npm pack
# -> produces attrition-0.1.0.tgz

# In a scratch dir
mkdir /tmp/attrition-smoke && cd /tmp/attrition-smoke
npm init -y
npm install -g /absolute/path/to/attrition-0.1.0.tgz
attrition --version
attrition pack list --registry https://agentworkspace.attrition.sh
```

For the MCP server:

```bash
cd mcp-server
npm run build
npm pack
npm install -g /absolute/path/to/attrition-mcp-0.1.0.tgz
# Stdio server — add to ~/.claude.json and invoke via Claude Code:
# { "mcpServers": { "attrition": { "command": "attrition-mcp" } } }
```

If the tarball install fails (missing `dist/index.js`, bad shebang, missing bin), fix before publishing.

---

## Version bump policy (semver)

| Change | Bump |
|---|---|
| Bug fix, doc-only change, internal refactor with identical behavior | **patch** (`0.1.0` → `0.1.1`) |
| New tool (MCP), new subcommand/flag (CLI), new optional field in responses | **minor** (`0.1.0` → `0.2.0`) |
| Removed / renamed tool or CLI arg, changed required-field shape, bumped Node engine floor, changed `.claude/skills/` write path | **major** (`0.1.0` → `1.0.0`) |

Coordinate major bumps with a CHANGELOG migration note and (ideally) one minor release that warns via deprecation before the break.

---

## Deprecation policy

Follow a two-release deprecation window:

1. **Warn release (minor).** Old API still works. CLI prints `warn: <name> is deprecated, use <new> — removed in vNext` on stderr. MCP tool responses include a top-level `deprecation` string. Update README to mark the API as deprecated.
2. **Remove release (major).** Old API deleted. CHANGELOG calls out the removal with the previous warn version number.

For immediately dangerous behavior (data loss, security bug), skip the warn window and ship a patch that disables the bad path, plus `npm deprecate` on the affected versions.

---

## Registry URL override (private / staging)

Both packages read `ATTRITION_REGISTRY_URL` at runtime. To point at a staging or self-hosted registry, set the env var before invoking:

```bash
# MCP server — in your mcpServers block
"env": { "ATTRITION_REGISTRY_URL": "https://staging.attrition.internal" }

# CLI — flag or env
attrition pack list --registry https://staging.attrition.internal
ATTRITION_REGISTRY_URL=https://staging.attrition.internal attrition pack install rag-hybrid-bm25-vector
```

The registry must serve the same JSON shape as `agentworkspace.attrition.sh`. Nothing in the npm-published artifact hardcodes the prod URL as a compile-time constant — it's a default, not a pin.

---

## Rollback via `npm deprecate`

You cannot unpublish after the 72-hour grace window. Use `npm deprecate` to warn users away from a broken version.

```bash
# Warn every version in a broken range
npm deprecate "attrition-mcp@0.2.3" "Broken section parsing — upgrade to 0.2.4"

# Warn a whole minor line
npm deprecate "attrition@<=0.3.0" "Critical bug in install atomicity — upgrade to 0.3.1+"
```

Ship the fix as a normal patch release. `npm deprecate` does not remove the tarball; it adds a warning printed during install. Combine with a pinned `dist-tags.latest` that points at the fixed version:

```bash
npm dist-tag add attrition@0.3.1 latest
```

For a truly dangerous version (credential leak, RCE), contact npm support to request unpublish within the allowed window. Otherwise, deprecate + retract `latest` is the standard recovery.

---

## Quick reference

```bash
# Full publish dance for the CLI (repeat for mcp-server):
cd cli
npm test
npm version patch
# edit CHANGELOG.md
rm -rf dist && npm run build
npm pack --dry-run         # verify file list
npm publish --access public
git push && git push --tags
```

Run the equivalent in `mcp-server/` and you're done.
