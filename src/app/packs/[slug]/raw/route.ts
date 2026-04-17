/**
 * GET /packs/<slug>/raw
 *
 * Returns the pack rendered as raw Markdown, suitable for:
 *   - `curl` from an agent harness
 *   - copy/paste into AGENTS.md
 *   - LLM-friendly pack ingestion
 *
 * 404 on invalid or unknown slugs. Slug validation is delegated to
 * the registry (`getPackBySlug` returns null for anything not
 * matching `^[a-z0-9-]+$` or exceeding 100 chars).
 */

import { NextResponse } from "next/server";
import { getPackBySlug } from "@/lib/pack-registry";
import { packToMarkdown } from "@/lib/pack-markdown";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const pack = getPackBySlug(slug);

  if (!pack) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const body = packToMarkdown(pack);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
