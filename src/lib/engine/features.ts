// ═══════════════════════════════════════════════════════════════════════════
// THE FEATURE BUS — one per-frame snapshot of everything the song is doing.
//
// PRISM proved the shape: a single `features` object that every visual layer
// reads each frame (bands, beat, beatPhase, section, stem buses). PRISM has to
// GUESS those live from an FFT. Kinetica doesn't guess — a planet ships its
// measured stems.json (real beat grid, real per-stem envelopes, real risers)
// and its LLM section analysis, so the bus is fed ground truth… including the
// FUTURE: `dropIn`/`beatsToDrop` count down to the next drop before it lands,
// which no live analyzer can ever know.
//
// Plain module store (like stemMix/beatClock): zero React, zero re-renders.
// KineticStage's master rAF calls update(t) once per frame; the WebGL backdrop,
// the LFO engine, and any CSS-var writer read `featureBus.F` after that.
// Everything degrades: no stems → beat grid falls back to the live beatClock,
// envelopes decay to silence, and the show still breathes.
// ═══════════════════════════════════════════════════════════════════════════

import { envAt, activeRiser, type StemData } from "@/lib/stemSense";
import { activeSection, type PlanetSection } from "@/lib/planet";
import { beatClock } from "@/lib/beatClock";
import { stemMixStore } from "@/lib/stemMix";

export type EnergyTier = "LOW" | "MID" | "PEAK";

export interface EngineFeatures {
  /** Song time (seconds) of this frame, and the frame delta. */
  t: number;
  dt: number;
  /** Per-stem loudness 0..1 — REAL instruments, not spectral guesses.
   * (voice = lead vocal, choir = backing vocals, bed = melodic instruments.) */
  drums: number;
  bass: number;
  voice: number;
  choir: number;
  bed: number;
  /** Composite loudness 0..1. */
  level: number;
  /** Kick pulse (1 on a kick, decays) — mirrors the stage's --kick var. */
  kick: number;
  /** Beat pulse envelope (1 on the beat, decays) + phase 0..1 within the beat. */
  beat: number;
  beatPhase: number;
  /** Continuous beat counter — the transport LFOs/quantization ride. */
  totalBeats: number;
  bpm: number;
  /** True when the grid is ground truth (stems.json), not the live fallback. */
  gridLocked: boolean;
  /** Section state from the planet's analysis (LLM emotion arc). */
  sectionIdx: number;
  sectionIntensity: number; // 0..1 emotional energy of the current section
  sectionPulse: number;     // 1 on a section change, decays
  /** Adaptive LOW/MID/PEAK energy tier (the song's own dynamic range). */
  tier: EnergyTier;
  /** Riser charge 0..1 (inside a measured riser window; 0 otherwise). */
  charge: number;
  /** Beat-cut: the drums have measurably vanished (dramatic hole). */
  cut: boolean;
  /** ── THE FUTURE ── seconds/beats until the next drop (riser end).
   * Infinity when no drop is ahead. Live tools cannot have this. */
  dropIn: number;
  beatsToDrop: number;
  /** Active word position on screen, normalized 0..1 (0.5,0.5 = center),
   * and a pulse that fires as each word lands. */
  wordX: number;
  wordY: number;
  wordPulse: number;
}

/** A word leaving the stage, headed for the backdrop's ghost buffer. */
export interface WordGhost {
  word: string;
  /** center, viewport px */
  x: number;
  y: number;
  /** rendered font size, px */
  fs: number;
  /** hue (0-360) of the note the word was sung on (melody sense) — the ghost
   * dissolves in its own note's color. null/absent = palette fallback. */
  hue?: number | null;
}

const F: EngineFeatures = {
  t: 0, dt: 0,
  drums: 0, bass: 0, voice: 0, choir: 0, bed: 0, level: 0,
  kick: 0, beat: 0, beatPhase: 0, totalBeats: 0, bpm: 0, gridLocked: false,
  sectionIdx: -1, sectionIntensity: 0.35, sectionPulse: 0,
  tier: "LOW", charge: 0, cut: false,
  dropIn: Infinity, beatsToDrop: Infinity,
  wordX: 0.5, wordY: 0.5, wordPulse: 0,
};

let stems: StemData | null = null;
let sections: PlanetSection[] = [];
// Ghost hand-off: the stage pushes dying words, the backdrop drains them.
// Hard cap so an unmounted backdrop can never grow the queue unbounded.
const ghosts: WordGhost[] = [];
let beatIdx = 0;          // walking pointer into stems.beats (scrub-safe)
let lastT = -1;
let lastWholeBeat = Number.NaN; // NaN = no beat seen yet (beats can be negative in intros)
let lastSectionKey = "";
// adaptive energy bounds for the LOW/MID/PEAK tier (Prism's trick: track the
// song's own range fast on the way out, slow on the way back)
let energyLo = 0.04;
let energyHi = 0.25;

export const featureBus = {
  /** The live frame snapshot. Read after update(t); never mutate from outside
   * (setWord/setKick/setCut are the writers for stage-owned signals). */
  F,

  /** New song (or pass): point the bus at its ground truth and reset state. */
  setSong(nextStems: StemData | null, nextSections: PlanetSection[] | undefined) {
    stems = nextStems;
    sections = nextSections ?? [];
    ghosts.length = 0;
    beatIdx = 0;
    lastT = -1;
    lastWholeBeat = Number.NaN;
    lastSectionKey = "";
    energyLo = 0.04;
    energyHi = 0.25;
    F.t = 0; F.dt = 0;
    F.drums = F.bass = F.voice = F.choir = F.bed = F.level = 0;
    F.kick = F.beat = F.beatPhase = 0;
    F.totalBeats = 0;
    F.bpm = nextStems?.bpm ?? 0;
    F.gridLocked = !!nextStems;
    F.sectionIdx = -1; F.sectionIntensity = 0.35; F.sectionPulse = 0;
    F.tier = "LOW"; F.charge = 0; F.cut = false;
    F.dropIn = Infinity; F.beatsToDrop = Infinity;
    F.wordX = 0.5; F.wordY = 0.5; F.wordPulse = 0;
  },

  /** Stage-owned signals, written by the tick that already computes them
   * (kick pulse and beat-cut respect the live stem mixer's mute state). */
  setKick(v: number) { F.kick = v; },
  setCut(on: boolean) { F.cut = on; },
  /** The active word landed at (x, y) in viewport px — normalize + pulse. */
  setWord(xPx: number, yPx: number, w: number, h: number) {
    if (w > 0) F.wordX = Math.min(1, Math.max(0, xPx / w));
    if (h > 0) F.wordY = Math.min(1, Math.max(0, yPx / h));
    F.wordPulse = 1;
  },

  /** A word just left the stage — offer it to the ghost buffer. */
  pushGhost(g: WordGhost) {
    if (!g.word) return;
    if (ghosts.length >= 6) ghosts.shift();
    ghosts.push(g);
  },
  /** Backdrop-side: take everything queued this frame. */
  drainGhosts(): WordGhost[] {
    if (!ghosts.length) return ghosts;
    return ghosts.splice(0, ghosts.length);
  },

  /** Once per frame, from the master rAF, with the song playhead. */
  update(t: number) {
    const dt = lastT >= 0 ? Math.max(0, Math.min(0.1, t - lastT)) : 0;
    const scrubbed = lastT >= 0 && t < lastT - 0.6;
    lastT = t;
    F.t = t;
    F.dt = dt;

    // decays (frame-rate independent)
    F.beat = Math.max(0, F.beat - dt * 2.7);
    F.sectionPulse = Math.max(0, F.sectionPulse - dt * 1.2);
    F.wordPulse = Math.max(0, F.wordPulse - dt * 3.5);

    // ── stem envelopes: the real instruments, straight off the analysis —
    // scaled by the LIVE mixer's solo-aware gains, so a muted instrument
    // takes its visuals with it everywhere (backdrop, LFO follows, X-ray).
    // visualGain is 1 for every stem while the mastered mp3 plays. ──
    if (stems) {
      const vg = (s: Parameters<typeof stemMixStore.visualGain>[0]) => stemMixStore.visualGain(s);
      F.drums = envAt(stems, "drums", t) * vg("drums");
      F.bass = envAt(stems, "bass", t) * vg("bass");
      F.voice = envAt(stems, "lead", t) * vg("lead");
      F.choir = envAt(stems, "back", t) * vg("back");
      F.bed = Math.max(
        envAt(stems, "synth", t) * vg("synth"),
        envAt(stems, "other", t) * vg("other"),
        envAt(stems, "guitar", t) * vg("guitar"),
        envAt(stems, "keys", t) * vg("keys"),
      );
    } else {
      // no measured hearing — drift to silence instead of lying
      const k = Math.min(1, dt * 3);
      F.drums += (0 - F.drums) * k; F.bass += (0 - F.bass) * k;
      F.voice += (0 - F.voice) * k; F.choir += (0 - F.choir) * k; F.bed += (0 - F.bed) * k;
    }
    F.level = Math.min(1, F.drums * 0.3 + F.bass * 0.25 + F.voice * 0.25 + F.bed * 0.2 + F.choir * 0.1);

    // ── the beat grid: measured beats when we have them, live clock if not ──
    if (stems && stems.beats.length > 1) {
      const beats = stems.beats;
      const n = beats.length;
      if (scrubbed) beatIdx = 0;
      while (beatIdx < n - 2 && beats[beatIdx + 1] <= t) beatIdx++;
      while (beatIdx > 0 && beats[beatIdx] > t) beatIdx--;
      // Inside the grid: interpolate between measured beats. OUTSIDE it —
      // a drum-less intro before beats[0], or an outro past the last beat —
      // extrapolate at the edge tempo (totalBeats goes negative in intros;
      // phase math and quantize boundaries handle that fine). Without this,
      // the transport froze at 0 until the drums arrived and every LFO and
      // quantized action held its breath for 20 seconds.
      let tb: number;
      if (t < beats[0]) {
        tb = (t - beats[0]) / Math.max(0.001, beats[1] - beats[0]);
      } else if (t >= beats[n - 1]) {
        tb = (n - 1) + (t - beats[n - 1]) / Math.max(0.001, beats[n - 1] - beats[n - 2]);
      } else {
        const a = beats[beatIdx];
        tb = beatIdx + (t - a) / Math.max(0.001, beats[beatIdx + 1] - a);
      }
      F.totalBeats = tb;
      F.beatPhase = ((tb % 1) + 1) % 1;
      F.bpm = stems.bpm || 60 / Math.max(0.001, beats[1] - beats[0]);
      F.gridLocked = true;
    } else {
      // live fallback: the tap-game beat clock (or 120) advances the transport
      const bpm = beatClock.ready ? 60000 / beatClock.interval : 120;
      F.totalBeats += dt * (bpm / 60);
      F.beatPhase = F.totalBeats % 1;
      F.bpm = beatClock.ready ? bpm : 0;
      F.gridLocked = false;
    }
    const whole = Math.floor(F.totalBeats);
    if (whole !== lastWholeBeat) {
      if (Number.isFinite(lastWholeBeat) && !scrubbed) F.beat = 1;
      lastWholeBeat = whole;
    }

    // ── sections: the emotion arc drives a pulse + intensity ──
    if (sections.length) {
      const s = activeSection(sections, t);
      const key = s ? `${s.name}${s.start}` : "";
      if (key !== lastSectionKey) {
        const first = lastSectionKey === "";
        lastSectionKey = key;
        F.sectionIdx++;
        F.sectionIntensity = s?.intensity ?? 0.35;
        if (!first && !scrubbed) F.sectionPulse = 1;
      }
    }

    // ── adaptive energy tier: the song's own LOW/MID/PEAK ──
    if (F.level < energyLo) energyLo += (F.level - energyLo) * Math.min(1, dt * 1.8);
    else energyLo += (F.level - energyLo) * Math.min(1, dt * 0.024);
    if (F.level > energyHi) energyHi += (F.level - energyHi) * Math.min(1, dt * 1.8);
    else energyHi += (F.level - energyHi) * Math.min(1, dt * 0.024);
    const tier = (F.level - energyLo) / Math.max(0.01, energyHi - energyLo);
    F.tier = tier < 0.35 ? "LOW" : tier < 0.7 ? "MID" : "PEAK";

    // ── the future: riser charge now, and the countdown to the next drop ──
    F.charge = 0;
    F.dropIn = Infinity;
    F.beatsToDrop = Infinity;
    if (stems) {
      const r = activeRiser(stems, t);
      if (r) F.charge = Math.max(0, Math.min(1, (t - r.t) / Math.max(0.5, r.end - r.t)));
      for (const ri of stems.risers) {
        if (ri.end > t) { F.dropIn = ri.end - t; break; }
      }
      if (F.dropIn !== Infinity && F.bpm > 0) F.beatsToDrop = F.dropIn * (F.bpm / 60);
    }
  },

  /** Next quantize boundary in totalBeats (step beats: 1 = beat, 4 = bar,
   * 16 = 4 bars), or null when the grid isn't trustworthy — act immediately. */
  nextBoundary(step: number): number | null {
    if (!F.gridLocked || step <= 0) return null;
    return (Math.floor(F.totalBeats / step) + 1) * step;
  },
};
