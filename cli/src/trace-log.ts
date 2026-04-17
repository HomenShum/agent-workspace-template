/**
 * Manual-capture flow for change-trace rows (Pillar 2, M7b).
 *
 * Local-first: rows are persisted to `.attrition/traces/<traceId>.json` atomically
 * BEFORE any network call. The registry POST is fire-and-forget with a 3s timeout.
 * Local copy is source of truth.
 *
 * Why not block on network:
 *   - Traces are high-frequency, low-stakes captures. A slow/offline registry must
 *     not stall the user.
 *   - Registry ingestion is best-effort; sync is a background concern.
 *
 * Concurrency model:
 *   - Atomic tmp+rename ensures no partial files.
 *   - Concurrent appends against the same traceId are serialized by a lock file
 *     (`.attrition/traces/<traceId>.lock`). If the lock cannot be acquired within
 *     the retry budget, we fall back to writing a per-invocation shard
 *     (`<traceId>.shard.<ts>.<rand>.json`); `readTraceLocal` merges shards at read
 *     time. This keeps writes non-blocking under contention without losing rows.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { RegistryClient, DEFAULT_REGISTRY, type RegistryClientLike } from "./registry.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WhyExplanation = {
  plain: string;
  analogy: string;
  principle: string;
  hook: string;
};

export type ChangeDetail = {
  path: string;
  symbolsAdded: string[];
  symbolsRenamed: Array<{ from: string; to: string }>;
  symbolsRemoved: string[];
  diffSummary: string;
};

export type ChangeRow = {
  scenario: string;
  filesTouched: string[];
  changes: ChangeDetail[];
  why: WhyExplanation;
  createdAt?: string;
};

export type ChangeTrace = {
  id: string;
  project: string;
  createdAt: string;
  rows: ChangeRow[];
  tags?: string[];
  packsReferenced?: string[];
};

export type LogRowInput = {
  scenario: string;
  filesTouched?: string[];
  diffSummary: string;
  why: WhyExplanation;
};

export type LogRowOptions = {
  cwd: string;
  traceId?: string;
  project?: string;
  registry?: string;
  dryRun?: boolean;
  row: LogRowInput;
  /** Injected client for tests. */
  client?: RegistryClientLike;
  /** Clock injection for deterministic tests. */
  now?: () => Date;
  /** stderr sink for warnings (tests capture). */
  warn?: (msg: string) => void;
};

export type LogRowResult = {
  traceId: string;
  rowIndex: number;
  path: string;
  synced: boolean;
  syncError?: string;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const TRACE_ID_RE = /^ct_[0-9]{4}-[0-9]{2}-[0-9]{2}(_[a-z0-9-]+)?$/;
export const MAX_TRACE_ID_LEN = 80;
export const MAX_ROW_BYTES = 10_000;

// Word limits per §4 of CHANGE_TRACE.md.
export const WORD_LIMITS: Record<keyof WhyExplanation, number> = {
  plain: 15,
  analogy: 20,
  principle: 20,
  hook: 6,
};

export class TraceLogError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "TraceLogError";
  }
}

export function validateTraceId(id: string): void {
  if (typeof id !== "string" || id.length === 0) {
    throw new TraceLogError("INVALID_TRACE_ID", "traceId is required");
  }
  if (id.length > MAX_TRACE_ID_LEN) {
    throw new TraceLogError(
      "INVALID_TRACE_ID",
      `traceId exceeds ${MAX_TRACE_ID_LEN} chars`
    );
  }
  if (!TRACE_ID_RE.test(id)) {
    throw new TraceLogError(
      "INVALID_TRACE_ID",
      `Invalid traceId "${id}". Expected ct_YYYY-MM-DD[_slug]`
    );
  }
  // Belt-and-suspenders path traversal guard.
  if (id.includes("..") || id.includes("/") || id.includes("\\")) {
    throw new TraceLogError("INVALID_TRACE_ID", "traceId contains forbidden path characters");
  }
}

export function countWords(s: string): number {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function checkWordLimits(why: WhyExplanation): string[] {
  const warnings: string[] = [];
  for (const k of Object.keys(WORD_LIMITS) as Array<keyof WhyExplanation>) {
    const limit = WORD_LIMITS[k];
    const val = why[k] ?? "";
    const n = countWords(val);
    if (n > limit) {
      warnings.push(
        `why.${k}: ${n} words (limit ${limit}). Non-blocking — still written.`
      );
    }
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Symbol extraction (best-effort)
// ---------------------------------------------------------------------------

/**
 * Extract likely TypeScript/JS identifiers from a diff summary.
 * Heuristic (non-exhaustive):
 *   - `renamed X → Y` / `X -> Y`  → both X and Y (and renames map)
 *   - `added X()` / `added Foo.bar`                → added
 *   - `removed X` / `deleted X`                    → removed
 *   - fallback: collect `class.method`, `foo()`, and camel/PascalCase tokens
 *
 * We aim for recall over precision — the catalog reads these as search tokens,
 * so an extra token is cheap and a missed one hurts retrieval.
 */
export function extractSymbols(diffSummary: string): {
  added: string[];
  removed: string[];
  renamed: Array<{ from: string; to: string }>;
  all: string[];
} {
  const added = new Set<string>();
  const removed = new Set<string>();
  const renamed: Array<{ from: string; to: string }> = [];
  const all = new Set<string>();

  if (!diffSummary) return { added: [], removed: [], renamed: [], all: [] };

  const IDENT = `[A-Za-z_$][A-Za-z0-9_$]*`;
  const DOTTED = `${IDENT}(?:\\.${IDENT})*`;

  // Renames: "renamed Foo.bar → Foo.baz" / "foo -> bar" / "Foo.bar to Foo.baz"
  const renameRe = new RegExp(
    `(?:renamed|rename(?:d)?)?\\s*(${DOTTED})\\s*(?:→|->|=>)\\s*(${DOTTED})`,
    "g"
  );
  for (const m of diffSummary.matchAll(renameRe)) {
    const from = m[1];
    const to = m[2];
    if (from && to) {
      renamed.push({ from, to });
      all.add(from);
      all.add(to);
    }
  }

  // "added X()" / "added X" / "add X"
  const addRe = new RegExp(`\\b(?:added|add|new)\\s+(${DOTTED})(?:\\(\\))?`, "gi");
  for (const m of diffSummary.matchAll(addRe)) {
    const v = m[1];
    if (v) {
      added.add(v);
      all.add(v);
    }
  }

  // "removed X" / "deleted X" / "drop X"
  const remRe = new RegExp(`\\b(?:removed|deleted|delete|drop)\\s+(${DOTTED})(?:\\(\\))?`, "gi");
  for (const m of diffSummary.matchAll(remRe)) {
    const v = m[1];
    if (v) {
      removed.add(v);
      all.add(v);
    }
  }

  // Fallback tokens: dotted identifiers and foo() patterns.
  const fallbackRe = new RegExp(`(${DOTTED})(?=\\s*\\()|(${DOTTED})`, "g");
  for (const m of diffSummary.matchAll(fallbackRe)) {
    const v = m[1] ?? m[2];
    if (!v) continue;
    // Filter noise: very short all-lowercase words that are English filler.
    if (v.length <= 2) continue;
    if (/^(?:the|and|for|renamed|added|removed|new|add|drop|deleted|delete)$/i.test(v)) continue;
    // Keep tokens that contain an uppercase letter, a dot, or end with '()'
    if (/[A-Z]/.test(v) || v.includes(".")) {
      all.add(v);
    }
  }

  return {
    added: Array.from(added),
    removed: Array.from(removed),
    renamed,
    all: Array.from(all),
  };
}

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

export function resolveSafe(cwd: string, ...segments: string[]): string {
  const absCwd = path.resolve(cwd);
  const target = path.resolve(absCwd, ...segments);
  const rel = path.relative(absCwd, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new TraceLogError(
      "PATH_ESCAPE",
      `Refusing to write outside cwd: ${target} (cwd=${absCwd})`
    );
  }
  return target;
}

// ---------------------------------------------------------------------------
// Atomic primitives
// ---------------------------------------------------------------------------

async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const rand = crypto.randomBytes(6).toString("hex");
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${rand}.tmp`);
  try {
    await fs.writeFile(tmp, content, { encoding: "utf8", flag: "wx" });
    let lastErr: NodeJS.ErrnoException | null = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        await fs.rename(tmp, filePath);
        return;
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === "EPERM" || e.code === "EACCES" || e.code === "EBUSY") {
          lastErr = e;
          await new Promise((r) => setTimeout(r, 10 + attempt * 15));
          continue;
        }
        throw err;
      }
    }
    throw lastErr ?? new Error(`rename failed: ${filePath}`);
  } catch (err) {
    try {
      await fs.unlink(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Best-effort lock acquisition. Returns a release fn on success, or null on
 * timeout — caller falls back to shard-write.
 */
async function acquireLock(
  lockPath: string,
  timeoutMs = 1500
): Promise<null | (() => Promise<void>)> {
  const dir = path.dirname(lockPath);
  await fs.mkdir(dir, { recursive: true });
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const fh = await fs.open(lockPath, "wx");
      await fh.write(`${process.pid}\n`);
      await fh.close();
      return async () => {
        try {
          await fs.unlink(lockPath);
        } catch {
          /* ignore */
        }
      };
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== "EEXIST") throw err;
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 40));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// TraceId resolution
// ---------------------------------------------------------------------------

export function defaultTraceIdForDate(d: Date): string {
  const yyyy = d.getFullYear().toString().padStart(4, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `ct_${yyyy}-${mm}-${dd}`;
}

async function resolveTraceId(
  cwd: string,
  explicit: string | undefined,
  now: Date
): Promise<string> {
  if (explicit) {
    validateTraceId(explicit);
    return explicit;
  }
  const base = defaultTraceIdForDate(now);
  const candidatePath = resolveSafe(cwd, ".attrition", "traces", `${base}.json`);
  const existing = await readIfExists(candidatePath);
  if (!existing) {
    validateTraceId(base);
    return base;
  }
  // Append a random 4-hex suffix for uniqueness.
  const suffix = crypto.randomBytes(2).toString("hex");
  const withSuffix = `${base}_${suffix}`;
  validateTraceId(withSuffix);
  return withSuffix;
}

// ---------------------------------------------------------------------------
// Project resolution
// ---------------------------------------------------------------------------

async function resolveProject(cwd: string, explicit: string | undefined): Promise<string> {
  if (explicit && explicit.length > 0) return explicit;
  const pkgPath = resolveSafe(cwd, "package.json");
  const raw = await readIfExists(pkgPath);
  if (raw) {
    try {
      const pkg = JSON.parse(raw) as { name?: unknown };
      if (typeof pkg.name === "string" && pkg.name.length > 0) {
        return pkg.name;
      }
    } catch {
      /* fall through */
    }
  }
  return path.basename(path.resolve(cwd));
}

// ---------------------------------------------------------------------------
// Read (with shard merging)
// ---------------------------------------------------------------------------

export async function readTraceLocal(
  cwd: string,
  traceId: string
): Promise<ChangeTrace | null> {
  validateTraceId(traceId);
  const tracesDir = resolveSafe(cwd, ".attrition", "traces");
  const mainPath = path.join(tracesDir, `${traceId}.json`);
  const mainRaw = await readIfExists(mainPath);

  let trace: ChangeTrace | null = null;
  if (mainRaw) {
    try {
      trace = JSON.parse(mainRaw) as ChangeTrace;
    } catch {
      trace = null;
    }
  }

  // Look for shard files and merge in chronological order.
  let shardFiles: string[] = [];
  try {
    const entries = await fs.readdir(tracesDir);
    const prefix = `${traceId}.shard.`;
    shardFiles = entries.filter((f) => f.startsWith(prefix) && f.endsWith(".json")).sort();
  } catch {
    /* no dir yet */
  }

  if (!trace && shardFiles.length === 0) return null;

  if (!trace) {
    // Construct from first shard
    trace = {
      id: traceId,
      project: "",
      createdAt: new Date().toISOString(),
      rows: [],
    };
  }

  for (const f of shardFiles) {
    const shardPath = path.join(tracesDir, f);
    const raw = await readIfExists(shardPath);
    if (!raw) continue;
    try {
      const shard = JSON.parse(raw) as { row: ChangeRow; project?: string };
      if (shard.row) {
        trace.rows.push(shard.row);
        if (!trace.project && shard.project) trace.project = shard.project;
      }
    } catch {
      /* skip malformed shard */
    }
  }

  return trace;
}

// ---------------------------------------------------------------------------
// logRow — the public API
// ---------------------------------------------------------------------------

export async function logRow(opts: LogRowOptions): Promise<LogRowResult> {
  if (!opts.cwd || typeof opts.cwd !== "string") {
    throw new TraceLogError("INVALID_INPUT", "cwd is required");
  }
  if (!opts.row || typeof opts.row !== "object") {
    throw new TraceLogError("INVALID_INPUT", "row payload is required");
  }
  const warn = opts.warn ?? ((m: string) => process.stderr.write(`${m}\n`));

  // Validate traceId FIRST — before any IO — to satisfy adversarial cases.
  if (opts.traceId !== undefined) {
    validateTraceId(opts.traceId);
  }

  const cwd = path.resolve(opts.cwd);
  const now = (opts.now ?? (() => new Date()))();
  const nowIso = now.toISOString();

  const traceId = await resolveTraceId(cwd, opts.traceId, now);
  const project = await resolveProject(cwd, opts.project);

  // Build the row.
  const filesTouched = (opts.row.filesTouched ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const sym = extractSymbols(opts.row.diffSummary ?? "");
  const primaryPath = filesTouched[0] ?? "";
  const change: ChangeDetail = {
    path: primaryPath,
    symbolsAdded: sym.added,
    symbolsRenamed: sym.renamed,
    symbolsRemoved: sym.removed,
    diffSummary: opts.row.diffSummary ?? "",
  };

  const row: ChangeRow = {
    scenario: opts.row.scenario ?? "",
    filesTouched,
    changes: [change],
    why: {
      plain: opts.row.why?.plain ?? "",
      analogy: opts.row.why?.analogy ?? "",
      principle: opts.row.why?.principle ?? "",
      hook: opts.row.why?.hook ?? "",
    },
    createdAt: nowIso,
  };

  // Bounded size check — prevent a runaway row from corrupting the file.
  const rowBytes = Buffer.byteLength(JSON.stringify(row), "utf8");
  if (rowBytes > MAX_ROW_BYTES) {
    throw new TraceLogError(
      "ROW_TOO_LARGE",
      `Row exceeds ${MAX_ROW_BYTES}B cap (${rowBytes}B)`
    );
  }

  // Word-limit warnings — non-blocking.
  const warnings = checkWordLimits(row.why);
  for (const w of warnings) warn(`warn: ${w}`);

  const tracesDir = resolveSafe(cwd, ".attrition", "traces");
  const mainPath = path.join(tracesDir, `${traceId}.json`);

  if (opts.dryRun) {
    // Compute rowIndex by inspecting local state non-destructively.
    const existing = await readTraceLocal(cwd, traceId);
    const rowIndex = existing ? existing.rows.length : 0;
    return {
      traceId,
      rowIndex,
      path: mainPath,
      synced: false,
      warnings,
    };
  }

  // Acquire lock; on failure fall back to shard.
  const lockPath = path.join(tracesDir, `${traceId}.lock`);
  const release = await acquireLock(lockPath);

  let rowIndex: number;
  try {
    if (release) {
      // Read → append → write main file atomically.
      const existingRaw = await readIfExists(mainPath);
      let trace: ChangeTrace;
      if (existingRaw) {
        try {
          trace = JSON.parse(existingRaw) as ChangeTrace;
          if (!Array.isArray(trace.rows)) trace.rows = [];
        } catch {
          throw new TraceLogError("CORRUPT_TRACE", `Local trace file is not valid JSON: ${mainPath}`);
        }
      } else {
        trace = {
          id: traceId,
          project,
          createdAt: nowIso,
          rows: [],
        };
      }

      // Also fold in any orphaned shards that accumulated during offline window.
      try {
        const entries = await fs.readdir(tracesDir);
        const shardPrefix = `${traceId}.shard.`;
        const shardFiles = entries.filter(
          (f) => f.startsWith(shardPrefix) && f.endsWith(".json")
        ).sort();
        for (const f of shardFiles) {
          const sp = path.join(tracesDir, f);
          const sr = await readIfExists(sp);
          if (!sr) continue;
          try {
            const shard = JSON.parse(sr) as { row: ChangeRow };
            if (shard.row) trace.rows.push(shard.row);
            await fs.unlink(sp).catch(() => void 0);
          } catch {
            /* skip malformed shard */
          }
        }
      } catch {
        /* no dir yet */
      }

      rowIndex = trace.rows.length;
      trace.rows.push(row);
      await atomicWriteFile(mainPath, JSON.stringify(trace, null, 2) + "\n");
    } else {
      // Lock contended — shard write.
      const tsStr = now.getTime().toString(36);
      const rand = crypto.randomBytes(4).toString("hex");
      const shardPath = path.join(tracesDir, `${traceId}.shard.${tsStr}.${rand}.json`);
      await atomicWriteFile(
        shardPath,
        JSON.stringify({ row, project }, null, 2) + "\n"
      );
      // rowIndex is unstable under shard contention; best-effort via merged read.
      const merged = await readTraceLocal(cwd, traceId);
      rowIndex = merged ? merged.rows.length - 1 : 0;
    }
  } finally {
    if (release) await release();
  }

  // Fire-and-forget registry POST (3s timeout, swallow errors).
  let synced = false;
  let syncError: string | undefined;
  const registryUrl = opts.registry ?? process.env.ATTRITION_REGISTRY_URL ?? DEFAULT_REGISTRY;
  if (registryUrl && registryUrl !== "http://localhost:0") {
    const client: RegistryClientLike = opts.client ?? new RegistryClient(registryUrl);
    try {
      const res = await client.postRow(traceId, { row, project });
      if (res.ok) {
        synced = true;
      } else {
        syncError = `${res.error.code}: ${res.error.message}`;
        warn(`warn: remote-sync failed (${syncError}). Local copy saved at ${mainPath}`);
      }
    } catch (err) {
      syncError = (err as Error).message;
      warn(`warn: remote-sync failed (${syncError}). Local copy saved at ${mainPath}`);
    }
  } else if (opts.client) {
    // Tests may pass an explicit client even when URL is stub.
    try {
      const res = await opts.client.postRow(traceId, { row, project });
      if (res.ok) synced = true;
      else {
        syncError = `${res.error.code}: ${res.error.message}`;
        warn(`warn: remote-sync failed (${syncError}). Local copy saved at ${mainPath}`);
      }
    } catch (err) {
      syncError = (err as Error).message;
      warn(`warn: remote-sync failed (${syncError}). Local copy saved at ${mainPath}`);
    }
  }

  return {
    traceId,
    rowIndex,
    path: mainPath,
    synced,
    ...(syncError !== undefined ? { syncError } : {}),
    warnings,
  };
}
