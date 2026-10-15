# Root dependency and UI migration

## 2026-10-15 — Remove the vulnerable Tailwind 3 dependency chain

A developer installing the public catalog hit the existing dependency audit even though the normal application checks passed. The old Tailwind 3 graph retained unpatched `braces` and `postcss-selector-parser` 6; updating compatible locks alone could not remove that graph.

- Move Tailwind 3.4.19 to 4.3.3 and its dedicated PostCSS plugin. Remove the replaced autoprefixer dependency and obsolete TypeScript config, retaining the four status colors and the same three source directories in CSS.
- Update the locked Next version from 15.5.25 to 15.5.28, sharp from 0.35.4 to 0.35.5, and source-map-js from 1.2.1 to 1.2.2. Preserve the existing Next/PostCSS 8.5.28 override and Linux optional-package selectors.
- Apply only the documented outline, backdrop-blur and inner-shadow utility renames in their existing callers. Restore the original 20px metadata and 40px catalog-title line heights after rendered comparisons exposed inheritance changes. Keep the current layout and application logic.
- Document the upstream Safari 16.4+, Chrome 111+, Firefox 128+ requirement in the quick start.

Before versus after: `npm ci` passed in both cases; unchanged `npm audit --audit-level=low` failed with 10 vulnerable package entries before and passed with zero after. `npm run check` passed before and after: TypeScript, 382 Vitest assertions, production build and 84 bounded HTTP requests. Both CSS corrections received their own completed application check. No tests, workflow gates or audit thresholds changed.

Original and final catalog/detail DOM, console, pixels and key computed styles were captured in one Chrome tab at 1440×1000 and 390×844. Search with no matches and clearing filters were exercised. Recorded body font/color and card border/radius checks matched. The search input's border, radius and font size matched in the recorded views. The focused search field retained a 2px box-shadow ring in the saved no-match state. Tailwind 4 changes color serialization and outline implementation. Native screenshot framing varied, so these receipts do not establish pixel identity or visual equivalence for other widgets. Studio/backend flows, other browser engines and production remain unverified.

Sources: [Tailwind migration and browser requirements](https://tailwindcss.com/docs/upgrade-guide), [source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files), [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [selector parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), [Next 15.5.28](https://github.com/vercel/next.js/releases/tag/v15.5.28). An audit pass is dependency-policy evidence, not exploit-test coverage.
