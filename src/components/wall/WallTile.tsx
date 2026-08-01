"use client";
// One song on the Wall. The whole tile is a single target: click it and the
// full show takes over. Hover drops the song in at its hottest bar.
//
// RESTING STATE IS PURE ART. The collector card already prints the title, the
// artist and the genre INTO the artwork (720×720, spine included) — overlaying
// our own name plate on top of that just prints every title twice. So the wall
// at rest is nothing but covers; the title, genre and the call to action all
// reveal on hover. Tracks with no collector card fall back to a gradient with
// no baked-in title, so those keep a permanent name plate.
//
// When the wall's scheduler grants this tile a motion slot, <TileMotion> lays
// the song's own planet art over the poster and breathes (P1). P2 will swap
// that for a real rendered Kinetica loop where one exists.
//
// PERF: hover/focus styling is pure CSS (:hover, :focus-visible, and the
// wall's :has() dim rule in globals.css). With ~60 tiles on screen, routing
// those states through React would re-render the whole wall on every pointer
// move. This component is memo'd and takes STABLE callbacks so the scheduler's
// rotation only re-renders the handful of tiles whose slot actually changed.

import { memo, useMemo, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import type { Track } from "@/data/tracks";
import { canPerform } from "@/components/KineticStage";
import { cardUrl, classifyGenre } from "@/lib/collection";
import { DIRECTED_CUTS, motionFramesFor, paletteFor } from "@/lib/wall";
import { PLANET_BASE } from "@/lib/engineHost";
import { TileMotion } from "./TileMotion";

/* eslint-disable @next/next/no-img-element */

/** below this a word is unreadable, so those tiles run art-only */
const WORD_MIN_TILE = 150;

export interface WallTileProps {
  track: Track;
  span: 1 | 2;
  size: number;
  gap: number;
  /** the song the preview audio is actually playing right now */
  previewing: boolean;
  /** the scheduler has granted this tile a motion slot */
  active: boolean;
  onEnter: (t: Track) => void;
  onLeave: () => void;
  onPlay: (t: Track) => void;
}

function WallTileBase({
  track, span, size, gap, previewing, active, onEnter, onLeave, onPlay,
}: WallTileProps) {
  const pal = classifyGenre(track.genre);
  const performs = canPerform(track);
  const directed = DIRECTED_CUTS.has(track.id);
  // Cover fallback chain: collector card → the track's own cover → gradient art.
  const card = cardUrl(track.id);
  const [src, setSrc] = useState(card);
  // Only the collector card has the title printed into it.
  const titleInArt = src === card;
  const px = size * span + gap * (span - 1);

  const frames = useMemo(() => motionFramesFor(track, PLANET_BASE), [track]);
  const palette = useMemo(() => paletteFor(track), [track]);

  return (
    <button
      type="button"
      data-wall-tile={track.id}
      onPointerEnter={(e) => { if (e.pointerType !== "touch") onEnter(track); }}
      onPointerLeave={(e) => { if (e.pointerType !== "touch") onLeave(); }}
      onFocus={() => onEnter(track)}
      onBlur={onLeave}
      onClick={() => onPlay(track)}
      aria-label={`${track.title} — ${pal.label}${performs ? ", start the full show" : ", play"}`}
      className="wall-tile group relative overflow-hidden rounded-lg outline-none"
      style={{
        gridColumn: `span ${span}`,
        gridRow: `span ${span}`,
        width: px,
        height: px,
        ["--accent" as string]: pal.accent,
      }}
    >
      {/* the poster — at rest, this is the entire tile */}
      <img
        src={src}
        alt=""
        loading="lazy"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.07] group-focus-visible:scale-[1.07]"
        onError={() => setSrc((cur) => (cur === card ? (track.cover || track.art) : track.art))}
      />

      {/* THE MINI SHOW — only while this tile holds a motion slot */}
      <AnimatePresence>
        {active && frames.length > 0 && (
          <m.span
            key="motion"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: "easeInOut" }}
          >
            <TileMotion
              frames={frames}
              palette={palette}
              wordPx={px >= WORD_MIN_TILE ? Math.round(px * 0.13) : 0}
            />
          </m.span>
        )}
      </AnimatePresence>

      {/* genre light — the tile glows in its own colour when it leads */}
      <span className="wall-tile__glow pointer-events-none absolute inset-0" aria-hidden />

      {/* ◆ CUT — the only permanent mark. 10 songs of ~60 have a directed cut,
          so it reads as a distinction; a "has a show" badge would sit on 55 of
          them and say nothing. */}
      {directed && (
        <span
          className="pointer-events-none absolute left-1.5 top-1.5 rounded-sm px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-black shadow-md"
          style={{ background: pal.accent }}
        >
          ◆ CUT
        </span>
      )}

      {/* cued — this tile's preview audio is the one playing */}
      {previewing && (
        <span
          className="pointer-events-none absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.18em] backdrop-blur-sm"
          style={{ color: pal.accent }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: pal.accent }} />
          CUE
        </span>
      )}

      {/* permanent name plate ONLY where the art has no title printed in it */}
      {!titleInArt && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0">
          <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
          <span className="relative flex flex-col items-start gap-1 p-2.5 text-left">
            <span className={`line-clamp-2 font-display font-bold leading-tight text-white ${span === 2 ? "text-base sm:text-lg" : "text-[11px] sm:text-xs"}`}>
              {track.title}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-5 rounded-full" style={{ background: pal.accent }} />
              <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/55">{pal.label}</span>
            </span>
          </span>
        </span>
      )}

      {/* THE REVEAL — everything else waits for hover, so the wall at rest is
          nothing but album art. */}
      <span className="wall-tile__reveal pointer-events-none absolute inset-0" aria-hidden>
        {/* a breath of shade at the foot only — the CTA pill carries its own
            solid colour, so veiling the whole cover just hides the art */}
        <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        <span className="absolute inset-0 grid place-items-center">
          <span
            className="rounded-full px-3 py-1.5 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-black shadow-[0_4px_18px_rgba(0,0,0,0.6)]"
            style={{ background: pal.accent }}
          >
            {performs ? "🪐 START THE SHOW" : "▶ PLAY"}
          </span>
        </span>

        {/* the vibe, not the title — the cover already prints the title, and
            repeating it on hover just lands our text on top of theirs. Tiles
            on fallback art already carry a permanent plate, so skip it there. */}
        {titleInArt && (
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-2.5 text-left">
            <span className="h-[3px] w-5 shrink-0 rounded-full" style={{ background: pal.accent }} />
            <span className="truncate font-mono text-[8px] uppercase tracking-[0.18em] text-white/75">
              {pal.label}{track.mood ? ` · ${track.mood}` : ""}
            </span>
          </span>
        )}
      </span>
    </button>
  );
}

export const WallTile = memo(WallTileBase);
