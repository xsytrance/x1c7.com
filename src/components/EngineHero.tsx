"use client";

// ENGINE HERO — the live wallpaper for /engine, mirroring the Kinetica app's
// landing: a real catalog song performs behind the invitation, MUTED (the
// stage clocks off a muted <audio> whose currentTime advances silently), so
// the page opens already alive. Same perf discipline: capability-gated with a
// static poster fallback, paused when hidden/offscreen, low render scale,
// pointer-events-none, stage chrome suppressed (scoped). The invitation +
// funnel button sit on top; the page's feature cards live below.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { KineticStage, canPerform } from "@/components/KineticStage";
import { P } from "@/lib/engine/params";
import { useTracks } from "@/lib/useTracks";
import type { Track } from "@/data/tracks";

const KINETICA = "https://xsytrance.github.io/kinetica/";

function canRunLive(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia;
  if (mm("(prefers-reduced-motion: reduce)").matches) return false;
  if (mm("(pointer: coarse)").matches) return false;
  if (Math.min(window.innerWidth, window.innerHeight) < 720) return false;
  try {
    const c = document.createElement("canvas");
    if (!c.getContext("webgl2")) return false;
  } catch {
    return false;
  }
  return true;
}

export function EngineHero() {
  const { tracks } = useTracks();
  const performable = useMemo(() => tracks.filter(canPerform), [tracks]);
  const [live, setLive] = useState(false);
  const [track, setTrack] = useState<Track | null>(null);
  const [rolling, setRolling] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // capability + render-scale + beat-game silence (decided once)
  useEffect(() => {
    if (!canRunLive()) return;
    setLive(true);
    const prevScale = P.get("backdrop.renderScale");
    P.set("backdrop.renderScale", 0.35, "code");
    const prevBeat = localStorage.getItem("x1c7-beat-game");
    localStorage.setItem("x1c7-beat-game", "off");
    return () => {
      P.set("backdrop.renderScale", prevScale, "code");
      if (prevBeat === null) localStorage.removeItem("x1c7-beat-game");
      else localStorage.setItem("x1c7-beat-game", prevBeat);
    };
  }, []);

  // pick a song once the catalog is loaded (prefer light-it-myself, else random)
  useEffect(() => {
    if (!live || track || !performable.length) return;
    const pick = performable.find((t) => t.id === "light-it-myself") ??
      performable[Math.floor(Math.random() * performable.length)];
    setTrack(pick);
  }, [live, track, performable]);

  // the muted clock element + lifecycle
  useEffect(() => {
    if (!track?.audioUrl) return;
    const a = new Audio();
    a.src = track.audioUrl;
    a.crossOrigin = "anonymous";
    a.muted = true;
    a.loop = true;
    a.preload = "auto";
    audioRef.current = a;
    a.play().then(() => setRolling(true)).catch(() => setRolling(true));

    const resume = () => { if (!document.hidden) a.play().catch(() => {}); };
    const onVis = () => (document.hidden ? a.pause() : resume());
    document.addEventListener("visibilitychange", onVis);
    let io: IntersectionObserver | null = null;
    if (boxRef.current) {
      io = new IntersectionObserver(([e]) => (e.isIntersecting ? resume() : a.pause()), { threshold: 0.04 });
      io.observe(boxRef.current);
    }
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      io?.disconnect();
      a.pause();
      a.src = "";
      audioRef.current = null;
    };
  }, [track]);

  return (
    <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-5 py-16 text-center">
      {/* the live show (or a calm gradient when the device can't/should not) */}
      <div ref={boxRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {live && track && rolling ? (
          <div className="hero-live-stage absolute inset-0" style={{ transform: "translateZ(0)" }}>
            <style>{`.hero-live-stage [title^="Tap-to-the-beat"],.hero-live-stage .stage-warn-pill{display:none!important}`}</style>
            <KineticStage
              track={track}
              pass={3}
              mode="focus"
              forceBackdrop
              timelineBottomClass="-bottom-64"
              clock={() => audioRef.current?.currentTime ?? 0}
            />
          </div>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--theme-primary) 24%, transparent), transparent 45%)," +
                "radial-gradient(circle at 78% 30%, color-mix(in srgb, var(--theme-accent) 18%, transparent), transparent 42%)",
            }}
          />
        )}
        {/* legibility scrim */}
        <div className="absolute inset-0 bg-[var(--theme-bg,#05030b)]/45" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 55% at 50% 46%, color-mix(in srgb, var(--theme-bg, #05030b) 78%, transparent), transparent 75%)" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--theme-bg,#05030b)]/40 via-transparent to-[var(--theme-bg,#05030b)]/95" />
      </div>

      {/* the invitation */}
      <div className="relative z-10 flex max-w-3xl flex-col items-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-white/45">the kinetica engine · live</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl">
          This is what your<br />
          <span style={{ color: "var(--theme-primary)" }}>Suno stems become.</span>
        </h1>
        <p className="mt-5 max-w-xl font-mono text-xs leading-6 tracking-wide text-white/65">
          {live
            ? "That's a real song performing behind this — measured stems, word-timed lyrics, a living backdrop, all in a browser. Bring your own and it does the same to yours."
            : "Measured stems, word-timed lyrics, a living generative backdrop — a real show from ground truth, entirely in your browser. Bring your own song and it does the same to yours."}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={KINETICA}
            target="_blank"
            rel="noreferrer"
            className="rounded-full px-6 py-3 font-display text-sm font-black uppercase tracking-[0.15em] text-black transition hover:scale-105"
            style={{ background: "var(--theme-primary)", boxShadow: "0 0 34px color-mix(in srgb, var(--theme-primary) 30%, transparent)" }}
          >
            🎬 Bring your own stems →
          </a>
          <Link
            href="/t/light-it-myself"
            className="rounded-full border border-white/25 bg-black/25 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/75 backdrop-blur-sm transition hover:border-white/50 hover:text-white"
          >
            ▶ Watch one from the catalog
          </Link>
          <Link
            href="/music"
            className="rounded-full border border-white/15 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/55 transition hover:border-white/40 hover:text-white"
          >
            The full collection
          </Link>
        </div>
        <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.25em] text-white/35">
          free · open source · nothing uploaded · your song never leaves your machine
        </p>
      </div>

      <span className="relative z-10 mt-10 animate-bounce font-mono text-[9px] uppercase tracking-[0.3em] text-white/30">under the hood ↓</span>
    </section>
  );
}
