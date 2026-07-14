"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTracks } from "@/lib/useTracks";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { KineticStage, canPerform, MODES, type StageMode } from "@/components/KineticStage";
import { KineticLooksPanel } from "@/components/KineticLooksPanel";
import { supabase } from "@/lib/supabase";
import { isPrivateHost } from "@/lib/privateHost";
import type { Track } from "@/data/tracks";

// Every show pass is preserved as a "satellite" (moon) orbiting the planet.
// The newest pass is the main show; older passes stay selectable forever.
const PASSES = [
  { id: 6, label: "Pass 6 · dynamic+" },
  { id: 5, label: "Pass 5 · cinematic" },
  { id: 4, label: "Pass 4 · living backdrop" },
  { id: 3, label: "Pass 3 · satellite" },
  { id: 2, label: "Pass 2 · satellite" },
  { id: 1, label: "Pass 1 · satellite" },
];

export default function StudioPage() {
  const { tracks } = useTracks();
  const { currentTrack, isPlaying, playTrack } = useMusicPlayer();
  const [pass, setPass] = useState(5);
  const [mode, setMode] = useState<StageMode>("phrase");
  // Embed params — the Planet Studio app's WebView drives the stage with
  // ?track&draft=1&embed=1&autoplay=1&pass&mode. All additive; a plain visit
  // behaves exactly as before.
  const [embed, setEmbed] = useState(false);
  const [wantDraft, setWantDraft] = useState(false);
  const [wantAutoplay, setWantAutoplay] = useState(false);
  const [draftPlanet, setDraftPlanet] = useState<Track["planet"] | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const autoLaunched = useRef(false);
  useEffect(() => {
    const saved = localStorage.getItem("x1c7-lyric-style") as StageMode | null;
    if (saved && MODES.some((m) => m.id === saved)) setMode(saved);
    const q = new URLSearchParams(window.location.search);
    setEmbed(q.get("embed") === "1");
    setWantAutoplay(q.get("autoplay") === "1");
    // Drafts are an owner-only concept — never overlay them on a public host.
    setWantDraft(q.get("draft") === "1" && isPrivateHost(window.location.hostname));
    const p = Number(q.get("pass"));
    if ([1, 2, 3, 4, 5, 6].includes(p)) setPass(p);
    const m = q.get("mode") as StageMode | null;
    if (m && MODES.some((x) => x.id === m)) setMode(m);
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

  // ?draft=1 → fetch the unlaunched planet_draft and overlay it on launch.
  useEffect(() => {
    if (!wantDraft || !selectedId) { setDraftReady(!wantDraft); return; }
    let on = true;
    setDraftReady(false);
    supabase.from("tracks").select("planet_draft").eq("id", selectedId).then(({ data }) => {
      if (!on) return;
      setDraftPlanet(((data?.[0] as { planet_draft?: Track["planet"] } | undefined)?.planet_draft) ?? null);
      setDraftReady(true);
    });
    return () => { on = false; };
  }, [wantDraft, selectedId]);

  // The overlay: hand the player a track whose planet IS the draft.
  const launch = (t: Track) => {
    const show = wantDraft && t.id === selectedId && draftPlanet ? { ...t, planet: draftPlanet } : t;
    playTrack(show, tracks);
  };

  // ?autoplay=1 → launch as soon as the track (and its draft, if requested) is ready.
  useEffect(() => {
    if (!wantAutoplay || autoLaunched.current || !selected || !canPerform(selected) || !draftReady) return;
    autoLaunched.current = true;
    launch(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantAutoplay, selected, draftReady]);
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
      {/* Control bar (hidden in the app's embedded WebView) */}
      {!embed && (
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
      )}

      {/* Planet readout — the song's analyzed identity */}
      {analysis && !embed && (
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

      {/* Looks — fire/capture/share the show's saved looks (backdrop lives at pass 4+) */}
      {!embed && live && pass >= 4 && <KineticLooksPanel className="absolute bottom-32 right-4 z-20" />}

      {/* Stage */}
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden px-4 pb-28">
        {live ? (
          <KineticStage track={currentTrack!} pass={pass} mode={mode} />
        ) : (
          <div className="text-center">
            {selected && canPerform(selected) ? (
              <button
                onClick={() => selected && launch(selected)}
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
