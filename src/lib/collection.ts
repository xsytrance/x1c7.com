// The Collection — shared logic for the collector-shelf music page.
// Genre color system mirrors scripts/song-art/collector/engine.mjs so the
// site glows in the same palette as the cover spines.

import type { Track } from "@/data/tracks";
import type { StemData, StemName } from "@/lib/stemSense";

export const WEB_COVER_BASE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/covers/web";

export const spineUrl = (id: string) => `${WEB_COVER_BASE}/${id}-spine.webp`;
export const cardUrl = (id: string) => `${WEB_COVER_BASE}/${id}-card.webp`;

export type GenreKey =
  | "RNB" | "HIPHOP" | "LATIN" | "DANCEHALL" | "HOUSE" | "ELECTRONIC" | "DANCE"
  | "TECHNO" | "ROCK" | "AFROBEAT" | "POP" | "SYNTHWAVE" | "LOFI" | "AMBIENT"
  | "CINEMATIC" | "VIDEOGAME" | "ARCHIVE";

export interface GenrePalette {
  key: GenreKey;
  label: string;
  base: [string, string]; // spine gradient
  accent: string;         // glow / waveform color
}

const P = (key: GenreKey, label: string, base: [string, string], accent: string): GenrePalette => ({ key, label, base, accent });

export const GENRE_PALETTES: Record<GenreKey, GenrePalette> = {
  RNB: P("RNB", "R&B", ["#1b2560", "#0c1233"], "#d4af37"),
  HIPHOP: P("HIPHOP", "HIP-HOP", ["#161616", "#020202"], "#d4af37"),
  LATIN: P("LATIN", "LATIN", ["#5f1519", "#1c2242"], "#e2b64a"),
  DANCEHALL: P("DANCEHALL", "DANCEHALL", ["#5f1519", "#2a1607"], "#e2b64a"),
  HOUSE: P("HOUSE", "HOUSE", ["#2b3138", "#101418"], "#46e08c"),
  ELECTRONIC: P("ELECTRONIC", "ELECTRONIC", ["#07231f", "#03100e"], "#39ffa0"),
  DANCE: P("DANCE", "DANCE", ["#062024", "#030f12"], "#3fd4ff"),
  TECHNO: P("TECHNO", "TECHNO", ["#1d1d21", "#0a0a0c"], "#ff5a1f"),
  ROCK: P("ROCK", "ROCK", ["#57290a", "#2b1206"], "#e8a020"),
  AFROBEAT: P("AFROBEAT", "AFROBEAT", ["#3a2410", "#150d05"], "#c98a2d"),
  POP: P("POP", "POP", ["#43102f", "#190513"], "#ff4fa3"),
  SYNTHWAVE: P("SYNTHWAVE", "SYNTHWAVE", ["#241042", "#0c0522"], "#b44dff"),
  LOFI: P("LOFI", "LO-FI", ["#2c3835", "#121b19"], "#6fbfae"),
  AMBIENT: P("AMBIENT", "AMBIENT", ["#191f38", "#090c1a"], "#c9d4e8"),
  CINEMATIC: P("CINEMATIC", "CINEMATIC", ["#25272d", "#0d0e11"], "#d8dce4"),
  VIDEOGAME: P("VIDEOGAME", "VIDEO GAME", ["#2c1052", "#0c0522"], "#b44dff"),
  ARCHIVE: P("ARCHIVE", "AGENOR", ["#181818", "#040404"], "#d4af37"),
};

export function classifyGenre(genre?: string): GenrePalette {
  const g = (genre || "").toLowerCase();
  if (!g) return GENRE_PALETTES.ARCHIVE;
  if (g.includes("r&b")) return GENRE_PALETTES.RNB;
  if (g.includes("hip")) return GENRE_PALETTES.HIPHOP;
  if (g.includes("dancehall")) return GENRE_PALETTES.DANCEHALL;
  if (g.includes("reggaeton") || g.includes("latin") || g.includes("dembow")) return GENRE_PALETTES.LATIN;
  if (g.includes("house")) return GENRE_PALETTES.HOUSE;
  if (g.includes("techno") || g.includes("industrial")) return GENRE_PALETTES.TECHNO;
  if (g.includes("rock") || g.includes("alternative")) return GENRE_PALETTES.ROCK;
  if (g.includes("afro")) return GENRE_PALETTES.AFROBEAT;
  if (g.includes("synthwave")) return GENRE_PALETTES.SYNTHWAVE;
  if (g.includes("lo-fi") || g.includes("lofi")) return GENRE_PALETTES.LOFI;
  if (g.includes("ambient")) return GENRE_PALETTES.AMBIENT;
  if (g.includes("cinematic")) return GENRE_PALETTES.CINEMATIC;
  if (g.includes("video game")) return GENRE_PALETTES.VIDEOGAME;
  if (g.includes("pop")) return GENRE_PALETTES.POP;
  if (g.includes("dance")) return GENRE_PALETTES.DANCE;
  if (g.includes("electronic") || g.includes("edm")) return GENRE_PALETTES.ELECTRONIC;
  return GENRE_PALETTES.ARCHIVE;
}

const PLANET_BASE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
export function stemsUrlFor(track: Track): string | null {
  const s = track.planet?.assets?.stems;
  if (!s) return null;
  return s.startsWith("http") ? s : `${PLANET_BASE}${s.startsWith("/") ? "" : "/"}${s}`;
}

/**
 * The hottest bar of the song — where previews drop in.
 * 1. First riser's landing (the drop) minus a breath, so you hear the hit.
 * 2. Else the loudest 12s window of lead+drums envelope.
 * Clamped so at least 20s remain.
 */
export function hotMoment(d: StemData): number {
  const dur = d.duration || 0;
  const clamp = (t: number) => Math.max(0, Math.min(t, Math.max(0, dur - 20)));
  if (d.risers?.length) return clamp(d.risers[0].end - 0.8);
  const hz = d.envHz || 20;
  const stems: StemName[] = ["lead", "drums"];
  const arrs = stems.map((s) => d.env?.[s]).filter(Boolean) as number[][];
  if (arrs.length) {
    const n = Math.max(...arrs.map((a) => a.length));
    const win = Math.round(12 * hz);
    let best = 0, bestSum = -1, sum = 0;
    const at = (i: number) => arrs.reduce((acc, a) => acc + (a[i] || 0), 0);
    for (let i = 0; i < n; i++) {
      sum += at(i);
      if (i >= win) sum -= at(i - win);
      if (i >= win && sum > bestSum) { bestSum = sum; best = i - win; }
    }
    return clamp(best / hz);
  }
  return clamp(dur * 0.3);
}

/** Downsample lead+drums envelope into N bars (0..1) for waveform strips. */
export function envBars(d: StemData, bars = 72): number[] {
  const arrs = (["lead", "drums", "bass"] as StemName[]).map((s) => d.env?.[s]).filter(Boolean) as number[][];
  if (!arrs.length) return [];
  const n = Math.max(...arrs.map((a) => a.length));
  const out = new Array(bars).fill(0);
  for (let i = 0; i < n; i++) {
    const b = Math.min(bars - 1, Math.floor((i / n) * bars));
    const v = arrs.reduce((acc, a) => acc + (a[i] || 0), 0) / (arrs.length * 99);
    if (v > out[b]) out[b] = v;
  }
  const max = Math.max(...out, 0.001);
  return out.map((v) => v / max);
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
