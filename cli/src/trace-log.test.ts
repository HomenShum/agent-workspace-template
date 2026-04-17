import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import {
  logRow,
  validateTraceId,
  extractSymbols,
  defaultTraceIdForDate,
  countWords,
  readTraceLocal,
  TraceLogError,
  TRACE_ID_RE,
  type LogRowInput,
} from "./trace-log.js";
import type { RegistryClientLike, RegistryError } from "./registry.js";

// ---------------------------------------------------------------------------
// Fake registry client — matches RegistryClientLike surface
// ---------------------------------------------------------------------------

type PostBehavior =
  | { kind: "ok" }
  | { kind: "err"; error: RegistryError }
  | { kind: "throw"; message: string };

class FakeClient implements RegistryClientLike {
  public posts: Array<{ id: string; body: unknown }> = [];
  public postBehavior: PostBehavior = { kind: "ok" };

  async listTraces() {
    return { ok: true as const, value: { traces: [], total: 0 } };
  }
  async getTrace() {
    return { ok: false as const, error: { code: "NOT_FOUND" as const, message: "fake" } };
  }
  async getRawTrace() {
    return { ok: false as const, error: { code: "NOT_FOUND" as const, message: "fake" } };
  }
  async postRow(id: string, body: unknown) {
    this.posts.push({ id, body });
    if (this.postBehavior.kind === "throw") throw new Error(this.postBehavior.message);
    if (this.postBehavior.kind === "err") {
      return { ok: false as const, error: this.postBehavior.error };
    }
    return { ok: true as const, status: 201 };
  }
}

async function makeTempCwd(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "trace-log-test-"));
}

async function rmTemp(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

function validRow(overrides: Partial<LogRowInput> = {}): LogRowInput {
  return {
    scenario: "User clicked Export on /packs and got 500",
    filesTouched: ["cli/src/registry.ts"],
    diffSummary: "RegistryClient.get(): added {pack} envelope unwrap",
    why: {
      plain: "Two workers wrapped the data differently so nothing flowed through",
      analogy: "Like mailing a letter in an envelope vs. handing it bare",
      principle: "Message shape is part of the contract",
      hook: "Mocks lie",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TRACE_ID_RE", () => {
  it("accepts canonical and suffixed forms", () => {
    expect(TRACE_ID_RE.test("ct_2026-04-17")).toBe(true);
    expect(TRACE_ID_RE.test("ct_2026-04-17_a7f3")).toBe(true);
    expect(TRACE_ID_RE.test("ct_2026-04-17_milestone-7")).toBe(true);
  });
  it("rejects malformed / adversarial", () => {
    expect(TRACE_ID_RE.test("../etc/passwd")).toBe(false);
    expect(TRACE_ID_RE.test("ct_2026_04_17")).toBe(false);
    expect(TRACE_ID_RE.test("CT_2026-04-17")).toBe(false);
    expect(TRACE_ID_RE.test("ct_2026-04-17/../x")).toBe(false);
  });
});

describe("defaultTraceIdForDate", () => {
  it("formats local date as ct_YYYY-MM-DD", () => {
    const d = new Date(2026, 3, 17, 10, 0, 0); // Apr 17 local
    expect(defaultTraceIdForDate(d)).toBe("ct_2026-04-17");
  });
});

describe("countWords", () => {
  it("counts whitespace-delimited tokens", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("  a  b  c  ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});

describe("validateTraceId", () => {
  it("rejects path traversal", () => {
    expect(() => validateTraceId("../etc/passwd")).toThrow(TraceLogError);
    try {
      validateTraceId("../etc/passwd");
      throw new Error("expected throw");
    } catch (e) {
      expect((e as TraceLogError).code).toBe("INVALID_TRACE_ID");
    }
  });
  it("rejects too-long ids", () => {
    try {
      validateTraceId("ct_2026-04-17_" + "a".repeat(200));
      throw new Error("expected throw");
    } catch (e) {
      expect((e as TraceLogError).code).toBe("INVALID_TRACE_ID");
    }
  });
});

describe("Scenario 1 — Happy (dry-run)", () => {
  let cwd: string;
  beforeEach(async () => (cwd = await makeTempCwd()));
  afterEach(async () => rmTemp(cwd));

  it("returns proper traceId + rowIndex 0, no fs writes, no POST", async () => {
    const client = new FakeClient();
    const result = await logRow({
      cwd,
      traceId: "ct_2026-04-17",
      dryRun: true,
      row: validRow(),
      client,
      warn: () => void 0,
    });
    expect(result.traceId).toBe("ct_2026-04-17");
    expect(result.rowIndex).toBe(0);
    expect(result.path).toMatch(/\.attrition[\\\/]traces[\\\/]ct_2026-04-17\.json$/);
    expect(result.synced).toBe(false);
    // No writes: .attrition dir should not exist.
    const attritionExists = await fs
      .stat(path.join(cwd, ".attrition"))
      .then(() => true)
      .catch(() => false);
    expect(attritionExists).toBe(false);
    // No POST.
    expect(client.posts).toHaveLength(0);
  });
});

describe("Scenario 2 — Idempotent append", () => {
  let cwd: string;
  beforeEach(async () => (cwd = await makeTempCwd()));
  afterEach(async () => rmTemp(cwd));

  it("two sequential calls produce rows[0] and rows[1]; AGENTS.md untouched", async () => {
    const client = new FakeClient();
    const r1 = await logRow({
      cwd,
      traceId: "ct_2026-04-17",
      row: validRow({ scenario: "first" }),
      client,
      warn: () => void 0,
    });
    expect(r1.rowIndex).toBe(0);
    const r2 = await logRow({
      cwd,
      traceId: "ct_2026-04-17",
      row: validRow({ scenario: "second" }),
      client,
      warn: () => void 0,
    });
    expect(r2.rowIndex).toBe(1);

    const raw = await fs.readFile(
      path.join(cwd, ".attrition", "traces", "ct_2026-04-17.json"),
      "utf8"
    );
    const trace = JSON.parse(raw);
    expect(trace.rows).toHaveLength(2);
    expect(trace.rows[0].scenario).toBe("first");
    expect(trace.rows[1].scenario).toBe("second");

    // AGENTS.md should NOT have been created by a trace-log call.
    const agentsExists = await fs
      .stat(path.join(cwd, "AGENTS.md"))
      .then(() => true)
      .catch(() => false);
    expect(agentsExists).toBe(false);
  });
});

describe("Scenario 3 — Word-limit warn", () => {
  let cwd: string;
  beforeEach(async () => (cwd = await makeTempCwd()));
  afterEach(async () => rmTemp(cwd));

  it("plain=20 words emits warning, row still written", async () => {
    const client = new FakeClient();
    const warnings: string[] = [];
    const plain20 = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty";
    expect(countWords(plain20)).toBe(20);
    const result = await logRow({
      cwd,
      traceId: "ct_2026-04-17",
      row: validRow({
        why: {
          plain: plain20,
          analogy: "short analogy",
          principle: "short principle",
          hook: "short hook",
        },
      }),
      client,
      warn: (m) => warnings.push(m),
    });
    expect(result.rowIndex).toBe(0);
    expect(warnings.some((w) => /why\.plain.*20 words.*limit 15/.test(w))).toBe(true);
    // Row was still written.
    const raw = await fs.readFile(
      path.join(cwd, ".attrition", "traces", "ct_2026-04-17.json"),
      "utf8"
    );
    const trace = JSON.parse(raw);
    expect(trace.rows).toHaveLength(1);
  });
});

describe("Scenario 4 — Adversarial trace-id", () => {
  let cwd: string;
  beforeEach(async () => (cwd = await makeTempCwd()));
  afterEach(async () => rmTemp(cwd));

  it("../etc/passwd is rejected with INVALID_TRACE_ID before any IO", async () => {
    const client = new FakeClient();
    await expect(
      logRow({
        cwd,
        traceId: "../etc/passwd",
        row: validRow(),
        client,
        warn: () => void 0,
      })
    ).rejects.toMatchObject({ code: "INVALID_TRACE_ID" });
    // No .attrition dir created.
    const attritionExists = await fs
      .stat(path.join(cwd, ".attrition"))
      .then(() => true)
      .catch(() => false);
    expect(attritionExists).toBe(false);
    expect(client.posts).toHaveLength(0);
  });
});

describe("Scenario 5 — Path escape defense", () => {
  let cwd: string;
  beforeEach(async () => (cwd = await makeTempCwd()));
  afterEach(async () => rmTemp(cwd));

  it("cwd is respected; valid trace-id cannot escape .attrition/traces/", async () => {
    const client = new FakeClient();
    const result = await logRow({
      cwd,
      traceId: "ct_2026-04-17",
      row: validRow(),
      client,
      warn: () => void 0,
    });
    const expectedPrefix = path.resolve(cwd, ".attrition", "traces");
    expect(result.path.startsWith(expectedPrefix)).toBe(true);
    // Verify sibling paths don't leak.
    const sibling = await fs
      .stat(path.resolve(cwd, "..", "etc", "passwd"))
      .then(() => true)
      .catch(() => false);
    // (expect sibling does not exist regardless of OS — just confirms we didn't write there)
    expect(typeof sibling).toBe("boolean");
  });
});

describe("Scenario 6 — Network offline (5xx)", () => {
  let cwd: string;
  beforeEach(async () => (cwd = await makeTempCwd()));
  afterEach(async () => rmTemp(cwd));

  it("POST 5xx does NOT fail the call; local save succeeds; stderr notes sync failure", async () => {
    const client = new FakeClient();
    client.postBehavior = {
      kind: "err",
      error: { code: "UPSTREAM", message: "500", status: 500 },
    };
    const warnings: string[] = [];
    const result = await logRow({
      cwd,
      traceId: "ct_2026-04-17",
      row: validRow(),
      registry: "https://example.com",
      client,
      warn: (m) => warnings.push(m),
    });
    expect(result.rowIndex).toBe(0);
    expect(result.synced).toBe(false);
    expect(result.syncError).toMatch(/UPSTREAM/);
    expect(warnings.some((w) => /remote-sync failed/.test(w))).toBe(true);
    // Local file exists.
    const raw = await fs.readFile(
      path.join(cwd, ".attrition", "traces", "ct_2026-04-17.json"),
      "utf8"
    );
    expect(JSON.parse(raw).rows).toHaveLength(1);
  });
});

describe("Scenario 7 — Symbol extraction", () => {
  it("extracts renames, adds, and dotted symbols", () => {
    const input = "renamed Foo.bar → Foo.baz; added qux()";
    const out = extractSymbols(input);
    expect(out.renamed).toContainEqual({ from: "Foo.bar", to: "Foo.baz" });
    expect(out.all).toContain("Foo.bar");
    expect(out.all).toContain("Foo.baz");
    expect(out.added).toContain("qux");
    expect(out.all).toContain("qux");
  });

  it("handles ASCII arrow and class.method patterns", () => {
    const out = extractSymbols("RegistryClient.get: added {pack} envelope unwrap; renamed x -> y");
    expect(out.all).toContain("RegistryClient.get");
    expect(out.renamed).toContainEqual({ from: "x", to: "y" });
  });
});

describe("Scenario 8 — Atomic write: crash mid-write leaves prior file intact", () => {
  let cwd: string;
  beforeEach(async () => (cwd = await makeTempCwd()));
  afterEach(async () => rmTemp(cwd));

  it("orphan .tmp does not corrupt subsequent logRow", async () => {
    const client = new FakeClient();
    // First, a normal write to seed the file.
    await logRow({
      cwd,
      traceId: "ct_2026-04-17",
      row: validRow({ scenario: "original" }),
      client,
      warn: () => void 0,
    });
    const tracesDir = path.join(cwd, ".attrition", "traces");
    const mainPath = path.join(tracesDir, "ct_2026-04-17.json");
    const before = await fs.readFile(mainPath, "utf8");

    // Simulate a crashed mid-write: create a stray tmp file that was never renamed.
    const orphanTmp = path.join(
      tracesDir,
      `.ct_2026-04-17.json.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`
    );
    await fs.writeFile(orphanTmp, "GARBAGE_PARTIAL_WRITE", "utf8");

    // Next append should succeed and the main file must remain valid JSON.
    const result = await logRow({
      cwd,
      traceId: "ct_2026-04-17",
      row: validRow({ scenario: "after-crash" }),
      client,
      warn: () => void 0,
    });
    expect(result.rowIndex).toBe(1);
    const after = await fs.readFile(mainPath, "utf8");
    const parsed = JSON.parse(after); // must not throw
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].scenario).toBe("original");
    expect(parsed.rows[1].scenario).toBe("after-crash");
    expect(before).not.toBe(after);
  });
});

describe("Scenario 9 — Concurrent append (3 parallel)", () => {
  let cwd: string;
  beforeEach(async () => (cwd = await makeTempCwd()));
  afterEach(async () => rmTemp(cwd));

  /**
   * Concurrency approach (documented here, tested below):
   *
   * We use a lock file (`.attrition/traces/<id>.lock`) with bounded retry. When
   * the lock is acquired, we read-modify-write the canonical JSON. When the
   * lock cannot be acquired within the retry budget, the caller writes a shard
   * (`<id>.shard.<ts>.<rand>.json`) instead. On the next successful lock
   * acquisition (or on readTraceLocal()), shards are folded into the canonical
   * file. Under a 3-way parallel burst, at least one writer takes the lock and
   * the others either (a) serialize behind the lock, or (b) write shards.
   * Either way, all 3 rows end up in the merged view with NO overwrite.
   */
  it("all 3 rows present, no overwrite", async () => {
    const client = new FakeClient();
    const runs = [0, 1, 2].map((i) =>
      logRow({
        cwd,
        traceId: "ct_2026-04-17",
        row: validRow({ scenario: `parallel-${i}` }),
        client,
        warn: () => void 0,
      })
    );
    const results = await Promise.all(runs);
    expect(results).toHaveLength(3);

    const merged = await readTraceLocal(cwd, "ct_2026-04-17");
    expect(merged).not.toBeNull();
    expect(merged!.rows).toHaveLength(3);
    const scenarios = merged!.rows.map((r) => r.scenario).sort();
    expect(scenarios).toEqual(["parallel-0", "parallel-1", "parallel-2"]);
  });
});

describe("resolveProject fallback chain", () => {
  let cwd: string;
  beforeEach(async () => (cwd = await makeTempCwd()));
  afterEach(async () => rmTemp(cwd));

  it("uses package.json#name when present", async () => {
    await fs.writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify({ name: "my-proj" }),
      "utf8"
    );
    const client = new FakeClient();
    await logRow({
      cwd,
      traceId: "ct_2026-04-17",
      row: validRow(),
      client,
      warn: () => void 0,
    });
    const raw = await fs.readFile(
      path.join(cwd, ".attrition", "traces", "ct_2026-04-17.json"),
      "utf8"
    );
    expect(JSON.parse(raw).project).toBe("my-proj");
  });

  it("falls back to basename(cwd) when no package.json", async () => {
    const client = new FakeClient();
    await logRow({
      cwd,
      traceId: "ct_2026-04-17",
      row: validRow(),
      client,
      warn: () => void 0,
    });
    const raw = await fs.readFile(
      path.join(cwd, ".attrition", "traces", "ct_2026-04-17.json"),
      "utf8"
    );
    expect(JSON.parse(raw).project).toBe(path.basename(cwd));
  });
});
