import Link from "next/link";
import { getPublisherProfile, type HarnessPack } from "@/lib/harness-packs";
import { PackArtwork } from "@/components/PackArtwork";
import { PackCard } from "@/components/PackCard";
import { DirectorySearchBox } from "@/components/DirectorySearchBox";
import { DirectoryClearFilters } from "@/components/DirectoryClearFilters";
import type { Pack, PackType, CanonicalPattern } from "@/lib/pack-schema";
import type { TagCount } from "@/lib/directory-tags";
import { PINNED_TAG, pickTagChipSet } from "@/lib/directory-tags";

type SortMode = "featured" | "updated" | "name";
type TrustMode = "all" | "Verified" | "Community";

/**
 * Raw URL search-params shape handed in from the page. Each field is
 * the unparsed string (or undefined) as Next gives it. Parsing + bounds-
 * checking happens INSIDE the server component so the same props can
 * come from either the real Next page or a test harness.
 */
export type DirectorySearchParams = {
  q?: string;
  tag?: string;
  type?: string;
  pattern?: string;
  trust?: string;
  publisher?: string;
  sort?: string;
};

/**
 * PacksDirectory — SERVER component, fully prop-driven.
 *
 * URL state drives every filter; the page reads `searchParams` from the
 * Next.js App Router and hands the parsed object to this component.
 * Nothing about filter/sort is resolved on the client — the HTML that
 * ships is already the narrowed view.
 *
 * URL params (all optional):
 *   - `?q=`         free-text search over name/tagline/summary/tags/compat/publisher
 *   - `?trust=`     Verified | Community
 *   - `?type=`      harness | ui | reference | data | rag | eval | design | security
 *   - `?pattern=`   canonical pattern (skip "n/a" from chip set)
 *   - `?tag=`       any pack tag
 *   - `?publisher=` publisher slug
 *   - `?sort=`      featured | updated | name
 *
 * Every filter chip is a server-rendered <Link href="/?…params">. The
 * search input is a `"use client"` island (DirectorySearchBox) that
 * progressive-enhances a plain <form action="/">. The reset button is
 * a plain server-side <form action="/"> that clears every param in one
 * request (DirectoryClearFilters). No client hooks reach this file.
 */
export function PacksDirectory({
  packs,
  traceCount,
  publisherCount,
  allTagsByCount,
  searchParams,
}: {
  packs: Pack[];
  traceCount: number;
  publisherCount: number;
  allTagsByCount: TagCount[];
  searchParams: DirectorySearchParams;
}) {
  // ---------- derived filter-option tables (live counts) ----------

  const typeOptions = buildTypeOptions(packs);
  const patternOptions = buildPatternOptions(packs);
  const publishers = buildPublisherOptions(packs);

  // Chip row: top-N tags plus pinned dive-into-claude-code.
  const tagChipSet = pickTagChipSet(allTagsByCount);

  // ---------- URL-bound selection (parse + bounds-check) ----------

  const selectedType: PackType | null = typeOptions.some(
    (opt) => opt.type === searchParams.type,
  )
    ? (searchParams.type as PackType)
    : null;
  const selectedPattern: Exclude<CanonicalPattern, "n/a"> | null =
    patternOptions.some((opt) => opt.pattern === searchParams.pattern)
      ? (searchParams.pattern as Exclude<CanonicalPattern, "n/a">)
      : null;
  const selectedTag: string | null =
    searchParams.tag &&
    allTagsByCount.some((entry) => entry.tag === searchParams.tag)
      ? searchParams.tag
      : null;
  const selectedTrust: TrustMode =
    searchParams.trust === "Verified" || searchParams.trust === "Community"
      ? searchParams.trust
      : "all";
  const selectedPublisherEntry = publishers.find(
    (publisher) => publisher.slug === searchParams.publisher,
  );
  const selectedPublisher = selectedPublisherEntry?.name ?? "all";
  const selectedPublisherSlug = selectedPublisherEntry?.slug ?? "all";
  const sortMode: SortMode =
    searchParams.sort === "updated" ||
    searchParams.sort === "name" ||
    searchParams.sort === "featured"
      ? searchParams.sort
      : "featured";
  const queryInput = (searchParams.q ?? "").trim();
  const normalizedQuery = queryInput.toLowerCase();

  // ---------- URL helpers (server-computed hrefs for every chip) ----------

  function baseParams(): URLSearchParams {
    const p = new URLSearchParams();
    if (searchParams.q) p.set("q", searchParams.q);
    if (searchParams.tag) p.set("tag", searchParams.tag);
    if (searchParams.type) p.set("type", searchParams.type);
    if (searchParams.pattern) p.set("pattern", searchParams.pattern);
    if (searchParams.trust) p.set("trust", searchParams.trust);
    if (searchParams.publisher) p.set("publisher", searchParams.publisher);
    if (searchParams.sort) p.set("sort", searchParams.sort);
    return p;
  }

  function hrefFor(updates: Partial<Record<keyof DirectorySearchParams, string | null>>): string {
    const next = baseParams();
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === undefined || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    const qs = next.toString();
    return qs ? `/?${qs}` : "/";
  }

  function hrefForTag(tag: string | null): string {
    // click-to-toggle: clicking the currently-selected chip clears the tag.
    if (tag === null || tag === selectedTag) return hrefFor({ tag: null });
    return hrefFor({ tag });
  }

  function hrefForPublisher(publisherName: string, publisherSlug: string): string {
    if (publisherName === "All" || publisherSlug === "all") {
      return hrefFor({ publisher: null });
    }
    return hrefFor({ publisher: publisherSlug });
  }

  // ---------- filter + sort (runs on server) ----------

  // Registry-order tiebreaker. `getAllPacks()` returns seeded packs in the
  // explicit order declared in `src/lib/packs/index.ts` (fourDesignQuestions
  // is first by design — entry-point, 2-minute orienting read). Featured-mode
  // sort uses this index as its final tiebreaker so the declared order wins
  // over alphabetical, keeping `four-design-questions` in the top slot.
  const orderIndex = new Map<string, number>();
  packs.forEach((pack, index) => orderIndex.set(pack.slug, index));

  const filteredPacks = packs
    .filter((pack) => {
      if (selectedType && pack.packType !== selectedType) return false;
      if (selectedPattern && pack.canonicalPattern !== selectedPattern)
        return false;
      if (selectedTag && !pack.tags.includes(selectedTag)) return false;
      if (selectedTrust !== "all" && pack.trust !== selectedTrust) return false;
      if (selectedPublisher !== "all" && pack.publisher !== selectedPublisher)
        return false;
      if (!normalizedQuery) return true;
      const haystack = [
        pack.name,
        pack.tagline,
        pack.summary,
        pack.packType,
        pack.canonicalPattern,
        pack.publisher,
        ...pack.compatibility,
        ...pack.tags,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => {
      if (sortMode === "name") return left.name.localeCompare(right.name);
      if (sortMode === "updated")
        return right.updatedAt.localeCompare(left.updatedAt);
      // featured mode: featured > Verified > registry-declared order
      const featuredDelta = Number(right.featured) - Number(left.featured);
      if (featuredDelta !== 0) return featuredDelta;
      const trustDelta =
        Number(right.trust === "Verified") - Number(left.trust === "Verified");
      if (trustDelta !== 0) return trustDelta;
      const leftIdx = orderIndex.get(left.slug) ?? Number.MAX_SAFE_INTEGER;
      const rightIdx = orderIndex.get(right.slug) ?? Number.MAX_SAFE_INTEGER;
      if (leftIdx !== rightIdx) return leftIdx - rightIdx;
      return left.name.localeCompare(right.name);
    });

  // Featured rail sort uses registry-declared order as primary key so the
  // entry-point reference pack (`four-design-questions`, index 0 in
  // `src/lib/packs/index.ts`) surfaces in the top slot regardless of trust
  // tier. Trust tier only breaks ties between packs at the same registry
  // position, which in practice never collides — each slug appears once.
  const featuredPacks = [...packs]
    .filter((pack) => pack.featured)
    .sort((left, right) => {
      const leftIdx = orderIndex.get(left.slug) ?? Number.MAX_SAFE_INTEGER;
      const rightIdx = orderIndex.get(right.slug) ?? Number.MAX_SAFE_INTEGER;
      if (leftIdx !== rightIdx) return leftIdx - rightIdx;
      const trustDelta =
        Number(right.trust === "Verified") - Number(left.trust === "Verified");
      if (trustDelta !== 0) return trustDelta;
      return left.name.localeCompare(right.name);
    });

  const verifiedCount = packs.filter((pack) => pack.trust === "Verified").length;
  const communityCount = packs.filter((pack) => pack.trust === "Community").length;
  const activeFilterChips = [
    selectedType ? `Type: ${selectedType}` : null,
    selectedPattern ? `Pattern: ${selectedPattern}` : null,
    selectedTag ? `Tag: ${selectedTag}` : null,
    selectedTrust !== "all" ? selectedTrust : null,
    selectedPublisher !== "all" ? selectedPublisher : null,
    normalizedQuery ? `Search: ${queryInput}` : null,
  ].filter(Boolean) as string[];
  const anyFilterActive = activeFilterChips.length > 0;
  const showFeatured =
    !anyFilterActive && sortMode === "featured" && featuredPacks.length > 0;

  return (
    <div className="space-y-8">
      <section className="directory-header">
        <div className="directory-header-copy">
          <p className="section-label">Natural-language harness directory</p>
          <h1 className="directory-header-title">Agent Workspace</h1>
          <p className="directory-header-body">
            Browse verified harness packs with source links, evaluation guidance,
            and starter instructions for Claude Code, Codex, Cursor, and Convex.
          </p>
        </div>
        <div className="directory-header-actions">
          <Link href="/submit" className="btn-primary inline-flex">
            Submit a pack
          </Link>
          <a
            href="https://github.com/HomenShum/agent-workspace-template"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary"
          >
            View repo
          </a>
        </div>
      </section>

      {/* Live-count chip row — drives the 23/traces/publishers badges. */}
      <div
        className="directory-stat-row"
        data-testid="directory-count-chips"
      >
        <CountChip label="Packs" value={packs.length} testId="count-packs" />
        <CountChip label="Traces" value={traceCount} testId="count-traces" />
        <CountChip
          label="Publishers"
          value={publisherCount}
          testId="count-publishers"
        />
        <StatPill label="Verified" value={`${verifiedCount}`} />
        <StatPill label="Featured" value={`${featuredPacks.length}`} />
      </div>

      {/* Tag chip row — horizontal, <Link> so URL state drives without JS. */}
      <TagChipRow
        chips={tagChipSet}
        selectedTag={selectedTag}
        hrefForTag={hrefForTag}
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="directory-filter-panel">
          <div className="space-y-5">
            <DirectorySearchBox />

            <div>
              <p className="section-label">Sort</p>
              <div className="mt-2 space-y-1" data-testid="sort-chip-list">
                {(
                  [
                    { value: "featured", label: "Featured first" },
                    { value: "updated", label: "Recently updated" },
                    { value: "name", label: "Alphabetical" },
                  ] as const
                ).map((option) => (
                  <Link
                    key={option.value}
                    href={hrefFor({
                      sort: option.value === "featured" ? null : option.value,
                    })}
                    className={`directory-category-row ${
                      sortMode === option.value
                        ? "directory-category-row-active"
                        : ""
                    }`}
                    data-testid={`sort-chip-${option.value}`}
                    aria-pressed={sortMode === option.value}
                  >
                    <span>{option.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="section-label">Trust</p>
              <div className="mt-2 grid gap-2">
                {(
                  [
                    { value: "all", label: "All", count: packs.length },
                    {
                      value: "Verified",
                      label: "Verified",
                      count: verifiedCount,
                    },
                    {
                      value: "Community",
                      label: "Community",
                      count: communityCount,
                    },
                  ] as const
                ).map((trust) => (
                  <Link
                    key={trust.value}
                    href={hrefFor({
                      trust: trust.value === "all" ? null : trust.value,
                    })}
                    className={`directory-filter-row ${
                      selectedTrust === trust.value
                        ? "directory-filter-row-active"
                        : ""
                    }`}
                    data-testid={`trust-chip-${trust.value}`}
                    aria-pressed={selectedTrust === trust.value}
                  >
                    <span>{trust.label}</span>
                    <span className="directory-filter-count">{trust.count}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-3 grid gap-2">
                <div className="directory-legend-row">
                  <span className="pack-trust-badge pack-trust-badge-verified">
                    Verified
                  </span>
                  <span className="text-xs leading-5 text-slate-500">
                    Source-backed packs reviewed against a stronger implementation
                    bar.
                  </span>
                </div>
                <div className="directory-legend-row">
                  <span className="pack-trust-badge">Community</span>
                  <span className="text-xs leading-5 text-slate-500">
                    Useful patterns from the wider ecosystem that still need more
                    field proof.
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="section-label">Type</p>
              <div className="mt-2 space-y-1" data-testid="type-chip-list">
                <Link
                  href={hrefFor({ type: null })}
                  className={`directory-category-row ${
                    !selectedType ? "directory-category-row-active" : ""
                  }`}
                  data-testid="type-chip-all"
                  aria-pressed={!selectedType}
                >
                  <span>All</span>
                  <span className="directory-filter-count">{packs.length}</span>
                </Link>
                {typeOptions.map((opt) => (
                  <Link
                    key={opt.type}
                    href={hrefFor({ type: opt.type })}
                    className={`directory-category-row ${
                      selectedType === opt.type
                        ? "directory-category-row-active"
                        : ""
                    }`}
                    data-testid={`type-chip-${opt.type}`}
                    aria-pressed={selectedType === opt.type}
                  >
                    <span>{opt.type}</span>
                    <span className="directory-filter-count">{opt.count}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="section-label">Pattern</p>
              <div className="mt-2 space-y-1" data-testid="pattern-chip-list">
                <Link
                  href={hrefFor({ pattern: null })}
                  className={`directory-category-row ${
                    !selectedPattern ? "directory-category-row-active" : ""
                  }`}
                  data-testid="pattern-chip-all"
                  aria-pressed={!selectedPattern}
                >
                  <span>All</span>
                  <span className="directory-filter-count">{packs.length}</span>
                </Link>
                {patternOptions.map((opt) => (
                  <Link
                    key={opt.pattern}
                    href={hrefFor({ pattern: opt.pattern })}
                    className={`directory-category-row ${
                      selectedPattern === opt.pattern
                        ? "directory-category-row-active"
                        : ""
                    }`}
                    data-testid={`pattern-chip-${opt.pattern}`}
                    aria-pressed={selectedPattern === opt.pattern}
                  >
                    <span>{opt.pattern}</span>
                    <span className="directory-filter-count">{opt.count}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="section-label">Publishers</p>
              <div className="mt-2 space-y-1">
                {publishers.map((publisher) => (
                  <Link
                    key={publisher.slug}
                    href={hrefForPublisher(publisher.name, publisher.slug)}
                    className={`directory-category-row ${
                      (publisher.slug === "all"
                        ? selectedPublisherSlug === "all"
                        : selectedPublisherSlug === publisher.slug)
                        ? "directory-category-row-active"
                        : ""
                    }`}
                    data-testid={`publisher-chip-${publisher.slug}`}
                    aria-pressed={
                      publisher.slug === "all"
                        ? selectedPublisherSlug === "all"
                        : selectedPublisherSlug === publisher.slug
                    }
                  >
                    <span>{publisher.name}</span>
                    <span className="directory-filter-count">
                      {publisher.count}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="directory-utility-block">
              <p className="section-label">Preview surfaces</p>
              <div className="mt-3 space-y-2">
                <DirectoryLink
                  href="/chat"
                  label="Shared studio"
                  body="Centered thread plus persistent rail."
                />
                <DirectoryLink
                  href="/workspace-a"
                  label="Builder preview"
                  body="Scoped workspace for drafting a domain surface."
                />
                <DirectoryLink
                  href="/workspace-b"
                  label="Reviewer preview"
                  body="Secondary workspace for oversight and review."
                />
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-8">
          {showFeatured ? (
            <section>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="section-label">Featured</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    Start here
                  </h2>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {featuredPacks.map((pack) => (
                  <PackCard key={pack.slug} pack={pack} featured />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="section-label">Directory</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  {filteredPacks.length} packs
                </h2>
              </div>
            </div>
            <div className="directory-results-bar">
              <div className="directory-results-summary">
                <span className="directory-results-count">
                  {filteredPacks.length} shown
                </span>
                <span className="text-sm text-slate-500">
                  Verified packs include starter instructions, sources, and
                  evaluation guidance.
                </span>
              </div>
              <div className="directory-results-meta">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="directory-sort-label">
                    Sort: {sortLabel(sortMode)}
                  </span>
                  {anyFilterActive || sortMode !== "featured" ? (
                    <DirectoryClearFilters />
                  ) : null}
                </div>
                {anyFilterActive ? (
                  <div className="flex flex-wrap gap-2">
                    {activeFilterChips.map((filter) => (
                      <span
                        key={filter}
                        className="directory-results-chip"
                      >
                        {filter}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="directory-results-chip">
                    No active filters
                  </span>
                )}
              </div>
            </div>
            {filteredPacks.length === 0 ? (
              <DirectoryEmptyState hasActiveFilters={anyFilterActive} />
            ) : (
              <div
                className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                data-testid="directory-grid"
              >
                {filteredPacks.map((pack) => (
                  <PackCard key={pack.slug} pack={pack} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------- filter-option builders (pure) ----------------

function buildTypeOptions(packs: Pack[]) {
  const map = new Map<PackType, number>();
  for (const pack of packs) {
    map.set(pack.packType, (map.get(pack.packType) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) =>
      b.count !== a.count ? b.count - a.count : a.type.localeCompare(b.type),
    );
}

function buildPatternOptions(packs: Pack[]) {
  const map = new Map<Exclude<CanonicalPattern, "n/a">, number>();
  for (const pack of packs) {
    if (pack.canonicalPattern === "n/a") continue;
    map.set(
      pack.canonicalPattern,
      (map.get(pack.canonicalPattern) ?? 0) + 1,
    );
  }
  return [...map.entries()]
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) =>
      b.count !== a.count
        ? b.count - a.count
        : a.pattern.localeCompare(b.pattern),
    );
}

function buildPublisherOptions(packs: Pack[]) {
  return [
    { name: "All", slug: "all", count: packs.length },
    ...Array.from(new Set(packs.map((pack) => pack.publisher)))
      .sort((left, right) => left.localeCompare(right))
      .map((publisher) => ({
        name: publisher,
        slug: getPublisherProfile(publisher)?.slug ?? publisher,
        count: packs.filter((pack) => pack.publisher === publisher).length,
      })),
  ];
}

// ---------------- presentational helpers ----------------

/**
 * Live count chip, rendered above the filter bar. Matches the ASCII mock
 * in docs/PRODUCT.md §1: `[ Packs · 23 ] [ Traces · N ] [ Publishers · 3 ]`.
 */
function CountChip({
  label,
  value,
  testId,
}: {
  label: string;
  value: number;
  testId: string;
}) {
  return (
    <span className="directory-stat-pill" data-testid={testId}>
      <span className="section-label">{label}</span>
      <span className="directory-filter-count" data-testid={`${testId}-value`}>
        {label} · {value}
      </span>
    </span>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="directory-stat-pill">
      <span className="section-label">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

/**
 * Horizontal tag chip row. Each chip is a Next/Link so the URL drives the
 * filter even with JS disabled. Active chip links to a URL that clears the
 * tag (click-to-toggle). The pinned `dive-into-claude-code` chip is always
 * present if any pack carries it.
 */
function TagChipRow({
  chips,
  selectedTag,
  hrefForTag,
}: {
  chips: TagCount[];
  selectedTag: string | null;
  hrefForTag: (tag: string | null) => string;
}) {
  if (chips.length === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="directory-tag-chip-row"
    >
      <span className="section-label mr-1">Tag</span>
      <Link
        href={hrefForTag(null)}
        className={`directory-pill directory-pill-small ${
          selectedTag === null
            ? "border-slate-950 bg-slate-950 text-white"
            : ""
        }`}
        data-testid="tag-chip-all"
        aria-pressed={selectedTag === null}
      >
        All
      </Link>
      {chips.map((chip) => {
        const active = chip.tag === selectedTag;
        const pinned = chip.tag === PINNED_TAG;
        return (
          <Link
            key={chip.tag}
            href={hrefForTag(chip.tag)}
            className={`directory-pill directory-pill-small ${
              active
                ? "border-slate-950 bg-slate-950 text-white"
                : pinned
                  ? "border-amber-700/30 bg-amber-50 text-amber-900"
                  : ""
            }`}
            data-testid={`tag-chip-${chip.tag}`}
            aria-pressed={active}
          >
            {chip.tag} · {chip.count}
          </Link>
        );
      })}
    </div>
  );
}

function DirectoryEmptyState({
  hasActiveFilters,
}: {
  hasActiveFilters: boolean;
}) {
  return (
    <div
      className="rounded-[18px] border border-dashed border-[rgba(72,57,39,0.2)] bg-white px-6 py-10 text-center"
      data-testid="directory-empty-state"
    >
      <p className="section-label">No packs match</p>
      <h3 className="mt-2 text-lg font-semibold text-slate-950">
        Nothing here yet
      </h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        {hasActiveFilters
          ? "Try loosening or clearing a filter — every pack in the catalog is discoverable from the chip row above."
          : "The catalog is empty. Seed a pack under src/lib/packs/ and it will show up here automatically."}
      </p>
      {hasActiveFilters ? (
        <div className="mt-4 inline-flex">
          <DirectoryClearFilters
            label="Clear filters"
            testId="directory-empty-reset"
          />
        </div>
      ) : null}
    </div>
  );
}

function DirectoryLink({
  label,
  body,
  href,
}: {
  label: string;
  body: string;
  href: string;
}) {
  return (
    <Link href={href} className="directory-link-row">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <span className="mt-1 block text-sm leading-6 text-slate-600">{body}</span>
    </Link>
  );
}

function sortLabel(sortMode: SortMode) {
  if (sortMode === "featured") return "Featured first";
  if (sortMode === "updated") return "Recently updated";
  return "Alphabetical";
}

// ---------------- legacy surface (publisher profile page) ----------------

/**
 * `PackTile` — legacy `HarnessPack`-shape card kept here for backward
 * compatibility with `/publishers/[slug]/page.tsx`, which still consumes
 * the legacy shape via `getPacksByPublisher`. New surfaces should use
 * `<PackCard />` (canonical `Pack` shape) instead.
 *
 * Pure JSX, no hooks — renders fine as a server component sub-tree.
 */
export function PackTile({
  pack,
  featured = false,
}: {
  pack: HarnessPack;
  featured?: boolean;
}) {
  const profile = getPublisherProfile(pack.publisher);
  return (
    <Link
      href={`/packs/${pack.slug}`}
      className={`pack-card ${featured ? "pack-card-featured" : ""}`}
    >
      <div className="pack-card-hero" style={{ background: pack.gradient }}>
        <PackArtwork variant={pack.slug} compact />
      </div>
      <div className="pack-card-body">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`pack-trust-badge ${
              pack.trust === "Verified" ? "pack-trust-badge-verified" : ""
            }`}
          >
            {pack.trust}
          </span>
          <span className="pack-category-label">{pack.category}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`pack-status-badge ${
              pack.status === "Production-ready"
                ? "pack-status-badge-production"
                : pack.status === "Recommended"
                  ? "pack-status-badge-recommended"
                  : "pack-status-badge-experimental"
            }`}
          >
            {pack.status}
          </span>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-950">{pack.name}</h3>
          <p className="text-sm leading-6 text-slate-600">{pack.tagline}</p>
          <p className="pack-card-summary">{pack.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(featured ? pack.compatibility : pack.tags).slice(0, 3).map((item) => (
            <span key={item} className="directory-pill directory-pill-small">
              {item}
            </span>
          ))}
        </div>
        <div className="pack-card-footer">
          <span className="pack-publisher-badge">
            <span className="pack-publisher-avatar" aria-hidden="true">
              {profile?.initials ?? pack.publisher.slice(0, 2).toUpperCase()}
            </span>
            <span className="truncate">{pack.publisher}</span>
          </span>
          <span className="text-xs text-slate-500">{pack.updatedAt}</span>
        </div>
      </div>
    </Link>
  );
}
