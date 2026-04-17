/**
 * Thin HTTP client against the attrition.sh change-trace catalog (Pillar 2).
 *
 * Mirrors `registry.ts` patterns exactly:
 *   - Base URL: ATTRITION_REGISTRY_URL env, default https://agentworkspace.attrition.sh
 *   - 10s hard budget via AbortController on every fetch
 *   - No retries (fail fast — agents amplify every hidden stall)
 *   - Bounded reads: 5 MB JSON cap, 1 MB markdown cap
 *   - URL validated before first fetch (SSRF guard — http/https only)
 *
 * Forward-compat: accepts both `{ trace: ... }` / `{ traces: [...], total }`
 * envelopes AND bare `ChangeTrace` / `ChangeTrace[]` responses. This is the
 * same lenience the CLI learned the hard way during M2↔M4 drift and the
 * pack-registry client already applies to single-pack fetches.
 *
 * Typed error returns: every public method either resolves with the parsed
 * body OR throws a `TraceRegistryError` with a stable `code`. The caller in
 * `index.ts` catches and maps to the MCP error envelope.
 */

import type {
  ChangeTrace,
  TraceListFilter,
  TraceListResponse,
} from "./trace-types.js";

const DEFAULT_REGISTRY = "https://agentworkspace.attrition.sh";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_MD_BYTES = 1_000_000; // 1 MB cap on raw markdown bodies
const MAX_JSON_BYTES = 5_000_000; // 5 MB cap on JSON list responses

export class TraceRegistryError extends Error {
  override name = "TraceRegistryError";
  constructor(
    public readonly code:
      | "TIMEOUT"
      | "NOT_FOUND"
      | "PAYLOAD_TOO_LARGE"
      | "UPSTREAM_ERROR"
      | "NETWORK_ERROR",
    message: string
  ) {
    super(message);
  }
}

function getBaseUrl(): string {
  const raw = process.env.ATTRITION_REGISTRY_URL?.trim();
  if (!raw) return DEFAULT_REGISTRY;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      throw new Error(`Unsupported protocol: ${u.protocol}`);
    }
    return raw.replace(/\/+$/, "");
  } catch (err) {
    throw new TraceRegistryError(
      "UPSTREAM_ERROR",
      `Invalid ATTRITION_REGISTRY_URL: ${(err as Error).message}`
    );
  }
}

async function timedFetch(url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: accept,
        "User-Agent": "attrition-mcp/0.1.0",
      },
    });
    return res;
  } catch (err) {
    const e = err as Error & { name?: string };
    if (e.name === "AbortError") {
      throw new TraceRegistryError(
        "TIMEOUT",
        `Trace registry request timed out after ${FETCH_TIMEOUT_MS}ms`
      );
    }
    throw new TraceRegistryError(
      "NETWORK_ERROR",
      e.message || "Network error"
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Stream-decode with a hard byte cap. Matches the pack-registry client.
 */
async function readBodyBounded(
  res: Response,
  maxBytes: number
): Promise<string> {
  if (!res.body) {
    const text = await res.text();
    if (text.length > maxBytes) {
      throw new TraceRegistryError(
        "PAYLOAD_TOO_LARGE",
        `Response exceeds ${maxBytes} bytes`
      );
    }
    return text;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let out = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          /* noop */
        }
        throw new TraceRegistryError(
          "PAYLOAD_TOO_LARGE",
          `Response exceeds ${maxBytes} bytes`
        );
      }
      out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
    return out;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}

function buildQuery(filter: TraceListFilter): string {
  const params = new URLSearchParams();
  if (filter.query) params.set("q", filter.query);
  if (filter.project) params.set("project", filter.project);
  if (filter.symbol) params.set("symbol", filter.symbol);
  if (filter.sinceDate) params.set("since", filter.sinceDate);
  if (typeof filter.limit === "number")
    params.set("limit", String(filter.limit));
  if (typeof filter.offset === "number")
    params.set("offset", String(filter.offset));
  const q = params.toString();
  return q ? `?${q}` : "";
}

/**
 * List traces. Accepts either:
 *   `{ traces: ChangeTrace[], total: number, filters?: {...} }`  (canonical)
 *   `ChangeTrace[]`                                              (forward-compat)
 * In the bare-array case we synthesize `total` from the array length and
 * leave `filters` undefined.
 */
export async function listTraces(
  filter: TraceListFilter = {}
): Promise<TraceListResponse> {
  const base = getBaseUrl();
  const url = `${base}/api/traces${buildQuery(filter)}`;
  const res = await timedFetch(url, "application/json");
  if (!res.ok) {
    throw new TraceRegistryError(
      "UPSTREAM_ERROR",
      `Trace registry list failed: ${res.status} ${res.statusText}`
    );
  }
  const body = await readBodyBounded(res, MAX_JSON_BYTES);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new TraceRegistryError(
      "UPSTREAM_ERROR",
      `Trace registry returned invalid JSON: ${(err as Error).message}`
    );
  }
  if (Array.isArray(parsed)) {
    const traces = parsed as ChangeTrace[];
    return { traces, total: traces.length };
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { traces?: unknown }).traces)
  ) {
    const obj = parsed as {
      traces: ChangeTrace[];
      total?: number;
      filters?: Record<string, unknown>;
    };
    return {
      traces: obj.traces,
      total: typeof obj.total === "number" ? obj.total : obj.traces.length,
      filters: obj.filters,
    };
  }
  throw new TraceRegistryError(
    "UPSTREAM_ERROR",
    "Trace registry list response missing `traces` array"
  );
}

/**
 * Fetch a single trace by id. Accepts either `{ trace: ChangeTrace }`
 * (canonical) or a bare `ChangeTrace` (forward-compat).
 *
 * Caller MUST pre-validate id via `isValidTraceId` — this function does
 * URL-encode, but treats raw id as opaque; validation happens upstream.
 */
export async function getTrace(id: string): Promise<ChangeTrace> {
  const base = getBaseUrl();
  const url = `${base}/api/traces/${encodeURIComponent(id)}`;
  const res = await timedFetch(url, "application/json");
  if (res.status === 404) {
    throw new TraceRegistryError("NOT_FOUND", `Trace not found: ${id}`);
  }
  if (!res.ok) {
    throw new TraceRegistryError(
      "UPSTREAM_ERROR",
      `Trace registry get failed: ${res.status} ${res.statusText}`
    );
  }
  const body = await readBodyBounded(res, MAX_JSON_BYTES);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new TraceRegistryError(
      "UPSTREAM_ERROR",
      `Trace registry returned invalid JSON: ${(err as Error).message}`
    );
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    "trace" in parsed &&
    (parsed as { trace?: unknown }).trace &&
    typeof (parsed as { trace?: unknown }).trace === "object"
  ) {
    return (parsed as { trace: ChangeTrace }).trace;
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    "id" in parsed &&
    "rows" in parsed
  ) {
    return parsed as ChangeTrace;
  }
  throw new TraceRegistryError(
    "UPSTREAM_ERROR",
    "Trace registry response missing `trace` envelope and not a bare ChangeTrace"
  );
}

/**
 * Fetch the raw markdown rendering of a trace (stable H2 anchors:
 * Scenario / Files Touched / Changes / Why / Failure Modes /
 * Packs Referenced / Tags / Cross-References).
 */
export async function getRawTrace(id: string): Promise<string> {
  const base = getBaseUrl();
  const url = `${base}/traces/${encodeURIComponent(id)}/raw`;
  const res = await timedFetch(url, "text/markdown, text/plain, */*");
  if (res.status === 404) {
    throw new TraceRegistryError(
      "NOT_FOUND",
      `Trace markdown not found: ${id}`
    );
  }
  if (!res.ok) {
    throw new TraceRegistryError(
      "UPSTREAM_ERROR",
      `Trace markdown fetch failed: ${res.status} ${res.statusText}`
    );
  }
  return readBodyBounded(res, MAX_MD_BYTES);
}

export const __testing = {
  FETCH_TIMEOUT_MS,
  MAX_MD_BYTES,
  MAX_JSON_BYTES,
  getBaseUrl,
};
