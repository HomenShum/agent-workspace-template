# Fork-to-Workspace Flow

Operators can fork any catalog pack into an editable, per-session copy. This
is the "edit for your own account" surface — the Notion-like rendering on
the read side lives in a separate workstream.

## Who owns a fork

Each fork is keyed by `(operatorSessionId, slug)`.

- `operatorSessionId` — the `operatorId` field of the operator session that
  `OperatorSessionProvider` already manages. The Provider mirrors the
  session to a cookie named `agent-workspace-operator-session` so server
  components can read it without hitting `window.localStorage`.
- `slug` — the canonical pack slug. Re-validated on every entry against
  `^[a-z0-9-]+$` (max 100 chars).

No new auth system was introduced. If the operator cleared their session,
`/my-packs` shows the sign-in nudge and links back to the landing.

## Storage

Two backends, same shape:

1. **Convex** (`convex/userPackForks.ts`) — hosted path. Table
   `userPackForks` with indexes `by_session_slug` and `by_session`. Mutations
   `createOrReplaceFork`, `deleteFork`; queries `getFork`,
   `listForksForSession`.
2. **File-backed fallback** (`src/lib/fork-storage.ts`) — activates when
   Convex isn't wired up, matching the pattern already used by
   `install-counts.ts` and `consumers-source.ts`.

File layout:

```
.attrition/forks/<operatorSessionId>/<slug>.md
.attrition/forks/<operatorSessionId>/<slug>.meta.json
```

Writes go through `tmp + atomic rename` so a process killed mid-flush never
leaves a half-written file. Reads return `null` on miss; never throw.

## Caps

| Bound                              | Value    | Location                       |
|------------------------------------|----------|--------------------------------|
| Max markdown body per fork         | 100 kB   | enforced on every save         |
| Max forks per session              | 200      | enforced on insert (Convex + FS) |
| Max session id length              | 200 chars| validated on every entry       |
| Max slug length                    | 100 chars| validated on every entry       |

Oversized writes return `FORK_TOO_LARGE`. Over-cap insert returns
`PER_SESSION_FORK_CAP_REACHED`. Nothing is silently truncated.

## Routes

- `/my-packs` — list of the operator's forks. Empty-state nudges to
  fork from a pack page.
- `/my-packs/<slug>/edit` — textarea + live preview. Autosaves after 2s
  idle. Buttons: Save, Download .md, Revert to catalog version, Delete fork.
- `/my-packs/<slug>/view` — read-only rendered view of the forked markdown.
- `/api/my-packs/<slug>` — JSON API. `GET | PUT | DELETE`. 401 if no
  session cookie; 400 on bad slug / malformed body; 413 on oversized body;
  429 at the per-session cap; 500 on disk failure.

## First-visit behaviour

Visiting `/my-packs/<slug>/edit` when no fork exists hydrates the textarea
with the catalog pack's markdown (via `packToMarkdown`). The fork is NOT
created until the operator clicks Save. This lets operators preview the
editor without committing.

## Markdown renderer

`src/lib/markdown-render.ts` — ~200 lines, zero deps. Safety invariant:
HTML-escape the entire input first, then translate markdown markers against
the already-escaped string. The only tags emitted are `h1`, `h2`, `h3`,
`p`, `ul`, `ol`, `li`, `strong`, `em`, `code`, `pre`, `blockquote`, `a`.
The only attribute emitted is a URL-validated `href` (http, https, mailto,
relative paths, fragments — nothing else).

Covered by scenario tests in `scripts/verify-fork-flow.ts`:
`<script>` stays escaped, `onerror=` stays escaped, `javascript:` hrefs
drop back to plain text.

## Server action integration point

`src/app/packs/[slug]/fork-action.ts` exports `forkPackAction(slug)`. The
pack detail page (owned by the read-side agent) can call this from a
`<form action={forkPackAction.bind(null, slug)}>` on the "Fork to
workspace" button. No session → redirect to `/?return=/packs/<slug>`.

## Verification

```bash
npx tsx scripts/verify-fork-flow.ts   # prints "FORK FLOW OK"
npx tsc --noEmit                      # typecheck clean
npm run build                         # builds /my-packs + api routes
```

## Future directions

- **Proper auth.** `operatorSessionId` is currently a self-declared client
  identifier. The shape is ready for a real OAuth/magic-link layer: swap the
  cookie source for a verified session token, keep the downstream surface
  unchanged.
- **Public sharing.** A flag `visibility: "private" | "link" | "public"`
  on `userPackForks` plus a signed read-only route enables shareable fork
  links without granting edit.
- **Upstream diff.** `sourceVersion` is stored at fork time; a follow-up can
  diff the fork against the current catalog body and surface "upstream
  changed since your fork."
- **CLI parity.** The JSON API makes `attrition-sh pack fork <slug>` a
  thin shim: `GET` current, `PUT` edited, `DELETE` cleanup.

## Files owned by this workstream

```
convex/schema.ts                          (ADDITIVE — userPackForks table)
convex/userPackForks.ts                   (new)
src/lib/fork-storage.ts                   (new)
src/lib/fork-session.ts                   (new)
src/lib/markdown-render.ts                (new)
src/components/ForkEditor.tsx             (new)
src/components/OperatorSessionProvider.tsx (MINIMAL — cookie mirror added)
src/app/my-packs/page.tsx                 (new)
src/app/my-packs/[slug]/edit/page.tsx     (new)
src/app/my-packs/[slug]/view/page.tsx     (new)
src/app/api/my-packs/[slug]/route.ts      (new)
src/app/packs/[slug]/fork-action.ts       (new)
scripts/verify-fork-flow.ts               (new)
docs/FORK_FLOW.md                         (new — this file)
```
