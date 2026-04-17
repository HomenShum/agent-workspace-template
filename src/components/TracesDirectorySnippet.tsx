/**
 * TracesDirectorySnippet — compact card embedded on the landing page.
 *
 * Server component. Renders the 3 most recent traces + a link to the
 * full /traces directory. Used to cross-link Pillar 1 (packs) with
 * Pillar 2 (traces) on the root landing.
 *
 * If the trace registry is empty (e.g. brand-new fork), the snippet
 * renders a short "start your first trace" nudge instead of an
 * empty section — so the landing page still has visual weight.
 */

import Link from "next/link";
import { getAllTraces } from "@/lib/trace-registry";

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
}

export function TracesDirectorySnippet() {
  const all = getAllTraces();
  const recent = all.slice(0, 3);

  return (
    <section className="glass-panel px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-label">Recent change traces · Cross-linked to packs</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
            What changed, and why
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Every coding session captured as rows — Scenario / Files / Changes / Why.
            Ctrl+F your own history.
          </p>
        </div>
        <Link href="/traces" className="directory-link-button">
          <span>View all traces</span>
          <span aria-hidden="true">Open</span>
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="mt-5 rounded-[14px] border border-dashed border-[rgba(72,57,39,0.2)] bg-white px-4 py-6 text-sm text-slate-600">
          No traces yet. Start your first one with{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-800">
            attrition trace log
          </code>
          .
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-[rgba(72,57,39,0.08)] overflow-hidden rounded-[14px] border border-[rgba(72,57,39,0.1)]">
          {recent.map((trace) => {
            const head = trace.rows[0]?.scenario ?? "(stub trace — no rows yet)";
            return (
              <li key={trace.id}>
                <Link
                  href={`/traces/${trace.id}`}
                  className="flex flex-wrap items-center gap-3 bg-white px-4 py-3 transition-colors hover:bg-slate-50"
                >
                  <span className="font-mono text-[13px] font-semibold text-slate-950">
                    {trace.id}
                  </span>
                  <span className="text-xs text-slate-500">{shortDate(trace.createdAt)}</span>
                  <span className="text-xs text-slate-500">
                    {trace.rows.length} rows · {trace.packsReferenced.length} packs
                  </span>
                  <span className="min-w-[200px] flex-1 text-sm text-slate-700">
                    {truncate(head, 110)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
