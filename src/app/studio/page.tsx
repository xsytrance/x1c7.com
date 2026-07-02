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
  // A ?track=<id> deep link wins — the planet's shareable address.
  const timed = useMemo(() => tracks.filter(hasWords), [tracks]);
  const [selectedId, setSelectedId] = useState<string>("");
  useEffect(() => {
    if (selectedId) return;
    const linked = new URLSearchParams(window.location.search).get("track");
    if (linked && tracks.some((t) => t.id === linked)) setSelectedId(linked);
    else if (timed.length) setSelectedId(timed[0].id);
  }, [selectedId, timed, tracks]);

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
          <KineticStage
            words={words!}
            sections={analysis?.sections}
            keywords={keywordSet}
            art={currentTrack?.planet?.assets?.keywords}
            sectionArt={currentTrack?.planet?.assets?.sections}
            title={currentTrack!.title}
            summary={analysis?.summary}
          />
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

function KineticStage({ words, sections, keywords, art, sectionArt, title, summary }: {
  words: SyncedWord[]; sections?: PlanetSection[]; keywords: Set<string>;
  art?: Record<string, string>; sectionArt?: Record<string, string>;
  title: string; summary?: string;
}) {
  const { getCurrentTime } = useMusicPlayer();
  const [idx, setIdx] = useState(-1);
  const [section, setSection] = useState<PlanetSection | null>(null);
  const [bgArt, setBgArt] = useState<string | null>(null);
  const [showTitle, setShowTitle] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastWord = useRef(-1);
  const lastSec = useRef<string>("");
  const titleRef = useRef(true);

  // One rAF drives the active word (re-render on change) and the current section:
  // on a new section we color-grade the scene + set the emotional-intensity var.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = getCurrentTime();
      const i = activeWordIndex(words, t);
      if (i !== lastWord.current) {
        lastWord.current = i; setIdx(i);
        // Keyword art: when a charged word with a painting lands, it takes the
        // backdrop over the section mood art until the scene changes again.
        if (art && i >= 0) {
          const w = clean(words[i].w).toLowerCase();
          if (art[w]) setBgArt(art[w]);
        }
      }
      // Title card: only before the first sung word.
      const titled = words.length > 0 && t < words[0].t - 0.2;
      if (titled !== titleRef.current) { titleRef.current = titled; setShowTitle(titled); }
      if (sections?.length) {
        const s = activeSection(sections, t);
        const key = s ? `${s.name}${s.start}` : "";
        if (key !== lastSec.current) {
          lastSec.current = key;
          setSection(s);
          if (s) {
            gradeTo(s);
            stageRef.current?.style.setProperty("--emo", String(s.intensity));
            // Section mood art becomes the base backdrop for this scene.
            const mood = sectionArt?.[s.emotion.toLowerCase()];
            if (mood) setBgArt(mood);
          }
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
    // Outer layer is NOT transformed — fixed/absolute layers (backdrop, title,
    // timeline) must live here, since the beat-scaled .kinetic-stage would
    // otherwise become their containing block and misplace them.
    <div className="relative flex h-full w-full flex-col items-center justify-center">
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

      {/* Title card — the brain's interpretation opens the show */}
      <AnimatePresence>
        {showTitle && (
          <motion.div
            key="title"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14, transition: { duration: 0.8 } }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="pointer-events-none fixed inset-0 z-10 flex flex-col items-center justify-center gap-6 px-8 text-center"
          >
            <p className="font-display text-4xl font-black uppercase tracking-tight glow-text sm:text-6xl" style={{ color: "var(--theme-primary)" }}>{title}</p>
            {summary && <p className="max-w-2xl text-base leading-7 text-white/60 sm:text-lg">{summary}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={stageRef} className="kinetic-stage flex w-full flex-col items-center justify-center gap-6 text-center">
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

      {sections && sections.length > 0 && <ArcTimeline sections={sections} />}
    </div>
  );
}

/* ========== EMOTIONAL ARC TIMELINE ==========
   The planet made tangible: the song's emotion sections as a scrubbable strip.
   Click anywhere to jump; the playhead is driven imperatively (no re-renders). */
function ArcTimeline({ sections }: { sections: PlanetSection[] }) {
  const { duration, seek, getCurrentTime } = useMusicPlayer();
  const markerRef = useRef<HTMLDivElement>(null);
  const total = duration || (sections[sections.length - 1].start + 20);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (markerRef.current) markerRef.current.style.left = `${Math.min(100, (getCurrentTime() / total) * 100)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getCurrentTime, total]);

  return (
    <div className="fixed inset-x-0 bottom-[86px] z-10 px-4 sm:px-8">
      <div
        className="group relative mx-auto h-2.5 max-w-4xl cursor-pointer overflow-visible rounded-full"
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * total); }}
        title="Emotional arc — click to travel"
      >
        <div className="flex h-full w-full overflow-hidden rounded-full opacity-80 transition-all group-hover:h-full group-hover:opacity-100">
          {sections.map((s, i) => {
            const end = sections[i + 1]?.start ?? total;
            const w = Math.max(0, ((end - s.start) / total) * 100);
            return (
              <div key={`${s.name}${s.start}`} style={{ width: `${w}%`, background: s.colorHint, opacity: 0.45 + s.intensity * 0.55 }}
                className="h-full transition-opacity" title={`${s.emotion} · ${s.name}`} />
            );
          })}
        </div>
        <div ref={markerRef} className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80"
          style={{ background: "var(--theme-primary)", boxShadow: "0 0 12px var(--theme-primary)" }} />
      </div>
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
