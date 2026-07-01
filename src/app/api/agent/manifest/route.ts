import { NextRequest, NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/origin";

export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);

  return NextResponse.json({
    name: "VideoDL",
    slug: "video-dl",
    description: "Submit video URLs, track processing, and retrieve signed download links.",
    homepage: origin,
    install: `${origin}/api/agent/install`,
    endpoints: {
      createVideoJob: {
        method: "POST",
        url: `${origin}/api/agent/videos`,
        body: {
          url: "https://x.com/user/status/123",
          scale: 0,
        },
      },
      getVideoJob: {
        method: "GET",
        url: `${origin}/api/agent/videos/{jobId}`,
      },
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
