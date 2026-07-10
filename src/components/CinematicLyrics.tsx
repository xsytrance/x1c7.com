"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMusicPlayer } from "./MusicPlayerContext";
import { parseLyrics, activeIndex, headerLabel, type ParsedLine } from "@/lib/lyrics";
import { uiStore } from "@/lib/uiStore";
import { KineticStage, canPerform, MODES, type StageMode } from "./KineticStage";
import { LabStage, LAB_MODES, type LabMode } from "./LabStage";
import { StemMixer } from "./StemMixer";
import { StemLens } from "./StemLens";
import { useStemMix } from "@/lib/stemMix";
import type { Track } from "@/data/tracks";

/**
 * Now-playing lyrics. A static inline preview on the page, plus a fullscreen
 * "cinematic" takeover that AUTO-OPENS when a track with lyrics starts playing —
 * front and center. The takeover is opaque (so the heavy /music page behind it is
 * occluded + culled) and pauses the particle field, which keeps mobile renderers
 * alive. The karaoke highlight is driven by rAF + refs (no per-frame re-render).
 */
// "Just play it" seam — a page can ask that the NEXT auto-takeover for a
// track be skipped (music only, no show). One-shot; consumed on first check.
let suppressFor: string | null = null;
export const suppressTakeoverFor = (id: string) => { suppressFor = id; };

export function CinematicLyrics() {
  const { currentTrack, isPlaying } = useMusicPlayer();
  const [open, setOpen] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const parsed = useMemo(() => parseLyrics(currentTrack?.lyrics), [currentTrack?.lyrics]);
  const hasLyrics = parsed.lines.some((l) => l.text.trim().length > 0);

  // New track → forget any prior dismissal so it can take over again.
  useEffect(() => { setDismissedId(null); }, [currentTrack?.id]);

  // Auto-take-over: when a lyrics track plays and the user hasn't closed it, open.
  useEffect(() => {
    if (!(isPlaying && hasLyrics && currentTrack)) return;
    if (suppressFor === currentTrack.id) { suppressFor = null; setDismissedId(currentTrack.id); return; }
    if (dismissedId !== currentTrack.id) setOpen(true);
  }, [isPlaying, hasLyrics, currentTrack, dismissedId]);

  if (!currentTrack || !hasLyrics) return null;

  const closeTakeover = () => { setOpen(false); setDismissedId(currentTrack.id); };

  return (
    <>
      {/* Compact re-open bar — NO lyric wall on the page (owner feedback:
          closing the show shouldn't force scrolling past all the lyrics). */}
      <section className="relative z-10 mx-auto mt-10 max-w-3xl px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between rounded-2xl border px-5 py-3.5 transition hover:scale-[1.01]"
          style={{ borderColor: "color-mix(in srgb, var(--theme-primary) 35%, transparent)", background: "color-mix(in srgb, var(--theme-primary) 8%, transparent)" }}
        >
          <span className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full text-void" style={{ background: "var(--theme-primary)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#05030b"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <span className="text-left">
              <span className="block font-mono text-xs uppercase tracking-[0.3em]" style={{ color: "var(--theme-primary)" }}>Lyric show</span>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-white/35">
                {parsed.synced ? "word-synced · full engine" : "lyrics"}
              </span>
            </span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">Open ⛶</span>
        </button>
      </section>

      <CinematicTakeover open={open} track={currentTrack} lines={parsed.lines} synced={parsed.synced} onClose={closeTakeover} />
    </>
  );
}

function CinematicTakeover({ open, track, lines, synced, onClose }: {
  open: boolean;
  track: Track;
  lines: ParsedLine[];
  synced: boolean;
  onClose: () => void;
}) {
  const { isPlaying, togglePlay, getCurrentTime, next, prev, queue, playTrack, pause } = useMusicPlayer();
  const [mounted, setMounted] = useState(false);
  // The playlist drawer — the whole queue, one tap from any show.
  const [drawer, setDrawer] = useState(false);
  // Satellites: which pass of the show is playing (newest = main show).
  // Phase 6 (DYNAMIC+) is Phase 5 plus the LLM's touches — charged-word
  // effects and visual-only moments (backdrop lift + billing chip). It's the
  // top when the song ships choreography; Phase 5 (cinematic camera)
  // otherwise. Passes 1-4 are the preserved earlier looks — 4 = Kinetica
  // effects, 3 = full stagecraft, etc.
  const dynPlus = track.planet?.dynamicPlus;
  const MAX_PASS = dynPlus ? 6 : 5;
  const [pass, setPass] = useState(MAX_PASS);
  // A new song opens on its newest look (and never strands pass 6 on a song
  // without choreography).
  useEffect(() => { setPass(dynPlus ? 6 : 5); }, [track.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // THE REACTOR — experimental Labs modes. When set, they take over the stage.
  const [labMode, setLabMode] = useState<LabMode | null>(null);
  const [reactorOpen, setReactorOpen] = useState(false);
  // THE STEMS — the live mixer over the separated Suno stems, + the Lens.
  const [mixerOpen, setMixerOpen] = useState(false);
  const [lensArmed, setLensArmed] = useState(false);
  const stemMix = useStemMix();
  const hasStems = stemMix.available.length > 0;
  // New song → drop the lens; its zones (and the stems) belong to the old one.
  useEffect(() => { setLensArmed(false); }, [track.id]);
  // Viewing style, remembered across sessions.
  const [mode, setMode] = useState<StageMode>("phrase");
  useEffect(() => {
    const saved = localStorage.getItem("x1c7-lyric-style") as StageMode | null;
    if (saved && MODES.some((m) => m.id === saved)) setMode(saved);
  }, []);
  const cycleMode = () => {
    const order: StageMode[] = ["dynamic", "focus+", "focus", "phrase"];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next); localStorage.setItem("x1c7-lyric-style", next);
  };
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const lastActive = useRef(-1);
  // Full engine when the song is a planet (word timings); line karaoke otherwise.
  const performs = canPerform(track);

  // ── THE CONDUCTOR (Phase 6 · DYNAMIC+) ────────────────────────────────────
  // Walks the LLM-choreographed acts against the playhead — but only as
  // VISUAL moments now: the backdrop holds & brightens for the window, and
  // spotlight acts show their billing chip. It never touches the audio, the
  // stem mix, or the Reactor (the owner retired the takeovers).
  const [moment, setMoment] = useState<{ on: boolean; label: string | null }>({ on: false, label: null });
  useEffect(() => {
    if (!open || !performs || pass < 6 || !dynPlus?.acts?.length) return;
    const acts = dynPlus.acts;
    const iv = window.setInterval(() => {
      const t = getCurrentTime();
      const act = acts.find((a) => t >= a.start && t < a.end) ?? null;
      // Reactor-flavored acts get the backdrop accent only — no chip (the
      // mode id would advertise a takeover that no longer happens).
      const label = act?.stemSpot?.label ?? null;
      setMoment((prev) => (prev.on === !!act && prev.label === label ? prev : { on: !!act, label }));
    }, 400);
    return () => { window.clearInterval(iv); setMoment({ on: false, label: null }); };
  }, [open, performs, pass, dynPlus, getCurrentTime]);

  useEffect(() => setMounted(true), []);

  // While open: flag the shared UI store (pauses particles) + lock scroll.
  useEffect(() => {
    if (!open) return;
    uiStore.setCinematic(true);
    document.body.classList.add("cinematic-on");
    return () => { uiStore.setCinematic(false); document.body.classList.remove("cinematic-on"); };
  }, [open]);

  // Keys: Esc closes (drawer first), ←/→ hop songs, space play/pause.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (lensArmed) setLensArmed(false); else if (drawer) setDrawer(false); else onClose(); }
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " " && !(e.target as HTMLElement)?.closest("input,textarea")) { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, drawer, lensArmed, next, prev, togglePlay]);

  // Karaoke highlight (line-mode fallback only) — rAF + refs, no per-frame re-render.
  useEffect(() => {
    if (!open || !synced || performs) return;
    lastActive.current = -1;
    let raf = 0;
    const tick = () => {
      const idx = activeIndex(lines, getCurrentTime());
      if (idx !== lastActive.current) {
        lineRefs.current[lastActive.current]?.classList.remove("is-active");
        const cur = lineRefs.current[idx];
        if (cur) { cur.classList.add("is-active"); cur.scrollIntoView({ block: "center", behavior: "smooth" }); }
        lastActive.current = idx;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, synced, performs, lines, getCurrentTime]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[300] flex flex-col"
          style={{
            backgroundColor: "#05030b",
            backgroundImage:
              "radial-gradient(circle at 50% 28%, color-mix(in srgb, var(--theme-primary) 24%, transparent), transparent 60%)," +
              "radial-gradient(circle at 50% 92%, color-mix(in srgb, var(--theme-secondary) 18%, transparent), transparent 55%)," +
              "linear-gradient(160deg, var(--theme-bg), #05030b)",
          }}
        >
          {/* Player chrome — a glassy title bar lifted above the stage (z-[60] >
              the stage's z-40 layers) so its controls are never blocked. */}
          <div className="relative z-[60] flex items-center justify-between gap-2 border-b border-white/10 bg-black/40 px-3 py-2.5 backdrop-blur-md sm:px-8 sm:py-3">
            <div className="min-w-0">
              <p className="truncate font-display text-base font-black uppercase tracking-tight text-white sm:text-lg">{track.title}</p>
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--theme-primary)" }}>
                {track.artist}{synced ? " · synced" : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {/* View controls — phase + mode as one prominent segmented control
                  (the owner's most-used knobs; enlarged, accented, always on top). */}
              {performs && (
                <div className="flex items-center gap-1 rounded-2xl border border-white/15 bg-white/[0.06] p-1">
                  {pass >= 3 && (
                    <button onClick={cycleMode} title="Viewing style — Dynamic / Focus / Phrase. Tap to cycle."
                      className="rounded-xl px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-white/75 transition hover:bg-white/10 hover:text-white">
                      {MODES.find((m) => m.id === mode)?.label}
                    </button>
                  )}
                  <button onClick={() => setPass((p) => (p > 1 ? p - 1 : MAX_PASS))}
                    title="Phase — every major upgrade of the show, preserved. Tap to switch. Phase 6 = DYNAMIC+, the LLM-choreographed showcase."
                    className="rounded-xl px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-white transition"
                    style={{ background: "color-mix(in srgb, var(--theme-primary) 22%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--theme-primary) 55%, transparent)" }}>
                    {pass >= 6 ? "⚡ Dynamic+" : `🌙 Phase ${pass}`}
                  </button>
                </div>
              )}
              {/* THE STEMS — live mixer over the separated Suno stems. Only
                  songs that ship stem audio grow the fader. */}
              {performs && hasStems && (
                <div className="group relative shrink-0">
                  <button onClick={() => setMixerOpen((v) => !v)} aria-label="Stems — the live instrument mixer"
                    className="flex items-center gap-1.5 rounded-full border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition hover:scale-[1.03]"
                    style={stemMix.active || mixerOpen || lensArmed
                      ? { borderColor: "var(--theme-secondary)", color: "var(--theme-secondary)", background: "color-mix(in srgb, var(--theme-secondary) 14%, transparent)", boxShadow: "0 0 14px color-mix(in srgb, var(--theme-secondary) 50%, transparent)" }
                      : { borderColor: "color-mix(in srgb, var(--theme-secondary) 40%, transparent)", color: "var(--theme-secondary)" }}>
                    <span className="text-sm leading-none">🎚</span>
                    <span className="hidden sm:inline">{stemMix.active ? "Stems ✦" : "Stems"}</span>
                  </button>
                  <span className="pointer-events-none absolute right-0 top-full z-[80] mt-2 hidden w-56 rounded-lg border border-white/12 bg-black/85 px-3 py-2 text-right font-mono text-[10px] leading-snug text-white/75 opacity-0 backdrop-blur transition group-hover:opacity-100 sm:block">
                    🎚 <b className="text-white">Stems</b> — the song&apos;s real separated instruments. Solo, mute, remix, x-ray.
                  </span>
                </div>
              )}
              {/* THE REACTOR — experimental Labs modes (labeled + glowing so it's
                  obvious; native tooltip on hover explains it). */}
              {performs && (
                <div className="group relative shrink-0">
                  <button onClick={() => setReactorOpen((v) => !v)} aria-label="The Reactor — experimental modes"
                    className="flex items-center gap-1.5 rounded-full border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition hover:scale-[1.03]"
                    style={labMode || reactorOpen
                      ? { borderColor: "var(--theme-primary)", color: "var(--theme-primary)", background: "color-mix(in srgb, var(--theme-primary) 14%, transparent)", boxShadow: "0 0 14px color-mix(in srgb, var(--theme-primary) 50%, transparent)" }
                      : { borderColor: "color-mix(in srgb, var(--theme-primary) 40%, transparent)", color: "var(--theme-primary)" }}>
                    <motion.span animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} className="text-sm leading-none">⚛</motion.span>
                    <span className="hidden sm:inline">{labMode ? "Reactor ✦" : "Reactor"}</span>
                  </button>
                  {/* custom hover tooltip (desktop) */}
                  <span className="pointer-events-none absolute right-0 top-full z-[80] mt-2 hidden w-56 rounded-lg border border-white/12 bg-black/85 px-3 py-2 text-right font-mono text-[10px] leading-snug text-white/75 opacity-0 backdrop-blur transition group-hover:opacity-100 sm:block">
                    ⚛ <b className="text-white">The Reactor</b> — wild experimental modes: graffiti, fireworks, orbit, bubbles &amp; more.
                  </span>
                </div>
              )}
              {/* Transport */}
              <button onClick={prev} aria-label="Previous song" title="Previous song (←)"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/70 transition hover:scale-105 hover:text-white sm:h-10 sm:w-10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
              </button>
              <button onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}
                className="grid h-9 w-9 place-items-center rounded-full text-void transition hover:scale-105 sm:h-10 sm:w-10" style={{ background: "var(--theme-primary)" }}>
                {isPlaying
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><path d="M8 5v14l11-7z" /></svg>}
              </button>
              <button onClick={next} aria-label="Next song" title="Next song (→)"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/70 transition hover:scale-105 hover:text-white sm:h-10 sm:w-10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" /></svg>
              </button>
              {/* The playlist — secondary; hidden on the tightest phones. */}
              <button onClick={() => setDrawer((d) => !d)} aria-label="Playlist" title="Playlist"
                className="hidden h-9 w-9 place-items-center rounded-full border border-white/20 text-white/70 transition hover:scale-105 hover:text-white sm:grid sm:h-10 sm:w-10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 6h16M4 12h10M4 18h7" /><circle cx="18" cy="16" r="2.6" /><path d="M20.6 16V9.5l-3 1" /></svg>
              </button>
              {/* Minimize — drop back to the page; the music keeps playing */}
              <button onClick={onClose} aria-label="Minimize — music keeps playing" title="Minimize (Esc) — music keeps playing"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/70 transition hover:scale-105 hover:text-white sm:h-10 sm:w-10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </div>
          </div>

          {/* Window bezel — a faint inset frame + vignette so the whole show
              reads as one cohesive "player screen". Decorative, never blocks. */}
          <div className="pointer-events-none absolute inset-0 z-[55]" aria-hidden
            style={{ boxShadow: "inset 0 0 0 1.5px color-mix(in srgb, var(--theme-primary) 14%, rgba(255,255,255,0.06)), inset 0 0 70px rgba(0,0,0,0.4)" }} />

          {/* END SHOW — the always-there exit, thumb-reachable even mid
              Dynamic+ takeover. Stops the music AND closes the stage
              (the top-bar chevron only minimizes; music keeps playing). */}
          <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            onClick={() => { pause(); onClose(); }}
            aria-label="End the show — stops the music"
            style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
            className="absolute right-4 z-[60] flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white/75 backdrop-blur-md transition hover:scale-[1.03] hover:border-red-400/70 hover:text-red-200">
            ✕ <span>End show</span>
          </motion.button>

          {/* THE REACTOR — experimental mode picker */}
          <AnimatePresence>
            {reactorOpen && (
              <motion.div
                className="absolute right-3 top-16 z-[70] w-72 rounded-2xl border border-white/12 bg-[#0b0810]/95 p-3 backdrop-blur-md"
                initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-black uppercase tracking-wide" style={{ color: "var(--theme-primary)" }}>⚛ The Reactor</h3>
                  <button onClick={() => setReactorOpen(false)} className="font-mono text-xs text-white/50 hover:text-white">✕</button>
                </div>
                <p className="mt-0.5 font-mono text-[10px] leading-snug text-white/40">Experimental modes. More cores coming online.</p>
                <div className="mt-2 grid grid-cols-1 gap-1.5">
                  <button onClick={() => { setLabMode(null); setReactorOpen(false); }}
                    className={`rounded-lg border px-3 py-2 text-left font-mono text-[11px] transition ${!labMode ? "border-white/40 text-white" : "border-white/12 text-white/60 hover:text-white"}`}>
                    ◐ Normal show <span className="text-white/30">— the standard stage</span>
                  </button>
                  {LAB_MODES.map((lm) => (
                    <button key={lm.id} onClick={() => { setLabMode(lm.id); setReactorOpen(false); }}
                      className={`rounded-lg border px-3 py-2 text-left font-mono text-[11px] transition ${labMode === lm.id ? "border-[var(--theme-primary)] text-white" : "border-white/12 text-white/70 hover:text-white"}`}
                      style={labMode === lm.id ? { background: "color-mix(in srgb, var(--theme-primary) 16%, transparent)" } : undefined}>
                      {lm.label} <span className="text-white/35">— {lm.blurb}</span>
                    </button>
                  ))}
                  <p className="mt-1 px-1 font-mono text-[9px] uppercase tracking-widest text-white/25">soon · downpour · thread · orbit · crawl · bubbles · matrix · pinball · +more</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* DYNAMIC+ moment billing — the act's marquee line */}
          <AnimatePresence>
            {moment.label && (
              <motion.div
                className="pointer-events-none absolute bottom-24 left-1/2 z-[60] -translate-x-1/2"
                initial={{ opacity: 0, y: 12, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.94 }}
              >
                <span className="rounded-full border px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.22em]"
                  style={{ borderColor: "var(--theme-primary)", color: "var(--theme-primary)", background: "#000b", boxShadow: "0 0 18px color-mix(in srgb, var(--theme-primary) 55%, transparent)" }}>
                  ⚡ {moment.label}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* THE STEM MIXER — presets + per-instrument chips + the Lens */}
          <AnimatePresence>
            {mixerOpen && hasStems && (
              <StemMixer
                track={track}
                getTime={getCurrentTime}
                onClose={() => setMixerOpen(false)}
                lensArmed={lensArmed}
                onToggleLens={() => { setLensArmed((v) => !v); setMixerOpen(false); }}
              />
            )}
          </AnimatePresence>

          {/* PLAYLIST DRAWER — the queue as a constellation list. Planets
              (word-synced worlds) glow; tap any row to fly there. */}
          <AnimatePresence>
            {drawer && (
              <>
                <motion.div
                  key="scrim"
                  className="absolute inset-0 z-[5] bg-black/45"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setDrawer(false)}
                />
                <motion.aside
                  key="drawer"
                  className="absolute bottom-0 right-0 top-[64px] z-[6] flex w-[min(88vw,360px)] flex-col border-l border-white/10 bg-[#0a0714]/95 backdrop-blur-xl"
                  initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 36 }}
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/50">Playlist · {queue.length}</p>
                    <span className="flex items-center gap-1.5">
                      <Link href={`/vr?track=${track.id}`} onClick={onClose}
                        className="rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60 transition hover:text-white">
                        🥽 VR
                      </Link>
                      <Link href="/galaxy" onClick={onClose}
                        className="rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60 transition hover:text-white">
                        🌌 Galaxy
                      </Link>
                      <Link href="/lexicon" onClick={onClose}
                        className="rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60 transition hover:text-white">
                        📖 Lexicon
                      </Link>
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto pb-6">
                    {queue.map((t) => {
                      const active = t.id === track.id;
                      const planet = canPerform(t);
                      return (
                        <button
                          key={t.id}
                          onClick={() => { playTrack(t); setDrawer(false); }}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/5 ${active ? "bg-white/10" : ""}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={t.cover || t.art} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover"
                            style={active ? { boxShadow: "0 0 12px var(--theme-primary)" } : undefined} loading="lazy" />
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate font-display text-sm font-bold ${active ? "text-white" : "text-white/75"}`}>{t.title}</span>
                            <span className="block truncate font-mono text-[9px] uppercase tracking-wider text-white/35">
                              {planet ? "🪐 planet · full show" : t.genre || "asteroid"}
                            </span>
                          </span>
                          {active && (
                            <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--theme-primary)" }}>
                              {isPlaying ? "▶ now" : "paused"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          <div className="relative flex-1 overflow-hidden">
            {performs ? (
              /* THE SHOW — full lyric engine: word blow-ups, shape-morphs,
                 generated-art backdrops, emotion grading, arc timeline. */
              <div className="h-full px-4 pb-16">
                {labMode
                  ? <LabStage track={track} mode={labMode} />
                  : <KineticStage track={track} timelineBottomClass="bottom-5" pass={pass} mode={mode} boost={pass >= 6 && moment.on} />}
                {/* THE LENS — x-ray listening over the stage (armed via the mixer) */}
                {lensArmed && hasStems && <StemLens onDisarm={() => setLensArmed(false)} />}
              </div>
            ) : (
              <>
                <div className="h-full overflow-y-auto px-5 py-[42vh] text-center sm:px-10">
                  {lines.map((line, i) => {
                    if (!line.text.trim()) return <div key={i} className="h-6" />;
                    if (line.header) return (
                      <p key={i} className="mx-auto py-3 font-mono text-[11px] uppercase tracking-[0.4em] text-white/25">{headerLabel(line.text)}</p>
                    );
                    return (
                      <p key={i} ref={(el) => { lineRefs.current[i] = el; }} className={synced ? "cine-line" : "cine-line cine-line--plain"}>
                        {line.text}
                      </p>
                    );
                  })}
                </div>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#05030b] to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#05030b] to-transparent" />
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
