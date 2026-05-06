import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";
import { getSignedR2Url } from "@/lib/r2";

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
      scale: job.scale,
    });
  }

  if (!job.r2Key) {
    return NextResponse.json({ error: "R2 object key missing" }, { status: 500 });
  }

  try {
    const signedUrl = await getSignedR2Url({
      key: job.r2Key,
      download: dl === "1",
      filename: job.filename,
      expiresInSeconds: 60 * 30,
    });

    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to generate file URL" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
