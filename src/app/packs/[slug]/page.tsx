import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
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

  return (
    <main className="app-shell">
      <div className="app-frame">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            <section className="glass-panel overflow-hidden">
              <div className="h-48 w-full" style={{ background: pack.gradient }} />
              <div className="space-y-6 px-6 py-7 sm:px-8">
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
            </section>

            <section className="grid gap-5 md:grid-cols-2">
              <InfoBlock
                title="Use when"
                items={pack.useWhen}
                description="These are the situations where this harness earns its extra structure."
              />
              <InfoBlock
                title="Avoid when"
                items={pack.avoidWhen}
                description="This keeps the pack from becoming a default hammer for every workflow."
              />
            </section>

            <section className="glass-panel px-6 py-6 sm:px-8">
              <p className="section-label">Key outcomes</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                What this pack is supposed to improve
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                {pack.keyOutcomes.map((item) => (
                  <li key={item} className="rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
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

            <section className="grid gap-5 xl:grid-cols-2">
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
              <p className="section-label">Pack metadata</p>
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
              </div>
            </section>

            <section className="glass-panel px-6 py-6">
              <p className="section-label">Examples</p>
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
          </aside>
        </div>
      </div>
    </main>
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
