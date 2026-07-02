"use client";

// THE GALAXY — the catalog as a universe. Every word-synced song is a
// planet floating in space: its cover is the surface, its palette the glow,
// its passes the moons in orbit. Tap a planet to land on it — the full
// lyric show takes over right here. Songs without word data drift by as
// asteroids, waiting to become worlds.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTracks } from "@/lib/useTracks";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { CinematicLyrics } from "@/components/CinematicLyrics";
import { canPerform } from "@/components/KineticStage";
import type { Track } from "@/data/tracks";

/* eslint-disable @next/next/no-img-element */

// Golden-angle spiral: planets wind outward from the galactic core.
function place(i: number, total: number) {
  const angle = i * 2.39996; // golden angle in radians
  const r = 12 + (i / Math.max(1, total - 1)) * 34; // % from center
  return {
    left: 50 + r * Math.cos(angle) * 0.92,
    top: 50 + r * Math.sin(angle) * 0.78,
  };
}

export default function GalaxyPage() {
  const { tracks } = useTracks();
  const { playTrack, currentTrack, isPlaying } = useMusicPlayer();
  const [focus, setFocus] = useState<Track | null>(null);

  const planets = useMemo(() => tracks.filter(canPerform), [tracks]);
  const asteroids = useMemo(() => tracks.filter((t) => !canPerform(t)), [tracks]);

  // Deep link: /galaxy?track=<id> opens that planet's landing card —
  // a shareable address for every world.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("track");
    if (!id) return;
    const t = planets.find((p) => p.id === id);
    if (t) setFocus(t);
  }, [planets]);

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#030208]">
      {/* starfield */}
      {Array.from({ length: 90 }).map((_, i) => (
        <span
          key={`s${i}`}
          className="galaxy-star"
          style={{
            left: `${(i * 761) % 100}%`,
            top: `${(i * 379) % 100}%`,
            width: i % 9 === 0 ? 2.5 : 1.5,
            height: i % 9 === 0 ? 2.5 : 1.5,
            animationDelay: `${(i * 0.7) % 6}s`,
          }}
        />
      ))}
      {/* nebula glow */}
      <div className="pointer-events-none absolute inset-0" style={{
        background:
          "radial-gradient(ellipse at 30% 40%, color-mix(in srgb, var(--theme-primary) 9%, transparent), transparent 55%)," +
          "radial-gradient(ellipse at 72% 65%, color-mix(in srgb, var(--theme-secondary) 7%, transparent), transparent 50%)",
      }} />

      {/* header */}
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-5 py-4 sm:px-8">
        <div>
          <h1 className="font-display text-lg font-black uppercase tracking-[0.25em] text-white">The Galaxy</h1>
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">
            {planets.length} planets · {asteroids.length} asteroids waiting to become worlds
          </p>
        </div>
        <Link href="/music" className="rounded-full border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-white/60 transition hover:text-white">
          ← Music
        </Link>
      </header>

      {/* asteroids — the not-yet-planets drifting in the deep background */}
      {asteroids.map((t, i) => (
        <div
          key={t.id}
          className="galaxy-asteroid"
          title={`${t.title} — not yet a planet`}
          style={{
            left: `${(i * 617 + 43) % 100}%`,
            top: `${(i * 271 + 11) % 100}%`,
            animationDelay: `${(i * 1.3) % 12}s`,
            animationDuration: `${16 + (i * 3) % 14}s`,
          }}
        />
      ))}

      {/* planets */}
      {planets.map((t, i) => {
        const pos = place(i, planets.length);
        const active = currentTrack?.id === t.id;
        const size = 8.5 + ((t.planet?.analysis?.sections?.length ?? 8) / 27) * 5; // vmin, by emotional richness
        return (
          <motion.button
            key={t.id}
            onClick={() => setFocus(t)}
            className="galaxy-planet group absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: `${size}vmin`, height: `${size}vmin`, animationDelay: `${(i * 1.1) % 7}s` }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 160, damping: 18 }}
            title={t.title}
          >
            <span
              className={`absolute -inset-1 rounded-full ${active && isPlaying ? "galaxy-pulse" : ""}`}
              style={{ boxShadow: `0 0 ${active ? 34 : 16}px ${t.color}66, inset 0 0 12px #00000088`, border: `1px solid ${t.color}55` }}
            />
            <span className="block h-full w-full overflow-hidden rounded-full">
              {t.cover
                ? <img src={t.cover} alt={t.title} className="h-full w-full object-cover transition group-hover:scale-110" loading="lazy" />
                : <span className="block h-full w-full" style={{ background: t.art }} />}
            </span>
            {/* moons — the preserved passes in orbit */}
            <span className="galaxy-moon" style={{ animationDuration: "9s" }} />
            <span className="galaxy-moon galaxy-moon--far" style={{ animationDuration: "15s", animationDelay: "-4s" }} />
            <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-wider text-white/0 transition group-hover:text-white/70">
              {t.title}
            </span>
          </motion.button>
        );
      })}

      {/* planet card — land on it */}
      <AnimatePresence>
        {focus && (
          <motion.div
            className="absolute inset-x-0 bottom-0 z-30 p-4 sm:p-6"
            initial={{ y: 160, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 160, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <div className="mx-auto flex max-w-xl items-center gap-4 rounded-3xl border border-white/12 bg-black/70 p-4 backdrop-blur">
              <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-full" style={{ boxShadow: `0 0 20px ${focus.color}66` }}>
                {focus.cover ? <img src={focus.cover} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full" style={{ background: focus.art }} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base font-black uppercase text-white">{focus.title}</span>
                <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-white/45">
                  🪐 {focus.planet?.analysis?.overallMood} · {(focus.planet?.analysis?.themes ?? []).slice(0, 3).join(" · ")}
                </span>
                {focus.planet?.respondsTo && (
                  <span className="block truncate font-mono text-[9px] uppercase tracking-wider" style={{ color: focus.color }}>
                    ↩ answers {focus.planet.respondsTo}
                  </span>
                )}
              </span>
              <button
                onClick={() => { playTrack(focus, tracks); setFocus(null); }}
                className="shrink-0 rounded-full px-5 py-3 font-display text-sm font-black uppercase tracking-wider text-void transition hover:scale-105"
                style={{ background: focus.color }}
              >
                Land ▶
              </button>
              <button onClick={() => setFocus(null)} aria-label="Close" className="shrink-0 rounded-full border border-white/15 p-2 text-white/50 hover:text-white">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the show itself — playing a planet takes over right here */}
      <CinematicLyrics />
    </main>
  );
}
