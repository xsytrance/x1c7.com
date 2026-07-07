// The song "planet" — LLM analysis that gives the lyric engine meaning to render.

import type { TextEffect } from "@/lib/effects/registry";

export interface PlanetSection {
  name: string;
  emotion: string;
  intensity: number; // 0..1
  colorHint: string; // #hex
  start: number;     // seconds
}
export interface PlanetKeyword {
  word: string;
  emotion: string;
  imageryPrompt: string; // future: text-to-image asset generation
}
export interface PlanetAnalysis {
  summary: string;
  overallMood: string;
  themes: string[];
  palette: string[]; // #hex[]
  sections: PlanetSection[];
  keywords: PlanetKeyword[];
}
export interface PlanetAssets {
  /** keyword word -> generated image URL (Phase 4: ComfyUI song art). */
  keywords?: Record<string, string>;
  /** emotion (lowercase) -> generated backdrop URL — continuous mood art. */
  sections?: Record<string, string>;
  /** base image URL -> its twin variant (-2.webp): the art-doubling pass.
   * The engine alternates twins each time an image returns to stage. */
  alt?: Record<string, string>;
  /** URL (object URL in-browser) of the measured stems.json — the stem senses. */
  stems?: string;
}
/** LLM-choreographed touch interactions — different per song, always in the
 * song's own language (fire burns, heartbreak shatters, love blooms). */
export interface PlanetInteractions {
  tapEffect?: "burn" | "shatter" | "dissolve" | "bloom";
  moments?: { t: number; end: number; type: string; layer: string; prompt: string }[];
}

/** Preset/vibe biasing + per-word overrides for the word-level text effects.
 *  Written by a vibe preset (kinetica) or the per-word override UI; read by the
 *  stage's effect resolver. Both are optional — absent = the engine's own picks. */
export interface PlanetEffects {
  /** lowercased word -> a forced text effect. Highest priority; also the only
   *  way to summon freeze/melt/carve (they have no automatic word trigger). */
  overrides?: Record<string, TextEffect>;
  /** a preset's allowed palette: if set, a naturally-matched effect NOT in this
   *  list is suppressed (the word renders plain), keeping a vibe coherent. */
  allow?: TextEffect[];
}

/** Resolve a word's text effect through the preset/override seam. Precedence:
 *  an explicit per-word override wins (checked against each candidate key, and
 *  the only way to summon freeze/melt/carve); otherwise the stage's natural pick
 *  stands unless a preset `allow` list rules it out (then the word renders plain).
 *  Pure + dependency-free so both the stage and tests can share one contract. */
export function resolveWordEffect(
  natural: TextEffect | null,
  cfg: PlanetEffects | undefined,
  keys: string[],
): TextEffect | null {
  if (cfg?.overrides) {
    for (const k of keys) {
      const o = cfg.overrides[k];
      if (o) return o;
    }
  }
  if (natural && cfg?.allow && !cfg.allow.includes(natural)) return null;
  return natural;
}

export interface Planet {
  analysis: PlanetAnalysis;
  assets?: PlanetAssets;
  /** "Artist — 'Song'" when this track is a response/answer record. */
  respondsTo?: string;
  interactions?: PlanetInteractions;
  /** Preset/override biasing of the word text effects (optional). */
  effects?: PlanetEffects;
  generatedAt: string | null;
}

/** The section playing at a given time (sections are start-sorted); null before the first. */
export function activeSection(sections: PlanetSection[], time: number): PlanetSection | null {
  let cur: PlanetSection | null = null;
  for (const s of sections) {
    if (s.start <= time) cur = s;
    else break;
  }
  return cur;
}

// ── The "director": emotion → visual motion treatment ──────────────────────
export type SectionMotion = "still" | "drift" | "pulse" | "surge" | "shatter";

/** Choose how words should move for a section, from its emotion + intensity. */
export function sectionMotion(s: PlanetSection): SectionMotion {
  const e = (s.emotion || "").toLowerCase();
  if (/rage|anger|defian|desper|despair|explos|furious|intens|chaos/.test(e) || s.intensity >= 0.7) return "shatter";
  if (s.intensity >= 0.55) return "surge";
  if (s.intensity >= 0.38) return "pulse";
  if (s.intensity >= 0.22) return "drift";
  return "still";
}
