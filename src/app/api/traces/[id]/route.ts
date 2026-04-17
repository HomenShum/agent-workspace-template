/**
 * GET /api/traces/<id>
 *
 * Returns a single change-trace as typed JSON: { trace: ChangeTrace }.
 * Canonical envelope — never a bare ChangeTrace object.
 * 404 for invalid or unknown ids.
 */

import { NextResponse } from "next/server";
import { getTraceById } from "@/lib/trace-registry";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trace = getTraceById(id);

  if (!trace) {
    return NextResponse.json({ error: "Trace not found." }, { status: 404 });
  }

  return NextResponse.json(
    { trace },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}
