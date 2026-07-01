"use client";

import { useState } from "react";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied install command" : "Copy install command"}
      title={copied ? "Copied" : "Copy"}
      className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md border border-border bg-surface/70 text-ink-muted backdrop-blur transition-colors hover:border-border-focus hover:bg-surface hover:text-ink"
    >
      {copied ? (
        <svg
          aria-hidden="true"
          className="h-4 w-4 text-success"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect width="13" height="13" x="9" y="9" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

export default function AgentInstallPage() {
  const installCommand = "curl -fsSL https://dload.org/api/agent/install | bash";

  return (
    <main className="min-h-dvh px-4 py-10 md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-accent">
            Hidden installer
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            VideoDL Agent Skill
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-muted">
            Install the VideoDL skill for Codex, Claude, and Hermes. The skill uses
            the JSON API directly, so agents can submit video URLs, poll status,
            and retrieve signed download links without using the web UI.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-ink">Install</h2>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg border border-border bg-surface-raised p-4 pr-14 text-sm text-ink">
              <code>{installCommand}</code>
            </pre>
            <CopyButton value={installCommand} />
          </div>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-sm font-medium text-ink">Direct Files</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href="/api/agent/install"
              className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-ink-muted transition-colors hover:border-border-focus hover:text-ink"
            >
              Shell installer
            </a>
            <a
              href="/api/agent/install?format=skill"
              className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-ink-muted transition-colors hover:border-border-focus hover:text-ink"
            >
              Raw SKILL.md
            </a>
            <a
              href="/api/agent/manifest"
              className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-ink-muted transition-colors hover:border-border-focus hover:text-ink"
            >
              Agent manifest
            </a>
          </div>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-sm font-medium text-ink">API Example</h2>
          <pre className="overflow-x-auto rounded-lg border border-border bg-surface-raised p-4 text-sm text-ink">
            <code>{`curl -X POST https://dload.org/api/agent/videos \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://x.com/user/status/123","scale":0}'`}</code>
          </pre>
        </section>
      </div>
    </main>
  );
}
