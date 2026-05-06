import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { mkdir, unlink, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";

const DOWNLOAD_DIR = path.join(os.tmpdir(), "video-dl");
const YT_DLP = process.env.YT_DLP_PATH || "yt-dlp";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

async function ensureDir(dir: string) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

function runCommand(
  cmd: string,
  args: string[],
  cwd?: string
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    proc.on("error", (err) => reject(err));
  });
}

export async function POST(request: NextRequest) {
  await ensureDir(DOWNLOAD_DIR);

  let body: { url?: string; upscale?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, upscale = false } = body;

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const jobDir = path.join(DOWNLOAD_DIR, jobId);

  try {
    await mkdir(jobDir, { recursive: true });

    // Step 1: Peek at filename
    const peek = await runCommand(YT_DLP, [
      "--no-playlist",
      "--print",
      "filename",
      "-o",
      "%(title).100B-%(id)s.%(ext)s",
      url,
    ]);

    if (peek.code !== 0) {
      return NextResponse.json(
        { error: "Failed to resolve URL — unsupported or private?", details: peek.stderr.slice(-300) },
        { status: 400 }
      );
    }

    const rawFilename = peek.stdout.trim();
    if (!rawFilename) {
      return NextResponse.json(
        { error: "No video found at this URL" },
        { status: 404 }
      );
    }

    // Step 2: Download
    const dl = await runCommand(YT_DLP, [
      "--no-playlist",
      "-o",
      path.join(jobDir, "%(title).100B-%(id)s.%(ext)s"),
      url,
    ]);

    if (dl.code !== 0) {
      return NextResponse.json(
        { error: "Download failed", details: dl.stderr.slice(-300) },
        { status: 500 }
      );
    }

    // Find the downloaded file
    const files = dl.stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const lastLine = files[files.length - 1];
    const destLine = files.find(
      (l) =>
        l.includes("[download] Destination:") ||
        l.includes("has already been downloaded") ||
        l.includes("[Merger] Merging formats into")
    );

    let downloadedFile = "";

    // Try to find the file in the job dir
    const Fs = await import("fs/promises");
    const dirFiles = await Fs.readdir(jobDir);
    const videoFiles = dirFiles.filter(
      (f) =>
        f.endsWith(".mp4") ||
        f.endsWith(".webm") ||
        f.endsWith(".mkv") ||
        f.endsWith(".mov")
    );

    if (videoFiles.length > 0) {
      downloadedFile = path.join(jobDir, videoFiles[0]);
    } else {
      return NextResponse.json(
        { error: "Download completed but no video file found" },
        { status: 500 }
      );
    }

    let finalFile = downloadedFile;
    let finalName = path.basename(downloadedFile);

    // Step 3: Upscale if requested
    if (upscale) {
      const upscaledName =
        path.parse(finalName).name + "_2x" + path.parse(finalName).ext;
      const upscaledPath = path.join(jobDir, upscaledName);

      const upscaleResult = await runCommand(FFMPEG, [
        "-y",
        "-i",
        downloadedFile,
        "-vf",
        "scale=iw*2:ih*2:flags=lanczos",
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-preset",
        "fast",
        "-c:a",
        "copy",
        upscaledPath,
      ]);

      if (upscaleResult.code === 0) {
        finalFile = upscaledPath;
        finalName = upscaledName;
        // Clean up original
        await unlink(downloadedFile).catch(() => {});
      }
      // If upscale fails, just use the original
    }

    // Read file and return
    const fileBuffer = await Fs.readFile(finalFile);
    const fileStat = await stat(finalFile);

    // Clean up after send
    const cleanup = () => {
      import("fs/promises").then((fs) => fs.rm(jobDir, { recursive: true, force: true }).catch(() => {}));
    };

    const response = new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(finalName)}"`,
        "Content-Length": fileStat.size.toString(),
        "X-Job-Id": jobId,
        "X-Upscaled": upscale ? "true" : "false",
      },
    });

    // Schedule cleanup after response is sent
    setTimeout(cleanup, 10000);

    return response;
  } catch (err: any) {
    // Clean up on error
    import("fs/promises").then((fs) => fs.rm(jobDir, { recursive: true, force: true }).catch(() => {}));

    return NextResponse.json(
      { error: "Internal error", details: err.message.slice(0, 200) },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
