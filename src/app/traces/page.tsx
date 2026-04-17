/**
 * /traces — change-trace directory landing.
 *
 * Server component. Reads `getAllTraces()` + optional query params
 * (`?project=`, `?q=`, `?symbol=`, `?file=`, `?tag=`, `?range=`) and
 * renders a filterable, ctrl+F-friendly directory of every trace in
 * the catalog.
 *
 * See docs/CHANGE_TRACE.md §7.1 for the ASCII mock this UI mirrors.
 */

import Link from "next/link";
import { getAllTraces, searchTraces } from "@/lib/trace-registry";
import type { ChangeTrace } from "@/lib/trace-schema";

export const dynamic = "force-static";

type RawSearchParams = {
  q?: string | string[];
  project?: string | string[];
  symbol?: string | string[];
  file?: string | string[];
  tag?: string | string[];
  range?: string | string[];
};

type Filters = {
  q: string;
  project: string;
  symbol: string;
  file: string;
  tag: string;
  range: "7d" | "30d" | "all";
};

function firstString(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

function parseFilters(raw: RawSearchParams): Filters {
  const rangeRaw = firstString(raw.range).toLowerCase();
  const range: Filters["range"] =
    rangeRaw === "7d" || rangeRaw === "30d" ? rangeRaw : "all";
  return {
    q: firstString(raw.q).trim(),
    project: firstString(raw.project).trim(),
    symbol: firstString(raw.symbol).trim(),
    file: firstString(raw.file).trim(),
    tag: firstString(raw.tag).trim(),
    range,
  };
}

function rowMentionsSymbol(trace: ChangeTrace, needle: string): boolean {
  const n = needle.toLowerCase();
  for (const row of trace.rows) {
    for (const ch of row.changes) {
      for (const s of ch.symbolsAdded) if (s.toLowerCase().includes(n)) return true;
      for (const s of ch.symbolsRemoved) if (s.toLowerCase().includes(n)) return true;
      for (const r of ch.symbolsRenamed) {
        if (r.from.toLowerCase().includes(n) || r.to.toLowerCase().includes(n)) return true;
      }
    }
  }
  return false;
}

function rowMentionsFile(trace: ChangeTrace, needle: string): boolean {
  const n = needle.toLowerCase();
  for (const row of trace.rows) {
    for (const f of row.filesTouched) if (f.toLowerCase().includes(n)) return true;
    for (const c of row.changes) if (c.path.toLowerCase().includes(n)) return true;
  }
  return false;
}

function applyFilters(all: ChangeTrace[], f: Filters): ChangeTrace[] {
  let out = f.q ? searchTraces(f.q) : all;
  if (f.project) {
    const p = f.project.toLowerCase();
    out = out.filter((t) => t.project.toLowerCase() === p);
  }
  if (f.symbol) out = out.filter((t) => rowMentionsSymbol(t, f.symbol));
  if (f.file) out = out.filter((t) => rowMentionsFile(t, f.file));
  if (f.tag) {
    const tag = f.tag.toLowerCase();
    out = out.filter((t) => t.tags.some((x) => x.toLowerCase() === tag));
  }
  if (f.range !== "all") {
    const days = f.range === "7d" ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    out = out.filter((t) => {
      const ts = Date.parse(t.createdAt);
      if (Number.isNaN(ts)) return true; // don't hide malformed dates
      return ts >= cutoff;
    });
  }
  return out;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function buildQuery(
  current: Filters,
  patch: Partial<Record<keyof Filters, string>>,
): string {
  const merged: Record<string, string> = {
    q: current.q,
    project: current.project,
    symbol: current.symbol,
    file: current.file,
    tag: current.tag,
    range: current.range === "all" ? "" : current.range,
  };
  for (const [k, v] of Object.entries(patch)) {
    merged[k] = v ?? "";
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/traces?${qs}` : "/traces";
}

export default async function TracesDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const filters = parseFilters(raw);

  const all = getAllTraces();
  const filtered = applyFilters(all, filters);

  // Aggregate stats across the CURRENTLY LOADED (i.e. all) traces — the
  // footer tells the user the catalog size, not the filter size.
  const allRows = all.flatMap((t) => t.rows);
  const allSymbols = uniq(
    allRows.flatMap((r) =>
      r.changes.flatMap((c) => [
        ...c.symbolsAdded,
        ...c.symbolsRemoved,
        ...c.symbolsRenamed.flatMap((rn) => [rn.from, rn.to]),
      ]),
    ),
  );
  const allFiles = uniq(
    allRows.flatMap((r) => [...r.filesTouched, ...r.changes.map((c) => c.path)]),
  );

  const projects = uniq(all.map((t) => t.project)).sort();
  const tagCounts = new Map<string, number>();
  for (const t of all) {
    for (const tag of t.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag]) => tag);

  const anyActiveFilter =
    Boolean(filters.q || filters.project || filters.symbol || filters.file || filters.tag) ||
    filters.range !== "all";

  return (
    <main className="app-shell">
      <div className="app-frame">
        <div className="space-y-8">
          {/* Header */}
          <section className="directory-header">
            <div className="directory-header-copy">
              <p className="section-label">Change-trace catalog · Pillar 2</p>
              <h1 className="directory-header-title">
                Change traces{" "}
                <span className="ml-2 text-base font-normal text-slate-500">
                  {all.length} total
                </span>
              </h1>
              <p className="directory-header-body">
                Every coding session captured as rows — Scenario / Files / Changes / Why.
                Ctrl+F your own history.
              </p>
            </div>
          </section>

          {/* Search + filters */}
          <section className="glass-panel px-6 py-6 sm:px-8">
            <form method="GET" action="/traces" className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <label htmlFor="trace-q" className="section-label">
                  Search
                </label>
                <input
                  id="trace-q"
                  name="q"
                  type="search"
                  defaultValue={filters.q}
                  placeholder="scenario · symbol · file · hook · tag"
                  className="mt-2 w-full rounded-[14px] border border-[rgba(72,57,39,0.16)] bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              {/* Preserve other active filters through the GET submit */}
              {filters.project ? (
                <input type="hidden" name="project" value={filters.project} />
              ) : null}
              {filters.symbol ? (
                <input type="hidden" name="symbol" value={filters.symbol} />
              ) : null}
              {filters.file ? (
                <input type="hidden" name="file" value={filters.file} />
              ) : null}
              {filters.tag ? <input type="hidden" name="tag" value={filters.tag} /> : null}
              {filters.range !== "all" ? (
                <input type="hidden" name="range" value={filters.range} />
              ) : null}
              <button type="submit" className="directory-link-button">
                <span>Search</span>
                <span aria-hidden="true">Go</span>
              </button>
              {anyActiveFilter ? (
                <Link href="/traces" className="directory-pill directory-pill-small">
                  Clear all
                </Link>
              ) : null}
            </form>

            {/* Project filter */}
            {projects.length > 0 ? (
              <div className="mt-5">
                <p className="section-label">Project</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    href={buildQuery(filters, { project: "" })}
                    className={`directory-pill directory-pill-small ${
                      !filters.project ? "ring-2 ring-slate-900" : ""
                    }`}
                  >
                    All
                  </Link>
                  {projects.map((p) => (
                    <Link
                      key={p}
                      href={buildQuery(filters, { project: p })}
                      className={`directory-pill directory-pill-small ${
                        filters.project === p ? "ring-2 ring-slate-900" : ""
                      }`}
                    >
                      {p}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Tag filter */}
            {topTags.length > 0 ? (
              <div className="mt-5">
                <p className="section-label">Tag</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {topTags.map((tag) => (
                    <Link
                      key={tag}
                      href={buildQuery(filters, { tag: filters.tag === tag ? "" : tag })}
                      className={`directory-pill directory-pill-small ${
                        filters.tag === tag ? "ring-2 ring-slate-900" : ""
                      }`}
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Date range */}
            <div className="mt-5">
              <p className="section-label">Date range</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["7d", "30d", "all"] as const).map((r) => (
                  <Link
                    key={r}
                    href={buildQuery(filters, { range: r === "all" ? "" : r })}
                    className={`directory-pill directory-pill-small ${
                      filters.range === r ? "ring-2 ring-slate-900" : ""
                    }`}
                  >
                    {r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : "All time"}
                  </Link>
                ))}
              </div>
            </div>

            {/* Active scoped filters (symbol/file come from deep-links) */}
            {filters.symbol || filters.file ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {filters.symbol ? (
                  <Link
                    href={buildQuery(filters, { symbol: "" })}
                    className="directory-pill directory-pill-small bg-sky-50 text-sky-900 border-sky-200"
                  >
                    symbol: <code className="font-mono">{filters.symbol}</code> ×
                  </Link>
                ) : null}
                {filters.file ? (
                  <Link
                    href={buildQuery(filters, { file: "" })}
                    className="directory-pill directory-pill-small bg-sky-50 text-sky-900 border-sky-200"
                  >
                    file: <code className="font-mono">{filters.file}</code> ×
                  </Link>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* Directory list */}
          <section className="glass-panel px-0 py-0 sm:px-0">
            <div className="flex items-center justify-between gap-3 border-b border-[rgba(72,57,39,0.1)] px-6 py-4 sm:px-8">
              <p className="section-label">Directory</p>
              <span className="text-xs text-slate-500">
                {filtered.length === all.length
                  ? `${all.length} traces`
                  : `${filtered.length} of ${all.length}`}
              </span>
            </div>

            {filtered.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="divide-y divide-[rgba(72,57,39,0.08)]">
                <div className="hidden grid-cols-[180px_160px_60px_1fr_90px_80px] gap-3 px-6 py-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500 sm:grid sm:px-8">
                  <span>ID</span>
                  <span>Project</span>
                  <span>Rows</span>
                  <span>Scenario (head)</span>
                  <span>Packs</span>
                  <span>Date</span>
                </div>
                {filtered.map((t) => (
                  <DirectoryRow key={t.id} trace={t} />
                ))}
              </div>
            )}
          </section>

          {/* Footer summary */}
          <section className="text-center text-xs text-slate-500">
            Showing {filtered.length} of {all.length} · {allRows.length} total rows ·{" "}
            {allSymbols.length} unique symbols · {allFiles.length} files touched
          </section>
        </div>
      </div>
    </main>
  );
}

function DirectoryRow({ trace }: { trace: ChangeTrace }) {
  const head = trace.rows[0]?.scenario ?? "(no rows yet)";
  return (
    <Link
      href={`/traces/${trace.id}`}
      className="grid grid-cols-1 gap-2 px-6 py-4 transition-colors hover:bg-slate-50 sm:grid-cols-[180px_160px_60px_1fr_90px_80px] sm:items-center sm:px-8"
    >
      <span className="font-mono text-[13px] font-semibold text-slate-950">
        {trace.id}
      </span>
      <span className="text-sm text-slate-700">{trace.project}</span>
      <span className="text-sm text-slate-700">{trace.rows.length}</span>
      <span className="text-sm leading-6 text-slate-700">{truncate(head, 120)}</span>
      <span className="text-sm text-slate-700">{trace.packsReferenced.length}</span>
      <span className="text-xs text-slate-500">{shortDate(trace.createdAt)}</span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-12 text-center sm:px-8">
      <p className="text-base font-semibold text-slate-900">No traces match.</p>
      <p className="mt-2 text-sm text-slate-600">
        Start your first one with{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-800">
          attrition trace log
        </code>
        .
      </p>
    </div>
  );
}
