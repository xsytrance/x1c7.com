import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { venvPath } from "@/lib/importerServer";

// YouTube search for the private-planet importer. LOCAL MACHINE ONLY —
// these routes drive yt-dlp/Whisper/Ollama on the owner's box and are dead
// on Vercel by design (no binaries, and we 404 before trying).
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (process.env.VERCEL) return NextResponse.json({ error: "local only" }, { status: 404 });
  const venv = venvPath();
  if (!venv) return NextResponse.json({ error: "pipeline venv not found (set WHISPER_VENV or install ~/.x1c7/venv)" }, { status: 500 });

  const { q } = await req.json();
  if (!q || typeof q !== "string") return NextResponse.json({ error: "missing q" }, { status: 400 });

  const out = await new Promise<string>((resolve, reject) => {
    execFile(join(venv, "bin/yt-dlp"),
      ["--no-warnings", "--flat-playlist", "--dump-json", `ytsearch12:${q.slice(0, 120)}`],
      { timeout: 30000, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => (err && !stdout ? reject(err) : resolve(stdout)));
  }).catch((e) => { throw new Error(`search failed: ${e.message}`); });

  const results = out.trim().split("\n").filter(Boolean).map((line) => {
    try {
      const v = JSON.parse(line);
      return {
        id: v.id as string,
        title: (v.title as string) || "?",
        channel: (v.channel || v.uploader || "?") as string,
        duration: typeof v.duration === "number" ? Math.round(v.duration) : null,
        thumb: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
        url: (v.url as string) || `https://www.youtube.com/watch?v=${v.id}`,
      };
    } catch { return null; }
  }).filter(Boolean);

  return NextResponse.json({ results });
}
