# Public catalog contract and handoff

A developer evaluating this starter should be able to browse and export a real pack before configuring a backend. A search visitor should reach the same readable document, with the correct title and canonical URL. The public catalog is separate from the Convex runtime: missing configuration remains visible on Studio, submission and workspace pages.

## Start and verify

Use the locked installs and commands in the root README. Root `npm run check` executes:

1. `typecheck`: root TypeScript, including the Convex sources covered by the existing tsconfig.
2. `test`: actual Vitest assertions for the published seeded catalog. The removed `vitest-shim.ts` did not execute tests. The current cohort contains17 seeded packs; its architecture additions use later publication dates. Golden-eval's Community sample has metadata fields, but those fields do not confer Verified status or prove measured performance.
3. `build`: Next's production build, with no Convex deployment or seeding.
4. `verify:public`: a Next process on an ephemeral loopback port, owned and stopped by the verifier. It checks each public sitemap document, raw HTML metadata, crawler MIME types, filter isolation across repeated/concurrent readers, invalid/missing documents, markdown exports, a legacy redirect, noindex headers, and the missing-backend message.

The CLI has its own installation scenario tests and TypeScript build. MCP verification exercises handlers against an owned mock HTTP server, including missing/invalid input, an oversized response, and a timeout. It does not certify an authenticated live MCP integration or provider execution. GitHub CI runs these lanes on Ubuntu and Windows; read the run at the candidate commit before calling a branch green.

`scripts/verify-e2e.ts` is a separate legacy workflow that starts `npm run dev` and therefore Convex. It is not part of the keyless CI path. Read its process/backend behavior before using it. The new verifier requires `.env.local` to be absent; never discard a private file to satisfy that condition.

## Public routes and search

The canonical origin is `https://agentworkspace.attrition.sh`, the custom domain on the existing Vercel project. Root, pack, publisher, trace and comparison pages provide document-specific title, description, canonical URL, Open Graph and Twitter metadata. The registry supplies detail text and the sitemap. Filter and comparison query variants canonicalize to their base document.

Metadata is derived locally, so `htmlLimitedBots: /.*/` returns it in the initial `<head>` for every user agent. Without this setting, the first built HTTP check found Next streaming the home canonical into the body. This follows [Next's documented way to disable metadata streaming](https://nextjs.org/docs/app/api-reference/config/next-config-js/htmlLimitedBots); verification requires actual head tags rather than accepting strings inside script payloads.

`/robots.txt` and `/sitemap.xml` are real Next metadata routes. The sitemap lists current public documents; it excludes query permutations, raw exports, APIs, personal packs, Studio, submission and workspace pages. It does not invent modification timestamps, ratings or performance claims. Workspace/personal/API routes send `X-Robots-Tag: noindex, nofollow`. Crawler directives guide indexing; they do not authorize access or replace tenant checks.

The trace directory previously used `force-static`, which caused a request such as `/traces?q=zz-nonexistent-public-contract` to return every trace. Removing that override lets the existing request filter execute. The HTTP scenarios verify empty and unfiltered responses concurrently to catch that regression.

The inherited trace loading boundary also sent HTTP200 before a missing detail could return `notFound()`. The trace registry is local, so that skeleton was removed: unknown trace documents now return an actual404 before any response is streamed. This also avoids returning a loading shell to consumers that only read HTML.

## Dependency repair

The lockfiles resolve the observed advisories, including Next15.5.25 and its sharp0.35.4 image pipeline, Convex/ws, and each package's development tooling. The existing Next15 line is retained. A scoped `next -> postcss:8.5.28` override replaces Next's exact vulnerable nested PostCSS requirement; keep it until an upstream compatible release resolves that dependency. Vitest4.1.11 now executes the root and CLI assertions, and tsx4.23.0 makes the existing verification scripts installable. Production dependency updates require the build/runtime checks; a clean audit alone does not establish equivalent behavior. Rerun all three audits when dependency state changes.

## Review and production boundary

For a release, inspect raw HTML and browser pixels from the deployed candidate at the exact source revision. Confirm the provider created a Ready deployment associated with that source, then fetch the canonical site's home, robots and sitemap and inspect the promised content. A successful push or CI result does not establish production adoption. Keep the old production result distinct from local candidate evidence.

Responsive QA must cover320,390,834,1280 and1440 pixel widths one viewport at a time: directory/filter, pack read/export, publisher, trace search/detail and a backend-missing route. Include normal, keyboard and no-JavaScript use; capture DOM, console and screenshots before resizing. Automated accessibility findings and these scenarios are scoped evidence, not full design, responsiveness, interaction, accessibility, performance, usage or alignment grades. No full portfolio grades or SEO ranking gains follow from this change.

The first browser pass exposed button-only `aria-pressed` attributes on navigation links and pale text on the light background, including white failure-mode descriptions inherited from the older dark palette. Filter links now use `aria-current`; the shared labels and failure-mode panel use readable light-theme colors. Clipboard comparison on Windows accounts for native CRLF line endings; downloaded markdown must match the HTTP response bytes exactly.

The narrow pack column now has `min-width:0`: its comparison table remains in its existing horizontal scroll container instead of widening the entire page. The directory's long filter panel scrolls with the document; pinning a panel taller than the viewport made lower controls unreachable in the no-JavaScript flow. Pack publisher names link to the existing profile pages so those documents are reachable during normal browsing.

Google Search Console impressions/queries and publishing authorization are needed to choose traffic-backed content edits. No Distribb account, CMS publisher, paid SEO service or provider key is connected by this repository change.
