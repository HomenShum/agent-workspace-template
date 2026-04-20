/**
 * Server-side data builder for the directory landing page.
 *
 * This module touches `node:fs` transitively (via `getAllInstallCounts`
 * and the file-backed consumers source loaded by `pack-registry`). It MUST
 * be imported only from server components — never from a `"use client"`
 * module. `PacksDirectory` receives the resulting `DirectoryData` as a
 * plain serializable prop so the client bundle never pulls `node:fs`.
 *
 * Tag-chip pure helpers (`PINNED_TAG`, `TAG_CHIP_ROW_MAX`, `pickTagChipSet`,
 * and the `TagCount` type) live in `@/lib/directory-tags` — a deliberately
 * node-free module that both this file and the client component consume.
 * Keeping the split clean is what lets webpack bundle PacksDirectory
 * without dragging `node:fs` into the client.
 *
 * Returned shape:
 *   - `packs`              canonical `Pack[]`, every seeded + adapted legacy
 *                          entry, with live `installCount` hydrated.
 *   - `traceCount`         registry-seeded change traces.
 *   - `publisherCount`     distinct publisher names in the merged catalog.
 *   - `allTagsByCount`     tags sorted by frequency (desc). Ties broken
 *                          alphabetically so the output is deterministic.
 */

import { getAllPacks } from "@/lib/pack-registry";
import { getAllInstallCounts } from "@/lib/install-counts";
import { getAllTraces } from "@/lib/trace-registry";
import type { Pack } from "@/lib/pack-schema";
import type { TagCount } from "@/lib/directory-tags";

export type { TagCount } from "@/lib/directory-tags";
export { PINNED_TAG, TAG_CHIP_ROW_MAX, pickTagChipSet } from "@/lib/directory-tags";

export type DirectoryData = {
  packs: Pack[];
  traceCount: number;
  publisherCount: number;
  allTagsByCount: TagCount[];
};

/**
 * Merge install counts onto each Pack. Packs never self-report installCount;
 * the registry does — joining here keeps every pack consistent with the file-
 * backed counter.
 */
function hydrateInstallCounts(packs: Pack[]): Pack[] {
  const counts = getAllInstallCounts();
  return packs.map((pack) => ({
    ...pack,
    installCount: counts[pack.slug] ?? pack.installCount ?? 0,
  }));
}

/**
 * Count every tag across every pack. Ties broken alphabetically so the
 * output is deterministic (matters for the snapshot assertions in
 * `scripts/verify-directory-live.ts`).
 */
function computeTagCounts(packs: Pack[]): TagCount[] {
  const map = new Map<string, number>();
  for (const pack of packs) {
    for (const tag of pack.tags) {
      if (typeof tag !== "string" || tag.length === 0) continue;
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.tag.localeCompare(right.tag);
    });
}

/**
 * Build the full hydration payload for the directory landing. Safe to call
 * once per request from a server component.
 */
export function buildDirectoryData(): DirectoryData {
  const packs = hydrateInstallCounts(getAllPacks());
  const publishers = new Set(packs.map((p) => p.publisher));
  const traceCount = getAllTraces().length;
  const allTagsByCount = computeTagCounts(packs);

  return {
    packs,
    traceCount,
    publisherCount: publishers.size,
    allTagsByCount,
  };
}
