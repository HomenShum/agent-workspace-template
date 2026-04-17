/**
 * Serializes a ChangeTrace to raw Markdown with stable H2 anchors,
 * mirroring pack-markdown.ts.
 *
 * Stable anchor contract (H2, in order):
 *   Scenario, Files Touched, Changes, Why, Failure Modes,
 *   Packs Referenced, Tags, Cross-References
 *
 * Each row gets its own H2 block keyed by row index. Output matches
 * the shape in docs/CHANGE_TRACE.md §7.5 — ctrl+F-friendly plain md.
 *
 * YAML frontmatter is minimal (no external dep) with string-safe values.
 */

import type { ChangeTrace, ChangeRow, FailureMode } from "@/lib/trace-schema";

function yamlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function yamlList(values: string[]): string {
  if (values.length === 0) return "[]";
  return "[" + values.map(yamlString).join(", ") + "]";
}

function renderFrontmatter(trace: ChangeTrace): string {
  return [
    "---",
    `id: ${yamlString(trace.id)}`,
    `project: ${yamlString(trace.project)}`,
    `sessionId: ${yamlString(trace.sessionId)}`,
    `createdAt: ${yamlString(trace.createdAt)}`,
    `tags: ${yamlList(trace.tags)}`,
    `packsReferenced: ${yamlList(trace.packsReferenced)}`,
    "---",
    "",
  ].join("\n");
}

function renderList(items: string[] | undefined): string {
  if (!items || items.length === 0) return "_None._\n";
  return items.map((i) => `- ${i}`).join("\n") + "\n";
}

function renderFailureModes(items: FailureMode[] | undefined): string {
  if (!items || items.length === 0) return "_None documented._\n";
  return (
    items
      .map((fm) => {
        const related =
          fm.relatedPacks && fm.relatedPacks.length > 0
            ? ` (see: ${fm.relatedPacks.join(", ")})`
            : "";
        return `- **[${fm.tier.toUpperCase()}] ${fm.symptom}**\n  - Trigger: ${fm.trigger}\n  - Prevention: ${fm.preventionCheck}${related}`;
      })
      .join("\n") + "\n"
  );
}

function renderChanges(row: ChangeRow): string {
  if (row.changes.length === 0) return "_No file-level changes recorded._\n";
  const blocks = row.changes.map((c) => {
    const lines = [`### \`${c.path}\``, "", c.diffSummary, ""];
    if (c.symbolsAdded.length > 0) {
      lines.push(`- Added: ${c.symbolsAdded.map((s) => `\`${s}\``).join(", ")}`);
    }
    if (c.symbolsRenamed.length > 0) {
      lines.push(
        `- Renamed: ${c.symbolsRenamed
          .map((r) => `\`${r.from}\` → \`${r.to}\``)
          .join(", ")}`
      );
    }
    if (c.symbolsRemoved.length > 0) {
      lines.push(
        `- Removed: ${c.symbolsRemoved.map((s) => `\`${s}\``).join(", ")}`
      );
    }
    return lines.join("\n");
  });
  return blocks.join("\n\n") + "\n";
}

function renderWhy(row: ChangeRow): string {
  const w = row.why;
  return [
    `- **Plain:** ${w.plain}`,
    `- **Analogy:** ${w.analogy}`,
    `- **Principle:** ${w.principle}`,
    `- **Hook:** ${w.hook}`,
    "",
  ].join("\n");
}

function renderRow(row: ChangeRow, index: number): string {
  // Per-row sub-tree. Top-level H2s (Scenario / Files / Changes / Why /
  // Failure Modes) are anchored inside each row. They repeat per row —
  // that's fine for ctrl+F; the row index lives in the H1.
  const parts: string[] = [];
  parts.push(`# Row ${index + 1}`);
  parts.push("");
  parts.push("## Scenario");
  parts.push("");
  parts.push(row.scenario);
  parts.push("");
  parts.push("## Files Touched");
  parts.push("");
  parts.push(renderList(row.filesTouched));
  parts.push("## Changes");
  parts.push("");
  parts.push(renderChanges(row));
  parts.push("## Why");
  parts.push("");
  parts.push(renderWhy(row));
  parts.push("## Failure Modes");
  parts.push("");
  parts.push(renderFailureModes(row.failureModes));
  return parts.join("\n");
}

export function traceToMarkdown(trace: ChangeTrace): string {
  const out: string[] = [];
  out.push(renderFrontmatter(trace));
  out.push(`# Trace ${trace.id}`);
  out.push("");
  out.push(
    `**Project:** ${trace.project}  `
  );
  out.push(`**Session:** ${trace.sessionId}  `);
  out.push(`**Created:** ${trace.createdAt}`);
  out.push("");

  // Top-level catalog sections appear once at the head, then each row
  // repeats them. This gives stable anchors for both whole-trace and
  // per-row ctrl+F.
  out.push("## Packs Referenced");
  out.push("");
  out.push(renderList(trace.packsReferenced));
  out.push("## Tags");
  out.push("");
  out.push(renderList(trace.tags));
  out.push("## Cross-References");
  out.push("");
  // MVP: cross-refs surface only packs (ChangeRow has no explicit xref field
  // in the schema; the relatedPacks inside failureModes serve the finer link).
  out.push(
    trace.packsReferenced.length > 0
      ? `Packs consumed in this session: ${trace.packsReferenced
          .map((p) => `\`${p}\``)
          .join(", ")}\n`
      : "_No cross-references._\n"
  );

  // Anchor summary section — the top-of-doc snapshot of all rows.
  // Gives "## Scenario" etc. at the top level so the anchor check in
  // the verify script hits even if rows are empty.
  out.push("## Scenario");
  out.push("");
  if (trace.rows.length === 0) {
    out.push("_No rows recorded._\n");
  } else {
    out.push(
      trace.rows
        .map((r, i) => `${i + 1}. ${r.scenario}`)
        .join("\n") + "\n"
    );
  }
  out.push("## Files Touched");
  out.push("");
  const allFiles = Array.from(
    new Set(trace.rows.flatMap((r) => r.filesTouched))
  );
  out.push(renderList(allFiles));
  out.push("## Changes");
  out.push("");
  out.push(
    trace.rows.length === 0
      ? "_No changes recorded._\n"
      : `${trace.rows.reduce(
          (n, r) => n + r.changes.length,
          0
        )} file-level changes across ${trace.rows.length} rows.\n`
  );
  out.push("## Why");
  out.push("");
  if (trace.rows.length === 0) {
    out.push("_No Why entries recorded._\n");
  } else {
    out.push(
      trace.rows
        .map((r, i) => `${i + 1}. **${r.why.hook}** — ${r.why.plain}`)
        .join("\n") + "\n"
    );
  }
  out.push("## Failure Modes");
  out.push("");
  const allModes = trace.rows.flatMap((r) => r.failureModes ?? []);
  out.push(renderFailureModes(allModes.length > 0 ? allModes : undefined));

  // Per-row detail
  for (let i = 0; i < trace.rows.length; i++) {
    out.push("---");
    out.push("");
    out.push(renderRow(trace.rows[i], i));
  }

  return out.join("\n");
}
