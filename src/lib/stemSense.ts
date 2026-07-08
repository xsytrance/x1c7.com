// Stem senses — the engine's measured hearing. When a planet ships a
// stems.json (offline analysis of its Suno stems), the show stops guessing:
// kicks/snares/hats are real onsets, the bass curve is the actual 808,
// word delivery is the singer's measured energy, beat-cuts and risers are
// choreography written by the song itself. Playback stays one mp3 — this is
// data, not audio.

/** Every instrument bucket the analyzer recognizes in a Suno stem zip. */
export type StemName = "lead" | "back" | "drums" | "perc" | "bass" | "synth" | "guitar" | "keys" | "other";

export interface StemRiser { t: number; end: number }
export interface StemData {
  v: number;
  bpm: number;
  envHz: number;
  duration: number;
  align: { lag: number; score: number };
  beats: number[];
  kicks: number[];
  snares: number[];
  hats: number[];
  /** [start, end] windows where the drums fall silent — the dramatic cuts. */
  cuts: [number, number][];
  /** energy ramps that terminate at a drum return — ride them into the drop. */
  risers: StemRiser[];
  /** per-stem loudness envelopes, 0-99 at envHz frames/sec. */
  env: Partial<Record<StemName, number[]>>;
}

export async function loadStems(url: string): Promise<StemData | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = (await r.json()) as StemData;
    return d && d.v === 1 && Array.isArray(d.beats) ? d : null;
  } catch {
    return null;
  }
}

/** Envelope value 0..1 for a stem at song-time t (linear interp). */
export function envAt(data: StemData, stem: keyof StemData["env"], t: number): number {
  const e = data.env[stem];
  if (!e || !e.length) return 0;
  const x = t * data.envHz;
  const i = Math.floor(x);
  if (i < 0) return e[0] / 99;
  if (i >= e.length - 1) return e[e.length - 1] / 99;
  const f = x - i;
  return (e[i] * (1 - f) + e[i + 1] * f) / 99;
}

/** Walks a sorted onset list against song time; scrub-safe.
 * consume(t) returns how many onsets passed since the last call. */
export class OnsetTracker {
  private times: number[];
  private i = 0;
  private lastT = -1;
  constructor(times: number[]) {
    this.times = times;
  }
  consume(t: number): number {
    // seek (scrub/loop) — resync without firing a burst of stale onsets
    if (t < this.lastT - 0.6) {
      this.i = 0;
      while (this.i < this.times.length && this.times[this.i] < t) this.i++;
      this.lastT = t;
      return 0;
    }
    this.lastT = t;
    let n = 0;
    while (this.i < this.times.length && this.times[this.i] <= t) {
      // ignore onsets far in the past (initial mount mid-song)
      if (t - this.times[this.i] < 0.35) n++;
      this.i++;
    }
    return n;
  }
}

/** The cut window containing t, or null. Only DRAMATIC holes count: long
 * enough to read as a beat-cut (≥1.6s), short enough to be a moment and not
 * a quiet section or drum-less intro (≤7s) — a 20s bridge isn't a blackout. */
export function activeCut(data: StemData, t: number, minLen = 1.6, maxLen = 7): [number, number] | null {
  for (const [a, b] of data.cuts) {
    if (b - a >= minLen && b - a <= maxLen && t >= a && t < b) return [a, b];
    if (a > t) break;
  }
  return null;
}

/** The riser window containing t, or null. */
export function activeRiser(data: StemData, t: number): StemRiser | null {
  for (const r of data.risers) {
    if (t >= r.t && t < r.end) return r;
    if (r.t > t) break;
  }
  return null;
}
