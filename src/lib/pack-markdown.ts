/**
 * Serializes a Pack to raw Markdown with stable H2 anchors.
 *
 * Used by:
 *   - GET /packs/<slug>/raw route handler
 *   - scripts that export the catalog to static markdown
 *
 * Stable anchor contract (H2 sections, in this order):
 *   Summary, Install, Contract, Layers, Use When, Avoid When,
 *   Key Outcomes, Minimal Instructions, Full Instructions,
 *   Evaluation Checklist, Failure Modes, Transfer Matrix,
 *   Telemetry, Security Review, Compares With, Related Packs,
 *   Changelog, Sources, Examples
 *
 * Frontmatter is minimal YAML (no external dep) with string-safe values.
 */

import type { Pack } from "@/lib/pack-schema";

/**
 * Escape a string for safe inclusion as a YAML scalar.
 * Quotes everything to avoid ambiguity with YAML type coercion.
 */
function yamlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function renderFrontmatter(pack: Pack): string {
  const lines = [
    "---",
    `slug: ${yamlString(pack.slug)}`,
    `name: ${yamlString(pack.name)}`,
    `packType: ${yamlString(pack.packType)}`,
    `canonicalPattern: ${yamlString(pack.canonicalPattern)}`,
    `version: ${yamlString(pack.version)}`,
    `trust: ${yamlString(pack.trust)}`,
    `publisher: ${yamlString(pack.publisher)}`,
    `updatedAt: ${yamlString(pack.updatedAt)}`,
    "---",
    "",
  ];
  return lines.join("\n");
}

function renderFailureModes(items: Pack["failureModes"] | undefined): string {
  if (!items || items.length === 0) return "_None documented._\n";
  const rows = items.map((fm) => {
    const related = fm.relatedPacks && fm.relatedPacks.length > 0
      ? ` (see: ${fm.relatedPacks.join(", ")})`
      : "";
    return `- **[${fm.tier.toUpperCase()}] ${fm.symptom}**\n  - Trigger: ${fm.trigger}\n  - Prevention: ${fm.preventionCheck}${related}`;
  });
  return rows.join("\n") + "\n";
}

function renderList(items: string[] | undefined): string {
  if (!items || items.length === 0) return "_None._\n";
  return items.map((item) => `- ${item}`).join("\n") + "\n";
}

function renderJsonBlock(value: unknown): string {
  return "```json\n" + JSON.stringify(value, null, 2) + "\n```\n";
}

function renderTransferMatrix(pack: Pack): string {
  if (!pack.transferMatrix || pack.transferMatrix.length === 0) {
    return "_No measured cross-model transfer data._\n";
  }
  const header = "| Model | Pass rate | Tokens | Runs |";
  const sep = "| --- | --- | --- | --- |";
  const rows = pack.transferMatrix.map(
    (entry) =>
      `| ${entry.modelId} | ${(entry.passRate * 100).toFixed(1)}% | ${entry.tokens} | ${entry.runs} |`
  );
  return [header, sep, ...rows].join("\n") + "\n";
}

function renderTelemetry(pack: Pack): string {
  const t = pack.telemetry;
  if (!t) return "_No telemetry recorded._\n";
  const lines = [
    `- Last N runs: ${t.lastNRuns}`,
    `- Avg tokens: ${t.avgTokens}`,
    `- Avg cost: $${t.avgCost.toFixed(4)}`,
    `- Pass rate: ${(t.passRate * 100).toFixed(1)}%`,
  ];
  if (t.avgToolCalls !== undefined) lines.push(`- Avg tool calls: ${t.avgToolCalls}`);
  if (t.avgDurationSec !== undefined) lines.push(`- Avg duration: ${t.avgDurationSec}s`);
  lines.push(`- Last updated: ${t.lastUpdated}`);
  return lines.join("\n") + "\n";
}

function renderSecurityReview(pack: Pack): string {
  const s = pack.securityReview;
  if (!s) return "_No security review on file._\n";
  const parts = [
    `- Injection surface: **${s.injectionSurface}**`,
    `- Tool allow-list: ${s.toolAllowList.length ? s.toolAllowList.join(", ") : "_none specified_"}`,
    `- Last scanned: ${s.lastScanned}`,
  ];
  // Decision per spec: always include known issues in raw MD under a clearly-marked heading.
  parts.push("");
  parts.push("### Known issues");
  if (s.knownIssues.length === 0) {
    parts.push("_None reported._");
  } else {
    parts.push(...s.knownIssues.map((issue) => `- ${issue}`));
  }
  return parts.join("\n") + "\n";
}

function renderComparesWith(pack: Pack): string {
  if (!pack.comparesWith || pack.comparesWith.length === 0) {
    return "_No comparative data._\n";
  }
  const header = "| Compared to | Axis | Winner | Note |";
  const sep = "| --- | --- | --- | --- |";
  const rows = pack.comparesWith.map(
    (c) => `| \`${c.slug}\` | ${c.axis} | ${c.winner} | ${c.note} |`
  );
  return [header, sep, ...rows].join("\n") + "\n";
}

function renderChangelog(pack: Pack): string {
  if (!pack.changelog || pack.changelog.length === 0) {
    return "_No changelog entries._\n";
  }
  const blocks = pack.changelog.map((entry) => {
    const lines = [
      `### ${entry.version} — ${entry.date}`,
      entry.reason ? `_${entry.reason}_` : "",
    ].filter(Boolean);
    if (entry.added.length) {
      lines.push("", "**Added**");
      lines.push(...entry.added.map((a) => `- ${a}`));
    }
    if (entry.removed.length) {
      lines.push("", "**Removed**");
      lines.push(...entry.removed.map((r) => `- ${r}`));
    }
    return lines.join("\n");
  });
  return blocks.join("\n\n") + "\n";
}

function renderSources(pack: Pack): string {
  if (!pack.sources || pack.sources.length === 0) return "_No sources cited._\n";
  return (
    pack.sources
      .map((s) => `- [${s.label}](${s.url})${s.note ? ` — ${s.note}` : ""}`)
      .join("\n") + "\n"
  );
}

function renderExamples(pack: Pack): string {
  if (!pack.examples || pack.examples.length === 0) return "_No examples linked._\n";
  return (
    pack.examples
      .map((e) => `- [${e.label}](${e.href})${e.external ? " (external)" : ""}`)
      .join("\n") + "\n"
  );
}

function renderRelated(pack: Pack): string {
  if (!pack.relatedPacks || pack.relatedPacks.length === 0) return "_No related packs._\n";
  return pack.relatedPacks.map((slug) => `- \`${slug}\``).join("\n") + "\n";
}

/**
 * Main entry — produce a full markdown document for the pack.
 * Output is deterministic; same pack in same catalog state yields same MD.
 */
export function packToMarkdown(pack: Pack): string {
  const sections: string[] = [];

  sections.push(renderFrontmatter(pack));
  sections.push(`# ${pack.name}\n`);
  sections.push(`> ${pack.tagline}\n`);

  sections.push("## Summary\n");
  sections.push(`${pack.summary}\n`);

  sections.push("## Install\n");
  sections.push("```sh\n" + pack.installCommand + "\n```\n");
  if (pack.claudeCodeSnippet) {
    sections.push("### Claude Code / AGENTS.md snippet\n");
    sections.push("```md\n" + pack.claudeCodeSnippet + "\n```\n");
  }

  sections.push("## Contract\n");
  if (pack.contract) {
    sections.push(renderJsonBlock(pack.contract));
  } else {
    sections.push("_No execution contract defined for this pack type._\n");
  }

  sections.push("## Layers\n");
  if (pack.layers) {
    sections.push(renderJsonBlock(pack.layers));
  } else {
    sections.push("_No three-layer split defined for this pack type._\n");
  }

  sections.push("## Use When\n");
  sections.push(renderList(pack.useWhen));

  sections.push("## Avoid When\n");
  sections.push(renderList(pack.avoidWhen));

  sections.push("## Key Outcomes\n");
  sections.push(renderList(pack.keyOutcomes));

  sections.push("## Minimal Instructions\n");
  sections.push(`${pack.minimalInstructions}\n`);

  sections.push("## Full Instructions\n");
  sections.push(`${pack.fullInstructions}\n`);

  sections.push("## Evaluation Checklist\n");
  sections.push(renderList(pack.evaluationChecklist));

  sections.push("## Failure Modes\n");
  sections.push(renderFailureModes(pack.failureModes));

  sections.push("## Transfer Matrix\n");
  sections.push(renderTransferMatrix(pack));

  sections.push("## Telemetry\n");
  sections.push(renderTelemetry(pack));

  sections.push("## Security Review\n");
  sections.push(renderSecurityReview(pack));

  sections.push("## Compares With\n");
  sections.push(renderComparesWith(pack));

  sections.push("## Related Packs\n");
  sections.push(renderRelated(pack));

  sections.push("## Changelog\n");
  sections.push(renderChangelog(pack));

  sections.push("## Sources\n");
  sections.push(renderSources(pack));

  sections.push("## Examples\n");
  sections.push(renderExamples(pack));

  return sections.join("\n");
}
