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
  /** Timestamps where the STAGE RATTLES — the drop landing in the frame.
   * Fires the same payoff a real phone shake does (a CSS quake on the stage,
   * a particle scatter, and the live word reacting in the song's own tap
   * language), which is otherwise unreachable in a rendered cut because only
   * a `devicemotion` event ever triggered it. Use them on the few genuine
   * hype moments — a beat drop, a chant wall — not on every bar. */
  quakes?: number[];
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
    /** Pin how strongly dying lyrics dissolve into the generative backdrop,
     * 0..1 (0 = off). Absent = the engine's own 0.5. A chant whose hook word
     * repeats a dozen times stacks ghosts faster than they fade and the frame
     * turns into a wall of overlapping giant text — those songs want 0. */
    ghosts?: number;
    /** the blurred giant word that swells under the stage with the backing
     * vocals (the "choir" layer). Default true; false for songs whose words
     * are too long to fit it, where it only ever reads as a smear. */
    choir?: boolean;
    /** how far the sung NOTE may pull a word's hue off the theme, 0..1.
     * 1 (absent) = the historic +/-80 degrees. A song with a monochrome grade
     * wants a small number: at full spread a gold-on-black cut renders some
     * words cold blue-grey and they vanish into the plate. */
    pitchSpread?: number;
    /** saturation / lightness of a pitch-coloured word, 0..100.
     * Absent = the historic 82 / 66. `spread` chooses the HUE; these choose
     * whether it can be READ. A grade whose art sits at the theme hue needs a
     * high pitchLight (~88-92) or the words converge on the plate's own colour
     * and wash out — Hajimemashite's bright doorway act, measured against a
     * melody-disabled render. Reaching for spread instead cannot win: narrow
     * loses words on bright plates, wide loses them on dark ones. */
    pitchSat?: number;
    pitchLight?: number;
    /** Swap the cinematic camera's free-running sines for BAR STEPS: hold,
     * accelerate, arrive on the downbeat, hold again.
     *
     * The historic camera (pass>=5, so it is on for every cut whether or not
     * deck.motion is set) drifts on sin(t*0.10) — a 63-SECOND period, meaning
     * one slow sweep across a whole cut, unrelated to the tempo. It never sits
     * still and never arrives, which is most of what reads as "floaty
     * slideshow". Stepping is discrete, and discrete is what editing is.
     *
     * Needs a trustworthy downbeat (barGrid margin >= 0.15) and silently keeps
     * the old drift when the phase is ambiguous — a four-on-the-floor song
     * scores every phase alike and stepping on the wrong beat is worse than
     * not stepping at all. */
    camSync?: boolean;
    /** Land a plate swap on the next DOWNBEAT, and let a drum-cut return cut
     * the picture immediately.
     *
     * Without it the only gate is the swapMs throttle, so the image changes the
     * instant its window expires — an arbitrary point in the bar. The picture
     * then advances like a slide rather than cutting like an edit, and a change
     * that should land ON the drop arrives a beat or two after it. Capped at
     * 1.5 bars of extra wait so a plate is never held hostage to a drifted
     * grid, and needs a trustworthy downbeat (barGrid margin >= 0.15). */
    artSync?: boolean;
    /** THE GUIDE — the sing-along ball, played by the song rather than
     * animated over it. Absent = no guide.
     *
     * Lands exactly on each word's onset; the arc apex comes from the note that
     * word is sung on (melody.json), so a melodic leap becomes a leap in the
     * arc; it SKATES instead of bouncing when syllables are under ~0.25s apart,
     * which is what a fast run should look like; and it squashes on landing by
     * the singer's measured energy there. Positions come from `stagecraft()`,
     * which is pure in the word index, so the one-word lookahead is free.
     *
     * Dynamic mode only for now — phrase mode lays words out in a line rather
     * than at a computable position. */
    guide?: { size?: number };
    /** WHOLE-FRAME MOMENTS. A handful of words per cut get the frame itself to
     * answer them — a flare, a quake, a drop to silhouette — rather than a
     * decoration on the glyph. `floor` is the impact score a word must clear
     * (default 0.62); raise it to make moments rarer, lower for more.
     *
     * Scored from airtime, measured delivery, landing on a downbeat, being the
     * melodic peak of its phrase, carrying art, meaning something, and MINUS
     * repetition — the fifteenth "ne" is not a moment however loudly it lands. */
    moments?: { floor?: number };
    /** THE SONG'S ART, ABSTRACTED (scripts/art/abstract.mjs).
     * `veil` is its plates averaged and blurred past recognition — the art's
     * light without its subject, drifting as cloud instead of sitting there as
     * a slideshow. `motes` is a 4x3 sheet of soft patches cut from the
     * SMOOTHEST bright regions, used as particle sprites so a song's weather is
     * made of that song. Both absent = the historic flat dots and no veil. */
    abstract?: { veil?: string; motes?: string; veilMix?: number };
    /** THE WORLD — swap the per-pixel shader corridor for a real three.js
     * scene, with the lyric living inside it. A word sits at the distance its
     * onset occupies (s = t * speed) and the camera flies the same path, so
     * words arrive, twist past and recede because time IS distance — none of
     * it is animated. One coordinate system for camera, corridor and text,
     * which is what every 3D bug in the CSS layer came from not having. */
    /** THE WORD STUDY — drop the world entirely. A near-black void, one word
     * at a time, and a camera that arcs around it while it is held. Each word
     * is DISCOVERED (it turns in from edge-on, rises, is pushed at you, swings,
     * drops or unfolds) with the treatment chosen by how hard it was sung, how
     * far its note sits from the tonic, and whether the line is climbing. */
    study?: boolean | { mode?: string; tilt?: number; rest?: number; keys?: number; spread?: number; surface?: boolean };
    world?: boolean | {
      /** corridor cross-section: square | triangle | pentagon | hex | octagon | ring.
       *  It is literally the torus's tubularSegments count — one number, a
       *  completely different world. */
      shape?: string;
      /** longitudinal rails down the corridor: this is what turns a stack of
       *  rungs into a GRID. 0 for bare rungs. */
      rails?: number;
      /** units between rungs — tight reads fast, wide reads vast */
      gap?: number;
      radius?: number;
      /** degrees each successive rung is rotated: the corridor screws as it runs */
      twist?: number;
      /** false keeps the bare wireframe corridor */
      surface?: boolean;
      /** seconds of lead time before an upcoming word becomes visible */
      reveal?: number;
    };
    /** DRAIN — sung words travel to the vanishing point instead of fading where
     * they stand: they shrink, blur and ACCELERATE away down the corridor.
     *
     * A dynamic word already carries its own off-centre offset, so the trip
     * back to the vanishing point is the exact negation of it — no new
     * geometry. Charged words sit dead centre and simply recede on the spot.
     * Gated on airtime (`minAir`, default 0.28s) so only words with room get
     * pulled; under that there is no time to read the travel, the same
     * reasoning that makes the guide skate rather than bounce on fast runs.
     * Pairs with `dynamicPlus.scene = "CORRIDOR"`, where the vanishing point
     * is real. */
    drain?: { dur?: number; minAir?: number; past?: boolean; near?: number; far?: number; lens?: number; origin?: string; swell?: number; vary?: boolean };
    /** RUSH — the mirror of `drain`: the word ARRIVES out of the vanishing
     * point, starting tiny and blurred at the far end of the corridor and
     * flying at the camera to land on its own onset at full size.
     *
     * The curve accelerates, because that is what perspective does — a thing
     * approaching at constant speed appears slow while far away and then rushes
     * past. Landing at speed and stopping dead is the same grammar as the
     * camera's "arrive" ease.
     *
     * With `drain`, the lyric becomes a stream the viewer flies through: words
     * come out of the far end, pass, and are pulled away behind. Same airtime
     * gate, so the song chooses which words make the trip. */
    rush?: { dur?: number; minAir?: number; far?: number; lens?: number };
    /** A SECOND plate, hard-cut into a letterbox band every `every` bars and
     * held for `hold` bars. `minPush` gates it to sections above that energy.
     *
     * Every cut before this showed exactly one image at a time, full frame,
     * with a slow move over it — the Ken Burns documentary grammar, which no
     * quality of plate can stop reading as a slideshow. A second plane that
     * cuts in and out on the bar is what an edit looks like. Draws only from
     * plates already painted this cut, so it never stalls on a cold fetch, and
     * rides the same bar counter as camSync so the two land together rather
     * than fighting. Needs artSync's grid. */
    inserts?: { every?: number; hold?: number; minPush?: number; at?: "center" | "top" | "bottom"; height?: number };
    /** PIN the weather instead of letting particleModeFor infer it from the
     * song's own words. That inference reads the TITLE too, which a cut cannot
     * edit — a song called "Drink Drink" matches the champagne/bubbles rule on
     * its name alone. One of: embers rain snow dust bubbles sparks ash petals
     * pollen fireflies confetti leaves stars. */
    weather?: string;
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
  /** the SEPARATE stutter pileup — the repeated word stacking up across the
   * whole frame on a >=3-repeat run. Nothing to do with `pile` above (that is
   * the giant word's own residue); this is its own layer and its own feature.
   * Default true. A chant with a long hook word wants false. */
  stutter?: boolean;
  /** how that pileup ARRANGES itself. "scatter" (absent) is the historic
   * jittered grid with random tilt and scale — confetti, and on a long word it
   * is unreadable chaos. "pour" stacks the repeats bottom-up at constant size
   * with no rotation, a rising level rather than a mess, and flies each chip in
   * from `stutterEmit`. A song whose hook IS the repeated word wants "pour". */
  stutterLayout?: "scatter" | "pour" | "trail";
  /** where poured chips fly in FROM, as [x, y] in percent of the frame. Put it
   * on the bottle's neck in the artwork and the words look poured out of it.
   * Default [50, 8] — top centre. */
  stutterEmit?: [number, number];
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
  /** snap `dur` to a whole number of BARS, measured off the stems' beat grid.
   * A move whose length is unrelated to the tempo ends wherever it happens to
   * end and the eye reads that as drift; a move that ends on a bar line reads
   * as an edit. Uses bar LENGTH only, so it works even where the downbeat
   * phase is ambiguous (a four-on-the-floor song scores every phase alike). */
  sync?: boolean;
  /** "arrive" accelerates the move into its endpoint and stops dead, instead
   * of easeOut's decelerating settle. Absent = the historic easeOut. */
  ease?: "arrive";
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
