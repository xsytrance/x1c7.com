"use client";

// ═══════════════════════════════════════════════════════════════════════════
// TYLER HAZE HERO — the guest-of-honor takeover atop /music (2026-07-17).
// Juan (jayodeed) dropped his first album as Tyler Haze; the owner's catalog
// steps back while this holds the spotlight. Everything it shows comes from
// src/data/tylerhaze.ts — delete this component's import in /music to retire
// the takeover. Title letters get the scrawl treatment (per-letter tilt +
// stagger-in) as a nod to the album art's handwritten brush title.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import Link from "next/link";
import { TYLER, TYLER_LINKS, TYLER_TRACKS, TYLER_GALLERY } from "@/data/tylerhaze";

function ScrawlTitle({ text }: { text: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 120); return () => clearTimeout(t); }, []);
  let i = 0;
  return (
    <h1 aria-label={text} className="font-display text-4xl font-black leading-[1.02] text-white sm:text-6xl">
      {text.split(" ").map((word, w) => (
        <span key={w} className="inline-block whitespace-nowrap pr-[0.35em]">
          {word.split("").map((ch) => {
            const k = i++;
            const rot = ((k * 137) % 9) - 4; // deterministic scrawl tilt, −4°…+4°
            return (
              <span
                key={k}
                className="inline-block transition-all duration-500"
                style={{
                  transform: on ? `rotate(${rot}deg)` : "rotate(0deg) translateY(14px)",
                  opacity: on ? 1 : 0,
                  transitionDelay: `${k * 28}ms`,
                  textShadow: "0 0 22px color-mix(in srgb, var(--theme-primary) 55%, transparent), 0 2px 24px rgba(0,0,0,.9)",
                }}
              >
                {ch}
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

export function TylerHazeHero() {
  return (
    <section className="relative mb-14 overflow-hidden rounded-2xl border border-white/12"
      style={{ background: "linear-gradient(150deg, color-mix(in srgb, var(--theme-bg) 78%, var(--theme-accent)) 0%, var(--theme-bg) 55%, color-mix(in srgb, var(--theme-bg) 86%, var(--theme-primary)) 100%)" }}>
      {/* ComfyUI backdrop — dusk porch aftermath, painted for this takeover */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.22]"
        style={{ backgroundImage: "url(https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/tyler-haze/backdrops/porch-dusk.webp)" }} />
      {/* porch-light wash */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 78% 18%, color-mix(in srgb, var(--theme-secondary) 16%, transparent), transparent 55%)" }} />

      <div className="relative grid gap-8 p-6 sm:p-10 md:grid-cols-[minmax(0,380px)_1fr] md:items-center">
        {/* cover */}
        <a href={TYLER_LINKS[0]?.url} target="_blank" rel="noreferrer"
          className="group relative mx-auto block w-full max-w-[380px] -rotate-1 transition-transform duration-500 hover:rotate-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TYLER.cover} alt={`${TYLER.album} — album cover`}
            className="w-full rounded-xl border border-white/15 shadow-[0_24px_80px_-20px_rgba(0,0,0,.9)]" />
          <span className="absolute -right-3 -top-3 rotate-6 rounded-full px-3 py-1 font-display text-xs font-black tracking-wide text-black shadow-lg"
            style={{ background: "var(--theme-secondary)" }}>
            OUT NOW
          </span>
        </a>

        {/* copy */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: "var(--theme-secondary)" }}>
            {TYLER.released} · debut album · {TYLER.genre} · guest of honor
          </p>
          <p className="mt-2 font-display text-lg font-bold" style={{ color: "var(--theme-primary)" }}>
            TYLER HAZE <span className="text-white/40">· the AI persona of{" "}
              <a href="https://suno.com/@jc_gomez0311" target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-4 transition hover:text-white hover:decoration-white">{TYLER.by}</a></span>
          </p>
          <div className="mt-1">
            <ScrawlTitle text={TYLER.album} />
          </div>

          <blockquote className="mt-5 max-w-xl border-l-2 pl-4 text-[14px] leading-relaxed text-white/80"
            style={{ borderColor: "var(--theme-primary)" }}>
            {TYLER.message}
            <span className="mt-1 block font-mono text-[11px] text-white/45">— xsytrance, proud as hell</span>
          </blockquote>

          {/* streaming buttons — verified links only */}
          <div className="mt-6 flex flex-wrap gap-2">
            {TYLER_LINKS.map((l, i) => (
              <a key={l.service} href={l.url} target="_blank" rel="noreferrer"
                className={`rounded-full px-4 py-2 font-mono text-[11.5px] transition hover:scale-[1.04] ${
                  i === 0 ? "font-bold text-black" : "border border-white/25 text-white/80 hover:border-white/60"
                }`}
                style={i === 0 ? { background: "var(--theme-primary)" } : undefined}>
                {i === 0 ? "▶ " : ""}{l.service}
              </a>
            ))}
          </div>

          {/* the featured show */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {/* ?reel=1 → KineticStage turns the Curator's reel ghosts on for the session */}
            <Link href={`/t/${TYLER.featuredTrackId}?reel=1`}
              className="rounded-full border px-4 py-2 font-display text-sm font-bold transition hover:scale-[1.04]"
              style={{ borderColor: "var(--theme-secondary)", color: "var(--theme-secondary)" }}>
              ⚡ #MADETOBREAK — the full x1c7 show
            </Link>
            <span className="font-mono text-[10px] text-white/40">my favorite track, given the full planet treatment</span>
          </div>

          {/* tracklist strip */}
          <p className="mt-6 font-mono text-[10.5px] leading-relaxed text-white/45">
            {TYLER_TRACKS.map((t, i) => (
              <span key={t}>
                <span className={t === "#MADETOBREAK" ? "font-bold text-white/85" : undefined}>
                  {i + 1}. {t}
                </span>
                {i < TYLER_TRACKS.length - 1 ? "  ·  " : ""}
              </span>
            ))}
          </p>

          {/* RATED TYLER advisory */}
          <div className="mt-6 inline-block border-2 border-white/70 px-3 py-1.5">
            <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-white/90">Rated Tyler</p>
            <p className="font-mono text-[8.5px] uppercase tracking-wider text-white/55">{TYLER.ratedTyler}</p>
          </div>
        </div>
      </div>

      {/* official artwork gallery — all 12, straight from Tyler */}
      <div className="relative border-t border-white/10 px-6 pb-6 pt-4 sm:px-10">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
          the visual world — official Tyler Haze artwork
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {TYLER_GALLERY.map((u, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={u} src={u} alt={`Tyler Haze artwork ${i + 1}`} loading="lazy"
              className="h-36 w-36 flex-none rounded-lg border border-white/12 object-cover transition duration-300 hover:scale-[1.05] hover:border-white/40 sm:h-44 sm:w-44" />
          ))}
        </div>
      </div>
    </section>
  );
}
