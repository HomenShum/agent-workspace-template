/**
 * E4 — consumers reverse index: server-only file-backed source.
 *
 * Separated from `pack-registry.ts` because `pack-registry` is imported by
 * client components (directory listing). The `node:fs` / `node:path` imports
 * below must never end up in a client bundle — webpack refuses `node:` URI
 * schemes in the browser build. Any consumer of this module must be a
 * server component or a route handler.
 *
 * File format: `.attrition/consumers.json` at repo root, shape
 *   Record<slug, ConsumerProject[]>
 *
 * Safe-parse at load; malformed JSON yields an empty map and every lookup
 * returns []. Writes are not supported here — the source is populated by
 * aggregation jobs / Convex functions / test fixtures.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ConsumerProject } from "@/lib/pack-schema";

// Per-pack consumer cap for card render. Bounds payload when the source grows.
export const CONSUMERS_RENDER_CAP = 20;

type ConsumersFile = Record<string, ConsumerProject[]>;

let consumersCache: ConsumersFile | null = null;
let consumersWarned = false;

function consumersFilePath(): string {
  return resolve(process.cwd(), ".attrition", "consumers.json");
}

function isValidSlug(slug: string): boolean {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= 100 &&
    /^[a-z0-9-]+$/.test(slug)
  );
}

function isValidConsumer(x: unknown): x is ConsumerProject {
  if (!x || typeof x !== "object") return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c.projectId === "string" &&
    c.projectId.length > 0 &&
    typeof c.project === "string" &&
    typeof c.version === "string" &&
    typeof c.installedAt === "string" &&
    (c.target === "claude-code" || c.target === "cursor")
  );
}

function loadFromDisk(): ConsumersFile {
  const file = consumersFilePath();
  if (!existsSync(file)) return {};
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      if (!consumersWarned) {
        consumersWarned = true;
        console.warn(
          `[consumers-source] malformed root in ${file} — returning empty map`,
        );
      }
      return {};
    }
    const clean: ConsumersFile = {};
    for (const [slug, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isValidSlug(slug)) continue;
      if (!Array.isArray(list)) continue;
      const filtered = list.filter(isValidConsumer);
      if (filtered.length > 0) clean[slug] = filtered;
    }
    return clean;
  } catch (err) {
    if (!consumersWarned) {
      consumersWarned = true;
      console.warn(
        `[consumers-source] failed to parse ${file}: ${(err as Error).message} — returning empty map`,
      );
    }
    return {};
  }
}

function ensureCache(): ConsumersFile {
  if (consumersCache === null) {
    consumersCache = loadFromDisk();
  }
  return consumersCache;
}

/**
 * Return ConsumerProject[] for one pack. Never throws. Capped at
 * CONSUMERS_RENDER_CAP. Returns [] when file missing or malformed.
 */
export function getConsumersForPack(slug: string): ConsumerProject[] {
  if (!isValidSlug(slug)) return [];
  const map = ensureCache();
  const list = map[slug];
  if (!Array.isArray(list) || list.length === 0) return [];
  return list.slice(0, CONSUMERS_RENDER_CAP);
}

/**
 * Return the full hydrated map keyed by slug. Server-only. Used by
 * `pack-registry.getAllPacks` when it is known to be called from a
 * server context (e.g. generateStaticParams, page.tsx).
 */
export function getAllConsumers(): ConsumersFile {
  // Return a copy — callers must not mutate the cache.
  const map = ensureCache();
  const out: ConsumersFile = {};
  for (const [slug, list] of Object.entries(map)) {
    out[slug] = list.slice(0, CONSUMERS_RENDER_CAP);
  }
  return out;
}

/** Test helper — resets the in-memory cache. */
export function __resetConsumersCacheForTests(): void {
  consumersCache = null;
  consumersWarned = false;
}
