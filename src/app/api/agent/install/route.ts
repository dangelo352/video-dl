import { NextRequest } from "next/server";

function skillMarkdown(origin: string) {
  return `# VideoDL Agent Skill

Use VideoDL when a user asks to download, fetch, process, upscale, preview, or retrieve a video from a public URL.

## API Base

${origin}

## Create a Video Job

POST ${origin}/api/agent/videos

JSON body:

\`\`\`json
{
  "url": "https://x.com/user/status/123",
  "scale": 0
}
\`\`\`

\`scale\` must be \`0\`, \`2\`, or \`4\`. Use \`0\` unless the user explicitly asks for upscaling.

The response returns \`202 Accepted\` with:

- \`jobId\`
- \`urls.status\`
- \`urls.events\`
- \`urls.preview\`
- \`urls.download\`

## Check Status

GET ${origin}/api/agent/videos/{jobId}

Poll until \`status\` is \`done\` or \`error\`.

When done, use \`asset.url\` for the signed video URL. Use \`${origin}/api/agent/videos/{jobId}?download=1\` when an attachment-style signed URL is needed.

## Streaming Status

Use \`urls.events\` for Server-Sent Events when the client supports SSE.

## Notes

- Do not scrape the VideoDL web UI.
- Prefer the JSON API for all automation.
- Signed asset URLs expire, so fetch a fresh status response before handing a final link to a user.
`;
}

function installerScript(origin: string) {
  const skill = skillMarkdown(origin);

  return `#!/usr/bin/env bash
set -euo pipefail

skill_name="video-dl"
skill_body=$(cat <<'SKILL_EOF'
${skill}
SKILL_EOF
)

install_skill() {
  local root="$1"
  local label="$2"
  local dir="$root/$skill_name"

  mkdir -p "$dir"
  printf "%s\\n" "$skill_body" > "$dir/SKILL.md"
  printf "Installed %s skill: %s\\n" "$label" "$dir/SKILL.md"
}

install_skill "$HOME/.codex/skills" "Codex"
install_skill "$HOME/.claude/skills" "Claude"
install_skill "$HOME/.hermes/skills" "Hermes"

printf "\\nVideoDL agent skill installed. API base: ${origin}\\n"
`;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const format = request.nextUrl.searchParams.get("format");
  const body = format === "skill" ? skillMarkdown(origin) : installerScript(origin);
  const contentType = format === "skill" ? "text/markdown" : "text/x-shellscript";

  return new Response(body, {
    headers: {
      "Content-Type": `${contentType}; charset=utf-8`,
      "Cache-Control": "no-store",
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
