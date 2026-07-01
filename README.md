# VideoDL Site

Minimal Next.js app for downloading videos (yt-dlp) with optional 2×/4× upscale (ffmpeg).

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000

## Required env vars

```env
R2_ACCOUNT_ID=...
R2_BUCKET=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```

Optional:

```env
YT_DLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg
```

## Architecture

- Server downloads/upscales video locally
- Final file is uploaded to Cloudflare R2
- `/api/download/:jobId` returns a short-lived signed R2 URL via redirect
- Frontend UX stays the same (preview + download button)

This offloads delivery bandwidth from Railway to R2.

## Agent API

Use this JSON API from Hermes, Claude, Codex, or another automation client.

Create a video job:

```bash
curl -X POST https://your-domain/api/agent/videos \
  -H "Content-Type: application/json" \
  -d '{"url":"https://x.com/user/status/123","scale":0}'
```

`scale` can be `0`, `2`, or `4`. The response returns `202 Accepted` with a `jobId` plus status, event-stream, preview, and download URLs.

Poll job status:

```bash
curl https://your-domain/api/agent/videos/JOB_ID
```

When `status` is `done`, the response includes `asset.url`, a short-lived signed R2 URL. Use `?download=1` on the status URL to request an attachment-style signed asset URL.
