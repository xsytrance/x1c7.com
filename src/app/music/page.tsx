"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";
import { TrackCard } from "@/components/TrackCard";
import { MusicPlayerBar } from "@/components/MusicPlayerBar";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { tracks, featuredTracks, musicSources } from "@/data/tracks";

export default function Page() {
  const { currentTrack, isPlaying, playTrack } = useMusicPlayer();
  const heroTrack = featuredTracks[0] || tracks[0];
  const gridTracks = tracks.filter((t) => t.id !== heroTrack.id);

  return (
    <main className="relative min-h-screen overflow-hidden pb-24">
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />

      <div className="relative z-10 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <BackToHub />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.45em] text-plasma/80">x1c7 transmissions</p>
          <div className="mt-5">
            <TextScramble
              text="Music"
              as="h1"
              className="font-display text-6xl font-black uppercase tracking-[-0.06em] glow-text sm:text-8xl lg:text-9xl"
              delay={200}
            />
          </div>
          <p className="mx-auto mt-6 max-w-xl text-lg font-semibold leading-8 text-white/75">
            Songs born from signal, polished by human ears. Play loud.
          </p>
        </div>

        {/* ===== HERO FEATURED TRACK ===== */}
        <ScrollReveal className="mt-12">
          <motion.div
            className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.04] backdrop-blur transition-all duration-300 hover:border-white/25"
            whileHover={{ scale: 1.005 }}
          >
            <div className="grid lg:grid-cols-2">
              {/* Album art */}
              <div className="relative aspect-square overflow-hidden lg:aspect-auto">
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                  style={{ backgroundImage: `url(${heroTrack.art})` }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(circle at 50% 50%, ${heroTrack.color}33, transparent 70%), linear-gradient(135deg, ${heroTrack.color}22, transparent)`,
                  }}
                />
                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <button
                    onClick={() => playTrack(heroTrack, tracks)}
                    className="grid h-24 w-24 place-items-center rounded-full shadow-2xl transition hover:scale-110"
                    style={{ background: heroTrack.color }}
                    aria-label={`Play ${heroTrack.title}`}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="#05030b">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </div>
                {/* Genre badge */}
                <div className="absolute left-6 top-6">
                  <span
                    className="rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wider"
                    style={{ background: `${heroTrack.color}33`, color: heroTrack.color, border: `1px solid ${heroTrack.color}44` }}
                  >
                    {heroTrack.genre}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="flex flex-col justify-center p-8 sm:p-12">
                <p className="font-mono text-xs uppercase tracking-[0.4em] text-white/30">Featured Transmission</p>
                <h2 className="mt-4 font-display text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">
                  {heroTrack.title}
                </h2>
                <p className="mt-3 font-mono text-sm uppercase tracking-wider text-white/40">
                  {heroTrack.artist} · {heroTrack.duration} · {heroTrack.mood}
                </p>
                <p className="mt-6 max-w-md text-base leading-8 text-white/60">
                  The first signal from xsy. A transmission from the edge of the creative void,
                  where machines dream in sound and humans shape the noise into meaning.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    onClick={() => playTrack(heroTrack, tracks)}
                    className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105"
                    style={{ background: heroTrack.color }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><path d="M8 5v14l11-7z" /></svg>
                    Play Now
                  </button>
                  <Link
                    href="https://suno.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-white/15 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/60 transition hover:border-plasma hover:text-plasma"
                  >
                    Open on Suno
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </ScrollReveal>

        {/* ===== STATS BAR ===== */}
        <ScrollReveal delay={0.1}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-4 backdrop-blur">
            <div className="text-center">
              <p className="font-display text-2xl font-black text-white">{tracks.length}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Tracks</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className="font-display text-2xl font-black text-white">
                {Math.floor(tracks.reduce((acc, t) => acc + t.durationSeconds, 0) / 60)}m
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Total Length</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className="font-display text-2xl font-black text-plasma">
                {[...new Set(tracks.map((t) => t.genre))].length}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Genres</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              {musicSources.map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition hover:opacity-80"
                  style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}33` }}
                >
                  {s.name}
                </a>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ===== TRACK GRID ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <p className="mb-8 font-mono text-xs uppercase tracking-[0.4em] text-white/40">All Transmissions</p>
        </ScrollReveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {gridTracks.map((track, i) => (
            <TrackCard key={track.id} track={track} index={i} />
          ))}
        </div>
      </section>

      {/* ===== WAVEFORM DECORATION ===== */}
      <section className="relative z-10 mx-auto mt-20 max-w-6xl overflow-hidden px-4 sm:px-6" aria-hidden="true">
        <div className="flex items-end justify-center gap-[2px] opacity-20">
          {Array.from({ length: 80 }).map((_, i) => {
            const height = 10 + Math.sin(i * 0.3) * 15 + Math.cos(i * 0.7) * 10;
            return (
              <div
                key={i}
                className="w-[3px] rounded-full bg-plasma/40"
                style={{
                  height: `${Math.max(4, Math.abs(height))}px`,
                  animation: `visualizerBounce ${0.8 + Math.sin(i) * 0.4}s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.02}s`,
                }}
              />
            );
          })}
        </div>
      </section>

      {/* ===== SOURCES ===== */}
      <section className="relative z-10 mx-auto mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="flex flex-wrap justify-center gap-4">
            {musicSources.map((source) => (
              <a
                key={source.name}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.08]"
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-lg"
                  style={{ background: `${source.color}22`, color: source.color }}
                >
                  {source.name === "Suno" ? "♪" : "≈"}
                </span>
                <div>
                  <p className="font-display text-sm font-bold uppercase text-white">{source.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">{source.description}</p>
                </div>
              </a>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* Bottom nav */}
      <section className="relative z-10 mx-auto mt-16 max-w-5xl px-4 text-center sm:px-6">
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-full bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105 hover:bg-plasma">
            Back to hub
          </Link>
          <Link href="/classified" className="rounded-full border border-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/70 transition hover:border-red-400 hover:text-white">
            Try locked door
          </Link>
        </div>
      </section>

      {/* Persistent player bar */}
      <MusicPlayerBar />
    </main>
  );
}
