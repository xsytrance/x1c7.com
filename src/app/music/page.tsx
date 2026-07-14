"use client";

// /music — THE COLLECTION.
// Every track is a collector edition; the page is the shelf it lives on.
// Desktop: spine shelf, hover pulls the case and previews the drop.
// Mobile: full-bleed snap deck, tap to preview, tap again to play.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { SoundCloudEmbed } from "@/components/SoundCloudEmbed";
import { GalaxyButton } from "@/components/GalaxyButton";
import type { Track } from "@/data/tracks";
import { useTracks } from "@/lib/useTracks";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { CinematicLyrics } from "@/components/CinematicLyrics";
import { canPerform } from "@/components/KineticStage";
import CollectionShelf from "@/components/CollectionShelf";
import CollectionDeck from "@/components/CollectionDeck";

function useDeviceMode(): "desktop" | "mobile" | null {
  const [mode, setMode] = useState<"desktop" | "mobile" | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 900px)");
    const apply = () => setMode(mq.matches ? "desktop" : "mobile");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mode;
}

export default function Page() {
  const { tracks } = useTracks();
  const { currentTrack, isPlaying, analyser, playTrack: playFromCtx, pause } = useMusicPlayer();
  const mode = useDeviceMode();
  const [query, setQuery] = useState("");
  // Mobile view: the deck is the default; the spine shelf is one tap away.
  const [view, setView] = useState<"spines" | "deck">("deck");
  useEffect(() => {
    const saved = localStorage.getItem("x1c7-collection-view");
    if (saved === "deck" || saved === "spines") setView(saved);
  }, []);
  const pickView = (v: "spines" | "deck") => { setView(v); localStorage.setItem("x1c7-collection-view", v); };

  // Play always seeds the global queue with the full library so the persistent
  // player bar's next/prev traverse every transmission.
  const playTrack = (track: Track) => playFromCtx(track, tracks);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter((t) =>
      t.title.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q) || (t.mood || "").toLowerCase().includes(q));
  }, [tracks, query]);

  const stats = useMemo(() => ({
    tracks: tracks.length,
    shows: tracks.filter(canPerform).length,
    words: tracks.reduce((a, t) => a + (t.lyricsSynced?.words?.length || 0), 0),
    stems: tracks.reduce((a, t) => a + Object.keys(t.planet?.assets?.stemAudio || {}).length, 0),
  }), [tracks]);

  return (
    <main className="relative min-h-screen overflow-hidden pb-32">
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />

      <div className="relative z-10 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <BackToHub />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-8 pt-2 text-center sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.45em] text-plasma/80">agenor presents</p>
        <div className="mt-4">
          <TextScramble text="The Collection" as="h1" className="font-display text-5xl font-black uppercase tracking-[-0.05em] glow-text sm:text-7xl lg:text-8xl" delay={200} />
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
          Every track a collector edition — genre-coded spines, verified metadata, the song&apos;s own waveform on the case.
          {mode === "desktop" ? " Hover a spine to hear the drop."
            : view === "spines" ? " Tap a spine to pull the case, tap again to play."
            : " Swipe the deck, tap a case to hear the drop."}
        </p>
        {/* data-driven stats — every number is real */}
        <div className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-2 font-mono text-[11px] uppercase tracking-[0.25em] text-white/40">
          <span><b className="text-white/80">{stats.tracks}</b> tracks</span>
          <span><b className="text-white/80">{stats.shows}</b> full shows</span>
          {stats.words > 0 && <span><b className="text-white/80">{stats.words.toLocaleString()}</b> synced words</span>}
          {stats.stems > 0 && <span><b className="text-white/80">{stats.stems}</b> live stems</span>}
        </div>
        {/* THE STUDIO — the instrument, open to everyone (2026-07-14). Direct
            the shows yourself: looks, scenes, automation, your own shaders. */}
        <div className="mt-5 flex items-center justify-center">
          <Link
            href="/studio"
            className="group inline-flex items-center gap-2.5 rounded-full border px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] transition hover:scale-[1.03]"
            style={{ borderColor: "color-mix(in srgb, var(--inst-plasma, #43f7ff) 45%, transparent)", color: "var(--inst-plasma, #43f7ff)", background: "color-mix(in srgb, var(--inst-plasma, #43f7ff) 7%, transparent)" }}
          >
            🎛 The Studio <span className="text-white/45 normal-case tracking-normal">— direct the shows yourself</span>
            <span className="transition group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
        <div className="mx-auto mt-6 max-w-md">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search title · genre · vibe"
            className="w-full rounded-sm border border-white/15 bg-white/[0.04] px-4 py-2.5 text-center font-mono text-sm tracking-widest text-white placeholder:text-white/25 focus:border-plasma/60 focus:outline-none"
          />
        </div>
      </section>

      {/* ===== SUNO GRATITUDE — up top so nobody has to scroll to find it ===== */}
      <section className="relative z-10 mx-auto mb-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-6 text-center sm:px-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-white/40">a note on origins</p>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-8 text-white/75">
            AGENOR is <b className="font-semibold text-white/90">not affiliated with{" "}
            <a href="https://suno.com" target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-4 transition hover:decoration-white">Suno</a></b> —
            but every one of these transmissions began there. The writing, the worlds, the covers, the shows are ours;
            the spark that made them possible is theirs. Endless gratitude to the Suno team.
          </p>
          <a href="https://suno.com/@xsytrance" target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-block rounded-sm border border-white/20 px-5 py-2.5 font-mono text-xs tracking-[0.2em] text-white/70 transition hover:border-white/60 hover:text-white">
            THE CATALOG ON SUNO ↗
          </a>
        </div>
      </section>

      {/* ===== LIVE VISUALIZER (only while the real player runs) ===== */}
      {isPlaying && (
        <section className="relative z-10 mx-auto mb-8 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative h-32 overflow-hidden rounded-xl border border-white/10 sm:h-44">
            <AudioVisualizer analyser={analyser} active={isPlaying} color={currentTrack?.color || "#ff2440"} mode="wave" className="absolute inset-0" />
            <div className="absolute bottom-2 left-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
              now playing · {currentTrack?.title}
            </div>
          </div>
        </section>
      )}

      {/* ===== THE COLLECTION ===== */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* mobile view switch — spines are the default, the deck one tap away */}
        {mode === "mobile" && (
          <div className="mb-5 flex justify-center">
            <div className="inline-flex rounded-full border border-white/15 bg-white/[0.05] p-1">
              {([["spines", "▮▮ SHELF"], ["deck", "▢ DECK"]] as const).map(([v, label]) => (
                <button key={v} onClick={() => pickView(v)}
                  className={`rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.18em] transition ${view === v ? "bg-plasma text-black" : "text-white/55"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === "desktop" && <CollectionShelf tracks={list} onPlay={playTrack} onPauseMain={pause} />}
        {mode === "mobile" && (view === "spines"
          ? <CollectionShelf tracks={list} onPlay={playTrack} onPauseMain={pause} />
          : <CollectionDeck tracks={list} onPlay={playTrack} onPauseMain={pause} />)}
        {mode === null && (
          <div className="flex h-[50vh] items-center justify-center font-mono text-xs tracking-[0.3em] text-white/30">
            OPENING THE VAULT…
          </div>
        )}
      </section>

      {/* Cinematic takeover mounts here — auto-opens on play for synced tracks */}
      <CinematicLyrics />

      {/* ===== THE GALAXY — the other front door ===== */}
      <section className="relative z-10 mx-auto mt-14 max-w-7xl px-4 sm:px-6 lg:px-8">
        <GalaxyButton />
      </section>

      {/* ===== KINETICA — the engine behind the shows ===== */}
      <section className="relative z-10 mx-auto mt-14 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center sm:px-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-white/40">the engine behind the shows</p>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/75">
            Every full show on this shelf is performed live by <a href="https://xsytrance.github.io/kinetica/" target="_blank" rel="noopener noreferrer" className="text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white">Kinetica</a> —
            our free, <a href="https://github.com/xsytrance/kinetica" target="_blank" rel="noopener noreferrer" className="text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white">open-source</a> lyric-video
            engine. Drop a Suno stem zip and it listens to the actual drums and bass, igniting every word in time with the
            music. It runs entirely in your browser — your song never leaves your machine.
          </p>
          <a href="https://xsytrance.github.io/kinetica/" target="_blank" rel="noopener noreferrer"
            className="mt-5 inline-block rounded-sm border border-white/20 px-5 py-2.5 font-mono text-xs tracking-[0.2em] text-white/70 transition hover:border-white/60 hover:text-white">
            TRY KINETICA WITH YOUR OWN TRACKS ↗
          </a>
        </div>
      </section>

      {/* ===== SOUNDCLOUD ===== */}
      <section className="relative z-10 mx-auto mt-14 max-w-7xl px-4 sm:px-6 lg:px-8">
        <SoundCloudEmbed url="https://soundcloud.com/rod-agenor" />
      </section>
    </main>
  );
}
