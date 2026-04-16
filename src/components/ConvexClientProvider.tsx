"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return null;
    return new ConvexReactClient(url);
  }, []);

  if (!convex) {
    return (
      <div className="app-shell flex items-center justify-center px-4">
        <div className="glass-panel max-w-md p-8 text-center">
          <p className="section-label">Backend Connection Missing</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900">Convex is not configured.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Start the backend locally, then point `NEXT_PUBLIC_CONVEX_URL` at the running
            deployment.
          </p>
          <code className="mt-5 block rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            npx convex dev
          </code>
        </div>
      </div>
    );
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
