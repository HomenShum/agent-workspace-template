import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { PackArtwork } from "@/components/PackArtwork";
import { PackArtworkAdmin } from "@/components/PackArtworkAdmin";
import { getHarnessPack, harnessPacks } from "@/lib/harness-packs";

export function generateStaticParams() {
  return harnessPacks.map((pack) => ({ slug: pack.slug }));
}

export default async function PackDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pack = getHarnessPack(slug);

  if (!pack) {
    notFound();
  }

  const convexEnabled = !!process.env.NEXT_PUBLIC_CONVEX_URL;

  return (
    <main className="app-shell">
      <div className="app-frame">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            <section className="glass-panel pack-detail-header">
              <div className="pack-detail-header-copy">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/" className="directory-pill directory-pill-small">
                    Back to directory
                  </Link>
                  <span className="directory-pill directory-pill-small">{pack.trust}</span>
                  <span className="directory-pill directory-pill-small">{pack.category}</span>
                </div>
                <div className="space-y-3">
                  <p className="section-label">{pack.publisher}</p>
                  <h1 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
                    {pack.name}
                  </h1>
                  <p className="max-w-3xl text-lg leading-8 text-slate-600">{pack.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pack.compatibility.map((item) => (
                    <span key={item} className="directory-pill">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="pack-detail-art" style={{ background: pack.gradient }}>
                <PackArtwork variant={pack.slug} compact />
              </div>
            </section>

            <section className="glass-panel px-6 py-6 sm:px-8">
              <p className="section-label">When to use this pack</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                Fit, boundaries, and expected payoff
              </h2>
              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                <ContextGroup
                  title="Use when"
                  items={pack.useWhen}
                  description="These are the situations where this pack earns its extra structure."
                />
                <ContextGroup
                  title="Avoid when"
                  items={pack.avoidWhen}
                  description="This keeps the pack from becoming a default hammer."
                />
                <ContextGroup
                  title="What it improves"
                  items={pack.keyOutcomes}
                  description="These are the concrete outcomes you should expect if the pack is implemented well."
                />
              </div>
            </section>

            <section className="grid gap-5">
              <InstructionPanel
                title="Minimal instructions"
                description="Use this when you want the smallest useful starting point."
                body={pack.minimalInstructions}
                copyLabel="Copy minimal"
              />
              <InstructionPanel
                title="Full harness pack"
                description="Use this when you want the whole natural-language instruction set."
                body={pack.fullInstructions}
                copyLabel="Copy full pack"
              />
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <InfoBlock
                title="Evaluation checklist"
                items={pack.evaluationChecklist}
                description="These checks should pass before you consider the pattern production-ready."
              />
              <InfoBlock
                title="Common failure modes"
                items={pack.failureModes}
                description="These are the typical reasons this pattern degrades in the wild."
              />
            </section>

            <section className="glass-panel px-6 py-6 sm:px-8">
              <p className="section-label">Source pack</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                Official docs and implementation references
              </h2>
              <div className="mt-5 grid gap-4">
                {pack.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-5 py-4 transition hover:-translate-y-[1px] hover:shadow-[0_16px_30px_rgba(33,27,20,0.08)]"
                  >
                    <p className="text-sm font-semibold text-slate-950">{source.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{source.note}</p>
                    <span className="mt-3 inline-flex text-xs text-slate-500">{source.url}</span>
                  </a>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <section className="glass-panel px-6 py-6">
              <p className="section-label">At a glance</p>
              <div className="mt-4 grid gap-3">
                {pack.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-4"
                  >
                    <p className="section-label">{metric.label}</p>
                    <p className="mt-2 text-base font-semibold text-slate-950">{metric.value}</p>
                  </div>
                ))}
                <div className="rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-4">
                  <p className="section-label">Updated</p>
                  <p className="mt-2 text-base font-semibold text-slate-950">{pack.updatedAt}</p>
                </div>
                <div className="rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-4">
                  <p className="section-label">Compatibility</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pack.compatibility.map((item) => (
                      <span key={item} className="directory-pill directory-pill-small">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="glass-panel px-6 py-6">
              <p className="section-label">Links</p>
              <div className="mt-4 grid gap-3">
                {pack.examples.map((example) =>
                  example.external ? (
                    <a
                      key={example.label}
                      href={example.href}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary text-center"
                    >
                      {example.label}
                    </a>
                  ) : (
                    <Link key={example.label} href={example.href} className="btn-secondary text-center">
                      {example.label}
                    </Link>
                  ),
                )}
              </div>
            </section>

            {convexEnabled ? <PackArtworkAdmin pack={pack} /> : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

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
    <section className="space-y-3 rounded-[18px] border border-[rgba(72,57,39,0.1)] bg-white px-4 py-4">
      <div>
        <p className="section-label">{title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <ul className="space-y-2 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="border-t border-[rgba(72,57,39,0.08)] pt-2 first:border-t-0 first:pt-0">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function InfoBlock({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <section className="glass-panel px-6 py-6 sm:px-8">
      <p className="section-label">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function InstructionPanel({
  title,
  description,
  body,
  copyLabel,
}: {
  title: string;
  description: string;
  body: string;
  copyLabel: string;
}) {
  return (
    <section className="glass-panel px-6 py-6 sm:px-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <CopyButton value={body} label={copyLabel} />
      </div>
      <pre className="directory-code-block mt-5">{body}</pre>
    </section>
  );
}
