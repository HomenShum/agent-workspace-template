"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getPublisherProfile, HarnessPack } from "@/lib/harness-packs";
import { PackArtwork } from "@/components/PackArtwork";

type SortMode = "featured" | "updated" | "name";
type TrustMode = "all" | "Verified" | "Community";
type PublisherMode = "all" | string;

export function PacksDirectory({ packs }: { packs: HarnessPack[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [queryInput, setQueryInput] = useState(searchParams.get("q") ?? "");

  const categories = [
    { name: "All", count: packs.length },
    ...Array.from(new Set(packs.map((pack) => pack.category)))
      .sort((left, right) => left.localeCompare(right))
      .map((category) => ({
        name: category,
        count: packs.filter((pack) => pack.category === category).length,
      })),
  ];
  const publishers = [
    { name: "All", slug: "all", count: packs.length },
    ...Array.from(new Set(packs.map((pack) => pack.publisher)))
      .sort((left, right) => left.localeCompare(right))
      .map((publisher) => ({
        name: publisher,
        slug: getPublisherProfile(publisher)?.slug ?? publisher,
        count: packs.filter((pack) => pack.publisher === publisher).length,
      })),
  ];
  const sortParam = searchParams.get("sort");
  const trustParam = searchParams.get("trust");
  const categoryParam = searchParams.get("category");
  const publisherParam = searchParams.get("publisher");

  const selectedCategory = categories.some((category) => category.name === categoryParam)
    ? categoryParam ?? "All"
    : "All";
  const selectedTrust =
    trustParam === "Verified" || trustParam === "Community" ? trustParam : "all";
  const selectedPublisher = publishers.some((publisher) => publisher.slug === publisherParam)
    ? (publishers.find((publisher) => publisher.slug === publisherParam)?.name ?? "all")
    : "all";
  const selectedPublisherSlug =
    selectedPublisher === "all"
      ? "all"
      : (publishers.find((publisher) => publisher.name === selectedPublisher)?.slug ?? "all");
  const sortMode: SortMode =
    sortParam === "updated" || sortParam === "name" || sortParam === "featured"
      ? sortParam
      : "featured";
  const normalizedQuery = queryInput.trim().toLowerCase();

  useEffect(() => {
    setQueryInput(searchParams.get("q") ?? "");
  }, [searchParams]);

  function updateDirectoryState(updates: {
    q?: string;
    category?: string;
    trust?: TrustMode;
    publisher?: PublisherMode;
    sort?: SortMode;
  }) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (updates.q !== undefined) {
      const nextQuery = updates.q.trim();
      if (nextQuery) {
        nextParams.set("q", nextQuery);
      } else {
        nextParams.delete("q");
      }
    }

    if (updates.category !== undefined) {
      if (updates.category !== "All") {
        nextParams.set("category", updates.category);
      } else {
        nextParams.delete("category");
      }
    }

    if (updates.trust !== undefined) {
      if (updates.trust !== "all") {
        nextParams.set("trust", updates.trust);
      } else {
        nextParams.delete("trust");
      }
    }

    if (updates.publisher !== undefined) {
      const nextPublisher =
        updates.publisher === "all"
          ? "all"
          : (publishers.find((publisher) => publisher.name === updates.publisher)?.slug ?? "all");
      if (nextPublisher !== "all") {
        nextParams.set("publisher", nextPublisher);
      } else {
        nextParams.delete("publisher");
      }
    }

    if (updates.sort !== undefined) {
      if (updates.sort !== "featured") {
        nextParams.set("sort", updates.sort);
      } else {
        nextParams.delete("sort");
      }
    }

    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  }

  function resetFilters() {
    setQueryInput("");
    updateDirectoryState({
      q: "",
      category: "All",
      trust: "all",
      publisher: "all",
      sort: "featured",
    });
  }

  const filteredPacks = packs
    .filter((pack) => {
      if (selectedCategory !== "All" && pack.category !== selectedCategory) {
        return false;
      }
      if (selectedTrust !== "all" && pack.trust !== selectedTrust) {
        return false;
      }
      if (selectedPublisher !== "all" && pack.publisher !== selectedPublisher) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        pack.name,
        pack.tagline,
        pack.summary,
        pack.category,
        ...pack.compatibility,
        ...pack.tags,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => {
      if (sortMode === "name") {
        return left.name.localeCompare(right.name);
      }
      if (sortMode === "updated") {
        return right.updatedAt.localeCompare(left.updatedAt);
      }

      const featuredDelta = Number(right.featured) - Number(left.featured);
      if (featuredDelta !== 0) {
        return featuredDelta;
      }
      const trustDelta = Number(right.trust === "Verified") - Number(left.trust === "Verified");
      if (trustDelta !== 0) {
        return trustDelta;
      }
      return left.name.localeCompare(right.name);
    });

  const featuredPacks = packs.filter((pack) => pack.featured);
  const verifiedCount = packs.filter((pack) => pack.trust === "Verified").length;
  const communityCount = packs.filter((pack) => pack.trust === "Community").length;
  const activeFilters = [
    selectedCategory !== "All" ? selectedCategory : null,
    selectedTrust !== "all" ? selectedTrust : null,
    selectedPublisher !== "all" ? selectedPublisher : null,
    normalizedQuery ? `Search: ${queryInput.trim()}` : null,
  ].filter(Boolean) as string[];
  const showFeatured = activeFilters.length === 0 && sortMode === "featured";

  return (
    <div className="space-y-8">
      <section className="directory-header">
        <div className="directory-header-copy">
          <p className="section-label">Natural-language harness directory</p>
          <h1 className="directory-header-title">Agent Workspace</h1>
          <p className="directory-header-body">
            Browse verified harness packs with source links, evaluation guidance, and starter
            instructions for Claude Code, Codex, Cursor, and Convex.
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

      <div className="directory-stat-row">
        <StatPill label="All packs" value={`${packs.length}`} />
        <StatPill label="Verified" value={`${verifiedCount}`} />
        <StatPill label="Featured" value={`${featuredPacks.length}`} />
        <StatPill label="Hosted at" value="agentworkspace.attrition.sh" />
      </div>

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
                onChange={(event) => updateDirectoryState({ sort: event.target.value as SortMode })}
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
                    { value: "Verified", label: "Verified", count: verifiedCount },
                    { value: "Community", label: "Community", count: communityCount },
                  ] as const
                ).map((trust) => (
                  <button
                    key={trust.value}
                    type="button"
                    onClick={() => updateDirectoryState({ trust: trust.value })}
                    className={`directory-filter-row ${
                      selectedTrust === trust.value ? "directory-filter-row-active" : ""
                    }`}
                  >
                    <span>{trust.label}</span>
                    <span className="directory-filter-count">{trust.count}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-2">
                <div className="directory-legend-row">
                  <span className="pack-trust-badge pack-trust-badge-verified">Verified</span>
                  <span className="text-xs leading-5 text-slate-500">
                    Source-backed packs reviewed against a stronger implementation bar.
                  </span>
                </div>
                <div className="directory-legend-row">
                  <span className="pack-trust-badge">Community</span>
                  <span className="text-xs leading-5 text-slate-500">
                    Useful patterns from the wider ecosystem that still need more field proof.
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="section-label">Categories</p>
              <div className="mt-2 space-y-1">
                {categories.map((category) => (
                  <button
                    key={category.name}
                    type="button"
                    onClick={() => updateDirectoryState({ category: category.name })}
                    className={`directory-category-row ${
                      selectedCategory === category.name ? "directory-category-row-active" : ""
                    }`}
                  >
                    <span>{category.name}</span>
                    <span className="directory-filter-count">{category.count}</span>
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
                    onClick={() => updateDirectoryState({ publisher: publisher.name === "All" ? "all" : publisher.name })}
                    className={`directory-category-row ${
                      (publisher.slug === "all"
                        ? selectedPublisherSlug === "all"
                        : selectedPublisherSlug === publisher.slug)
                        ? "directory-category-row-active"
                        : ""
                    }`}
                  >
                    <span>{publisher.name}</span>
                    <span className="directory-filter-count">{publisher.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="directory-utility-block">
              <p className="section-label">Preview surfaces</p>
              <div className="mt-3 space-y-2">
                <DirectoryLink href="/chat" label="Shared studio" body="Centered thread plus persistent rail." />
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
                  <PackTile key={pack.slug} pack={pack} featured />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="section-label">Directory</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  {filteredPacks.length} harness packs
                </h2>
              </div>
            </div>
            <div className="directory-results-bar">
              <div className="directory-results-summary">
                <span className="directory-results-count">{filteredPacks.length} shown</span>
                <span className="text-sm text-slate-500">
                  Verified packs include starter instructions, sources, and evaluation guidance.
                </span>
              </div>
              <div className="directory-results-meta">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="directory-sort-label">Sort: {sortLabel(sortMode)}</span>
                  {activeFilters.length || sortMode !== "featured" ? (
                    <button type="button" onClick={resetFilters} className="directory-reset-button">
                      Reset view
                    </button>
                  ) : null}
                  {isPending ? <span className="directory-results-chip">Updating...</span> : null}
                </div>
                {activeFilters.length ? (
                  <div className="flex flex-wrap gap-2">
                    {activeFilters.map((filter) => (
                      <span key={filter} className="directory-results-chip">
                        {filter}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="directory-results-chip">No active filters</span>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPacks.map((pack) => (
                <PackTile key={pack.slug} pack={pack} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
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

export function PackTile({ pack, featured = false }: { pack: HarnessPack; featured?: boolean }) {
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
          <span className={`pack-trust-badge ${pack.trust === "Verified" ? "pack-trust-badge-verified" : ""}`}>
            {pack.trust}
          </span>
          <span className="pack-category-label">{pack.category}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={pack.status} />
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
          <PublisherBadge pack={pack} />
          <span className="text-xs text-slate-500">{pack.updatedAt}</span>
        </div>
      </div>
    </Link>
  );
}

function PublisherBadge({ pack }: { pack: HarnessPack }) {
  const profile = getPublisherProfile(pack.publisher);

  return (
    <span className="pack-publisher-badge">
      <span className="pack-publisher-avatar" aria-hidden="true">
        {profile?.initials ?? pack.publisher.slice(0, 2).toUpperCase()}
      </span>
      <span className="truncate">{pack.publisher}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: HarnessPack["status"] }) {
  return <span className={`pack-status-badge ${statusClassName(status)}`}>{status}</span>;
}

function statusClassName(status: HarnessPack["status"]) {
  if (status === "Production-ready") {
    return "pack-status-badge-production";
  }
  if (status === "Recommended") {
    return "pack-status-badge-recommended";
  }
  return "pack-status-badge-experimental";
}

function sortLabel(sortMode: SortMode) {
  if (sortMode === "featured") {
    return "Featured first";
  }
  if (sortMode === "updated") {
    return "Recently updated";
  }
  return "Alphabetical";
}
