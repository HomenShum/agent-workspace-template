/**
 * File-backed install counter for pack catalog.
 *
 * Persistence: `.attrition/install-counts.json` at repo root, shape
 * `Record<slug, number>`. Safe-parse at module load; malformed JSON yields
 * an empty map and every lookup returns 0 (never throws).
 *
 * Writes use tmp + atomic rename to avoid partial-write corruption if the
 * process is killed mid-flush.
 *
 * Bounded: PER_SLUG_CAP is enforced on increment. If a slug hits the cap,
 * subsequent increments log once and become no-ops. This keeps the JSON
 * file bounded at `O(number_of_packs * max_int_digits)` bytes. Matches the
 * agentic-reliability rule: every counter must declare a cap.
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";

// Documented cap. Once any single slug reaches this, further increments are
// dropped with a single-time log line. 1M is comfortably beyond any realistic
// install volume for this catalog and below JS safe-int territory.
export const PER_SLUG_CAP = 1_000_000;

// Resolve against cwd so it works identically in dev, build, and scripts.
// In Next.js the server and CLI both run from repo root.
const COUNTS_FILE = resolve(process.cwd(), ".attrition", "install-counts.json");

type CountsMap = Record<string, number>;

// In-memory cache — hydrated on first access. Writes update both.
let cache: CountsMap | null = null;
let warnedMalformed = false;
const cappedWarned = new Set<string>();

function loadFromDisk(): CountsMap {
  if (!existsSync(COUNTS_FILE)) {
    return {};
  }
  try {
    const raw = readFileSync(COUNTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      if (!warnedMalformed) {
        warnedMalformed = true;
        console.warn(
          `[install-counts] malformed root in ${COUNTS_FILE} — expected object, returning empty map`,
        );
      }
      return {};
    }
    // Defensive: coerce each entry to a safe integer, drop anything else.
    const clean: CountsMap = {};
    for (const [slug, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof slug !== "string" || slug.length === 0) continue;
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
      // Apply cap at load time so tampered files can't explode downstream math.
      clean[slug] = Math.min(Math.floor(value), PER_SLUG_CAP);
    }
    return clean;
  } catch (err) {
    if (!warnedMalformed) {
      warnedMalformed = true;
      console.warn(
        `[install-counts] failed to parse ${COUNTS_FILE}: ${(err as Error).message} — returning empty map`,
      );
    }
    return {};
  }
}

function ensureCache(): CountsMap {
  if (cache === null) {
    cache = loadFromDisk();
  }
  return cache;
}

function flushToDisk(map: CountsMap): void {
  try {
    const dir = dirname(COUNTS_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    // tmp + rename. randomBytes suffix avoids collision if two concurrent
    // writers land in the same ms.
    const tmp = join(
      dir,
      `install-counts.${Date.now()}.${randomBytes(4).toString("hex")}.tmp`,
    );
    writeFileSync(tmp, JSON.stringify(map, null, 2), { encoding: "utf8" });
    renameSync(tmp, COUNTS_FILE);
  } catch (err) {
    console.warn(
      `[install-counts] failed to persist: ${(err as Error).message}`,
    );
  }
}

/**
 * Read a single slug's install count. Never throws.
 * Returns 0 for unknown slugs, malformed files, missing files.
 */
export function getInstallCount(slug: string): number {
  if (typeof slug !== "string" || slug.length === 0) return 0;
  const map = ensureCache();
  const value = map[slug];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.floor(value), PER_SLUG_CAP);
}

/**
 * Read all install counts. Useful for batch-joining against the registry
 * before server-rendering the directory. Returns a copy — callers cannot
 * mutate the cache.
 */
export function getAllInstallCounts(): CountsMap {
  return { ...ensureCache() };
}

/**
 * Increment a slug's count by 1 and persist.
 * No-op at the cap (logs once per slug on hit).
 */
export function incrementInstallCount(slug: string): number {
  if (typeof slug !== "string" || slug.length === 0) return 0;
  const map = ensureCache();
  const current = getInstallCount(slug);
  if (current >= PER_SLUG_CAP) {
    if (!cappedWarned.has(slug)) {
      cappedWarned.add(slug);
      console.warn(
        `[install-counts] slug "${slug}" reached PER_SLUG_CAP=${PER_SLUG_CAP}; further increments dropped`,
      );
    }
    return PER_SLUG_CAP;
  }
  const next = current + 1;
  map[slug] = next;
  flushToDisk(map);
  return next;
}

/**
 * Test helper — resets the in-memory cache so a new disk state can be loaded.
 * Safe to call from scripts; the production UI does not invoke this.
 */
export function __resetInstallCountsCacheForTests(): void {
  cache = null;
  warnedMalformed = false;
  cappedWarned.clear();
}
