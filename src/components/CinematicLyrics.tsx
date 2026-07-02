"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMusicPlayer } from "./MusicPlayerContext";
import { parseLyrics, activeIndex, headerLabel, type ParsedLine } from "@/lib/lyrics";
import { uiStore } from "@/lib/uiStore";
import { KineticStage, canPerform, MODES, type StageMode } from "./KineticStage";
import type { Track } from "@/data/tracks";

/**
 * Now-playing lyrics. A static inline preview on the page, plus a fullscreen
 * "cinematic" takeover that AUTO-OPENS when a track with lyrics starts playing —
 * front and center. The takeover is opaque (so the heavy /music page behind it is
 * occluded + culled) and pauses the particle field, which keeps mobile renderers
 * alive. The karaoke highlight is driven by rAF + refs (no per-frame re-render).
 */
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
    if (isPlaying && hasLyrics && currentTrack && dismissedId !== currentTrack.id) setOpen(true);
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
  const { isPlaying, togglePlay, getCurrentTime } = useMusicPlayer();
  const [mounted, setMounted] = useState(false);
  // Satellites: which pass of the show is playing (newest = main show).
  const [pass, setPass] = useState(3);
  // Viewing style, remembered across sessions.
  const [mode, setMode] = useState<StageMode>("dynamic");
  useEffect(() => {
    const saved = localStorage.getItem("x1c7-lyric-style") as StageMode | null;
    if (saved && MODES.some((m) => m.id === saved)) setMode(saved);
  }, []);
  const cycleMode = () => {
    const order: StageMode[] = ["dynamic", "focus", "phrase"];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next); localStorage.setItem("x1c7-lyric-style", next);
  };
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const lastActive = useRef(-1);
  // Full engine when the song is a planet (word timings); line karaoke otherwise.
  const performs = canPerform(track);

  useEffect(() => setMounted(true), []);

  // While open: flag the shared UI store (pauses particles) + lock scroll.
  useEffect(() => {
    if (!open) return;
    uiStore.setCinematic(true);
    document.body.classList.add("cinematic-on");
    return () => { uiStore.setCinematic(false); document.body.classList.remove("cinematic-on"); };
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
  }, [open, synced, lines, getCurrentTime]);

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
          <div className="flex items-center justify-between px-5 py-4 sm:px-10">
            <div className="min-w-0">
              <p className="truncate font-display text-base font-black uppercase tracking-tight text-white sm:text-lg">{track.title}</p>
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--theme-primary)" }}>
                {track.artist}{synced ? " · synced" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Satellite switcher — cycle through the preserved passes of the show */}
              {performs && pass >= 3 && (
                <button
                  onClick={cycleMode}
                  title="Viewing style — Dynamic stagecraft, clean Focus, or readable Phrase. Tap to cycle."
                  className="rounded-full border border-white/20 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/70 transition hover:text-white"
                >
                  {MODES.find((m) => m.id === mode)?.label}
                </button>
              )}
              {performs && (
                <button
                  onClick={() => setPass((p) => (p > 1 ? p - 1 : 3))}
                  title="Satellites — every pass of the show, preserved. Tap to switch."
                  className="rounded-full border border-white/20 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/70 transition hover:text-white"
                >
                  🌙 Pass {pass}{pass === 3 ? "" : " · satellite"}
                </button>
              )}
              <button onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}
                className="grid h-10 w-10 place-items-center rounded-full text-void transition hover:scale-105" style={{ background: "var(--theme-primary)" }}>
                {isPlaying
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><path d="M8 5v14l11-7z" /></svg>}
              </button>
              {/* Minimize — drop back to the page; the music keeps playing */}
              <button onClick={onClose} aria-label="Minimize — music keeps playing" title="Minimize (Esc) — music keeps playing"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-white/70 transition hover:scale-105 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden">
            {performs ? (
              /* THE SHOW — full lyric engine: word blow-ups, shape-morphs,
                 generated-art backdrops, emotion grading, arc timeline. */
              <div className="h-full px-4 pb-16">
                <KineticStage track={track} timelineBottomClass="bottom-5" pass={pass} mode={mode} />
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
