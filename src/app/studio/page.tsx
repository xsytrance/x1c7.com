"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTracks } from "@/lib/useTracks";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { KineticStage, canPerform } from "@/components/KineticStage";

export default function StudioPage() {
  const { tracks } = useTracks();
  const { currentTrack, isPlaying, playTrack } = useMusicPlayer();

  // Default the picker to a word-timed song (the ones the engine can drive).
  // A ?track=<id> deep link wins — the planet's shareable address.
  const timed = useMemo(() => tracks.filter(canPerform), [tracks]);
  const [selectedId, setSelectedId] = useState<string>("");
  useEffect(() => {
    if (selectedId) return;
    const linked = new URLSearchParams(window.location.search).get("track");
    if (linked && tracks.some((t) => t.id === linked)) setSelectedId(linked);
    else if (timed.length) setSelectedId(timed[0].id);
  }, [selectedId, timed, tracks]);

  const selected = tracks.find((t) => t.id === selectedId);
  const analysis = currentTrack?.planet?.analysis;
  const live = canPerform(currentTrack);

  return (
    <main className="relative flex h-[100dvh] flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 24%, color-mix(in srgb, var(--theme-primary) 20%, transparent), transparent 60%)," +
          "linear-gradient(160deg, var(--theme-bg), #05030b)",
      }}
    >
      {/* Control bar */}
      <header className="relative z-10 flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <span className="font-display text-sm font-black uppercase tracking-[0.3em] text-white">Studio</span>
        <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/40">lyric engine · alpha</span>

        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
          className="ml-auto max-w-[46vw] rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-signal">
          <optgroup label="Planets (word-timed)">
            {timed.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </optgroup>
          <optgroup label="No word data yet">
            {tracks.filter((t) => !canPerform(t)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </optgroup>
        </select>

        <Link href="/music" className="rounded-lg border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60 hover:text-white">Exit</Link>
      </header>

      {/* Planet readout — the song's analyzed identity */}
      {analysis && (
        <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-1 sm:px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--theme-primary)" }}>🪐 {analysis.overallMood}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">{analysis.themes.slice(0, 4).join(" · ")}</span>
        </div>
      )}

      {/* Stage */}
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden px-4 pb-28">
        {live ? (
          <KineticStage track={currentTrack!} />
        ) : (
          <div className="text-center">
            {selected && canPerform(selected) ? (
              <button
                onClick={() => selected && playTrack(selected, tracks)}
                className="rounded-full px-8 py-4 font-display text-lg font-black uppercase tracking-[0.2em] text-void transition hover:scale-105"
                style={{ background: "var(--theme-primary)" }}
              >
                ▶ Launch “{selected.title}”
              </button>
            ) : (
              <p className="max-w-sm font-mono text-xs uppercase leading-6 tracking-wider text-white/40">
                {selected ? `“${selected.title}” has no word-timed lyrics yet — run it through the aligner first.` : "Pick a song."}
              </p>
            )}
            {currentTrack && !isPlaying && (
              <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-white/30">Use the player bar below to play.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
