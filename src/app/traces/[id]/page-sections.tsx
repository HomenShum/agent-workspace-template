/**
 * Presentational server components for /traces/[id].
 *
 * All server-rendered; the only client boundary used on this route is
 * the existing <CopyButton /> component, imported by the page.tsx
 * where it's actually needed. Every <details> here stays server.
 *
 * Tier palette intentionally matches `FailureModesPanel` in the packs
 * UI so a reader's mental colour model is consistent across Pillar 1
 * and Pillar 2.
 */

import Link from "next/link";
import type {
  ChangeRow,
  ChangeTrace,
  FailureMode,
  WhyExplanation,
} from "@/lib/trace-schema";

/* ---------------------------------------------------------------------------
 * Shared primitives
 * ------------------------------------------------------------------------- */

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="directory-pill directory-pill-small">{children}</span>;
}

/* ---------------------------------------------------------------------------
 * TraceHeader — id, project, session, createdAt, tags, packsReferenced
 * ------------------------------------------------------------------------- */

export function TraceHeader({
  trace,
  rawPath,
  stats,
}: {
  trace: ChangeTrace;
  rawPath: string;
  stats: { rows: number; files: number; symbols: number };
}) {
  return (
    <section className="glass-panel px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/traces" className="directory-pill directory-pill-small">
          Back to traces
        </Link>
        <Chip>Trace</Chip>
        <Chip>{trace.project}</Chip>
        <span className="text-xs text-slate-500">
          {formatDateLong(trace.createdAt)}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <h1 className="font-mono text-3xl font-semibold tracking-[-0.02em] text-slate-950 sm:text-4xl">
          {trace.id}
        </h1>
        <p className="text-sm text-slate-600">
          Session{" "}
          <code className="font-mono text-[12px] text-slate-700">
            {trace.sessionId || "—"}
          </code>
        </p>
      </div>

      {/* Stats strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rows" value={String(stats.rows)} />
        <Stat label="Files touched" value={String(stats.files)} />
        <Stat label="Unique symbols" value={String(stats.symbols)} />
        <Stat label="Packs referenced" value={String(trace.packsReferenced.length)} />
      </div>

      {trace.tags.length > 0 ? (
        <div className="mt-5">
          <p className="section-label">Tags</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {trace.tags.map((tag) => (
              <Link
                key={tag}
                href={`/traces?tag=${encodeURIComponent(tag)}`}
                className="directory-pill directory-pill-small"
              >
                #{tag}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {trace.packsReferenced.length > 0 ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="section-label">Packs referenced</p>
            {trace.packsReferenced.length >= 2 ? (
              <Link
                href={`/compare?a=${encodeURIComponent(trace.packsReferenced[0])}&b=${encodeURIComponent(trace.packsReferenced[1])}`}
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-700 hover:underline"
                data-testid="trace-compare-packs-used"
              >
                Compare packs used →
              </Link>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {trace.packsReferenced.map((slug) => (
              <Link
                key={slug}
                href={`/packs/${slug}`}
                className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-mono text-[12px] text-sky-900 hover:underline"
              >
                {slug}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a
          href={rawPath}
          target="_blank"
          rel="noreferrer"
          className="directory-link-button"
        >
          <span>Download raw .md</span>
          <span aria-hidden="true">Open</span>
        </a>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ---------------------------------------------------------------------------
 * RowTable — the 4-column trace body.
 * Each row is a server <details> summary that expands to the full Why +
 * failure modes (RowExpanded).
 * ------------------------------------------------------------------------- */

export function RowTable({ rows }: { rows: ChangeRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="glass-panel px-6 py-10 text-center sm:px-8">
        <p className="text-base font-semibold text-slate-900">No rows yet</p>
        <p className="mt-2 text-sm text-slate-600">
          This trace is a stub. Rows will appear once the session captures a diff.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel px-0 py-0">
      <div className="flex items-center justify-between border-b border-[rgba(72,57,39,0.1)] px-6 py-4 sm:px-8">
        <p className="section-label">Rows ({rows.length})</p>
        <span className="text-xs text-slate-500">Scenario · Files · Changes · Why</span>
      </div>
      <ul className="divide-y divide-[rgba(72,57,39,0.08)]">
        {rows.map((row, i) => (
          <li key={i} className="px-6 py-5 sm:px-8">
            <RowItem row={row} index={i + 1} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RowItem({ row, index }: { row: ChangeRow; index: number }) {
  const changeSummary = row.changes
    .map((c) => c.diffSummary)
    .filter(Boolean)
    .join(" · ");

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-slate-500">#{index}</span>
          <span className="text-sm leading-6 text-slate-900">{row.scenario}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
          <FilesChipList files={row.filesTouched} />
          <div className="text-xs leading-5 text-slate-600">
            {changeSummary || "(no changes summary)"}
          </div>
          <WhyHookBadge hook={row.why.hook} />
        </div>
        <p className="text-xs text-slate-500 group-open:hidden">Expand Why + failure modes</p>
        <p className="hidden text-xs text-slate-500 group-open:inline">Collapse</p>
      </summary>
      <div className="mt-4">
        <RowExpanded row={row} />
      </div>
    </details>
  );
}

function FilesChipList({ files }: { files: string[] }) {
  if (files.length === 0) {
    return <span className="text-xs text-slate-500">(no files)</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((f) => (
        <Link
          key={f}
          href={`/traces?file=${encodeURIComponent(f)}`}
          className="inline-flex rounded-full border border-[rgba(72,57,39,0.12)] bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700 hover:bg-slate-50 hover:underline"
          title={`Filter traces by file: ${f}`}
        >
          {f}
        </Link>
      ))}
    </div>
  );
}

function WhyHookBadge({ hook }: { hook: string }) {
  if (!hook) return null;
  return (
    <div className="self-start rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-800">
        Why · hook
      </p>
      <p className="mt-1 text-sm font-medium text-amber-900">{hook}</p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * RowExpanded — full Why (dl) + symbols + failure modes.
 * ------------------------------------------------------------------------- */

export function RowExpanded({ row }: { row: ChangeRow }) {
  return (
    <div className="space-y-4 rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white px-4 py-4">
      <WhyDL why={row.why} />
      {row.changes.length > 0 ? <SymbolsBlock changes={row.changes} /> : null}
      {row.failureModes && row.failureModes.length > 0 ? (
        <FailureModesBlock failureModes={row.failureModes} />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * WhyDL — 4-line pedagogy as a definition list.
 * ------------------------------------------------------------------------- */

export function WhyDL({ why }: { why: WhyExplanation }) {
  return (
    <div>
      <p className="section-label">Why (4-line pedagogy)</p>
      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm leading-6 sm:grid-cols-[auto_1fr]">
        <WhyRow label="Plain" value={why.plain} />
        <WhyRow label="Analogy" value={why.analogy} />
        <WhyRow label="Principle" value={why.principle} />
        <WhyRow label="Hook" value={why.hook} hook />
      </dl>
    </div>
  );
}

function WhyRow({
  label,
  value,
  hook = false,
}: {
  label: string;
  value: string;
  hook?: boolean;
}) {
  return (
    <>
      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
        {label}
      </dt>
      <dd className={hook ? "font-semibold text-amber-900" : "text-slate-700"}>
        {value || "—"}
      </dd>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * SymbolsBlock — render added / renamed / removed as filter chips.
 * Every symbol is a link to /traces?symbol=<name>.
 * ------------------------------------------------------------------------- */

function SymbolsBlock({
  changes,
}: {
  changes: ChangeRow["changes"];
}) {
  const added = new Set<string>();
  const removed = new Set<string>();
  const renamed: Array<{ from: string; to: string }> = [];
  for (const c of changes) {
    for (const s of c.symbolsAdded) added.add(s);
    for (const s of c.symbolsRemoved) removed.add(s);
    for (const r of c.symbolsRenamed) renamed.push(r);
  }
  if (added.size === 0 && removed.size === 0 && renamed.length === 0) return null;

  return (
    <div>
      <p className="section-label">Symbols</p>
      <div className="mt-2 space-y-2">
        {added.size > 0 ? (
          <SymbolGroup label="Added" symbols={Array.from(added)} tone="emerald" />
        ) : null}
        {removed.size > 0 ? (
          <SymbolGroup label="Removed" symbols={Array.from(removed)} tone="rose" />
        ) : null}
        {renamed.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-800">
              Renamed
            </span>
            {renamed.map((r) => (
              <span
                key={`${r.from}→${r.to}`}
                className="inline-flex items-center gap-1 text-[12px]"
              >
                <Link
                  href={`/traces?symbol=${encodeURIComponent(r.from)}`}
                  className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-[11px] text-sky-900 hover:underline"
                >
                  {r.from}
                </Link>
                <span className="text-slate-500">→</span>
                <Link
                  href={`/traces?symbol=${encodeURIComponent(r.to)}`}
                  className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-[11px] text-sky-900 hover:underline"
                >
                  {r.to}
                </Link>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SymbolGroup({
  label,
  symbols,
  tone,
}: {
  label: string;
  symbols: string[];
  tone: "emerald" | "rose";
}) {
  const labelCls =
    tone === "emerald"
      ? "text-emerald-800"
      : "text-rose-800";
  const chipCls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-rose-200 bg-rose-50 text-rose-900";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`text-xs font-semibold uppercase tracking-[0.08em] ${labelCls}`}>
        {label}
      </span>
      {symbols.map((s) => (
        <Link
          key={s}
          href={`/traces?symbol=${encodeURIComponent(s)}`}
          className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[11px] hover:underline ${chipCls}`}
        >
          {s}
        </Link>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * FailureModesBlock + FailureModeChip — tier-coloured panel.
 * Palette matches FailureModesPanel in src/app/packs/[slug]/page-sections.tsx.
 * ------------------------------------------------------------------------- */

const TIER_STYLES: Record<FailureMode["tier"], string> = {
  jr: "bg-emerald-500/10 text-emerald-800 border-emerald-400/40",
  mid: "bg-sky-500/10 text-sky-800 border-sky-400/40",
  sr: "bg-amber-500/10 text-amber-800 border-amber-400/40",
  staff: "bg-rose-500/10 text-rose-800 border-rose-400/40",
};

const TIER_LABEL: Record<FailureMode["tier"], string> = {
  jr: "Junior",
  mid: "Mid",
  sr: "Senior",
  staff: "Staff",
};

export function FailureModeChip({ tier }: { tier: FailureMode["tier"] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${TIER_STYLES[tier]}`}
      title={`Typically learned at ${TIER_LABEL[tier]} level`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

function FailureModesBlock({ failureModes }: { failureModes: FailureMode[] }) {
  return (
    <div>
      <p className="section-label">Failure modes</p>
      <ul className="mt-2 space-y-3">
        {failureModes.map((fm, i) => (
          <li
            key={i}
            className="rounded-[12px] border border-[rgba(72,57,39,0.1)] bg-slate-50/60 px-3 py-3"
          >
            <div className="flex items-start gap-2">
              <FailureModeChip tier={fm.tier} />
              <p className="flex-1 text-sm font-medium text-slate-900">{fm.symptom}</p>
            </div>
            <dl className="mt-2 grid gap-1 text-[13px] leading-5 sm:grid-cols-[auto_1fr] sm:gap-x-3">
              <dt className="text-slate-500">Trigger</dt>
              <dd className="text-slate-700">{fm.trigger}</dd>
              <dt className="text-slate-500">Prevention</dt>
              <dd className="text-slate-700">{fm.preventionCheck}</dd>
              {fm.relatedPacks && fm.relatedPacks.length > 0 ? (
                <>
                  <dt className="text-slate-500">See also</dt>
                  <dd className="flex flex-wrap gap-1">
                    {fm.relatedPacks.map((slug) => (
                      <Link
                        key={slug}
                        href={`/packs/${slug}`}
                        className="directory-pill directory-pill-small hover:underline"
                      >
                        {slug}
                      </Link>
                    ))}
                  </dd>
                </>
              ) : null}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * CrossReferences — linked packs + tag ctrl+F at the bottom of detail page.
 * ------------------------------------------------------------------------- */

export function CrossReferences({ trace }: { trace: ChangeTrace }) {
  if (trace.packsReferenced.length === 0 && trace.tags.length === 0) return null;
  return (
    <section className="glass-panel px-6 py-6 sm:px-8">
      <p className="section-label">Cross-references</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {trace.packsReferenced.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Packs
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {trace.packsReferenced.map((slug) => (
                <Link
                  key={slug}
                  href={`/packs/${slug}`}
                  className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-mono text-[12px] text-sky-900 hover:underline"
                >
                  {slug}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {trace.tags.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Tags
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {trace.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/traces?tag=${encodeURIComponent(tag)}`}
                  className="directory-pill directory-pill-small"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
