"use client";

// THE REACTOR — experimental lyric modes. Each is a self-contained renderer that
// takes the word list + the live playhead and does something wild. Kept isolated
// from the core KineticStage (zero risk to the main show) and portable — the
// spatial ones (orbit, thread, zero-g…) are meant to graduate to /vr later.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMusicPlayer } from "./MusicPlayerContext";
import { activeWordIndex, type SyncedWord } from "@/lib/lyrics";
import type { Track } from "@/data/tracks";

export type LabMode = "graffiti" | "fireworks" | "whackaword" | "handwriting" | "downpour" | "bubbles" | "orbit";
export const LAB_MODES: { id: LabMode; label: string; blurb: string }[] = [
  { id: "graffiti", label: "🎨 Graffiti", blurb: "spray-paint the wall" },
  { id: "fireworks", label: "🎆 Fireworks", blurb: "launch & burst" },
  { id: "whackaword", label: "🔨 Whack-a-Word", blurb: "pop them for points" },
  { id: "handwriting", label: "✍️ Handwriting", blurb: "written by hand" },
  { id: "downpour", label: "🌧️ Downpour", blurb: "rain & pile up" },
  { id: "bubbles", label: "🫧 Bubbles", blurb: "float & pop" },
  { id: "orbit", label: "🪐 Orbit", blurb: "words as a solar system" },
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
      {mode === "handwriting" && <Handwriting word={word} idx={idx} />}
      {mode === "downpour" && <Downpour word={word} idx={idx} />}
      {mode === "bubbles" && <Bubbles word={word} idx={idx} />}
      {mode === "orbit" && <Orbit word={word} idx={idx} />}
    </div>
  );
}

/* ========== GRAFFITI — words spray onto a wall; splatter + drips ========== */
function Graffiti({ word, idx }: { word: string; idx: number }) {
  const [tags, setTags] = useState<{ id: number; word: string; x: number; y: number; rot: number; hue: string }[]>([]);
  useEffect(() => {
    if (!word || idx < 0) return;
    const h = hash(idx);
    setTags((old) => [...old.filter((t) => t.id !== idx), { id: idx, word, x: 8 + (h % 66), y: 10 + ((h >> 7) % 66), rot: ((h >> 4) % 24) - 12, hue: HUES[(h >> 13) % HUES.length] }].slice(-14));
  }, [idx, word]);
  return (
    <>
      {tags.map((t, i) => {
        const faded = i < tags.length - 9;
        return (
          <motion.div key={t.id} className="absolute select-none font-display font-black uppercase leading-none"
            style={{ left: `${t.x}%`, top: `${t.y}%`, color: t.hue, fontSize: "clamp(2rem, 8vw, 5.5rem)", WebkitTextStroke: "1px rgba(0,0,0,0.45)", textShadow: `0 0 8px ${t.hue}, 4px 5px 0 rgba(0,0,0,0.55)` }}
            initial={{ opacity: 0, scale: 0.35, rotate: t.rot, filter: "blur(10px)" }}
            animate={{ opacity: faded ? 0.28 : 1, scale: 1, rotate: t.rot, filter: "blur(0px)" }}
            transition={{ duration: 0.3, ease: [0.2, 1.4, 0.4, 1] }}
          >
            {t.word}
            {/* spray splatter — dots burst outward on the tag as it lands */}
            {!faded && Array.from({ length: 10 }).map((_, k) => {
              const hh = hash(t.id + k * 71);
              return (
                <motion.span key={k} className="absolute rounded-full" aria-hidden
                  style={{ left: "40%", top: "50%", width: 2 + (hh % 4), height: 2 + (hh % 4), background: t.hue }}
                  initial={{ x: 0, y: 0, opacity: 0.8 }}
                  animate={{ x: (((hh % 100) / 100) - 0.5) * 120, y: (((hh >> 8) % 100) / 100 - 0.5) * 120, opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }} />
              );
            })}
            {/* drips */}
            <span className="absolute left-3 top-[88%] block w-[3px]" style={{ height: "0.5em", background: t.hue, opacity: 0.55 }} />
            <span className="absolute left-[40%] top-[92%] block w-[2px]" style={{ height: "0.35em", background: t.hue, opacity: 0.4 }} />
          </motion.div>
        );
      })}
    </>
  );
}

/* ========== FIREWORKS — launch, flash, letters + sparks burst out ========== */
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
      {/* trail + climbing shell */}
      <motion.div className="absolute -translate-x-1/2 rounded-full" style={{ width: 8, height: 8, background: hue, boxShadow: `0 0 16px ${hue}` }}
        initial={{ top: "100%", opacity: 1 }} animate={{ top: `${burstY}%`, opacity: [1, 1, 0] }} transition={{ duration: 0.55, ease: "easeOut" }} />
      {/* burst flash */}
      <motion.div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ top: `${burstY}%`, width: 20, height: 20, background: "#fff", boxShadow: `0 0 40px 20px ${hue}` }}
        initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: [0, 0.9, 0], scale: [0.2, 2.4, 3] }} transition={{ duration: 0.5, delay: 0.55, ease: "easeOut" }} />
      {/* spark dots */}
      {Array.from({ length: 18 }).map((_, i) => {
        const a = (i / 18) * Math.PI * 2, d = 70 + (hash(i * 13) % 90);
        return (
          <motion.span key={`s${i}`} className="absolute -translate-x-1/2 rounded-full" style={{ top: `${burstY}%`, width: 3, height: 3, background: HUES[i % HUES.length], boxShadow: `0 0 6px currentColor` }}
            initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d + d * 0.5, opacity: 0 }} transition={{ duration: 1, delay: 0.55, ease: "easeOut" }} />
        );
      })}
      {/* the word's letters fly out as the headline sparks */}
      {letters.map((ch, i) => {
        const a = (i / Math.max(1, letters.length)) * Math.PI * 2 + (hash(i) % 100) / 100;
        const d = 90 + (hash(i + 3) % 70);
        return (
          <motion.span key={i} className="absolute -translate-x-1/2 font-display text-xl font-black uppercase sm:text-2xl"
            style={{ top: `${burstY}%`, color: HUES[(i + word.length) % HUES.length], textShadow: "0 0 8px currentColor" }}
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

/* ========== WHACK-A-WORD — pop from holes, tap to score, +1 burst ========== */
function WhackAWord({ words, idx }: { words: SyncedWord[]; idx: number }) {
  const HOLES = 6;
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [moles, setMoles] = useState<{ id: number; word: string; hole: number }[]>([]);
  const [pops, setPops] = useState<{ id: number; x: number; y: number }[]>([]);
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
  const whack = (id: number, e: { clientX: number; clientY: number }) => {
    setMoles((old) => old.filter((m) => m.id !== id));
    setScore((s) => s + 1);
    const pid = Date.now() + id;
    setPops((p) => [...p, { id: pid, x: e.clientX, y: e.clientY }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== pid)), 700);
    navigator.vibrate?.(20);
  };
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
                <motion.button key={mole.id} onClick={(e) => whack(mole.id, e)}
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
      {/* +1 hit bursts */}
      <AnimatePresence>
        {pops.map((p) => (
          <motion.div key={p.id} className="pointer-events-none fixed font-display text-2xl font-black" style={{ left: p.x, top: p.y, color: "var(--theme-primary)" }}
            initial={{ opacity: 1, y: 0, scale: 0.6 }} animate={{ opacity: 0, y: -50, scale: 1.3 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }}>
            +1
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ========== HANDWRITING — each word drawn left-to-right in cursive ========== */
function Handwriting({ word, idx }: { word: string; idx: number }) {
  const dur = Math.min(1.1, Math.max(0.5, word.length * 0.09));
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {word && (
          <motion.div key={idx} className="relative" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35 } }}>
            <motion.span className="block select-none whitespace-nowrap"
              style={{ fontFamily: '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive', color: "var(--theme-primary)", fontSize: "clamp(3rem, 13vw, 9rem)", textShadow: "0 0 18px color-mix(in srgb, var(--theme-primary) 60%, transparent)" }}
              initial={{ clipPath: "inset(0 100% 0 0)" }} animate={{ clipPath: "inset(0 -4% 0 0)" }} transition={{ duration: dur, ease: "linear" }}>
              {word}
            </motion.span>
            {/* the pen nib rides the writing edge */}
            <motion.span className="absolute top-1/2 h-2 w-2 rounded-full bg-white" style={{ boxShadow: "0 0 10px #fff" }}
              initial={{ left: "0%", opacity: 0 }} animate={{ left: "100%", opacity: [0, 1, 1, 0] }} transition={{ duration: dur, ease: "linear" }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ========== DOWNPOUR — words rain from the top and pile at the bottom ========== */
function Downpour({ word, idx }: { word: string; idx: number }) {
  const [drops, setDrops] = useState<{ id: number; word: string; x: number; hue: string; rot: number }[]>([]);
  useEffect(() => {
    if (!word || idx < 0) return;
    const h = hash(idx);
    setDrops((old) => [...old, { id: idx, word, x: 6 + (h % 84), hue: HUES[h % HUES.length], rot: (h % 24) - 12 }].slice(-18));
  }, [idx, word]);
  return (
    <>
      {drops.map((d, i) => {
        const rest = 88 - ((drops.length - 1 - i) % 6) * 3; // rows so they pile, not perfectly overlap
        return (
          <motion.div key={d.id} className="absolute select-none font-display font-black uppercase" style={{ left: `${d.x}%`, color: d.hue, fontSize: "clamp(1.3rem, 5vw, 3rem)", textShadow: `0 0 8px ${d.hue}` }}
            initial={{ top: "-10%", opacity: 0, rotate: 0 }}
            animate={{ top: `${rest}%`, opacity: i < drops.length - 13 ? 0.35 : 1, rotate: d.rot }}
            transition={{ type: "spring", stiffness: 55, damping: 11, mass: 1.3 }}
          >
            {d.word}
          </motion.div>
        );
      })}
    </>
  );
}

/* ========== BUBBLES — words float up as bubbles; tap to pop ========== */
function Bubbles({ word, idx }: { word: string; idx: number }) {
  const [bubbles, setBubbles] = useState<{ id: number; word: string; x: number; hue: string }[]>([]);
  useEffect(() => {
    if (!word || idx < 0) return;
    const h = hash(idx);
    setBubbles((old) => [...old.slice(-9), { id: idx, word, x: 8 + (h % 78), hue: HUES[h % HUES.length] }]);
  }, [idx, word]);
  const pop = (id: number) => { setBubbles((o) => o.filter((b) => b.id !== id)); navigator.vibrate?.(15); };
  return (
    <AnimatePresence>
      {bubbles.map((b) => (
        <motion.button key={b.id} onClick={() => pop(b.id)}
          className="absolute flex items-center justify-center rounded-full px-4 py-3 font-display text-lg font-black uppercase text-white sm:text-xl"
          style={{ left: `${b.x}%`, border: `2px solid ${b.hue}`, background: `radial-gradient(circle at 35% 28%, color-mix(in srgb, ${b.hue} 40%, transparent), color-mix(in srgb, ${b.hue} 8%, transparent))`, boxShadow: `0 0 18px color-mix(in srgb, ${b.hue} 40%, transparent), inset 0 0 18px color-mix(in srgb, ${b.hue} 20%, transparent)` }}
          initial={{ bottom: "-12%", opacity: 0, scale: 0.6 }}
          animate={{ bottom: "112%", opacity: [0, 1, 1, 0.9], scale: 1, x: [0, 12, -12, 0] }}
          exit={{ scale: 1.5, opacity: 0, transition: { duration: 0.25 } }}
          transition={{ bottom: { duration: 7, ease: "linear" }, x: { duration: 3, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 7 } }}
        >
          {b.word}
        </motion.button>
      ))}
    </AnimatePresence>
  );
}

/* ========== ORBIT — recent words orbit a central star (VR-bound) ========== */
function Orbit({ word, idx }: { word: string; idx: number }) {
  const [orbs, setOrbs] = useState<{ id: number; word: string; r: number; dur: number; dir: number; phase: number; hue: string }[]>([]);
  useEffect(() => {
    if (!word || idx < 0) return;
    const h = hash(idx);
    setOrbs((old) => [...old.slice(-9), { id: idx, word, r: 14 + (h % 30), dur: 14 + (h % 16), dir: h % 2 ? 1 : -1, phase: h % 360, hue: HUES[h % HUES.length] }]);
  }, [idx, word]);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute h-3 w-3 rounded-full" style={{ background: "var(--theme-primary)", boxShadow: "0 0 40px 8px var(--theme-primary)" }} />
      {orbs.map((o) => (
        <motion.div key={o.id} className="absolute left-1/2 top-1/2" style={{ transformOrigin: "0px 0px" }}
          initial={{ rotate: o.phase, opacity: 0 }}
          animate={{ rotate: o.phase + 360 * o.dir, opacity: 1 }}
          transition={{ rotate: { duration: o.dur, repeat: Infinity, ease: "linear" }, opacity: { duration: 0.6 } }}
        >
          <span className="absolute -translate-y-1/2 whitespace-nowrap font-display font-bold uppercase"
            style={{ left: `${o.r}vmin`, color: o.hue, fontSize: "clamp(0.9rem, 3vw, 2rem)", textShadow: `0 0 12px ${o.hue}` }}>
            {o.word}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
