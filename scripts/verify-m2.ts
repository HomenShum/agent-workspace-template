/**
 * M2 verification script.
 *
 * Run with:
 *   npx tsx scripts/verify-m2.ts
 *
 * Exits non-zero on any failure, prints "M2 OK" on success.
 *
 * Expected shape for `curl http://localhost:3000/api/packs?type=harness&limit=5`:
 *   {
 *     "packs": [ { slug, name, packType: "harness", ... } x <=5 ],
 *     "total": <number of harness packs before pagination>,
 *     "filters": { "type": "harness", "pattern": null, "trust": null,
 *                  "q": null, "limit": 5, "offset": 0 }
 *   }
 * Content-Type: application/json
 * Cache-Control: public, max-age=60
 */

import type { Pack } from "@/lib/pack-schema";
import { getAllPacks, getPackBySlug, isValidSlug } from "@/lib/pack-registry";
import { packToMarkdown } from "@/lib/pack-markdown";

type Check = { label: string; ok: boolean; detail?: string };

function check(label: string, ok: boolean, detail?: string): Check {
  return { label, ok, detail };
}

function assertTrue(label: string, cond: boolean, detail?: string): Check {
  return check(label, cond, detail);
}

function main(): number {
  const results: Check[] = [];

  // 1. getPackBySlug("nonexistent") returns null, doesn't throw
  try {
    const r = getPackBySlug("nonexistent");
    results.push(assertTrue("getPackBySlug('nonexistent') returns null", r === null));
  } catch (err) {
    results.push(check("getPackBySlug('nonexistent') doesn't throw", false, String(err)));
  }

  // 2. getPackBySlug traversal attempt returns null
  try {
    const r = getPackBySlug("../etc/passwd");
    results.push(assertTrue("getPackBySlug('../etc/passwd') returns null", r === null));
  } catch (err) {
    results.push(check("getPackBySlug traversal rejected", false, String(err)));
  }

  // 3. Slug validator rejects bad inputs
  results.push(assertTrue("isValidSlug rejects traversal", !isValidSlug("../x")));
  results.push(assertTrue("isValidSlug rejects uppercase", !isValidSlug("Foo")));
  results.push(assertTrue("isValidSlug rejects empty", !isValidSlug("")));
  results.push(
    assertTrue("isValidSlug rejects >100 chars", !isValidSlug("a".repeat(101)))
  );
  results.push(assertTrue("isValidSlug accepts normal slug", isValidSlug("operator-chat-rail")));

  // 4. Registry returns non-empty list (legacy adapter must work)
  const all = getAllPacks();
  results.push(assertTrue("getAllPacks() returns non-empty array", all.length > 0, `got ${all.length}`));

  // 5. Legacy adapter fills required Pack fields
  const samplePack: Pack | null = all[0] ?? null;
  if (samplePack) {
    results.push(assertTrue("sample pack has packType", !!samplePack.packType));
    results.push(
      assertTrue("sample pack has canonicalPattern", !!samplePack.canonicalPattern)
    );
    results.push(assertTrue("sample pack has version", !!samplePack.version));
    results.push(assertTrue("sample pack has installCommand", !!samplePack.installCommand));
    results.push(assertTrue("sample pack has rawMarkdownPath", !!samplePack.rawMarkdownPath));
    results.push(
      assertTrue("sample pack relatedPacks is array", Array.isArray(samplePack.relatedPacks))
    );
    results.push(
      assertTrue("sample pack changelog is array", Array.isArray(samplePack.changelog))
    );
  } else {
    results.push(check("sample pack available", false, "getAllPacks() was empty"));
  }

  // 6. Lookup by slug round-trip
  if (samplePack) {
    const fetched = getPackBySlug(samplePack.slug);
    results.push(assertTrue("round-trip lookup by slug", fetched?.slug === samplePack.slug));
  }

  // 7. packToMarkdown contains required H2 section anchors
  if (samplePack) {
    const md = packToMarkdown(samplePack);
    const required = [
      "## Summary",
      "## Install",
      "## Contract",
      "## Layers",
      "## Use When",
      "## Avoid When",
      "## Key Outcomes",
      "## Minimal Instructions",
      "## Full Instructions",
      "## Evaluation Checklist",
      "## Failure Modes",
      "## Transfer Matrix",
      "## Telemetry",
      "## Security Review",
      "## Compares With",
      "## Related Packs",
      "## Changelog",
      "## Sources",
      "## Examples",
    ];
    for (const h of required) {
      results.push(assertTrue(`markdown contains '${h}'`, md.includes(h)));
    }
    // Frontmatter sanity
    results.push(assertTrue("markdown has YAML frontmatter", md.startsWith("---\n")));
    results.push(
      assertTrue("markdown frontmatter contains slug", md.includes(`slug: "${samplePack.slug}"`))
    );
    results.push(
      assertTrue(
        "markdown frontmatter contains packType",
        md.includes(`packType: "${samplePack.packType}"`)
      )
    );
  }

  // Report
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    const prefix = r.ok ? "PASS" : "FAIL";
    const suffix = r.detail ? ` (${r.detail})` : "";
    console.log(`[${prefix}] ${r.label}${suffix}`);
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed.`);
    return 1;
  }

  console.log("\nM2 OK");
  return 0;
}

process.exit(main());
