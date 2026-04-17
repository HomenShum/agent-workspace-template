import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  install,
  validateSlug,
  InstallError,
  resolveSafe,
  readLockfile,
  makeTempCwd,
} from "./install.js";
import { RegistryClient, type RegistryPack } from "./registry.js";
import { findMarkers } from "./markers.js";

/**
 * A fake registry client that implements the same surface as RegistryClient,
 * wired with in-memory responses so tests never touch the network.
 */
class FakeClient {
  public installReports: Array<{ slug: string; version: string; source: string }> = [];
  public telemetryShouldFail = false;
  public listFn: (q?: string) => ReturnType<RegistryClient["list"]> = async () => ({
    ok: true as const,
    value: { packs: [], total: 0 },
  });

  constructor(
    private readonly packs: Record<string, RegistryPack>,
    private readonly raw: Record<string, string>,
    private readonly behavior: {
      metaStatus?: number; // override 404 or 5xx
      rawStatus?: number;
      timeout?: boolean;
    } = {}
  ) {}

  async get(slug: string): ReturnType<RegistryClient["get"]> {
    if (this.behavior.timeout) {
      return { ok: false, error: { code: "TIMEOUT", message: "fake timeout" } };
    }
    if (this.behavior.metaStatus === 500) {
      return { ok: false, error: { code: "UPSTREAM", message: "500", status: 500 } };
    }
    const p = this.packs[slug];
    if (!p) return { ok: false, error: { code: "NOT_FOUND", message: `no ${slug}`, status: 404 } };
    return { ok: true, value: p };
  }

  async getRawMarkdown(slug: string): ReturnType<RegistryClient["getRawMarkdown"]> {
    if (this.behavior.timeout) {
      return { ok: false, error: { code: "TIMEOUT", message: "fake timeout" } };
    }
    if (this.behavior.rawStatus === 500) {
      return { ok: false, error: { code: "UPSTREAM", message: "500", status: 500 } };
    }
    const md = this.raw[slug];
    if (md === undefined) return { ok: false, error: { code: "NOT_FOUND", message: `no raw ${slug}`, status: 404 } };
    return { ok: true, value: md };
  }

  async list(q?: string) {
    return this.listFn(q);
  }

  async reportInstall(payload: { slug: string; version: string; source: string }) {
    this.installReports.push(payload);
    if (this.telemetryShouldFail) return { ok: false };
    return { ok: true };
  }
}

function mkPack(partial: Partial<RegistryPack> & { slug: string }): RegistryPack {
  const base: RegistryPack = {
    slug: partial.slug,
    name: partial.name ?? `Pack ${partial.slug}`,
    tagline: partial.tagline ?? `Tagline for ${partial.slug}`,
    packType: partial.packType ?? "reference",
    trust: partial.trust ?? "Community",
    status: partial.status ?? "Experimental",
    version: partial.version ?? "1.0.0",
    publisher: partial.publisher ?? "test",
  };
  return { ...base, ...partial };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

describe("validateSlug", () => {
  it("accepts kebab-case alphanumeric", () => {
    expect(() => validateSlug("foo-bar-42")).not.toThrow();
    expect(() => validateSlug("a")).not.toThrow();
  });

  it("rejects path traversal attempts", () => {
    expect(() => validateSlug("../etc/passwd")).toThrow(InstallError);
  });
  it("rejects slash segments", () => {
    expect(() => validateSlug("a/b")).toThrow(InstallError);
  });
  it("rejects uppercase", () => {
    expect(() => validateSlug("UPPER")).toThrow(InstallError);
  });
  it("rejects over-length slugs", () => {
    expect(() => validateSlug("a".repeat(500))).toThrow(InstallError);
  });
  it("rejects empty / non-string", () => {
    expect(() => validateSlug("")).toThrow(InstallError);
    // @ts-expect-error — testing runtime guard
    expect(() => validateSlug(undefined)).toThrow(InstallError);
  });
  it("rejects backslash traversal", () => {
    expect(() => validateSlug("..\\foo")).toThrow(InstallError);
  });
});

describe("resolveSafe", () => {
  it("rejects resolved paths that escape cwd", () => {
    const tmpRoot = os.tmpdir();
    const cwd = path.join(tmpRoot, "sandbox");
    expect(() => resolveSafe(cwd, "..", "..", "etc", "passwd")).toThrow(InstallError);
  });
  it("allows paths inside cwd", () => {
    const cwd = os.tmpdir();
    const out = resolveSafe(cwd, ".claude", "skills", "foo", "SKILL.md");
    expect(out.startsWith(path.resolve(cwd))).toBe(true);
  });
});

describe("install scenarios", () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await makeTempCwd();
  });
  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("Happy path: writes SKILL.md, AGENTS.md, lockfile", async () => {
    const pack = mkPack({ slug: "foo", name: "Foo", tagline: "Foo tagline", version: "1.2.3" });
    const client = new FakeClient({ foo: pack }, { foo: "# Foo skill\n\nBody here.\n" });
    const fixed = new Date("2026-01-01T00:00:00.000Z");
    const res = await install("foo", {
      cwd,
      client: client as unknown as RegistryClient,
      now: () => fixed,
    });
    expect(res.dryRun).toBe(false);
    expect(res.version).toBe("1.2.3");
    // SKILL.md present with frontmatter
    const skill = await fs.readFile(path.join(cwd, ".claude", "skills", "foo", "SKILL.md"), "utf8");
    expect(skill.startsWith("---\n")).toBe(true);
    expect(skill).toContain("name: Foo");
    expect(skill).toContain("description: Foo tagline");
    expect(skill).toContain("# Foo skill");
    // AGENTS.md
    const agents = await fs.readFile(path.join(cwd, "AGENTS.md"), "utf8");
    expect(agents).toContain("<!-- attrition:pack:foo:start -->");
    expect(agents).toContain("<!-- attrition:pack:foo:end -->");
    expect(agents).toContain("### Foo (`foo` v1.2.3)");
    // Lockfile
    const lock = await readLockfile(cwd);
    expect(lock.packs).toHaveLength(1);
    expect(lock.packs[0]!.slug).toBe("foo");
    expect(lock.packs[0]!.version).toBe("1.2.3");
  });

  it("Idempotent upgrade: install same slug twice — single fragment, SKILL.md overwritten", async () => {
    const pack1 = mkPack({ slug: "foo", version: "1.0.0", tagline: "first" });
    const pack2 = mkPack({ slug: "foo", version: "2.0.0", tagline: "second" });
    const client = new FakeClient({ foo: pack1 }, { foo: "# Skill v1\n" });
    await install("foo", { cwd, client: client as unknown as RegistryClient });
    // Swap metadata/raw for v2
    const client2 = new FakeClient({ foo: pack2 }, { foo: "# Skill v2\n" });
    await install("foo", { cwd, client: client2 as unknown as RegistryClient });

    const agents = await fs.readFile(path.join(cwd, "AGENTS.md"), "utf8");
    const state = findMarkers(agents, "foo");
    expect(state.kind).toBe("present");
    // Only one start/end pair
    expect(agents.match(/<!-- attrition:pack:foo:start -->/g)?.length).toBe(1);
    expect(agents.match(/<!-- attrition:pack:foo:end -->/g)?.length).toBe(1);
    expect(agents).toContain("v2.0.0");
    expect(agents).not.toContain("v1.0.0");

    const skill = await fs.readFile(path.join(cwd, ".claude", "skills", "foo", "SKILL.md"), "utf8");
    expect(skill).toContain("# Skill v2");
    expect(skill).not.toContain("# Skill v1");

    const lock = await readLockfile(cwd);
    expect(lock.packs).toHaveLength(1);
    expect(lock.packs[0]!.version).toBe("2.0.0");
  });

  it("Dry-run: returns planned changes, writes nothing", async () => {
    const pack = mkPack({ slug: "foo" });
    const client = new FakeClient({ foo: pack }, { foo: "# foo" });
    const res = await install("foo", {
      cwd,
      client: client as unknown as RegistryClient,
      dryRun: true,
    });
    expect(res.dryRun).toBe(true);
    expect(res.filesWritten.length + res.filesModified.length).toBeGreaterThan(0);
    expect(await pathExists(path.join(cwd, ".claude"))).toBe(false);
    expect(await pathExists(path.join(cwd, "AGENTS.md"))).toBe(false);
    expect(await pathExists(path.join(cwd, ".attrition"))).toBe(false);
  });

  it("Offline / registry 5xx: throws, no partial files written", async () => {
    const client = new FakeClient({}, {}, { metaStatus: 500, rawStatus: 500 });
    await expect(
      install("foo", { cwd, client: client as unknown as RegistryClient })
    ).rejects.toBeInstanceOf(InstallError);
    expect(await pathExists(path.join(cwd, ".claude"))).toBe(false);
    expect(await pathExists(path.join(cwd, "AGENTS.md"))).toBe(false);
    expect(await pathExists(path.join(cwd, ".attrition"))).toBe(false);
  });

  it("Adversarial slugs are rejected before any IO", async () => {
    const badSlugs = ["../etc/passwd", "a/b", "UPPER", "a".repeat(500), "foo..bar", "", "a\\b"];
    for (const slug of badSlugs) {
      await expect(install(slug, { cwd })).rejects.toBeInstanceOf(InstallError);
    }
    expect(await pathExists(path.join(cwd, ".claude"))).toBe(false);
  });

  it("Path escape: even if registry returns weird data, resolved paths stay under cwd", async () => {
    // Registry returns mismatched slug → SLUG_MISMATCH fires before any write.
    const pack = mkPack({ slug: "other" }); // mismatched
    const client = new FakeClient({ foo: { ...pack, slug: "other" } }, { foo: "# body\n" });
    await expect(
      install("foo", { cwd, client: client as unknown as RegistryClient })
    ).rejects.toMatchObject({ code: "SLUG_MISMATCH" });

    // Also verify .claude + AGENTS.md never escape cwd even when attempting to resolve weird relative segments.
    // The resolveSafe helper is the enforcement point.
    expect(() => resolveSafe(cwd, ".claude", "skills", "..", "..", "..", "boom")).toThrow(InstallError);
  });

  it("AGENTS.md marker corruption: start without end errors clearly", async () => {
    const pack = mkPack({ slug: "foo" });
    const client = new FakeClient({ foo: pack }, { foo: "# body" });
    // Seed a corrupt AGENTS.md
    await fs.writeFile(
      path.join(cwd, "AGENTS.md"),
      "# Agents\n\n<!-- attrition:pack:foo:start -->\norphan\n"
    );
    await expect(
      install("foo", { cwd, client: client as unknown as RegistryClient })
    ).rejects.toMatchObject({ code: "MARKER_CORRUPTION" });

    // The original AGENTS.md must be untouched.
    const after = await fs.readFile(path.join(cwd, "AGENTS.md"), "utf8");
    expect(after).toContain("orphan");
    expect(await pathExists(path.join(cwd, ".claude"))).toBe(false);
  });

  it("Rapid parallel installs: 5 concurrent installs of different slugs → lockfile coherent", async () => {
    const slugs = ["alpha", "bravo", "charlie", "delta", "echo"];
    const packs: Record<string, RegistryPack> = {};
    const raw: Record<string, string> = {};
    for (const s of slugs) {
      packs[s] = mkPack({ slug: s, version: "1.0.0" });
      raw[s] = `# ${s}\n`;
    }
    // Each install uses its own client — they share a cwd and will race
    // on lockfile read/write. Atomic rename + final readLockfile should still
    // show coherent JSON (at minimum no partial writes / parseable).
    await Promise.all(
      slugs.map((s) =>
        install(s, {
          cwd,
          client: new FakeClient(packs, raw) as unknown as RegistryClient,
        })
      )
    );
    const lock = await readLockfile(cwd);
    // Lockfile is JSON-parseable (readLockfile falls back to empty on parse error,
    // so we also verify the file itself parses).
    const raw_lock = await fs.readFile(path.join(cwd, ".attrition", "installed.json"), "utf8");
    expect(() => JSON.parse(raw_lock)).not.toThrow();
    // Under concurrent last-writer-wins semantics we may not capture all 5 entries
    // in the lockfile, but every entry we DO have must be from our set and every
    // slug must have its SKILL.md written.
    for (const entry of lock.packs) {
      expect(slugs).toContain(entry.slug);
    }
    for (const s of slugs) {
      expect(await pathExists(path.join(cwd, ".claude", "skills", s, "SKILL.md"))).toBe(true);
    }
    // AGENTS.md should exist and contain at least one fragment, with balanced markers for each pack it references.
    const agents = await fs.readFile(path.join(cwd, "AGENTS.md"), "utf8");
    for (const s of slugs) {
      const starts = (agents.match(new RegExp(`<!-- attrition:pack:${s}:start -->`, "g")) ?? []).length;
      const ends = (agents.match(new RegExp(`<!-- attrition:pack:${s}:end -->`, "g")) ?? []).length;
      expect(starts).toBe(ends);
      expect(starts).toBeLessThanOrEqual(1);
    }
  });

  it("Telemetry POST failure: install still succeeds", async () => {
    const pack = mkPack({ slug: "foo" });
    const client = new FakeClient({ foo: pack }, { foo: "# foo" });
    client.telemetryShouldFail = true;
    const res = await install("foo", {
      cwd,
      client: client as unknown as RegistryClient,
    });
    expect(res.dryRun).toBe(false);
    // Give the fire-and-forget a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(await pathExists(path.join(cwd, ".claude", "skills", "foo", "SKILL.md"))).toBe(true);
  });
});

describe("Cursor target", () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await makeTempCwd();
  });
  afterEach(async () => {
    await fs.rm(cwd, { recursive: true, force: true });
  });

  it("Happy: --target=cursor writes .cursor/rules/<slug>.mdc with MDC frontmatter", async () => {
    const pack = mkPack({ slug: "foo", name: "Foo", tagline: "Foo tagline", version: "1.2.3" });
    const client = new FakeClient({ foo: pack }, { foo: "# Foo skill\n\nBody.\n" });
    const res = await install("foo", {
      cwd,
      client: client as unknown as RegistryClient,
      target: "cursor",
    });
    expect(res.dryRun).toBe(false);
    expect(res.version).toBe("1.2.3");
    const mdcPath = path.join(cwd, ".cursor", "rules", "foo.mdc");
    const mdc = await fs.readFile(mdcPath, "utf8");
    // Must start with MDC frontmatter block.
    expect(mdc.startsWith("---\n")).toBe(true);
    expect(mdc).toContain(`description: "Foo tagline"`);
    expect(mdc).toContain(`globs: ["**/*"]`);
    expect(mdc).toContain(`alwaysApply: false`);
    expect(mdc).toContain(`slug: foo`);
    // Body preserved.
    expect(mdc).toContain("# Foo skill");
    expect(mdc).toContain("Body.");
  });

  it("Happy: --target=cursor does NOT create or touch AGENTS.md", async () => {
    const pack = mkPack({ slug: "foo" });
    const client = new FakeClient({ foo: pack }, { foo: "# Foo\n" });
    await install("foo", {
      cwd,
      client: client as unknown as RegistryClient,
      target: "cursor",
    });
    expect(await pathExists(path.join(cwd, "AGENTS.md"))).toBe(false);
    expect(await pathExists(path.join(cwd, ".claude"))).toBe(false);
  });

  it("Adversarial: invalid target is rejected", async () => {
    const pack = mkPack({ slug: "foo" });
    const client = new FakeClient({ foo: pack }, { foo: "# Foo\n" });
    await expect(
      install("foo", {
        cwd,
        client: client as unknown as RegistryClient,
        // @ts-expect-error — testing runtime guard
        target: "invalid",
      })
    ).rejects.toBeInstanceOf(InstallError);
    // No files created on rejection.
    expect(await pathExists(path.join(cwd, ".cursor"))).toBe(false);
    expect(await pathExists(path.join(cwd, ".claude"))).toBe(false);
    expect(await pathExists(path.join(cwd, "AGENTS.md"))).toBe(false);
  });

  it("Idempotent: re-install cursor target overwrites .mdc, lockfile updates target", async () => {
    const pack1 = mkPack({ slug: "foo", version: "1.0.0", tagline: "first" });
    const pack2 = mkPack({ slug: "foo", version: "2.0.0", tagline: "second" });
    const c1 = new FakeClient({ foo: pack1 }, { foo: "# v1 body\n" });
    await install("foo", {
      cwd,
      client: c1 as unknown as RegistryClient,
      target: "cursor",
    });
    const c2 = new FakeClient({ foo: pack2 }, { foo: "# v2 body\n" });
    await install("foo", {
      cwd,
      client: c2 as unknown as RegistryClient,
      target: "cursor",
    });
    const mdc = await fs.readFile(path.join(cwd, ".cursor", "rules", "foo.mdc"), "utf8");
    // v2 body overwrote v1 — no duplication.
    expect(mdc).toContain("# v2 body");
    expect(mdc).not.toContain("# v1 body");
    expect(mdc).toContain(`description: "second"`);
    // Only one frontmatter block.
    const fmCount = (mdc.match(/^---$/gm) ?? []).length;
    expect(fmCount).toBe(2); // one open, one close
    const lock = await readLockfile(cwd);
    expect(lock.packs).toHaveLength(1);
    expect(lock.packs[0]!.slug).toBe("foo");
    expect(lock.packs[0]!.version).toBe("2.0.0");
    expect(lock.packs[0]!.target).toBe("cursor");
  });

  it("Mixed targets: install A to claude-code, B to cursor — both in lockfile with distinct targets", async () => {
    const packA = mkPack({ slug: "alpha", version: "1.0.0" });
    const packB = mkPack({ slug: "bravo", version: "2.0.0" });
    const cA = new FakeClient({ alpha: packA }, { alpha: "# alpha\n" });
    const cB = new FakeClient({ bravo: packB }, { bravo: "# bravo\n" });
    await install("alpha", {
      cwd,
      client: cA as unknown as RegistryClient,
      target: "claude-code",
    });
    await install("bravo", {
      cwd,
      client: cB as unknown as RegistryClient,
      target: "cursor",
    });
    // claude-code artefacts for alpha.
    expect(
      await pathExists(path.join(cwd, ".claude", "skills", "alpha", "SKILL.md"))
    ).toBe(true);
    expect(await pathExists(path.join(cwd, "AGENTS.md"))).toBe(true);
    // cursor artefact for bravo.
    expect(await pathExists(path.join(cwd, ".cursor", "rules", "bravo.mdc"))).toBe(true);
    // No cross-contamination: no SKILL.md for bravo, no .mdc for alpha.
    expect(
      await pathExists(path.join(cwd, ".claude", "skills", "bravo", "SKILL.md"))
    ).toBe(false);
    expect(await pathExists(path.join(cwd, ".cursor", "rules", "alpha.mdc"))).toBe(false);
    const lock = await readLockfile(cwd);
    const byslug: Record<string, (typeof lock.packs)[number]> = {};
    for (const p of lock.packs) byslug[p.slug] = p;
    expect(byslug.alpha!.target).toBe("claude-code");
    expect(byslug.bravo!.target).toBe("cursor");
    // AGENTS.md should only have the alpha fragment, not bravo.
    const agents = await fs.readFile(path.join(cwd, "AGENTS.md"), "utf8");
    expect(agents).toContain("attrition:pack:alpha:start");
    expect(agents).not.toContain("attrition:pack:bravo:start");
  });

  it("Default target (omitted) remains claude-code — backward compat", async () => {
    const pack = mkPack({ slug: "foo" });
    const client = new FakeClient({ foo: pack }, { foo: "# foo\n" });
    // No target passed — default behaviour preserved.
    await install("foo", { cwd, client: client as unknown as RegistryClient });
    expect(await pathExists(path.join(cwd, ".claude", "skills", "foo", "SKILL.md"))).toBe(true);
    expect(await pathExists(path.join(cwd, "AGENTS.md"))).toBe(true);
    expect(await pathExists(path.join(cwd, ".cursor"))).toBe(false);
    const lock = await readLockfile(cwd);
    expect(lock.packs[0]!.target).toBe("claude-code");
  });

  it("Cursor path safety: slug validation still applies (no .mdc escape)", async () => {
    // Adversarial slug must be rejected before any IO.
    await expect(
      install("../evil", { cwd, target: "cursor" })
    ).rejects.toBeInstanceOf(InstallError);
    expect(await pathExists(path.join(cwd, ".cursor"))).toBe(false);
  });
});
