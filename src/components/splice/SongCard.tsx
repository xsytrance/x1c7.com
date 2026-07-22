"use client";

// A song in the picker. Equal-height grid card (house law): fixed structure so
// a 4-word signature and a 1-word signature produce the same card height. The
// palette strip is the song's own cover colors, straight from the analysis.

import type { CatalogEntry } from "@/lib/splice/types";

export function SongCard({
  song, role, onPick,
}: {
  song: CatalogEntry;
  role: "style" | "guest" | null;
  onPick: () => void;
}) {
  const ring =
    role === "style" ? "border-amber-400/70 ring-1 ring-amber-400/40"
    : role === "guest" ? "border-fuchsia-400/70 ring-1 ring-fuchsia-400/40"
    : "border-zinc-800 hover:border-zinc-600";
  return (
    <button
      onClick={onPick}
      className={`group flex h-full flex-col rounded-xl border ${ring} bg-zinc-950/60 p-3 text-left transition`}
    >
      <div className="mb-2 flex h-1.5 overflow-hidden rounded-full">
        {(song.palette.length ? song.palette : ["#222", "#333"]).slice(0, 5).map((c, i) => (
          <span key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm font-bold leading-tight text-zinc-100">{song.title}</h3>
        {role && (
          <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${role === "style" ? "bg-amber-400/15 text-amber-300" : "bg-fuchsia-400/15 text-fuchsia-300"}`}>
            {role}
          </span>
        )}
      </div>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
        {song.bpm ?? "?"} BPM · {song.key ?? "?"} {song.mode ?? ""}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-zinc-500">{song.genre ?? "—"}</p>
      <div className="mt-auto pt-2 flex flex-wrap gap-1">
        {song.signature.slice(0, 4).map((w) => (
          <span key={w} className="rounded bg-zinc-800/70 px-1.5 py-0.5 text-[9px] text-zinc-400">{w}</span>
        ))}
      </div>
    </button>
  );
}
