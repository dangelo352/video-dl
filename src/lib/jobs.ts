import { spawn } from "child_process";
import { mkdir, readFile, stat, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";

export const DOWNLOAD_DIR = path.join(os.tmpdir(), "video-dl");
const YT_DLP = process.env.YT_DLP_PATH || "yt-dlp";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

export interface Job {
  id: string;
  url: string;
  upscale: boolean;
  status: "resolving" | "downloading" | "upscaling" | "done" | "error";
  progress: number; // 0-100
  speed: string;    // e.g. "2.5 MiB/s"
  eta: string;      // e.g. "00:15"
  filename: string;
  filePath: string;
  error: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

function createJobId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function ensureDir(dir: string) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function createJob(url: string, upscale: boolean): Job {
  const job: Job = {
    id: createJobId(),
    url,
    upscale,
    status: "resolving",
    progress: 0,
    speed: "",
    eta: "",
    filename: "",
    filePath: "",
    error: "",
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);

  // Run in background
  processJob(job).catch((err) => {
    job.status = "error";
    job.error = err.message.slice(0, 500);
  });

  return job;
}

function parseProgress(line: string): { pct: number; speed: string; eta: string } | null {
  // yt-dlp: "[download]  45.2% of ~50.00MiB at  2.50MiB/s ETA 00:19"
  const match = line.match(/(\d+\.?\d*)%\s.*?at\s+(\S+\/s)\s+ETA\s+(\S+)/);
  if (match) {
    return { pct: parseFloat(match[1]), speed: match[2], eta: match[3] };
  }
  // Also try: "[download] 100% of 50.00MiB"
  const doneMatch = line.match(/(\d+\.?\d*)%\s/);
  if (doneMatch) {
    return { pct: parseFloat(doneMatch[1]), speed: "", eta: "0:00" };
  }
  return null;
}

function parseFfmpegProgress(line: string): { pct: number; speed: string } | null {
  // ffmpeg: "frame=  120 fps=45 q=28.0 size=    1024kB time=00:00:05.00 bitrate=..."
  const timeMatch = line.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
  if (!timeMatch) return null;
  // We need total duration to calculate percentage
  // For now return rough frame-based progress
  const frameMatch = line.match(/frame=\s*(\d+)/);
  if (frameMatch) {
    return { pct: -1, speed: "" }; // Signal we got output but can't calc %
  }
  return null;
}

async function processJob(job: Job) {
  const jobDir = path.join(DOWNLOAD_DIR, job.id);
  await ensureDir(jobDir);

  try {
    // Step 1: Resolve filename
    job.status = "resolving";
    const peek = await runWithProgress(job, YT_DLP, [
      "--no-playlist",
      "--print", "filename",
      "-o", "%(title).100B-%(id)s.%(ext)s",
      job.url,
    ], "resolving");

    if (peek.code !== 0) {
      throw new Error("Failed to resolve URL — unsupported or private?");
    }

    const rawFilename = peek.stdout.trim();
    if (!rawFilename) throw new Error("No video found at this URL");

    // Step 2: Download
    job.status = "downloading";
    const dl = await runWithProgress(job, YT_DLP, [
      "--no-playlist",
      "--newline",            // Line-buffered output for progress
      "-o", path.join(jobDir, "%(title).100B-%(id)s.%(ext)s"),
      job.url,
    ], "downloading");

    if (dl.code !== 0) {
      throw new Error("Download failed: " + dl.stderr.slice(-200));
    }

    // Find the downloaded file
    const dirFiles = await import("fs/promises").then(fs => fs.readdir(jobDir));
    const videoFiles = dirFiles.filter(f =>
      f.endsWith(".mp4") || f.endsWith(".webm") || f.endsWith(".mkv") || f.endsWith(".mov")
    );

    if (videoFiles.length === 0) throw new Error("Download completed but no video file found");

    let downloadedFile = path.join(jobDir, videoFiles[0]);
    let finalName = videoFiles[0];

    // Step 3: Upscale if requested
    if (job.upscale) {
      job.status = "upscaling";
      const upscaledName = path.parse(finalName).name + "_2x" + path.parse(finalName).ext;
      const upscaledPath = path.join(jobDir, upscaledName);

      const upResult = await runWithProgress(job, FFMPEG, [
        "-y", "-i", downloadedFile,
        "-vf", "scale=iw*2:ih*2:flags=lanczos",
        "-c:v", "libx264", "-crf", "18", "-preset", "fast",
        "-c:a", "copy",
        "-progress", "pipe:1",   // Machine-readable progress to stdout
        "-nostats",               // No stats to stderr
        upscaledPath,
      ], "upscaling");

      if (upResult.code === 0) {
        await unlink(downloadedFile).catch(() => {});
        downloadedFile = upscaledPath;
        finalName = upscaledName;
      }
    }

    job.status = "done";
    job.filename = finalName;
    job.filePath = downloadedFile;
    job.progress = 100;
    job.eta = "Done";
  } catch (err: any) {
    job.status = "error";
    job.error = err.message || "Unknown error";
  }
}

function runWithProgress(
  job: Job,
  cmd: string,
  args: string[],
  phase: "resolving" | "downloading" | "upscaling"
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d: Buffer) => {
      const text = d.toString();
      stdout += text;
      
      if (phase === "downloading") {
        const lines = text.split("\n");
        for (const line of lines) {
          const parsed = parseProgress(line);
          if (parsed) {
            job.progress = Math.round(parsed.pct);
            job.speed = parsed.speed;
            job.eta = parsed.eta;
          }
        }
      } else if (phase === "upscaling") {
        // ffmpeg -progress outputs key=value pairs
        const lines = text.split("\n");
        for (const line of lines) {
          const outTime = line.match(/^out_time_us=(\d+)/);
          if (outTime) {
            const us = parseInt(outTime[1]);
            // Estimate based on typical video duration — rough but better than nothing
            // We'll use a heuristic: progress based on output
            job.speed = "processing";
          }
          const progressMatch = line.match(/^progress=(continue|end)/);
          if (progressMatch && progressMatch[1] === "end") {
            job.progress = 95;
          }
        }
      }
    });

    proc.stderr.on("data", (d: Buffer) => {
      const text = d.toString();
      stderr += text;
      if (phase === "downloading") {
        const lines = text.split("\n");
        for (const line of lines) {
          // yt-dlp progress goes to stderr
          const parsed = parseProgress(line);
          if (parsed) {
            job.progress = Math.round(parsed.pct);
            job.speed = parsed.speed;
            job.eta = parsed.eta;
          }
        }
      }
    });

    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    proc.on("error", () => resolve({ stdout, stderr, code: 1 }));
  });
}

// Cleanup old jobs after 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > 30 * 60 * 1000) {
      jobs.delete(id);
      // Also clean up files
      import("fs/promises").then(fs =>
        fs.rm(path.join(DOWNLOAD_DIR, id), { recursive: true, force: true }).catch(() => {})
      );
    }
  }
}, 5 * 60 * 1000);
