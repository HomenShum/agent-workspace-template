/**
 * GET /api/packs/<slug>
 *
 * Returns a single pack as typed JSON: `{ pack: Pack }`.
 * 404 for invalid or unknown slugs.
 *
 * Unlike the raw-markdown endpoint, this surface exposes
 * `securityReview.knownIssues` fully — consumers are expected
 * to be authenticated agent tooling, not public crawlers.
 */

import { NextResponse } from "next/server";
import { getPackBySlug } from "@/lib/pack-registry";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const pack = getPackBySlug(slug);

  if (!pack) {
    return NextResponse.json({ error: "Pack not found." }, { status: 404 });
  }

  return NextResponse.json(
    { pack },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}
