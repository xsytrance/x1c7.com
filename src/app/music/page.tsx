"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";
import { tracks, featuredTracks, musicSources } from "@/data/tracks";

function TrackCard({ track, index }: { track: (typeof tracks)[0]; index: number }) {
  const [showEmbed, setShowEmbed] = useState(false);
  const hasSoundcloud = !!track.soundcloudUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.06, duration: 0.5 }}
      className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] backdrop-blur transition-all duration-300 hover:border-white/25"
    >
      {/* Album art */}
      <div className="relative aspect-square overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${track.art})` }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${track.color}33, transparent 70%), linear-gradient(to bottom, transparent 50%, rgba(5,3,11,0.8) 100%)`,
          }}
        />

        {/* Genre + Duration badges */}
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <span
            className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider"
            style={{ background: `${track.color}22`, color: track.color, border: `1px solid ${track.color}33` }}
          >
            {track.genre}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">{track.duration}</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-5">
        <h3 className="font-display text-lg font-black uppercase tracking-wide text-white">{track.title}</h3>
        <p className="mt-1 font-mono text-xs uppercase tracking-wider text-white/40">
          {track.artist} {track.mood ? `· ${track.mood}` : ""}
        </p>

        {/* SoundCloud embed or placeholder */}
        <div className="mt-4">
          {hasSoundcloud ? (
            <>
              <button
                onClick={() => setShowEmbed(!showEmbed)}
                className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-xs font-black uppercase tracking-[0.2em] text-void transition hover:scale-[1.02]"
                style={{ background: track.color }}
              >
                {showEmbed ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#05030b"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                    Hide Player
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#05030b"><path d="M8 5v14l11-7z" /></svg>
                    Play on SoundCloud
                  </>
                )}
              </button>

              <AnimatePresence>
                {showEmbed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-3 overflow-hidden rounded-xl"
                  >
                    <iframe
                      width="100%"
                      height="166"
                      scrolling="no"
                      frameBorder="no"
                      allow="autoplay"
                      src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(track.soundcloudUrl!)}&color=${track.color.replace("#", "%23")}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
                      className="rounded-xl"
                      title={`${track.title} on SoundCloud`}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-full border border-dashed border-white/10 py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/25">Coming soon</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function FeaturedTrack({ track }: { track: (typeof tracks)[0] }) {
  const [showEmbed, setShowEmbed] = useState(false);
  const hasSoundcloud = !!track.soundcloudUrl;

  return (
    <ScrollReveal>
      <motion.div
        className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.04] backdrop-blur transition-all duration-300 hover:border-white/25"
        whileHover={{ scale: 1.005 }}
      >
        <div className="grid lg:grid-cols-2">
          {/* Album art */}
          <div className="relative aspect-square overflow-hidden lg:aspect-auto">
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{ backgroundImage: `url(${track.art})` }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${track.color}33, transparent 70%), linear-gradient(135deg, ${track.color}22, transparent)`,
              }}
            />
            <div className="absolute left-6 top-6">
              <span
                className="rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wider"
                style={{ background: `${track.color}33`, color: track.color, border: `1px solid ${track.color}44` }}
              >
                {track.genre}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col justify-center p-8 sm:p-12">
            <p className="font-mono text-xs uppercase tracking-[0.4em] text-white/30">Featured Transmission</p>
            <h2 className="mt-4 font-display text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">
              {track.title}
            </h2>
            <p className="mt-3 font-mono text-sm uppercase tracking-wider text-white/40">
              {track.artist} · {track.duration} · {track.mood}
            </p>
            <p className="mt-6 max-w-md text-base leading-8 text-white/60">
              The first signal from xsy. A transmission from the edge of the creative void,
              where machines dream in sound and humans shape the noise into meaning.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {hasSoundcloud ? (
                <button
                  onClick={() => setShowEmbed(!showEmbed)}
                  className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105"
                  style={{ background: track.color }}
                >
                  {showEmbed ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                      Hide Player
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><path d="M8 5v14l11-7z" /></svg>
                      Play on SoundCloud
                    </>
                  )}
                </button>
              ) : (
                <div className="rounded-full border border-dashed border-white/15 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/40">
                  Coming Soon
                </div>
              )}
              <Link
                href="https://soundcloud.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/60 transition hover:border-plasma hover:text-plasma"
              >
                Open SoundCloud
              </Link>
            </div>

            {/* Embed */}
            <AnimatePresence>
              {showEmbed && hasSoundcloud && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 24 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden rounded-xl"
                >
                  <iframe
                    width="100%"
                    height="166"
                    scrolling="no"
                    frameBorder="no"
                    allow="autoplay"
                    src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(track.soundcloudUrl!)}&color=${track.color.replace("#", "%23")}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
                    className="rounded-xl"
                    title={`${track.title} on SoundCloud`}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </ScrollReveal>
  );
}

export default function Page() {
  const heroTrack = featuredTracks[0] || tracks[0];
  const gridTracks = tracks.filter((t) => t.id !== heroTrack.id);

  return (
    <main className="relative min-h-screen overflow-hidden pb-20">
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />

      <div className="relative z-10 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <BackToHub />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-6 text-center sm:px-6 lg:px-8">
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
      </section>

      {/* ===== FEATURED TRACK ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <FeaturedTrack track={heroTrack} />
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="relative z-10 mx-auto mt-8 max-w-6xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal delay={0.1}>
          <div className="flex flex-wrap items-center justify-center gap-6 rounded-[2rem] border border-white/10 bg-white/[0.03] px-6 py-4 backdrop-blur">
            <div className="text-center">
              <p className="font-display text-2xl font-black text-white">{tracks.length}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">Tracks</p>
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
      <section className="relative z-10 mx-auto mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
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

      {/* ===== BOTTOM NAV ===== */}
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
    </main>
  );
}
