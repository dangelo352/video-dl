import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
import { readFile, stat } from "fs/promises";

const VIDEO_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);
  const dl = request.nextUrl.searchParams.get("dl");

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // If done, serve the file (inline preview, or attachment if ?dl)
  if (job.status === "done") {
    try {
      const fileBuffer = await readFile(job.filePath);
      const fileStat = await stat(job.filePath);
      const ext = job.filename.split(".").pop()?.toLowerCase() || "mp4";
      const contentType = VIDEO_TYPES[ext] || "video/mp4";
      const disposition = dl ? "attachment" : "inline";

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `${disposition}; filename="${encodeURIComponent(job.filename)}"`,
          "Content-Length": fileStat.size.toString(),
          "X-File-Size": fileStat.size.toString(),
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
    upscale: job.upscale,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
