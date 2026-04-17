/**
 * /packs/<slug> — 404 page.
 *
 * Rendered when `getPackBySlug(slug)` returns null (unknown slug, invalid
 * shape, path traversal attempt, etc.). Intentionally minimal — matches
 * the paper aesthetic of the redesigned pack detail page.
 */

import Link from "next/link";

export default function PackNotFound() {
  return (
    <main className="app-shell notion-doc">
      <div className="mx-auto w-full max-w-[680px] px-4 py-24 sm:px-6">
        <p className="section-label">Not found</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
          Pack not found in catalog
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-700">
          The slug you requested doesn&apos;t match any pack we&apos;ve
          published. It may have been renamed, unpublished, or never existed.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/" className="notion-toolbar-button">
            Browse all packs
          </Link>
          <Link href="/compare" className="notion-toolbar-button">
            Compare packs
          </Link>
        </div>
      </div>
    </main>
  );
}
