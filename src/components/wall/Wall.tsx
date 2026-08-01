"use client";
// THE WALL — the /music front door.
//
// Full-bleed mosaic of the whole catalogue. No hero, no copy: the first thing
// painted is album art. Hovering a tile cues the song at its hottest bar;
// clicking one starts the song, and CinematicLyrics takes the screen over with
// the full show. One click, no reading. See docs/WALL-REDESIGN.md.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/data/tracks";
import { canPerform } from "@/components/KineticStage";
import { classifyGenre, GENRE_PALETTES, type GenreKey } from "@/lib/collection";
import { usePreview } from "@/lib/usePreview";
import { buildWall, columnsFor, cellSize } from "@/lib/wall";
import { WallTile } from "./WallTile";

const GAP = 8;
const HOVER_CUE_DELAY = 320;

export interface WallProps {
  tracks: Track[];
  /** start this track and take the screen over with its show */
  onPlay: (t: Track) => void;
  /** stop the main player before a preview cues */
  onPauseMain: () => void;
}

export default function Wall({ tracks, onPlay, onPauseMain }: WallProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GenreKey | null>(null);
  const cueTimer = useRef<number | null>(null);
  const preview = usePreview(onPauseMain);

  // Measure the wall, not the window: the grid is what decides column count.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => { if (cueTimer.current) window.clearTimeout(cueTimer.current); }, []);

  const genres = useMemo(() => {
    const seen = new Map<GenreKey, number>();
    for (const t of tracks) {
      const k = classifyGenre(t.genre).key;
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [tracks]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks.filter((t) => {
      if (filter && classifyGenre(t.genre).key !== filter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q) ||
        (t.mood || "").toLowerCase().includes(q)
      );
    });
  }, [tracks, query, filter]);

  const columns = columnsFor(width);
  const size = cellSize(width, columns, GAP);
  const cells = useMemo(() => buildWall(list, columns), [list, columns]);

  const cue = useCallback((t: Track) => {
    if (cueTimer.current) window.clearTimeout(cueTimer.current);
    cueTimer.current = window.setTimeout(() => void preview.start(t), HOVER_CUE_DELAY);
  }, [preview]);

  const uncue = useCallback(() => {
    if (cueTimer.current) window.clearTimeout(cueTimer.current);
    preview.stop();
  }, [preview]);

  const play = useCallback((t: Track) => {
    if (cueTimer.current) window.clearTimeout(cueTimer.current);
    preview.stop(false);
    onPlay(t);
  }, [preview, onPlay]);

  // One tap anywhere unlocks audio if the browser blocked preview autoplay.
  useEffect(() => {
    if (!preview.state.blocked) return;
    const unlock = () => {
      const t = list.find((x) => x.id === preview.state.id);
      if (t) void preview.start(t);
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, [preview, preview.state.blocked, preview.state.id, list]);

  // SHUFFLE THE SHOW — the no-work button: a random show-capable song, straight
  // into the takeover. Falls back to the whole list if nothing is synced.
  const shuffle = useCallback(() => {
    const pool = list.filter(canPerform);
    const from = pool.length ? pool : list;
    if (!from.length) return;
    play(from[Math.floor(Math.random() * from.length)]);
  }, [list, play]);

  // Arrows walk the wall, Enter launches (Enter is native on a <button>).
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const dir = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[e.key];
    if (dir === undefined) return;
    const grid = gridRef.current;
    if (!grid) return;
    const buttons = [...grid.querySelectorAll<HTMLButtonElement>("[data-wall-tile]")];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, at + dir))]?.focus();
  }, [columns]);

  const shows = useMemo(() => tracks.filter(canPerform).length, [tracks]);

  return (
    <section data-testid="wall">
      {/* the only thing above the art: a thin bar of controls */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#05030b]/85 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
          <button
            onClick={shuffle}
            className="shrink-0 rounded-full px-4 py-2 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-black transition hover:scale-105"
            style={{ background: "var(--theme-primary, #43f7ff)", boxShadow: "0 0 22px color-mix(in srgb, var(--theme-primary, #43f7ff) 45%, transparent)" }}
          >
            ⇄ Shuffle the show
          </button>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search title · genre · vibe"
            aria-label="Search the collection"
            className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 font-mono text-xs tracking-widest text-white placeholder:text-white/25 focus:border-plasma/60 focus:outline-none"
          />

          <span className="hidden shrink-0 font-mono text-[9px] uppercase tracking-[0.22em] text-white/35 sm:block">
            {list.length} songs · {shows} full shows
          </span>
        </div>

        {/* genre rail — scrolls sideways, never wraps into a second wall of UI */}
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:px-4">
          <button
            onClick={() => setFilter(null)}
            className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] transition ${
              !filter ? "border-white/60 text-white" : "border-white/12 text-white/45 hover:text-white"
            }`}
          >
            All · {tracks.length}
          </button>
          {genres.map(([k, n]) => (
            <button
              key={k}
              onClick={() => setFilter(filter === k ? null : k)}
              className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] transition ${
                filter === k ? "text-black" : "border-white/12 text-white/50 hover:text-white"
              }`}
              style={filter === k
                ? { background: GENRE_PALETTES[k].accent, borderColor: "transparent" }
                : { borderLeftColor: GENRE_PALETTES[k].accent, borderLeftWidth: 2 }}
            >
              {GENRE_PALETTES[k].label} · {n}
            </button>
          ))}
        </div>
      </div>

      {/* the wall */}
      <div ref={boxRef} className="px-2 py-2 sm:px-3">
        <div
          ref={gridRef}
          onKeyDown={onKeyDown}
          className="wall-grid grid justify-center"
          style={{
            gridTemplateColumns: `repeat(${columns}, ${size}px)`,
            gridAutoRows: `${size}px`,
            gridAutoFlow: "dense",
            gap: GAP,
          }}
        >
          {width > 0 && cells.map(({ track, span }) => (
            <WallTile
              key={track.id}
              track={track}
              span={span}
              size={size}
              gap={GAP}
              previewing={preview.state.id === track.id}
              onEnter={() => cue(track)}
              onLeave={uncue}
              onPlay={() => play(track)}
            />
          ))}
        </div>

        {width > 0 && list.length === 0 && (
          <p className="py-24 text-center font-mono text-xs uppercase tracking-[0.3em] text-white/30">
            nothing matches that
          </p>
        )}
        {width === 0 && (
          <div className="flex h-[60vh] items-center justify-center font-mono text-xs tracking-[0.3em] text-white/30">
            OPENING THE VAULT…
          </div>
        )}
      </div>

      <p className="px-4 pb-1 text-center font-mono text-[9px] uppercase tracking-[0.22em] text-white/25">
        {preview.state.blocked
          ? "click anywhere to enable sound"
          : "hover to cue · click to start the show"}
      </p>
    </section>
  );
}
