/**
 * /my-packs/<slug>/edit — the fork editor.
 *
 * Server component. Hydrates with:
 *   - existing fork markdown if one exists
 *   - catalog pack's markdown if no fork yet (first-visit auto-hydrate;
 *     fork is NOT created until the operator clicks Save).
 *
 * The editor itself (textarea + preview + buttons) is the ForkEditor client
 * component.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ForkEditor } from "@/components/ForkEditor";
import { getOperatorSessionId } from "@/lib/fork-session";
import { getFork } from "@/lib/fork-storage";
import { packToMarkdown } from "@/lib/pack-markdown";
import { getPackBySlug, isValidSlug } from "@/lib/pack-registry";

export const dynamic = "force-dynamic";

export default async function ForkEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const pack = getPackBySlug(slug);
  if (!pack) notFound();

  const sessionId = await getOperatorSessionId();

  if (!sessionId) {
    return (
      <main className="directory-page mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Sign in required</h1>
        <p className="mt-3 text-sm text-slate-600">
          You need an active operator session to edit a fork of{" "}
          <span className="font-medium text-slate-900">{pack.name}</span>.
        </p>
        <p className="mt-6">
          <Link href="/" className="text-sm font-medium text-blue-700 underline">
            Back to the catalog
          </Link>
        </p>
      </main>
    );
  }

  const sourceMarkdown = packToMarkdown(pack);
  const existing = getFork(sessionId, slug);
  const initialMarkdown = existing?.markdown ?? sourceMarkdown;
  const sourceVersion = existing?.sourceVersion ?? pack.version;

  return (
    <main className="directory-page mx-auto max-w-6xl px-6 py-10">
      <nav className="text-xs text-slate-500">
        <Link href="/my-packs" className="underline">
          My packs
        </Link>
        <span className="px-1">/</span>
        <span>{pack.name}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          Edit fork: {pack.name}
        </h1>
        <Link
          href={`/my-packs/${slug}/view`}
          className="text-sm font-medium text-blue-700 underline"
        >
          View rendered
        </Link>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {existing
          ? "Editing your forked copy. Changes are scoped to this operator session."
          : "First visit — this is the catalog content. Your fork is created on the first Save."}
      </p>

      <section className="mt-6">
        <ForkEditor
          slug={slug}
          sessionId={sessionId}
          sourceVersion={sourceVersion}
          initialMarkdown={initialMarkdown}
          sourceMarkdown={sourceMarkdown}
        />
      </section>
    </main>
  );
}
