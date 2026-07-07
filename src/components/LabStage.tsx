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

export type LabMode =
  | "graffiti" | "fireworks" | "whackaword" | "handwriting" | "downpour" | "bubbles" | "orbit"
  | "spellcast" | "aquarium" | "marionette" | "tarot" | "constellation"
  | "splitflap" | "terminal" | "sizzle" | "kaleidoscope" | "ouija";
export const LAB_MODES: { id: LabMode; label: string; blurb: string }[] = [
  { id: "graffiti", label: "🎨 Graffiti", blurb: "spray-paint the wall" },
  { id: "fireworks", label: "🎆 Fireworks", blurb: "launch & burst" },
  { id: "whackaword", label: "🔨 Whack-a-Word", blurb: "pop them for points" },
  { id: "handwriting", label: "✍️ Handwriting", blurb: "the song writes itself" },
  { id: "downpour", label: "🌧️ Downpour", blurb: "rain & pile up" },
  { id: "bubbles", label: "🫧 Bubbles", blurb: "float & pop" },
  { id: "orbit", label: "🪐 Orbit", blurb: "words as a solar system" },
  { id: "spellcast", label: "🔮 Spellcast", blurb: "summoned in a rune circle" },
  { id: "aquarium", label: "🐠 Aquarium", blurb: "words swim by" },
  { id: "marionette", label: "🎭 Marionette", blurb: "dangling on strings" },
  { id: "tarot", label: "🃏 Tarot", blurb: "each word, a card drawn" },
  { id: "constellation", label: "✨ Constellation", blurb: "written in the stars" },
  { id: "splitflap", label: "🛫 Split-Flap", blurb: "departure-board letters" },
  { id: "terminal", label: "🖥️ Terminal", blurb: "green-phosphor teletype" },
  { id: "sizzle", label: "🍳 Sizzle", blurb: "words hit the pan" },
  { id: "kaleidoscope", label: "🪞 Kaleidoscope", blurb: "mirrored & spinning" },
  { id: "ouija", label: "🕯️ Séance", blurb: "the planchette spells it out" },
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
      {mode === "spellcast" && <Spellcast word={word} idx={idx} />}
      {mode === "aquarium" && <Aquarium word={word} idx={idx} />}
      {mode === "marionette" && <Marionette word={word} idx={idx} />}
      {mode === "tarot" && <Tarot word={word} idx={idx} />}
      {mode === "constellation" && <Constellation word={word} idx={idx} />}
      {mode === "splitflap" && <SplitFlap word={word} idx={idx} />}
      {mode === "terminal" && <Terminal word={word} idx={idx} />}
      {mode === "sizzle" && <Sizzle word={word} idx={idx} />}
      {mode === "kaleidoscope" && <Kaleidoscope word={word} idx={idx} />}
      {mode === "ouija" && <Ouija word={word} idx={idx} />}
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

/* ========== HANDWRITING — the song writes itself onto the page ========== */
function Handwriting({ word, idx }: { word: string; idx: number }) {
  // Recent words stay ON the page as faded ink (a written journal), instead of
  // vanishing the instant the next word lands.
  const [trail, setTrail] = useState<{ id: number; word: string }[]>([]);
  useEffect(() => {
    if (!word || idx < 0) return;
    setTrail((old) => [...old.filter((t) => t.id !== idx), { id: idx, word }].slice(-7));
  }, [idx, word]);
  const dur = Math.min(1.0, Math.max(0.45, word.length * 0.08));
  const script = { fontFamily: '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive' } as const;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6">
      {/* the ink trail — previous words, written and drying */}
      <div className="flex max-w-full flex-wrap items-baseline justify-center gap-x-4">
        {trail.slice(0, -1).map((t, i) => (
          <motion.span key={t.id} className="select-none whitespace-nowrap"
            style={{ ...script, color: "var(--theme-primary)", fontSize: "clamp(1.4rem, 5vw, 3rem)" }}
            initial={{ opacity: 0.9 }} animate={{ opacity: 0.22 + (i / Math.max(1, trail.length - 1)) * 0.4 }} transition={{ duration: 1.4 }}>
            {t.word}
          </motion.span>
        ))}
      </div>
      {/* the live word, being written */}
      <div className="relative h-[clamp(4rem,16vw,11rem)]">
        {trail.length > 0 && (
          <motion.span key={trail[trail.length - 1].id} className="block select-none whitespace-nowrap"
            style={{ ...script, color: "var(--theme-primary)", fontSize: "clamp(3rem, 13vw, 9rem)", textShadow: "0 0 18px color-mix(in srgb, var(--theme-primary) 60%, transparent)" }}
            initial={{ clipPath: "inset(0 100% -20% 0)" }} animate={{ clipPath: "inset(0 -4% -20% 0)" }} transition={{ duration: dur, ease: "linear" }}>
            {trail[trail.length - 1].word}
          </motion.span>
        )}
      </div>
    </div>
  );
}

/* ========== DOWNPOUR — words rain down and STACK per column, like a drift ===== */
function Downpour({ word, idx }: { word: string; idx: number }) {
  const COLS = 5;
  const [drops, setDrops] = useState<{ id: number; word: string; col: number; row: number; hue: string; rot: number }[]>([]);
  const heights = useRef<number[]>(Array(COLS).fill(0));
  useEffect(() => {
    if (!word || idx < 0) return;
    const h = hash(idx);
    // Land in the SHORTEST column (with a seeded tiebreak) so the pile grows evenly.
    const min = Math.min(...heights.current);
    const candidates = heights.current.map((v, c) => ({ v, c })).filter((x) => x.v === min);
    const col = candidates[h % candidates.length].c;
    const row = heights.current[col]++;
    // Pile full? Wash the whole drift away and start fresh.
    if (row > 6) { heights.current = Array(COLS).fill(0); setDrops([]); return; }
    setDrops((old) => [...old.slice(-30), { id: idx, word, col, row, hue: HUES[h % HUES.length], rot: (h % 14) - 7 }]);
  }, [idx, word]);
  return (
    <>
      {drops.map((d) => (
        <motion.div key={d.id} className="absolute -translate-x-1/2 select-none whitespace-nowrap font-display font-black uppercase"
          style={{ left: `${10 + d.col * 20}%`, color: d.hue, fontSize: "clamp(1.2rem, 4.5vw, 2.6rem)", textShadow: `0 0 8px ${d.hue}` }}
          initial={{ top: "-10%", opacity: 0, rotate: 0 }}
          animate={{ top: `${90 - d.row * 6.5}%`, opacity: 1, rotate: d.rot }}
          exit={{ top: "115%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 60, damping: 12, mass: 1.2 }}
        >
          {d.word}
        </motion.div>
      ))}
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

/* ========== SPELLCAST — each word summoned inside a spinning rune circle ===== */
function Spellcast({ word, idx }: { word: string; idx: number }) {
  const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";
  const ring = Array.from({ length: 16 }, (_, i) => RUNES[(hash(idx + i) % RUNES.length)]);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* the sigil — two counter-rotating rune rings */}
      <motion.div className="absolute h-[52vmin] w-[52vmin] rounded-full border border-dashed"
        style={{ borderColor: "color-mix(in srgb, var(--theme-accent) 50%, transparent)" }}
        animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
        {ring.map((r, i) => {
          const a = (i / ring.length) * 360;
          return (
            <span key={i} className="absolute left-1/2 top-1/2 font-bold"
              style={{ color: "var(--theme-accent)", fontSize: "clamp(0.8rem,2.4vw,1.4rem)", opacity: 0.8,
                transform: `rotate(${a}deg) translateY(-26vmin) rotate(${-a}deg)` }}>
              {r}
            </span>
          );
        })}
      </motion.div>
      <motion.div className="absolute h-[38vmin] w-[38vmin] rounded-full border"
        style={{ borderColor: "color-mix(in srgb, var(--theme-primary) 35%, transparent)", boxShadow: "0 0 40px color-mix(in srgb, var(--theme-primary) 25%, transparent) inset" }}
        animate={{ rotate: -360 }} transition={{ duration: 14, repeat: Infinity, ease: "linear" }} />
      {/* the word materializes from arcane glow */}
      <AnimatePresence mode="popLayout">
        {word && (
          <motion.span key={idx} className="relative select-none whitespace-nowrap px-4 text-center font-display font-black uppercase"
            style={{ color: "var(--theme-primary)", fontSize: "clamp(2.4rem, 10vw, 7rem)", textShadow: "0 0 30px var(--theme-primary), 0 0 70px color-mix(in srgb, var(--theme-primary) 55%, transparent)" }}
            initial={{ opacity: 0, scale: 1.6, filter: "blur(14px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.7, filter: "blur(10px)", transition: { duration: 0.3 } }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            {word}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ========== AQUARIUM — words swim across like fish, bobbing, with bubbles ===== */
function Aquarium({ word, idx }: { word: string; idx: number }) {
  const [fish, setFish] = useState<{ id: number; word: string; y: number; dir: 1 | -1; dur: number; hue: string; size: number }[]>([]);
  useEffect(() => {
    if (!word || idx < 0) return;
    const h = hash(idx);
    setFish((old) => [...old.slice(-8), { id: idx, word, y: 12 + (h % 68), dir: h % 2 ? 1 : -1, dur: 9 + (h % 8), hue: HUES[h % HUES.length], size: 1 + ((h >> 5) % 40) / 60 }]);
  }, [idx, word]);
  return (
    <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 0%, color-mix(in srgb, #123a5c 30%, transparent) 100%)" }}>
      {fish.map((f) => (
        <motion.div key={f.id} className="absolute flex items-center gap-1 whitespace-nowrap font-display font-bold uppercase"
          style={{ top: `${f.y}%`, color: f.hue, fontSize: `calc(clamp(1.2rem, 4.5vw, 2.6rem) * ${f.size})`, textShadow: `0 0 10px ${f.hue}`, scaleX: f.dir === 1 ? 1 : -1 }}
          initial={{ left: f.dir === 1 ? "-30%" : "105%" }}
          animate={{ left: f.dir === 1 ? "105%" : "-30%", y: [0, -14, 8, -6, 0] }}
          transition={{ left: { duration: f.dur, ease: "linear" }, y: { duration: 3.4, repeat: Infinity, ease: "easeInOut" } }}
        >
          <span style={{ transform: f.dir === 1 ? undefined : "scaleX(-1)" }}>{f.word}</span>
          <span className="text-[0.6em] opacity-80">◃</span>
        </motion.div>
      ))}
      {/* ambient bubbles */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.span key={i} className="absolute rounded-full border border-white/25"
          style={{ left: `${8 + i * 12}%`, width: 6 + (i % 3) * 4, height: 6 + (i % 3) * 4 }}
          initial={{ bottom: "-5%" }} animate={{ bottom: "105%" }}
          transition={{ duration: 8 + i, repeat: Infinity, ease: "linear", delay: i * 1.3 }} />
      ))}
    </div>
  );
}

/* ========== MARIONETTE — words drop in dangling on strings, swinging ========== */
function Marionette({ word, idx }: { word: string; idx: number }) {
  const [puppets, setPuppets] = useState<{ id: number; word: string; x: number; hue: string; swing: number }[]>([]);
  useEffect(() => {
    if (!word || idx < 0) return;
    const h = hash(idx);
    setPuppets((old) => [...old.slice(-4), { id: idx, word, x: 18 + (h % 64), hue: HUES[h % HUES.length], swing: 6 + (h % 8) }]);
  }, [idx, word]);
  return (
    <AnimatePresence>
      {puppets.map((p, i) => {
        const old = i < puppets.length - 1;
        return (
          <motion.div key={p.id} className="absolute top-0 origin-top" style={{ left: `${p.x}%` }}
            initial={{ y: "-40vh", rotate: 0, opacity: 1 }}
            animate={{ y: 0, rotate: [p.swing, -p.swing * 0.7, p.swing * 0.45, -p.swing * 0.25, 0], opacity: old ? 0.35 : 1 }}
            exit={{ y: "60vh", opacity: 0, transition: { duration: 0.6, ease: "easeIn" } }}
            transition={{ y: { type: "spring", stiffness: 70, damping: 13 }, rotate: { duration: 3.2, ease: "easeInOut" } }}
          >
            {/* strings */}
            <div className="mx-auto flex w-max gap-8">
              <span className="block h-[30vh] w-px bg-white/30" />
              <span className="block h-[30vh] w-px bg-white/30" />
            </div>
            {/* crossbar + the dangling word */}
            <div className="-mt-px flex flex-col items-center">
              <span className="mb-1 block h-1 w-16 rounded bg-white/40" />
              <span className="select-none whitespace-nowrap font-display font-black uppercase"
                style={{ color: p.hue, fontSize: "clamp(1.8rem, 7vw, 4.5rem)", textShadow: `0 0 12px ${p.hue}` }}>
                {p.word}
              </span>
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}

/* ========== TAROT — every word drawn as a card, flipped face-up ========== */
function Tarot({ word, idx }: { word: string; idx: number }) {
  const [cards, setCards] = useState<{ id: number; word: string; x: number; rot: number; hue: string }[]>([]);
  useEffect(() => {
    if (!word || idx < 0) return;
    const h = hash(idx);
    setCards((old) => [...old.slice(-4), { id: idx, word, x: 14 + (h % 66), rot: ((h >> 3) % 16) - 8, hue: HUES[h % HUES.length] }]);
  }, [idx, word]);
  return (
    <div className="absolute inset-0" style={{ perspective: 1100 }}>
      <AnimatePresence>
        {cards.map((c, i) => {
          const live = i === cards.length - 1;
          return (
            <motion.div key={c.id} className="absolute flex h-56 w-36 flex-col items-center justify-center rounded-xl border-2 p-2 text-center sm:h-72 sm:w-44"
              style={{ left: `${c.x}%`, top: live ? "26%" : "58%", borderColor: c.hue, background: "linear-gradient(155deg, #171226, #0a0714)", boxShadow: `0 0 24px color-mix(in srgb, ${c.hue} 35%, transparent)`, transformStyle: "preserve-3d" }}
              initial={{ rotateY: 180, opacity: 0, y: 30, rotate: c.rot }}
              animate={{ rotateY: 0, opacity: live ? 1 : 0.45, y: 0, rotate: c.rot, scale: live ? 1 : 0.62 }}
              exit={{ opacity: 0, y: 40, transition: { duration: 0.4 } }}
              transition={{ rotateY: { duration: 0.55, ease: "easeOut" }, scale: { duration: 0.5 } }}
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: c.hue }}>✦ arcana ✦</span>
              <span className="my-2 select-none break-words font-display text-xl font-black uppercase leading-tight text-white sm:text-2xl">{c.word}</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/40">{["the fool","the star","the moon","the tower","the sun","the world"][hash(c.id) % 6]}</span>
              <span className="pointer-events-none absolute inset-2 rounded-lg border border-white/10" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ========== CONSTELLATION — each word drawn in the night sky, star by star ===== */
function Constellation({ word, idx }: { word: string; idx: number }) {
  const letters = [...word];
  // Seeded star positions per letter — a zig-zag path so the lines read as a figure.
  const pts = letters.map((_, i) => {
    const h = hash(idx * 31 + i);
    return { x: 12 + (i / Math.max(1, letters.length - 1)) * 70 + ((h % 12) - 6), y: 28 + ((h >> 4) % 34) };
  });
  return (
    <div className="absolute inset-0">
      {/* ambient starfield */}
      {Array.from({ length: 26 }).map((_, i) => (
        <motion.span key={`bg${i}`} className="absolute rounded-full bg-white"
          style={{ left: `${(hash(i * 7) % 96) + 2}%`, top: `${(hash(i * 13) % 90) + 4}%`, width: 2, height: 2 }}
          animate={{ opacity: [0.15, 0.7, 0.15] }} transition={{ duration: 2 + (i % 4), repeat: Infinity, delay: i * 0.2 }} />
      ))}
      <AnimatePresence mode="popLayout">
        {word && (
          <motion.div key={idx} className="absolute inset-0" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.5 } }}>
            {/* connecting lines */}
            <svg className="absolute inset-0 h-full w-full">
              {pts.slice(1).map((p, i) => (
                <motion.line key={i} x1={`${pts[i].x}%`} y1={`${pts[i].y}%`} x2={`${p.x}%`} y2={`${p.y}%`}
                  stroke="color-mix(in srgb, var(--theme-accent) 60%, white)" strokeWidth="1"
                  initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.6 }}
                  transition={{ duration: 0.25, delay: 0.15 + i * 0.09 }} />
              ))}
            </svg>
            {/* the letter-stars */}
            {pts.map((p, i) => (
              <motion.span key={i} className="absolute -translate-x-1/2 -translate-y-1/2 select-none font-display font-bold uppercase"
                style={{ left: `${p.x}%`, top: `${p.y}%`, color: "white", fontSize: "clamp(1.1rem, 4vw, 2.4rem)", textShadow: "0 0 12px var(--theme-accent), 0 0 26px color-mix(in srgb, var(--theme-accent) 60%, transparent)" }}
                initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: 1, scale: [0.2, 1.4, 1] }}
                transition={{ duration: 0.3, delay: i * 0.09 }}>
                {letters[i]}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ========== SPLIT-FLAP — an airport departure board spells the song ========== */
const FLAP_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'·";
function FlapChar({ ch, order, size }: { ch: string; order: number; size: "big" | "small" }) {
  const target = ch.toUpperCase();
  const [cur, setCur] = useState("·");
  useEffect(() => {
    // Later letters spin longer, so the row settles left-to-right like a real board.
    let i = 0;
    const spins = 3 + order * 2 + (hash(target.charCodeAt(0) + order) % 3);
    const iv = setInterval(() => {
      i++;
      if (i >= spins) { setCur(target); clearInterval(iv); }
      else setCur(FLAP_CHARS[hash(i * 31 + order * 7 + target.charCodeAt(0)) % FLAP_CHARS.length]);
    }, 55);
    return () => clearInterval(iv);
  }, [target, order]);
  const big = size === "big";
  return (
    <span className={`relative inline-flex items-center justify-center overflow-hidden rounded-[3px] bg-[#14181d] font-mono font-bold ${big ? "h-[1.45em] w-[1em]" : "h-[1.4em] w-[0.95em]"}`}
      style={{ color: "#ffb63d", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.5)", perspective: 200 }}>
      <motion.span key={cur} initial={{ rotateX: -75, opacity: 0.4 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ duration: 0.08 }}>
        {cur}
      </motion.span>
      {/* the flap seam */}
      <span className="pointer-events-none absolute left-0 top-1/2 h-px w-full bg-black/60" />
    </span>
  );
}
function SplitFlap({ word, idx }: { word: string; idx: number }) {
  const [rows, setRows] = useState<{ id: number; word: string }[]>([]);
  useEffect(() => {
    if (!word || idx < 0) return;
    setRows((old) => [...old.filter((r) => r.id !== idx), { id: idx, word }].slice(-6));
  }, [idx, word]);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em] text-white/50">
        Departures
        <motion.span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ffb63d]" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
      </div>
      {/* settled rows — the board remembers where the song has been */}
      {rows.slice(0, -1).map((r, i) => (
        <motion.div key={r.id} className="flex gap-[3px]" style={{ fontSize: "clamp(0.8rem, 2.6vw, 1.3rem)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 0.25 + (i / Math.max(1, rows.length - 1)) * 0.35 }}>
          {[...r.word].map((ch, k) => <FlapChar key={`${r.id}-${k}`} ch={ch} order={k} size="small" />)}
        </motion.div>
      ))}
      {/* the live row, clacking into place */}
      {rows.length > 0 && (
        <div className="flex gap-1" style={{ fontSize: "clamp(1.8rem, 8vw, 4.5rem)" }}>
          {[...rows[rows.length - 1].word].map((ch, k) => (
            <FlapChar key={`${rows[rows.length - 1].id}-${k}`} ch={ch} order={k} size="big" />
          ))}
        </div>
      )}
    </div>
  );
}

/* ========== TERMINAL — the song tails in on a green-phosphor CRT ========== */
function Terminal({ word, idx }: { word: string; idx: number }) {
  const [lines, setLines] = useState<{ id: number; word: string }[]>([]);
  const [typed, setTyped] = useState(0);
  const prev = useRef<{ id: number; word: string } | null>(null);
  useEffect(() => {
    if (!word || idx < 0) return;
    if (prev.current && prev.current.id !== idx) setLines((l) => [...l.slice(-7), prev.current!]);
    prev.current = { id: idx, word };
    setTyped(0);
    const iv = setInterval(() => {
      setTyped((n) => {
        if (n >= word.length) { clearInterval(iv); return n; }
        return n + 1;
      });
    }, 42);
    return () => clearInterval(iv);
  }, [idx, word]);
  const green = "#3dff8e";
  return (
    <div className="absolute inset-0 font-mono" style={{ background: "radial-gradient(ellipse at center, rgba(20,45,28,0.35), rgba(0,0,0,0.25) 80%)" }}>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-6 pb-20 sm:p-10 sm:pb-24">
        <div className="mb-2 text-[11px] text-white/35">x1c7@reactor:~$ tail -f song.lrc</div>
        {lines.map((l, i) => (
          <div key={l.id} className="lowercase" style={{ color: green, opacity: 0.15 + (i / Math.max(1, lines.length)) * 0.4, fontSize: "clamp(0.9rem, 3vw, 1.5rem)", textShadow: `0 0 6px ${green}` }}>
            &gt; {l.word}
          </div>
        ))}
        {idx >= 0 && word && (
          <div className="lowercase" style={{ color: green, fontSize: "clamp(1.6rem, 6.5vw, 3.4rem)", textShadow: `0 0 12px ${green}, 0 0 30px color-mix(in srgb, ${green} 45%, transparent)` }}>
            &gt; {word.slice(0, typed)}
            <motion.span className="ml-1 inline-block h-[0.95em] w-[0.55em] translate-y-[0.12em]" style={{ background: green }}
              animate={{ opacity: [1, 1, 0, 0] }} transition={{ duration: 0.9, repeat: Infinity, times: [0, 0.5, 0.5, 1] }} />
          </div>
        )}
      </div>
      {/* CRT scanlines + a slow flicker */}
      <motion.div className="pointer-events-none absolute inset-0"
        style={{ background: "repeating-linear-gradient(to bottom, transparent 0 2px, rgba(0,0,0,0.22) 2px 4px)" }}
        animate={{ opacity: [0.85, 1, 0.9, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
    </div>
  );
}

/* ========== SIZZLE — words drop into the pan and cook (keep cooking!) ========== */
function Sizzle({ word, idx }: { word: string; idx: number }) {
  const [dishes, setDishes] = useState<{ id: number; word: string; hue: string }[]>([]);
  useEffect(() => {
    if (!word || idx < 0) return;
    setDishes((old) => [...old.slice(-1), { id: idx, word, hue: HUES[hash(idx) % HUES.length] }]);
  }, [idx, word]);
  return (
    <div className="absolute inset-0">
      {/* flames licking under the pan */}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.span key={`f${i}`} className="absolute bottom-[16%] w-4 rounded-t-full"
          style={{ left: `${41 + i * 4.5}%`, height: 26, background: "linear-gradient(to top, #ff6a3c, #ffd84a, transparent)", filter: "blur(2px)", transformOrigin: "bottom" }}
          animate={{ scaleY: [0.6, 1.25, 0.8, 1.1, 0.6], opacity: [0.7, 1, 0.8, 1, 0.7] }}
          transition={{ duration: 0.7 + i * 0.13, repeat: Infinity, ease: "easeInOut" }} />
      ))}
      {/* the pan */}
      <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2">
        <div className="h-7 w-[58vmin] max-w-[440px] rounded-[100%] border-t-4 border-[#3a3f47] bg-[#1a1d22]"
          style={{ boxShadow: "inset 0 8px 14px rgba(0,0,0,0.7), 0 4px 10px rgba(0,0,0,0.5)" }} />
        <div className="absolute -right-[24vmin] top-1 hidden h-2.5 w-[20vmin] max-w-[150px] rounded-full bg-[#2a2e34] sm:block" />
      </div>
      <AnimatePresence>
        {dishes.map((d, i) => {
          const live = i === dishes.length - 1;
          return (
            <motion.div key={d.id} className="absolute left-1/2 bottom-[24%] select-none whitespace-nowrap font-display font-black uppercase"
              style={{ fontSize: "clamp(1.8rem, 8vw, 4.5rem)", color: d.hue, textShadow: `0 0 14px ${d.hue}` }}
              initial={{ y: "-70vh", x: "-50%", opacity: 1, scaleY: 1 }}
              animate={live
                ? { y: 0, x: ["-50%", "-51%", "-49%", "-50.5%", "-49.5%", "-50%"], scaleY: [1, 1, 0.72, 1.06, 1], filter: ["brightness(1.35)", "brightness(1)", "brightness(0.8) sepia(0.55)"] }
                : { y: 0, x: "-50%" }}
              exit={{ y: "-55vh", rotate: 50, opacity: 0, transition: { duration: 0.55, ease: "easeIn" } }}
              transition={{ y: { type: "spring", stiffness: 130, damping: 15 }, scaleY: { duration: 0.5, delay: 0.32 }, x: { duration: 0.9, delay: 0.4 }, filter: { duration: 2.6, delay: 0.35 } }}
            >
              {d.word}
              {/* steam + spatter while it cooks */}
              {live && Array.from({ length: 6 }).map((_, k) => (
                <motion.span key={k} className="absolute rounded-full" aria-hidden
                  style={{ left: `${12 + k * 15}%`, bottom: "70%", width: 5 + (k % 3) * 3, height: 5 + (k % 3) * 3, background: "rgba(255,255,255,0.5)", filter: "blur(2px)" }}
                  initial={{ y: 0, opacity: 0 }} animate={{ y: -70 - (k % 3) * 30, opacity: [0, 0.7, 0] }}
                  transition={{ duration: 1.5, delay: 0.45 + k * 0.22, repeat: Infinity, repeatDelay: 0.4 }} />
              ))}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ========== KALEIDOSCOPE — the word mirrored through a slow-turning lens ===== */
function Kaleidoscope({ word, idx }: { word: string; idx: number }) {
  const SEGS = 8;
  const hue = HUES[hash(Math.max(0, idx)) % HUES.length];
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div className="absolute h-2 w-2 rounded-full" style={{ background: hue, boxShadow: `0 0 30px 10px ${hue}` }}
        animate={{ scale: [1, 1.6, 1] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute left-1/2 top-1/2" animate={{ rotate: 360 }} transition={{ duration: 36, repeat: Infinity, ease: "linear" }}>
        <AnimatePresence mode="popLayout">
          {word && Array.from({ length: SEGS }).map((_, i) => (
            <motion.div key={`${idx}-${i}`} className="absolute" style={{ transform: `rotate(${(i * 360) / SEGS}deg)` }}>
              <motion.span className="block select-none whitespace-nowrap font-display font-black uppercase"
                style={{ color: hue, fontSize: "clamp(1.2rem, 4.5vw, 2.8rem)", textShadow: `0 0 14px ${hue}`,
                  transform: `translateY(-26vmin) translateX(-50%) ${i % 2 ? "scaleX(-1)" : ""}` }}
                initial={{ opacity: 0, filter: "blur(10px)" }} animate={{ opacity: i % 2 ? 0.55 : 0.95, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(8px)", transition: { duration: 0.3 } }}
                transition={{ duration: 0.4, delay: i * 0.04 }}>
                {word}
              </motion.span>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {/* the lens rim */}
      <div className="absolute h-[64vmin] w-[64vmin] rounded-full border border-white/10"
        style={{ boxShadow: `inset 0 0 60px color-mix(in srgb, ${hue} 12%, transparent)` }} />
    </div>
  );
}

/* ========== SÉANCE — a planchette glides the board, spelling each word ======= */
const OUIJA_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function ouijaPos(ch: string) {
  const i = OUIJA_LETTERS.indexOf(ch);
  if (i < 0) return null;
  const row = i < 13 ? 0 : 1;
  const j = row === 0 ? i : i - 13;
  const t = j / 12;
  // Two gentle arcs, like the classic board.
  return { x: 11 + t * 78, y: (row === 0 ? 34 : 52) - Math.sin(t * Math.PI) * 7 };
}
function Ouija({ word, idx }: { word: string; idx: number }) {
  const seq = [...word.toUpperCase()].map(ouijaPos).filter((p): p is { x: number; y: number } => p !== null);
  const dur = 0.4 + seq.length * 0.38;
  const step = seq.length > 1 ? dur / seq.length : dur;
  return (
    <div className="absolute inset-0">
      {/* candlelight breathing over the board */}
      <motion.div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(255,170,80,0.14), transparent 65%)" }}
        animate={{ opacity: [0.6, 1, 0.75, 1, 0.6] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} />
      <div className="absolute left-[8%] top-[16%] font-serif text-sm uppercase tracking-[0.3em] text-white/35 sm:text-base">Yes</div>
      <div className="absolute right-[8%] top-[16%] font-serif text-sm uppercase tracking-[0.3em] text-white/35 sm:text-base">No</div>
      {/* the letter arcs */}
      {[...OUIJA_LETTERS].map((ch) => {
        const p = ouijaPos(ch)!;
        return (
          <span key={ch} className="absolute -translate-x-1/2 -translate-y-1/2 select-none font-serif"
            style={{ left: `${p.x}%`, top: `${p.y}%`, color: "rgba(255,235,205,0.4)", fontSize: "clamp(1rem, 3.4vw, 2rem)" }}>
            {ch}
          </span>
        );
      })}
      <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 font-serif text-xs uppercase tracking-[0.5em] text-white/25 sm:text-sm">Good Bye</div>
      {/* per-letter flare as the planchette passes over */}
      {word && seq.map((p, k) => (
        <motion.span key={`${idx}-h${k}`} className="absolute -translate-x-1/2 -translate-y-1/2 select-none font-serif"
          style={{ left: `${p.x}%`, top: `${p.y}%`, color: "#ffdca8", fontSize: "clamp(1.3rem, 4.2vw, 2.6rem)", textShadow: "0 0 16px #ffb85c, 0 0 34px rgba(255,150,60,0.5)" }}
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: [0, 1, 0], scale: [0.8, 1.35, 1] }}
          transition={{ duration: Math.max(0.5, step * 1.4), delay: k * step }}>
          {[...word.toUpperCase()].filter((c) => OUIJA_LETTERS.includes(c))[k]}
        </motion.span>
      ))}
      {/* the planchette — a drifting lens that seeks each letter */}
      {word && seq.length > 0 && (
        <motion.div key={idx} className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
          initial={{ left: `${seq[0].x}%`, top: `${seq[0].y}%`, opacity: 0 }}
          animate={{
            left: seq.map((p) => `${p.x}%`), top: seq.map((p) => `${p.y}%`), opacity: 1,
            ...(seq.length === 1 ? { left: `${seq[0].x}%`, top: `${seq[0].y}%` } : {}),
          }}
          transition={{ duration: dur, ease: "easeInOut", opacity: { duration: 0.3 } }}
        >
          <div className="h-14 w-14 rounded-full border-2 sm:h-16 sm:w-16"
            style={{ borderColor: "rgba(255,200,130,0.85)", background: "radial-gradient(circle, rgba(255,190,110,0.12), transparent 70%)", boxShadow: "0 0 24px rgba(255,170,80,0.45), inset 0 0 14px rgba(255,170,80,0.3)" }} />
          <div className="absolute left-1/2 top-full h-4 w-px -translate-x-1/2 bg-[rgba(255,200,130,0.5)]" />
        </motion.div>
      )}
      {/* the message so far, whispered at the bottom */}
      <AnimatePresence mode="popLayout">
        {word && (
          <motion.div key={idx} className="absolute bottom-[10%] left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-serif uppercase tracking-[0.25em]"
            style={{ color: "#ffe9c9", fontSize: "clamp(1.4rem, 5.5vw, 3.2rem)", textShadow: "0 0 20px rgba(255,170,80,0.6)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }}
            transition={{ duration: 0.6, delay: Math.min(dur * 0.7, 1.2) }}>
            {word}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
