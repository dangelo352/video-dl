import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
import { readFile, stat, rm } from "fs/promises";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // If done, serve the file
  if (job.status === "done") {
    try {
      const fileBuffer = await readFile(job.filePath);
      const fileStat = await stat(job.filePath);

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(job.filename)}"`,
          "Content-Length": fileStat.size.toString(),
          "X-Job-Id": job.id,
          "X-Upscaled": job.upscale ? "true" : "false",
        },
      });
    } catch {
      return NextResponse.json({ error: "File not found on disk" }, { status: 500 });
    }
  }

  // Return progress
  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    speed: job.speed,
    eta: job.eta,
    error: job.error,
    filename: job.filename,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
