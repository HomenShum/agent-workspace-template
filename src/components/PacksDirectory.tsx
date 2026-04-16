"use client";

import Link from "next/link";
import { useState } from "react";
import { getPublisherProfile, HarnessPack } from "@/lib/harness-packs";
import { PackArtwork } from "@/components/PackArtwork";

type SortMode = "featured" | "updated" | "name";
type TrustMode = "all" | "Verified" | "Community";

export function PacksDirectory({ packs }: { packs: HarnessPack[] }) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedTrust, setSelectedTrust] = useState<TrustMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("featured");

  const normalizedQuery = query.trim().toLowerCase();
  const categories = [
    { name: "All", count: packs.length },
    ...Array.from(new Set(packs.map((pack) => pack.category)))
      .sort((left, right) => left.localeCompare(right))
      .map((category) => ({
        name: category,
        count: packs.filter((pack) => pack.category === category).length,
      })),
  ];

  const filteredPacks = packs
    .filter((pack) => {
      if (selectedCategory !== "All" && pack.category !== selectedCategory) {
        return false;
      }
      if (selectedTrust !== "all" && pack.trust !== selectedTrust) {
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
                value={query}
                onChange={(event) => setQuery(event.target.value)}
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
                onChange={(event) => setSortMode(event.target.value as SortMode)}
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
                    onClick={() => setSelectedTrust(trust.value)}
                    className={`directory-filter-row ${
                      selectedTrust === trust.value ? "directory-filter-row-active" : ""
                    }`}
                  >
                    <span>{trust.label}</span>
                    <span className="directory-filter-count">{trust.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="section-label">Categories</p>
              <div className="mt-2 space-y-1">
                {categories.map((category) => (
                  <button
                    key={category.name}
                    type="button"
                    onClick={() => setSelectedCategory(category.name)}
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

          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="section-label">Directory</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  {filteredPacks.length} harness packs
                </h2>
              </div>
              <p className="text-sm text-slate-500">
                Verified packs include starter instructions, sources, and evaluation guidance.
              </p>
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

function PackTile({ pack, featured = false }: { pack: HarnessPack; featured?: boolean }) {
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
