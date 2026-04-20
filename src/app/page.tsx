import { PacksDirectory, type DirectorySearchParams } from "@/components/PacksDirectory";
import { TracesDirectorySnippet } from "@/components/TracesDirectorySnippet";
import { buildDirectoryData } from "@/app/directory-data";

/**
 * Home / directory landing.
 *
 * Server-first rendering pattern:
 *   `buildDirectoryData()` lives in `src/app/directory-data.ts` and
 *   touches `node:fs` transitively (install counts + consumers source).
 *   It returns a serializable snapshot — `Pack[]` + live counts — which
 *   we hand to the NOW-server `PacksDirectory`. Filter state is read
 *   from the `searchParams` prop (Next.js App Router) so the HTML that
 *   ships already reflects the narrowed view. No Suspense boundary is
 *   needed because the server component has no async data path.
 *
 * Why this matters:
 *   Fetch-based consumers (OG previewers, LLM agents, some crawlers)
 *   see the full directory — chip row, tag chips, filter sidebar, pack
 *   grid — in the initial SSR HTML, not a Suspense fallback.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = normalizeSearchParams(raw);

  const { packs, traceCount, publisherCount, allTagsByCount } =
    buildDirectoryData();

  return (
    <main className="app-shell">
      <div className="app-frame">
        <PacksDirectory
          packs={packs}
          traceCount={traceCount}
          publisherCount={publisherCount}
          allTagsByCount={allTagsByCount}
          searchParams={parsed}
        />
        <section className="mt-8">
          <TracesDirectorySnippet />
        </section>
      </div>
    </main>
  );
}

/**
 * Next.js hands each param as `string | string[] | undefined`. Collapse
 * to a single string (first value) so the server component receives a
 * flat, typed shape. Drops empty strings so they behave as "absent".
 */
function normalizeSearchParams(
  raw: Record<string, string | string[] | undefined>,
): DirectorySearchParams {
  function pick(key: string): string | undefined {
    const value = raw[key];
    const str = Array.isArray(value) ? value[0] : value;
    if (typeof str !== "string") return undefined;
    const trimmed = str.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return {
    q: pick("q"),
    tag: pick("tag"),
    type: pick("type"),
    pattern: pick("pattern"),
    trust: pick("trust"),
    publisher: pick("publisher"),
    sort: pick("sort"),
  };
}
