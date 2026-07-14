"use client";

import { useEffect, useRef, useState } from "react";
import { m, AnimatePresence, LazyMotion, domMax } from "framer-motion";
import { useMusicPlayer } from "./MusicPlayerContext";

/** Circumference of the phone play-button progress ring (r = 22). */
const RING_C = 2 * Math.PI * 22;

function formatTime(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function MusicPlayerBar() {
  const { currentTrack, isPlaying, duration, volume, togglePlay, next, prev, seek, setVolume, getCurrentTime } =
    useMusicPlayer();

  // Local playhead — the bar reads currentTime on its own rAF so the playhead
  // stays smooth without re-rendering the rest of the app every frame.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    setProgress(getCurrentTime());
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => { setProgress(getCurrentTime()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, getCurrentTime, currentTrack]);

  // Swipe-to-skip (phones): chevron ghosts appear while the track info drags.
  const [dragging, setDragging] = useState(false);

  // Long-press on the album art → the Studio, opened on this track.
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const cancelPress = () => {
    if (pressTimer.current !== null) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
    pressStart.current = null;
  };
  useEffect(() => cancelPress, []);

  if (!currentTrack) return null;

  const startPress = (e: React.PointerEvent) => {
    cancelPress();
    pressStart.current = { x: e.clientX, y: e.clientY };
    const id = currentTrack.id;
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      window.location.assign(`/studio?track=${id}`);
    }, 500);
  };
  const movePress = (e: React.PointerEvent) => {
    const s = pressStart.current;
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancelPress();
  };

  const hasAudio = !!currentTrack.audioUrl;
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <AnimatePresence>
      <m.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-void/90 pb-safe-b backdrop-blur-xl"
      >
        {/* Progress bar */}
        <div
          className="group relative h-1 cursor-pointer"
          onClick={(e) => {
            if (!hasAudio || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            seek(pct * duration);
          }}
        >
          <div className="absolute inset-0 bg-white/10" />
          <div
            className="absolute inset-y-0 left-0 transition-all duration-100"
            style={{
              width: `${progressPercent}%`,
              background: `linear-gradient(to right, ${currentTrack.color}, ${currentTrack.color}88)`,
            }}
          />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
            style={{ left: `${progressPercent}%`, marginLeft: -6, background: currentTrack.color }}
          />
        </div>

        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4">
          {/* Track info — on touch, a swipeable island: drag left/right to
              skip. Local domMax island (the site-wide LazyMotion ships
              domAnimation, no drag). */}
          <LazyMotion features={domMax} strict={false}>
            <div className="relative min-w-0 flex-1">
              {/* chevron ghosts — surface only while dragging */}
              <span aria-hidden className={`pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 font-display text-2xl text-white/25 transition-opacity duration-150 ${dragging ? "opacity-100" : "opacity-0"}`}>‹</span>
              <span aria-hidden className={`pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 font-display text-2xl text-white/25 transition-opacity duration-150 ${dragging ? "opacity-100" : "opacity-0"}`}>›</span>
              <m.div
                drag="x"
                dragConstraints={{ left: -80, right: 80 }}
                dragElastic={0.2}
                dragSnapToOrigin
                dragMomentum={false}
                onDragStart={() => { setDragging(true); cancelPress(); }}
                onDragEnd={(_e, info) => {
                  setDragging(false);
                  if (info.offset.x < -60 || info.velocity.x < -500) next();
                  else if (info.offset.x > 60 || info.velocity.x > 500) prev();
                }}
                className="flex min-w-0 cursor-grab touch-pan-y items-center gap-3 active:cursor-grabbing sm:gap-4"
              >
                {/* Album art — long-press (500ms) opens the Studio on this track */}
                <div
                  className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 sm:h-14 sm:w-14"
                  onPointerDown={startPress}
                  onPointerMove={movePress}
                  onPointerUp={cancelPress}
                  onPointerCancel={cancelPress}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${currentTrack.art})` }}
                  />
                  {/* Fallback gradient */}
                  <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(135deg, ${currentTrack.color}33, ${currentTrack.color}11)` }}
                  />
                  {!hasAudio && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="text-[8px] font-mono uppercase tracking-wider text-white/40">Soon</span>
                    </div>
                  )}
                </div>

                {/* Track info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-white">{currentTrack.title}</p>
                  <p className="truncate font-mono text-[10px] uppercase tracking-wider text-white/40">
                    {currentTrack.artist} · {currentTrack.genre}
                  </p>
                </div>
              </m.div>
            </div>
          </LazyMotion>

          {/* Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={prev}
              className="hidden rounded-full p-2 text-white/50 transition hover:text-white sm:block"
              aria-label="Previous track"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
            </button>

            <div className="relative">
              {/* Phone-only progress ring — 2px stroke tracing the playhead
                  around the play button (CollectionDeck's ProgressRing move,
                  driven here by the bar's existing rAF progress state). */}
              <svg
                width="48" height="48" viewBox="0 0 48 48"
                className="pointer-events-none absolute -left-1 -top-1 sm:hidden"
                aria-hidden
              >
                <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
                <circle
                  cx="24" cy="24" r="22" fill="none" stroke={currentTrack.color} strokeWidth="2"
                  strokeLinecap="round" strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - (duration > 0 ? Math.min(1, progress / duration) : 0))}
                  transform="rotate(-90 24 24)"
                />
              </svg>
              <button
                onClick={togglePlay}
                className="grid h-10 w-10 place-items-center rounded-full transition hover:scale-105"
                style={{ background: currentTrack.color }}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
            </div>

            <button
              onClick={next}
              className="hidden rounded-full p-2 text-white/50 transition hover:text-white sm:block"
              aria-label="Next track"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
            </button>
          </div>

          {/* Time */}
          <div className="hidden font-mono text-[10px] uppercase tracking-wider text-white/40 sm:block">
            {formatTime(progress)} / {formatTime(duration || currentTrack.durationSeconds)}
          </div>

          {/* Volume */}
          <div className="hidden items-center gap-1 md:flex">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" fillOpacity="0.5">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20"
              style={{ accentColor: currentTrack.color }}
            />
          </div>
        </div>
      </m.div>
    </AnimatePresence>
  );
}
