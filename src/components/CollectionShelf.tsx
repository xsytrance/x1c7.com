"use client";
// The Shelf — desktop /music. Every collector spine side by side like a game
// collection; hover pulls the case, the room's light follows the genre, and
// after a beat the preview drops you at the hottest bar of the song.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Track } from "@/data/tracks";
import { canPerform } from "@/components/KineticStage";
import { classifyGenre, spineUrl, cardUrl, envBars, fmtTime, GENRE_PALETTES, type GenreKey } from "@/lib/collection";
import { usePreview, stemsFor } from "@/lib/usePreview";
import type { StemData } from "@/lib/stemSense";
import { detectLite } from "@/lib/perf";
import ShareButton from "@/components/ShareButton";
import Booklet, { type BookletHandle } from "@/components/Booklet";

const HOVER_PREVIEW_DELAY = 380;

function WaveStrip({ bars, accent, previewing, getTime, duration, startAt }: {
  bars: number[]; accent: string; previewing: boolean;
  getTime: () => number; duration: number; startAt: number;
}) {
  const lineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!previewing || !duration) return;
    let raf = 0;
    const lite = detectLite();
    let last = 0;
    const tick = (ts: number) => {
      if (!lite || ts - last > 200) {
        last = ts;
        const x = Math.min(1, getTime() / duration);
        if (lineRef.current) lineRef.current.style.left = `${(x * 100).toFixed(2)}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [previewing, duration, getTime]);
  if (!bars.length) return <div className="h-14" />;
  const startX = duration ? (startAt / duration) * 100 : 0;
  return (
    <div className="relative h-14 w-full select-none">
      <div className="absolute inset-0 flex items-center gap-[2px]">
        {bars.map((v, i) => (
          <div key={i} className="flex-1 rounded-sm" style={{ height: `${8 + v * 88}%`, background: accent, opacity: 0.28 + v * 0.6 }} />
        ))}
      </div>
      {duration > 0 && (
        <div className="absolute top-0 bottom-0 w-px" style={{ left: `${startX}%`, background: "#fff", opacity: 0.5 }} title="preview drop-in" />
      )}
      {previewing && <div ref={lineRef} className="absolute top-[-4px] bottom-[-4px] w-[2px] rounded" style={{ background: accent, boxShadow: `0 0 12px ${accent}` }} />}
    </div>
  );
}

export default function CollectionShelf({ tracks, onPlay, onPauseMain }: {
  tracks: Track[];
  onPlay: (t: Track) => void;
  onPauseMain: () => void;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [filter, setFilter] = useState<GenreKey | null>(null);
  const [meta, setMeta] = useState<StemData | null>(null);
  const hoverTimer = useRef<number | null>(null);
  // Which spine a click/tap would PLAY. Mouse hover and keyboard focus arm it
  // (so a click is instant, as ever); a touch tap arms it only on the second
  // tap of the same spine — the first pulls the case and previews the drop.
  const armedId = useRef<string | null>(null);
  const preview = usePreview(onPauseMain);
  const booklet = useRef<BookletHandle>(null);
  const [insertFor, setInsertFor] = useState<string | null>(null);

  const shelf = useMemo(
    () => (filter ? tracks.filter((t) => classifyGenre(t.genre).key === filter) : tracks),
    [tracks, filter],
  );
  const focused = useMemo(() => tracks.find((t) => t.id === focusId) ?? null, [tracks, focusId]);
  const pal = classifyGenre(focused?.genre);
  const genres = useMemo(() => {
    const seen = new Map<GenreKey, number>();
    for (const t of tracks) {
      const k = classifyGenre(t.genre).key;
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [tracks]);

  const focusTrack = useCallback((t: Track) => {
    setFocusId(t.id);
    setMeta(null);
    void stemsFor(t).then((d) => setMeta((cur) => (t.id === (focusRef.current) ? d : cur)));
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => void preview.start(t), HOVER_PREVIEW_DELAY);
  }, [preview]);
  const focusRef = useRef<string | null>(null);
  useEffect(() => { focusRef.current = focusId; }, [focusId]);

  const leaveShelf = useCallback(() => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    preview.stop();
  }, [preview]);

  // one-time unlock if the browser blocked hover-autoplay
  useEffect(() => {
    if (!preview.state.blocked) return;
    const unlock = () => { const t = tracks.find((x) => x.id === focusRef.current); if (t) void preview.start(t); };
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, [preview, preview.state.blocked, tracks]);

  useEffect(() => () => { if (hoverTimer.current) window.clearTimeout(hoverTimer.current); }, []);

  const bars = useMemo(() => (meta ? envBars(meta) : []), [meta]);
  const previewing = preview.state.id === focused?.id;

  return (
    <section className="relative" data-testid="collection-shelf">
      {/* ambient genre light */}
      <AnimatePresence>
        <motion.div
          key={pal.key}
          className="pointer-events-none absolute inset-[-8%] -z-10"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }}
          style={{ background: `radial-gradient(60% 55% at 30% 20%, ${pal.base[0]}88, transparent 70%), radial-gradient(50% 60% at 80% 80%, ${pal.accent}14, transparent 70%)` }}
        />
      </AnimatePresence>

      {/* genre rail */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-sm border px-3 py-1 font-mono text-xs tracking-[0.18em] transition ${!filter ? "border-white/60 text-white" : "border-white/15 text-white/50 hover:text-white"}`}
        >ALL · {tracks.length}</button>
        {genres.map(([k, n]) => (
          <button key={k} onClick={() => setFilter(filter === k ? null : k)}
            className={`rounded-sm border px-3 py-1 font-mono text-xs tracking-[0.18em] transition ${filter === k ? "text-black" : "border-white/15 text-white/60 hover:text-white"}`}
            style={filter === k ? { background: GENRE_PALETTES[k].accent, borderColor: "transparent" } : { borderLeft: `3px solid ${GENRE_PALETTES[k].accent}` }}
          >{GENRE_PALETTES[k].label} · {n}</button>
        ))}
      </div>

      <div className="flex flex-col items-stretch gap-8 min-[900px]:flex-row">
        {/* the shelf */}
        <div className="min-w-0 flex-1" onPointerLeave={(e) => { if (e.pointerType !== "touch") leaveShelf(); }}>
          <div className="flex items-end gap-[5px] overflow-x-auto pb-3 [scrollbar-width:thin]" style={{ perspective: "1200px" }}>
            {shelf.map((t) => {
              const p = classifyGenre(t.genre);
              const isFocus = t.id === focusId;
              return (
                <button
                  key={t.id}
                  // Mouse/keyboard arm on hover/focus so a click plays instantly;
                  // touch taps once to pull the case + preview, again to play.
                  onPointerEnter={(e) => { if (e.pointerType !== "touch") armedId.current = t.id; focusTrack(t); }}
                  onFocus={() => { armedId.current = t.id; focusTrack(t); }}
                  onClick={() => { if (armedId.current === t.id) onPlay(t); else armedId.current = t.id; }}
                  aria-label={`${t.title} — ${p.label}`}
                  className="group relative shrink-0 outline-none"
                  style={{ width: 52, height: "min(56vh, 540px)" }}
                >
                  <motion.div
                    className="relative h-full w-full overflow-hidden rounded-[3px]"
                    animate={{ y: isFocus ? -16 : 0, rotateY: isFocus ? -14 : 0, scale: isFocus ? 1.04 : 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    style={{ boxShadow: isFocus ? `0 18px 44px -12px ${p.accent}66` : "0 6px 18px -8px #000c", transformStyle: "preserve-3d" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={spineUrl(t.id)} alt="" loading="lazy" draggable={false}
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                    {/* fallback spine for tracks without collector art */}
                    <div className="absolute inset-0 -z-10 flex items-center justify-center rounded-[3px] border border-white/10"
                      style={{ background: `linear-gradient(180deg, ${p.base[0]}, ${p.base[1]})` }}>
                      <span className="font-mono text-[10px] tracking-[0.2em] text-white/70" style={{ writingMode: "vertical-rl" }}>
                        {t.title.slice(0, 22).toUpperCase()}
                      </span>
                    </div>
                  </motion.div>
                </button>
              );
            })}
          </div>

          {/* the true waveform of the focused song */}
          <div className="mt-4">
            <WaveStrip
              bars={bars} accent={pal.accent}
              previewing={previewing}
              getTime={preview.getTime}
              duration={meta?.duration ?? 0}
              startAt={preview.state.id === focused?.id ? preview.state.startAt : (meta ? -1 : 0)}
            />
          </div>
        </div>

        {/* the pulled case */}
        <div className="w-full shrink-0 min-[900px]:w-[380px]">
          <AnimatePresence mode="wait">
            {focused ? (
              <motion.div
                key={focused.id}
                initial={{ rotateY: 55, opacity: 0, x: 40 }}
                animate={{ rotateY: 0, opacity: 1, x: 0 }}
                exit={{ rotateY: -25, opacity: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 26 }}
                style={{ transformPerspective: 900 }}
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cardUrl(focused.id)} alt={focused.title}
                    className="aspect-square w-full cursor-pointer rounded-md object-cover"
                    style={{ boxShadow: `0 24px 70px -20px ${pal.accent}55` }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = focused.cover || focused.art; }}
                    onClick={() => booklet.current?.open()}
                    title="open the case"
                  />
                  {insertFor === focused.id ? (
                    <motion.span
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: [0, -4, 0] }}
                      transition={{ opacity: { duration: 0.5 }, y: { repeat: Infinity, duration: 2.4, ease: "easeInOut" } }}
                      className="pointer-events-none absolute inset-x-0 bottom-2.5 mx-auto w-max rounded-full bg-black/65 px-3 py-1 font-mono text-[9px] tracking-[0.22em] text-white/90 backdrop-blur-sm">
                      📖 OPEN THE CASE
                    </motion.span>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center gap-3 font-mono text-xs text-white/60">
                  <span className="rounded-sm px-2 py-0.5 text-black" style={{ background: pal.accent }}>{pal.label}</span>
                  {meta?.bpm ? <span>{Math.round(meta.bpm)} BPM</span> : null}
                  {meta?.duration ? <span>{fmtTime(meta.duration)}</span> : null}
                  {focused.mood ? <span className="truncate">{focused.mood}</span> : null}
                </div>
                <h3 className="mt-2 font-display text-2xl text-white">{focused.title}</h3>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { preview.stop(false); onPlay(focused); }}
                    className="rounded-sm px-4 py-2 font-mono text-sm tracking-[0.14em] text-black transition hover:brightness-110"
                    style={{ background: pal.accent }}>
                    ▶ PLAY FULL
                  </button>
                  {canPerform(focused) && (
                    <span className="rounded-sm border border-white/20 px-3 py-2 font-mono text-xs tracking-[0.14em] text-white/70">
                      🪐 FULL SHOW READY
                    </span>
                  )}
                  {/* the insert — chip appears only when this song's booklet exists */}
                  <Booklet ref={booklet} slug={focused.id} accent={pal.accent} sizing="px-3 py-2 text-xs" label="📖 INSERT"
                    onAvailable={() => setInsertFor(focused.id)} />
                  {focused.sunoUrl && (
                    <a href={focused.sunoUrl} target="_blank" rel="noopener noreferrer"
                      className="rounded-sm border border-white/20 px-3 py-2 font-mono text-xs tracking-[0.14em] text-white/70 transition hover:border-white/60 hover:text-white">
                      SUNO ↗
                    </a>
                  )}
                  <ShareButton id={focused.id} />
                </div>
                <p className="mt-3 font-mono text-[11px] tracking-[0.12em] text-white/35">
                  {preview.state.blocked ? "CLICK ANYWHERE TO ENABLE SOUND PREVIEWS" :
                    previewing ? `PREVIEWING THE DROP · ${fmtTime(preview.state.startAt)}` :
                    "HOVER TO HEAR THE HOTTEST BAR · CLICK THE CASE FOR THE INSERT"}
                </p>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-white/10 font-mono text-xs tracking-[0.2em] text-white/30">
                HOVER THE SHELF
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
