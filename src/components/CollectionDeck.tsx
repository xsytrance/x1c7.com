"use client";
// The Deck — mobile /music. One collector case center stage, swipe between
// them; the room's light follows the genre. First tap previews the hottest
// bar with a progress ring; tap again for the full track.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Track } from "@/data/tracks";
import { canPerform } from "@/components/KineticStage";
import { classifyGenre, cardUrl, fmtTime, GENRE_PALETTES, type GenreKey } from "@/lib/collection";
import { usePreview } from "@/lib/usePreview";
import { detectLite } from "@/lib/perf";
import ShareButton from "@/components/ShareButton";
import Booklet from "@/components/Booklet";
import { suppressTakeoverFor } from "@/components/CinematicLyrics";
import { uiStore } from "@/lib/uiStore";

const PREVIEW_LEN = 20;

function ProgressRing({ active, getTime, startAt }: { active: boolean; getTime: () => number; startAt: number }) {
  const circRef = useRef<SVGCircleElement>(null);
  useEffect(() => {
    if (!active) return;
    const lite = detectLite();
    let raf = 0, last = 0;
    const C = 2 * Math.PI * 26;
    const tick = (ts: number) => {
      if (!lite || ts - last > 250) {
        last = ts;
        const p = Math.min(1, Math.max(0, (getTime() - startAt) / PREVIEW_LEN));
        if (circRef.current) circRef.current.style.strokeDashoffset = String(C * (1 - p));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, getTime, startAt]);
  if (!active) return null;
  const C = 2 * Math.PI * 26;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="absolute bottom-3 right-3 drop-shadow-lg">
      <circle cx="32" cy="32" r="26" fill="#000a" stroke="#ffffff2a" strokeWidth="4" />
      <circle ref={circRef} cx="32" cy="32" r="26" fill="none" stroke="#fff" strokeWidth="4"
        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C} transform="rotate(-90 32 32)" />
      <path d="M26 22 L44 32 L26 42 Z" fill="#fff" />
    </svg>
  );
}

export default function CollectionDeck({ tracks, onPlay, onPauseMain }: {
  tracks: Track[];
  onPlay: (t: Track) => void;
  onPauseMain: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(tracks[0]?.id ?? null);
  const [filter, setFilter] = useState<GenreKey | null>(null);
  const armedRef = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const preview = usePreview(onPauseMain);

  const deck = useMemo(
    () => (filter ? tracks.filter((t) => classifyGenre(t.genre).key === filter) : tracks),
    [tracks, filter],
  );
  const active = useMemo(() => tracks.find((t) => t.id === activeId) ?? null, [tracks, activeId]);
  const pal = classifyGenre(active?.genre);

  const genres = useMemo(() => {
    const seen = new Map<GenreKey, number>();
    for (const t of tracks) seen.set(classifyGenre(t.genre).key, (seen.get(classifyGenre(t.genre).key) || 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [tracks]);

  // watch which card is snapped center
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const id = (e.target as HTMLElement).dataset.trackId!;
            setActiveId(id);
            if (armedRef.current && !uiStore.isCinematic()) {
              const t = tracks.find((x) => x.id === id);
              if (t) void preview.start(t);
            }
          }
        }
      },
      { root, threshold: 0.66 },
    );
    root.querySelectorAll("[data-track-id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [deck, tracks, preview]);

  // Card taps never launch the song — first tap previews the drop, tap again
  // stops it. Playing is always an explicit button on the centered card.
  const tapCard = useCallback((t: Track) => {
    if (t.id !== activeId) {
      // side card — snap it to center; snap handler will preview if armed
      scrollerRef.current?.querySelector(`[data-track-id="${CSS.escape(t.id)}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      return;
    }
    if (preview.state.id === t.id) { preview.stop(); return; }
    armedRef.current = true;
    void preview.start(t);
  }, [activeId, preview]);

  // auto-stop preview after PREVIEW_LEN
  useEffect(() => {
    if (!preview.state.id) return;
    const h = window.setTimeout(() => preview.stop(), PREVIEW_LEN * 1000);
    return () => window.clearTimeout(h);
  }, [preview, preview.state.id]);

  return (
    <section className="relative" data-testid="collection-deck">
      <AnimatePresence>
        <motion.div
          key={pal.key}
          className="pointer-events-none fixed inset-0 -z-10"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}
          style={{ background: `radial-gradient(90% 55% at 50% 8%, ${pal.base[0]}aa, transparent 75%), radial-gradient(80% 50% at 50% 100%, ${pal.accent}14, transparent 70%)` }}
        />
      </AnimatePresence>

      {/* genre rail */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button onClick={() => setFilter(null)}
          className={`shrink-0 rounded-sm border px-3 py-1.5 font-mono text-[11px] tracking-[0.16em] ${!filter ? "border-white/60 text-white" : "border-white/15 text-white/50"}`}>
          ALL {tracks.length}
        </button>
        {genres.map(([k, n]) => (
          <button key={k} onClick={() => setFilter(filter === k ? null : k)}
            className={`shrink-0 rounded-sm border px-3 py-1.5 font-mono text-[11px] tracking-[0.16em] ${filter === k ? "text-black" : "border-white/15 text-white/60"}`}
            style={filter === k ? { background: GENRE_PALETTES[k].accent, borderColor: "transparent" } : { borderLeft: `3px solid ${GENRE_PALETTES[k].accent}` }}>
            {GENRE_PALETTES[k].label} {n}
          </button>
        ))}
      </div>

      {/* the deck */}
      <div
        ref={scrollerRef}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[16vw] pb-2"
      >
        {deck.map((t) => {
          const p = classifyGenre(t.genre);
          const isActive = t.id === activeId;
          const isPreviewing = preview.state.id === t.id;
          return (
            <div key={t.id} data-track-id={t.id} className="w-[68vw] max-w-[380px] shrink-0 snap-center">
              <motion.button
                onClick={() => tapCard(t)}
                className="relative block w-full overflow-hidden rounded-lg text-left"
                animate={{ scale: isActive ? 1 : 0.9, opacity: isActive ? 1 : 0.68 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ boxShadow: isActive ? `0 20px 60px -18px ${p.accent}55` : "0 10px 30px -14px #000c" }}
                aria-label={`${t.title} — tap to hear the drop, tap again to stop`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cardUrl(t.id)} alt={t.title} loading="lazy" draggable={false}
                  className="aspect-square w-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = t.cover || t.art; }}
                />
                <ProgressRing active={isPreviewing} getTime={preview.getTime} startAt={preview.state.startAt} />
                {isActive && !isPreviewing && (
                  <div className="absolute bottom-3 right-3 flex h-16 w-16 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm"
                    title="hear the drop">
                    <span className="text-2xl">⚡</span>
                  </div>
                )}
              </motion.button>
              <div className={`mt-3 px-1 transition-opacity duration-300 ${isActive ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                <div className="flex items-center gap-2 font-mono text-[11px] text-white/60">
                  <span className="rounded-sm px-1.5 py-0.5 text-black" style={{ background: p.accent }}>{p.label}</span>
                  {t.mood ? <span className="truncate">{t.mood}</span> : null}
                  {canPerform(t) ? <span>🪐</span> : null}
                  <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    {/* the insert — fetched only for the centered card */}
                    {isActive ? <Booklet slug={t.id} accent={p.accent} sizing="px-2 py-0.5 text-[11px]" label="📖 INSERT" /> : null}
                    {t.sunoUrl ? (
                      <a href={t.sunoUrl} target="_blank" rel="noopener noreferrer" className="rounded-sm border border-white/20 px-2 py-0.5 text-white/60">
                        SUNO ↗
                      </a>
                    ) : null}
                    <ShareButton id={t.id} sizing="px-2 py-0.5 text-[11px]" />
                  </span>
                </div>
                <h3 className="mt-1 truncate font-display text-xl text-white">{t.title}</h3>
                {/* the actions live on the centered card — playing is always explicit */}
                {isActive && (
                  <div className="mt-2 flex gap-2">
                    {canPerform(t) ? (
                      <>
                        <button onClick={() => { armedRef.current = false; preview.stop(false); onPlay(t); }}
                          className="flex-1 rounded-sm py-2.5 text-center font-mono text-sm tracking-[0.16em] text-black"
                          style={{ background: p.accent }}>
                          🪐 START THE SHOW
                        </button>
                        <button onClick={() => { armedRef.current = false; preview.stop(false); suppressTakeoverFor(t.id); onPlay(t); }}
                          className="rounded-sm border border-white/20 px-3 py-2.5 font-mono text-xs tracking-[0.14em] text-white/70">
                          ▶ JUST PLAY
                        </button>
                      </>
                    ) : (
                      <button onClick={() => { armedRef.current = false; preview.stop(false); onPlay(t); }}
                        className="flex-1 rounded-sm py-2.5 text-center font-mono text-sm tracking-[0.16em] text-black"
                        style={{ background: p.accent }}>
                        ▶ PLAY FULL TRACK
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-center font-mono text-[10px] tracking-[0.22em] text-white/30">
        {preview.state.id ? `PREVIEWING THE DROP · ${active ? fmtTime(preview.state.startAt) : ""}` : "SWIPE THE COLLECTION · TAP TO HEAR THE DROP"}
      </p>
    </section>
  );
}
