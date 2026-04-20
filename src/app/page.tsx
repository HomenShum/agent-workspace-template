import { Suspense } from "react";
import { PacksDirectory } from "@/components/PacksDirectory";
import { TracesDirectorySnippet } from "@/components/TracesDirectorySnippet";
import { buildDirectoryData } from "@/app/directory-data";

/**
 * Home / directory landing.
 *
 * Server-side hydration pattern:
 *   `buildDirectoryData()` lives in `src/app/directory-data.ts` and
 *   touches `node:fs` transitively (install counts + consumers source).
 *   It returns a serializable snapshot — `Pack[]` + live counts — which
 *   we hand to the client `PacksDirectory`. The client bundle never
 *   reaches into node:fs.
 */
export default function Home() {
  const { packs, traceCount, publisherCount, allTagsByCount } =
    buildDirectoryData();
  return (
    <main className="app-shell">
      <div className="app-frame">
        <Suspense fallback={<DirectoryFallback />}>
          <PacksDirectory
            packs={packs}
            traceCount={traceCount}
            publisherCount={publisherCount}
            allTagsByCount={allTagsByCount}
          />
        </Suspense>
        <section className="mt-8">
          <TracesDirectorySnippet />
        </section>
      </div>
    </main>
  );
}

function DirectoryFallback() {
  return (
    <section className="directory-header">
      <div className="directory-header-copy">
        <p className="section-label">Natural-language harness directory</p>
        <h1 className="directory-header-title">Agent Workspace</h1>
        <p className="directory-header-body">
          Loading the latest harness packs and shareable browse filters.
        </p>
      </div>
    </section>
  );
}
