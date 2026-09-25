// ═══════════════════════════════════════════════════════════════════════════
// WORD IMPACT — which words deserve a moment, and which moment they deserve.
//
// hajimemashite-v5 carries FORTY-TWO hand-authored word→effect mappings. That
// is why its best moments land: a person chose each one. It is also why the
// approach stops at one song — nobody is writing forty-two lines for fifty
// cuts, so every other song gets the thin automatic layer instead.
//
// Two things here. SEMANTIC picks a sensible effect for a word from its
// meaning, so a song with no authoring still gets "light" flaring and "break"
// shattering. And `impact()` scores how much a word matters, so the big
// whole-frame events fire only a handful of times a cut — which is the actual
// lesson from the moment the owner liked. A flashbulb on every word is not a
// flashbulb, it is a strobe.
// ═══════════════════════════════════════════════════════════════════════════

import type { TextEffect } from "./registry";

/** word families → the treatment their meaning asks for */
const SEMANTIC: [TextEffect, string[]][] = [
  ["bloom",   ["light", "lights", "bright", "glow", "glowing", "shine", "shines", "sun", "sunlight", "dawn", "halo", "gold", "golden", "lit", "beam", "radiant", "flash", "white", "heaven", "holy", "angel"]],
  ["burn",    ["fire", "burn", "burns", "burning", "flame", "flames", "ember", "embers", "ash", "smoke", "ignite", "blaze", "spark", "sparks", "torch", "candle", "heat", "hot"]],
  ["freeze",  ["cold", "ice", "iced", "frost", "frozen", "freeze", "winter", "snow", "chill", "numb", "still", "stop", "stopped", "stone"]],
  ["shatter", ["break", "breaks", "breaking", "broke", "broken", "crack", "cracks", "shatter", "smash", "split", "tear", "torn", "ruin", "wreck", "fall", "falls", "fell", "crash"]],
  ["wave",    ["ocean", "wave", "waves", "water", "river", "sea", "tide", "rain", "drown", "flood", "swim", "deep", "blue", "float"]],
  ["glitch",  ["signal", "screen", "phone", "static", "data", "code", "online", "digital", "machine", "wire", "wires", "circuit", "error", "ghost", "fake"]],
  ["slam",    ["boom", "drop", "hit", "hits", "slam", "punch", "knock", "bang", "stomp", "kick", "beat", "heart", "pulse", "blood", "chest", "hammer"]],
  ["echo",    ["alone", "empty", "hollow", "gone", "lost", "memory", "remember", "forget", "silence", "quiet", "distance", "far", "away", "goodbye", "ghost"]],
  ["rise",    ["rise", "rising", "up", "climb", "lift", "fly", "flying", "high", "higher", "above", "sky", "soar", "wings", "open", "opens", "opened", "free"]],
  ["melt",    ["melt", "slow", "soft", "sink", "sinking", "drown", "honey", "warm", "blur", "dream", "sleep", "fade"]],
  ["tremor",  ["shake", "shakes", "tremble", "fear", "afraid", "scared", "nervous", "shiver", "secret", "whisper", "hide", "hidden"]],
  ["neon",    ["city", "night", "street", "club", "dance", "neon", "lights", "electric", "wild", "alive", "tonight"]],
  ["carve",   ["name", "names", "write", "written", "mark", "marks", "stone", "carve", "cut", "scar", "brand", "forever", "always"]],
];

const LOOKUP = new Map<string, TextEffect>();
for (const [fx, words] of SEMANTIC) for (const w of words) if (!LOOKUP.has(w)) LOOKUP.set(w, fx);

export const clean = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, "");

/** The treatment a word's MEANING asks for, or null if it is ordinary. */
export function effectForWord(word: string): TextEffect | null {
  return LOOKUP.get(clean(word)) ?? null;
}

export interface ImpactInput {
  /** seconds until the next word — a held word carries more */
  airtime: number;
  /** 0..1 measured lead-vocal energy at the word */
  delivery: number;
  /** true when the word lands within a beat of a downbeat */
  onDownbeat: boolean;
  /** true when this is the highest note of its phrase */
  melodicPeak: boolean;
  /** how many times the word occurs in the whole cut */
  occurrences: number;
  /** the word already carries a picture */
  hasArt: boolean;
  /** its meaning asks for something */
  semantic: boolean;
}

/**
 * 0..1. Rare, held, belted, peak-of-phrase, on the beat, and meaning something
 * all push a word up. Repetition pushes it down: the fifteenth "ne" is not a
 * moment however loudly it is sung.
 */
export function impact(i: ImpactInput): number {
  let s = 0;
  s += Math.min(1, i.airtime / 0.9) * 0.26;
  s += Math.min(1, Math.max(0, (i.delivery - 0.55) / 0.45)) * 0.22;
  s += i.onDownbeat ? 0.12 : 0;
  s += i.melodicPeak ? 0.16 : 0;
  s += i.semantic ? 0.14 : 0;
  s += i.hasArt ? 0.10 : 0;
  s -= Math.min(0.28, Math.max(0, i.occurrences - 1) * 0.07);
  return Math.max(0, Math.min(1, s));
}

/** Whole-frame events, reserved for the few words that earn one. */
export type BigMoment = "flare" | "quake" | "blackout";

/** Only a handful of words per cut should get one of these. */
export function bigMomentFor(word: string, score: number, floor = 0.62): BigMoment | null {
  if (score < floor) return null;
  const fx = effectForWord(word);
  if (fx === "bloom" || fx === "neon") return "flare";
  if (fx === "slam" || fx === "shatter") return "quake";
  if (fx === "echo" || fx === "freeze") return "blackout";
  return score > 0.78 ? "flare" : null;
}
