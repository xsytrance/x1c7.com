"use client";

// THE REACTOR — experimental lyric modes. Each is a self-contained renderer that
// takes the word list + the live playhead and does something wild. Kept isolated
// from the core KineticStage (zero risk to the main show) and portable — the
// spatial ones (orbit, black hole, thread…) are meant to graduate to /vr later.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMusicPlayer } from "./MusicPlayerContext";
import { activeWordIndex, type SyncedWord } from "@/lib/lyrics";
import type { Track } from "@/data/tracks";

export type LabMode = "graffiti" | "fireworks" | "whackaword";
export const LAB_MODES: { id: LabMode; label: string; blurb: string }[] = [
  { id: "graffiti", label: "🎨 Graffiti", blurb: "words spray onto the wall" },
  { id: "fireworks", label: "🎆 Fireworks", blurb: "each word launches & bursts" },
  { id: "whackaword", label: "🔨 Whack-a-Word", blurb: "pop them for points" },
];

const clean = (w: string) => w.replace(/^[^\p{L}\p{N}'’]+|[^\p{L}\p{N}'’]+$/gu, "") || w;
const hash = (n: number) => (Math.imul(n ^ 0x9e3779b9, 2654435761) >>> 0);
const HUES = ["#ff2bd6", "#43f7ff", "#8dff4a", "#ffd84a", "#ff6a3c", "#b06aff"];

/** Emits the active word index off the live playhead (shared by every core). */
function useWordIndex(words: SyncedWord[], getTime: () => number) {
  const [idx, setIdx] = useState(-1);
  const last = useRef(-2);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const i = activeWordIndex(words, getTime());
      if (i !== last.current) { last.current = i; setIdx(i); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [words, getTime]);
  return idx;
}

export function LabStage({ track, mode, clock }: { track: Track; mode: LabMode; clock?: () => number }) {
  const { getCurrentTime } = useMusicPlayer();
  const getTime = clock ?? getCurrentTime;
  const words = track.lyricsSynced?.words ?? [];
  const idx = useWordIndex(words, getTime);
  const word = idx >= 0 ? clean(words[idx]?.w ?? "") : "";

  return (
    <div className="absolute inset-0 z-[3] overflow-hidden">
      {mode === "graffiti" && <Graffiti word={word} idx={idx} />}
      {mode === "fireworks" && <Fireworks word={word} idx={idx} />}
      {mode === "whackaword" && <WhackAWord words={words} idx={idx} />}
    </div>
  );
}

/* ========== GRAFFITI — words spray onto a wall, tags pile up ========== */
function Graffiti({ word, idx }: { word: string; idx: number }) {
  const [tags, setTags] = useState<{ id: number; word: string; x: number; y: number; rot: number; hue: string }[]>([]);
  useEffect(() => {
    if (!word || idx < 0) return;
    const h = hash(idx);
    const tag = {
      id: idx, word,
      x: 8 + (h % 66),
      y: 10 + ((h >> 7) % 68),
      rot: ((h >> 4) % 24) - 12,
      hue: HUES[(h >> 13) % HUES.length],
    };
    setTags((old) => [...old.filter((t) => t.id !== idx), tag].slice(-14));
  }, [idx, word]);
  return (
    <>
      {tags.map((t, i) => {
        const faded = i < tags.length - 9;
        return (
          <motion.div key={t.id}
            className="absolute select-none font-display font-black uppercase leading-none"
            style={{
              left: `${t.x}%`, top: `${t.y}%`, color: t.hue, fontSize: "clamp(2rem, 8vw, 5.5rem)",
              WebkitTextStroke: "1px rgba(0,0,0,0.45)",
              textShadow: `0 0 6px ${t.hue}, 4px 5px 0 rgba(0,0,0,0.55)`,
            }}
            initial={{ opacity: 0, scale: 0.35, rotate: t.rot, filter: "blur(10px)" }}
            animate={{ opacity: faded ? 0.28 : 1, scale: 1, rotate: t.rot, filter: "blur(0px)" }}
            transition={{ duration: 0.32, ease: [0.2, 1.4, 0.4, 1] }}
          >
            {t.word}
            {/* drips */}
            <span className="absolute left-3 top-[88%] block w-[3px]" style={{ height: "0.5em", background: t.hue, opacity: 0.55 }} />
            <span className="absolute left-[40%] top-[92%] block w-[2px]" style={{ height: "0.35em", background: t.hue, opacity: 0.4 }} />
          </motion.div>
        );
      })}
    </>
  );
}

/* ========== FIREWORKS — each word launches, then bursts into letter-sparks ===== */
function Fireworks({ word, idx }: { word: string; idx: number }) {
  const [shots, setShots] = useState<{ id: number; word: string; x: number; hue: string }[]>([]);
  useEffect(() => {
    if (!word || idx < 0) return;
    const h = hash(idx);
    setShots((old) => [...old.slice(-5), { id: idx, word, x: 15 + (h % 70), hue: HUES[h % HUES.length] }]);
  }, [idx, word]);
  return <>{shots.map((s) => <Firework key={s.id} word={s.word} x={s.x} hue={s.hue} />)}</>;
}
function Firework({ word, x, hue }: { word: string; x: number; hue: string }) {
  const letters = [...word];
  const burstY = 34;
  return (
    <div className="pointer-events-none absolute inset-y-0" style={{ left: `${x}%` }}>
      {/* the shell climbs, glowing */}
      <motion.div className="absolute -translate-x-1/2 rounded-full" style={{ width: 8, height: 8, background: hue, boxShadow: `0 0 14px ${hue}` }}
        initial={{ top: "100%", opacity: 1 }} animate={{ top: `${burstY}%`, opacity: [1, 1, 0] }} transition={{ duration: 0.6, ease: "easeOut" }} />
      {/* burst — the word's letters fly out radially as sparks */}
      {letters.map((ch, i) => {
        const a = (i / Math.max(1, letters.length)) * Math.PI * 2 + (hash(i) % 100) / 100;
        const d = 90 + (hash(i + 3) % 70);
        return (
          <motion.span key={i} className="absolute -translate-x-1/2 font-display text-xl font-black uppercase sm:text-2xl"
            style={{ top: `${burstY}%`, color: HUES[(i + word.length) % HUES.length], textShadow: `0 0 8px currentColor` }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d + d * 0.5, opacity: [0, 1, 1, 0], scale: [0.4, 1.1, 1, 0.9] }}
            transition={{ duration: 1.2, delay: 0.55, ease: "easeOut" }}
          >
            {ch}
          </motion.span>
        );
      })}
    </div>
  );
}

/* ========== WHACK-A-WORD — words pop from holes, tap for points ========== */
function WhackAWord({ words, idx }: { words: SyncedWord[]; idx: number }) {
  const HOLES = 6;
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [moles, setMoles] = useState<{ id: number; word: string; hole: number }[]>([]);
  useEffect(() => {
    if (idx < 0) return;
    const word = clean(words[idx]?.w ?? "");
    if (!word) return;
    const hole = hash(idx) % HOLES;
    setMoles((old) => [...old.filter((m) => m.hole !== hole), { id: idx, word, hole }]);
    const to = setTimeout(() => {
      setMoles((old) => { if (old.some((m) => m.id === idx)) setMisses((x) => x + 1); return old.filter((m) => m.id !== idx); });
    }, 1500);
    return () => clearTimeout(to);
  }, [idx, words]);
  const whack = (id: number) => { setMoles((old) => old.filter((m) => m.id !== id)); setScore((s) => s + 1); };
  return (
    <div className="absolute inset-0">
      <div className="absolute right-4 top-3 font-mono text-xs uppercase tracking-widest text-white/70">
        Hits <b className="text-white">{score}</b> · Missed <b className="text-white/50">{misses}</b>
      </div>
      {Array.from({ length: HOLES }).map((_, hole) => {
        const col = hole % 3, row = Math.floor(hole / 3);
        const left = 18 + col * 32, top = 42 + row * 26;
        const mole = moles.find((m) => m.hole === hole);
        return (
          <div key={hole} className="absolute -translate-x-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
            <div className="h-4 w-28 rounded-[100%] bg-black/55" style={{ boxShadow: "inset 0 6px 10px rgba(0,0,0,0.6)" }} />
            <AnimatePresence>
              {mole && (
                <motion.button key={mole.id} onClick={() => whack(mole.id)}
                  className="absolute bottom-2 left-1/2 max-w-[40vw] -translate-x-1/2 truncate whitespace-nowrap rounded-xl px-3 py-1 font-display text-2xl font-black uppercase text-black sm:text-3xl"
                  style={{ background: "var(--theme-primary)" }}
                  initial={{ y: 44, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 44, opacity: 0, scale: 0.7 }}
                  transition={{ type: "spring", stiffness: 500, damping: 26 }}
                >
                  {mole.word}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
