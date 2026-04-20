"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/**
 * DirectorySearchBox — tiny client island for the directory search input.
 *
 * Design:
 *   - Rendered as a plain <form action="/"> so WITHOUT JS the browser
 *     performs a GET to `/?q=…&<carry-over>` and the server-rendered
 *     PacksDirectory re-renders with the new filter state.
 *   - WITH JS we intercept submit + per-keystroke change, debouncing is
 *     NOT necessary because the server component is already reading
 *     the URL — we just push the URL and let Next transition.
 *   - Hidden inputs preserve every other `searchParams` entry so the
 *     non-JS fallback path carries `tag`, `trust`, `type`, `pattern`,
 *     `publisher`, `sort` through the GET.
 *
 * URL is the single source of truth; `queryInput` is ephemeral local
 * state so typing feels instant. On URL change we resync.
 */
export function DirectorySearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const urlQ = searchParams.get("q") ?? "";
  const [queryInput, setQueryInput] = useState(urlQ);

  // Keep local state in sync with URL (browser back/forward, chip clicks, etc).
  useEffect(() => {
    setQueryInput(urlQ);
  }, [urlQ]);

  function pushWith(nextQuery: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    const trimmed = nextQuery.trim();
    if (trimmed) nextParams.set("q", trimmed);
    else nextParams.delete("q");
    const qs = nextParams.toString();
    const nextUrl = qs ? `/?${qs}` : "/";
    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  }

  // Hidden inputs so the non-JS fallback <form action="/"> carries every
  // non-`q` filter through a real GET.
  const passthrough: Array<[string, string]> = [];
  searchParams.forEach((value, key) => {
    if (key === "q") return;
    passthrough.push([key, value]);
  });

  return (
    <form
      action="/"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        pushWith(queryInput);
      }}
      className="space-y-2"
      data-testid="directory-search-form"
    >
      <label htmlFor="pack-search" className="section-label">
        Search
      </label>
      <input
        id="pack-search"
        name="q"
        value={queryInput}
        onChange={(event) => {
          const next = event.target.value;
          setQueryInput(next);
          pushWith(next);
        }}
        placeholder="Search harness packs..."
        className="field-input mt-2"
        data-testid="directory-search-input"
      />
      {passthrough.map(([key, value]) => (
        <input key={`${key}=${value}`} type="hidden" name={key} value={value} />
      ))}
      {isPending ? (
        <span
          className="directory-results-chip"
          data-testid="directory-search-pending"
        >
          Updating...
        </span>
      ) : null}
    </form>
  );
}
