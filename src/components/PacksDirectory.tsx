"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getPublisherProfile, type HarnessPack } from "@/lib/harness-packs";
import { PackArtwork } from "@/components/PackArtwork";
import { PackCard } from "@/components/PackCard";
import type { Pack, PackType, CanonicalPattern } from "@/lib/pack-schema";
import type { TagCount } from "@/lib/directory-tags";
import { PINNED_TAG, pickTagChipSet } from "@/lib/directory-tags";

type SortMode = "featured" | "updated" | "name";
type TrustMode = "all" | "Verified" | "Community";
type PublisherMode = "all" | string;

/**
 * PacksDirectory — fully data-bound against the canonical `Pack[]`.
 *
 * Single source of truth: every filter, sort, and render path consumes the
 * canonical `Pack` shape from `pack-registry.getAllPacks()` (joined with
 * install counts, trace count, publisher count, and a pre-computed tag
 * frequency table by the server-only helper `buildDirectoryData`).
 *
 * URL state drives all filters:
 *   - `?q=`         free-text search over name/tagline/summary/tags/compat/publisher
 *   - `?trust=`     Verified | Community
 *   - `?type=`      harness | ui | reference | data | rag | eval | design | security
 *   - `?pattern=`   canonical pattern (skip "n/a" from chip set)
 *   - `?tag=`       any pack tag. Chip-row chips are server-rendered <Link>s
 *                   so the filter works even without JS (the surrounding
 *                   controls that depend on useTransition re-hydrate on mount).
 *   - `?publisher=` publisher slug
 *   - `?sort=`      featured | updated | name
 *
 * Reset clears every one of the above.
 */
export function PacksDirectory({
  packs,
  traceCount,
  publisherCount,
  allTagsByCount,
}: {
  packs: Pack[];
  traceCount: number;
  publisherCount: number;
  allTagsByCount: TagCount[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [queryInput, setQueryInput] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setQueryInput(searchParams.get("q") ?? "");
  }, [searchParams]);

  // ---------- derived filter-option tables (live counts) ----------

  const typeOptions = useMemo(() => {
    const map = new Map<PackType, number>();
    for (const pack of packs) {
      map.set(pack.packType, (map.get(pack.packType) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) =>
        b.count !== a.count ? b.count - a.count : a.type.localeCompare(b.type),
      );
  }, [packs]);

  const patternOptions = useMemo(() => {
    const map = new Map<Exclude<CanonicalPattern, "n/a">, number>();
    for (const pack of packs) {
      if (pack.canonicalPattern === "n/a") continue;
      const key = pack.canonicalPattern;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) =>
        b.count !== a.count
          ? b.count - a.count
          : a.pattern.localeCompare(b.pattern),
      );
  }, [packs]);

  const publishers = useMemo(
    () => [
      { name: "All", slug: "all", count: packs.length },
      ...Array.from(new Set(packs.map((pack) => pack.publisher)))
        .sort((left, right) => left.localeCompare(right))
        .map((publisher) => ({
          name: publisher,
          slug: getPublisherProfile(publisher)?.slug ?? publisher,
          count: packs.filter((pack) => pack.publisher === publisher).length,
        })),
    ],
    [packs],
  );

  // Chip row: top-N tags plus pinned dive-into-claude-code.
  const tagChipSet = useMemo(
    () => pickTagChipSet(allTagsByCount),
    [allTagsByCount],
  );

  // ---------- URL-bound selection ----------

  const sortParam = searchParams.get("sort");
  const trustParam = searchParams.get("trust");
  const typeParam = searchParams.get("type");
  const patternParam = searchParams.get("pattern");
  const tagParam = searchParams.get("tag");
  const publisherParam = searchParams.get("publisher");

  const selectedType =
    typeOptions.some((opt) => opt.type === typeParam)
      ? (typeParam as PackType)
      : null;
  const selectedPattern =
    patternOptions.some((opt) => opt.pattern === patternParam)
      ? (patternParam as Exclude<CanonicalPattern, "n/a">)
      : null;
  const selectedTag =
    tagParam && allTagsByCount.some((entry) => entry.tag === tagParam)
      ? tagParam
      : null;
  const selectedTrust: TrustMode =
    trustParam === "Verified" || trustParam === "Community" ? trustParam : "all";
  const selectedPublisherEntry = publishers.find(
    (publisher) => publisher.slug === publisherParam,
  );
  const selectedPublisher = selectedPublisherEntry?.name ?? "all";
  const selectedPublisherSlug = selectedPublisherEntry?.slug ?? "all";
  const sortMode: SortMode =
    sortParam === "updated" || sortParam === "name" || sortParam === "featured"
      ? sortParam
      : "featured";
  const normalizedQuery = queryInput.trim().toLowerCase();

  // ---------- URL helpers ----------

  function buildHrefForTag(tag: string | null): string {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (tag === null || tag === selectedTag) {
      nextParams.delete("tag");
    } else {
      nextParams.set("tag", tag);
    }
    const qs = nextParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function updateDirectoryState(updates: {
    q?: string;
    type?: string | null;
    pattern?: string | null;
    tag?: string | null;
    trust?: TrustMode;
    publisher?: PublisherMode;
    sort?: SortMode;
  }) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (updates.q !== undefined) {
      const nextQuery = updates.q.trim();
      if (nextQuery) nextParams.set("q", nextQuery);
      else nextParams.delete("q");
    }

    if (updates.type !== undefined) {
      if (updates.type) nextParams.set("type", updates.type);
      else nextParams.delete("type");
    }

    if (updates.pattern !== undefined) {
      if (updates.pattern) nextParams.set("pattern", updates.pattern);
      else nextParams.delete("pattern");
    }

    if (updates.tag !== undefined) {
      if (updates.tag) nextParams.set("tag", updates.tag);
      else nextParams.delete("tag");
    }

    if (updates.trust !== undefined) {
      if (updates.trust !== "all") nextParams.set("trust", updates.trust);
      else nextParams.delete("trust");
    }

    if (updates.publisher !== undefined) {
      const nextPublisher =
        updates.publisher === "all"
          ? "all"
          : (publishers.find((publisher) => publisher.name === updates.publisher)
              ?.slug ?? "all");
      if (nextPublisher !== "all") nextParams.set("publisher", nextPublisher);
      else nextParams.delete("publisher");
    }

    if (updates.sort !== undefined) {
      if (updates.sort !== "featured") nextParams.set("sort", updates.sort);
      else nextParams.delete("sort");
    }

    const nextUrl = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname;
    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  }

  function resetFilters() {
    setQueryInput("");
    updateDirectoryState({
      q: "",
      type: null,
      pattern: null,
      tag: null,
      trust: "all",
      publisher: "all",
      sort: "featured",
    });
  }

  // ---------- filter + sort ----------

  // Registry-order tiebreaker. `getAllPacks()` returns seeded packs in the
  // explicit order declared in `src/lib/packs/index.ts` (fourDesignQuestions
  // is first by design — entry-point, 2-minute orienting read). Featured-mode
  // sort uses this index as its final tiebreaker so the declared order wins
  // over alphabetical, keeping `four-design-questions` in the top slot.
  const orderIndex = useMemo(() => {
    const map = new Map<string, number>();
    packs.forEach((pack, index) => map.set(pack.slug, index));
    return map;
  }, [packs]);

  const filteredPacks = useMemo(
    () =>
      packs
        .filter((pack) => {
          if (selectedType && pack.packType !== selectedType) return false;
          if (selectedPattern && pack.canonicalPattern !== selectedPattern)
            return false;
          if (selectedTag && !pack.tags.includes(selectedTag)) return false;
          if (selectedTrust !== "all" && pack.trust !== selectedTrust)
            return false;
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
          const rightIdx =
            orderIndex.get(right.slug) ?? Number.MAX_SAFE_INTEGER;
          if (leftIdx !== rightIdx) return leftIdx - rightIdx;
          return left.name.localeCompare(right.name);
        }),
    [
      packs,
      orderIndex,
      selectedType,
      selectedPattern,
      selectedTag,
      selectedTrust,
      selectedPublisher,
      normalizedQuery,
      sortMode,
    ],
  );

  // Featured rail sort uses registry-declared order as primary key so the
  // entry-point reference pack (`four-design-questions`, index 0 in
  // `src/lib/packs/index.ts`) surfaces in the top slot regardless of trust
  // tier. Trust tier only breaks ties between packs at the same registry
  // position, which in practice never collides — each slug appears once.
  // This mirrors the spec: "four-design-questions must land in the top slot"
  // of the Featured section.
  const featuredPacks = useMemo(
    () =>
      [...packs]
        .filter((pack) => pack.featured)
        .sort((left, right) => {
          const leftIdx = orderIndex.get(left.slug) ?? Number.MAX_SAFE_INTEGER;
          const rightIdx =
            orderIndex.get(right.slug) ?? Number.MAX_SAFE_INTEGER;
          if (leftIdx !== rightIdx) return leftIdx - rightIdx;
          const trustDelta =
            Number(right.trust === "Verified") - Number(left.trust === "Verified");
          if (trustDelta !== 0) return trustDelta;
          return left.name.localeCompare(right.name);
        }),
    [packs, orderIndex],
  );

  const verifiedCount = packs.filter((pack) => pack.trust === "Verified").length;
  const communityCount = packs.filter((pack) => pack.trust === "Community").length;
  const activeFilterChips = [
    selectedType ? `Type: ${selectedType}` : null,
    selectedPattern ? `Pattern: ${selectedPattern}` : null,
    selectedTag ? `Tag: ${selectedTag}` : null,
    selectedTrust !== "all" ? selectedTrust : null,
    selectedPublisher !== "all" ? selectedPublisher : null,
    normalizedQuery ? `Search: ${queryInput.trim()}` : null,
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
        buildHref={buildHrefForTag}
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="directory-filter-panel">
          <div className="space-y-5">
            <div>
              <label htmlFor="pack-search" className="section-label">
                Search
              </label>
              <input
                id="pack-search"
                value={queryInput}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setQueryInput(nextQuery);
                  updateDirectoryState({ q: nextQuery });
                }}
                placeholder="Search harness packs..."
                className="field-input mt-2"
              />
            </div>

            <div>
              <label htmlFor="sort-mode" className="section-label">
                Sort
              </label>
              <select
                id="sort-mode"
                value={sortMode}
                onChange={(event) =>
                  updateDirectoryState({ sort: event.target.value as SortMode })
                }
                className="field-input mt-2"
              >
                <option value="featured">Featured first</option>
                <option value="updated">Recently updated</option>
                <option value="name">Alphabetical</option>
              </select>
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
                  <button
                    key={trust.value}
                    type="button"
                    onClick={() =>
                      updateDirectoryState({ trust: trust.value as TrustMode })
                    }
                    className={`directory-filter-row ${
                      selectedTrust === trust.value
                        ? "directory-filter-row-active"
                        : ""
                    }`}
                    data-testid={`trust-chip-${trust.value}`}
                  >
                    <span>{trust.label}</span>
                    <span className="directory-filter-count">{trust.count}</span>
                  </button>
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
                <button
                  type="button"
                  onClick={() => updateDirectoryState({ type: null })}
                  className={`directory-category-row ${
                    !selectedType ? "directory-category-row-active" : ""
                  }`}
                >
                  <span>All</span>
                  <span className="directory-filter-count">{packs.length}</span>
                </button>
                {typeOptions.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => updateDirectoryState({ type: opt.type })}
                    className={`directory-category-row ${
                      selectedType === opt.type
                        ? "directory-category-row-active"
                        : ""
                    }`}
                    data-testid={`type-chip-${opt.type}`}
                  >
                    <span>{opt.type}</span>
                    <span className="directory-filter-count">{opt.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="section-label">Pattern</p>
              <div className="mt-2 space-y-1" data-testid="pattern-chip-list">
                <button
                  type="button"
                  onClick={() => updateDirectoryState({ pattern: null })}
                  className={`directory-category-row ${
                    !selectedPattern ? "directory-category-row-active" : ""
                  }`}
                >
                  <span>All</span>
                  <span className="directory-filter-count">{packs.length}</span>
                </button>
                {patternOptions.map((opt) => (
                  <button
                    key={opt.pattern}
                    type="button"
                    onClick={() =>
                      updateDirectoryState({ pattern: opt.pattern })
                    }
                    className={`directory-category-row ${
                      selectedPattern === opt.pattern
                        ? "directory-category-row-active"
                        : ""
                    }`}
                    data-testid={`pattern-chip-${opt.pattern}`}
                  >
                    <span>{opt.pattern}</span>
                    <span className="directory-filter-count">{opt.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="section-label">Publishers</p>
              <div className="mt-2 space-y-1">
                {publishers.map((publisher) => (
                  <button
                    key={publisher.slug}
                    type="button"
                    onClick={() =>
                      updateDirectoryState({
                        publisher:
                          publisher.name === "All" ? "all" : publisher.name,
                      })
                    }
                    className={`directory-category-row ${
                      (publisher.slug === "all"
                        ? selectedPublisherSlug === "all"
                        : selectedPublisherSlug === publisher.slug)
                        ? "directory-category-row-active"
                        : ""
                    }`}
                  >
                    <span>{publisher.name}</span>
                    <span className="directory-filter-count">
                      {publisher.count}
                    </span>
                  </button>
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
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="directory-reset-button"
                      data-testid="directory-reset"
                    >
                      Reset view
                    </button>
                  ) : null}
                  {isPending ? (
                    <span className="directory-results-chip">Updating...</span>
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
              <DirectoryEmptyState
                onReset={resetFilters}
                hasActiveFilters={anyFilterActive}
              />
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
  buildHref,
}: {
  chips: TagCount[];
  selectedTag: string | null;
  buildHref: (tag: string | null) => string;
}) {
  if (chips.length === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="directory-tag-chip-row"
    >
      <span className="section-label mr-1">Tag</span>
      <Link
        href={buildHref(null)}
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
            href={buildHref(chip.tag)}
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
  onReset,
  hasActiveFilters,
}: {
  onReset: () => void;
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
        <button
          type="button"
          onClick={onReset}
          className="directory-reset-button mt-4"
        >
          Clear filters
        </button>
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
 * This file stays `"use client"`; the tile itself is pure JSX with no
 * state or hooks, so it renders fine as a client-component sub-tree.
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
