/**
 * Seed trace for the session that built the Pack catalog (M1–M6) and
 * specced Pillar 2 (M7 design). Source: docs/traces/ct_2026-04-17.md.
 *
 * This file is the MVP "4 standout rows" subset — the full 15-row dump
 * lives in the markdown file and will be parsed by trace-registry once
 * the MD parser ships. Rows here correspond to rows 1, 9, 10, 11 from
 * the MD (canonical schema pinned + the three dogfood-failure rows).
 *
 * Every Why obeys the 4-line pedagogy schema (docs/CHANGE_TRACE.md §4):
 * Plain ≤15 words, Analogy ≤20, Principle ≤20, Hook ≤6.
 */

import type { ChangeTrace } from "@/lib/trace-schema";

const PACKS_REFERENCED = [
  "rag-hybrid-bm25-vector",
  "golden-eval-harness",
  "pattern-decision-tree",
  "shadcn-data-table",
  "linear-command-palette",
];

export const changeTrace_ct_2026_04_17: ChangeTrace = {
  id: "ct_2026-04-17",
  project: "agent-workspace-template",
  sessionId: "45328ba3-bd9b-41bd-aca1-845c50dce134",
  createdAt: "2026-04-17T01:50:00Z",
  tags: [
    "m1-m6",
    "pillar-2-design",
    "dogfood",
    "interface-drift",
    "eval-gate",
    "publish-prep",
    "docs-consolidation",
  ],
  packsReferenced: PACKS_REFERENCED,
  rows: [
    // Row 1 — Canonical schema pinned (blueprint before parallel work)
    {
      scenario:
        "Five parallel workers were about to build a catalog in pieces without a shared blueprint for what one entry (a pack) looks like.",
      filesTouched: ["src/lib/pack-schema.ts"],
      changes: [
        {
          path: "src/lib/pack-schema.ts",
          symbolsAdded: [
            "Pack",
            "PackContract",
            "PackLayers",
            "TransferMatrixEntry",
            "Telemetry",
            "SecurityReview",
            "PackComparison",
            "ChangelogEntry",
            "PackSource",
          ],
          symbolsRenamed: [],
          symbolsRemoved: [],
          diffSummary:
            "+9 TypeScript types locking the Pack shape for five parallel workers. Blueprint only, no runtime code.",
        },
      ],
      why: {
        plain:
          "Pick one shape for the data before five workers start using it.",
        analogy:
          "Like everyone agreeing on paper size before the printers start running.",
        principle:
          "A shared schema is the contract that lets parallel work converge. Without it every worker drifts.",
        hook: "Pin the shape before the work.",
      },
      failureModes: [
        {
          symptom:
            "Two parallel workers ship incompatible shapes; integration fails at the wire.",
          trigger:
            "No shared type pinned before parallel work starts; each worker invents its own.",
          preventionCheck:
            "Pin the canonical schema before parallel fan-out; add a type-compile gate on merge.",
          tier: "mid",
          relatedPacks: ["pattern-decision-tree"],
        },
      ],
    },

    // Row 9 — Envelope-shape drift (first dogfood fail)
    {
      scenario:
        "First real CLI install failed: [INVALID] Failed to fetch pack metadata: Pack payload missing slug. The API returned { pack: {...} }; the CLI expected the pack object bare.",
      filesTouched: ["cli/src/registry.ts"],
      changes: [
        {
          path: "cli/src/registry.ts",
          symbolsAdded: [],
          symbolsRenamed: [],
          symbolsRemoved: [],
          diffSummary:
            "RegistryClient.get(): parse → (parsed && 'pack' in parsed) ? parsed.pack : parsed. Envelope-aware unwrap.",
        },
      ],
      why: {
        plain:
          "Two workers wrapped the data differently, so nothing flowed through.",
        analogy:
          "Like mailing a letter — one uses an envelope, the other hands it bare. Receiver only opens envelopes.",
        principle:
          "Shape is part of the contract. Mocks hide shape drift; only a real handshake reveals it.",
        hook: "Mocks lie. Dogfood the handshake.",
      },
      failureModes: [
        {
          symptom:
            "Unit tests green, first real install fails: 'Pack payload missing slug'.",
          trigger:
            "API and CLI each mocked the counterparty; contract envelope drifted undetected.",
          preventionCheck:
            "End-to-end contract test that spans real API + real CLI + real filesystem. No mocks at the boundary.",
          tier: "sr",
          relatedPacks: ["golden-eval-harness"],
        },
      ],
    },

    // Row 10 — Raw-MD path drift (second dogfood fail)
    {
      scenario:
        "Retry after the envelope fix: metadata OK but [NOT_FOUND] /api/packs/<slug>/raw. Raw MD is a content route under /packs, not an API route.",
      filesTouched: ["cli/src/registry.ts"],
      changes: [
        {
          path: "cli/src/registry.ts",
          symbolsAdded: [],
          symbolsRenamed: [],
          symbolsRemoved: [],
          diffSummary:
            "getRawMarkdown(): path /api/packs/*/raw → /packs/*/raw. Content lives under /packs; /api is JSON only.",
        },
      ],
      why: {
        plain:
          "The CLI asked for the file at the wrong address. Right house, wrong street.",
        analogy:
          "Like mailing a letter to '42 Main' when the house is '42 Elm.' Post office returns it even though the building exists.",
        principle:
          "URLs group by content type, not by caller. /api means data; /packs means content.",
        hook: "Group by content type, not caller.",
      },
    },

    // Row 11 — Windows EPERM retry (concurrent install race)
    {
      scenario:
        "5 concurrent install tests hit random Windows EPERM on fs.rename against a shared AGENTS.md destination.",
      filesTouched: ["cli/src/install.ts"],
      changes: [
        {
          path: "cli/src/install.ts",
          symbolsAdded: [],
          symbolsRenamed: [],
          symbolsRemoved: [],
          diffSummary:
            "atomicWriteFile(): add EPERM/EACCES/EBUSY retry with backoff; preserve write-before-rename semantics.",
        },
      ],
      why: {
        plain:
          "Five installs ran at once and Windows said 'busy' even though nothing was wrong.",
        analogy:
          "Five people trying to swap the same bookmark in one book. The book allows one swap at a time; others wait a beat.",
        principle:
          "Atomicity on rename is OS-dependent. When the OS serializes a shared resource, retry turns the race into a queue.",
        hook: "If the OS says 'busy,' wait a beat.",
      },
    },
  ],
};
