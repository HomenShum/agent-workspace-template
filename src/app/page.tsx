import { Suspense } from "react";
import { PacksDirectory } from "@/components/PacksDirectory";
import { harnessPacks } from "@/lib/harness-packs";

export default function Home() {
  return (
    <main className="app-shell">
      <div className="app-frame">
        <Suspense fallback={<DirectoryFallback />}>
          <PacksDirectory packs={harnessPacks} />
        </Suspense>
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
