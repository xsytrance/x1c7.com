"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type MotionProps } from "framer-motion";
import { useTracks } from "@/lib/useTracks";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { activeWordIndex, type SyncedWord } from "@/lib/lyrics";
import { activeSection, sectionMotion, type PlanetSection, type SectionMotion } from "@/lib/planet";
import { deriveTheme } from "@/lib/theme";
import { glyphFor, type Glyph } from "@/lib/shapes";
import type { Track } from "@/data/tracks";

const TEMPLATES = [
  { id: "kinetic", label: "Kinetic · word blow-up", ready: true },
  { id: "karaoke", label: "Neon karaoke (soon)", ready: false },
  { id: "shapes", label: "Shape-morph (soon)", ready: false },
];

const hasWords = (t: Track) => (t.lyricsSynced?.words?.length ?? 0) > 0;

export default function StudioPage() {
  const { tracks } = useTracks();
  const { currentTrack, isPlaying, playTrack } = useMusicPlayer();
  const [template, setTemplate] = useState("kinetic");

  // Default the picker to a word-timed song (the ones the engine can drive).
  const timed = useMemo(() => tracks.filter(hasWords), [tracks]);
  const [selectedId, setSelectedId] = useState<string>("");
  useEffect(() => {
    if (!selectedId && timed.length) setSelectedId(timed[0].id);
  }, [selectedId, timed]);

  const selected = tracks.find((t) => t.id === selectedId);
  const words = currentTrack?.lyricsSynced?.words;
  const analysis = currentTrack?.planet?.analysis;
  const keywordSet = useMemo(
    () => new Set((analysis?.keywords ?? []).map((k) => k.word.toLowerCase())),
    [analysis],
  );
  const live = !!currentTrack && !!words?.length;

  return (
    <main className="relative flex h-[100dvh] flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 24%, color-mix(in srgb, var(--theme-primary) 20%, transparent), transparent 60%)," +
          "linear-gradient(160deg, var(--theme-bg), #05030b)",
      }}
    >
      {/* Control bar */}
      <header className="relative z-10 flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <span className="font-display text-sm font-black uppercase tracking-[0.3em] text-white">Studio</span>
        <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/40">lyric engine · alpha</span>

        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
          className="ml-auto max-w-[46vw] rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-signal">
          <optgroup label="Word-timed">
            {timed.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </optgroup>
          <optgroup label="No word data yet">
            {tracks.filter((t) => !hasWords(t)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </optgroup>
        </select>

        <select value={template} onChange={(e) => setTemplate(e.target.value)}
          className="rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-signal">
          {TEMPLATES.map((t) => <option key={t.id} value={t.id} disabled={!t.ready}>{t.label}</option>)}
        </select>

        <Link href="/music" className="rounded-lg border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60 hover:text-white">Exit</Link>
      </header>

      {/* Planet readout — the song's analyzed identity */}
      {analysis && (
        <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-1 sm:px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--theme-primary)" }}>🪐 {analysis.overallMood}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">{analysis.themes.slice(0, 4).join(" · ")}</span>
        </div>
      )}

      {/* Stage */}
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden px-4 pb-28">
        {live ? (
          <KineticStage words={words!} sections={analysis?.sections} keywords={keywordSet} art={currentTrack?.planet?.assets?.keywords} />
        ) : (
          <div className="text-center">
            {selected && hasWords(selected) ? (
              <button
                onClick={() => selected && playTrack(selected, tracks)}
                className="rounded-full px-8 py-4 font-display text-lg font-black uppercase tracking-[0.2em] text-void transition hover:scale-105"
                style={{ background: "var(--theme-primary)" }}
              >
                ▶ Launch “{selected.title}”
              </button>
            ) : (
              <p className="max-w-sm font-mono text-xs uppercase leading-6 tracking-wider text-white/40">
                {selected ? `“${selected.title}” has no word-timed lyrics yet — run it through the aligner first.` : "Pick a song."}
              </p>
            )}
            {currentTrack && !isPlaying && (
              <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-white/30">Use the player bar below to play.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

const clean = (w: string) => w.replace(/^[^\p{L}\p{N}'’]+|[^\p{L}\p{N}'’]+$/gu, "") || w;

// The "director": each emotion gets its own entrance so words MOVE to the feeling.
// A snappy exit shared by all treatments so consecutive words never overlap/smear.
const EXIT_T = { duration: 0.22, ease: "easeIn" };
const MOTION: Record<SectionMotion, Record<string, object>> = {
  still:   { initial: { opacity: 0, scale: 0.94 },        animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.04, transition: EXIT_T },  transition: { duration: 0.9, ease: "easeOut" } },
  drift:   { initial: { opacity: 0, y: 46, scale: 0.92 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -34, transition: EXIT_T }, transition: { duration: 0.75, ease: "easeOut" } },
  pulse:   { initial: { opacity: 0, scale: 0.58 },        animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.35, transition: EXIT_T },  transition: { type: "spring", stiffness: 330, damping: 21 } },
  surge:   { initial: { opacity: 0, scale: 0.4, y: 22 },  animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 1.6, transition: EXIT_T }, transition: { type: "spring", stiffness: 430, damping: 16, mass: 0.7 } },
  shatter: { initial: { opacity: 0, scale: 1.7, rotate: -3 }, animate: { opacity: 1, scale: 1, rotate: 0 }, exit: { opacity: 0, scale: 0.7, rotate: 2, transition: EXIT_T }, transition: { type: "spring", stiffness: 780, damping: 19, mass: 0.6 } },
};

// Smoothly grade the whole scene to a section's color (via the @property theme vars).
function gradeTo(section: PlanetSection) {
  const th = deriveTheme(section.colorHint);
  const root = document.documentElement.style;
  root.setProperty("--theme-primary", th.primary);
  root.setProperty("--theme-secondary", th.secondary);
  root.setProperty("--theme-accent", th.accent);
  root.setProperty("--theme-bg", th.bg);
}

function KineticStage({ words, sections, keywords, art }: { words: SyncedWord[]; sections?: PlanetSection[]; keywords: Set<string>; art?: Record<string, string> }) {
  const { getCurrentTime } = useMusicPlayer();
  const [idx, setIdx] = useState(-1);
  const [section, setSection] = useState<PlanetSection | null>(null);
  const [bgArt, setBgArt] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastWord = useRef(-1);
  const lastSec = useRef<string>("");

  // One rAF drives the active word (re-render on change) and the current section:
  // on a new section we color-grade the scene + set the emotional-intensity var.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = getCurrentTime();
      const i = activeWordIndex(words, t);
      if (i !== lastWord.current) {
        lastWord.current = i; setIdx(i);
        // Generated song art: when a keyword with art lands, it becomes the
        // backdrop and lingers until the next one takes over.
        if (art && i >= 0) {
          const w = clean(words[i].w).toLowerCase();
          if (art[w]) setBgArt(art[w]);
        }
      }
      if (sections?.length) {
        const s = activeSection(sections, t);
        const key = s ? `${s.name}${s.start}` : "";
        if (key !== lastSec.current) {
          lastSec.current = key;
          setSection(s);
          if (s) { gradeTo(s); stageRef.current?.style.setProperty("--emo", String(s.intensity)); }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [words, sections, getCurrentTime]);

  const word = idx >= 0 ? words[idx]?.w : undefined;
  const shown = word ? clean(word) : "";
  const charged = !!word && keywords.has(shown.toLowerCase());
  const treatment: SectionMotion = section ? sectionMotion(section) : "pulse";
  const m = MOTION[treatment];
  // Shape-morph: only when the word maps to a glyph AND has enough airtime
  // (next word far enough away) for the morph to read.
  const airtime = idx >= 0 ? (words[idx + 1] ? words[idx + 1].t - words[idx].t : 3) : 0;
  const glyph = shown && airtime >= 0.85 ? glyphFor(shown) : null;
  const upcoming = (idx >= 0 ? words.slice(idx + 1, idx + 5) : words.slice(0, 4))
    .map((x) => clean(x.w)).join(" ");

  return (
    <div ref={stageRef} className="kinetic-stage flex w-full flex-col items-center justify-center gap-6 text-center">
      {/* Generated song art — crossfading Ken-Burns backdrop behind the words */}
      <AnimatePresence>
        {bgArt && (
          <motion.div
            key={bgArt}
            className="pointer-events-none fixed inset-0 -z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.42 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img
              src={bgArt}
              alt=""
              className="h-full w-full object-cover"
              initial={{ scale: 1.06 }}
              animate={{ scale: 1.16 }}
              transition={{ duration: 24, ease: "linear" }}
            />
            <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 45%, transparent 30%, rgba(5,3,11,0.88) 100%)" }} />
          </motion.div>
        )}
      </AnimatePresence>
      {section && (
        <p className="font-mono text-[11px] uppercase tracking-[0.45em] transition-colors duration-700" style={{ color: "var(--theme-accent)" }}>
          {section.emotion} <span className="text-white/25">· {treatment}</span>
        </p>
      )}
      <div className="relative flex min-h-[34vh] items-center justify-center">
        <AnimatePresence>
          {word && (
            <motion.div
              key={idx}
              className={`kinetic-word absolute${charged ? " kinetic-word--charged" : ""}`}
              {...(m as MotionProps)}
            >
              {glyph ? <WordMorph word={shown} glyph={glyph} treatment={treatment} /> : shown}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {upcoming && <p className="kinetic-hint">{upcoming}</p>}
    </div>
  );
}

/* ========== SHAPE-MORPH ==========
   The word lands, then dissolves into its glyph — which draws itself on and
   glows. The morph's character follows the section's emotion: shatter = hard
   snap, still/drift = slow dissolve. */
const MORPH_TIMING: Record<SectionMotion, { hold: number; morph: number; ease: string }> = {
  still:   { hold: 0.55, morph: 1.1, ease: "easeInOut" },
  drift:   { hold: 0.5,  morph: 0.9, ease: "easeInOut" },
  pulse:   { hold: 0.42, morph: 0.7, ease: "easeOut" },
  surge:   { hold: 0.36, morph: 0.55, ease: "easeOut" },
  shatter: { hold: 0.3,  morph: 0.38, ease: "backOut" },
};

function WordMorph({ word, glyph, treatment }: { word: string; glyph: Glyph; treatment: SectionMotion }) {
  const t = MORPH_TIMING[treatment];
  return (
    <span className="relative inline-flex items-center justify-center">
      {/* the word: lands, then gives itself to the shape */}
      <motion.span
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: [1, 1, 0], scale: [1, 1, treatment === "shatter" ? 1.5 : 0.72] }}
        transition={{ duration: t.hold + t.morph * 0.6, times: [0, t.hold / (t.hold + t.morph * 0.6), 1], ease: "easeIn" }}
      >
        {word}
      </motion.span>
      {/* the glyph: draws itself on, inheriting the word's glow */}
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute"
        style={{ width: "1.2em", height: "1.2em" }}
        initial={{ opacity: 0, scale: 0.5, rotate: treatment === "shatter" ? -8 : 0 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: t.hold, duration: t.morph, ease: t.ease === "backOut" ? [0.34, 1.56, 0.64, 1] : "easeInOut" }}
        aria-label={glyph.id}
      >
        <motion.path
          d={glyph.path}
          fillRule={glyph.fillRule}
          stroke="var(--theme-accent)"
          strokeWidth={3}
          fill="var(--theme-primary)"
          initial={{ pathLength: 0, fillOpacity: 0 }}
          animate={{ pathLength: 1, fillOpacity: 0.9 }}
          transition={{ delay: t.hold, duration: t.morph, ease: "easeInOut", fillOpacity: { delay: t.hold + t.morph * 0.5, duration: t.morph * 0.6 } }}
        />
      </motion.svg>
    </span>
  );
}
