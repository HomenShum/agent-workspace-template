/**
 * Section extractor. Pack markdown files use stable H2 anchors — we slice
 * from one H2 heading to the next, slugifying each heading to match the
 * caller's requested section.
 *
 * This is deliberately dumb: no markdown AST, just line-wise heading
 * detection. Code fences are respected so ``` inside a fenced block does
 * NOT end a section.
 */

export const SECTION_ENUM = [
  "summary",
  "install",
  "contract",
  "layers",
  "use-when",
  "avoid-when",
  "key-outcomes",
  "minimal-instructions",
  "full-instructions",
  "evaluation-checklist",
  "failure-modes",
  "transfer-matrix",
  "telemetry",
  "security-review",
  "compares-with",
  "related-packs",
  "changelog",
  "sources",
  "examples",
] as const;

export type SectionName = (typeof SECTION_ENUM)[number];

export function isSectionName(value: string): value is SectionName {
  return (SECTION_ENUM as readonly string[]).includes(value);
}

export function slugifyHeading(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Extract the body of the requested H2 section from a markdown document.
 * Returns null if the section is not present.
 */
export function extractSection(
  markdown: string,
  section: string
): string | null {
  const target = section.toLowerCase().trim();
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let fenceChar = "";
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const fenceMatch = /^\s*(```|~~~)/.exec(raw);
    if (fenceMatch) {
      const ch = fenceMatch[1] ?? "";
      if (!inFence) {
        inFence = true;
        fenceChar = ch;
      } else if (ch === fenceChar) {
        inFence = false;
        fenceChar = "";
      }
      continue;
    }
    if (inFence) continue;

    const h2Match = /^##\s+(.+?)\s*#*\s*$/.exec(raw);
    if (!h2Match) continue;
    const heading = h2Match[1] ?? "";
    const slug = slugifyHeading(heading);

    if (startIdx === -1 && slug === target) {
      startIdx = i + 1;
      continue;
    }
    if (startIdx !== -1) {
      endIdx = i;
      break;
    }
  }

  if (startIdx === -1) return null;
  const body = lines.slice(startIdx, endIdx).join("\n").trim();
  return body.length > 0 ? body : "";
}
