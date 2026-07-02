import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { jobsRoot, safeSlug } from "@/lib/importerServer";

// Progress of an import job, derived from its log's "▶" stage markers.
export const runtime = "nodejs";

const STAGES = [
  { match: "ripping", key: "rip", label: "Ripping audio" },
  { match: "transcribing", key: "lyrics", label: "Hearing the lyrics (Whisper)" },
  { match: "researching", key: "research", label: "Researching the song" },
  { match: "planet analysis", key: "planet", label: "Reading its soul" },
  { match: "choreographing", key: "choreo", label: "Choreographing touch" },
  { match: "generating keyword art", key: "art", label: "Painting keywords" },
  { match: "packaging", key: "package", label: "Packaging the planet" },
];

export async function GET(req: NextRequest) {
  if (process.env.VERCEL) return NextResponse.json({ error: "local only" }, { status: 404 });
  const job = safeSlug(req.nextUrl.searchParams.get("job") || "");
  if (!job) return NextResponse.json({ error: "missing job" }, { status: 400 });

  const wd = join(jobsRoot(), job);
  const logPath = join(wd, "log");
  if (!existsSync(logPath)) return NextResponse.json({ error: "unknown job" }, { status: 404 });

  const log = readFileSync(logPath, "utf8");
  let stage = 0;
  for (let i = 0; i < STAGES.length; i++) if (log.includes(`▶ ${STAGES[i].match}`)) stage = i + 1;

  const exit = log.match(/^EXIT:(\d+)$/m);
  const rowPath = join(wd, "row.json");
  if (exit && exit[1] === "0" && existsSync(rowPath)) {
    const row = JSON.parse(readFileSync(rowPath, "utf8"));
    return NextResponse.json({ done: true, stage: STAGES.length, stages: STAGES, row });
  }
  if (exit && exit[1] !== "0") {
    const tail = log.trim().split("\n").filter((l) => !l.startsWith("EXIT:")).slice(-4).join("\n");
    return NextResponse.json({ error: "pipeline failed", detail: tail, stage, stages: STAGES });
  }
  return NextResponse.json({ done: false, stage, stages: STAGES });
}
