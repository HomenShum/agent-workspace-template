/**
 * Presentational server components for `/compare`.
 *
 * All server-rendered — the only client boundary is `<ComparePicker />`
 * used on the landing (pickerless) state. Visual primitives (SectionCard,
 * Chip) are reused from the pack detail page to keep the language
 * consistent across cross-reference surfaces.
 *
 * Layout intent:
 *   - Two mini pack summaries side-by-side (md:grid-cols-2)
 *   - A merged comparison table below that consolidates both packs'
 *     `comparesWith` rows, attributing each row to its source.
 *   - SharedFieldsRow highlights cross-pack commonality so a reader
 *     sees the "shared shape" at a glance.
 *   - DiffHighlights surfaces what's unique to each side.
 */

import Link from "next/link";
import type {
  Pack,
  PackComparison,
  ComparisonAxis,
} from "@/lib/pack-schema";
import {
  Chip,
  SectionCard,
  getStatusClassName,
} from "@/app/packs/[slug]/page-sections";
import ComparePicker from "@/components/ComparePicker";

/* ---------------------------------------------------------------------------
 * CompareColumn — mini pack-detail surface.
 * ------------------------------------------------------------------------- */

export function CompareColumn({
  pack,
  side,
}: {
  pack: Pack;
  side: "a" | "b";
}) {
  return (
    <section className="glass-panel px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="directory-pill directory-pill-small font-mono">
          {side === "a" ? "A" : "B"}
        </span>
        <Chip>{pack.trust}</Chip>
        <Chip>{pack.packType}</Chip>
        {pack.canonicalPattern !== "n/a" ? (
          <Chip>{pack.canonicalPattern}</Chip>
        ) : null}
        <Chip>v{pack.version}</Chip>
        <span className={`pack-status-badge ${getStatusClassName(pack.status)}`}>
          {pack.status}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <Link
          href={`/packs/${pack.slug}`}
          className="block text-2xl font-semibold tracking-[-0.03em] text-slate-950 hover:underline"
        >
          {pack.name}
        </Link>
        <p className="font-mono text-[12px] text-slate-500">{pack.slug}</p>
        {pack.tagline ? (
          <p className="text-sm leading-6 text-slate-700">{pack.tagline}</p>
        ) : null}
      </div>

      <div className="mt-5 rounded-[14px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-3">
        <p className="section-label">Install</p>
        <code className="mt-2 block break-all font-mono text-[12px] text-slate-800">
          {pack.installCommand}
        </code>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniMetric
          label="Token budget"
          value={
            pack.contract ? pack.contract.tokenBudget.toLocaleString() : "—"
          }
        />
        <MiniMetric
          label="Pass rate"
          value={
            pack.telemetry ? `${Math.round(pack.telemetry.passRate * 100)}%` : "—"
          }
        />
        <MiniMetric
          label="Avg tokens"
          value={
            pack.telemetry ? pack.telemetry.avgTokens.toLocaleString() : "—"
          }
        />
        <MiniMetric
          label="Publisher"
          value={pack.publisher}
        />
      </div>

      {pack.compatibility.length > 0 ? (
        <div className="mt-4">
          <p className="section-label">Compatibility</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pack.compatibility.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </div>
        </div>
      ) : null}

      {pack.contract ? (
        <div className="mt-4 rounded-[14px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-3">
          <p className="section-label">Contract summary</p>
          <p className="mt-2 text-xs text-slate-600">
            {pack.contract.requiredOutputs.length} required outputs,{" "}
            {pack.contract.permissions.length} permissions,{" "}
            {pack.contract.completionConditions.length} completion conditions.
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            out: {pack.contract.outputPath}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * ComparisonMergedTable — merges both packs' `comparesWith` into one view.
 * Each row is attributed to its source (A or B) so the reader can see
 * which pack's author made the claim. Winner badge is re-labeled from the
 * merged pack's POV ("A", "B", or "Tie").
 * ------------------------------------------------------------------------- */

type MergedRow = {
  source: "a" | "b";
  alternative: string;
  axis: ComparisonAxis;
  winner: "a" | "b" | "tie" | "other";
  note: string;
};

function mergeComparisons(a: Pack, b: Pack): MergedRow[] {
  const rows: MergedRow[] = [];
  for (const c of a.comparesWith) {
    rows.push({
      source: "a",
      alternative: c.slug,
      axis: c.axis,
      // "self" in A's POV → A wins. "other" → the alt wins. "tie" → tie.
      winner: c.winner === "self" ? "a" : c.winner === "tie" ? "tie" : "other",
      note: c.note,
    });
  }
  for (const c of b.comparesWith) {
    rows.push({
      source: "b",
      alternative: c.slug,
      axis: c.axis,
      winner: c.winner === "self" ? "b" : c.winner === "tie" ? "tie" : "other",
      note: c.note,
    });
  }
  return rows;
}

export function ComparisonMergedTable({ a, b }: { a: Pack; b: Pack }) {
  const rows = mergeComparisons(a, b);
  if (rows.length === 0) {
    return (
      <SectionCard
        label="Merged comparisons"
        heading="Head-to-head claims"
        description="Neither pack has documented comparisons yet."
      >
        <p className="text-sm text-slate-600">
          Nothing to merge. Comparisons will appear here once either pack
          authors a <code className="font-mono text-[12px]">comparesWith</code>{" "}
          entry.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      label="Merged comparisons"
      heading="Head-to-head claims from both packs"
      description="Each row is attributed to the pack that authored it. The winner column is normalised to this compare view (A / B / Tie)."
    >
      <div className="overflow-x-auto rounded-[14px] border border-[rgba(72,57,39,0.1)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Source
              </th>
              <th className="px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Alternative
              </th>
              <th className="px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Axis
              </th>
              <th className="px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Winner
              </th>
              <th className="px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Note
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={`${r.source}-${r.alternative}-${r.axis}-${idx}`}
                className="border-t border-[rgba(72,57,39,0.08)] bg-white align-top"
              >
                <td className="px-4 py-3 font-mono text-[12px] font-semibold text-slate-700">
                  {r.source.toUpperCase()}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/packs/${r.alternative}`}
                    className="font-mono text-[13px] font-semibold text-slate-950 hover:underline"
                  >
                    {r.alternative}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{r.axis}</td>
                <td className="px-4 py-3">
                  <MergedWinnerBadge winner={r.winner} />
                </td>
                <td className="px-4 py-3 text-slate-700">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function MergedWinnerBadge({
  winner,
}: {
  winner: MergedRow["winner"];
}) {
  const map: Record<MergedRow["winner"], { label: string; cls: string }> = {
    a: { label: "A", cls: "bg-emerald-100 text-emerald-800" },
    b: { label: "B", cls: "bg-sky-100 text-sky-800" },
    tie: { label: "Tie", cls: "bg-slate-100 text-slate-700" },
    other: { label: "Alternative", cls: "bg-amber-100 text-amber-800" },
  };
  const { label, cls } = map[winner];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${cls}`}
    >
      {label}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * SharedFieldsRow — commonality highlighter. Surfaces overlap on
 * canonicalPattern, compatibility, tags, requires.
 * ------------------------------------------------------------------------- */

export function SharedFieldsRow({ a, b }: { a: Pack; b: Pack }) {
  const samePattern =
    a.canonicalPattern !== "n/a" && a.canonicalPattern === b.canonicalPattern
      ? a.canonicalPattern
      : null;
  const sharedCompat = intersect(a.compatibility, b.compatibility);
  const sharedTags = intersect(a.tags, b.tags);
  const sharedRequires = intersect(a.requires, b.requires);

  const hasAny =
    samePattern !== null ||
    sharedCompat.length > 0 ||
    sharedTags.length > 0 ||
    sharedRequires.length > 0;

  if (!hasAny) {
    return (
      <SectionCard
        label="Shared shape"
        heading="What both packs have in common"
        description="No overlap detected across canonical pattern, compatibility, tags, or required packs."
      >
        <p className="text-sm text-slate-600">
          These packs live in different neighbourhoods of the catalog. A compare
          here is still useful for deciding between them, but expect divergent
          contracts.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      label="Shared shape"
      heading="What both packs have in common"
      description="Overlap across canonical pattern, compatibility, tags, and required packs."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {samePattern ? (
          <SharedTile label="Canonical pattern" values={[samePattern]} />
        ) : null}
        {sharedCompat.length > 0 ? (
          <SharedTile label="Compatibility" values={sharedCompat} />
        ) : null}
        {sharedTags.length > 0 ? (
          <SharedTile label="Tags" values={sharedTags} />
        ) : null}
        {sharedRequires.length > 0 ? (
          <SharedTile label="Requires" values={sharedRequires} />
        ) : null}
      </div>
    </SectionCard>
  );
}

function SharedTile({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-[14px] border border-emerald-200 bg-emerald-50/50 px-4 py-3">
      <p className="section-label text-emerald-900">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 font-mono text-[12px] text-emerald-900"
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function intersect(a: string[], b: string[]): string[] {
  const s = new Set(b);
  return a.filter((x) => s.has(x));
}

function diff(a: string[], b: string[]): string[] {
  const s = new Set(b);
  return a.filter((x) => !s.has(x));
}

/* ---------------------------------------------------------------------------
 * DiffHighlights — what's unique on each side.
 * Includes comparesWith-slug diff, token-budget gap (if both harness),
 * compatibility/tag uniqueness.
 * ------------------------------------------------------------------------- */

export function DiffHighlights({ a, b }: { a: Pack; b: Pack }) {
  const aCompareSlugs = a.comparesWith.map((c) => c.slug);
  const bCompareSlugs = b.comparesWith.map((c) => c.slug);
  const aOnlyCompares = diff(aCompareSlugs, bCompareSlugs);
  const bOnlyCompares = diff(bCompareSlugs, aCompareSlugs);

  const aOnlyCompat = diff(a.compatibility, b.compatibility);
  const bOnlyCompat = diff(b.compatibility, a.compatibility);

  const aOnlyTags = diff(a.tags, b.tags);
  const bOnlyTags = diff(b.tags, a.tags);

  const tokenBudgetGap =
    a.contract && b.contract
      ? Math.abs(a.contract.tokenBudget - b.contract.tokenBudget)
      : null;
  const tokenBudgetWinner =
    a.contract && b.contract
      ? a.contract.tokenBudget < b.contract.tokenBudget
        ? "a"
        : a.contract.tokenBudget > b.contract.tokenBudget
        ? "b"
        : "tie"
      : null;

  return (
    <SectionCard
      label="Diff highlights"
      heading="What each pack brings that the other doesn't"
      description="Unique coverage and any measurable gap between the two."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <DiffColumn
          title={`Unique to A — ${a.name}`}
          accent="emerald"
          items={[
            {
              label: "Comparisons not in B",
              values: aOnlyCompares,
            },
            { label: "Compatibility A-only", values: aOnlyCompat },
            { label: "Tags A-only", values: aOnlyTags },
          ]}
        />
        <DiffColumn
          title={`Unique to B — ${b.name}`}
          accent="sky"
          items={[
            {
              label: "Comparisons not in A",
              values: bOnlyCompares,
            },
            { label: "Compatibility B-only", values: bOnlyCompat },
            { label: "Tags B-only", values: bOnlyTags },
          ]}
        />
      </div>

      {tokenBudgetGap !== null && tokenBudgetWinner ? (
        <div className="mt-4 rounded-[14px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-3">
          <p className="section-label">Token budget gap</p>
          <p className="mt-2 text-sm text-slate-700">
            Difference:{" "}
            <span className="font-semibold text-slate-950">
              {tokenBudgetGap.toLocaleString()} tokens
            </span>
            . {" "}
            {tokenBudgetWinner === "tie"
              ? "Both packs declare the same budget."
              : tokenBudgetWinner === "a"
              ? `A (${a.name}) is the cheaper declared contract.`
              : `B (${b.name}) is the cheaper declared contract.`}
          </p>
        </div>
      ) : null}
    </SectionCard>
  );
}

function DiffColumn({
  title,
  accent,
  items,
}: {
  title: string;
  accent: "emerald" | "sky";
  items: Array<{ label: string; values: string[] }>;
}) {
  const border = accent === "emerald" ? "border-emerald-200" : "border-sky-200";
  const bg = accent === "emerald" ? "bg-emerald-50/40" : "bg-sky-50/40";
  const text = accent === "emerald" ? "text-emerald-900" : "text-sky-900";

  return (
    <div className={`rounded-[14px] border ${border} ${bg} px-4 py-3`}>
      <p className={`section-label ${text}`}>{title}</p>
      <div className="mt-3 space-y-3">
        {items.map((it) => (
          <div key={it.label}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {it.label}
            </p>
            {it.values.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {it.values.map((v) => (
                  <span
                    key={v}
                    className="inline-flex rounded-full border border-[rgba(72,57,39,0.12)] bg-white px-2.5 py-0.5 font-mono text-[11px] text-slate-800"
                  >
                    {v}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">(none)</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * PackPicker (server) — wraps the ComparePicker client component with the
 * grouped pack data it needs. The picker itself is a client component
 * (native <select>, no new deps); this server wrapper prepares the
 * grouped list from the registry.
 * ------------------------------------------------------------------------- */

export function PackPicker({
  packs,
  selectedA,
  selectedB,
  highlight,
  errorMessage,
}: {
  packs: Pack[];
  selectedA?: string;
  selectedB?: string;
  highlight?: "a" | "b";
  errorMessage?: string;
}) {
  // Group packs by packType for the grouped <select>.
  const grouped = new Map<string, { slug: string; name: string }[]>();
  for (const p of packs) {
    const key = p.packType;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({ slug: p.slug, name: p.name });
  }
  const groups = [...grouped.entries()].sort((x, y) => x[0].localeCompare(y[0]));

  return (
    <section className="glass-panel px-6 py-6 sm:px-8">
      <p className="section-label">Pick two packs to compare</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
        Side-by-side comparison
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        Choose an A and a B below. Packs are grouped by type. The URL is
        bookmarkable as <code className="font-mono text-[12px]">/compare?a=…&b=…</code>.
      </p>
      {errorMessage ? (
        <div
          role="alert"
          className="mt-4 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          {errorMessage}
        </div>
      ) : null}
      <div className="mt-5">
        <ComparePicker
          groups={groups}
          selectedA={selectedA}
          selectedB={selectedB}
          highlight={highlight}
        />
      </div>
    </section>
  );
}
