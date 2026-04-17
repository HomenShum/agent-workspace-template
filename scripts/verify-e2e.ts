#!/usr/bin/env tsx
/**
 * End-to-end contract test for the Agent Workspace / attrition.sh stack.
 *
 * Catches interface-shape drift between the four surfaces that ship independently:
 *   - Next.js API routes (/api/packs*, /packs/<slug>/raw)
 *   - Raw markdown serializer (src/lib/pack-markdown.ts)
 *   - MCP server (mcp-server/)
 *   - CLI (cli/)
 *
 * Unit tests inside each agent mock their counterpart and miss contract mismatches.
 * This script starts the real registry, invokes the real CLI against it, and
 * asserts the installed artifacts on disk.
 *
 * Run: npx tsx scripts/verify-e2e.ts
 * Exit: 0 on full pass, non-zero with line-level failure on any miss.
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const CLI_ENTRY = resolve(ROOT, "cli/dist/index.js");
const DEV_PORT = 3000;
const DEV_URL = `http://localhost:${DEV_PORT}`;

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function waitFor(url: string, timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (r.status < 500) return true;
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  // 0. Preflight
  if (!existsSync(CLI_ENTRY)) {
    console.error(`CLI not built at ${CLI_ENTRY}. Run: cd cli && npm run build`);
    process.exit(2);
  }

  // 1. Start dev server
  console.log("→ starting Next.js dev server...");
  const dev: ChildProcess = spawn("npm", ["run", "dev"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    env: { ...process.env, PORT: String(DEV_PORT) },
  });
  let devStderr = "";
  dev.stderr?.on("data", (b) => (devStderr += b.toString()));

  const cleanup = () => {
    try {
      if (dev.pid) process.kill(dev.pid);
    } catch {
      // already dead
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  const ready = await waitFor(`${DEV_URL}/api/packs?limit=1`);
  record("dev server reachable", ready, ready ? undefined : devStderr.slice(-300));
  if (!ready) {
    cleanup();
    finalize();
    return;
  }

  // 2. API contract: list
  {
    const r = await fetch(`${DEV_URL}/api/packs?type=ui&limit=5`);
    const j = (await r.json()) as { packs: unknown[]; total: number };
    record(
      "GET /api/packs returns {packs,total}",
      r.status === 200 && Array.isArray(j.packs) && typeof j.total === "number",
      `status=${r.status} total=${j.total} got=${j.packs.length}`
    );
  }

  // 3. API contract: single pack — MUST be {pack: Pack}
  let pack: { slug?: string; installCommand?: string; rawMarkdownPath?: string } = {};
  {
    const r = await fetch(`${DEV_URL}/api/packs/rag-hybrid-bm25-vector`);
    const j = (await r.json()) as { pack?: typeof pack };
    pack = j.pack ?? {};
    record(
      "GET /api/packs/<slug> envelope is {pack:...}",
      r.status === 200 && !!j.pack,
      r.status === 200 && !j.pack ? "MISSING .pack wrapper — would break CLI" : `status=${r.status}`
    );
    record(
      "pack.installCommand present",
      typeof pack.installCommand === "string" && pack.installCommand.length > 0
    );
    record(
      "pack.rawMarkdownPath present and starts with /packs/",
      typeof pack.rawMarkdownPath === "string" && pack.rawMarkdownPath.startsWith("/packs/"),
      `rawMarkdownPath=${pack.rawMarkdownPath}`
    );
  }

  // 4. Raw MD contract: path declared in Pack.rawMarkdownPath MUST resolve
  if (pack.rawMarkdownPath) {
    const r = await fetch(`${DEV_URL}${pack.rawMarkdownPath}`);
    const body = await r.text();
    const ct = r.headers.get("content-type") ?? "";
    record(
      "raw MD path from pack resolves",
      r.status === 200,
      `status=${r.status} path=${pack.rawMarkdownPath}`
    );
    record(
      "raw MD content-type is text/markdown",
      ct.includes("text/markdown"),
      `ct=${ct}`
    );
    record(
      "raw MD has YAML frontmatter",
      body.startsWith("---\n") && body.includes(`slug: "${pack.slug}"`)
    );
    record(
      "raw MD has ## Contract and ## Sources",
      body.includes("## Contract") && body.includes("## Sources")
    );
  }

  // 5. CLI end-to-end: install into a fresh tmpdir, verify on-disk artifacts
  const tmp = mkdtempSync(join(tmpdir(), "attrition-e2e-"));
  try {
    const slug = "rag-hybrid-bm25-vector";
    const result = spawnSync(
      process.execPath,
      [CLI_ENTRY, "pack", "install", slug, `--registry=${DEV_URL}`],
      { cwd: tmp, encoding: "utf8", timeout: 30_000 }
    );
    record(
      "CLI install exits 0",
      result.status === 0,
      result.status === 0 ? undefined : `stderr: ${result.stderr.slice(0, 300)}`
    );

    const skillPath = join(tmp, ".claude", "skills", slug, "SKILL.md");
    record("CLI wrote SKILL.md", existsSync(skillPath));
    if (existsSync(skillPath)) {
      const skill = readFileSync(skillPath, "utf8");
      record(
        "SKILL.md has frontmatter + Contract section",
        skill.startsWith("---\n") && skill.includes("## Contract")
      );
    }

    const agentsPath = join(tmp, "AGENTS.md");
    record("CLI wrote AGENTS.md", existsSync(agentsPath));
    if (existsSync(agentsPath)) {
      const agents = readFileSync(agentsPath, "utf8");
      const startCount = (agents.match(new RegExp(`attrition:pack:${slug}:start`, "g")) || []).length;
      const endCount = (agents.match(new RegExp(`attrition:pack:${slug}:end`, "g")) || []).length;
      record(
        "AGENTS.md has exactly one marker pair",
        startCount === 1 && endCount === 1,
        `start=${startCount} end=${endCount}`
      );
    }

    const lockPath = join(tmp, ".attrition", "installed.json");
    record("CLI wrote lockfile", existsSync(lockPath));
    if (existsSync(lockPath)) {
      const lock = JSON.parse(readFileSync(lockPath, "utf8")) as {
        packs: Array<{ slug: string; version: string }>;
      };
      record(
        "lockfile pins the installed slug",
        lock.packs.some((p) => p.slug === slug && typeof p.version === "string")
      );
    }

    // 6. Idempotency — re-install should not duplicate markers
    const result2 = spawnSync(
      process.execPath,
      [CLI_ENTRY, "pack", "install", slug, `--registry=${DEV_URL}`],
      { cwd: tmp, encoding: "utf8", timeout: 30_000 }
    );
    record("CLI re-install exits 0", result2.status === 0);
    if (existsSync(agentsPath)) {
      const agents = readFileSync(agentsPath, "utf8");
      const startCount = (agents.match(new RegExp(`attrition:pack:${slug}:start`, "g")) || []).length;
      record(
        "idempotent: re-install keeps exactly one marker pair",
        startCount === 1,
        `start=${startCount}`
      );
    }

    // 7. Adversarial slug at the CLI edge
    const adv = spawnSync(
      process.execPath,
      [CLI_ENTRY, "pack", "install", "../etc/passwd", `--registry=${DEV_URL}`],
      { cwd: tmp, encoding: "utf8", timeout: 10_000 }
    );
    record("CLI rejects traversal slug", adv.status !== 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  cleanup();
  finalize();
}

function finalize() {
  const passed = checks.filter((c) => c.ok).length;
  const total = checks.length;
  console.log("");
  console.log(`${passed}/${total} e2e checks passed`);
  if (passed === total) {
    console.log("E2E OK");
    process.exit(0);
  } else {
    console.log("E2E FAIL");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});
