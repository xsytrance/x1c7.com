"use client";

import { useState, useMemo } from "react";
import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";

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
  {
    date: "2026.05.31",
    tags: ["launch", "phase-3"],
    title: "Atmospheric layer online",
    content:
      "Particles, scramble text, custom cursor, noise overlay, vignette. The site feels alive now. Every page has its own personality.",
  },
  {
    date: "2026.06.01",
    tags: ["music", "systems"],
    title: "Custom music player built",
    content:
      "Extracted audio code from the vAIb repo. SignalEngine generates procedural atmosphere per track. The visualizer pulls real frequency data.",
  },
  {
    date: "2026.06.03",
    tags: ["experiments", "design"],
    title: "Easter eggs planted",
    content:
      "Type 'signal' anywhere for a flash. Seven rapid logo clicks triggers a secret. Page-specific codes on classified, music, and projects.",
  },
];

/* ------------------------------------------------------------------ */
/*  TAG COLOURS                                                        */
/* ------------------------------------------------------------------ */

const TAG_COLORS: Record<string, string> = {
  launch: "#8dff4a",
  "phase-1": "#43f7ff",
  "phase-2": "#43f7ff",
  "phase-3": "#43f7ff",
  music: "#ff2440",
  suno: "#ff9b3d",
  agents: "#7c3cff",
  systems: "#00ffa8",
  design: "#f5ff6b",
  experiments: "#ff2440",
  failures: "#ff3b3b",
};

/* ------------------------------------------------------------------ */
/*  ENTRY CARD                                                         */
/* ------------------------------------------------------------------ */

function EntryCard({ entry, index, activeTag, onTagClick }: {
  entry: JournalEntry;
  index: number;
  activeTag: string | null;
  onTagClick: (tag: string) => void;
}) {
  const rotation = index % 2 === 0 ? "rotate-[-0.5deg]" : "rotate-[0.5deg]";

  return (
    <m.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15, scale: 0.98 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className={`relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition hover:border-white/15 hover:bg-white/[0.06] sm:p-8 ${rotation}`}
    >
      {/* Date + tags */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs" style={{ color: "#f5ff6b", opacity: 0.6 }}>
          {entry.date}
        </span>
        <span className="text-white/10">|</span>
        <div className="flex flex-wrap gap-2">
          {entry.tags.map((tag) => {
            const isActive = activeTag === tag;
            const color = TAG_COLORS[tag] || "#ffffff";
            return (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className="rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition"
                style={{
                  backgroundColor: isActive ? `${color}35` : `${color}18`,
                  color: isActive ? color : `${color}cc`,
                  border: `1px solid ${isActive ? `${color}66` : `${color}30`}`,
                  transform: isActive ? "scale(1.05)" : "scale(1)",
                }}
              >
                {isActive ? "● " : ""}{tag}
              </button>
            );
          })}
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

      {/* Separator */}
      <div className="mt-5 border-t border-dashed border-white/10" />

      {/* Corner mark */}
      <span className="absolute bottom-3 right-4 font-mono text-[9px] text-white/10">
        #{index + 1}
      </span>
    </m.article>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE                                                          */
/* ------------------------------------------------------------------ */

export default function NotesPage() {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  /* All unique tags */
  const allTags = useMemo(() => {
    const set = new Set<string>();
    ENTRIES.forEach((e) => e.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, []);

  /* Filtered entries */
  const filteredEntries = useMemo(() => {
    if (!activeTag) return ENTRIES;
    return ENTRIES.filter((e) => e.tags.includes(activeTag));
  }, [activeTag]);

  const handleTagClick = (tag: string) => {
    setActiveTag((current) => (current === tag ? null : tag));
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="starfield" aria-hidden />
      <div className="scanline" aria-hidden />

      <div
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: "#f5ff6b" }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-2xl">
        {/* Nav */}
        <nav className="mb-10">
          <BackToHub />
        </nav>

        {/* Header */}
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.45em]" style={{ color: "#f5ff6b", opacity: 0.8 }}>
            x1c7 portal
          </p>

          <TextScramble
            text="Field Notes"
            as="h1"
            className="mt-4 font-display text-5xl font-black uppercase tracking-[-0.06em] sm:text-6xl"
            style={{ color: "#f5ff6b" } as React.CSSProperties}
            delay={100}
          />

          <p className="mt-4 max-w-lg text-sm leading-7 text-white/55 sm:text-base sm:leading-8">
            Thoughts, progress logs, experiments, lessons learned.
          </p>
        </header>

        {/* Tag Filter Bar */}
        <m.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mb-10"
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.35em] text-white/35">
            Filter by tag
          </p>
          <div className="flex flex-wrap gap-2">
            {/* All */}
            <button
              onClick={() => setActiveTag(null)}
              className="rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              style={{
                backgroundColor: activeTag === null ? "#ffffff18" : "transparent",
                color: activeTag === null ? "#ffffff" : "#ffffff55",
                border: `1px solid ${activeTag === null ? "#ffffff40" : "#ffffff15"}`,
              }}
            >
              All ({ENTRIES.length})
            </button>
            {/* Individual tags */}
            {allTags.map((tag) => {
              const color = TAG_COLORS[tag] || "#ffffff";
              const count = ENTRIES.filter((e) => e.tags.includes(tag)).length;
              const isActive = activeTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className="rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  style={{
                    backgroundColor: isActive ? `${color}22` : "transparent",
                    color: isActive ? color : `${color}99`,
                    border: `1px solid ${isActive ? `${color}55` : `${color}25`}`,
                  }}
                >
                  {tag} ({count})
                </button>
              );
            })}
          </div>

          {/* Active filter indicator */}
          <AnimatePresence>
            {activeTag && (
              <m.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 overflow-hidden"
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-white/30">
                  Showing {filteredEntries.length} of {ENTRIES.length} entries
                  <button
                    onClick={() => setActiveTag(null)}
                    className="ml-3 text-signal/60 underline decoration-signal/20 underline-offset-2 transition hover:text-signal"
                  >
                    Clear filter
                  </button>
                </p>
              </m.div>
            )}
          </AnimatePresence>
        </m.div>

        {/* Entries */}
        <m.section layout className="relative space-y-8">
          <AnimatePresence mode="popLayout">
            {filteredEntries.map((entry, i) => (
              <EntryCard
                key={entry.date}
                entry={entry}
                index={i}
                activeTag={activeTag}
                onTagClick={handleTagClick}
              />
            ))}
          </AnimatePresence>

          {/* Empty state */}
          {filteredEntries.length === 0 && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center"
            >
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/30">
                No entries match &ldquo;{activeTag}&rdquo;
              </p>
              <button
                onClick={() => setActiveTag(null)}
                className="mt-4 rounded-full border border-white/15 px-5 py-2 font-mono text-xs uppercase tracking-[0.2em] text-white/50 transition hover:border-signal hover:text-signal"
              >
                Show all
              </button>
            </m.div>
          )}

          {/* End marker */}
          {filteredEntries.length > 0 && (
            <m.div layout className="flex justify-center pt-6">
              <span
                className="font-mono text-[10px] text-white/20 underline decoration-white/10 underline-offset-2"
                style={{ transform: "rotate(-4deg)" }}
              >
                end of current entries — more soon
              </span>
            </m.div>
          )}
        </m.section>
      </div>
    </main>
  );
}
