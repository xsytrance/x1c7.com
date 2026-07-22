// THE LISTENING ROOM — shared types. Mirrors the bundle emitted by
// scripts/song-analysis/analyzer-bundle.mjs. Dependency-free (runs in browser).

export type StemFamily = "rhythm" | "low" | "harmonic" | "voice";

export interface Stem {
  name: string;
  family: StemFamily;
  peak: number;     // 0-99
  active: number;   // % of song this stem is audible
  env: number[];    // 0-99 @ envHz
}

export interface Section {
  name: string;
  start: number | null;
  end: number | null;
  intensity: number | null;
  emotion: string | null;
  colorHint: string | null;
}

export interface MelodyWord { t: number; midi: number; conf: number }

export interface Bundle {
  v: number;
  id: string;
  title: string;
  duration: number | null;
  envHz: number;
  identity: {
    bpm: number | null; bpmExact: number | null;
    key: string | null; mode: string | null; keyConf: number | null;
    genre: string | null; subGenres: string[]; mood: string | null;
    energy: string | null; language: string | null; vocalStyle: string | null;
    styleSentence: string | null; summary: string | null;
    themes: string[]; keywords: string[];
  };
  tone: { brightness: number | null; dynamicsDb: number | null };
  palette: string[];
  boundaries: number[];
  sections: Section[];
  stems: Stem[];
  onsets: { beats: number[]; kicks: number[]; snares: number[]; hats: number[] };
  drama: { cuts: [number, number][]; risers: { t: number; end: number }[] };
  arc: { open: number; mid: number; close: number } | null;
  sectionEnergy: unknown;
  vocalPresence: unknown;
  melody: { key: { root: string; mode: string; conf: number } | null; words: MelodyWord[] } | null;
  // How far the stem analysis reaches. Past `stemsTo` there is NO measurement —
  // that is not silence, and must never be drawn as silence.
  stemsTo: number | null;
  coverage: number | null;
  has: { stems: boolean; melody: boolean; onsets: boolean; sections: boolean; drama: boolean };
}

export interface IndexEntry {
  id: string; title: string; duration: number | null;
  bpm: number | null; key: string | null; mode: string | null;
  genre: string | null; palette: string[]; stemCount: number;
  coverage: number | null;
  has: Bundle["has"];
}

// Family palette — VALIDATED for the dark surface with the dataviz validator
// (lightness band PASS, chroma PASS, CVD worst-adjacent ΔE 17.3 deutan,
// normal-vision 20.9, contrast PASS). Do not hand-edit without re-running:
//   node scripts/validate_palette.js "#d95926,#3987e5,#199e70,#9085e9" --mode dark
export const FAMILY_COLOR: Record<StemFamily, string> = {
  rhythm: "#d95926",
  low: "#3987e5",
  harmonic: "#199e70",
  voice: "#9085e9",
};

export const FAMILY_LABEL: Record<StemFamily, string> = {
  rhythm: "rhythm",
  low: "low end",
  harmonic: "harmonic",
  voice: "voice",
};

export const fmtTime = (s: number): string => {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

// Camelot code — DJs read this instantly (adjacent numbers + same letter mix).
const CAMELOT_MAJOR: Record<string, string> = {
  B: "1B", "F#": "2B", "C#": "3B", "G#": "4B", "D#": "5B", "A#": "6B",
  F: "7B", C: "8B", G: "9B", D: "10B", A: "11B", E: "12B",
};
const CAMELOT_MINOR: Record<string, string> = {
  "G#": "1A", "D#": "2A", "A#": "3A", F: "4A", C: "5A", G: "6A",
  D: "7A", A: "8A", E: "9A", B: "10A", "F#": "11A", "C#": "12A",
};
export const camelot = (key: string | null, mode: string | null): string | null => {
  if (!key) return null;
  const k = key.trim().replace("♯", "#");
  return (mode === "minor" ? CAMELOT_MINOR : CAMELOT_MAJOR)[k] ?? null;
};

// Tone + dynamics labels are CATALOG-RELATIVE (thresholds = this body of work's
// quartiles: brightness q1 2795 / median 3049 / q3 3213). Saying "bright" only
// means anything against the songs it sits beside.
export const toneLabel = (brightness: number | null): string | null => {
  if (brightness == null) return null;
  if (brightness < 2800) return "dark";
  if (brightness < 3050) return "warm";
  if (brightness < 3215) return "bright";
  return "brilliant";
};
export const dynamicsLabel = (db: number | null): string | null => {
  if (db == null) return null;
  if (db < 9) return "compressed";
  if (db < 14) return "controlled";
  if (db < 18) return "open";
  return "dynamic";
};

// MIDI number -> note name (for the melody readout)
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const midiToNote = (m: number): string => {
  const r = Math.round(m);
  return `${NOTES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`;
};
