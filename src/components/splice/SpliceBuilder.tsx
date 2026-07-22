"use client";

// THE BUILD BENCH — the visual Frankenstein editor. A song is a timeline, so
// the "flow" is a left-to-right conveyor of section legos (not a free-floating
// node graph — that fights the medium). Reorder, relabel, remove; pull fresh
// legos from the parts bin below (any number of songs). Every edit recompiles.
// Reordering is button-driven on purpose: dead reliable, and it works on phones.

import type { Flow, Section, SectionKind, SongLegos } from "@/lib/splice/types";
import { songIdOf } from "@/lib/splice/compile";

const KINDS: SectionKind[] = [
  "intro", "verse", "prechorus", "chorus", "postchorus", "hook",
  "bridge", "breakdown", "drop", "outro", "spoken", "interlude", "adlib", "refrain",
];

function findSection(ref: string, loaded: Record<string, SongLegos>): { song: SongLegos; section: Section } | null {
  const song = loaded[songIdOf(ref)];
  if (!song) return null;
  const section = song.sections.find((s) => s.id === ref);
  return section ? { song, section } : null;
}

const swatch = (song: SongLegos | undefined) => song?.style.palette?.[3] || song?.style.palette?.[0] || "#6b21a8";
const voiceOf = (s: Section) => [s.voice.gender, s.voice.group ? "group" : null, s.voice.spoken ? "spoken" : null].filter(Boolean).join(" ") || "—";

export function SpliceBuilder({
  flow, loaded, onChange,
}: {
  flow: Flow;
  loaded: Record<string, SongLegos>;
  onChange: (flow: Flow) => void;
}) {
  const arr = flow.arrangement;

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    const next = arr.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...flow, arrangement: next });
  };
  const remove = (i: number) => onChange({ ...flow, arrangement: arr.filter((_, k) => k !== i) });
  const relabel = (i: number, as: SectionKind) => onChange({ ...flow, arrangement: arr.map((it, k) => (k === i ? { ...it, as } : it)) });
  const append = (ref: string, as: SectionKind) => onChange({ ...flow, arrangement: [...arr, { ref, as }] });
  const setStyle = (from: string) => onChange({ ...flow, style: { ...flow.style, from } });

  const poolSongs = Object.values(loaded);

  return (
    <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/[0.04] p-4">
      {/* style-base selector — drives target tempo/key, i.e. the whole compat read */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">style base</span>
        <select
          value={flow.style.from}
          onChange={(e) => setStyle(e.target.value)}
          className="rounded-lg border border-amber-400/40 bg-zinc-950 px-2 py-1 font-mono text-xs text-amber-300 focus:outline-none"
        >
          {poolSongs.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <span className="font-mono text-[10px] text-zinc-600">sets the target BPM/key everything else is scored against</span>
      </div>

      {/* the conveyor */}
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">arrangement — {arr.length} legos</p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {arr.map((it, i) => {
          const found = findSection(it.ref, loaded);
          const song = found?.song;
          const sec = found?.section;
          const borrowed = songIdOf(it.ref) !== flow.style.from;
          return (
            <div key={i} className="flex w-[172px] shrink-0 flex-col rounded-lg border border-zinc-800 bg-zinc-950/80 p-2">
              <div className="mb-1.5 h-1 rounded-full" style={{ background: swatch(song) }} />
              <select
                value={(it.as ?? sec?.kind ?? "verse") as string}
                onChange={(e) => relabel(i, e.target.value as SectionKind)}
                className="mb-1 w-full rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 font-mono text-[11px] text-fuchsia-300 focus:outline-none"
              >
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <p className="truncate text-[10px] text-zinc-400" title={song?.title}>
                {borrowed ? "" : "◆ "}{song?.title ?? songIdOf(it.ref)}
              </p>
              <p className="font-mono text-[9px] text-zinc-600">{sec ? `${voiceOf(sec)} · ${sec.bars ?? "?"} bars` : "missing"}</p>
              <div className="mt-1.5 flex items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="flex-1 rounded bg-zinc-800/70 py-0.5 text-[11px] text-zinc-300 disabled:opacity-30">◀</button>
                <button onClick={() => move(i, 1)} disabled={i === arr.length - 1} className="flex-1 rounded bg-zinc-800/70 py-0.5 text-[11px] text-zinc-300 disabled:opacity-30">▶</button>
                <button onClick={() => remove(i)} className="rounded bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-300">✕</button>
              </div>
            </div>
          );
        })}
        {arr.length === 0 && <p className="py-6 font-mono text-[11px] text-zinc-600">empty — pull legos from the bin below</p>}
      </div>

      {/* parts bin */}
      <p className="mb-1 mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">parts bin — click a lego to append (add more songs from the grid)</p>
      <div className="space-y-2">
        {poolSongs.map((song) => (
          <div key={song.id} className="rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-2">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: swatch(song) }} />
              <span className="font-mono text-[11px] text-zinc-300">{song.title}</span>
              <span className="font-mono text-[9px] text-zinc-600">{song.style.bpm} BPM · {song.style.key} {song.style.mode}</span>
              {song.id === flow.style.from && <span className="rounded bg-amber-400/15 px-1 py-0.5 font-mono text-[8px] uppercase text-amber-300">style</span>}
            </div>
            <div className="flex flex-wrap gap-1">
              {song.sections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => append(sec.id, sec.kind)}
                  title={sec.text.split("\n").slice(0, 2).join(" / ")}
                  className="rounded bg-zinc-800/70 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300 transition hover:bg-fuchsia-500/20 hover:text-fuchsia-200"
                >
                  {sec.kind}{sec.ordinal ? " " + sec.ordinal : ""} <span className="text-zinc-600">+{sec.bars ?? "?"}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
