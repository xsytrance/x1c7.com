"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

interface JournalEntry {
  date: string;
  tags: string[];
  title: string;
  content: string;
}

const ENTRIES: JournalEntry[] = [
  {
    date: "2026.05.15",
    tags: ["launch", "phase-1"],
    title: "x1c7 goes live",
    content:
      "The portal map is working. Eight portals orbiting the core. Mobile feels good. Need to fill in the actual rooms next.",
  },
  {
    date: "2026.05.20",
    tags: ["music", "suno"],
    title: "First Suno track",
    content:
      "The AI-generated stuff is getting surprisingly good. Need to figure out the visualizer pipeline.",
  },
  {
    date: "2026.05.22",
    tags: ["agents", "systems"],
    title: "Agent ecosystem forming",
    content:
      "VG God and Ultron are stable. Dazzler needs more training data. Picasso keeps generating unexpected outputs.",
  },
  {
    date: "2026.05.25",
    tags: ["design", "phase-2"],
    title: "Terminal interface working",
    content:
      "The classified page is fun. The konami code easter egg actually works. Need to add more hidden interactions.",
  },
  {
    date: "2026.05.28",
    tags: ["experiments", "failures"],
    title: "Not every experiment works",
    content:
      "Tried a new color palette. Looked like a clown threw up. Back to the void. The dark theme is the theme.",
  },
];

/* ------------------------------------------------------------------ */
/*  TAG COLOURS                                                        */
/* ------------------------------------------------------------------ */

const TAG_COLORS: Record<string, string> = {
  launch: "#8dff4a",
  "phase-1": "#43f7ff",
  "phase-2": "#43f7ff",
  music: "#ff2bd6",
  suno: "#ff9b3d",
  agents: "#7c3cff",
  systems: "#00ffa8",
  design: "#f5ff6b",
  experiments: "#ff2bd6",
  failures: "#ff3b3b",
};

/* ------------------------------------------------------------------ */
/*  DECORATIVE SCRIBBLES                                               */
/* ------------------------------------------------------------------ */

interface Scribble {
  text: string;
  rotate: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  underline?: boolean;
}

const SCRIBBLES: Scribble[] = [
  { text: "todo: add more notes", rotate: "-15deg", top: "-12px", left: "60%", underline: true },
  { text: "remember this", rotate: "8deg", top: "-8px", right: "10%", underline: true },
  { text: "check agents", rotate: "-6deg", top: "-10px", left: "15%" },
  { text: "fix: visualizer", rotate: "12deg", top: "-6px", right: "25%", underline: true },
  { text: "?", rotate: "-20deg", top: "-4px", left: "45%" },
];

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function NotesPage() {
  const [loadedCount, setLoadedCount] = useState(3);
  const reduceMotion = useReducedMotion();

  const visibleEntries = ENTRIES.slice(0, loadedCount);
  const hasMore = loadedCount < ENTRIES.length;

  const handleLoadMore = () => {
    setLoadedCount((c) => Math.min(c + 2, ENTRIES.length));
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      {/* Atmospheric layers */}
      <div className="starfield" aria-hidden />
      <div className="scanline" aria-hidden />

      {/* Accent glow behind header */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: "#f5ff6b" }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-2xl">
        {/* ---------- Navigation ---------- */}
        <nav className="mb-10">
          <BackToHub />
        </nav>

        {/* ---------- Header ---------- */}
        <header className="mb-14">
          <p
            className="font-mono text-xs uppercase tracking-[0.45em]"
            style={{ color: "#f5ff6b", opacity: 0.8 }}
          >
            x1c7 portal
          </p>

          <TextScramble
            text="Field Notes"
            as="h1"
            className="mt-4 font-display text-5xl font-black uppercase tracking-[-0.06em] sm:text-6xl"
            style={{ color: "#f5ff6b" }}
            delay={100}
          />

          <p className="mt-4 max-w-lg text-sm leading-7 text-white/55 sm:text-base sm:leading-8">
            Thoughts, progress logs, experiments, lessons learned.
          </p>

          {/* Decorative scribble under header */}
          <span
            className="mt-2 inline-block font-mono text-[10px] text-white/20"
            style={{ transform: "rotate(-3deg)" }}
          >
            scribbled in the margins &rarr;
          </span>
        </header>

        {/* ---------- Journal Entries ---------- */}
        <section className="relative space-y-10">
          {visibleEntries.map((entry, i) => {
            const isOdd = i % 2 === 0; // 0-indexed: even index = first item = odd position
            const rotation = isOdd ? "rotate-[-0.5deg]" : "rotate-[0.5deg]";
            const scribble = SCRIBBLES[i % SCRIBBLES.length];

            return (
              <ScrollReveal key={entry.date} delay={i * 0.08}>
                {/* Handwritten annotation between entries */}
                {scribble && (
                  <div
                    className="pointer-events-none relative z-10 mb-1 select-none"
                    style={{
                      top: scribble.top,
                      bottom: scribble.bottom,
                      left: scribble.left,
                      right: scribble.right,
                      position: scribble.top || scribble.bottom ? "relative" : undefined,
                    }}
                  >
                    <span
                      className={`absolute font-mono text-[10px] text-white/20 ${scribble.underline ? "underline decoration-white/10 underline-offset-2" : ""}`}
                      style={{
                        transform: `rotate(${scribble.rotate})`,
                        left: scribble.left,
                        right: scribble.right,
                      }}
                    >
                      {scribble.text}
                    </span>
                  </div>
                )}

                {/* Entry card */}
                <article
                  className={`relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition hover:border-white/15 hover:bg-white/[0.06] sm:p-8 ${rotation}`}
                >
                  {/* Date badge */}
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs" style={{ color: "#f5ff6b", opacity: 0.6 }}>
                      {entry.date}
                    </span>
                    <span className="text-white/10">|</span>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                          style={{
                            backgroundColor: `${TAG_COLORS[tag] || "#ffffff"}18`,
                            color: TAG_COLORS[tag] || "#ffffff",
                            border: `1px solid ${TAG_COLORS[tag] || "#ffffff"}30`,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="font-display text-lg font-bold uppercase tracking-tight text-white/90 sm:text-xl">
                    {entry.title}
                  </h2>

                  {/* Content */}
                  <p className="mt-3 text-sm leading-7 text-white/65 sm:leading-8">
                    {entry.content}
                  </p>

                  {/* Bottom separator — hand-drawn feel */}
                  <div className="mt-5 border-t border-dashed border-white/10" />

                  {/* Decorative corner mark */}
                  <span className="absolute bottom-3 right-4 font-mono text-[9px] text-white/10">
                    #{i + 1}
                  </span>
                </article>
              </ScrollReveal>
            );
          })}

          {/* ---------- Load More ---------- */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <motion.button
                onClick={handleLoadMore}
                className="group relative rounded-full border border-white/15 bg-white/[0.04] px-8 py-3 font-mono text-xs uppercase tracking-[0.2em] text-white/60 backdrop-blur transition hover:border-[#f5ff6b]/40 hover:text-[#f5ff6b]"
                whileHover={reduceMotion ? {} : { scale: 1.05 }}
                whileTap={reduceMotion ? {} : { scale: 0.97 }}
              >
                Load more
                <span className="ml-2 inline-block transition-transform group-hover:translate-y-0.5">
                  &#x2193;
                </span>
              </motion.button>
            </div>
          )}

          {/* End-of-journal scribble */}
          {!hasMore && (
            <div className="flex justify-center pt-6">
              <span
                className="font-mono text-[10px] text-white/20 underline decoration-white/10 underline-offset-2"
                style={{ transform: "rotate(-4deg)" }}
              >
                end of current entries — more soon
              </span>
            </div>
          )}
        </section>

        {/* ---------- Bottom Navigation ---------- */}
        <footer className="mt-16 flex flex-wrap items-center justify-center gap-4 border-t border-white/5 pt-8">
          <a
            href="/"
            className="rounded-full border border-white/10 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-white/40 transition hover:border-[#f5ff6b]/30 hover:text-[#f5ff6b]"
          >
            Hub
          </a>
          <a
            href="/classified"
            className="rounded-full border border-white/10 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-white/40 transition hover:border-plasma/30 hover:text-plasma"
          >
            Classified
          </a>
          <a
            href="/soundscape"
            className="rounded-full border border-white/10 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-white/40 transition hover:border-signal/30 hover:text-signal"
          >
            Soundscape
          </a>
        </footer>
      </div>
    </main>
  );
}
