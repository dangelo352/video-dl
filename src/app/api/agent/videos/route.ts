import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { createJob, DOWNLOAD_DIR } from "@/lib/jobs";

type AgentVideoRequest = {
  url?: string;
  upscale?: boolean | number;
  scale?: number;
};

async function ensureDir(dir: string) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

function getOrigin(request: NextRequest) {
  return request.nextUrl.origin;
}

function normalizeScale(body: AgentVideoRequest) {
  if (typeof body.scale === "number") return body.scale;
  if (typeof body.upscale === "number") return body.upscale;
  return body.upscale ? 2 : 0;
}

export async function POST(request: NextRequest) {
  await ensureDir(DOWNLOAD_DIR);

  let body: AgentVideoRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body.url?.trim();
  const scale = normalizeScale(body);

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  if (![0, 2, 4].includes(scale)) {
    return NextResponse.json(
      { error: "scale must be 0, 2, or 4" },
      { status: 400 }
    );
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const job = createJob(url, scale);
  const origin = getOrigin(request);

  return NextResponse.json(
    {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      urls: {
        status: `${origin}/api/agent/videos/${job.id}`,
        events: `${origin}/api/download/${job.id}/stream`,
        preview: `${origin}/api/download/${job.id}`,
        download: `${origin}/api/download/${job.id}?dl=1`,
      },
    },
    { status: 202 }
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
