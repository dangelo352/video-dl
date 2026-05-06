"use client";

import { useState, useRef, FormEvent, useEffect } from "react";

type JobStatus = "resolving" | "downloading" | "upscaling" | "done" | "error";

interface JobState {
  status: JobStatus;
  progress: number;
  speed: string;
  eta: string;
  filename: string;
  error: string;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [upscale, setUpscale] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [status, setStatus] = useState<JobStatus | "idle">("idle");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Connect SSE when we have a jobId
  useEffect(() => {
    if (!jobId) return;

    // Close any existing connection
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource(`/api/download/${jobId}/stream`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: JobState = JSON.parse(event.data);
        setJob(data);
        setStatus(data.status);

        if (data.status === "done") {
          es.close();
          esRef.current = null;
          // Trigger file download
          const a = document.createElement("a");
          a.href = `/api/download/${jobId}`;
          a.download = data.filename || "video.mp4";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else if (data.status === "error") {
          es.close();
          esRef.current = null;
          setError(data.error || "Something went wrong");
        }
      } catch {}
    };

    es.onerror = () => {
      // EventSource auto-reconnects; we'll let it
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [jobId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
    } catch {
      setError("That doesn't look like a valid URL");
      setStatus("error");
      return;
    }

    setError("");
    setJob(null);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, upscale }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setJobId(data.jobId);
      setStatus("resolving");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setStatus("error");
    }
  };

  const reset = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setStatus("idle");
    setError("");
    setUrl("");
    setJobId(null);
    setJob(null);
    setUpscale(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const phaseLabel: Record<string, string> = {
    resolving: "Resolving URL…",
    downloading: "Downloading…",
    upscaling: "Upscaling 2×…",
    done: "Complete",
  };

  const isActive = jobId !== null && status !== "done" && status !== "error";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            VideoDL
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Paste a link. Get the video. Any platform.
          </p>
        </div>

        {/* URL Input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError("");
              }}
              placeholder="https://x.com/user/status/123…"
              disabled={isActive}
              className="w-full h-14 px-4 text-base bg-surface-raised border border-border rounded-xl text-ink placeholder:text-ink-dim focus:border-border-focus focus:ring-0 disabled:opacity-50 transition-colors font-mono text-sm"
              autoFocus
            />
          </div>

          {/* Upscale Toggle */}
          <label className="flex items-center justify-between px-4 py-3 bg-surface-raised border border-border rounded-xl cursor-pointer hover:bg-surface-hover transition-colors">
            <div>
              <span className="text-sm font-medium text-ink">Upscale 2×</span>
              <span className="ml-2 text-xs text-ink-dim">
                Double resolution via lanczos
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={upscale}
              onClick={() => setUpscale(!upscale)}
              disabled={isActive}
              className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                upscale ? "bg-accent" : "bg-surface-hover"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  upscale ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={!url.trim() || isActive}
            className="w-full h-12 rounded-xl bg-ink text-surface font-medium text-sm transition-all hover:bg-ink/90 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isActive
              ? phaseLabel[status] || "Working…"
              : "Download"}
          </button>
        </form>

        {/* Progress bar */}
        {job && status !== "done" && status !== "error" && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>{phaseLabel[status] || "Working…"}</span>
              <span className="font-mono tabular-nums">{job.progress}%</span>
            </div>
            <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(job.progress, 2)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-ink-dim">
              {job.speed && <span>{job.speed}</span>}
              {job.eta && <span className="font-mono">ETA {job.eta}</span>}
            </div>
          </div>
        )}

        {/* Done */}
        {status === "done" && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-sm text-success">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Downloaded — {job?.filename || "check your downloads"}
            </div>
            <button
              onClick={reset}
              className="text-sm text-ink-muted hover:text-ink transition-colors underline underline-offset-2"
            >
              Download another
            </button>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-2 text-sm text-danger">
              <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={reset}
              className="text-sm text-ink-muted hover:text-ink transition-colors underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs text-ink-dim">
            Works with Twitter/X, TikTok, YouTube, Instagram, and 1000+ sites
          </p>
        </div>
      </div>
    </div>
  );
}
