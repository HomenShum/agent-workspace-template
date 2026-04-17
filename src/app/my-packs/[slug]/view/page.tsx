/**
 * /my-packs/<slug>/view — read-only rendered view of the operator's fork.
 *
 * Uses the same safe markdown renderer as the editor preview. If no fork
 * exists, redirect to the edit view (which auto-hydrates from the catalog
 * copy).
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown-render";
import { getOperatorSessionId } from "@/lib/fork-session";
import { getFork } from "@/lib/fork-storage";
import { getPackBySlug, isValidSlug } from "@/lib/pack-registry";

export const dynamic = "force-dynamic";

export default async function ForkViewPage({
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
          Sign in to your operator session to view your fork of{" "}
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

  const existing = getFork(sessionId, slug);
  if (!existing) {
    redirect(`/my-packs/${slug}/edit`);
  }

  const html = renderMarkdown(existing.markdown);

  return (
    <main className="directory-page mx-auto max-w-3xl px-6 py-10">
      <nav className="text-xs text-slate-500">
        <Link href="/my-packs" className="underline">
          My packs
        </Link>
        <span className="px-1">/</span>
        <span>{pack.name}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">{pack.name}</h1>
        <Link
          href={`/my-packs/${slug}/edit`}
          className="text-sm font-medium text-blue-700 underline"
        >
          Edit
        </Link>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Forked from v{existing.sourceVersion} · updated{" "}
        {new Date(existing.updatedAt).toLocaleString()}
      </p>
      <article
        className="prose prose-slate mt-6 max-w-none text-sm leading-6 text-slate-900"
        // renderMarkdown escapes first then emits only allow-listed tags.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
