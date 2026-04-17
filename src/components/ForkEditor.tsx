"use client";

/**
 * ForkEditor — textarea + preview pane for /my-packs/<slug>/edit.
 *
 * Behavior:
 *   - Textarea is the source of truth. 100kB local cap matches the server
 *     cap; bytes over the cap disable Save + surface a warning.
 *   - Autosave after 2s of idle typing (setTimeout debounce).
 *   - Explicit Save button for impatient users.
 *   - Download .md posts the current content to a blob URL.
 *   - Revert confirms, resets textarea to `sourceMarkdown`, and marks dirty
 *     so the next Save persists the reset.
 *   - Delete fork confirms, calls the API DELETE, then navigates to /my-packs.
 *   - Preview pane: uses /api/my-packs/<slug>/preview... actually we keep it
 *     simple and render client-side via the same safe renderer (imported as a
 *     pure function — no deps).
 *
 * Honest status: all errors from save/delete bubble into an inline error
 * banner. We do not silently swallow write failures.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown-render";

const MAX_BYTES = 100 * 1024;
const AUTOSAVE_IDLE_MS = 2000;

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

export type ForkEditorProps = {
  slug: string;
  sessionId: string;
  sourceVersion: string;
  initialMarkdown: string;
  /**
   * Upstream catalog markdown. Used by "Revert to catalog version". Kept
   * separate from `initialMarkdown` so revert is meaningful even on the
   * first-visit auto-hydrate (where both happen to be equal).
   */
  sourceMarkdown: string;
};

export function ForkEditor({
  slug,
  sessionId,
  sourceVersion,
  initialMarkdown,
  sourceMarkdown,
}: ForkEditorProps) {
  const router = useRouter();
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const lastSavedRef = useRef<string>(initialMarkdown);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bytes = byteLength(markdown);
  const overCap = bytes > MAX_BYTES;

  const doSave = useCallback(
    async (value: string) => {
      if (byteLength(value) > MAX_BYTES) {
        setStatus({
          kind: "error",
          message: `Fork exceeds ${Math.floor(MAX_BYTES / 1024)}kB — trim it before saving.`,
        });
        return;
      }
      setStatus({ kind: "saving" });
      try {
        const res = await fetch(`/api/my-packs/${encodeURIComponent(slug)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: value, sourceVersion }),
        });
        if (!res.ok) {
          const text = await res.text();
          setStatus({
            kind: "error",
            message: `Save failed (${res.status}): ${text.slice(0, 200) || res.statusText}`,
          });
          return;
        }
        lastSavedRef.current = value;
        setStatus({ kind: "saved", at: Date.now() });
      } catch (err) {
        setStatus({
          kind: "error",
          message: `Save failed: ${(err as Error).message}`,
        });
      }
    },
    [slug, sourceVersion],
  );

  // Autosave debounce.
  useEffect(() => {
    if (markdown === lastSavedRef.current) return;
    if (overCap) return; // don't schedule writes that will be rejected
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void doSave(markdown);
    }, AUTOSAVE_IDLE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [markdown, overCap, doSave]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [markdown, slug]);

  const handleRevert = useCallback(() => {
    const ok = window.confirm(
      "Revert your fork to the catalog version? Any local edits will be replaced.",
    );
    if (!ok) return;
    setMarkdown(sourceMarkdown);
  }, [sourceMarkdown]);

  const handleDelete = useCallback(async () => {
    const ok = window.confirm(
      `Delete your fork of "${slug}"? This cannot be undone.`,
    );
    if (!ok) return;
    setStatus({ kind: "saving" });
    try {
      const res = await fetch(`/api/my-packs/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        setStatus({
          kind: "error",
          message: `Delete failed (${res.status}): ${text.slice(0, 200) || res.statusText}`,
        });
        return;
      }
      router.push("/my-packs");
    } catch (err) {
      setStatus({
        kind: "error",
        message: `Delete failed: ${(err as Error).message}`,
      });
    }
  }, [slug, router]);

  const previewHtml = useMemo(() => renderMarkdown(markdown), [markdown]);

  const statusLine = useMemo(() => {
    switch (status.kind) {
      case "idle":
        return markdown === lastSavedRef.current ? "All changes saved" : "Unsaved changes";
      case "saving":
        return "Saving...";
      case "saved":
        return `Saved ${new Date(status.at).toLocaleTimeString()}`;
      case "error":
        return status.message;
    }
  }, [status, markdown]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Session <code className="font-mono">{sessionId}</code> · forked from
          v{sourceVersion}
        </span>
        <span>
          {bytes.toLocaleString()} / {MAX_BYTES.toLocaleString()} bytes
          {overCap ? " — OVER CAP" : ""}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="section-label" htmlFor="fork-editor-textarea">
            Markdown
          </label>
          <textarea
            id="fork-editor-textarea"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="h-[70vh] w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm leading-6 text-slate-900 shadow-inner focus:border-slate-500 focus:outline-none"
            spellCheck={false}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="section-label">Preview</span>
          <div
            className="prose prose-slate h-[70vh] max-w-none overflow-auto rounded-md border border-slate-200 bg-white px-5 py-4 text-sm leading-6 text-slate-900 shadow-inner"
            // renderMarkdown escapes first, then emits only allow-listed tags.
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={overCap || status.kind === "saving" || markdown === lastSavedRef.current}
          onClick={() => void doSave(markdown)}
        >
          Save
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800"
          onClick={handleDownload}
        >
          Download .md
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800"
          onClick={handleRevert}
        >
          Revert to catalog version
        </button>
        <button
          type="button"
          className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700"
          onClick={() => void handleDelete()}
        >
          Delete fork
        </button>
        <span
          className={`ml-auto text-xs ${
            status.kind === "error" ? "text-red-700" : "text-slate-500"
          }`}
          role="status"
          aria-live="polite"
        >
          {statusLine}
        </span>
      </div>
    </div>
  );
}
