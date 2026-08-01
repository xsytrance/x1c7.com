// THE WALL — layout maths for the /music front door.
//
// The wall is a mosaic, not a spreadsheet: the songs with the most show behind
// them get big tiles, the rest tile around them. Owner order (sort_order from
// Supabase) is preserved — richness only decides a tile's SIZE, never its
// place — so the catalogue still reads in the order the owner arranged it.
//
// See docs/WALL-REDESIGN.md.

import type { Track } from "@/data/tracks";

/** Songs that have shipped a directed cut (a hand-directed 16:9 + 9:16 pair).
 *  These are the most finished work in the catalogue, so they earn hero tiles.
 *  Source of truth is scripts/song-analysis/profiles/<slug>/*.mp4 — this list
 *  is the runtime mirror of it. Add a slug here when a cut ships. */
export const DIRECTED_CUTS = new Set([
  "amor-de-verdad",
  "between-the-stations",
  "cocktails-and-code",
  "different-this-summer",
  "drink-drink-don-t-save-me",
  "fast-enough",
  "i-won-t-be-your-fire",
  "say-it-with-your-body",
  "summer-drip",
  "under-the-elevated",
]);

/** How much show a song has behind it. Drives tile size only. */
export function showRichness(t: Track): number {
  const words = t.lyricsSynced?.words?.length ?? 0;
  const art = Object.keys(t.planet?.assets?.keywords ?? {}).length;
  const sections = Object.keys(t.planet?.assets?.sections ?? {}).length;
  return (
    (DIRECTED_CUTS.has(t.id) ? 100 : 0) +
    (t.featured ? 50 : 0) +
    art +
    sections * 0.5 +
    words / 50
  );
}

export interface WallCell {
  track: Track;
  /** grid span in cells (1 = standard, 2 = hero). */
  span: 1 | 2;
}

/**
 * Decide which tracks get hero tiles.
 *
 * Heroes are capped at ~1 in 6 so the wall stays a wall — too many big tiles
 * and it becomes a list again. Below three columns there are no heroes at all:
 * a 2-wide tile on a 2-column phone grid is just a full-width banner.
 */
export function buildWall(tracks: Track[], columns: number): WallCell[] {
  if (columns < 3 || tracks.length < 6) {
    return tracks.map((track) => ({ track, span: 1 as const }));
  }
  const heroCount = Math.max(1, Math.min(Math.floor(tracks.length / 6), 12));
  const heroes = new Set(
    [...tracks]
      .sort((a, b) => showRichness(b) - showRichness(a))
      .slice(0, heroCount)
      .map((t) => t.id),
  );
  return tracks.map((track) => ({ track, span: heroes.has(track.id) ? 2 : 1 }));
}

/** Column count for a container width. Tiles want to be ~150px on a phone and
 *  ~220px on a desktop, so the wall reads as a wall at every size. */
export function columnsFor(width: number): number {
  if (width <= 0) return 2;
  const target = width < 640 ? 128 : width < 1100 ? 190 : 220;
  return Math.max(2, Math.round(width / target));
}

/** Exact square cell size, so a 2-span hero is exactly twice a standard tile
 *  in BOTH axes (CSS alone can't do this for implicit rows). */
export function cellSize(width: number, columns: number, gap: number): number {
  return Math.max(1, (width - gap * (columns - 1)) / columns);
}
