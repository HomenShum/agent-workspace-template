/**
 * Change-trace registry — Pillar 2 accessor layer.
 *
 * Source of truth (two layers, merged):
 *   1. src/lib/traces/*.ts   — TypeScript seeds (allSeededTraces)
 *   2. docs/traces/*.md      — YAML frontmatter + markdown table
 *
 * TS seeds win on id collision.
 *
 * Hard caps (agentic reliability — see CLAUDE.md 8-point checklist):
 *   - registry result: 1000 (BOUND on read path)
 *   - search result:   50   (BOUND on search path)
 *
 * Slug chokepoint: isValidTraceId (from trace-schema.ts).
 * Anything that doesn't match the regex returns null / [] before
 * the filesystem or registry is touched.
 */

import fs from "node:fs";
import path from "node:path";
import type { ChangeTrace, ChangeRow } from "@/lib/trace-schema";
import { isValidTraceId } from "@/lib/trace-schema";
import { allSeededTraces } from "@/lib/traces";

const REGISTRY_MAX = 1000;
const SEARCH_MAX = 50;

// ---------- Markdown trace parser (YAML frontmatter only; body unused for MVP) ----------

/**
 * Parse a markdown trace file into a minimal ChangeTrace.
 *
 * MVP scope: read YAML frontmatter (id/project/session/createdAt/tags/
 * packsReferenced). The full 4-column table is NOT parsed here — the
 * TS seed (src/lib/traces/*) carries the structured row content for
 * the MVP. M7b extractor agent will populate rows from git diffs.
 *
 * Errors are swallowed: a malformed file is skipped, not crashed on.
 */
function parseMarkdownTrace(filePath: string): ChangeTrace | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    // Frontmatter: opening --- ... closing ---
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!match) return null;

    const fm = match[1];
    const fields = new Map<string, string>();
    for (const line of fm.split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!kv) continue;
      fields.set(kv[1], kv[2].trim());
    }

    const id = fields.get("id");
    if (!id || !isValidTraceId(id)) return null;

    const project = fields.get("project") ?? "unknown";
    const sessionId = fields.get("session") ?? fields.get("sessionId") ?? "";
    const createdAt = fields.get("createdAt") ?? new Date().toISOString();

    const parseList = (key: string): string[] => {
      const v = fields.get(key);
      if (!v) return [];
      // Accept "[a, b, c]" or "a, b, c"
      const stripped = v.replace(/^\[|\]$/g, "");
      return stripped
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    };

    return {
      id,
      project,
      sessionId,
      createdAt,
      rows: [], // row content comes from TS seed if id collides; MD rows populated by extractor later
      tags: parseList("tags"),
      packsReferenced: parseList("packsReferenced"),
    };
  } catch {
    return null;
  }
}

function loadMarkdownTraces(): ChangeTrace[] {
  try {
    // Resolve against the project root. process.cwd() is the Next.js root
    // when routes call this; scripts should also be run from root.
    const dir = path.join(process.cwd(), "docs", "traces");
    if (!fs.existsSync(dir)) return [];
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join(dir, f));
    const traces: ChangeTrace[] = [];
    for (const f of files) {
      const t = parseMarkdownTrace(f);
      if (t) traces.push(t);
    }
    return traces;
  } catch (err) {
    // Never crash the module — log and continue with TS seeds only.
    if (typeof console !== "undefined") {
      console.warn("[trace-registry] markdown load failed:", err);
    }
    return [];
  }
}

// ---------- Merge + cache ----------

let cached: ChangeTrace[] | null = null;

function buildAll(): ChangeTrace[] {
  const seeds = allSeededTraces;
  const seededIds = new Set(seeds.map((t) => t.id));
  const md = loadMarkdownTraces().filter((t) => !seededIds.has(t.id));
  const merged = [...seeds, ...md];
  // Newest first by createdAt (ISO string compare is lexicographic-safe for UTC).
  merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return merged.slice(0, REGISTRY_MAX);
}

// ---------- Public accessors ----------

export function getAllTraces(): ChangeTrace[] {
  if (!cached) cached = buildAll();
  return cached;
}

export function getTraceById(id: string): ChangeTrace | null {
  if (!isValidTraceId(id)) return null;
  return getAllTraces().find((t) => t.id === id) ?? null;
}

/**
 * Case-insensitive substring search over:
 *   - scenario text (all rows)
 *   - why.hook (all rows)
 *   - every symbol name in ChangeDetail (added/renamed.from/renamed.to/removed)
 *   - file paths (filesTouched + changes[].path)
 *   - trace id + tags
 *
 * Capped at 50 results.
 */
export function searchTraces(query: string): ChangeTrace[] {
  if (typeof query !== "string") return [];
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const hits: ChangeTrace[] = [];
  for (const trace of getAllTraces()) {
    if (traceMatches(trace, needle)) {
      hits.push(trace);
      if (hits.length >= SEARCH_MAX) break;
    }
  }
  return hits;
}

function traceMatches(trace: ChangeTrace, needle: string): boolean {
  if (trace.id.toLowerCase().includes(needle)) return true;
  if (trace.project.toLowerCase().includes(needle)) return true;
  for (const tag of trace.tags) {
    if (tag.toLowerCase().includes(needle)) return true;
  }
  for (const pack of trace.packsReferenced) {
    if (pack.toLowerCase().includes(needle)) return true;
  }
  for (const row of trace.rows) {
    if (rowMatches(row, needle)) return true;
  }
  return false;
}

function rowMatches(row: ChangeRow, needle: string): boolean {
  if (row.scenario.toLowerCase().includes(needle)) return true;
  if (row.why.hook.toLowerCase().includes(needle)) return true;
  if (row.why.plain.toLowerCase().includes(needle)) return true;
  for (const f of row.filesTouched) {
    if (f.toLowerCase().includes(needle)) return true;
  }
  for (const change of row.changes) {
    if (change.path.toLowerCase().includes(needle)) return true;
    if (change.diffSummary.toLowerCase().includes(needle)) return true;
    for (const s of change.symbolsAdded) {
      if (s.toLowerCase().includes(needle)) return true;
    }
    for (const s of change.symbolsRemoved) {
      if (s.toLowerCase().includes(needle)) return true;
    }
    for (const rn of change.symbolsRenamed) {
      if (
        rn.from.toLowerCase().includes(needle) ||
        rn.to.toLowerCase().includes(needle)
      ) {
        return true;
      }
    }
  }
  return false;
}

// Test-only cache reset (never called from production paths).
export function __resetTraceRegistryCacheForTest(): void {
  cached = null;
}
