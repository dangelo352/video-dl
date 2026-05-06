import { NextRequest } from "next/server";
import { getJob, Job } from "@/lib/jobs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (j: Job) => {
        const data = JSON.stringify({
          status: j.status,
          progress: j.progress,
          speed: j.speed,
          eta: j.eta,
          filename: j.filename,
          error: j.error,
        });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const tick = () => {
        const j = getJob(jobId);
        if (!j) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "error", error: "Job expired" })}\n\n`));
          controller.close();
          return true; // done
        }

        send(j);

        if (j.status === "done" || j.status === "error") {
          controller.close();
          return true; // done
        }
        return false;
      };

      // Initial send
      if (tick()) return;

      // Stream updates
      const interval = setInterval(() => {
        if (tick()) clearInterval(interval);
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
