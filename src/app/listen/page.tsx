// THE LISTENING ROOM — the door. Every analyzed song, with what was measured
// for each. Server-rendered from the analyzer index (no client fetch needed).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import type { IndexEntry } from "@/lib/listen/types";
import { fmtTime, camelot } from "@/lib/listen/types";

export const metadata: Metadata = {
  title: "The Listening Room — x1c7",
  description: "Every measured layer of every song, drawn on one time axis.",
};

function readIndex(): { songs: IndexEntry[] } {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", "analyzer", "index.json"), "utf8"));
  } catch { return { songs: [] }; }
}

export default function ListenIndex() {
  const { songs } = readIndex();
  return (
    <main className="min-h-[100dvh] bg-[#050510] px-5 py-8 text-zinc-200">
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-black tracking-[0.18em] text-[#199e70]">THE LISTENING ROOM</h1>
            <p className="mt-1 max-w-[620px] text-[12px] leading-5 text-zinc-500">
              Every song, fully measured — stem energy, drum onsets, melodic contour, structure,
              and the drama map — drawn on one time axis. Pick a song and hover anywhere.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/music" className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600 transition hover:text-zinc-300">← the collection</Link>
            <Link href="/splice" className="font-mono text-[11px] uppercase tracking-[0.2em] text-fuchsia-500/70 transition hover:text-fuchsia-300">splice table →</Link>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {songs.map((s) => (
            <Link
              key={s.id}
              href={`/listen/${s.id}`}
              className="group flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 transition hover:border-[#199e70]/60"
            >
              <div className="mb-2 flex h-1.5 overflow-hidden rounded-full">
                {(s.palette.length ? s.palette : ["#222", "#333"]).slice(0, 5).map((c, i) => (
                  <span key={i} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <h2 className="font-display text-sm font-bold leading-tight text-zinc-100">{s.title}</h2>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                {s.bpm ?? "?"} BPM · {s.key ?? "?"}{s.mode === "minor" ? "m" : ""}
                {camelot(s.key, s.mode) && <span className="text-zinc-600"> · {camelot(s.key, s.mode)}</span>}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-zinc-500">{s.genre ?? "—"}</p>
              <div className="mt-auto flex items-center gap-2 pt-2 font-mono text-[9px] text-zinc-600">
                <span>{s.stemCount} stems</span>
                <span>·</span>
                <span>{s.duration ? fmtTime(s.duration) : "—"}</span>
                {s.coverage != null && s.coverage < 0.97 && (
                  <span className="text-amber-500/80" title={`stem analysis covers only ${Math.round(s.coverage * 100)}% of this song`}>
                    {Math.round(s.coverage * 100)}%
                  </span>
                )}
                {s.has.melody && <span className="ml-auto text-[#9085e9]">♪</span>}
              </div>
            </Link>
          ))}
          {songs.length === 0 && (
            <p className="col-span-full font-mono text-xs text-zinc-600">
              no bundles yet — run <span className="text-zinc-400">node scripts/song-analysis/analyzer-bundle.mjs</span>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
