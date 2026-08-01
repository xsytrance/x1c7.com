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
  /** image URL -> shot size. Keyed by URL, not by word, because twins, gallery
   * variants and B-roll plates each frame differently. Drives the camera (a
   * WIDE plate may not be pushed into) and the no-two-same-sizes-in-a-row rule.
   * Without it the stage falls back to its old behaviour. See playbook §17. */
  shots?: Record<string, "WIDE" | "MED" | "CLOSE" | "MACRO">;
  /** B-roll pool — Lexsycon paintings matched to this song, walked round-robin
   * by the two-roll conductor as the second visual voice.
   * `crop` matters: every lexicon plate is 1152×832 LANDSCAPE, so
   * object-cover into 1080×1920 throws away 59% of its width.
   *   "safe"      — full-field texture/abstract, survives a hard centre crop.
   *   "letterbox" — a composed scene; show it as a 1080×780 band (that is
   *                 1.3846, the lexicon's exact native aspect — zero crop),
   *                 never full-bleed. See playbook §17. */
  broll?: Array<{ url: string; shot?: "WIDE" | "MED" | "CLOSE" | "MACRO"; crop?: "safe" | "letterbox" }>;
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
  /** THE TWO-ROLL CONDUCTOR — timed windows where the Lexsycon B-roll stops
   * being a faint ghost and becomes a second visual voice. Without this the
   * reel draws at a fixed 0.24 screen-blend, which over a dark plate is barely
   * visible; a cut made of one person's photographs reads as a slideshow.
   *   bleed     — B sits under A as texture at `mix` opacity.
   *   alternate — B takes the frame outright every `period` art changes.
   *   band      — B shows as a 1080×780 letterbox strip (its native aspect,
   *               so nothing is cropped) with A filling the rest of the frame.
   * Outside every window the historic ghost behaviour stands. */
  /** One-frame light events. "The doors swung open, LIGHTS HIT and we felt it"
   * should actually hit — a white bloom on the beat rather than another
   * crossfade. Fires once when the playhead crosses `t`. */
  hits?: Array<{ t: number; color?: string; dur?: number; peak?: number }>;
  /** Windows where the cutting STOPS and one frame is allowed to breathe.
   * The closing belt is the payoff of the whole cut; churning art through it
   * throws the landing away. */
  holds?: Array<{ start: number; end: number; art?: string }>;
  /** Bespoke authored moments that take the whole stage for a few seconds.
   * `nameCards` hard-cuts a series of words (no crossfade — the cut IS the
   * point), then collapses them onto each other into a single surviving name. */
  oneShots?: Array<{
    id: string;
    kind: "nameCards";
    start: number; end: number;
    /** suppress the normal word layer and art swaps while this runs */
    solo?: boolean;
    cards: Array<{ text: string; at: number; art?: string }>;
    /** when the three become one, and what is left standing */
    collapseAt: number;
    collapseTo: string;
    collapseDur?: number;
  }>;
  rolls?: Array<{
    start: number; end: number;
    pattern: "bleed" | "alternate" | "band";
    /** B-plane opacity when it is showing. Default 0.24 (the old ghost). */
    mix?: number;
    /** `alternate` only: B takes every Nth art change. Default 3. */
    period?: number;
    /** CSS mix-blend-mode for the B plane. Default "screen". */
    blend?: string;
  }>;
  /** director's-deck intensity knobs applied whenever this song plays at
   * pass 6 (mirrors KineticStage's deck prop): density = particle population
   * multiplier, glow = extra word bloom 0..1, grain/vignette = overlays 0..1. */
  deck?: {
    density?: number; glow?: number; grain?: number; vignette?: number;
    motion?: DeckMotion; giant?: DeckGiant;
    /** TYPOGRAPHY-ONLY when false: the stage never loads or shows scene art at
     * all — no keyword paintings, no section moods, and none of the `_shared`
     * fallback frames that common words like "night" or "love" otherwise pull
     * in. The generative backdrop and the weather particles still run, since
     * those are drawn rather than photographed, so the frame keeps its fire
     * and its embers without a single image in it. Absent/true = normal. */
    art?: boolean;
    /** Pin the generative backdrop's hue lean, -0.5..0.5 turns. Absent = each
     * section rolls its own from hash(song, emotion), which is lovely on a
     * varied record and wrong on a song that is about ONE colour. */
    backdropHue?: number;
  };
}

/** GIANT WORDS — how `dynamic` mode stages one huge word at a time.
 *
 * Stock behaviour builds a PILE: the outgoing word stays on stage as a residue
 * (up to 3, ~8s each) so a sung phrase accumulates into a poster. That is the
 * right look for a continuous dynamic passage, and the wrong one for a directed
 * cut that dips into dynamic for a single punch word every few seconds — there
 * the pile fills with unrelated words from ten seconds ago and the stage turns
 * to mush. These knobs make the treatment choosable per song instead of fixed. */
export interface DeckGiant {
  /** how many outgoing words stay on stage: 0 = SOLO (one giant word, clean
   * stage), 1–2 = light echo, 3 = the stock pile. Default 3. */
  pile?: number;
  /** ms a residue lives before it starts fading. Default 8000. */
  life?: number;
  /** clear the pile whenever the mode conductor switches, so each dynamic
   * window is a self-contained moment. Default true when `pile` is set. */
  clearOnSwitch?: boolean;
}

/** MOTION SHOTS — turns the backdrop from a slideshow into cut footage. The
 * stage's stock ken-burns is one 24s creep sized for a scene that lives half a
 * minute; in a directed cut a scene lives 1–2s, so ~1% of that move ever shows
 * and every image reads as a still. With this present each scene instead gets
 * its own short camera move (push in, pull out, track, crane), picked per image
 * and completed inside the shot. Absent = the stock behaviour, untouched. */
export interface DeckMotion {
  /** seconds a camera move takes end to end (default 2.2) */
  dur?: number;
  /** move amplitude multiplier, 0..2 (default 1) */
  amp?: number;
  /** floor between backdrop swaps in ms — the stage's default is 2000, which
   * silently swallows any cut faster than that (default 1000 when motion is on) */
  swapMs?: number;
  /** crossfade seconds; keep well under swapMs or fades overlap (default 0.42) */
  fade?: number;
  /** psychedelic grade on the scene photo only, 0..1: a slow hue drift +
   * saturation swell. 0 / absent = no grade. */
  trip?: number;
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
