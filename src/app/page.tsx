import { Suspense } from "react";
import { PacksDirectory } from "@/components/PacksDirectory";
import { TracesDirectorySnippet } from "@/components/TracesDirectorySnippet";
import { harnessPacks } from "@/lib/harness-packs";
import { getAllInstallCounts } from "@/lib/install-counts";
import { getPackBySlug } from "@/lib/pack-registry";
import type { Pack } from "@/lib/pack-schema";

/**
 * Server-side hydration for the client PacksDirectory.
 *
 * Both `getAllInstallCounts` and `getPackBySlug` touch node:fs, so they
 * must run on the server. We join each legacy HarnessPack to its canonical
 * Pack and stamp the current install count, producing a slug->Pack map
 * that is passed to the client as a plain prop (serializable JSON).
 */
function buildHydratedBySlug(): Record<string, Pack> {
  const counts = getAllInstallCounts();
  const out: Record<string, Pack> = {};
  for (const legacy of harnessPacks) {
    const canonical = getPackBySlug(legacy.slug);
    if (!canonical) continue;
    out[legacy.slug] = {
      ...canonical,
      installCount: counts[legacy.slug] ?? 0,
    };
  }
  return out;
}

export default function Home() {
  const hydratedBySlug = buildHydratedBySlug();
  return (
    <main className="app-shell">
      <div className="app-frame">
        <Suspense fallback={<DirectoryFallback />}>
          <PacksDirectory
            packs={harnessPacks}
            hydratedBySlug={hydratedBySlug}
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
