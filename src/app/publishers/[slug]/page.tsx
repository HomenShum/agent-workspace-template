import Link from "next/link";
import { notFound } from "next/navigation";
import { PackTile } from "@/components/PacksDirectory";
import {
  getPacksByPublisher,
  getPublisherProfileBySlug,
  publisherProfiles,
} from "@/lib/harness-packs";

export function generateStaticParams() {
  return Object.values(publisherProfiles).map((publisher) => ({ slug: publisher.slug }));
}

export default async function PublisherPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const publisher = getPublisherProfileBySlug(slug);

  if (!publisher) {
    notFound();
  }

  const packs = getPacksByPublisher(publisher.name);

  return (
    <main className="app-shell">
      <div className="app-frame">
        <div className="space-y-8">
          <section className="directory-header">
            <div className="directory-header-copy">
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/" className="directory-pill directory-pill-small">
                  Back to directory
                </Link>
                <span className="directory-publisher-status">{publisher.status}</span>
              </div>
              <p className="section-label">Publisher profile</p>
              <h1 className="directory-header-title">{publisher.name}</h1>
              <p className="directory-header-body">{publisher.description}</p>
            </div>
            <div className="directory-header-actions">
              <a
                href={publisher.href}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
              >
                Open GitHub
              </a>
            </div>
          </section>

          <section className="directory-results-bar">
            <div className="directory-results-summary">
              <span className="directory-results-count">{packs.length} packs from this publisher</span>
              <span className="text-sm text-slate-500">
                Browse the packs this publisher has contributed to the marketplace.
              </span>
            </div>
            <div className="directory-results-meta">
              <span className="directory-results-chip">{publisher.initials}</span>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {packs.map((pack) => (
              <PackTile key={pack.slug} pack={pack} />
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
