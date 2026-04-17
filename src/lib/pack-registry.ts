/**
 * Unified pack registry.
 *
 * Merges the legacy `harnessPacks` (HarnessPack shape) with any
 * new packs under `src/lib/packs/*` (Pack shape) behind a single
 * accessor. Legacy packs are adapted on read; the source file
 * is never modified.
 *
 * Slug validation: strict `^[a-z0-9-]+$`, max 100 chars. This is
 * the single chokepoint that prevents path traversal / injection
 * in any route that calls `getPackBySlug`.
 *
 * E4 consumers hydration: `getAllPacks` / `getPackBySlug` attempt to
 * decorate each pack with its `consumers` list when running under a
 * server runtime. The file-reading code lives in `consumers-source.ts`
 * and is imported dynamically so that webpack client bundles (this
 * module is transitively imported from `PacksDirectory.tsx`) never pull
 * `node:fs` / `node:path` — that would break the client build.
 */

import type { ConsumerProject, Pack } from "@/lib/pack-schema";
import { harnessPacks, type HarnessPack } from "@/lib/harness-packs";
import { allSeededPacks } from "@/lib/packs";

function getSeededPacks(): Pack[] {
  return allSeededPacks;
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const SLUG_MAX_LEN = 100;

export function isValidSlug(slug: unknown): slug is string {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= SLUG_MAX_LEN &&
    SLUG_PATTERN.test(slug)
  );
}

/**
 * Server-only lazy loader for the consumers source. Guarded against the
 * client bundle: we check `typeof window` and indirect the require through
 * a non-static lookup so webpack does not statically resolve `node:fs`.
 *
 * Returns a map of slug -> ConsumerProject[] (possibly empty). Never throws.
 */
function loadConsumersMapServerOnly(): Record<string, ConsumerProject[]> {
  if (typeof window !== "undefined") return {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = (eval("require") as NodeRequire)("./consumers-source");
    const fn = (mod as { getAllConsumers?: () => Record<string, ConsumerProject[]> })
      .getAllConsumers;
    return typeof fn === "function" ? fn() : {};
  } catch {
    return {};
  }
}

/**
 * Adapt a legacy HarnessPack to the canonical Pack shape.
 * Defaults: harness packType, hybrid canonical pattern, version 0.1.0,
 * empty changelog/relationships/comparisons.
 */
function adaptHarnessPack(legacy: HarnessPack): Pack {
  return {
    // core identity
    slug: legacy.slug,
    name: legacy.name,
    tagline: legacy.tagline,
    summary: legacy.summary,
    packType: "harness",
    canonicalPattern: "hybrid",
    version: "0.1.0",

    // discovery / trust
    trust: legacy.trust,
    status: legacy.status,
    featured: legacy.featured,
    publisher: legacy.publisher,
    gradient: legacy.gradient,
    artworkVariant: legacy.slug,
    updatedAt: legacy.updatedAt,
    compatibility: legacy.compatibility,
    tags: legacy.tags,

    // install surfaces (derived — legacy packs predate these fields)
    installCommand: `npx attrition-sh pack install ${legacy.slug}`,
    claudeCodeSnippet: `# ${legacy.name}\n# See: /packs/${legacy.slug}\n`,
    rawMarkdownPath: `/packs/${legacy.slug}/raw`,

    // body content
    useWhen: legacy.useWhen,
    avoidWhen: legacy.avoidWhen,
    keyOutcomes: legacy.keyOutcomes,
    minimalInstructions: legacy.minimalInstructions,
    fullInstructions: legacy.fullInstructions,
    evaluationChecklist: legacy.evaluationChecklist,
    // Legacy packs stored failureModes as prose strings.
    // Adapter lifts them into structured shape with tier="mid" (unknown / unlabeled).
    // Real triage will re-tier when publishers re-auth their legacy packs.
    failureModes: (legacy.failureModes ?? []).map((text: string) => {
      const [symptomRaw, ...rest] = text.split(/:\s*/);
      const remainder = rest.join(": ");
      const mitigationMatch = remainder.match(/mitigation[^a-z0-9]*(.+)$/i);
      return {
        symptom: (symptomRaw || text).trim(),
        trigger: mitigationMatch
          ? remainder.slice(0, remainder.toLowerCase().indexOf("mitigation")).replace(/[.:;,\s]+$/, "").trim() || "(legacy — trigger not separated)"
          : remainder.trim() || "(legacy — trigger not separated)",
        preventionCheck: mitigationMatch?.[1]?.trim() || "(legacy — no explicit prevention)",
        tier: "mid" as const,
      };
    }),

    // relationships (none in legacy)
    relatedPacks: [],
    requires: [],
    conflictsWith: [],
    supersedes: [],
    comparesWith: [],

    // history
    changelog: [],

    // surface metrics carry over as-is
    metrics: legacy.metrics,

    // references
    sources: legacy.sources,
    examples: legacy.examples,
  };
}

/**
 * E4 — return ConsumerProject[] for a single pack. Server-only. Returns `[]`
 * when file missing, malformed, or called from a browser bundle.
 */
export function getConsumersForPack(slug: string): ConsumerProject[] {
  if (!isValidSlug(slug)) return [];
  const map = loadConsumersMapServerOnly();
  const list = map[slug];
  if (!Array.isArray(list) || list.length === 0) return [];
  return list;
}

/**
 * Return the full merged pack catalog. Seeded (new-shape) packs take
 * precedence over legacy packs if slugs collide.
 *
 * When called from a server context, each pack has `consumers` hydrated
 * inline from the file-backed source. When no data exists for a slug, the
 * field stays `undefined` — NOT `[]` — so the page can distinguish
 * "no data source" from "zero consumers" (honest status rule).
 */
export function getAllPacks(): Pack[] {
  const seeded = getSeededPacks();
  const seededSlugs = new Set(seeded.map((p) => p.slug));
  const legacyAdapted = harnessPacks
    .filter((p) => !seededSlugs.has(p.slug))
    .map(adaptHarnessPack);
  const all = [...seeded, ...legacyAdapted];
  const map = loadConsumersMapServerOnly();
  return all.map((p) => {
    const consumers = map[p.slug];
    if (!Array.isArray(consumers) || consumers.length === 0) return p;
    return { ...p, consumers };
  });
}

/**
 * Look up a pack by slug. Returns null for invalid slugs or misses.
 * Never throws. Hydrates `consumers` inline (same policy as getAllPacks).
 */
export function getPackBySlug(slug: string): Pack | null {
  if (!isValidSlug(slug)) return null;
  const all = getAllPacks();
  return all.find((p) => p.slug === slug) ?? null;
}

/**
 * Test helper — reset the in-memory consumers cache so a fresh file state
 * is loaded on the next lookup. Forwards to consumers-source when the
 * server-only module is available.
 */
export function __resetConsumersCacheForTests(): void {
  if (typeof window !== "undefined") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = (eval("require") as NodeRequire)("./consumers-source");
    const fn = (mod as { __resetConsumersCacheForTests?: () => void })
      .__resetConsumersCacheForTests;
    if (typeof fn === "function") fn();
  } catch {
    /* swallow — tests will use file path directly */
  }
}
