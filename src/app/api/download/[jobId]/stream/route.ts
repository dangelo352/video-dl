import { NextRequest } from "next/server";
import { getJob } from "@/lib/jobs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return new Response("Job not found", { status: 404 });
  }

  // Stream progress via SSE
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send current state immediately
      const send = () => {
        if (!job) return;
        const data = JSON.stringify({
          status: job.status,
          progress: job.progress,
          speed: job.speed,
          eta: job.eta,
          filename: job.filename,
          error: job.error,
        });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));

        if (job.status === "done" || job.status === "error") {
          controller.close();
        }
      };

      send();

      // Poll the job state every 200ms and stream updates
      const interval = setInterval(() => {
        const j = getJob(jobId);
        if (!j) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "error", error: "Job expired" })}\n\n`));
          controller.close();
          clearInterval(interval);
          return;
        }

        send();

        if (j.status === "done" || j.status === "error") {
          clearInterval(interval);
        }
      }, 200);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
