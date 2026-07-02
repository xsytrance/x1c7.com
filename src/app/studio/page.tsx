"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTracks } from "@/lib/useTracks";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { KineticStage, canPerform, MODES, type StageMode } from "@/components/KineticStage";

// Every show pass is preserved as a "satellite" (moon) orbiting the planet.
// The newest pass is the main show; older passes stay selectable forever.
const PASSES = [
  { id: 3, label: "Pass 3 · main show" },
  { id: 2, label: "Pass 2 · satellite" },
  { id: 1, label: "Pass 1 · satellite" },
];

export default function StudioPage() {
  const { tracks } = useTracks();
  const { currentTrack, isPlaying, playTrack } = useMusicPlayer();
  const [pass, setPass] = useState(3);
  const [mode, setMode] = useState<StageMode>("phrase");
  useEffect(() => {
    const saved = localStorage.getItem("x1c7-lyric-style") as StageMode | null;
    if (saved && MODES.some((m) => m.id === saved)) setMode(saved);
  }, []);
  const pickMode = (m: StageMode) => { setMode(m); localStorage.setItem("x1c7-lyric-style", m); };

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

        <select value={pass} onChange={(e) => setPass(Number(e.target.value))}
          className="rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-signal"
          title="Satellites — every pass of the show, preserved">
          {PASSES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>

        {pass >= 3 && (
          <select value={mode} onChange={(e) => pickMode(e.target.value as StageMode)}
            className="rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-signal"
            title="Viewing style — Dynamic stagecraft, clean Focus, or readable Phrase">
            {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        )}

        <Link href="/music" className="rounded-lg border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60 hover:text-white">Exit</Link>
      </header>

      {/* Planet readout — the song's analyzed identity */}
      {analysis && (
        <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-1 sm:px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--theme-primary)" }}>🪐 {analysis.overallMood}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">{analysis.themes.slice(0, 4).join(" · ")}</span>
          {currentTrack?.planet?.respondsTo && (
            <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--theme-accent)" }}>
              ↩ answers {currentTrack.planet.respondsTo}
            </span>
          )}
        </div>
      )}

      {/* Stage */}
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden px-4 pb-28">
        {live ? (
          <KineticStage track={currentTrack!} pass={pass} mode={mode} />
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
