"use client";

/**
 * ComparePicker — GET-form picker for the `/compare` landing.
 *
 * Minimal client boundary: two grouped <select> elements and a submit
 * button, all wired to a GET form. No new deps. Selecting values and
 * submitting navigates to `/compare?a=<slug>&b=<slug>`.
 *
 * Highlight: when one of a/b is pre-populated (e.g. `/compare?a=foo`),
 * the missing side gets a visual cue so the user sees what to fill.
 */

import { useState } from "react";

type Group = [string, { slug: string; name: string }[]];

export default function ComparePicker({
  groups,
  selectedA,
  selectedB,
  highlight,
}: {
  groups: Group[];
  selectedA?: string;
  selectedB?: string;
  highlight?: "a" | "b";
}) {
  const [a, setA] = useState(selectedA ?? "");
  const [b, setB] = useState(selectedB ?? "");

  const aRing =
    highlight === "a"
      ? "ring-2 ring-amber-400"
      : "ring-1 ring-[rgba(72,57,39,0.12)]";
  const bRing =
    highlight === "b"
      ? "ring-2 ring-amber-400"
      : "ring-1 ring-[rgba(72,57,39,0.12)]";

  const canSubmit = a !== "" && b !== "" && a !== b;

  return (
    <form action="/compare" method="get" className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          Pack A
        </span>
        <select
          name="a"
          value={a}
          onChange={(e) => setA(e.target.value)}
          aria-label="Pack A"
          data-testid="compare-picker-a"
          className={`w-full rounded-[14px] bg-white px-3 py-2.5 text-sm text-slate-900 ${aRing} focus:outline-none focus:ring-2 focus:ring-sky-400`}
        >
          <option value="">— pick a pack —</option>
          {groups.map(([type, items]) => (
            <optgroup key={type} label={type}>
              {items.map((it) => (
                <option key={it.slug} value={it.slug}>
                  {it.name} ({it.slug})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          Pack B
        </span>
        <select
          name="b"
          value={b}
          onChange={(e) => setB(e.target.value)}
          aria-label="Pack B"
          data-testid="compare-picker-b"
          className={`w-full rounded-[14px] bg-white px-3 py-2.5 text-sm text-slate-900 ${bRing} focus:outline-none focus:ring-2 focus:ring-sky-400`}
        >
          <option value="">— pick a pack —</option>
          {groups.map(([type, items]) => (
            <optgroup key={type} label={type}>
              {items.map((it) => (
                <option key={it.slug} value={it.slug}>
                  {it.name} ({it.slug})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="flex items-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="directory-link-button disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Compare</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </form>
  );
}
