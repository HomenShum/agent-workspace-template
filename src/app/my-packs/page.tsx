/**
 * /my-packs — list of the current operator's forked packs.
 *
 * Server component. Reads the operator session from the cookie that
 * OperatorSessionProvider mirrors. If absent, shows the sign-in nudge.
 * Otherwise lists file-backed forks for that session.
 */

import Link from "next/link";
import { getOperatorSessionId } from "@/lib/fork-session";
import { listForksForSession } from "@/lib/fork-storage";
import { getPackBySlug } from "@/lib/pack-registry";

export const dynamic = "force-dynamic";

export default async function MyPacksPage() {
  const sessionId = await getOperatorSessionId();

  if (!sessionId) {
    return (
      <main className="directory-page mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">My packs</h1>
        <p className="mt-3 text-sm text-slate-600">
          Sign in to your operator session to fork packs into your workspace.
        </p>
        <p className="mt-6">
          <Link href="/" className="text-sm font-medium text-blue-700 underline">
            Back to the catalog
          </Link>
        </p>
      </main>
    );
  }

  const forks = listForksForSession(sessionId);

  return (
    <main className="directory-page mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">My packs</h1>
        <span className="text-xs text-slate-500">
          Session <code className="font-mono">{sessionId}</code>
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Your forked copies of catalog packs. Edits are scoped to this session.
      </p>

      {forks.length === 0 ? (
        <section className="mt-8 rounded-md border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-slate-700">
            You haven&apos;t forked any packs yet.
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Open a pack and click{" "}
            <span className="font-medium text-slate-900">Fork to workspace</span>.
          </p>
          <p className="mt-4">
            <Link href="/" className="text-sm font-medium text-blue-700 underline">
              Browse the catalog
            </Link>
          </p>
        </section>
      ) : (
        <ul className="mt-6 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {forks.map((f) => {
            const pack = getPackBySlug(f.slug);
            return (
              <li key={f.slug} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {pack?.name ?? f.slug}
                  </div>
                  <div className="text-xs text-slate-500">
                    <code className="font-mono">{f.slug}</code> · based on v
                    {f.sourceVersion} · updated{" "}
                    {new Date(f.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  <Link
                    href={`/my-packs/${f.slug}/edit`}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-800"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/my-packs/${f.slug}/view`}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-800"
                  >
                    View
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
