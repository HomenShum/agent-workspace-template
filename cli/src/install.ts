import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { RegistryClient, DEFAULT_REGISTRY, type RegistryPack } from "./registry.js";
import { upsertFragment, findMarkers } from "./markers.js";

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
export const MAX_SLUG_LEN = 100;

export type InstallTarget = "claude-code" | "cursor";
export const INSTALL_TARGETS: readonly InstallTarget[] = ["claude-code", "cursor"] as const;

export function isValidInstallTarget(x: unknown): x is InstallTarget {
  return x === "claude-code" || x === "cursor";
}

export type InstallOptions = {
  cwd: string;
  dryRun?: boolean;
  registry?: string;
  force?: boolean;
  telemetry?: boolean;
  /** Install target: "claude-code" (default) writes .claude/skills/<slug>/SKILL.md
   * + AGENTS.md marker; "cursor" writes .cursor/rules/<slug>.mdc (no AGENTS.md). */
  target?: InstallTarget;
  /** For tests: inject a pre-built client. */
  client?: RegistryClient;
  /** Clock injection for deterministic tests. */
  now?: () => Date;
};

export type InstallResult = {
  slug: string;
  version: string;
  filesWritten: string[];
  filesModified: string[];
  skipped: string[];
  dryRun: boolean;
};

export class InstallError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "InstallError";
  }
}

export function validateSlug(slug: string): void {
  if (typeof slug !== "string" || slug.length === 0) {
    throw new InstallError("INVALID_SLUG", "Slug is required");
  }
  if (slug.length > MAX_SLUG_LEN) {
    throw new InstallError("INVALID_SLUG", `Slug exceeds max length of ${MAX_SLUG_LEN}`);
  }
  if (!SLUG_RE.test(slug)) {
    throw new InstallError(
      "INVALID_SLUG",
      `Invalid slug "${slug}". Allowed: lowercase a-z, digits, and hyphens (starting alphanumeric).`
    );
  }
  // Belt-and-suspenders: explicitly reject traversal patterns even if regex above catches them.
  if (slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
    throw new InstallError("INVALID_SLUG", `Slug contains forbidden path characters`);
  }
}

/**
 * Resolve a target path under cwd and refuse anything that escapes.
 * Uses path.relative to detect '..' traversal after resolution.
 */
export function resolveSafe(cwd: string, ...segments: string[]): string {
  const absCwd = path.resolve(cwd);
  const target = path.resolve(absCwd, ...segments);
  const rel = path.relative(absCwd, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new InstallError(
      "PATH_ESCAPE",
      `Refusing to write outside cwd: ${target} (cwd=${absCwd})`
    );
  }
  return target;
}

async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const rand = crypto.randomBytes(6).toString("hex");
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${rand}.tmp`);
  try {
    await fs.writeFile(tmp, content, { encoding: "utf8", flag: "wx" });
    // On Windows, rename to an existing target can transiently fail with EPERM
    // when another rename onto the same path is in flight. Retry with a small
    // backoff. This preserves the atomic guarantee (the tmp file is always
    // fully written before any rename succeeds) while tolerating benign races.
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

function hasFrontmatter(md: string): boolean {
  return /^---\s*\n[\s\S]*?\n---\s*\n?/m.test(md);
}

function ensureFrontmatter(md: string, pack: { slug: string; name: string; tagline: string }): string {
  if (hasFrontmatter(md)) return md;
  const fm = [
    "---",
    `name: ${pack.name}`,
    `description: ${pack.tagline.replace(/\n/g, " ").slice(0, 280)}`,
    `slug: ${pack.slug}`,
    "---",
    "",
  ].join("\n");
  return `${fm}${md.startsWith("\n") ? "" : "\n"}${md}`;
}

type LockfilePack = {
  slug: string;
  version: string;
  installedAt: string;
  source: string;
  target: InstallTarget;
};

type Lockfile = {
  version: 1;
  packs: LockfilePack[];
};

function emptyLockfile(): Lockfile {
  return { version: 1, packs: [] };
}

function upsertLockfile(lock: Lockfile, entry: LockfilePack): Lockfile {
  const packs = lock.packs.filter((p) => p.slug !== entry.slug);
  packs.push(entry);
  packs.sort((a, b) => a.slug.localeCompare(b.slug));
  return { version: 1, packs };
}

export async function readLockfile(cwd: string): Promise<Lockfile> {
  const lockPath = resolveSafe(cwd, ".attrition", "installed.json");
  const raw = await readIfExists(lockPath);
  if (!raw) return emptyLockfile();
  try {
    const parsed = JSON.parse(raw) as Lockfile;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.packs)) return emptyLockfile();
    return { version: 1, packs: parsed.packs };
  } catch {
    return emptyLockfile();
  }
}

async function writeLockfile(cwd: string, lock: Lockfile): Promise<string> {
  const lockPath = resolveSafe(cwd, ".attrition", "installed.json");
  await atomicWriteFile(lockPath, JSON.stringify(lock, null, 2) + "\n");
  return lockPath;
}

/**
 * Build the MDC body for Cursor rules (.cursor/rules/<slug>.mdc).
 *
 * Cursor reads YAML-ish frontmatter at the top: `description`, `globs`,
 * `alwaysApply`. The body below is the plain markdown the rule file shows
 * to the agent when the rule activates. We set `alwaysApply: false` and
 * `globs: ["**\/*"]` so it is on-demand (activated by description match),
 * matching how Claude Code skills behave — opt-in per task.
 */
function buildCursorMdc(
  rawMarkdown: string,
  pack: { slug: string; name: string; tagline: string }
): string {
  const safeDesc = pack.tagline.replace(/"/g, '\\"').replace(/\n/g, " ").slice(0, 280);
  const safeName = pack.name.replace(/"/g, '\\"').slice(0, 120);
  // Strip any pre-existing YAML frontmatter from the raw body — we are
  // substituting our own MDC header. Without this, Cursor would see two
  // frontmatter blocks and the second would render as body text.
  const bodyNoFm = rawMarkdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
  const fm = [
    "---",
    `description: "${safeDesc}"`,
    `globs: ["**/*"]`,
    `alwaysApply: false`,
    `name: "${safeName}"`,
    `slug: ${pack.slug}`,
    "---",
    "",
  ].join("\n");
  return `${fm}${bodyNoFm.startsWith("\n") ? "" : "\n"}${bodyNoFm}`;
}

export async function install(slug: string, opts: InstallOptions): Promise<InstallResult> {
  validateSlug(slug);
  if (!opts.cwd || typeof opts.cwd !== "string") {
    throw new InstallError("INVALID_INPUT", "cwd is required");
  }
  const target: InstallTarget = opts.target ?? "claude-code";
  if (!isValidInstallTarget(target)) {
    throw new InstallError(
      "INVALID_TARGET",
      `Invalid target "${String(target)}". Allowed: ${INSTALL_TARGETS.join(", ")}`
    );
  }
  const cwd = path.resolve(opts.cwd);
  const now = (opts.now ?? (() => new Date()))();
  const nowIso = now.toISOString();

  const registryUrl = opts.registry ?? process.env.ATTRITION_REGISTRY_URL ?? DEFAULT_REGISTRY;
  const client = opts.client ?? new RegistryClient(registryUrl);

  // Fetch metadata (for name+tagline+version) and raw markdown in parallel.
  const [metaRes, rawRes] = await Promise.all([client.get(slug), client.getRawMarkdown(slug)]);
  if (!metaRes.ok) {
    throw new InstallError(metaRes.error.code, `Failed to fetch pack metadata: ${metaRes.error.message}`);
  }
  if (!rawRes.ok) {
    throw new InstallError(rawRes.error.code, `Failed to fetch pack markdown: ${rawRes.error.message}`);
  }

  // Sanity: registry slug must match requested slug.
  const meta: RegistryPack = metaRes.value;
  if (meta.slug !== slug) {
    throw new InstallError(
      "SLUG_MISMATCH",
      `Registry returned slug '${meta.slug}' for request '${slug}' — aborting.`
    );
  }
  validateSlug(meta.slug);

  const version = typeof meta.version === "string" && meta.version.length > 0 ? meta.version : "0.0.0";

  // Lockfile is shared across both targets.
  const lockPath = resolveSafe(cwd, ".attrition", "installed.json");
  const existingLock = await readLockfile(cwd);
  const nextLock = upsertLockfile(existingLock, {
    slug: meta.slug,
    version,
    installedAt: nowIso,
    source: registryUrl,
    target,
  });

  const filesWritten: string[] = [];
  const filesModified: string[] = [];
  const skipped: string[] = [];

  if (target === "cursor") {
    // Cursor path: .cursor/rules/<slug>.mdc with MDC frontmatter. No AGENTS.md mutation.
    const rulePath = resolveSafe(cwd, ".cursor", "rules", `${slug}.mdc`);
    const ruleContent = buildCursorMdc(rawRes.value, {
      slug: meta.slug,
      name: meta.name,
      tagline: meta.tagline,
    });

    const ruleExisted = (await readIfExists(rulePath)) !== null;
    if (ruleExisted) filesModified.push(rulePath);
    else filesWritten.push(rulePath);

    if ((await readIfExists(lockPath)) === null) filesWritten.push(lockPath);
    else filesModified.push(lockPath);

    if (opts.dryRun) {
      return {
        slug,
        version,
        filesWritten,
        filesModified,
        skipped,
        dryRun: true,
      };
    }

    await atomicWriteFile(rulePath, ruleContent);
    await writeLockfile(cwd, nextLock);

    if (opts.telemetry !== false) {
      void client
        .reportInstall({ slug: meta.slug, version, source: registryUrl })
        .catch(() => {
          /* swallow */
        });
    }

    return {
      slug,
      version,
      filesWritten,
      filesModified,
      skipped,
      dryRun: false,
    };
  }

  // --- claude-code path (default, backward-compatible) ---
  const skillPath = resolveSafe(cwd, ".claude", "skills", slug, "SKILL.md");
  const agentsPath = resolveSafe(cwd, "AGENTS.md");

  const skillContent = ensureFrontmatter(rawRes.value, {
    slug: meta.slug,
    name: meta.name,
    tagline: meta.tagline,
  });

  // Read existing AGENTS.md first so we can detect marker corruption BEFORE any writes.
  const existingAgents = await readIfExists(agentsPath);
  if (existingAgents !== null) {
    const state = findMarkers(existingAgents, slug);
    if (state.kind === "corrupt") {
      throw new InstallError("MARKER_CORRUPTION", `AGENTS.md marker corruption: ${state.reason}`);
    }
  }
  const nextAgents = upsertFragment(existingAgents, {
    slug: meta.slug,
    name: meta.name,
    tagline: meta.tagline,
    version,
    installedAt: nowIso,
  });

  const skillExisted = (await readIfExists(skillPath)) !== null;
  if (skillExisted) filesModified.push(skillPath);
  else filesWritten.push(skillPath);

  if (existingAgents === null) filesWritten.push(agentsPath);
  else filesModified.push(agentsPath);

  if ((await readIfExists(lockPath)) === null) filesWritten.push(lockPath);
  else filesModified.push(lockPath);

  if (opts.dryRun) {
    return {
      slug,
      version,
      filesWritten,
      filesModified,
      skipped,
      dryRun: true,
    };
  }

  // Atomic writes — each step uses tmp+rename. If any step throws before all
  // writes complete, the earlier renames are committed but remaining ones are
  // not; however each individual file is never partial.
  await atomicWriteFile(skillPath, skillContent);
  await atomicWriteFile(agentsPath, nextAgents);
  await writeLockfile(cwd, nextLock);

  // Fire-and-forget telemetry. Never block, never throw.
  if (opts.telemetry !== false) {
    void client
      .reportInstall({ slug: meta.slug, version, source: registryUrl })
      .catch(() => {
        /* swallow */
      });
  }

  return {
    slug,
    version,
    filesWritten,
    filesModified,
    skipped,
    dryRun: false,
  };
}

/** Test-only helper: convenient cleanup in unit tests. */
export async function makeTempCwd(prefix = "attrition-test-"): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}
