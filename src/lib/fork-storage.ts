/**
 * Fork-to-workspace: file-backed fallback storage for per-operator pack forks.
 *
 * Mirrors the Convex `userPackForks` table shape. Activates when Convex is
 * not configured / reachable — matches the install-counts + consumers-source
 * pattern used elsewhere in this repo.
 *
 * Layout:
 *   .attrition/forks/<operatorSessionId>/<slug>.md     — the body
 *   .attrition/forks/<operatorSessionId>/<slug>.meta.json — sourceVersion, timestamps
 *
 * Hygiene:
 *   - operatorSessionId must match /^[a-zA-Z0-9_\-:.]+$/ and be <= 200 chars.
 *   - slug must match /^[a-z0-9-]+$/ and be <= 100 chars.
 *   - Markdown bounded at 100kB. Larger payloads return {error:"FORK_TOO_LARGE"}.
 *   - Writes use tmp + atomic rename to survive mid-flush process death.
 *   - Never throws on miss. Returns null / [].
 *
 * Server-only (node:fs). Do NOT import from a client component.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";

// --- caps (must stay aligned with convex/userPackForks.ts) ---
export const FORK_MAX_MARKDOWN_BYTES = 100 * 1024;
export const FORK_PER_SESSION_CAP = 200;

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const SLUG_MAX_LEN = 100;
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_\-:.]+$/;
const SESSION_ID_MAX_LEN = 200;

export type ForkRecord = {
  slug: string;
  markdown: string;
  sourceVersion: string;
  createdAt: number;
  updatedAt: number;
};

export type ForkSummary = {
  slug: string;
  sourceVersion: string;
  createdAt: number;
  updatedAt: number;
};

export type ForkWriteError =
  | "INVALID_SESSION_ID"
  | "INVALID_SLUG"
  | "INVALID_MARKDOWN"
  | "INVALID_SOURCE_VERSION"
  | "FORK_TOO_LARGE"
  | "PER_SESSION_FORK_CAP_REACHED"
  | "WRITE_FAILED";

export function isValidForkSlug(slug: unknown): slug is string {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= SLUG_MAX_LEN &&
    SLUG_PATTERN.test(slug)
  );
}

export function isValidSessionId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  if (id.length === 0 || id.length > SESSION_ID_MAX_LEN) return false;
  if (id === "." || id === "..") return false;
  if (id.includes("/") || id.includes("\\") || id.includes("\0")) return false;
  return SESSION_ID_PATTERN.test(id);
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function forksRoot(): string {
  return resolve(process.cwd(), ".attrition", "forks");
}

function sessionDir(sessionId: string): string {
  // sessionId already validated by the caller — resolve defensively anyway.
  return join(forksRoot(), sessionId);
}

function mdPath(sessionId: string, slug: string): string {
  return join(sessionDir(sessionId), `${slug}.md`);
}

function metaPath(sessionId: string, slug: string): string {
  return join(sessionDir(sessionId), `${slug}.meta.json`);
}

function atomicWrite(target: string, data: string): void {
  const dir = dirname(target);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${Date.now()}.${randomBytes(4).toString("hex")}.tmp`);
  writeFileSync(tmp, data, { encoding: "utf8" });
  renameSync(tmp, target);
}

/**
 * Read a fork record. Returns null on miss, malformed files, or any validation
 * failure. Never throws.
 */
export function getFork(sessionId: string, slug: string): ForkRecord | null {
  if (!isValidSessionId(sessionId)) return null;
  if (!isValidForkSlug(slug)) return null;
  const md = mdPath(sessionId, slug);
  const meta = metaPath(sessionId, slug);
  if (!existsSync(md) || !existsSync(meta)) return null;
  try {
    const markdown = readFileSync(md, "utf8");
    const metaRaw = JSON.parse(readFileSync(meta, "utf8")) as {
      sourceVersion?: unknown;
      createdAt?: unknown;
      updatedAt?: unknown;
    };
    const sourceVersion =
      typeof metaRaw.sourceVersion === "string" ? metaRaw.sourceVersion : "unknown";
    const createdAt =
      typeof metaRaw.createdAt === "number" && Number.isFinite(metaRaw.createdAt)
        ? metaRaw.createdAt
        : 0;
    const updatedAt =
      typeof metaRaw.updatedAt === "number" && Number.isFinite(metaRaw.updatedAt)
        ? metaRaw.updatedAt
        : createdAt;
    return { slug, markdown, sourceVersion, createdAt, updatedAt };
  } catch {
    return null;
  }
}

/**
 * Persist a fork. Returns {ok:true,record} on success, or {ok:false,error} on
 * any validation / write failure. Never throws — callers must inspect the tag.
 */
export function saveFork(
  sessionId: string,
  slug: string,
  markdown: string,
  sourceVersion: string,
):
  | { ok: true; record: ForkRecord; created: boolean }
  | { ok: false; error: ForkWriteError; detail?: string } {
  if (!isValidSessionId(sessionId)) return { ok: false, error: "INVALID_SESSION_ID" };
  if (!isValidForkSlug(slug)) return { ok: false, error: "INVALID_SLUG" };
  if (typeof markdown !== "string") return { ok: false, error: "INVALID_MARKDOWN" };
  if (byteLength(markdown) > FORK_MAX_MARKDOWN_BYTES) {
    return { ok: false, error: "FORK_TOO_LARGE" };
  }
  if (
    typeof sourceVersion !== "string" ||
    sourceVersion.length === 0 ||
    sourceVersion.length > 64
  ) {
    return { ok: false, error: "INVALID_SOURCE_VERSION" };
  }

  const existing = getFork(sessionId, slug);
  if (!existing) {
    // Enforce per-session cap only on new inserts. Updates to an existing fork
    // are always allowed.
    const current = listForksForSession(sessionId);
    if (current.length >= FORK_PER_SESSION_CAP) {
      return { ok: false, error: "PER_SESSION_FORK_CAP_REACHED" };
    }
  }

  const now = Date.now();
  const created = existing ? false : true;
  const createdAt = existing ? existing.createdAt : now;
  const record: ForkRecord = {
    slug,
    markdown,
    sourceVersion,
    createdAt,
    updatedAt: now,
  };

  try {
    atomicWrite(mdPath(sessionId, slug), markdown);
    atomicWrite(
      metaPath(sessionId, slug),
      JSON.stringify(
        { sourceVersion, createdAt, updatedAt: now },
        null,
        2,
      ),
    );
    return { ok: true, record, created };
  } catch (err) {
    return { ok: false, error: "WRITE_FAILED", detail: (err as Error).message };
  }
}

/**
 * Remove a fork. Returns {deleted:true|false}. No-op on miss, never throws
 * on miss. Returns {ok:false} only if validation rejects the inputs.
 */
export function deleteFork(
  sessionId: string,
  slug: string,
):
  | { ok: true; deleted: boolean }
  | { ok: false; error: "INVALID_SESSION_ID" | "INVALID_SLUG" | "WRITE_FAILED"; detail?: string } {
  if (!isValidSessionId(sessionId)) return { ok: false, error: "INVALID_SESSION_ID" };
  if (!isValidForkSlug(slug)) return { ok: false, error: "INVALID_SLUG" };
  const md = mdPath(sessionId, slug);
  const meta = metaPath(sessionId, slug);
  const hadMd = existsSync(md);
  const hadMeta = existsSync(meta);
  if (!hadMd && !hadMeta) return { ok: true, deleted: false };
  try {
    if (hadMd) rmSync(md, { force: true });
    if (hadMeta) rmSync(meta, { force: true });
    return { ok: true, deleted: true };
  } catch (err) {
    return { ok: false, error: "WRITE_FAILED", detail: (err as Error).message };
  }
}

/**
 * List fork summaries for one session. Never throws. Returns [] on bad
 * session id, missing dir, or read errors. Capped at FORK_PER_SESSION_CAP.
 */
export function listForksForSession(sessionId: string): ForkSummary[] {
  if (!isValidSessionId(sessionId)) return [];
  const dir = sessionDir(sessionId);
  if (!existsSync(dir)) return [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out: ForkSummary[] = [];
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    const slug = name.slice(0, -3);
    if (!isValidForkSlug(slug)) continue;
    const rec = getFork(sessionId, slug);
    if (!rec) {
      // Metadata missing — synthesize from mtime so the row is still listable
      // and the operator can delete it from the UI.
      try {
        const st = statSync(mdPath(sessionId, slug));
        out.push({
          slug,
          sourceVersion: "unknown",
          createdAt: st.mtimeMs,
          updatedAt: st.mtimeMs,
        });
      } catch {
        // ignore
      }
      continue;
    }
    out.push({
      slug: rec.slug,
      sourceVersion: rec.sourceVersion,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
    });
    if (out.length >= FORK_PER_SESSION_CAP) break;
  }
  // Stable order: most-recently-updated first.
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}

/**
 * Test / script helper — delete an entire session's fork directory.
 * Safe on miss. Validates session id. Used by verify-fork-flow.ts.
 */
export function __purgeSessionForTests(sessionId: string): void {
  if (!isValidSessionId(sessionId)) return;
  const dir = sessionDir(sessionId);
  if (!existsSync(dir)) return;
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // swallow — test-only helper
  }
}
