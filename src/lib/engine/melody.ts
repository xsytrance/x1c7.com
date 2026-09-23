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

/** THEME HUE — the hue the tonic wears, taken from the song's palette.
 *
 * hexHue() returns 190 for any GREY: pure white, pure black, and anything
 * close enough that max==min. That fallback is harmless for a backdrop but
 * poisonous here, because palette[0] anchors the whole pitch wheel — a gold
 * song whose palette leads with #FFFFFF (hajimemashite) would paint every
 * sung note in the cyan family, on a grade that has no cyan in it. Six of
 * the 74 tracks with a planet lead with a grey.
 *
 * So: use the first palette entry that actually CARRIES a hue, and only fall
 * back to the track colour (then hexHue's own 190) when none of them does.
 * A grey palette[0] is a legitimate art choice for text and lights — it
 * simply cannot tell us what colour the music is in. */
export function themeHueFrom(palette: (string | undefined)[], fallback?: string): number {
  for (const hex of palette) {
    if (!hex) continue;
    const n = parseInt(hex.replace("#", ""), 16);
    if (!isFinite(n)) continue;
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (Math.max(r, g, b) - Math.min(r, g, b) >= 8) return hexHue(hex);
  }
  return hexHue(fallback ?? "");
}

/** The note's hue: theme hue at the tonic, ±80° by circle-of-fifths distance. */
/** `spread` scales how far the note is allowed to pull the hue off the theme.
 * 1 = the historic +/-80 degrees, which is most of the colour wheel and is
 * wonderful on a song whose art is neutral. On a MONOCHROME grade it is a
 * legibility bug: Hajimemashite is gold-on-near-black, and a word that swung
 * 80 degrees came out cold blue-grey and disappeared into the plate. Songs
 * like that pass a small spread and keep the melody nuance inside their own
 * colour. Absent = 1, so every existing cut is untouched. */
export function pitchHue(baseHue: number, pc: number, tonicPc: number, spread = 1): number {
  const interval = ((pc - tonicPc) % 12 + 12) % 12;
  const cof = (interval * 7) % 12;               // 0..11 around the circle of fifths
  const signed = cof <= 6 ? cof : cof - 12;      // -5..6 — flat side negative
  return ((baseHue + (signed / 6) * 80 * spread) + 360) % 360;
}

/** CSS color for a sung word, or null when the note isn't trustworthy. */
export function pitchColor(baseHue: number, w: MelodyWord | undefined, tonicPc: number, minConf = 0.35, spread = 1): string | null {
  if (!w || w.conf < minConf) return null;
  return `hsl(${pitchHue(baseHue, w.pc, tonicPc, spread).toFixed(0)} 82% 66%)`;
}

/** Median MIDI note of the pitched words — the singer's home register.
 * Octave nuance (a word's height above/below this) is measured against it. */
export function medianMidi(m: MelodyData): number {
  const v = m.words.map((w) => w.midi).sort((a, b) => a - b);
  return v.length ? v[v.length >> 1] : 60;
}

/** MELODY MOTION — how the current word sits in the melodic line:
 *  inDelta  = semitones from the previous pitched word (entrance direction:
 *             rising line → the word lifts into place from below)
 *  outDelta = semitones to the NEXT pitched word (exit direction: the word
 *             leaves leading the ear toward where the melody goes next)
 *  midi     = the word's own note (octave nuance).
 * null when the word (or its window) isn't confidently voiced. */
export function melodicMotion(
  words: Map<number, MelodyWord>,
  idx: number,
  lastIdx: number,
  minConf = 0.35,
): { inDelta: number; outDelta: number; midi: number } | null {
  const cur = words.get(idx);
  if (!cur || cur.conf < minConf) return null;
  let prev: MelodyWord | undefined;
  for (let j = idx - 1; j >= Math.max(0, idx - 6); j--) {
    const p = words.get(j);
    if (p && p.conf >= minConf) { prev = p; break; }
  }
  let next: MelodyWord | undefined;
  for (let j = idx + 1; j <= Math.min(lastIdx, idx + 6); j++) {
    const n = words.get(j);
    if (n && n.conf >= minConf) { next = n; break; }
  }
  return {
    inDelta: prev ? cur.midi - prev.midi : 0,
    outDelta: next ? next.midi - cur.midi : 0,
    midi: cur.midi,
  };
}
