/**
 * GET /traces/<id>/raw
 *
 * Returns the trace rendered as raw Markdown (ctrl+F-friendly), suitable
 * for:
 *   - curl from an agent harness
 *   - copy/paste into AGENTS.md or a session log
 *   - LLM-friendly ingestion of the session's changes
 *
 * 404 on invalid or unknown ids. Id validation is delegated to the
 * registry (isValidTraceId: ^ct_YYYY-MM-DD(_[a-z0-9-]+)?$).
 */

import { NextResponse } from "next/server";
import { getTraceById } from "@/lib/trace-registry";
import { traceToMarkdown } from "@/lib/trace-markdown";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trace = getTraceById(id);

  if (!trace) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const body = traceToMarkdown(trace);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
