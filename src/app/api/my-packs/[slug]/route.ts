/**
 * /api/my-packs/<slug> — JSON API for the operator's fork of a pack.
 *
 *   GET    — returns { slug, markdown, sourceVersion, createdAt, updatedAt }
 *            or 404 when no fork exists. 401 if no operator session.
 *   PUT    — body { markdown: string, sourceVersion: string } — upsert.
 *            200 on success, 400 on validation error (slug, size, encoding).
 *   DELETE — removes the fork. 200 always if the session is valid; the
 *            `deleted` flag tells you whether anything was removed.
 *
 * Session id comes from the `agent-workspace-operator-session` cookie that
 * OperatorSessionProvider mirrors from localStorage. Never trust the body
 * to tell us who the user is.
 *
 * Honest status codes — never 2xx on a real failure.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  FORK_MAX_MARKDOWN_BYTES,
  deleteFork,
  getFork,
  isValidForkSlug,
  saveFork,
} from "@/lib/fork-storage";
import { getOperatorSessionId } from "@/lib/fork-session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

function badSlug(): NextResponse {
  return NextResponse.json({ error: "INVALID_SLUG" }, { status: 400 });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  if (!isValidForkSlug(slug)) return badSlug();
  const sessionId = await getOperatorSessionId();
  if (!sessionId) return unauthorized();
  const fork = getFork(sessionId, slug);
  if (!fork) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({
    slug: fork.slug,
    markdown: fork.markdown,
    sourceVersion: fork.sourceVersion,
    createdAt: fork.createdAt,
    updatedAt: fork.updatedAt,
  });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  if (!isValidForkSlug(slug)) return badSlug();
  const sessionId = await getOperatorSessionId();
  if (!sessionId) return unauthorized();

  // Bound the read: never let a client stream an arbitrarily large body
  // into memory. 200kB headroom over the 100kB fork cap to allow JSON framing.
  const raw = await req.text();
  if (raw.length > 200 * 1024) {
    return NextResponse.json({ error: "FORK_TOO_LARGE" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const obj = body as { markdown?: unknown; sourceVersion?: unknown };
  if (typeof obj.markdown !== "string") {
    return NextResponse.json({ error: "INVALID_MARKDOWN" }, { status: 400 });
  }
  if (typeof obj.sourceVersion !== "string" || obj.sourceVersion.length === 0) {
    return NextResponse.json({ error: "INVALID_SOURCE_VERSION" }, { status: 400 });
  }

  const result = saveFork(sessionId, slug, obj.markdown, obj.sourceVersion);
  if (!result.ok) {
    const status =
      result.error === "FORK_TOO_LARGE"
        ? 413
        : result.error === "PER_SESSION_FORK_CAP_REACHED"
          ? 429
          : result.error === "WRITE_FAILED"
            ? 500
            : 400;
    return NextResponse.json(
      { error: result.error, detail: result.detail ?? null },
      { status },
    );
  }
  return NextResponse.json(
    {
      slug: result.record.slug,
      created: result.created,
      updatedAt: result.record.updatedAt,
      sourceVersion: result.record.sourceVersion,
      maxBytes: FORK_MAX_MARKDOWN_BYTES,
    },
    { status: 200 },
  );
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { slug } = await params;
  if (!isValidForkSlug(slug)) return badSlug();
  const sessionId = await getOperatorSessionId();
  if (!sessionId) return unauthorized();
  const result = deleteFork(sessionId, slug);
  if (!result.ok) {
    const status = result.error === "WRITE_FAILED" ? 500 : 400;
    return NextResponse.json(
      { error: result.error, detail: result.detail ?? null },
      { status },
    );
  }
  return NextResponse.json({ deleted: result.deleted });
}
