/**
 * Thin HTTP client against the attrition.sh pack registry.
 *
 * - Base URL: ATTRITION_REGISTRY_URL env, default https://agentworkspace.attrition.sh
 * - Timeout: 10s hard budget via AbortController on every fetch
 * - Retries: none (fail fast — agents amplify every hidden stall)
 * - Bounded reads: markdown responses capped at MAX_MD_BYTES to prevent
 *   PAYLOAD_TOO_LARGE from wrecking the agent's context
 */

import type { Pack, DirectoryFilter } from "./types.js";

const DEFAULT_REGISTRY = "https://agentworkspace.attrition.sh";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_MD_BYTES = 1_000_000; // 1 MB cap on raw markdown bodies
const MAX_JSON_BYTES = 5_000_000; // 5 MB cap on JSON list responses

export class RegistryError extends Error {
  override name = "RegistryError";
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
  // Validate before use — rejects file://, javascript:, etc.
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      throw new Error(`Unsupported protocol: ${u.protocol}`);
    }
    return raw.replace(/\/+$/, "");
  } catch (err) {
    throw new RegistryError(
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
      throw new RegistryError(
        "TIMEOUT",
        `Registry request timed out after ${FETCH_TIMEOUT_MS}ms`
      );
    }
    throw new RegistryError("NETWORK_ERROR", e.message || "Network error");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read a response body with a hard byte cap. Aborts the read (not just
 * slices) when the cap is exceeded, so we never buffer gigabytes.
 */
async function readBodyBounded(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) {
    const text = await res.text();
    if (text.length > maxBytes) {
      throw new RegistryError(
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
        throw new RegistryError(
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

function buildQuery(filter: DirectoryFilter): string {
  const params = new URLSearchParams();
  if (filter.query) params.set("q", filter.query);
  if (filter.packType) params.set("packType", filter.packType);
  if (filter.canonicalPattern)
    params.set("canonicalPattern", filter.canonicalPattern);
  if (filter.trust) params.set("trust", filter.trust);
  if (typeof filter.limit === "number")
    params.set("limit", String(filter.limit));
  const q = params.toString();
  return q ? `?${q}` : "";
}

/**
 * List packs from the registry. Expects either `{ packs: Pack[] }` or
 * a bare `Pack[]` response, to be lenient with registry format drift.
 */
export async function list(filter: DirectoryFilter = {}): Promise<Pack[]> {
  const base = getBaseUrl();
  const url = `${base}/api/packs${buildQuery(filter)}`;
  const res = await timedFetch(url, "application/json");
  if (!res.ok) {
    throw new RegistryError(
      "UPSTREAM_ERROR",
      `Registry list failed: ${res.status} ${res.statusText}`
    );
  }
  const body = await readBodyBounded(res, MAX_JSON_BYTES);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new RegistryError(
      "UPSTREAM_ERROR",
      `Registry returned invalid JSON: ${(err as Error).message}`
    );
  }
  if (Array.isArray(parsed)) return parsed as Pack[];
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { packs?: unknown }).packs)
  ) {
    return (parsed as { packs: Pack[] }).packs;
  }
  throw new RegistryError(
    "UPSTREAM_ERROR",
    "Registry list response missing `packs` array"
  );
}

export async function get(slug: string): Promise<Pack> {
  const base = getBaseUrl();
  const url = `${base}/api/packs/${encodeURIComponent(slug)}`;
  const res = await timedFetch(url, "application/json");
  if (res.status === 404) {
    throw new RegistryError("NOT_FOUND", `Pack not found: ${slug}`);
  }
  if (!res.ok) {
    throw new RegistryError(
      "UPSTREAM_ERROR",
      `Registry get failed: ${res.status} ${res.statusText}`
    );
  }
  const body = await readBodyBounded(res, MAX_JSON_BYTES);
  try {
    const parsed = JSON.parse(body) as Pack | { pack: Pack };
    if (parsed && typeof parsed === "object" && "pack" in parsed) {
      return parsed.pack as Pack;
    }
    return parsed as Pack;
  } catch (err) {
    throw new RegistryError(
      "UPSTREAM_ERROR",
      `Registry returned invalid JSON: ${(err as Error).message}`
    );
  }
}

export async function getRawMarkdown(slug: string): Promise<string> {
  const base = getBaseUrl();
  const url = `${base}/packs/${encodeURIComponent(slug)}.md`;
  const res = await timedFetch(url, "text/markdown, text/plain, */*");
  if (res.status === 404) {
    throw new RegistryError(
      "NOT_FOUND",
      `Pack markdown not found: ${slug}`
    );
  }
  if (!res.ok) {
    throw new RegistryError(
      "UPSTREAM_ERROR",
      `Registry markdown fetch failed: ${res.status} ${res.statusText}`
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
