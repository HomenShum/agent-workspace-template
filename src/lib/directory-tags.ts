/**
 * Client-safe helpers + shared types for the directory tag-chip row.
 *
 * This module is the ONLY shared surface between the server-only
 * `src/app/directory-data.ts` (which touches node:fs transitively) and
 * the client `"use client"` component `PacksDirectory.tsx`. It imports
 * nothing from node or from `pack-registry`, so webpack can bundle it
 * into the client without pulling `node:fs`.
 */

// Pin. Always present in the tag-chip row when any pack carries this tag,
// regardless of rank. See `pickTagChipSet` and `directory-data.ts`.
export const PINNED_TAG = "dive-into-claude-code";

// Tag-chip row cap (spec: "top ~8 most-common tags … + pinned chip").
export const TAG_CHIP_ROW_MAX = 8;

export type TagCount = { tag: string; count: number };

/**
 * Pure render helper. Callers pass the pre-sorted-by-count tag frequency
 * table computed on the server.
 *
 * Rules:
 *  1. Take the top `limit` tags by count.
 *  2. If `PINNED_TAG` is present in `allTagsByCount` but missing from the
 *     slice, append it (so the chip stays visible even when the chart of
 *     the catalog shifts).
 *  3. Never invent a count — if the pinned tag has zero entries (no pack
 *     carries it), it is omitted entirely. Honest status.
 */
export function pickTagChipSet(
  allTagsByCount: TagCount[],
  limit: number = TAG_CHIP_ROW_MAX,
): TagCount[] {
  const top = allTagsByCount.slice(0, limit);
  const pinned = allTagsByCount.find((entry) => entry.tag === PINNED_TAG);
  if (pinned && !top.some((entry) => entry.tag === PINNED_TAG)) {
    top.push(pinned);
  }
  return top;
}
