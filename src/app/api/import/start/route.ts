import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { jobsRoot, safeSlug, venvPath } from "@/lib/importerServer";

// Kick off the YouTube → private planet pipeline as a detached job.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (process.env.VERCEL) return NextResponse.json({ error: "local only" }, { status: 404 });
  const venv = venvPath();
  if (!venv) return NextResponse.json({ error: "pipeline venv not found" }, { status: 500 });

  const { videoId, title } = await req.json();
  if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) return NextResponse.json({ error: "bad videoId" }, { status: 400 });
  const slug = safeSlug(String(title || videoId)) || safeSlug(videoId);

  const wd = join(jobsRoot(), slug);
  if (existsSync(join(wd, "row.json"))) return NextResponse.json({ job: slug, done: true });
  mkdirSync(wd, { recursive: true });

  const script = join(process.cwd(), "scripts/import-youtube/import.mjs");
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  // Detached shell so the pipeline survives this request; EXIT marker lets
  // the status route tell "crashed" from "still working".
  const child = spawn("bash", ["-c",
    `node "${script}" --url "${url}" --id "${slug}" --venv "${venv}" --workdir "${wd}" >> "${join(wd, "log")}" 2>&1; echo "EXIT:$?" >> "${join(wd, "log")}"`,
  ], { detached: true, stdio: "ignore" });
  child.unref();

  return NextResponse.json({ job: slug });
}
