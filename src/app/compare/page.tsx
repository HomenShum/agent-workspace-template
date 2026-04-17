/**
 * /compare?a=<slug>&b=<slug> — side-by-side pack comparison.
 *
 * Server component. Resolves slugs via the registry chokepoint so
 * path-traversal / overlong / non-alphanumeric slugs return null and
 * render the picker error state rather than crashing the route.
 *
 * Layout:
 *   Missing either slug        → PackPicker (grouped dropdowns)
 *   Both slugs identical       → Picker with "pick two different packs"
 *   Either slug not found      → Picker with error message referencing the miss
 *   Both resolved successfully → Two-column mini pack-detail
 *                                + SharedFieldsRow
 *                                + ComparisonMergedTable
 *                                + DiffHighlights
 *
 * This route backs the MCP `compare_packs` tool: any URL pattern that
 * ships on the client must be stable here.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getAllPacks, getPackBySlug } from "@/lib/pack-registry";
import {
  CompareColumn,
  ComparisonMergedTable,
  DiffHighlights,
  PackPicker,
  SharedFieldsRow,
} from "./page-sections";

export const metadata: Metadata = {
  title: "Compare packs — attrition.sh",
  description:
    "Side-by-side comparison of any two packs in the Agent Workspace catalog.",
};

type SearchParams = { [k: string]: string | string[] | undefined };

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const aRaw = firstParam(sp.a);
  const bRaw = firstParam(sp.b);

  const allPacks = getAllPacks();

  // Case 1: nothing specified → picker only.
  if (!aRaw && !bRaw) {
    return (
      <main className="app-shell">
        <div className="app-frame">
          <Header />
          <div className="mt-8">
            <PackPicker packs={allPacks} />
          </div>
        </div>
      </main>
    );
  }

  // Case 2: only one specified → picker with the missing side highlighted.
  // The already-specified slug is validated so we don't silently carry a
  // garbage value into the dropdown.
  if (!aRaw || !bRaw) {
    const known = aRaw ? getPackBySlug(aRaw) : getPackBySlug(bRaw!);
    const missingSide: "a" | "b" = !aRaw ? "a" : "b";
    const err = known
      ? `Pick a second pack to compare with "${known.name}".`
      : `Couldn't find the pack you supplied. Pick two from the lists below.`;
    return (
      <main className="app-shell">
        <div className="app-frame">
          <Header />
          <div className="mt-8">
            <PackPicker
              packs={allPacks}
              selectedA={known?.slug && !aRaw ? undefined : known?.slug}
              selectedB={known?.slug && !bRaw ? known?.slug : undefined}
              highlight={missingSide}
              errorMessage={err}
            />
          </div>
        </div>
      </main>
    );
  }

  // Case 3: same slug on both sides.
  if (aRaw === bRaw) {
    return (
      <main className="app-shell">
        <div className="app-frame">
          <Header />
          <div className="mt-8">
            <PackPicker
              packs={allPacks}
              selectedA={aRaw}
              errorMessage="Pick two different packs. Comparing a pack with itself isn't useful."
            />
          </div>
        </div>
      </main>
    );
  }

  // Case 4: resolve through the registry. Invalid slugs (path traversal,
  // wrong charset, too long) return null here — we surface the picker
  // with an explicit miss message instead of 500ing.
  const a = getPackBySlug(aRaw);
  const b = getPackBySlug(bRaw);

  if (!a || !b) {
    const missing: string[] = [];
    if (!a) missing.push(aRaw);
    if (!b) missing.push(bRaw);
    const safeMissing = missing
      // Defensive scrub: strip everything outside the slug charset so
      // the echoed value can never carry JS-looking tokens (onerror=,
      // script, etc). React already HTML-escapes text children — this
      // is belt-and-braces so the error message stays boring ASCII.
      .map((s) => s.replace(/[^a-zA-Z0-9-]/g, ""))
      .map((s) => (s.length === 0 ? "(invalid)" : s))
      .map((s) => (s.length > 60 ? s.slice(0, 60) + "..." : s));
    return (
      <main className="app-shell">
        <div className="app-frame">
          <Header />
          <div className="mt-8">
            <PackPicker
              packs={allPacks}
              selectedA={a?.slug}
              selectedB={b?.slug}
              highlight={!a ? "a" : "b"}
              errorMessage={`Could not find pack(s): ${safeMissing.join(", ")}. Pick valid slugs from the lists below.`}
            />
          </div>
        </div>
      </main>
    );
  }

  // Happy path: render both columns + merged + shared + diff.
  return (
    <main className="app-shell">
      <div className="app-frame">
        <Header
          breadcrumb={
            <span className="text-xs text-slate-500">
              Comparing{" "}
              <Link
                href={`/packs/${a.slug}`}
                className="font-mono text-slate-700 hover:underline"
              >
                {a.slug}
              </Link>{" "}
              ↔{" "}
              <Link
                href={`/packs/${b.slug}`}
                className="font-mono text-slate-700 hover:underline"
              >
                {b.slug}
              </Link>
            </span>
          }
        />

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <CompareColumn pack={a} side="a" />
          <CompareColumn pack={b} side="b" />
        </div>

        <div className="mt-6 space-y-6">
          <SharedFieldsRow a={a} b={b} />
          <ComparisonMergedTable a={a} b={b} />
          <DiffHighlights a={a} b={b} />
        </div>

        <section className="mt-6 glass-panel px-6 py-6 sm:px-8">
          <p className="section-label">Swap / reset</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href={`/compare?a=${encodeURIComponent(b.slug)}&b=${encodeURIComponent(a.slug)}`}
              className="directory-link-button"
              data-testid="compare-swap"
            >
              <span>Swap A ↔ B</span>
              <span aria-hidden="true">↔</span>
            </Link>
            <Link href="/compare" className="directory-link-button">
              <span>Pick two different packs</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Header({ breadcrumb }: { breadcrumb?: React.ReactNode }) {
  return (
    <header className="glass-panel px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/" className="directory-pill directory-pill-small">
          Back to directory
        </Link>
        <span className="directory-pill directory-pill-small">Compare</span>
        {breadcrumb}
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
        Pack comparison
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        Two packs, side-by-side. Merged comparisons, shared shape, and diff
        highlights in one view.
      </p>
    </header>
  );
}
