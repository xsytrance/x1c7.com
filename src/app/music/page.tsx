"use client";

// /music — THE WALL.
// The front door to the catalogue. First paint is album art, edge to edge:
// hover a tile to cue the song at its hottest bar, click it and the full show
// takes the screen. One click, no reading, no scrolling.
//
// Everything that used to sit ABOVE the music — the hero, the AGENOR band, the
// Suno gratitude note, the Studio/Listening Room/Splice doors — still ships, in
// full, immediately BELOW the wall. Nothing was cut, it just stopped being a
// gate. The old collector views (shelf, deck, jukebox) live on behind the view
// switch under the wall. See docs/WALL-REDESIGN.md.

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
import { JukeboxView } from "@/components/JukeboxView";
import Wall from "@/components/wall/Wall";
import { TylerPromo } from "@/components/TylerPromo";
import { ZeroChallenger } from "@/components/ZeroChallenger";
import { AgenorBand } from "@/components/AgenorBand";

type View = "wall" | "spines" | "deck" | "jukebox";

/** v2 retires every view preference saved before the wall existed. */
const VIEW_KEY = "x1c7-collection-view-v2";

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
  // The wall is the default for everyone; the collector views are one tap away
  // and a choice made SINCE the redesign is remembered.
  //
  // The key is deliberately v2. The old `x1c7-collection-view` holds a view
  // picked before the wall existed, and honouring it meant every returning
  // visitor — i.e. everyone who had ever used /music — landed on the old shelf
  // and never saw the redesign at all. A new key retires those answers once.
  const [view, setView] = useState<View>("wall");
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "wall" || saved === "deck" || saved === "spines" || saved === "jukebox") setView(saved);
  }, []);
  const pickView = (v: View) => { setView(v); localStorage.setItem(VIEW_KEY, v); };

  // Play always seeds the global queue with the full library so the persistent
  // player bar's next/prev traverse every transmission.
  const playTrack = (track: Track) => playFromCtx(track, tracks);

  const stats = useMemo(() => ({
    tracks: tracks.length,
    shows: tracks.filter(canPerform).length,
    words: tracks.reduce((a, t) => a + (t.lyricsSynced?.words?.length || 0), 0),
    stems: tracks.reduce((a, t) => a + Object.keys(t.planet?.assets?.stemAudio || {}).length, 0),
  }), [tracks]);

  const views: [View, string][] = [
    ["wall", "▦ WALL"],
    ...(mode === "mobile" ? ([["deck", "▢ DECK"]] as [View, string][]) : ([["spines", "▮▮ SHELF"]] as [View, string][])),
    ["jukebox", "◉ JUKEBOX"],
  ];

  const viewSwitch = mode === null ? null : (
    <div className="relative z-10 my-4 flex justify-center">
      <div className="inline-flex rounded-full border border-white/12 bg-white/[0.04] p-1">
        {views.map(([v, label]) => (
          <button key={v} onClick={() => pickView(v)}
            className={`rounded-full px-4 py-1.5 font-mono text-[10px] tracking-[0.18em] transition ${view === v ? "bg-plasma text-black" : "text-white/50 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    // NOTE: no `overflow-hidden` here — it would make <main> a scroll container
    // and silently break the wall's sticky control bar. The wall measures its
    // own width, so nothing on this page overflows horizontally.
    <main className="relative min-h-screen pb-32">
      <div className="scanline" aria-hidden />
      <div className="starfield pointer-events-none" aria-hidden />

      {/* ═══ THE WALL — first paint, full bleed, no gate ═══ */}
      <div className="relative z-10">
        {view === "wall" ? (
          <Wall tracks={tracks} onPlay={playTrack} onPauseMain={pause} />
        ) : (
          <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            {/* In a legacy view the switch goes ABOVE the collection — it is
                the way back to the wall, and under a full-height shelf it was
                a long scroll from anywhere. The wall itself needs no escape
                hatch on top of it, so there it stays below (art leads). */}
            {viewSwitch}
            {view === "jukebox" ? <JukeboxView tracks={tracks} />
              : view === "deck" ? <CollectionDeck tracks={tracks} onPlay={playTrack} onPauseMain={pause} />
              : <CollectionShelf tracks={tracks} onPlay={playTrack} onPauseMain={pause} />}
          </section>
        )}
      </div>

      {view === "wall" && viewSwitch}

      {/* Cinematic takeover mounts here — auto-opens on play for synced tracks */}
      <CinematicLyrics />

      {/* ═══ everything below the music ═══════════════════════════════════ */}

      {/* ===== LIVE VISUALIZER (only while the real player runs) ===== */}
      {isPlaying && (
        <section className="relative z-10 mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative h-32 overflow-hidden rounded-xl border border-white/10 sm:h-44">
            <AudioVisualizer analyser={analyser} active={isPlaying} color={currentTrack?.color || "#ff2440"} mode="wave" className="absolute inset-0" />
            <div className="absolute bottom-2 left-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
              now playing · {currentTrack?.title}
            </div>
          </div>
        </section>
      )}

      {/* ===== THE COLLECTION — the masthead, now AFTER the music ===== */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 pt-16 text-center sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.45em] text-plasma/80">agenor presents</p>
        <div className="mt-4">
          <TextScramble text="The Collection" as="h1" className="font-display text-5xl font-black uppercase tracking-[-0.05em] glow-text sm:text-7xl" delay={200} />
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
          Every track a collector edition — genre-coded spines, verified metadata, the song&apos;s own waveform on the case.
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
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/studio"
            className="group inline-flex items-center gap-2.5 rounded-full border px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] transition hover:scale-[1.03]"
            style={{ borderColor: "color-mix(in srgb, var(--inst-plasma, #43f7ff) 45%, transparent)", color: "var(--inst-plasma, #43f7ff)", background: "color-mix(in srgb, var(--inst-plasma, #43f7ff) 7%, transparent)" }}
          >
            🎛 The Studio <span className="text-white/45 normal-case tracking-normal">— direct the shows yourself</span>
            <span className="transition group-hover:translate-x-0.5">→</span>
          </Link>
          {/* THE LISTENING ROOM — every measured layer, drawn (2026-07-22). */}
          <Link
            href="/listen"
            className="group inline-flex items-center gap-2.5 rounded-full border px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] transition hover:scale-[1.03]"
            style={{ borderColor: "color-mix(in srgb, #199e70 45%, transparent)", color: "#31c48d", background: "color-mix(in srgb, #199e70 7%, transparent)" }}
          >
            🎧 The Listening Room <span className="text-white/45 normal-case tracking-normal">— see inside the song</span>
            <span className="transition group-hover:translate-x-0.5">→</span>
          </Link>
          {/* THE SPLICE TABLE — mash your catalog into new Suno prompts (2026-07-22). */}
          <Link
            href="/splice"
            className="group inline-flex items-center gap-2.5 rounded-full border px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] transition hover:scale-[1.03]"
            style={{ borderColor: "color-mix(in srgb, #e879f9 45%, transparent)", color: "#e879f9", background: "color-mix(in srgb, #e879f9 7%, transparent)" }}
          >
            🧬 The Splice Table <span className="text-white/45 normal-case tracking-normal">— Frankenstein new songs</span>
            <span className="transition group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </section>

      {/* ===== AGENOR identity — the artist behind The Collection ===== */}
      <AgenorBand />

      {/* ===== SUNO GRATITUDE — the first thing after the music ===== */}
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

      {/* ===== THE GALAXY — the other front door ===== */}
      <section className="relative z-10 mx-auto mt-14 max-w-7xl px-4 sm:px-6 lg:px-8">
        <GalaxyButton />
      </section>

      {/* ===== KINETICA — the engine behind the shows ===== */}
      <section className="relative z-10 mx-auto mt-14 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-xl border border-white/10 px-6 py-8 text-center sm:px-10">
          {/* ambient concert backdrop — xsytrance live */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/rave-club.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-center opacity-45" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#05030b]/80 via-[#05030b]/60 to-[#05030b]/90" />
          <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-white/40">the engine behind the shows</p>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/75">
            Every full show on this wall is performed live by <a href="https://xsytrance.github.io/kinetica/" target="_blank" rel="noopener noreferrer" className="text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white">Kinetica</a> —
            our free, <a href="https://github.com/xsytrance/kinetica" target="_blank" rel="noopener noreferrer" className="text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white">open-source</a> lyric-video
            engine. Drop a Suno stem zip and it listens to the actual drums and bass, igniting every word in time with the
            music. It runs entirely in your browser — your song never leaves your machine.
          </p>
          <a href="https://xsytrance.github.io/kinetica/" target="_blank" rel="noopener noreferrer"
            className="mt-5 inline-block rounded-sm border border-white/20 px-5 py-2.5 font-mono text-xs tracking-[0.2em] text-white/70 transition hover:border-white/60 hover:text-white">
            TRY KINETICA WITH YOUR OWN TRACKS ↗
          </a>
          </div>
        </div>
      </section>

      {/* ===== SOUNDCLOUD ===== */}
      <section className="relative z-10 mx-auto mt-14 max-w-7xl px-4 sm:px-6 lg:px-8">
        <SoundCloudEmbed url="https://soundcloud.com/rod-agenor" />
      </section>

      {/* ===== FRIEND OF THE HOUSE — Tyler Haze lives at tyler.x1c7.com now
           (2026-07-25). The collection leads again; this is the standing door
           to Juan's site, and the owner's message stays with it. ===== */}
      <TylerPromo />

      {/* ===== the crew's next announcement ===== */}
      <div className="relative z-10 mt-20">
        <ZeroChallenger compact />
      </div>

      {/* the way back to the hub — at the bottom now, where an exit belongs */}
      <div className="relative z-10 px-4 pb-6 pt-10 sm:px-6 lg:px-8">
        <BackToHub />
      </div>
    </main>
  );
}
