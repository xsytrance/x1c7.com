"use client";

import Link from "next/link";
import { StatusChip } from "@/components/StatusChip";
import { SignalPanel } from "@/components/SignalPanel";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";
import { tracks, musicSources } from "@/data/tracks";

export default function Page() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />

      <div className="relative z-10 px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <BackToHub />
      </div>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 pb-12 pt-6 text-center sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.45em] text-plasma/80">x1c7 portal</p>
        <div className="mt-5">
          <TextScramble
            text="Music"
            as="h1"
            className="font-display text-5xl font-black uppercase tracking-[-0.06em] glow-text sm:text-7xl"
            delay={200}
          />
        </div>
        <p className="mx-auto mt-6 max-w-xl text-lg font-semibold leading-8 text-white/75">
          Suno transmissions, SoundCloud links, PulseBox/Jukebox plans, future visualizers.
        </p>
        <div className="mx-auto mt-6 flex justify-center">
          <AudioVisualizer barCount={9} color="#ff2bd6" />
        </div>
        {/* Waveform decoration */}
        <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-[2px]" aria-hidden="true">
          {Array.from({ length: 40 }).map((_, i) => {
            const height = 4 + Math.sin(i * 0.5) * 12 + Math.cos(i * 0.3) * 8;
            return (
              <div
                key={i}
                className="w-[2px] rounded-full bg-plasma/30"
                style={{
                  height: `${Math.abs(height)}px`,
                  opacity: 0.2 + Math.sin(i * 0.4) * 0.15,
                  animation: `visualizerBounce ${0.6 + Math.sin(i) * 0.3}s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.05}s`,
                }}
              />
            );
          })}
        </div>
      </section>

      {/* Source Cards */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {musicSources.map((source, i) => (
            <ScrollReveal key={source.name} delay={i * 0.1}>
              <SignalPanel accentColor={source.color} className="card-lift h-full">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/15 text-lg font-black"
                    style={{ background: `${source.color}22`, color: source.color }}
                  >
                    {source.name === "Suno" ? "\u266A" : source.name === "SoundCloud" ? "\u2248" : "\u263C"}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-black uppercase tracking-wide">{source.name}</h3>
                    <StatusChip status={source.status === "active" ? "live" : "forming"} />
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-white/65">{source.description}</p>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-block rounded-full px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105"
                    style={{ background: source.color }}
                  >
                    Open {source.name.split(" ")[0]}
                  </a>
                ) : (
                  <div className="mt-5 inline-block rounded-full border border-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/50">
                    Concept phase
                  </div>
                )}
              </SignalPanel>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Featured Tracks */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <ScrollReveal>
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.4em] text-white/45">featured transmissions</p>
        </ScrollReveal>
        <div className="grid gap-4 sm:grid-cols-2">
          {tracks.map((track, i) => (
            <ScrollReveal key={track.id} delay={i * 0.08}>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition hover:border-white/20 card-lift">
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl" style={{ background: `${track.color}22` }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <h4 className="font-display text-base font-bold text-white">{track.title}</h4>
                    <p className="mt-1 text-sm text-white/55">{track.artist}</p>
                  </div>
                  <span className="font-mono text-xs text-white/35">{track.duration}</span>
                </div>
                <div className="relative mt-4 flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-white/40">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: track.color }} />
                    {track.source}
                  </span>
                  <StatusChip status="locked" />
                </div>
                <div className="relative mt-4 rounded-xl border border-dashed border-white/10 p-3 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">Coming soon</span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Bottom Nav */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 pb-20 text-center sm:px-6">
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-full bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105 hover:bg-plasma">Back to hub</Link>
          <Link href="/classified" className="rounded-full border border-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/70 transition hover:border-red-400 hover:text-white">Try locked door</Link>
        </div>
      </section>
    </main>
  );
}
