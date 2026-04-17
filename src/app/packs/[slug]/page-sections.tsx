import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { getModelStatus } from "@/lib/model-deprecations";
import type {
  ChangelogEntry,
  ConsumerProject,
  FailureMode,
  Pack,
  PackComparison,
  PackContract,
  PackLayers,
  PublisherProvenance,
  RediscoveryCost,
  SecurityReview,
  Telemetry,
  TransferMatrixEntry,
} from "@/lib/pack-schema";

/* ---------------------------------------------------------------------------
 * Small UI primitives (server components)
 * ------------------------------------------------------------------------- */

/**
 * PackVariant — controls the outer-wrapper chrome of top-level pack sections.
 *   - "card" (default): preserves legacy `glass-panel` look used by any other
 *     callers of these components.
 *   - "flat": Notion-style — strips the outer panel chrome so the section
 *     flows inline inside a single `<article>`. Internal sub-cards (table
 *     containers, contract fields, etc.) are preserved so tabular/structured
 *     data still reads correctly.
 */
export type PackVariant = "card" | "flat";

/**
 * Classnames for the outer `<section>` wrapper. In `card` mode this is the
 * legacy glass panel. In `flat` mode we drop the border/shadow entirely and
 * leave only a predictable `scroll-margin-top` so anchor jumps don't hide
 * under sticky headers, plus vertical breathing room.
 */
function sectionClass(variant: PackVariant): string {
  return variant === "flat"
    ? "notion-section"
    : "glass-panel px-6 py-6 sm:px-8";
}

/**
 * H2 heading: full-weight in card mode, lighter `notion-heading` in flat.
 */
function headingClass(variant: PackVariant): string {
  return variant === "flat"
    ? "notion-heading"
    : "mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950";
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="directory-pill directory-pill-small">{children}</span>;
}

export function SectionCard({
  label,
  heading,
  description,
  children,
  variant = "card",
  id,
}: {
  label: string;
  heading?: string;
  description?: string;
  children: React.ReactNode;
  variant?: PackVariant;
  id?: string;
}) {
  return (
    <section className={sectionClass(variant)} id={id}>
      {variant === "flat" ? (
        heading ? (
          <h2 className={headingClass(variant)}>{heading}</h2>
        ) : (
          <p className="section-label">{label}</p>
        )
      ) : (
        <>
          <p className="section-label">{label}</p>
          {heading ? <h2 className={headingClass(variant)}>{heading}</h2> : null}
        </>
      )}
      {description ? (
        <p
          className={
            variant === "flat"
              ? "notion-desc"
              : "mt-2 text-sm leading-6 text-slate-600"
          }
        >
          {description}
        </p>
      ) : null}
      <div className={variant === "flat" ? "mt-3" : "mt-4"}>{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * 1. Install block — three copy-pasteable surfaces.
 * ------------------------------------------------------------------------- */

export function InstallBlock({
  installCommand,
  claudeCodeSnippet,
  rawMarkdownPath,
  variant = "card",
  id,
}: {
  installCommand: string;
  claudeCodeSnippet: string;
  rawMarkdownPath: string;
  variant?: PackVariant;
  id?: string;
}) {
  return (
    <section className={sectionClass(variant)} id={id}>
      {variant === "flat" ? (
        <h2 className={headingClass(variant)}>Install</h2>
      ) : (
        <>
          <p className="section-label">Install</p>
          <h2 className={headingClass(variant)}>
            Drop this pack into your workspace
          </h2>
        </>
      )}
      <div className={variant === "flat" ? "mt-3 space-y-4" : "mt-5 space-y-4"}>
        <CodeSurface
          caption="One-line install"
          body={installCommand}
          copyLabel="Copy install command"
          prominent
        />
        <CodeSurface
          caption="AGENTS.md snippet (Claude Code / Cursor)"
          body={claudeCodeSnippet}
          copyLabel="Copy snippet"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">Raw Markdown</p>
            <p className="mt-1 text-xs text-slate-600">
              Machine-readable body for agent ingestion or copy/paste.
            </p>
          </div>
          <a
            href={rawMarkdownPath}
            target="_blank"
            rel="noreferrer"
            className="directory-link-button"
          >
            <span>Download as .md</span>
            <span aria-hidden="true">Open</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function CodeSurface({
  caption,
  body,
  copyLabel,
  prominent = false,
}: {
  caption: string;
  body: string;
  copyLabel: string;
  prominent?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="section-label">{caption}</p>
        <CopyButton value={body} label={copyLabel} />
      </div>
      <pre
        className={`directory-code-block mt-3 ${
          prominent ? "text-base" : "text-sm"
        } whitespace-pre-wrap break-words`}
      >
        {body}
      </pre>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 2. Telemetry strip — horizontal metric row with graceful fallback.
 * ------------------------------------------------------------------------- */

export function TelemetryStrip({
  telemetry,
  variant = "card",
  id,
}: {
  telemetry?: Telemetry;
  variant?: PackVariant;
  id?: string;
}) {
  const outerCls =
    variant === "flat" ? "notion-section" : "glass-panel px-6 py-5 sm:px-8";
  if (!telemetry) {
    return (
      <section className={outerCls} id={id}>
        <div className="flex items-center justify-between gap-3">
          {variant === "flat" ? (
            <h2 className={headingClass(variant)}>Telemetry</h2>
          ) : (
            <p className="section-label">Telemetry</p>
          )}
          <span className="text-xs text-slate-500">Not yet measured</span>
        </div>
      </section>
    );
  }

  const items: Array<{ label: string; value: string }> = [
    { label: "Pass rate", value: formatPct(telemetry.passRate) },
    { label: "Avg tokens", value: telemetry.avgTokens.toLocaleString() },
    { label: "Avg cost", value: `$${telemetry.avgCost.toFixed(3)}` },
  ];
  if (telemetry.avgToolCalls !== undefined) {
    items.push({ label: "Avg tool calls", value: String(telemetry.avgToolCalls) });
  }
  if (telemetry.avgDurationSec !== undefined) {
    items.push({ label: "Avg duration", value: `${telemetry.avgDurationSec}s` });
  }
  items.push({ label: "Sample size", value: `${telemetry.lastNRuns} runs` });
  items.push({ label: "Updated", value: telemetry.lastUpdated });

  return (
    <section className={outerCls} id={id}>
      <div className="flex items-center justify-between gap-3">
        {variant === "flat" ? (
          <h2 className={headingClass(variant)}>Telemetry</h2>
        ) : (
          <p className="section-label">Telemetry</p>
        )}
        <span className="text-xs text-slate-500">Measured on attrition.sh</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white px-3 py-2"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
              {item.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatPct(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

/* ---------------------------------------------------------------------------
 * 3. Rediscovery cost — single-line badge with methodology details.
 * ------------------------------------------------------------------------- */

export function RediscoveryCostBadge({
  rediscoveryCost,
  variant = "card",
  id,
}: {
  rediscoveryCost: RediscoveryCost;
  variant?: PackVariant;
  id?: string;
}) {
  const outerCls =
    variant === "flat" ? "notion-section" : "glass-panel px-6 py-5 sm:px-8";
  return (
    <section className={outerCls} id={id}>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="section-label">Rediscovery cost</p>
            <p className="text-sm text-slate-700">
              Skipping this saves{" "}
              <span className="font-semibold text-slate-950">
                ~{rediscoveryCost.tokens.toLocaleString()} tokens
              </span>{" "}
              /{" "}
              <span className="font-semibold text-slate-950">
                {rediscoveryCost.minutes} min
              </span>{" "}
              of research.
            </p>
          </div>
          <span className="text-xs text-slate-500 group-open:hidden">Methodology</span>
          <span className="hidden text-xs text-slate-500 group-open:inline">Hide</span>
        </summary>
        <div className="mt-3 rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white px-4 py-3 text-sm leading-6 text-slate-700">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
            Measured {rediscoveryCost.measuredAt}
          </p>
          <p className="mt-2">{rediscoveryCost.methodology}</p>
        </div>
      </details>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * 7. Contract card.
 * ------------------------------------------------------------------------- */

export function ContractCard({
  contract,
  variant = "card",
  id,
}: {
  contract: PackContract;
  variant?: PackVariant;
  id?: string;
}) {
  return (
    <SectionCard
      label="Execution contract"
      heading="Bounded invocation surface"
      description="Turns fuzzy LLM calls into bounded agent invocations (Tongyi NLA pattern)."
      variant={variant}
      id={id}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <ContractField label="Required outputs" items={contract.requiredOutputs} />
        <ContractField label="Permissions" items={contract.permissions} />
        <ContractField
          label="Completion conditions"
          items={contract.completionConditions}
          full
        />
        <ContractScalar label="Token budget" value={contract.tokenBudget.toLocaleString()} />
        <ContractScalar label="Output path" value={contract.outputPath} mono />
      </div>
    </SectionCard>
  );
}

function ContractField({
  label,
  items,
  full = false,
}: {
  label: string;
  items: string[];
  full?: boolean;
}) {
  return (
    <div
      className={`rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white px-4 py-3 ${
        full ? "md:col-span-2" : ""
      }`}
    >
      <p className="section-label">{label}</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContractScalar({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white px-4 py-3">
      <p className="section-label">{label}</p>
      <p
        className={`mt-2 text-sm font-semibold text-slate-950 ${
          mono ? "font-mono text-[13px]" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 8. Layers accordion (native <details>, no client state needed).
 * ------------------------------------------------------------------------- */

export function LayersAccordion({
  layers,
  variant = "card",
  id,
}: {
  layers: PackLayers;
  variant?: PackVariant;
  id?: string;
}) {
  return (
    <SectionCard
      label="Three-layer harness"
      heading="Runtime charter, NLH, and tool spec"
      description="Split layers enable ablation — swap the NLH while fixing the charter, or vice versa."
      variant={variant}
      id={id}
    >
      <div className="space-y-3">
        <LayerBlock title="Runtime charter" body={layers.runtimeCharter} />
        <LayerBlock title="Natural-language harness (NLH)" body={layers.nlh} />
        <LayerToolSpec tools={layers.toolSpec} />
      </div>
    </SectionCard>
  );
}

function LayerBlock({ title, body }: { title: string; body: string }) {
  return (
    <details className="group rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <span className="text-xs text-slate-500 group-open:hidden">Expand</span>
        <span className="hidden text-xs text-slate-500 group-open:inline">Collapse</span>
      </summary>
      <div className="border-t border-[rgba(72,57,39,0.1)] px-4 py-3 text-sm leading-6 text-slate-700">
        {body}
      </div>
    </details>
  );
}

function LayerToolSpec({
  tools,
}: {
  tools: PackLayers["toolSpec"];
}) {
  return (
    <details className="group rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-semibold text-slate-950">
          Tool spec <span className="font-normal text-slate-500">({tools.length})</span>
        </p>
        <span className="text-xs text-slate-500 group-open:hidden">Expand</span>
        <span className="hidden text-xs text-slate-500 group-open:inline">Collapse</span>
      </summary>
      <div className="border-t border-[rgba(72,57,39,0.1)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  Name
                </th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  Signature
                </th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.name} className="border-t border-[rgba(72,57,39,0.08)] align-top">
                  <td className="px-4 py-3 font-mono text-[13px] font-semibold text-slate-950">
                    {tool.name}
                  </td>
                  <td className="px-4 py-3">
                    <code className="break-all font-mono text-[12px] text-slate-700">
                      {tool.signature}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{tool.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

/* ---------------------------------------------------------------------------
 * 13. Transfer matrix table with best-row highlight.
 * ------------------------------------------------------------------------- */

export function TransferMatrixTable({
  entries,
  variant = "card",
  id,
}: {
  entries: TransferMatrixEntry[];
  variant?: PackVariant;
  id?: string;
}) {
  if (entries.length === 0) return null;
  const bestPass = Math.max(...entries.map((e) => e.passRate));

  return (
    <SectionCard
      label="Transfer matrix"
      heading="How this pack behaves across models"
      description="Measured pass rate and token usage per model, over the same golden set."
      variant={variant}
      id={id}
    >
      <div className="overflow-x-auto rounded-[14px] border border-[rgba(72,57,39,0.1)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Model
              </th>
              <th className="px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Pass rate
              </th>
              <th className="px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Avg tokens
              </th>
              <th className="px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Runs
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isBest = entry.passRate === bestPass;
              return (
                <tr
                  key={entry.modelId}
                  className={`border-t border-[rgba(72,57,39,0.08)] ${
                    isBest ? "bg-emerald-50/60" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-[13px] font-semibold text-slate-950">
                    {entry.modelId}
                    {isBest ? (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-800">
                        Best
                      </span>
                    ) : null}
                    <ModelLifecycleChip modelId={entry.modelId} />
                  </td>
                  <td className="px-4 py-3 text-slate-900">{formatPct(entry.passRate)}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.tokens.toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.runs}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/**
 * D4 — inline model lifecycle chip. Rendered beside the model id in the
 * transfer matrix. `active` → nothing (clean row). `deprecated` → amber chip.
 * `retired` → rose chip. Title includes the replacement model when known.
 */
function ModelLifecycleChip({ modelId }: { modelId: string }) {
  const entry = getModelStatus(modelId);
  if (entry.status === "active") return null;
  const styles =
    entry.status === "retired"
      ? "bg-rose-100 text-rose-800"
      : "bg-amber-100 text-amber-800";
  const label = entry.status === "retired" ? "Retired" : "Deprecated";
  const tooltip = [
    entry.message,
    entry.replacedBy ? `Use ${entry.replacedBy}` : null,
    entry.retiresAt ? `Retires ${entry.retiresAt}` : null,
  ]
    .filter(Boolean)
    .join(" — ");
  return (
    <span
      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${styles}`}
      title={tooltip || label}
      data-testid="model-lifecycle-chip"
    >
      {label}
    </span>
  );
}

/**
 * D4 — page-level banner that warns when a pack references retired or
 * deprecated models. Shown above the TransferMatrixTable.
 */
export function DeprecationBanner({ modelIds }: { modelIds: string[] }) {
  const retired = modelIds.filter((id) => getModelStatus(id).status === "retired");
  const deprecated = modelIds.filter(
    (id) => getModelStatus(id).status === "deprecated"
  );
  if (retired.length === 0 && deprecated.length === 0) return null;
  const severity = retired.length > 0 ? "retired" : "deprecated";
  const bg = severity === "retired" ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200";
  const titleColor = severity === "retired" ? "text-rose-900" : "text-amber-900";
  return (
    <section
      className={`rounded-xl border px-5 py-4 ${bg}`}
      data-testid="deprecation-banner"
      role="alert"
    >
      <div className={`font-semibold ${titleColor}`}>
        {severity === "retired"
          ? "This pack references retired models"
          : "This pack references deprecated models"}
      </div>
      <ul className="mt-2 space-y-1 text-sm text-slate-700">
        {retired.map((id) => (
          <li key={id}>
            <span className="font-mono text-rose-800">{id}</span>
            <span className="ml-2 text-xs uppercase tracking-[0.1em] text-rose-600">retired</span>
            <span className="ml-2 text-slate-600">
              {getModelStatus(id).message ?? "Calls are no longer accepted."}
            </span>
          </li>
        ))}
        {deprecated.map((id) => (
          <li key={id}>
            <span className="font-mono text-amber-800">{id}</span>
            <span className="ml-2 text-xs uppercase tracking-[0.1em] text-amber-600">deprecated</span>
            <span className="ml-2 text-slate-600">
              {getModelStatus(id).message ?? "Scheduled for retirement."}
            </span>
            {getModelStatus(id).replacedBy ? (
              <span className="ml-2 text-slate-500">
                → migrate to <span className="font-mono text-slate-800">{getModelStatus(id).replacedBy}</span>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * E3 — publisher provenance badge. "Signed" = manifest present AND status is
 * verified; "Unsigned" = no manifest; "Signature invalid" = present but status
 * is invalid. Surfaced beside the publisher name on the pack detail page.
 */
export function PublisherProvenanceBadge({
  provenance,
}: {
  provenance?: PublisherProvenance;
}) {
  if (!provenance) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600"
        title="This publisher has no signed provenance manifest."
        data-testid="provenance-badge-unsigned"
      >
        Unsigned
      </span>
    );
  }
  const verified = provenance.status === "verified";
  const invalid = provenance.status === "invalid";
  const styles = invalid
    ? "border-rose-200 bg-rose-50 text-rose-800"
    : verified
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-sky-200 bg-sky-50 text-sky-800";
  const label = invalid ? "Signature invalid" : verified ? "Signed" : "Signed (unverified)";
  const title = [
    `Key: ${provenance.keyFingerprint.slice(0, 16)}…`,
    `Signed: ${provenance.signedAt}`,
    `Tool: ${provenance.signedBy}`,
    `Covers ${provenance.packs.length} pack${provenance.packs.length === 1 ? "" : "s"}`,
  ].join(" · ");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${styles}`}
      title={title}
      data-testid="provenance-badge"
    >
      {label}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * 14. Compares-with table.
 * ------------------------------------------------------------------------- */

export function ComparesWithTable({
  comparisons,
  currentSlug,
  variant = "card",
  id,
}: {
  comparisons: PackComparison[];
  /**
   * When provided, each alternative-slug cell additionally links to
   * `/compare?a=<currentSlug>&b=<otherSlug>` via a secondary "compare"
   * affordance. The primary pack link is preserved for single-pack
   * navigation; the new link is additive, not a replacement.
   */
  currentSlug?: string;
  variant?: PackVariant;
  id?: string;
}) {
  if (comparisons.length === 0) return null;
  return (
    <SectionCard
      label="Compares with"
      heading="How this pack stacks up"
      description="Head-to-head notes vs alternative patterns."
      variant={variant}
      id={id}
    >
      <div className="overflow-x-auto rounded-[14px] border border-[rgba(72,57,39,0.1)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
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
            {comparisons.map((c, idx) => (
              <tr
                key={`${c.slug}-${c.axis}-${idx}`}
                className="border-t border-[rgba(72,57,39,0.08)] bg-white align-top"
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/packs/${c.slug}`}
                      className="font-mono text-[13px] font-semibold text-slate-950 hover:underline"
                    >
                      {c.slug}
                    </Link>
                    {currentSlug ? (
                      <Link
                        href={`/compare?a=${encodeURIComponent(currentSlug)}&b=${encodeURIComponent(c.slug)}`}
                        className="text-[11px] font-medium uppercase tracking-[0.08em] text-sky-700 hover:underline"
                        data-testid="compare-link"
                      >
                        Compare →
                      </Link>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{c.axis}</td>
                <td className="px-4 py-3">
                  <WinnerBadge winner={c.winner} />
                </td>
                <td className="px-4 py-3 text-slate-700">{c.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function WinnerBadge({ winner }: { winner: PackComparison["winner"] }) {
  const map: Record<PackComparison["winner"], { label: string; cls: string }> = {
    self: { label: "This pack", cls: "bg-emerald-100 text-emerald-800" },
    other: { label: "Alternative", cls: "bg-amber-100 text-amber-800" },
    tie: { label: "Tie", cls: "bg-slate-100 text-slate-700" },
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
 * 15. Relationship graph — chips linking related packs.
 * ------------------------------------------------------------------------- */

export function RelationshipGraph({
  related,
  requires,
  conflictsWith,
  supersedes,
  variant = "card",
  id,
}: {
  related: string[];
  requires: string[];
  conflictsWith: string[];
  supersedes: string[];
  variant?: PackVariant;
  id?: string;
}) {
  const hasAny =
    related.length > 0 ||
    requires.length > 0 ||
    conflictsWith.length > 0 ||
    supersedes.length > 0;
  if (!hasAny) return null;

  return (
    <SectionCard
      label="Relationships"
      heading="How this pack connects"
      variant={variant}
      id={id}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {related.length > 0 ? (
          <RelationshipGroup label="Related" slugs={related} tone="neutral" />
        ) : null}
        {requires.length > 0 ? (
          <RelationshipGroup label="Requires" slugs={requires} tone="info" />
        ) : null}
        {conflictsWith.length > 0 ? (
          <RelationshipGroup label="Conflicts with" slugs={conflictsWith} tone="danger" />
        ) : null}
        {supersedes.length > 0 ? (
          <RelationshipGroup label="Supersedes" slugs={supersedes} tone="warn" />
        ) : null}
      </div>
    </SectionCard>
  );
}

function RelationshipGroup({
  label,
  slugs,
  tone,
}: {
  label: string;
  slugs: string[];
  tone: "neutral" | "info" | "warn" | "danger";
}) {
  const toneCls: Record<typeof tone, string> = {
    neutral: "bg-white text-slate-800 border-[rgba(72,57,39,0.12)]",
    info: "bg-sky-50 text-sky-900 border-sky-200",
    warn: "bg-amber-50 text-amber-900 border-amber-200",
    danger: "bg-rose-50 text-rose-900 border-rose-200",
  };
  return (
    <div className="rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white px-4 py-3">
      <p className="section-label">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {slugs.map((slug) => (
          <Link
            key={slug}
            href={`/packs/${slug}`}
            className={`inline-flex rounded-full border px-3 py-1 font-mono text-[12px] hover:underline ${toneCls[tone]}`}
          >
            {slug}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 15b. Consumers section — E4 reverse index. "Used in N projects: …"
 * ------------------------------------------------------------------------- */

export function ConsumersSection({
  consumers,
  variant = "card",
  id,
}: {
  consumers: ConsumerProject[];
  variant?: PackVariant;
  id?: string;
}) {
  // Honest status: hide the section entirely if there's no data. The caller
  // passes `[]` when the field is undefined on the pack — we treat both
  // equivalently at render-time since both mean "nothing to show the user".
  if (!consumers || consumers.length === 0) return null;
  // Deduplicate by projectId defensively — the registry hydrator should
  // already give us unique rows, but a file-backed source could drift.
  const seen = new Set<string>();
  const unique = consumers.filter((c) => {
    if (seen.has(c.projectId)) return false;
    seen.add(c.projectId);
    return true;
  });
  const countLabel = unique.length === 1 ? "1 project" : `${unique.length} projects`;

  return (
    <SectionCard
      label="Consumers"
      heading={`Used in ${countLabel}`}
      description="Projects that have installed this pack. Updated as lockfiles are aggregated."
      variant={variant}
      id={id}
    >
      <div className="flex flex-wrap gap-2">
        {unique.map((c) => (
          <Link
            key={c.projectId}
            href={`/traces?project=${encodeURIComponent(c.projectId)}`}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(72,57,39,0.12)] bg-white px-3 py-1.5 text-[13px] font-medium text-slate-800 hover:underline"
            title={`${c.project} — ${c.target} — v${c.version} — installed ${c.installedAt}`}
          >
            <span>{c.project}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-600">
              {c.target === "cursor" ? "cursor" : "claude"}
            </span>
            <span className="font-mono text-[11px] text-slate-500">v{c.version}</span>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}

/* ---------------------------------------------------------------------------
 * 16. Security review panel.
 * ------------------------------------------------------------------------- */

export function SecurityReviewPanel({
  review,
  variant = "card",
  id,
}: {
  review: SecurityReview;
  variant?: PackVariant;
  id?: string;
}) {
  const surfaceMap: Record<
    SecurityReview["injectionSurface"],
    { label: string; cls: string }
  > = {
    low: { label: "Low", cls: "bg-emerald-100 text-emerald-900 border-emerald-200" },
    medium: { label: "Medium", cls: "bg-amber-100 text-amber-900 border-amber-200" },
    high: { label: "High", cls: "bg-rose-100 text-rose-900 border-rose-200" },
  };
  const s = surfaceMap[review.injectionSurface];

  return (
    <SectionCard
      label="Security review"
      heading="Injection surface, allow-list, and known issues"
      variant={variant}
      id={id}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white px-4 py-3">
          <p className="section-label">Injection surface</p>
          <span
            className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${s.cls}`}
          >
            {s.label}
          </span>
        </div>
        <div className="rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white px-4 py-3">
          <p className="section-label">Last scanned</p>
          <p className="mt-2 text-sm font-semibold text-slate-950">{review.lastScanned}</p>
        </div>
        <div className="rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white px-4 py-3 md:col-span-2">
          <p className="section-label">Tool allow-list</p>
          {review.toolAllowList.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {review.toolAllowList.map((tool) => (
                <code
                  key={tool}
                  className="rounded-full border border-[rgba(72,57,39,0.12)] bg-slate-50 px-3 py-1 font-mono text-[12px] text-slate-800"
                >
                  {tool}
                </code>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No tool permissions granted.</p>
          )}
        </div>
        {review.knownIssues.length > 0 ? (
          <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 md:col-span-2">
            <p className="section-label text-amber-900">Known issues</p>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-amber-900">
              {review.knownIssues.map((issue) => (
                <li key={issue} className="flex gap-2">
                  <span aria-hidden="true">!</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

/* ---------------------------------------------------------------------------
 * 16b. Failure modes — structured scar tissue (symptom / trigger / prevention / tier).
 * ------------------------------------------------------------------------- */

const TIER_STYLES: Record<FailureMode["tier"], string> = {
  jr: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  mid: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  sr: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  staff: "bg-rose-500/10 text-rose-300 border-rose-500/30",
};

const TIER_LABEL: Record<FailureMode["tier"], string> = {
  jr: "Junior",
  mid: "Mid",
  sr: "Senior",
  staff: "Staff",
};

export function FailureModesPanel({
  failureModes,
  variant = "card",
  id,
}: {
  failureModes: FailureMode[];
  variant?: PackVariant;
  id?: string;
}) {
  if (!failureModes || failureModes.length === 0) {
    return (
      <SectionCard
        label="Failure modes"
        heading="Common failure modes"
        description="None documented yet."
        variant={variant}
        id={id}
      >
        <p className="text-sm text-white/60">
          This pack has not yet documented its production failure modes. Publishers are expected
          to add at least three before the pack can reach <strong>Verified</strong> trust.
        </p>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      label="Failure modes"
      heading="Common failure modes"
      description='Every check below traces back to a specific production failure. Read as: "I would think about X because in production Y can happen."'
      variant={variant}
      id={id}
    >
      <ul className="space-y-4">
        {failureModes.map((fm, i) => (
          <li
            key={i}
            className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-2"
          >
            <div className="flex items-start gap-3 flex-wrap">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${TIER_STYLES[fm.tier]}`}
                title={`Typically learned at ${TIER_LABEL[fm.tier]} level`}
              >
                {TIER_LABEL[fm.tier]}
              </span>
              <p className="flex-1 text-sm font-medium text-white">{fm.symptom}</p>
            </div>
            <dl className="grid gap-1 text-sm text-white/70 sm:grid-cols-[auto_1fr] sm:gap-x-3">
              <dt className="text-white/50">Trigger</dt>
              <dd>{fm.trigger}</dd>
              <dt className="text-white/50">Prevention</dt>
              <dd>{fm.preventionCheck}</dd>
              {fm.relatedPacks && fm.relatedPacks.length > 0 ? (
                <>
                  <dt className="text-white/50">See also</dt>
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
    </SectionCard>
  );
}

/* ---------------------------------------------------------------------------
 * 17. Changelog list — reverse-chronological.
 * ------------------------------------------------------------------------- */

export function ChangelogList({
  entries,
  variant = "card",
  id,
}: {
  entries: ChangelogEntry[];
  variant?: PackVariant;
  id?: string;
}) {
  if (entries.length === 0) return null;
  // assume input is already in authorship order; sort reverse-chronologically by date.
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <SectionCard
      label="Changelog"
      heading="Version history"
      variant={variant}
      id={id}
    >
      <ol className="space-y-4">
        {sorted.map((entry) => (
          <li
            key={`${entry.version}-${entry.date}`}
            className="rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="font-mono text-sm font-semibold text-slate-950">
                v{entry.version}
              </p>
              <p className="text-xs text-slate-500">{entry.date}</p>
            </div>
            {entry.added.length > 0 ? (
              <ChangeList label="Added" items={entry.added} tone="emerald" />
            ) : null}
            {entry.removed.length > 0 ? (
              <ChangeList label="Removed" items={entry.removed} tone="rose" />
            ) : null}
            {entry.reason ? (
              <p className="mt-2 text-sm italic leading-6 text-slate-600">
                {entry.reason}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

function ChangeList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "emerald" | "rose";
}) {
  const cls =
    tone === "emerald" ? "text-emerald-800" : "text-rose-800";
  return (
    <div className="mt-2">
      <p className={`text-xs font-semibold uppercase tracking-[0.08em] ${cls}`}>
        {label}
      </p>
      <ul className="mt-1 space-y-1 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Shared helpers used by page.tsx
 * ------------------------------------------------------------------------- */

export function getStatusClassName(status: Pack["status"]) {
  if (status === "Production-ready") return "pack-status-badge-production";
  if (status === "Recommended") return "pack-status-badge-recommended";
  return "pack-status-badge-experimental";
}
