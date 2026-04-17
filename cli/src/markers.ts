/**
 * AGENTS.md marker utilities. Enforces unique start/end markers so an install
 * can be upserted idempotently, and detects corruption (unbalanced markers).
 */

export function startMarker(slug: string): string {
  return `<!-- attrition:pack:${slug}:start -->`;
}

export function endMarker(slug: string): string {
  return `<!-- attrition:pack:${slug}:end -->`;
}

export type MarkerState =
  | { kind: "absent" }
  | { kind: "present"; startIdx: number; endIdx: number }
  | { kind: "corrupt"; reason: string };

export function findMarkers(content: string, slug: string): MarkerState {
  const start = startMarker(slug);
  const end = endMarker(slug);
  const startMatches: number[] = [];
  const endMatches: number[] = [];
  let i = 0;
  while (true) {
    const s = content.indexOf(start, i);
    if (s === -1) break;
    startMatches.push(s);
    i = s + start.length;
  }
  i = 0;
  while (true) {
    const e = content.indexOf(end, i);
    if (e === -1) break;
    endMatches.push(e);
    i = e + end.length;
  }
  if (startMatches.length === 0 && endMatches.length === 0) return { kind: "absent" };
  if (startMatches.length > 1 || endMatches.length > 1) {
    return { kind: "corrupt", reason: `duplicate markers for '${slug}' in AGENTS.md` };
  }
  if (startMatches.length === 1 && endMatches.length === 0) {
    return { kind: "corrupt", reason: `start marker for '${slug}' found but no matching end marker` };
  }
  if (startMatches.length === 0 && endMatches.length === 1) {
    return { kind: "corrupt", reason: `end marker for '${slug}' found but no matching start marker` };
  }
  const sIdx = startMatches[0]!;
  const eIdx = endMatches[0]!;
  if (eIdx < sIdx) {
    return { kind: "corrupt", reason: `end marker precedes start marker for '${slug}'` };
  }
  return { kind: "present", startIdx: sIdx, endIdx: eIdx };
}

export type FragmentInput = {
  slug: string;
  name: string;
  tagline: string;
  version: string;
  installedAt: string;
};

export function buildFragment(f: FragmentInput): string {
  const lines = [
    startMarker(f.slug),
    `<!-- Managed by attrition CLI — do not edit between markers -->`,
    `### ${f.name} (\`${f.slug}\` v${f.version})`,
    ``,
    `${f.tagline}`,
    ``,
    `- Skill path: \`.claude/skills/${f.slug}/SKILL.md\``,
    `- Installed: ${f.installedAt}`,
    ``,
    endMarker(f.slug),
  ];
  return lines.join("\n");
}

/**
 * Idempotent upsert: returns the updated AGENTS.md content.
 * Throws on marker corruption so callers can surface a clear error.
 */
export function upsertFragment(existing: string | null, fragment: FragmentInput): string {
  const content = existing ?? "";
  const state = findMarkers(content, fragment.slug);
  const newFragment = buildFragment(fragment);
  if (state.kind === "corrupt") {
    throw new Error(
      `AGENTS.md marker corruption: ${state.reason}. Fix manually (remove the unbalanced ` +
        `attrition:pack:${fragment.slug}:* markers) and retry.`
    );
  }
  if (state.kind === "absent") {
    if (content.length === 0) {
      return `# Agents\n\n${newFragment}\n`;
    }
    const sep = content.endsWith("\n") ? "\n" : "\n\n";
    return `${content}${sep}${newFragment}\n`;
  }
  // present — replace between and including markers
  const before = content.slice(0, state.startIdx);
  // find end of end-marker line
  const endToken = endMarker(fragment.slug);
  const afterStart = state.endIdx + endToken.length;
  const after = content.slice(afterStart);
  return `${before}${newFragment}${after}`;
}

export function removeFragment(existing: string, slug: string): string {
  const state = findMarkers(existing, slug);
  if (state.kind !== "present") return existing;
  const endToken = endMarker(slug);
  const before = existing.slice(0, state.startIdx).replace(/\n+$/, "\n");
  const after = existing.slice(state.endIdx + endToken.length).replace(/^\n+/, "\n");
  return `${before}${after}`;
}
