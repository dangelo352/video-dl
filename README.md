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
