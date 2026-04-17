/**
 * Standalone HTTP client for the attrition.sh pack registry.
 *
 * Independence note: deliberately NOT imported from the MCP server package.
 * The CLI ships as its own npm module and must not cross package boundaries.
 */

export const DEFAULT_REGISTRY = "https://agentworkspace.attrition.sh";
const DEFAULT_TIMEOUT_MS = 10_000;
const TELEMETRY_TIMEOUT_MS = 3_000;
const MAX_RESPONSE_BYTES = 2_000_000;

export type RegistryPackSummary = {
  slug: string;
  name: string;
  tagline: string;
  packType: string;
  trust: string;
  status: string;
  version: string;
  publisher: string;
};

export type RegistryPack = RegistryPackSummary & {
  summary?: string;
  rawMarkdownPath?: string;
  tags?: string[];
  updatedAt?: string;
  [k: string]: unknown;
};

export type RegistryListResponse = {
  packs: RegistryPackSummary[];
  total?: number;
};

export type RegistryError = {
  code: "TIMEOUT" | "NETWORK" | "NOT_FOUND" | "UPSTREAM" | "TOO_LARGE" | "INVALID";
  message: string;
  status?: number;
};

// ---------------------------------------------------------------------------
// Change-trace (Pillar 2) shapes
// ---------------------------------------------------------------------------

export type RegistryTraceSummary = {
  id: string;
  project?: string;
  rows?: number;
  scenarioSnippet?: string;
  createdAt?: string;
  tags?: string[];
};

export type RegistryTraceListResponse = {
  traces: RegistryTraceSummary[];
  total?: number;
};

/**
 * Minimal interface the trace-log module consumes. Keeping it separate from
 * the full RegistryClient surface lets tests inject a narrow fake without
 * reimplementing the whole client.
 */
export interface RegistryClientLike {
  listTraces(
    filter?: { q?: string; project?: string; limit?: number; since?: string }
  ): Promise<
    | { ok: true; value: RegistryTraceListResponse }
    | { ok: false; error: RegistryError }
  >;
  getTrace(
    id: string
  ): Promise<
    | { ok: true; value: unknown }
    | { ok: false; error: RegistryError }
  >;
  getRawTrace(
    id: string
  ): Promise<{ ok: true; value: string } | { ok: false; error: RegistryError }>;
  postRow(
    id: string,
    body: unknown
  ): Promise<{ ok: true; status: number } | { ok: false; error: RegistryError }>;
}

export class RegistryClient {
  readonly baseUrl: string;
  constructor(baseUrl: string = DEFAULT_REGISTRY) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request(
    path: string,
    opts: { method?: string; body?: unknown; timeoutMs?: number; accept?: string } = {}
  ): Promise<{ ok: true; status: number; body: string } | { ok: false; error: RegistryError }> {
    const controller = new AbortController();
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const url = `${this.baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        signal: controller.signal,
        headers: {
          accept: opts.accept ?? "application/json",
          "user-agent": "attrition-cli/0.1.0",
          ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });

      if (res.status === 404) {
        return { ok: false, error: { code: "NOT_FOUND", message: `Not found: ${path}`, status: 404 } };
      }
      if (!res.ok) {
        return {
          ok: false,
          error: { code: "UPSTREAM", message: `Registry error ${res.status} for ${path}`, status: res.status },
        };
      }

      // Read with a byte cap to avoid unbounded memory.
      const reader = res.body?.getReader();
      if (!reader) {
        const text = await res.text();
        if (text.length > MAX_RESPONSE_BYTES) {
          return { ok: false, error: { code: "TOO_LARGE", message: `Response exceeds ${MAX_RESPONSE_BYTES}B cap` } };
        }
        return { ok: true, status: res.status, body: text };
      }
      const chunks: Uint8Array[] = [];
      let total = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > MAX_RESPONSE_BYTES) {
            try {
              await reader.cancel();
            } catch {
              /* ignore */
            }
            return { ok: false, error: { code: "TOO_LARGE", message: `Response exceeds ${MAX_RESPONSE_BYTES}B cap` } };
          }
          chunks.push(value);
        }
      }
      const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
      return { ok: true, status: res.status, body };
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e?.name === "AbortError") {
        return { ok: false, error: { code: "TIMEOUT", message: `Timeout after ${timeoutMs}ms: ${path}` } };
      }
      return { ok: false, error: { code: "NETWORK", message: e?.message ?? "Network error" } };
    } finally {
      clearTimeout(timer);
    }
  }

  async list(query?: string): Promise<{ ok: true; value: RegistryListResponse } | { ok: false; error: RegistryError }> {
    const q = query ? `?q=${encodeURIComponent(query)}` : "";
    const res = await this.request(`/api/packs${q}`);
    if (!res.ok) return res;
    try {
      const parsed = JSON.parse(res.body) as RegistryListResponse | RegistryPackSummary[];
      const value: RegistryListResponse = Array.isArray(parsed) ? { packs: parsed, total: parsed.length } : parsed;
      return { ok: true, value };
    } catch (e) {
      return { ok: false, error: { code: "INVALID", message: "Malformed JSON from /api/packs" } };
    }
  }

  async get(slug: string): Promise<{ ok: true; value: RegistryPack } | { ok: false; error: RegistryError }> {
    const res = await this.request(`/api/packs/${encodeURIComponent(slug)}`);
    if (!res.ok) return res;
    try {
      const parsed = JSON.parse(res.body) as RegistryPack | { pack: RegistryPack };
      // Registry canonical shape is { pack: Pack }; accept bare Pack for forward-compat
      const value = (parsed && typeof parsed === "object" && "pack" in parsed)
        ? (parsed as { pack: RegistryPack }).pack
        : (parsed as RegistryPack);
      if (!value || typeof value !== "object" || typeof value.slug !== "string") {
        return { ok: false, error: { code: "INVALID", message: "Pack payload missing slug" } };
      }
      return { ok: true, value };
    } catch {
      return { ok: false, error: { code: "INVALID", message: `Malformed JSON for pack ${slug}` } };
    }
  }

  async getRawMarkdown(
    slug: string
  ): Promise<{ ok: true; value: string } | { ok: false; error: RegistryError }> {
    const res = await this.request(`/packs/${encodeURIComponent(slug)}/raw`, {
      accept: "text/markdown, text/plain, */*",
    });
    if (!res.ok) return res;
    return { ok: true, value: res.body };
  }

  // -----------------------------------------------------------------------
  // Change-trace (Pillar 2) methods
  // -----------------------------------------------------------------------

  async listTraces(
    filter?: { q?: string; project?: string; limit?: number; since?: string }
  ): Promise<
    | { ok: true; value: RegistryTraceListResponse }
    | { ok: false; error: RegistryError }
  > {
    const params = new URLSearchParams();
    if (filter?.q) params.set("q", filter.q);
    if (filter?.project) params.set("project", filter.project);
    if (typeof filter?.limit === "number") params.set("limit", String(filter.limit));
    if (filter?.since) params.set("since", filter.since);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await this.request(`/api/traces${qs}`);
    if (!res.ok) return res;
    try {
      const parsed = JSON.parse(res.body) as
        | RegistryTraceListResponse
        | RegistryTraceSummary[];
      const value: RegistryTraceListResponse = Array.isArray(parsed)
        ? { traces: parsed, total: parsed.length }
        : parsed;
      return { ok: true, value };
    } catch {
      return { ok: false, error: { code: "INVALID", message: "Malformed JSON from /api/traces" } };
    }
  }

  async getTrace(
    id: string
  ): Promise<
    | { ok: true; value: unknown }
    | { ok: false; error: RegistryError }
  > {
    const res = await this.request(`/api/traces/${encodeURIComponent(id)}`);
    if (!res.ok) return res;
    try {
      const parsed = JSON.parse(res.body) as unknown;
      // Accept both { trace } envelope and bare ChangeTrace for forward-compat.
      const value =
        parsed && typeof parsed === "object" && parsed !== null && "trace" in parsed
          ? (parsed as { trace: unknown }).trace
          : parsed;
      return { ok: true, value };
    } catch {
      return { ok: false, error: { code: "INVALID", message: `Malformed JSON for trace ${id}` } };
    }
  }

  async getRawTrace(
    id: string
  ): Promise<{ ok: true; value: string } | { ok: false; error: RegistryError }> {
    const res = await this.request(`/traces/${encodeURIComponent(id)}/raw`, {
      accept: "text/markdown, text/plain, */*",
    });
    if (!res.ok) return res;
    return { ok: true, value: res.body };
  }

  /**
   * Fire-and-forget row POST. Swallows errors. 3s timeout aligns with telemetry.
   */
  async postRow(
    id: string,
    body: unknown
  ): Promise<{ ok: true; status: number } | { ok: false; error: RegistryError }> {
    const res = await this.request(`/api/traces/${encodeURIComponent(id)}/rows`, {
      method: "POST",
      body,
      timeoutMs: TELEMETRY_TIMEOUT_MS,
    });
    if (!res.ok) return res;
    return { ok: true, status: res.status };
  }

  /**
   * Fire-and-forget telemetry POST. Errors are swallowed.
   * Callers: do NOT await blocking UX on this.
   */
  async reportInstall(payload: {
    slug: string;
    version: string;
    source: string;
  }): Promise<{ ok: boolean }> {
    try {
      const res = await this.request(`/api/installs`, {
        method: "POST",
        body: payload,
        timeoutMs: TELEMETRY_TIMEOUT_MS,
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  }
}
