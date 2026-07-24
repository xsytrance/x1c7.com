// The song "planet" — LLM analysis that gives the lyric engine meaning to render.

import type { TextEffect, SurfaceMode } from "@/lib/effects/registry";
import type { StemName } from "@/lib/stemSense";

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
  /** Per-stem audio URLs (web-transcoded Suno stems) — the live stem mixer.
   * Present = the listener can pull the song apart instrument by instrument. */
  stemAudio?: Partial<Record<StemName, string>>;
  /** Seconds to ADD to stem-audio time to land on the release clock
   * (= stems.json align.lag, measured by analyze_stems.py). */
  stemLag?: number;
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
  /** force the stage's surface growth (mud/rust/vines/…), or "none" to keep the
   *  glass clean — a preset knob. undefined = the stage's own lyric-derived pick. */
  surface?: SurfaceMode | "none";
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

/** DYNAMIC+ — the showcase pass (Phase 6). LLM-choreographed from the song's
 * measured profile: acts land on real section boundaries and drop-map moments;
 * `words` extends the text-effect overrides with keyword picks. Authored
 * offline by scripts/song-analysis/dynamic-plus.mjs.
 *
 * Acts are VISUAL moments: the backdrop holds & brightens for the window and
 * the act's billing chip shows. Nothing touches the audio, the stem mix, or
 * the Lab/Reactor mode — v2 dropped those fields from the data entirely. */
export interface DynamicPlusAct {
  start: number; // seconds
  end: number;
  /** short marquee billing shown as the moment chip (≤22 chars, uppercase) */
  label?: string;
  /** the choreographer's one-line reason — debugging + Studio display */
  why?: string;
}
/** A timed viewing-style window — the director's cut. Between windows the
 * viewer's own mode choice stands; inside one, the schedule drives the stage.
 * (Mirrors StageMode in KineticStage; duplicated as literals to keep planet.ts
 * dependency-free of components.) */
export interface DynamicPlusModeWindow {
  start: number; // seconds
  end: number;
  mode: "dynamic" | "focus" | "focus+" | "phrase";
}
export interface PlanetDynamicPlus {
  v: 2;
  acts?: DynamicPlusAct[];
  /** lowercased word -> text effect; merged under effects.overrides at pass 6 */
  words?: Record<string, TextEffect>;
  /** timed phrase↔dynamic switching (the MODE CONDUCTOR) — pass 6 only.
   * Each switch lands with a tape-warp transition on the stage. */
  modes?: DynamicPlusModeWindow[];
  /** pin the backdrop to a named scene for this song's show (e.g. "SYRUP") —
   * a directed world instead of the AUTO hash pick. Unknown names no-op. */
  scene?: string;
}

export interface Planet {
  analysis: PlanetAnalysis;
  assets?: PlanetAssets;
  /** "Artist — 'Song'" when this track is a response/answer record. */
  respondsTo?: string;
  interactions?: PlanetInteractions;
  /** Preset/override biasing of the word text effects (optional). */
  effects?: PlanetEffects;
  /** Phase 6 choreography (optional — its absence caps the show at Phase 5). */
  dynamicPlus?: PlanetDynamicPlus;
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
