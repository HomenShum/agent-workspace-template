/**
 * Pack detail page — Notion-style single editable panel.
 *
 * Layout goal (per product direction):
 *   "Everything on each pack should be collapsed to a single editable panel
 *    like a read-only Notion page — easy for export, user can edit for their
 *    own needs if they want to tie it to their own account."
 *
 * Implementation:
 *   - One centered <article> column (max-w-3xl) renders every section inline.
 *   - Section wrappers use `variant="flat"` to drop the legacy glass-panel
 *     card chrome. Internal sub-cards (tables, field cards) stay so tabular
 *     data remains legible.
 *   - Stable H2 anchor ids (`#install`, `#telemetry`, etc.) match the raw
 *     markdown export order. TOC sidebar + inline chip-bar jump to them.
 *   - PackExportToolbar (client) owns Download / Copy / Fork buttons.
 *   - Long fullInstructions (>800 words) wrap in native <details> so ctrl+F
 *     still finds them; no client JS needed.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { PackExportToolbar } from "@/components/PackExportToolbar";
import { PackTOC, type PackTOCItem } from "@/components/PackTOC";
import { getAllPacks, getPackBySlug } from "@/lib/pack-registry";
import { getPublisherProfile } from "@/lib/harness-packs";
import { getInstallCount } from "@/lib/install-counts";
import {
  ChangelogList,
  Chip,
  ComparesWithTable,
  ConsumersSection,
  ContractCard,
  DeprecationBanner,
  FailureModesPanel,
  InstallBlock,
  LayersAccordion,
  PublisherProvenanceBadge,
  RediscoveryCostBadge,
  RelationshipGraph,
  SectionCard,
  SecurityReviewPanel,
  TelemetryStrip,
  TransferMatrixTable,
  getStatusClassName,
} from "./page-sections";

export function generateStaticParams() {
  return getAllPacks().map((pack) => ({ slug: pack.slug }));
}

export default async function PackDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pack = getPackBySlug(slug);

  if (!pack) {
    notFound();
  }

  const publisher = getPublisherProfile(pack.publisher);

  // Install velocity hero numbers — shown inline in the meta row, not as a
  // separate band. If rediscoveryCost is absent we just omit the token value.
  const installCount = getInstallCount(pack.slug);
  const perInstallTokens = pack.rediscoveryCost?.tokens ?? 0;
  const tokensSavedApprox = installCount * perInstallTokens;

  // Which sections apply to this pack? Harness-only / data-only sections are
  // excluded so the TOC reflects the actually-rendered anchors.
  const hasContract = Boolean(pack.contract);
  const hasLayers = Boolean(pack.layers);
  const hasTransferMatrix = Boolean(
    pack.transferMatrix && pack.transferMatrix.length > 0,
  );
  const hasCompares = pack.comparesWith.length > 0;
  const hasRelationships =
    pack.relatedPacks.length +
      pack.requires.length +
      pack.conflictsWith.length +
      pack.supersedes.length >
    0;
  const hasConsumers = (pack.consumers ?? []).length > 0;
  const hasSecurityReview = Boolean(pack.securityReview);
  const hasChangelog = pack.changelog.length > 0;
  const hasSources = pack.sources.length > 0;
  const hasExamples = pack.examples.length > 0;

  // Long-instructions threshold: wrap `fullInstructions` in <details> when it
  // exceeds ~800 whitespace-separated tokens. Approximate but free.
  const fullInstructionsWordCount = pack.fullInstructions.split(/\s+/).length;
  const fullInstructionsCollapse = fullInstructionsWordCount > 800;

  const tocItems: PackTOCItem[] = [
    { id: "install", label: "Install" },
    { id: "telemetry", label: "Telemetry" },
    ...(pack.rediscoveryCost
      ? [{ id: "rediscovery", label: "Rediscovery cost" }]
      : []),
    { id: "summary", label: "Summary" },
    { id: "fit", label: "Use when / Avoid when" },
    ...(hasContract ? [{ id: "contract", label: "Contract" }] : []),
    ...(hasLayers ? [{ id: "layers", label: "Layers" }] : []),
    { id: "minimal-instructions", label: "Minimal instructions" },
    { id: "full-instructions", label: "Full instructions" },
    { id: "evaluation", label: "Evaluation checklist" },
    { id: "failure-modes", label: "Failure modes" },
    ...(hasTransferMatrix
      ? [{ id: "transfer-matrix", label: "Transfer matrix" }]
      : []),
    ...(hasCompares ? [{ id: "compares-with", label: "Compares with" }] : []),
    ...(hasRelationships
      ? [{ id: "relationships", label: "Relationships" }]
      : []),
    ...(hasConsumers ? [{ id: "consumers", label: "Consumers" }] : []),
    ...(hasSecurityReview
      ? [{ id: "security-review", label: "Security review" }]
      : []),
    ...(hasChangelog ? [{ id: "changelog", label: "Changelog" }] : []),
    ...(hasSources ? [{ id: "sources", label: "Sources" }] : []),
    ...(hasExamples ? [{ id: "examples", label: "Examples" }] : []),
  ];

  return (
    <main className="app-shell notion-doc">
      <div className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px]">
          <article
            className="notion-article mx-auto w-full max-w-3xl"
            data-testid="pack-article"
          >
            {/* ============= Top toolbar (back + export) ============= */}
            <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <Link href="/" className="directory-pill directory-pill-small">
                ← Back to catalog
              </Link>
              <PackExportToolbar slug={pack.slug} />
            </header>

            {/* ============= Hero ============= */}
            <section className="notion-hero" data-testid="pack-hero">
              <div className="notion-meta">
                <Chip>{pack.trust}</Chip>
                <Chip>{pack.packType}</Chip>
                {pack.canonicalPattern !== "n/a" ? (
                  <Chip>{pack.canonicalPattern}</Chip>
                ) : null}
                <Chip>v{pack.version}</Chip>
                <span
                  className={`pack-status-badge ${getStatusClassName(pack.status)}`}
                >
                  {pack.status}
                </span>
              </div>
              <h1 className="text-4xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl">
                {pack.name}
              </h1>
              {pack.tagline ? (
                <p className="max-w-3xl text-lg leading-7 text-slate-700">
                  {pack.tagline}
                </p>
              ) : null}
              <div className="notion-meta">
                <span className="font-medium text-slate-800">
                  {pack.publisher}
                </span>
                <PublisherProvenanceBadge provenance={publisher?.provenance} />
                {publisher ? (
                  <span className="text-xs text-slate-500">
                    {publisher.status}
                  </span>
                ) : null}
                <span className="text-slate-400">·</span>
                <span className="text-xs text-slate-500">
                  Updated {pack.updatedAt}
                </span>
                <span className="text-slate-400">·</span>
                <span
                  className="text-xs text-amber-900"
                  data-testid="install-hero-badge"
                >
                  ~{formatHeroCount(installCount)} installs this month
                  {perInstallTokens > 0 ? (
                    <> · saved ~{formatHeroTokens(tokensSavedApprox)} tokens</>
                  ) : null}
                </span>
              </div>
            </section>

            {/* Inline TOC on small screens — lives between hero and body. */}
            <div className="my-6 lg:hidden">
              <PackTOC items={tocItems} />
            </div>

            <div className="notion-divider" />

            {/* ============= Body — every section flat, inline ============= */}
            <div className="space-y-10">
              {/* Install */}
              <InstallBlock
                installCommand={pack.installCommand}
                claudeCodeSnippet={pack.claudeCodeSnippet}
                rawMarkdownPath={pack.rawMarkdownPath}
                variant="flat"
                id="install"
              />

              {/* Telemetry */}
              <TelemetryStrip
                telemetry={pack.telemetry}
                variant="flat"
                id="telemetry"
              />

              {/* Rediscovery cost (optional) */}
              {pack.rediscoveryCost ? (
                <RediscoveryCostBadge
                  rediscoveryCost={pack.rediscoveryCost}
                  variant="flat"
                  id="rediscovery"
                />
              ) : null}

              {/* Summary */}
              <section className="notion-section" id="summary">
                <h2 className="notion-heading">Summary</h2>
                <p className="max-w-3xl text-base leading-7 text-slate-800">
                  {pack.summary}
                </p>
              </section>

              {/* Fit: use-when / avoid-when / key outcomes */}
              <section className="notion-section" id="fit">
                <h2 className="notion-heading">Fit and expected payoff</h2>
                <p className="notion-desc">
                  When this pack earns its extra structure, when to skip it,
                  and what it should improve.
                </p>
                <div className="mt-3 grid gap-5 md:grid-cols-3">
                  <ContextGroup
                    title="Use when"
                    items={pack.useWhen}
                    description="Situations where this pack earns its extra structure."
                  />
                  <ContextGroup
                    title="Avoid when"
                    items={pack.avoidWhen}
                    description="Keeps the pack from becoming a default hammer."
                  />
                  <ContextGroup
                    title="What it improves"
                    items={pack.keyOutcomes}
                    description="Expected outcomes if implemented well."
                  />
                </div>
              </section>

              {/* Contract — harness-only */}
              {pack.contract ? (
                <ContractCard
                  contract={pack.contract}
                  variant="flat"
                  id="contract"
                />
              ) : null}

              {/* Layers — harness-only */}
              {pack.layers ? (
                <LayersAccordion
                  layers={pack.layers}
                  variant="flat"
                  id="layers"
                />
              ) : null}

              {/* Minimal instructions */}
              <InstructionPanel
                id="minimal-instructions"
                title="Minimal instructions"
                description="Smallest useful starting point."
                body={pack.minimalInstructions}
                copyLabel="Copy minimal"
              />

              {/* Full instructions (possibly collapsed) */}
              <InstructionPanel
                id="full-instructions"
                title="Full instructions"
                description="Complete natural-language instruction set."
                body={pack.fullInstructions}
                copyLabel="Copy full pack"
                collapse={fullInstructionsCollapse}
              />

              {/* Evaluation checklist */}
              <section className="notion-section" id="evaluation">
                <h2 className="notion-heading">Evaluation checklist</h2>
                <p className="notion-desc">
                  These checks should pass before you consider the pattern
                  production-ready.
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-800">
                  {pack.evaluationChecklist.map((item) => (
                    <li
                      key={item}
                      className="rounded-[10px] border border-[rgba(72,57,39,0.1)] bg-white px-4 py-2.5"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Failure modes */}
              <FailureModesPanel
                failureModes={pack.failureModes}
                variant="flat"
                id="failure-modes"
              />

              {/* Deprecation banner + transfer matrix */}
              {hasTransferMatrix ? (
                <section className="notion-section" id="transfer-matrix">
                  <DeprecationBanner
                    modelIds={pack.transferMatrix!.map((e) => e.modelId)}
                  />
                  <TransferMatrixTable
                    entries={pack.transferMatrix!}
                    variant="flat"
                  />
                </section>
              ) : null}

              {/* Compares with */}
              {hasCompares ? (
                <ComparesWithTable
                  comparisons={pack.comparesWith}
                  currentSlug={pack.slug}
                  variant="flat"
                  id="compares-with"
                />
              ) : null}

              {/* Relationships */}
              {hasRelationships ? (
                <RelationshipGraph
                  related={pack.relatedPacks}
                  requires={pack.requires}
                  conflictsWith={pack.conflictsWith}
                  supersedes={pack.supersedes}
                  variant="flat"
                  id="relationships"
                />
              ) : null}

              {/* Consumers — reverse index */}
              {hasConsumers ? (
                <ConsumersSection
                  consumers={pack.consumers ?? []}
                  variant="flat"
                  id="consumers"
                />
              ) : null}

              {/* Security review */}
              {pack.securityReview ? (
                <SecurityReviewPanel
                  review={pack.securityReview}
                  variant="flat"
                  id="security-review"
                />
              ) : null}

              {/* Changelog */}
              {hasChangelog ? (
                <ChangelogList
                  entries={pack.changelog}
                  variant="flat"
                  id="changelog"
                />
              ) : null}

              {/* Sources */}
              {hasSources ? (
                <SectionCard
                  label="Sources"
                  heading="Official docs and implementation references"
                  variant="flat"
                  id="sources"
                >
                  <div className="grid gap-3">
                    {pack.sources.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="directory-reference-row"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-950">
                            {source.label}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {source.note}
                          </p>
                          <span className="mt-2 inline-flex text-xs text-slate-500">
                            {source.url}
                          </span>
                        </div>
                        <span
                          className="directory-reference-arrow"
                          aria-hidden="true"
                        >
                          Open
                        </span>
                      </a>
                    ))}
                  </div>
                </SectionCard>
              ) : null}

              {/* Examples */}
              {hasExamples ? (
                <SectionCard
                  label="Examples"
                  heading="Reference implementations"
                  variant="flat"
                  id="examples"
                >
                  <div className="grid gap-2">
                    {pack.examples.map((example) =>
                      example.external ? (
                        <a
                          key={example.label}
                          href={example.href}
                          target="_blank"
                          rel="noreferrer"
                          className="directory-link-button"
                        >
                          <span>{example.label}</span>
                          <span aria-hidden="true">Open</span>
                        </a>
                      ) : (
                        <Link
                          key={example.label}
                          href={example.href}
                          className="directory-link-button"
                        >
                          <span>{example.label}</span>
                          <span aria-hidden="true">Open</span>
                        </Link>
                      ),
                    )}
                  </div>
                </SectionCard>
              ) : null}
            </div>
          </article>

          {/* ============= Desktop sticky TOC ============= */}
          <div className="hidden lg:block">
            <PackTOC items={tocItems} />
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------------------
 * Small page-local helpers — each lives here (not page-sections.tsx) because
 * they're specific to this redesigned page's layout.
 * ------------------------------------------------------------------------- */

function ContextGroup({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="rounded-[14px] border border-[rgba(72,57,39,0.1)] bg-white px-4 py-3">
      <p className="section-label">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-800">
        {items.map((item) => (
          <li
            key={item}
            className="border-t border-[rgba(72,57,39,0.08)] pt-2 first:border-t-0 first:pt-0"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Instruction block. When `collapse` is true, the body is wrapped in a native
 * <details> element — ctrl+F still finds text inside (browsers search closed
 * <details> content), no client JS needed.
 */
function InstructionPanel({
  id,
  title,
  description,
  body,
  copyLabel,
  collapse = false,
}: {
  id: string;
  title: string;
  description: string;
  body: string;
  copyLabel: string;
  collapse?: boolean;
}) {
  const pre = (
    <pre className="notion-codeblock mt-3 whitespace-pre-wrap break-words">
      {body}
    </pre>
  );
  return (
    <section className="notion-section" id={id}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="notion-heading">{title}</h2>
          <p className="notion-desc">{description}</p>
        </div>
        <CopyButton value={body} label={copyLabel} />
      </div>
      {collapse ? (
        <details className="group mt-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-950">
            <span className="group-open:hidden">Show full instructions</span>
            <span className="hidden group-open:inline">Hide</span>
          </summary>
          {pre}
        </details>
      ) : (
        pre
      )}
    </section>
  );
}

// Compact hero-badge formatters — match the card strip so surfaces stay
// visually consistent. Kept local to this page.
function formatHeroCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1_000) return String(Math.floor(n));
  if (n < 1_000_000) {
    const k = n / 1_000;
    return k < 10 ? `${k.toFixed(1).replace(/\.0$/, "")}k` : `${Math.floor(k)}k`;
  }
  return "1M";
}

function formatHeroTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1_000) return String(Math.floor(n));
  if (n < 1_000_000) {
    const k = n / 1_000;
    return k < 10 ? `${k.toFixed(1).replace(/\.0$/, "")}k` : `${Math.floor(k)}k`;
  }
  if (n < 1_000_000_000) {
    const m = n / 1_000_000;
    return m < 10 ? `${m.toFixed(1).replace(/\.0$/, "")}M` : `${Math.floor(m)}M`;
  }
  const b = n / 1_000_000_000;
  return `${b.toFixed(1).replace(/\.0$/, "")}B`;
}
