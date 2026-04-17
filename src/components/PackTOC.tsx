/**
 * PackTOC — Notion-style jump navigation for the pack detail page.
 *
 * Server component. Renders two surfaces:
 *   1. A sticky sidebar on `lg:` and up (vertical list of anchor links).
 *   2. An inline horizontal chip bar on smaller viewports.
 *
 * Each item links to an in-page anchor (`#install`, `#telemetry`, etc.).
 * The page.tsx assigns matching `id` attributes via the `id` prop on each
 * section. CSS `.notion-anchor-target` adds `scroll-margin-top` so the
 * linked heading isn't hidden by any sticky chrome.
 */

import type { ReactElement } from "react";

export type PackTOCItem = {
  id: string;
  label: string;
};

export function PackTOC({
  items,
}: {
  items: PackTOCItem[];
}): ReactElement | null {
  if (items.length === 0) return null;
  return (
    <>
      {/* Mobile / small-viewport inline chip bar. Renders inside the
          article flow so it sits right under the hero block. */}
      <nav
        aria-label="Pack sections"
        className="notion-toc-inline lg:hidden"
        data-testid="pack-toc-inline"
      >
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="notion-toc-chip">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Desktop sticky sidebar. Lives in the outer grid column on `lg:`. */}
      <aside
        aria-label="Pack sections"
        className="notion-toc hidden lg:block"
        data-testid="pack-toc-sidebar"
      >
        <p className="section-label notion-toc-label">On this page</p>
        <ul className="notion-toc-list">
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="notion-toc-link">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
