// ═══════════════════════════════════════════════════════════════════════════
// MELODY — the singer's measured notes, mapped to color HARMONICALLY.
//
// melody.json (analyze_melody.py: pYIN on the isolated lead vocal + K-S key
// detection) gives every timed word the note it was sung on. This module
// loads it and turns notes into hues the song can wear:
//
//   The TONIC is home — it wears the theme's own hue. Every other note sits
//   at its circle-of-fifths distance from home, mapped onto ±80° of hue.
//   Close harmony = close color; the tritone strains the palette hardest.
//   (A chromatic pc→hue map would rainbow randomly; fifths keep it musical.)
//
// Nothing here guesses: no melody.json → null → the stage renders exactly
// as before. Confidence-gated per word (unvoiced words keep theme color).
// ═══════════════════════════════════════════════════════════════════════════

export interface MelodyWord {
  /** index into lyricsSynced.words */
  i: number;
  t: number;
  midi: number;
  /** pitch class 0-11, C=0 */
  pc: number;
  /** 0..1 — how confidently voiced the word's window was */
  conf: number;
}
export interface MelodyData {
  v: number;
  key: { root: string; mode: string; conf: number };
  words: MelodyWord[];
}

const NOTE_PC: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

export async function loadMelody(url: string): Promise<MelodyData | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = (await r.json()) as MelodyData;
    return d && d.v === 1 && Array.isArray(d.words) && d.key ? d : null;
  } catch {
    return null;
  }
}

/** Fast lookup: word index → its measured note. */
export function melodyIndex(m: MelodyData): Map<number, MelodyWord> {
  const map = new Map<number, MelodyWord>();
  for (const w of m.words) map.set(w.i, w);
  return map;
}

export function keyPc(m: MelodyData): number {
  return NOTE_PC[m.key.root] ?? 0;
}

/** Hue (0-360) of a hex color — anchors the pitch wheel to the song's theme. */
export function hexHue(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  if (!isFinite(n)) return 190;
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 190;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

/** The note's hue: theme hue at the tonic, ±80° by circle-of-fifths distance. */
export function pitchHue(baseHue: number, pc: number, tonicPc: number): number {
  const interval = ((pc - tonicPc) % 12 + 12) % 12;
  const cof = (interval * 7) % 12;               // 0..11 around the circle of fifths
  const signed = cof <= 6 ? cof : cof - 12;      // -5..6 — flat side negative
  return ((baseHue + (signed / 6) * 80) + 360) % 360;
}

/** CSS color for a sung word, or null when the note isn't trustworthy. */
export function pitchColor(baseHue: number, w: MelodyWord | undefined, tonicPc: number, minConf = 0.35): string | null {
  if (!w || w.conf < minConf) return null;
  return `hsl(${pitchHue(baseHue, w.pc, tonicPc).toFixed(0)} 82% 66%)`;
}
