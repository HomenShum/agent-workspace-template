"use client";

import Link from "next/link";
import { useState } from "react";
import { HarnessPack } from "@/lib/harness-packs";
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

  return (
    <div className="space-y-8">
      <section className="directory-hero">
        <div className="directory-hero-copy">
          <p className="section-label">Natural-language harness directory</p>
          <h1 className="directory-hero-title">Agent Workspace</h1>
          <p className="directory-hero-body">
            Verified harness packs for Claude Code, Codex, Cursor, and Convex. Each pack bundles
            instructions, sources, evaluation guidance, and a starter path that is easier to adopt
            than a giant prompt dump.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/chat" className="btn-primary inline-flex">
              Open shared studio
            </Link>
            <Link href="/submit" className="btn-secondary">
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
        </div>
        <div className="directory-hero-meta">
          <div className="directory-hero-meta-row">
            <span className="section-label">Hosted at</span>
            <a
              href="https://agentworkspace.attrition.sh"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-slate-900 underline underline-offset-4"
            >
              agentworkspace.attrition.sh
            </a>
          </div>
          <div className="directory-stat-grid">
            <Metric label="Verified packs" value={`${packs.filter((pack) => pack.trust === "Verified").length}`} />
            <Metric label="Featured" value={`${featuredPacks.length}`} />
            <Metric label="Runtimes" value="Claude / Codex / Convex" />
          </div>
        </div>
      </section>

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
              <div className="mt-2 flex flex-wrap gap-2">
                {(["all", "Verified", "Community"] as const).map((trust) => (
                  <button
                    key={trust}
                    type="button"
                    onClick={() => setSelectedTrust(trust)}
                    className={`directory-chip ${
                      selectedTrust === trust ? "directory-chip-active" : ""
                    }`}
                  >
                    {trust === "all" ? "All" : trust}
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
                    <span className="text-xs text-slate-400">{category.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="section-label">Featured</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Start here</h2>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {featuredPacks.map((pack) => (
                <Link key={pack.slug} href={`/packs/${pack.slug}`} className="pack-card pack-card-featured">
                  <div className="pack-card-header">
                    <div className="pack-card-art" style={{ background: pack.gradient }}>
                      <PackArtwork variant={pack.slug} compact />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-950">{pack.name}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{pack.tagline}</p>
                        </div>
                        <span className="pack-trust-badge">{pack.trust}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 p-5">
                    <p className="text-sm leading-6 text-slate-600">{pack.summary}</p>
                    <div className="flex flex-wrap gap-2">
                      {pack.compatibility.slice(0, 3).map((item) => (
                        <span key={item} className="directory-pill directory-pill-small">
                          {item}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{pack.publisher}</span>
                      <span>{pack.category}</span>
                    </div>
                  </div>
                </Link>
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
                <Link key={pack.slug} href={`/packs/${pack.slug}`} className="pack-card">
                  <div className="pack-card-header">
                    <div className="pack-card-art pack-card-art-small" style={{ background: pack.gradient }}>
                      <PackArtwork variant={pack.slug} compact />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">{pack.name}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{pack.tagline}</p>
                        </div>
                        <span className="pack-trust-badge">{pack.trust}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 p-5">
                    <p className="text-sm leading-6 text-slate-600">{pack.summary}</p>
                    <div className="flex flex-wrap gap-2">
                      {pack.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="directory-pill directory-pill-small">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{pack.publisher}</span>
                      <span>{pack.category}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="glass-panel px-6 py-6 sm:px-7">
            <p className="section-label">Live previews</p>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <PreviewCard
                title="Shared studio chat"
                body="Centered collaborative thread with the right-side agent rail still attached."
                href="/chat"
              />
              <PreviewCard
                title="Builder preview"
                body="A generic persona workspace you can rewrite into a domain-native builder or operator surface."
                href="/workspace-a"
              />
              <PreviewCard
                title="Reviewer preview"
                body="A second scoped workspace for review, oversight, or aggregated decision surfaces."
                href="/workspace-b"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="directory-metric">
      <p className="section-label">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function PreviewCard({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-[22px] border border-[rgba(72,57,39,0.12)] bg-white px-5 py-5 transition hover:-translate-y-[1px] hover:shadow-[0_16px_30px_rgba(33,27,20,0.08)]">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      <span className="mt-4 inline-flex text-sm font-medium text-slate-900">Open preview</span>
    </Link>
  );
}
