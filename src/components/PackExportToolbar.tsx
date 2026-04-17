"use client";

/**
 * PackExportToolbar — three-button toolbar at the top of the Notion-style
 * pack detail page.
 *
 * Buttons:
 *   1. Download .md — plain <a download> on /packs/<slug>/raw. Static, no JS path.
 *   2. Copy as markdown — fetches /packs/<slug>/raw, writes to clipboard.
 *      Shows "Copied ✓" for 2s after success, "Copy failed" for 2s on error.
 *   3. Fork to workspace — plain <Link> to /my-packs/<slug>/edit. That route
 *      is built by a separate agent task; this component links unconditionally.
 *
 * Client component because of navigator.clipboard. Kept intentionally small —
 * one state hook, one async handler, no libraries.
 */

import Link from "next/link";
import { useState, useCallback } from "react";

type CopyState = "idle" | "copied" | "error";

export function PackExportToolbar({ slug }: { slug: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const rawPath = `/packs/${slug}/raw`;
  const forkPath = `/my-packs/${slug}/edit`;

  const handleCopy = useCallback(async () => {
    try {
      const res = await fetch(rawPath, { cache: "no-store" });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const body = await res.text();
      await navigator.clipboard.writeText(body);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    // Reset after 2s regardless of outcome.
    setTimeout(() => setCopyState("idle"), 2000);
  }, [rawPath]);

  const copyLabel =
    copyState === "copied"
      ? "Copied ✓"
      : copyState === "error"
        ? "Copy failed"
        : "Copy as markdown";

  return (
    <div
      className="notion-toolbar"
      role="toolbar"
      aria-label="Export pack"
      data-testid="pack-export-toolbar"
    >
      <a
        href={rawPath}
        download
        className="notion-toolbar-button"
        data-testid="pack-export-download"
      >
        Download .md
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="notion-toolbar-button"
        data-testid="pack-export-copy"
        aria-live="polite"
      >
        {copyLabel}
      </button>
      <Link
        href={forkPath}
        className="notion-toolbar-button notion-toolbar-button-primary"
        data-testid="pack-export-fork"
      >
        Fork to workspace
      </Link>
    </div>
  );
}
