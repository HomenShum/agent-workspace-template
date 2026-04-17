/**
 * /traces — server-render loading skeleton.
 *
 * Pure Tailwind; no client state needed. Mirrors the landing shell so
 * the layout doesn't shift when the real page resolves.
 */

export default function Loading() {
  return (
    <main className="app-shell">
      <div className="app-frame">
        <div className="space-y-8 animate-pulse">
          <div className="directory-header">
            <div className="directory-header-copy">
              <div className="h-3 w-48 rounded bg-slate-200" />
              <div className="mt-4 h-8 w-72 rounded bg-slate-200" />
              <div className="mt-4 h-4 w-full max-w-xl rounded bg-slate-200" />
            </div>
          </div>

          <div className="glass-panel px-6 py-6 sm:px-8">
            <div className="h-10 w-full rounded-[14px] bg-slate-100" />
            <div className="mt-4 flex flex-wrap gap-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-6 w-20 rounded-full bg-slate-100" />
              ))}
            </div>
          </div>

          <div className="glass-panel px-0 py-0">
            <div className="border-b border-[rgba(72,57,39,0.1)] px-6 py-4 sm:px-8">
              <div className="h-3 w-24 rounded bg-slate-200" />
            </div>
            <div className="divide-y divide-[rgba(72,57,39,0.08)]">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 px-6 py-4 sm:grid-cols-[180px_160px_60px_1fr_90px_80px] sm:items-center sm:px-8"
                >
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-4 w-24 rounded bg-slate-200" />
                  <div className="h-4 w-8 rounded bg-slate-200" />
                  <div className="h-4 w-full rounded bg-slate-200" />
                  <div className="h-4 w-8 rounded bg-slate-200" />
                  <div className="h-3 w-14 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
