import { NextRequest, NextResponse } from "next/server";

async function resolveWithMethod(targetUrl: string, method: "HEAD" | "GET") {
  const response = await fetch(targetUrl, {
    method,
    redirect: "follow",
    headers: {
      "user-agent": "agent-workspace-template/1.0",
    },
    cache: "no-store",
  });

  return response.url || targetUrl;
}

async function resolveSourceUrl(targetUrl: string) {
  try {
    return await resolveWithMethod(targetUrl, "HEAD");
  } catch {
    try {
      return await resolveWithMethod(targetUrl, "GET");
    } catch {
      return targetUrl;
    }
  }
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid source url." }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Unsupported source url protocol." }, { status: 400 });
  }

  const resolvedUrl = await resolveSourceUrl(parsed.toString());
  return NextResponse.redirect(resolvedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
