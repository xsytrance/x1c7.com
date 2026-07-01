"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMusicPlayer } from "./MusicPlayerContext";
import { parseLyrics, activeLineIndex } from "@/lib/lyrics";

// A whole-line bracket marker like [Chorus - Female Lead] or [Male] — a section
// or speaker label, not a sung line. Rendered small/dim, never karaoke-active.
const isHeader = (line: string) => /^\[.*\]$/.test(line.trim());
const headerLabel = (line: string) => line.trim().replace(/^\[|\]$/g, "");

/**
 * Now-playing lyrics. Renders an inline panel plus a fullscreen "cinematic"
 * overlay that morphs to the track theme and pulses on the beat. When the
 * lyrics carry LRC timestamps the active line auto-highlights + scrolls to
 * center (karaoke); otherwise the lines show as static stanzas.
 */
export function CinematicLyrics() {
  const { currentTrack, progress } = useMusicPlayer();
  const [cinematic, setCinematic] = useState(false);

  const parsed = useMemo(() => parseLyrics(currentTrack?.lyrics), [currentTrack?.lyrics]);
  const hasLyrics = parsed.lines.some((l) => l.trim().length > 0);

  // Map each display line to its synced time (if any) so we can highlight it.
  const lineTimes = useMemo(() => {
    if (!parsed.synced) return null;
    const times: (number | null)[] = [];
    let si = 0;
    for (const line of parsed.lines) {
      if (line.trim() && !isHeader(line) && si < parsed.synced.length) { times.push(parsed.synced[si].t); si++; }
      else times.push(null);
    }
    return times;
  }, [parsed]);

  const activeT = parsed.synced ? parsed.synced[activeLineIndex(parsed.synced, progress)]?.t : undefined;

  // Close cinematic on Escape.
  useEffect(() => {
    if (!cinematic) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCinematic(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cinematic]);

  if (!currentTrack || !hasLyrics) return null;

  const synced = !!parsed.synced;

  return (
    <>
      {/* Inline panel */}
      <section className="relative z-10 mx-auto mt-16 max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-white/40">
            Lyrics {synced && <span className="text-plasma/70">· synced</span>}
          </p>
          <button
            onClick={() => setCinematic(true)}
            className="flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-wider transition hover:scale-[1.03]"
            style={{ borderColor: "color-mix(in srgb, var(--theme-primary) 40%, transparent)", color: "var(--theme-primary)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h6V2H2v8h2V4zm16 0v6h2V2h-8v2h6zM4 20v-6H2v8h8v-2H4zm16 0h-6v2h8v-8h-2v6z" /></svg>
            Cinematic
          </button>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 backdrop-blur sm:p-8">
          {parsed.lines.map((line, i) => {
            if (!line.trim()) return <div key={i} className="h-4" />;
            if (isHeader(line)) return (
              <p key={i} className="pb-1 pt-5 font-mono text-[10px] uppercase tracking-[0.3em] text-white/30 first:pt-0">
                {headerLabel(line)}
              </p>
            );
            const isActive = synced && lineTimes?.[i] != null && lineTimes[i] === activeT;
            return (
              <p
                key={i}
                className="py-1 text-lg leading-8 transition-colors duration-300 sm:text-xl"
                style={{ color: isActive ? "var(--theme-primary)" : synced ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.75)" }}
              >
                {line}
              </p>
            );
          })}
        </div>
      </section>

      {/* Fullscreen cinematic overlay */}
      <AnimatePresence>
        {cinematic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[200] flex flex-col"
            style={{
              background:
                "radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--theme-primary) 22%, transparent), transparent 60%)," +
                "radial-gradient(circle at 50% 90%, color-mix(in srgb, var(--theme-secondary) 18%, transparent), transparent 55%)," +
                "linear-gradient(160deg, var(--theme-bg), #05030b)",
            }}
          >
            <div className="flex items-center justify-between px-6 py-5 sm:px-10">
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-black uppercase tracking-tight text-white">{currentTrack.title}</p>
                <p className="truncate font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--theme-primary)" }}>
                  {currentTrack.artist}{synced ? " · synced" : ""}
                </p>
              </div>
              <button
                onClick={() => setCinematic(false)}
                className="rounded-full border border-white/20 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-white/70 transition hover:text-white"
              >
                Close · Esc
              </button>
            </div>

            <div className="relative flex-1 overflow-hidden">
              <CinematicScroller
                lines={parsed.lines}
                lineTimes={lineTimes}
                activeT={activeT}
                synced={synced}
              />
              {/* top/bottom fades */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#05030b] to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#05030b] to-transparent" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function CinematicScroller({ lines, lineTimes, activeT, synced }: {
  lines: string[];
  lineTimes: (number | null)[] | null;
  activeT: number | undefined;
  synced: boolean;
}) {
  const activeRef = useRef<HTMLParagraphElement | null>(null);

  // Karaoke auto-scroll: keep the active line centered.
  useEffect(() => {
    if (synced) activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeT, synced]);

  return (
    <div className="h-full overflow-y-auto px-6 py-[40vh] text-center sm:px-10">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-8" />;
        if (isHeader(line)) return (
          <p key={i} className="mx-auto py-4 font-mono text-xs uppercase tracking-[0.4em] text-white/25">
            {headerLabel(line)}
          </p>
        );
        const isActive = synced && lineTimes?.[i] != null && lineTimes[i] === activeT;
        return (
          <motion.p
            key={i}
            ref={isActive ? activeRef : undefined}
            initial={synced ? false : { opacity: 0, y: 16 }}
            animate={synced ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: synced ? 0 : Math.min(i * 0.04, 1.2), duration: 0.5 }}
            className="mx-auto max-w-4xl py-3 font-display font-black tracking-tight transition-all duration-500"
            style={{
              fontSize: isActive ? "clamp(2rem,6vw,4.5rem)" : "clamp(1.25rem,3vw,2.25rem)",
              color: isActive ? "var(--theme-primary)" : synced ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.82)",
              filter: isActive ? "drop-shadow(0 0 calc(var(--beat) * 34px + 6px) var(--theme-primary))" : "none",
              scale: isActive ? "calc(1 + var(--beat) * 0.06)" : "1",
            }}
          >
            {line}
          </motion.p>
        );
      })}
    </div>
  );
}
