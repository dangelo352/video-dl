"use client";

import { useState, useRef, FormEvent } from "react";

type Status = "idle" | "downloading" | "upscaling" | "done" | "error";

export default function Home() {
  const [url, setUrl] = useState("");
  const [upscale, setUpscale] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      setError("That doesn't look like a valid URL");
      setStatus("error");
      return;
    }

    setStatus(upscale ? "downloading" : "downloading");
    setError("");

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, upscale }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Download failed (${res.status})`);
      }

      const blob = await res.blob();
      const filename =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="?(.+?)"?$/)?.[1] || "video.mp4";

      // Trigger download
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setJobId(res.headers.get("X-Job-Id") || "");
      setStatus("done");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setStatus("error");
    }
  };

  const reset = () => {
    setStatus("idle");
    setError("");
    setUrl("");
    setJobId("");
    setUpscale(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

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
              disabled={status === "downloading" || status === "upscaling"}
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
              disabled={status === "downloading" || status === "upscaling"}
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
            disabled={
              !url.trim() || status === "downloading" || status === "upscaling"
            }
            className="w-full h-12 rounded-xl bg-ink text-surface font-medium text-sm transition-all hover:bg-ink/90 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {status === "downloading" || status === "upscaling"
              ? "Downloading…"
              : "Download"}
          </button>
        </form>

        {/* Status */}
        {(status === "downloading" || status === "upscaling") && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-muted">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {status === "upscaling" ? "Upscaling…" : "Fetching video…"}
          </div>
        )}

        {status === "done" && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-sm text-success">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Downloaded — check your downloads folder
            </div>
            <button
              onClick={reset}
              className="text-sm text-ink-muted hover:text-ink transition-colors underline underline-offset-2"
            >
              Download another
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-2 text-sm text-danger">
              <svg
                className="h-4 w-4 mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
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
