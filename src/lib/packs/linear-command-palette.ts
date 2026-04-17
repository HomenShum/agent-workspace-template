import type { Pack } from "@/lib/pack-schema";

/**
 * Linear Command Palette pack.
 *
 * Ships the Cmd+K pattern as popularised by Linear: grouped results,
 * keyboard-first navigation, recent items, empty state, full ARIA
 * combobox semantics. Implementation references the `cmdk` primitive
 * by pacocoursey (the same primitive used by Vercel and shadcn/ui).
 */
export const linearCommandPalette: Pack = {
  slug: "linear-command-palette",
  name: "Linear-style Command Palette",
  tagline: "Cmd+K done right: grouped, keyboard-first, fully accessible.",
  summary:
    "A production-grade Cmd+K command palette matching the Linear implementation: debounced fuzzy search, grouped sections (Issues, Projects, Actions), recent items, empty state, and WAI-ARIA 1.2 combobox semantics. Drops onto any React app via the cmdk primitive.",
  packType: "ui",
  canonicalPattern: "n/a",
  version: "0.1.0",

  trust: "Community",
  status: "Recommended",
  featured: false,
  publisher: "Agent Workspace",
  gradient: "from-sky-500 via-indigo-500 to-purple-600",
  updatedAt: "2026-04-16",
  compatibility: ["claude-code", "cursor", "next-app-router", "vite-react"],
  tags: ["ui", "command-palette", "cmdk", "a11y", "keyboard-nav", "react"],

  installCommand: "npx attrition-sh pack install linear-command-palette",
  claudeCodeSnippet:
    "Skill `linear-command-palette` is installed at .claude/skills/linear-command-palette/SKILL.md. Invoke it whenever the user asks for a command palette, Cmd+K UI, quick-switcher, or Spotlight-style picker. Prefer cmdk + Radix Dialog; preserve the ARIA combobox pattern; never ship without debounced search and a keyboard-only test pass.",
  rawMarkdownPath: "/packs/linear-command-palette/raw",

  useWhen: [
    "You need fast in-app navigation across 100+ entities (issues, docs, people).",
    "Mouse-first menus are slowing power users down.",
    "You want a single surface for actions + navigation + search.",
    "Your users expect Linear/Vercel/GitHub-class keyboard UX.",
  ],
  avoidWhen: [
    "Your app has fewer than ~20 navigation targets — a sidebar is simpler.",
    "The target audience is non-technical and unlikely to discover Cmd+K.",
    "You cannot guarantee a stable debounced backend search (<150ms p95).",
    "You need multi-select or complex filtering — use a data table instead.",
  ],
  keyOutcomes: [
    "p95 palette-open-to-first-keystroke under 60ms on mid-tier laptops.",
    "Zero mouse required: open, search, arrow-navigate, select, close.",
    "WAI-ARIA combobox pattern passes axe-core and NVDA smoke tests.",
    "Recent items surface on empty query; grouped sections on typed query.",
  ],

  minimalInstructions: `## Minimal setup (plug-and-play)

\`\`\`bash
pnpm add cmdk
\`\`\`

\`\`\`tsx
// components/command-palette.tsx
"use client";
import { Command } from "cmdk";
import { useEffect, useState } from "react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      shouldFilter={false} // server-side search
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder="Search issues, projects, actions…"
      />
      <Command.List>
        <Command.Empty>No results.</Command.Empty>
        <Command.Group heading="Actions">
          <Command.Item onSelect={() => setOpen(false)}>Create issue</Command.Item>
          <Command.Item onSelect={() => setOpen(false)}>Go to inbox</Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
\`\`\`

Mount once in your root layout. That's the 80% version.`,

  fullInstructions: `## Full reference: production palette

### 1. Architecture

A Linear-grade palette has four concerns, and each maps to a distinct module:

| Concern | Module | Notes |
|---|---|---|
| Trigger + open state | \`usePaletteHotkey\` | Cmd/Ctrl+K, ESC to close, scoped per-page overrides |
| Search orchestration | \`usePaletteSearch\` | Debounce 120ms, abort in-flight, SWR dedupe |
| Result grouping | \`groupResults()\` | Order: Recent > Exact > Fuzzy; cap each group at 5 |
| A11y shell | \`cmdk\` + Radix Dialog | Combobox semantics free out-of-the-box |

### 2. ARIA combobox pattern (WAI-ARIA 1.2)

The palette is a combobox whose popup is a listbox. \`cmdk\` already wires this up, but if you are rolling your own, the required attributes are:

- Wrapper: \`role="combobox" aria-expanded="true" aria-haspopup="listbox" aria-controls="{listId}"\`
- Input: \`aria-autocomplete="list" aria-activedescendant="{activeItemId}"\`
- List: \`role="listbox" id="{listId}"\`
- Items: \`role="option" aria-selected={isActive} id="{itemId}"\`

\`aria-activedescendant\` is the key trick: focus stays on the input while arrow keys move a virtual cursor. Screen readers announce the active option because the input's descendant changes.

### 3. Debounced search with abort

Server round-trips must not race. Use an \`AbortController\` keyed by query:

\`\`\`tsx
function usePaletteSearch(query: string) {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) { setResults([]); return; }
    const ac = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(\`/api/search?q=\${encodeURIComponent(query)}\`, { signal: ac.signal });
        setResults(await r.json());
      } catch (e) {
        if ((e as Error).name !== "AbortError") throw e;
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => { clearTimeout(t); ac.abort(); };
  }, [query]);

  return { results, loading };
}
\`\`\`

### 4. Grouped results

\`\`\`tsx
<Command.List>
  {query === "" && recent.length > 0 && (
    <Command.Group heading="Recent">
      {recent.map((r) => <ItemRow key={r.id} item={r} />)}
    </Command.Group>
  )}
  <Command.Group heading="Issues">
    {issues.slice(0, 5).map((i) => <ItemRow key={i.id} item={i} />)}
  </Command.Group>
  <Command.Group heading="Projects">
    {projects.slice(0, 5).map((p) => <ItemRow key={p.id} item={p} />)}
  </Command.Group>
  <Command.Group heading="Actions">
    {actions.map((a) => <ActionRow key={a.id} action={a} />)}
  </Command.Group>
</Command.List>
\`\`\`

### 5. Recent items

Persist the last 8 selected items to \`localStorage\` (keyed by workspace + user). Load synchronously on mount to avoid flash. Evict the oldest when capacity is hit. Linear's implementation also decays by last-used-timestamp rather than insertion order — worthwhile if session length is long.

### 6. Empty and loading states

- Empty + no query: show "Recent" group if any; otherwise a short tip ("Try searching for an issue or typing a command").
- Empty + query + loading: show a skeleton of 3 rows (never a spinner; spinners feel slower).
- Empty + query + done: \`<Command.Empty>No results for "{query}".</Command.Empty>\` plus a "Create new issue titled …" escape hatch — the move Linear popularised.

### 7. Keyboard shortcuts

| Key | Action |
|---|---|
| Cmd/Ctrl+K | Toggle |
| ↑ / ↓ | Move cursor |
| Enter | Select |
| Esc | Close (preserve query if user re-opens within 10s) |
| Cmd/Ctrl+1..9 | Jump to the Nth group's first item (Linear-specific) |
| Tab | Focus the filter chip row (if present) |

### 8. Performance budgets

- Bundle: cmdk ~3.5kB gzipped. Keep the palette chunk under 15kB including icons.
- Open-to-interactive: <60ms p95. Pre-mount the dialog \`hidden\`; do not lazy-import on first open.
- Search p95: 150ms end-to-end. If your backend is slower, render optimistic "Recent" hits while the fetch returns.

### 9. Accessibility checklist

- [ ] Passes axe-core with zero violations on the open palette
- [ ] NVDA announces active item on arrow navigation
- [ ] VoiceOver reads group headings
- [ ] Focus trap within dialog (Radix Dialog handles this)
- [ ] Return focus to the element that opened the palette on close
- [ ] prefers-reduced-motion: disable the open/close transform

### 10. Testing

- Unit: \`groupResults()\` ordering & cap logic.
- Integration (Playwright): hotkey opens, arrow navigation, enter selects, esc closes.
- A11y: \`@axe-core/playwright\` scan post-open.

### 11. Common pitfalls

1. Setting \`shouldFilter\` to \`true\` with server-side results — cmdk filters again client-side and your results collapse.
2. Focusing the input manually — \`Command.Input\` auto-focuses. Manual focus calls fight Radix's focus-lock.
3. Recent items backed by React state instead of localStorage — resets on navigation.
4. Missing \`aria-activedescendant\` — screen-reader users hear nothing on arrow keys.`,

  evaluationChecklist: [
    "Cmd+K on any page opens the palette in <60ms p95 (DevTools performance profile).",
    "Arrow keys move the highlighted item; Enter selects; Esc closes and returns focus.",
    "Empty query shows Recent group; typed query shows grouped Issues/Projects/Actions.",
    "axe-core scan on the open palette reports zero violations.",
    "Search fetch is debounced 100–150ms and prior in-flight requests are aborted.",
    "Reduced-motion preference disables the open/close transition.",
    "Mobile Safari: virtual keyboard does not push the input off-screen.",
  ],
  failureModes: [
    {
      symptom: "First Cmd+K press flashes a white rectangle for 200ms",
      trigger: "cmdk lazy-imported; dialog mounts on first open",
      preventionCheck: "Import cmdk statically; keep the dialog mounted with `open={false}`",
      tier: "mid",
    },
    {
      symptom: "Screen-reader users can't navigate results with arrow keys",
      trigger: "Missing `aria-activedescendant` on the combobox",
      preventionCheck: "Use cmdk (handles it) or manually wire the attribute to the active item's id",
      tier: "sr",
    },
    {
      symptom: "Results briefly show wrong matches then correct themselves",
      trigger: "cmdk built-in client filter layered on top of server-filtered results",
      preventionCheck: "Set `shouldFilter={false}` when your backend owns search",
      tier: "mid",
    },
    {
      symptom: "Cmd+K triggers the palette while typing in an embedded code editor",
      trigger: "Hotkey listener fires unconditionally at window scope",
      preventionCheck: "Skip when `event.target.isContentEditable` or Monaco/CodeMirror has focus",
      tier: "sr",
    },
  ],

  securityReview: {
    injectionSurface: "low",
    toolAllowList: [],
    lastScanned: "2026-04-16",
    knownIssues: [],
  },

  rediscoveryCost: {
    tokens: 18000,
    minutes: 35,
    measuredAt: "2026-04-16",
    methodology:
      "Prompted a fresh Claude Sonnet 4.6 session with 'build a Linear-style command palette in React with full a11y'. Measured tokens until the output included cmdk, debounced abort, grouped results, recent items, and aria-activedescendant semantics. Averaged across 3 runs.",
  },

  relatedPacks: ["shadcn-data-table", "pattern-decision-tree"],
  requires: [],
  conflictsWith: [],
  supersedes: [],
  comparesWith: [
    {
      slug: "shadcn-data-table",
      axis: "complexity",
      winner: "tie",
      note: "Different concerns: palette for global nav/actions, data table for structured records. Use both together.",
    },
    {
      slug: "raycast-style-palette",
      axis: "complexity",
      winner: "tie",
      note: "Raycast palette adds extensions/scripting surface. Linear-style is simpler and sufficient for in-app navigation.",
    },
  ],

  changelog: [
    {
      version: "0.1.0",
      date: "2026-04-16",
      added: [
        "Initial pack with cmdk-based minimal setup",
        "Full ARIA 1.2 combobox reference",
        "Debounced-abort search recipe",
        "Grouped results and recent items pattern",
      ],
      removed: [],
      reason: "Seed pack — first release.",
    },
  ],

  metrics: [
    { label: "Typical tokens saved", value: "18k" },
    { label: "Bundle add", value: "~3.5kB gz" },
    { label: "p95 open time", value: "<60ms" },
  ],

  sources: [
    {
      label: "Linear — How we built our command menu",
      url: "https://linear.app/blog/how-we-built-our-command-menu",
      note: "Primary source on the original design intent: grouped results, actions-first, Cmd+K normalisation.",
    },
    {
      label: "cmdk by pacocoursey",
      url: "https://github.com/pacocoursey/cmdk",
      note: "The React primitive that encodes the combobox pattern. Used by Vercel, Linear's web clone, shadcn/ui.",
    },
    {
      label: "WAI-ARIA 1.2 — Combobox pattern",
      url: "https://www.w3.org/WAI/ARIA/apg/patterns/combobox/",
      note: "Authoritative spec for combobox + listbox semantics with aria-activedescendant.",
    },
    {
      label: "shadcn/ui — Command component",
      url: "https://ui.shadcn.com/docs/components/command",
      note: "Battle-tested styled wrapper over cmdk. Matches the visual grammar used in most 2025+ React apps.",
    },
  ],
  examples: [
    {
      label: "Linear's palette (live reference)",
      href: "https://linear.app",
      external: true,
    },
    {
      label: "shadcn/ui command demo",
      href: "https://ui.shadcn.com/docs/components/command",
      external: true,
    },
  ],
};

export default linearCommandPalette;
