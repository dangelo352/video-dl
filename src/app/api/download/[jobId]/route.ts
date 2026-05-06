import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
import { stat, open } from "fs/promises";

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

  if (job.status !== "done") {
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

  // Serve the file
  try {
    const fileStat = await stat(job.filePath);
    const fileSize = fileStat.size;
    const ext = job.filename.split(".").pop()?.toLowerCase() || "mp4";
    const contentType = VIDEO_TYPES[ext] || "video/mp4";
    const disposition = dl ? "attachment" : "inline";

    const range = request.headers.get("range");

    if (range) {
      // Parse range header: "bytes=0-1023"
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : Math.min(start + 1024 * 1024 - 1, fileSize - 1);
        const chunkSize = end - start + 1;

        const fd = await open(job.filePath, "r");
        const buf = Buffer.alloc(chunkSize);
        await fd.read(buf, 0, chunkSize, start);
        await fd.close();

        return new NextResponse(buf, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Content-Length": chunkSize.toString(),
            "Accept-Ranges": "bytes",
            "Content-Disposition": `${disposition}; filename="${encodeURIComponent(job.filename)}"`,
          },
        });
      }
    }

    // Full file (no range)
    const { readFile } = await import("fs/promises");
    const fileBuffer = await readFile(job.filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(job.filename)}"`,
        "Content-Length": fileSize.toString(),
        "Accept-Ranges": "bytes",
        "X-Job-Id": job.id,
        "X-Upscaled": job.upscale ? "true" : "false",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found on disk" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
