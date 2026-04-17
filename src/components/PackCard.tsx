/**
 * PackCard — canonical Pack-shape card for the directory landing.
 *
 * Consumes src/lib/pack-schema.ts `Pack`. Surfaces:
 *   - existing: name, tagline, publisher, trust badge, type chip, pattern chip
 *   - D1: compact telemetry strip (passRate · avgTokens · avgCost), or
 *         muted "Not yet measured" when telemetry is absent
 *   - J: install badge "~N installs · ~Mk tokens saved", using
 *         installCount x rediscoveryCost.tokens. Shown even at N=0 so
 *         the absence is honest, not hidden.
 *
 * Server component. Reuses existing CSS tokens (pack-card*, pack-trust-badge,
 * directory-pill, pack-status-badge) plus Tailwind utility classes for the
 * new compact strips — no new globals required.
 */

import React from "react";
import Link from "next/link";
import { PackArtwork } from "@/components/PackArtwork";
import { getPublisherProfile } from "@/lib/harness-packs";
import type { ArtworkVariant } from "@/lib/pack-art-types";
import type { Pack, Telemetry, RediscoveryCost } from "@/lib/pack-schema";

// Match the counter cap so format/truncate logic is consistent with storage.
const PER_SLUG_CAP = 1_000_000;

export function PackCard({
  pack,
  featured = false,
}: {
  pack: Pack;
  featured?: boolean;
}) {
  const publisher = getPublisherProfile(pack.publisher);
  const artworkVariant: ArtworkVariant =
    (pack.artworkVariant as ArtworkVariant | undefined) ??
    (pack.slug as ArtworkVariant);

  return (
    <Link
      href={`/packs/${pack.slug}`}
      className={`pack-card ${featured ? "pack-card-featured" : ""}`}
    >
      <div className="pack-card-hero" style={{ background: pack.gradient }}>
        <PackArtwork variant={artworkVariant} compact />
      </div>
      <div className="pack-card-body">
        <div className="flex items-center justify-between gap-3">
          <span
            className={`pack-trust-badge ${
              pack.trust === "Verified" ? "pack-trust-badge-verified" : ""
            }`}
          >
            {pack.trust}
          </span>
          <span className="pack-category-label">{pack.packType}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={pack.status} />
          {pack.canonicalPattern !== "n/a" ? (
            <span className="directory-pill directory-pill-small">
              {pack.canonicalPattern}
            </span>
          ) : null}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-950">{pack.name}</h3>
          <p className="text-sm leading-6 text-slate-600">{pack.tagline}</p>
          <p className="pack-card-summary">{pack.summary}</p>
        </div>

        {/* D1 — telemetry strip */}
        <TelemetryStrip telemetry={pack.telemetry} />

        {/* J — install + tokens-saved badge */}
        <InstallBadge
          installCount={pack.installCount ?? 0}
          rediscoveryCost={pack.rediscoveryCost}
        />

        <div className="flex flex-wrap gap-2">
          {(featured ? pack.compatibility : pack.tags).slice(0, 3).map((item) => (
            <span key={item} className="directory-pill directory-pill-small">
              {item}
            </span>
          ))}
        </div>
        <div className="pack-card-footer">
          <span className="pack-publisher-badge">
            <span className="pack-publisher-avatar" aria-hidden="true">
              {publisher?.initials ?? pack.publisher.slice(0, 2).toUpperCase()}
            </span>
            <span className="truncate">{pack.publisher}</span>
          </span>
          <span className="text-xs text-slate-500">{pack.updatedAt}</span>
        </div>
        <div className="pt-1">
          <span className="text-xs font-medium text-slate-900">Open pack →</span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Compact single-row telemetry. "pass 94% · 8.4k tok · $0.08" when present;
 * muted fallback when absent. Never synthesizes a number.
 */
export function TelemetryStrip({ telemetry }: { telemetry?: Telemetry }) {
  if (!telemetry) {
    return (
      <p
        className="text-xs leading-5 text-slate-400"
        data-testid="telemetry-absent"
      >
        Not yet measured
      </p>
    );
  }
  return (
    <p
      className="text-xs leading-5 text-slate-700"
      data-testid="telemetry-present"
    >
      <span className="font-semibold text-emerald-700">
        pass {formatPercent(telemetry.passRate)}
      </span>
      <span className="px-1 text-slate-400">·</span>
      <span>{formatTokens(telemetry.avgTokens)} tok</span>
      <span className="px-1 text-slate-400">·</span>
      <span>{formatCost(telemetry.avgCost)}</span>
    </p>
  );
}

/**
 * "~N installs · ~Mk tokens saved". Tokens-saved computed locally from
 * installCount * rediscoveryCost.tokens. If rediscoveryCost is missing,
 * renders the installs side only (honest).
 */
export function InstallBadge({
  installCount,
  rediscoveryCost,
}: {
  installCount: number;
  rediscoveryCost?: RediscoveryCost;
}) {
  const safeCount = boundedCount(installCount);
  const perInstallTokens = rediscoveryCost?.tokens ?? 0;
  const tokensSaved = safeCount * perInstallTokens;

  return (
    <p
      className="text-xs leading-5 text-amber-800"
      data-testid="install-badge"
    >
      <span className="font-medium">
        ~{formatCount(safeCount)} install{safeCount === 1 ? "" : "s"}
      </span>
      {perInstallTokens > 0 ? (
        <>
          <span className="px-1 text-slate-400">·</span>
          <span>~{formatTokens(tokensSaved)} tokens saved</span>
        </>
      ) : null}
    </p>
  );
}

function StatusBadge({ status }: { status: Pack["status"] }) {
  return (
    <span className={`pack-status-badge ${statusClassName(status)}`}>
      {status}
    </span>
  );
}

function statusClassName(status: Pack["status"]) {
  if (status === "Production-ready") return "pack-status-badge-production";
  if (status === "Recommended") return "pack-status-badge-recommended";
  return "pack-status-badge-experimental";
}

// ---- format helpers (pure, testable) ----

function boundedCount(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), PER_SLUG_CAP);
}

/**
 * 0 -> "0"
 * 1..999 -> exact
 * 1_000..999_999 -> "1.2k" / "999k"
 * >=1_000_000 -> "1M" (clamped to cap anyway)
 */
function formatCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1_000) return String(Math.floor(n));
  if (n < 1_000_000) {
    const k = n / 1_000;
    return k < 10 ? `${k.toFixed(1).replace(/\.0$/, "")}k` : `${Math.floor(k)}k`;
  }
  return "1M";
}

/**
 * "8.4k" / "120k" / "2.3M" — used for both token budgets and tokens-saved.
 */
function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1_000) return String(Math.floor(n));
  if (n < 1_000_000) {
    const k = n / 1_000;
    return k < 10 ? `${k.toFixed(1).replace(/\.0$/, "")}k` : `${Math.floor(k)}k`;
  }
  if (n < 1_000_000_000) {
    const m = n / 1_000_000;
    return m < 10 ? `${m.toFixed(1).replace(/\.0$/, "")}M` : `${Math.floor(m)}M`;
  }
  const b = n / 1_000_000_000;
  return `${b.toFixed(1).replace(/\.0$/, "")}B`;
}

/**
 * Pass rate is stored as a 0..1 fraction in Telemetry.passRate. Allow
 * legacy 0..100 values defensively.
 */
function formatPercent(rate: number): string {
  if (!Number.isFinite(rate) || rate < 0) return "0%";
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${Math.round(pct)}%`;
}

function formatCost(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(2)}`;
  if (usd < 10) return `$${usd.toFixed(2)}`;
  return `$${Math.round(usd)}`;
}

// Exposed for scripts/verify-d1-j.ts — allows re-testing the formatters
// without rendering React.
export const __formatters = {
  formatCount,
  formatTokens,
  formatPercent,
  formatCost,
  boundedCount,
};
