// Stem senses — the engine's measured hearing. When a planet ships a
// stems.json (offline analysis of its Suno stems), the show stops guessing:
// kicks/snares/hats are real onsets, the bass curve is the actual 808,
// word delivery is the singer's measured energy, beat-cuts and risers are
// choreography written by the song itself. Playback stays one mp3 — this is
// data, not audio.

/** Every instrument bucket the analyzer recognizes in a Suno stem zip. */
export type StemName = "lead" | "back" | "drums" | "perc" | "bass" | "synth" | "guitar" | "keys" | "strings" | "woodwinds" | "brass" | "other";

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

// ── THE BAR GRID ───────────────────────────────────────────────────────────
// beats[] says WHEN a beat is. It does not say which beat is ONE. Without that
// the engine can only land things on beats, and a move that ends on beat 3 of
// a bar reads as drift rather than an edit.
//
// Infer the downbeat the way a listener does: the kick carries the bar. Try
// each phase 0..3, count how many of the beats it calls "one" actually have a
// kick on them, and take the winner. `strength` is that hit rate — a four-on-
// the-floor song scores near 1.0 on every phase and the grid is ambiguous, so
// callers should treat a low MARGIN between best and runner-up as "no reliable
// downbeat" rather than trusting the winner.
export interface BarGrid {
  beatSec: number;
  barSec: number;
  beatsPerBar: number;
  /** beat index that starts a bar */
  phase: number;
  /** hit rate of the winning phase, 0..1 */
  strength: number;
  /** winner's hit rate minus the runner-up's — low means ambiguous */
  margin: number;
  downbeats: number[];
}

function nearestGap(sorted: number[], t: number): number {
  if (!sorted.length) return Infinity;
  let lo = 0, hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < t) lo = mid + 1; else hi = mid;
  }
  let g = Math.abs(sorted[lo] - t);
  if (lo > 0) g = Math.min(g, Math.abs(sorted[lo - 1] - t));
  return g;
}

export function barGrid(d: StemData, beatsPerBar = 4): BarGrid | null {
  const b = d.beats;
  if (!b || b.length < beatsPerBar * 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < b.length; i++) gaps.push(b[i] - b[i - 1]);
  gaps.sort((x, y) => x - y);
  const beatSec = gaps[gaps.length >> 1];
  if (!isFinite(beatSec) || beatSec <= 0.05) return null;
  const kicks = (d.kicks ?? []).slice().sort((x, y) => x - y);
  const tol = Math.min(0.12, beatSec * 0.25);

  const scores: number[] = [];
  for (let p = 0; p < beatsPerBar; p++) {
    let hit = 0, n = 0;
    for (let i = p; i < b.length; i += beatsPerBar) {
      n++;
      if (nearestGap(kicks, b[i]) <= tol) hit++;
    }
    scores.push(n ? hit / n : 0);
  }
  const best = Math.max(...scores);
  const phase = scores.indexOf(best);
  const runnerUp = Math.max(...scores.filter((_, i) => i !== phase));
  const downbeats: number[] = [];
  for (let i = phase; i < b.length; i += beatsPerBar) downbeats.push(b[i]);
  return {
    beatSec,
    barSec: beatSec * beatsPerBar,
    beatsPerBar,
    phase,
    strength: best,
    margin: best - runnerUp,
    downbeats,
  };
}

/** The downbeat at or before t, and the next one. */
export function barAt(g: BarGrid, t: number): { start: number; next: number } {
  const d = g.downbeats;
  if (!d.length) return { start: t, next: t + g.barSec };
  let lo = 0, hi = d.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (d[mid] <= t) lo = mid; else hi = mid - 1;
  }
  const start = d[lo] <= t ? d[lo] : d[0] - g.barSec;
  const next = lo + 1 < d.length ? d[lo + 1] : start + g.barSec;
  return { start, next };
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
