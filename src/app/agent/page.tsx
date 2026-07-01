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
      className="absolute right-2 top-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-border-focus hover:text-ink"
    >
      {copied ? "Copied" : "Copy"}
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
            <pre className="overflow-x-auto rounded-lg border border-border bg-surface-raised p-4 pr-24 text-sm text-ink">
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
