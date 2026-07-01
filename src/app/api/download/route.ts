import { NextRequest, NextResponse } from "next/server";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { createJob, DOWNLOAD_DIR } from "@/lib/jobs";

async function ensureDir(dir: string) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

export async function POST(request: NextRequest) {
  await ensureDir(DOWNLOAD_DIR);

  let body: { url?: string; upscale?: boolean | number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, upscale = 0 } = body;
  const scale = typeof upscale === "number" ? upscale : (upscale ? 2 : 0);

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const job = createJob(url, scale);

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    progress: 0,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
