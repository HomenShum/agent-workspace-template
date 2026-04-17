/**
 * Aggregator for TypeScript-seeded traces.
 *
 * Traces added here are bundled at build time. The trace-registry also
 * reads docs/traces/*.md at module-load; on id collision, TS seeds win
 * (this file is the canonical source when both exist).
 */

import type { ChangeTrace } from "@/lib/trace-schema";
import { changeTrace_ct_2026_04_17 } from "@/lib/traces/ct_2026-04-17";

export const allSeededTraces: ChangeTrace[] = [changeTrace_ct_2026_04_17];
