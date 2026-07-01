import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
import { getSignedR2Url } from "@/lib/r2";

function jobUrls(request: NextRequest, jobId: string) {
  const origin = request.nextUrl.origin;

  return {
    status: `${origin}/api/agent/videos/${jobId}`,
    events: `${origin}/api/download/${jobId}/stream`,
    preview: `${origin}/api/download/${jobId}`,
    download: `${origin}/api/download/${jobId}?dl=1`,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const response = {
    jobId: job.id,
    sourceUrl: job.url,
    status: job.status,
    progress: job.progress,
    speed: job.speed,
    eta: job.eta,
    error: job.error || null,
    filename: job.filename || null,
    upscale: job.upscale,
    scale: job.scale,
    urls: jobUrls(request, job.id),
    asset: null as null | {
      url: string;
      expiresInSeconds: number;
      contentDisposition: "inline" | "attachment";
    },
  };

  if (job.status !== "done") {
    return NextResponse.json(response);
  }

  if (!job.r2Key) {
    return NextResponse.json(
      { ...response, error: "R2 object key missing" },
      { status: 500 }
    );
  }

  try {
    const download = request.nextUrl.searchParams.get("download") === "1";
    const expiresInSeconds = 60 * 30;
    const signedUrl = await getSignedR2Url({
      key: job.r2Key,
      download,
      filename: job.filename,
      expiresInSeconds,
    });

    return NextResponse.json({
      ...response,
      asset: {
        url: signedUrl,
        expiresInSeconds,
        contentDisposition: download ? "attachment" : "inline",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ...response,
        error: err instanceof Error ? err.message : "Failed to generate file URL",
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
