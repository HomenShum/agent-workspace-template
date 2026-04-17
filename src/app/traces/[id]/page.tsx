/**
 * /traces/[id] — change-trace detail page.
 *
 * Server component. Reads `getTraceById(params.id)`; delegates id
 * validation to the registry (`isValidTraceId` is the chokepoint).
 * 404 on any miss, including invalid shapes.
 *
 * See docs/CHANGE_TRACE.md §7.2 for the ASCII mock this UI mirrors.
 */

import { notFound } from "next/navigation";
import { getAllTraces, getTraceById } from "@/lib/trace-registry";
import {
  CrossReferences,
  RowTable,
  TraceHeader,
} from "./page-sections";

export function generateStaticParams() {
  return getAllTraces().map((t) => ({ id: t.id }));
}

export default async function TraceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trace = getTraceById(id);
  if (!trace) {
    notFound();
  }

  // Derive stats used in the header strip. Symbols are de-duped across
  // all rows; files are unique across filesTouched + changes[].path.
  const fileSet = new Set<string>();
  const symbolSet = new Set<string>();
  for (const row of trace.rows) {
    for (const f of row.filesTouched) fileSet.add(f);
    for (const c of row.changes) {
      fileSet.add(c.path);
      for (const s of c.symbolsAdded) symbolSet.add(s);
      for (const s of c.symbolsRemoved) symbolSet.add(s);
      for (const r of c.symbolsRenamed) {
        symbolSet.add(r.from);
        symbolSet.add(r.to);
      }
    }
  }

  const stats = {
    rows: trace.rows.length,
    files: fileSet.size,
    symbols: symbolSet.size,
  };

  // The raw-MD route shipped by M7a lives under /traces/[id]/raw.
  // If that route isn't live yet, the anchor still renders — clicking
  // it surfaces the 404 rather than crashing the page.
  const rawPath = `/traces/${trace.id}/raw`;

  return (
    <main className="app-shell">
      <div className="app-frame">
        <div className="space-y-8">
          <TraceHeader trace={trace} rawPath={rawPath} stats={stats} />
          <RowTable rows={trace.rows} />
          <CrossReferences trace={trace} />
        </div>
      </div>
    </main>
  );
}
