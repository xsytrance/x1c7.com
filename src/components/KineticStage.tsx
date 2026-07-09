"use client";

// The lyric engine's renderer — THE way a planet performs its song.
// Word blow-ups with emotion-directed motion, shape-morphs, generated-art
// backdrops, live color grading, beat halo, and the scrubbable emotional arc.
// Shared by the /music cinematic takeover and the /studio playground.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, type MotionProps } from "framer-motion";
import { useMusicPlayer, HAS_SHARED_ART, PLANET_BASE } from "@/lib/engineHost";
import { activeWordIndex, parseLyrics, type SyncedWord } from "@/lib/lyrics";
import { activeSection, sectionMotion, resolveWordEffect, type PlanetSection, type SectionMotion, type PlanetEffects } from "@/lib/planet";
import { deriveTheme } from "@/lib/theme";
import { glyphFor, glyphForEmotion, type Glyph } from "@/lib/shapes";
import { beatClock } from "@/lib/beatClock";
import { KineticParticles, particleModeFor, type ParticleHandle, type ParticleMode } from "./KineticParticles";
import { SurfaceEffects } from "./SurfaceEffects";
import { veilForWeather, surfaceFor, VEIL_SPECS, SURFACE_SPECS, type VeilKind, type SurfaceMode, type TextEffect } from "@/lib/effects/registry";
import { loadLexicon, aggregateLegos } from "@/lib/lexicon/lookup";
import type { Lexicon } from "@/lib/lexicon/types";
import { loadStems, envAt, activeCut, activeRiser, OnsetTracker, type StemData } from "@/lib/stemSense";
import { stemMixStore } from "@/lib/stemMix";
import { usePerfLite } from "@/lib/perf";
import { PerfHUD } from "./PerfHUD";
import type { Track } from "@/lib/engineHost";

export const clean = (w: string) => w.replace(/^[^\p{L}\p{N}'’]+|[^\p{L}\p{N}'’]+$/gu, "") || w;

// ── Signature word effects ─────────────────────────────────────────────────
// Global lexicons: any song triggers them, so every planet gets the drama that
// fits its own vocabulary. Priority: burn > glitch > fizz > type-on > glyph.
const FIRE_WORDS = new Set(["fire", "burn", "burns", "burning", "burned", "flame", "flames", "match", "matches", "ember", "embers", "ash", "ashes", "smoke", "ignite", "lit", "blaze", "spark", "sparks"]);
// tech/connection words flicker like a dropping video call
const GLITCH_WORDS = new Set(["signal", "wifi", "wi-fi", "phone", "phones", "screen", "screens", "camera", "call", "calls", "video", "battery", "message", "messages", "static", "glitch", "froze", "frozen", "online", "offline", "notification", "notifications", "emoji", "screenshot", "feed", "tabs", "inbox", "ping", "pings", "scroll", "scrolling", "alert", "alerts", "lockscreen", "interface", "ads", "overloaded", "overcoded", "data"]);
// drink words fizz like carbonation
const FIZZ_WORDS = new Set(["cocktails", "cocktail", "drink", "drinks", "glass", "ice", "sip", "champagne", "bubbles", "wine", "toast"]);
// code words type themselves out
const TYPE_WORDS = new Set(["code", "coding", "type", "typing", "typed", "tab", "tabs", "debug", "commit", "prompt", "build", "builds", "program", "software", "logic", "automate", "keys", "keyboard", "laptop"]);
// impact words SLAM down and shake the stage
const SLAM_WORDS = new Set(["boom", "drop", "drops", "crash", "break", "breaks", "broke", "shake", "shakes", "slam", "hit", "hits", "knock", "knocks", "bang", "drum", "drums", "kick", "punch", "stomp", "hammer"]);
// water words undulate like a rolling swell
const WAVE_WORDS = new Set(["ocean", "wave", "waves", "river", "tide", "tides", "water", "sea", "olas", "mar", "océano", "río"]);
// light words buzz on like a neon sign igniting
const NEON_WORDS = new Set(["light", "lights", "neon", "glow", "glows", "glowing", "shine", "shines", "shining", "bright", "luz", "luces", "brilla"]);
// heartbeat words pump lub-dub with the pulse
const PULSE_WORDS = new Set(["heartbeat", "heartbeats", "pulse", "beat", "beats", "corazón", "latido", "latidos"]);
// hushed words arrive small, breathy, and blurred
const WHISPER_WORDS = new Set(["whisper", "whispers", "whispering", "whispered", "quiet", "silence", "silencio", "hush", "secret", "secrets", "softly", "callar"]);
// ── Auto-triggers for the newer treatments (lower priority than everything above,
//    so shared words keep their existing effect; a per-word override still wins). ──
const COLD_WORDS = new Set(["cold", "colder", "freeze", "freezing", "frost", "numb", "shiver", "shivers", "chill", "chills", "winter", "icy", "frostbite"]);           // → freeze
const HEAT_WORDS = new Set(["melt", "melts", "melting", "heat", "heats", "sweat", "sweats", "drip", "drips", "dripping", "humid", "molten", "summer"]);                  // → melt
const STONE_WORDS = new Set(["stone", "stones", "carve", "carved", "marble", "monument", "statue", "granite", "engrave", "engraved", "eternal", "forever", "chiseled", "permanent"]); // → carve
const GOLD_WORDS = new Set(["gold", "golden", "crown", "crowns", "rich", "riches", "luxury", "luxe", "diamond", "diamonds", "jewel", "jewels", "glitter", "treasure", "royal", "shimmer", "sparkle"]);  // → shimmer
const RISE_WORDS = new Set(["rise", "rises", "rising", "soar", "soars", "soaring", "fly", "flies", "flying", "lift", "lifts", "lifted", "float", "floats", "floating", "higher", "ascend", "heaven", "wings", "uplift"]);  // → rise
const FALL_WORDS = new Set(["fall", "falls", "falling", "fell", "sink", "sinks", "sinking", "sank", "plunge", "tumble", "collapse", "descend", "gravity", "drown", "drowning"]);  // → fall
const ECHO_WORDS = new Set(["echo", "echoes", "echoing", "echoed", "repeat", "repeats", "again", "distant", "reverb", "resound", "lingers", "lingering"]);               // → echo
const TREMOR_WORDS = new Set(["tremble", "trembles", "trembling", "tremor", "fear", "afraid", "scared", "nervous", "anxious", "panic", "quake", "quakes", "earthquake", "rattle", "rattles", "quiver", "quivers", "shudder", "terror"]);  // → tremor
const REDACT_WORDS = new Set(["lie", "lies", "lied", "liar", "liars", "hidden", "hide", "hides", "hiding", "classified", "censored", "redacted", "confidential", "forbidden", "conceal", "concealed", "undercover", "encrypted", "incognito", "anonymous", "disguise", "disguised"]);  // → redact
const CHROMA_WORDS = new Set(["dream", "dreams", "dreaming", "dreamed", "dreamt", "nostalgia", "nostalgic", "analog", "vhs", "rewind", "retro", "vintage", "polaroid", "cassette", "flashback", "flashbacks", "déjà", "deja", "haze", "hazy", "blurry"]);  // → chromatic
const LIQUID_WORDS = new Set(["tears", "cry", "cries", "crying", "cried", "weep", "weeping", "wept", "flood", "floods", "flooded", "soak", "soaked", "soaking", "spill", "spills", "spilled", "pour", "pours", "pouring", "overflow", "overflowing", "lágrimas", "llorar", "lloro"]);  // → liquid
const BLEED_WORDS = new Set(["blood", "bloody", "bleed", "bleeds", "bleeding", "bled", "wound", "wounds", "wounded", "scar", "scars", "scarred", "vein", "veins", "bruise", "bruised", "bruises", "hurt", "hurts", "hurting", "pain", "pains", "ache", "aches", "aching", "sangre", "herida"]);  // → bleed
const HANDWRITE_WORDS = new Set(["write", "writes", "writing", "written", "wrote", "letter", "letters", "vow", "vows", "promise", "promises", "promised", "sign", "signed", "signature", "ink", "pen", "poem", "poems", "poetry", "diary", "journal"]);  // → handwrite
const TVOFF_WORDS = new Set(["end", "ends", "ended", "ending", "goodbye", "goodbyes", "farewell", "adios", "adiós", "dead", "death", "die", "dies", "died", "dying"]);  // → tvoff
// normalize for lookup: lowercase, strip possessive ('s / ’s)
const effectKey = (w: string) => w.toLowerCase().replace(/[’']s$/, "");

// framer-motion writes an inline `transform` when it animates ANY transform
// (y/scale/rotate), which REPLACES a Tailwind `-translate-x-1/2` centering class
// wholesale — so centered moment cards drift off to the right. These keep the
// centering by prepending it to motion's generated transform (transformTemplate).
const centerX = (_: unknown, generated: string) => `translateX(-50%) ${generated}`;
const centerXY = (_: unknown, generated: string) => `translate(-50%, -50%) ${generated}`;

// The word a SCREAM moment asks the listener to shout, per song. Explicit when
// the moment carries it in `layer` (unused by scream otherwise — e.g. "I WON'T");
// else the last ALL-CAPS word in the prompt ("SCREAM: GOOOLD!" → GOOOLD); else a
// generic fallback. Cosmetic only — detection is broadband loudness, any shout.
function screamShout(m: { layer?: string; prompt?: string }): string {
  const explicit = (m.layer || "").trim();
  if (explicit) return explicit.toUpperCase();
  const caps = (m.prompt || "").match(/[\p{Lu}][\p{Lu}'’]{2,}/gu);
  return (caps?.length ? caps[caps.length - 1] : "SCREAM").replace(/[^\p{L}'’]/gu, "");
}

// ── Shared art library ──────────────────────────────────────────────────────
// Cross-song paintings for the words the whole catalog keeps singing.
// Used as a backdrop fallback when a planet has no painting of its own for a
// charged or line-final word. Neutral palette; the song's grade tints it.
const SHARED_BASE = `${PLANET_BASE}/planets/_shared`;
// Planet art asset URLs are stored relative ("/planets/<slug>/<w>.webp"); the
// storage reorg moved the files to R2, so prefix the host's PLANET_BASE at
// render. Already-absolute URLs (R2 shared art, Kinetica blobs) pass through.
const planetUrl = (u: string) => (u.startsWith("/planets/") ? PLANET_BASE + u : u);
const SHARED_WORDS = ["night", "love", "world", "time", "heart", "soul", "voice", "dream", "home", "moon", "rain", "city", "sky", "stars", "eyes", "dance", "alone"];
const SHARED_ALIAS: Record<string, string> = { dreams: "dream", nights: "night", hearts: "heart", skies: "sky", star: "stars", cities: "city", corazón: "heart", noche: "night", luna: "moon", cielo: "sky", mundo: "world", alma: "soul", ciudad: "city", ojos: "eyes", lluvia: "rain", sola: "alone", solo: "alone", bailar: "dance", baila: "dance", amor: "love" };
function sharedArtFor(word: string): string | null {
  // Gated on the host: x1c7 ships the shared art library, Kinetica doesn't.
  if (!HAS_SHARED_ART) return null;
  const w = SHARED_ALIAS[word] ?? word;
  return SHARED_WORDS.includes(w) ? `${SHARED_BASE}/${w}.webp` : null;
}

/** True when a track has everything the engine needs to perform. */
export function canPerform(t: Track | null | undefined): boolean {
  return !!t && (t.lyricsSynced?.words?.length ?? 0) > 0;
}

/** Viewing styles (pass 3+). Dynamic = full stagecraft; Focus = the clean
 * centered show; Phrase = the whole line on screen, igniting word by word. */
export type StageMode = "dynamic" | "focus" | "focus+" | "phrase";
export const MODES: { id: StageMode; label: string }[] = [
  { id: "dynamic", label: "✦ Dynamic" },
  { id: "focus+", label: "◉ Focus+" },
  { id: "focus", label: "◎ Focus" },
  { id: "phrase", label: "☰ Phrase" },
];

// Focus / Focus+ keep each word plain and readable — one word at a time, clean
// entrance, no residue stacking. Plain Focus fades out; Focus+ exits with an
// effect (ash rises, dust falls, blow sideways, fly off, burn away).
const FOCUS_IN = {
  initial: { opacity: 0, y: 12, filter: "blur(5px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.3, ease: "easeOut" },
} as const;
const FOCUS_EXIT_PLAIN = { opacity: 0, filter: "blur(3px)", transition: { duration: 0.18 } };
const FOCUS_EXITS = [
  { opacity: 0, y: "-0.75em", scale: 1.12, filter: "blur(9px)", transition: { duration: 0.6, ease: "easeOut" } },   // ash — rises + dissolves
  { opacity: 0, y: "0.8em", filter: "blur(7px)", transition: { duration: 0.6, ease: "easeIn" } },                    // dust/snow — drifts down
  { opacity: 0, x: "1.5em", rotate: 16, filter: "blur(7px)", transition: { duration: 0.5, ease: "easeIn" } },        // blows right
  { opacity: 0, x: "-1.5em", rotate: -16, filter: "blur(7px)", transition: { duration: 0.5, ease: "easeIn" } },      // blows left
  { opacity: 0, y: "-1.1em", x: "0.5em", scale: 0.55, rotate: 12, transition: { duration: 0.46, ease: "easeIn" } },  // flies up-away
  { opacity: 0, color: "#ff6a00", scale: 0.8, filter: "blur(4px)", transition: { duration: 0.52, ease: "easeIn" } }, // burns away (warm + shrink)
];

// Function words render small in dynamic mode so content words own the stage.
const STOP_WORDS = new Set(["the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to", "for", "is", "are", "was", "were", "it", "its", "my", "your", "his", "her", "our", "their", "me", "him", "them", "that", "this", "so", "do", "did", "with", "by", "as", "if", "then", "than", "el", "la", "los", "las", "de", "en", "que", "un", "una", "y", "pa’", "mi", "tu", "se", "lo", "le"]);

// ── The placement mathematics ──────────────────────────────────────────────
// Position: the R2 low-discrepancy sequence (built on the plastic constant).
// Word i lands at (frac(.5+i·a1), frac(.5+i·a2)) mapped over the FULL stage —
// consecutive points are guaranteed ≥ ~17vw/22vh apart, so back-to-back words
// mathematically cannot stack, while coverage stays perfectly even over time.
// Direction: the golden angle (137.508°). Word i enters from angle i·137.508°,
// and within a word letter j adds j·137.508° more — an irrational slice of the
// circle, so no two entrances (word-to-word OR letter-to-letter) ever repeat.
const PLASTIC = 1.32471795724474602596;
const R2X = 1 / PLASTIC, R2Y = 1 / (PLASTIC * PLASTIC);
const GOLDEN = 137.50776405003785;
function stagecraft(idx: number, f: { charged: boolean; final: boolean; mono: boolean; stop: boolean }) {
  const s = (k: number, m: number) => ((idx * 2654435761 + k * 9973) >>> 0) % m;
  const fx = (0.5 + idx * R2X) % 1, fy = (0.5 + idx * R2Y) % 1;
  return {
    x: f.charged ? 0 : (fx * 2 - 1) * 32,                 // vw off-center — full width
    y: f.charged ? 0 : (fy * 2 - 1) * 26,                 // vh off-center — full height
    rot: f.charged ? 0 : s(3, 11) - 5,                    // deg tilt
    size: f.charged ? 1.42 : f.final ? 1.22 : f.stop ? 0.6 : 0.92 + s(4, 4) * 0.09,
    mono: f.mono || (!f.charged && !f.final && s(5, 9) === 0),
    ang: idx * GOLDEN,                                    // entrance direction (deg)
  };
}

// The "director": each emotion gets its own entrance so words MOVE to the feeling.
// A snappy exit shared by all treatments so consecutive words never overlap/smear.
const EXIT_T = { duration: 0.22, ease: "easeIn" };
const MOTION: Record<SectionMotion, Record<string, object>> = {
  still:   { initial: { opacity: 0, scale: 0.94 },        animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.04, transition: EXIT_T },  transition: { duration: 0.9, ease: "easeOut" } },
  drift:   { initial: { opacity: 0, y: 46, scale: 0.92 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -34, transition: EXIT_T }, transition: { duration: 0.75, ease: "easeOut" } },
  // Entrance/exit scales stay ≤ ~1.2: words are clamped to the viewport at
  // scale 1, so bigger multipliers poke fitted words off the screen edge.
  pulse:   { initial: { opacity: 0, scale: 0.58 },        animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.15, transition: EXIT_T },  transition: { type: "spring", stiffness: 330, damping: 21 } },
  surge:   { initial: { opacity: 0, scale: 0.4, y: 22 },  animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 1.2, transition: EXIT_T }, transition: { type: "spring", stiffness: 430, damping: 16, mass: 0.7 } },
  shatter: { initial: { opacity: 0, scale: 1.22, rotate: -3 }, animate: { opacity: 1, scale: 1, rotate: 0 }, exit: { opacity: 0, scale: 0.7, rotate: 2, transition: EXIT_T }, transition: { type: "spring", stiffness: 780, damping: 19, mass: 0.6 } },
};

// Smoothly grade the whole scene to a section's color (via the @property theme vars).
function gradeTo(section: PlanetSection) {
  const th = deriveTheme(section.colorHint);
  const root = document.documentElement.style;
  root.setProperty("--theme-primary", th.primary);
  root.setProperty("--theme-secondary", th.secondary);
  root.setProperty("--theme-accent", th.accent);
  root.setProperty("--theme-bg", th.bg);
}

// ── The single word-effect render map ───────────────────────────────────────
// Every rendered word treatment resolves through here, keyed by its registry
// TextEffect id. One map = one source of truth: a per-word override or a vibe/
// preset can swap any id for another without touching the selector below.
// (freeze/melt/carve are named in the registry but land as components in 2.1.)
// Every TextEffect id renders through exactly one component here — no Exclude,
// no drift. freeze/melt/carve close the last gap between the registry and the stage.
const WORD_FX: Record<TextEffect, (word: string, airtime: number) => ReactNode> = {
  burn: (w, a) => <WordBurn word={w} airtime={a} />,
  glitch: (w, a) => <WordGlitch word={w} airtime={a} />,
  slam: (w) => <WordSlam word={w} />,
  wave: (w, a) => <WordWave word={w} airtime={a} />,
  neon: (w, a) => <WordNeon word={w} airtime={a} />,
  pulse: (w, a) => <WordPulse word={w} airtime={a} />,
  whisper: (w, a) => <WordWhisper word={w} airtime={a} />,
  fizz: (w, a) => <WordFizz word={w} airtime={a} />,
  type: (w, a) => <WordType word={w} airtime={a} />,
  shatter: (w) => <WordShatter word={w} />,
  dissolve: (w) => <WordDissolve word={w} />,
  bloom: (w) => <WordBloom word={w} />,
  freeze: (w, a) => <WordFreeze word={w} airtime={a} />,
  melt: (w, a) => <WordMelt word={w} airtime={a} />,
  carve: (w, a) => <WordCarve word={w} airtime={a} />,
  shimmer: (w, a) => <WordShimmer word={w} airtime={a} />,
  rise: (w, a) => <WordRise word={w} airtime={a} />,
  fall: (w, a) => <WordFall word={w} airtime={a} />,
  echo: (w, a) => <WordEcho word={w} airtime={a} />,
  tremor: (w, a) => <WordTremor word={w} airtime={a} />,
  redact: (w, a) => <WordRedact word={w} airtime={a} />,
  chromatic: (w, a) => <WordChromatic word={w} airtime={a} />,
  liquid: (w, a) => <WordLiquid word={w} airtime={a} />,
  bleed: (w, a) => <WordBleed word={w} airtime={a} />,
  handwrite: (w) => <WordHandwrite word={w} />,
  tvoff: (w, a) => <WordTVOff word={w} airtime={a} />,
};

export function KineticStage({ track, timelineBottomClass = "bottom-[86px]", pass = 3, mode = "phrase", forceParticle, clock, effects, deck }: {
  track: Track;
  /** Tailwind bottom-offset for the arc timeline (differs when the player bar is covered). */
  timelineBottomClass?: string;
  /** Pin the weather layer to a specific mode (undefined = auto from the song). */
  forceParticle?: ParticleMode;
  /** Show version. Each pass is preserved as a "satellite" of the planet;
   * the newest pass is the main show. Pass 1 = the original kinetic cut. */
  pass?: number;
  /** Viewing style (pass 3+): dynamic stagecraft, clean focus, or phrase mode. */
  mode?: StageMode;
  /** Diagnostics only: override the playhead clock (seconds). Lets the perf
   * harness drive the show deterministically with no audio. */
  clock?: () => number;
  /** Live preset/vibe effect biasing. Takes precedence over track.planet.effects
   * — lets the UI bias effects per render without cloning (and re-loading) the
   * whole track on every preset switch. */
  effects?: PlanetEffects;
  /** Director's-deck intensity knobs (all optional, all perf-lite aware). Absent
   * = the stage's own defaults, so the x1c7 show is unaffected.
   *   density  — particle population multiplier (1 = normal)
   *   glow     — extra bloom on the words (0..1 → up to ~0.6em accent drop-shadow)
   *   grain    — film-grain overlay opacity (0..1)
   *   vignette — edge-darkening overlay opacity (0..1) */
  deck?: { density?: number; glow?: number; grain?: number; vignette?: number };
}) {
  const { getCurrentTime: playerTime, setMuffle } = useMusicPlayer();
  const getCurrentTime = clock ?? playerTime;
  // Phone/low-power profile — freezes animated blurs (via body.perf-lite) and
  // drops the heaviest secondary layers. See src/lib/perf.ts.
  const lite = usePerfLite();
  // Mirror into a ref so the per-frame rAF tick reads the CURRENT value without
  // being torn down and rebuilt when the profile resolves after mount.
  const liteRef = useRef(lite);
  useEffect(() => { liteRef.current = lite; }, [lite]);
  const rawWords = track.lyricsSynced!.words!;
  // Aligner mis-anchor guard: before a pause, the aligner pins the NEXT sung
  // word to the start of the silence — so it appears on stage seconds early
  // and "sits there waiting" (owner's words). Real held notes in this catalog
  // run ~1.3–2.2s, so any mid-song word with airtime >2.5s is treated as
  // mis-anchored and re-timed to just before its successor. (The final word
  // of the song has no successor and is left alone.)
  const MAX_HOLD = 2.5;
  const words = useMemo(() => {
    const out = rawWords.map((w) => ({ ...w }));
    for (let i = 0; i < out.length - 1; i++) {
      if (out[i + 1].t - out[i].t > MAX_HOLD) out[i] = { ...out[i], t: out[i + 1].t - 0.45 };
    }
    return out;
  }, [rawWords]);
  const analysis = track.planet?.analysis;
  const sections = analysis?.sections;
  const art = track.planet?.assets?.keywords;
  const sectionArt = track.planet?.assets?.sections;
  // charged word -> its emotion (drives styling + the emotion-glyph fallback)
  const keywordEmotion = useMemo(() => {
    const m: Record<string, string> = {};
    for (const k of analysis?.keywords ?? []) m[k.word.toLowerCase()] = k.emotion;
    return m;
  }, [analysis]);
  // Line boundaries from the LRC: a word is LINE-FINAL when the next word's
  // timestamp starts a new lyric line. Line endings get extra stage presence.
  const lineStarts = useMemo(() => {
    const s = new Set<number>();
    for (const l of parseLyrics(track.lyrics).lines) if (!l.header && l.t != null) s.add(Math.round(l.t * 100));
    return s;
  }, [track.lyrics]);

  const dynamic = pass >= 3 && mode === "dynamic";
  const phrase = pass >= 3 && mode === "phrase";
  const focusMode = pass >= 3 && (mode === "focus" || mode === "focus+"); // one clean word at a time
  const focusFx = pass >= 3 && mode === "focus+";                          // …with an effect on the way out
  // Line ranges (for phrase mode): consecutive word-index spans per lyric line.
  const lineRanges = useMemo(() => {
    const ranges: { s: number; e: number }[] = [];
    let s = 0;
    for (let i = 1; i < words.length; i++) {
      if (lineStarts.has(Math.round(words[i].t * 100))) { ranges.push({ s, e: i - 1 }); s = i; }
    }
    if (words.length) ranges.push({ s, e: words.length - 1 });
    return ranges;
  }, [words, lineStarts]);

  // ── STUTTER RUNS ── when the vocal repeats one word over and over
  // ("push-push-push", "me me me", "on-on-on"), the engine catches the run so
  // the stage can pile the word up until it fills the screen (swipe to clear).
  // A run = >=3 consecutive same tokens, each within 1.4s of the last.
  const stutterRuns = useMemo(() => {
    const runs: { id: number; word: string; times: number[]; start: number; end: number; spots: { x: number; y: number; rot: number; s: number }[] }[] = [];
    let i = 0;
    while (i < words.length) {
      const w = clean(words[i].w).toLowerCase();
      let j = i + 1;
      while (j < words.length && clean(words[j].w).toLowerCase() === w && words[j].t - words[j - 1].t <= 1.4) j++;
      const times = words.slice(i, j).map((x) => x.t);
      if (w.length >= 1 && times.length >= 3) {
        // Precompute scattered screen spots (a jittered grid, shuffled) so the
        // pile fills evenly. Deterministic per run — no per-frame randomness.
        const N = Math.min(26, times.length * 3 + 4);
        const cols = 6, spots: { x: number; y: number; rot: number; s: number }[] = [];
        for (let k = 0; k < N; k++) {
          const seed = ((i + 1) * 2654435761 + k * 40503) >>> 0;
          const cell = (seed >>> 3) % (cols * 5);
          const cx = (cell % cols) / (cols - 1); // 0..1
          const cy = Math.floor(cell / cols) / 4; // 0..1
          spots.push({
            x: 8 + cx * 84 + (((seed >>> 7) % 100) / 100 - 0.5) * 12,
            y: 14 + cy * 66 + (((seed >>> 11) % 100) / 100 - 0.5) * 12,
            rot: (((seed >>> 13) % 34) - 17),
            s: 0.85 + ((seed >>> 17) % 100) / 100 * 1.15,
          });
        }
        runs.push({ id: i, word: clean(words[i].w), times, start: times[0], end: times[times.length - 1], spots });
      }
      i = j > i + 1 ? j : i + 1;
    }
    return runs;
  }, [words]);

  const [idx, setIdx] = useState(-1);
  const [section, setSection] = useState<PlanetSection | null>(null);
  const [bgArt, setBgArt] = useState<string | null>(null);
  // Art gallery: extra paintings per word, grown nightly by the top-up pipeline
  // and hosted on R2 as planets/<slug>/gallery.json. The engine cycles through
  // them so a word never shows the same backdrop twice. Absent/empty = the
  // engine behaves exactly as before (single keyword art + its twin).
  const [gallery, setGallery] = useState<Record<string, string[]> | null>(null);
  const galleryRef = useRef(gallery);
  galleryRef.current = gallery;
  const galleryTurn = useRef(new Map<string, number>());
  // The GRAVITATIONAL FEED: images the owner fed this planet (guided.json on R2)
  // become its guiding star — they drive the backdrop, with the album art as the
  // event horizon (the anchor) and the auto gallery as the secondary satellite.
  // Absent = the engine behaves exactly as before.
  const [guided, setGuided] = useState<string[] | null>(null);
  const guidedRef = useRef(guided);
  guidedRef.current = guided;
  const guidedTurn = useRef(0);
  // Album art = the event horizon. Read defensively — the shared engine can't
  // assume the host's Track carries a cover (Kinetica's doesn't).
  const eventHorizon = (track as { cover?: string }).cover;
  const [showTitle, setShowTitle] = useState(true);
  const [wave, setWave] = useState(0);
  // Art doubling: every painting has a twin (-2.webp). Each time the same
  // image is called back on stage it alternates twins, so the backdrop never
  // replays — assets.alt maps base URL → variant, shared art derives it.
  const altArt = track.planet?.assets?.alt;
  const artPlays = useRef(new Map<string, number>());
  const pickArt = useCallback((url: string) => {
    const n = (artPlays.current.get(url) ?? 0) + 1;
    artPlays.current.set(url, n);
    if (n % 2 === 0) {
      const v = altArt?.[url] ?? (url.startsWith(SHARED_BASE) ? url.replace(/\.webp$/, "-2.webp") : null);
      if (v) return planetUrl(v);
    }
    return planetUrl(url);
  }, [altArt]);
  // Load the song's hosted art gallery (grown by the top-up pipeline). Graceful:
  // 404 / offline → null → the engine falls back to single keyword art.
  useEffect(() => {
    setGallery(null); setGuided(null);
    galleryTurn.current.clear(); guidedTurn.current = 0;
    if (pass < 3 || !PLANET_BASE) return;
    let on = true;
    fetch(`${PLANET_BASE}/planets/${track.id}/gallery.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (on) setGallery((d?.art as Record<string, string[]>) ?? null); })
      .catch(() => {});
    fetch(`${PLANET_BASE}/planets/${track.id}/guided.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!on) return;
        // images entries may be plain URLs (old) or {url} objects (new).
        const raw = (d?.images ?? []) as (string | { url?: string })[];
        const imgs = raw.map((x) => (typeof x === "string" ? x : x?.url)).filter(Boolean) as string[];
        // Anchor the guided star to the album-art event horizon.
        setGuided(imgs.length ? (eventHorizon ? [eventHorizon, ...imgs] : imgs) : null);
      })
      .catch(() => {});
    return () => { on = false; };
  }, [track.id, eventHorizon, pass]);
  // Rotate through [base, ...gallery variants] for a word so backdrops vary.
  const pooledArt = useCallback((w: string, base: string | null): string | null => {
    // Guided (fed) art is the star — it drives the backdrop; the word's own art
    // punctuates it every 3rd change (or whenever there's no word art).
    const star = guidedRef.current;
    if (star?.length) {
      const t = guidedTurn.current++;
      if (!base || t % 3 !== 0) return star[t % star.length];
    }
    const extra = galleryRef.current?.[w];
    if (!extra?.length) return base;
    const pool = base ? [base, ...extra] : extra;
    const n = galleryTurn.current.get(w) ?? 0;
    galleryTurn.current.set(w, n + 1);
    return pool[n % pool.length];
  }, []);
  // The weather layer — song-matched particles between backdrop and words.
  const particles = useRef<ParticleHandle>(null);
  const particleMode = useMemo(() => {
    if (forceParticle) return forceParticle;
    const a = track.planet?.analysis;
    return particleModeFor([
      a?.overallMood, ...(a?.themes ?? []), ...(a?.keywords?.map((k) => k.word) ?? []),
      track.mood, track.genre, track.title,
    ].filter(Boolean).join(" "));
  }, [track, forceParticle]);
  const palette = useMemo(() => {
    const pal = track.planet?.analysis?.palette;
    return Array.isArray(pal) && pal.length ? pal : [track.color];
  }, [track]);
  // The surface layer — mud/rust/cracks/vines creeping in, if the song's
  // vocabulary calls for one (null = clean glass, most songs).
  const surfaceMode = useMemo(() => {
    const a = track.planet?.analysis;
    return surfaceFor([
      a?.overallMood, ...(a?.themes ?? []), ...(a?.keywords?.map((k) => k.word) ?? []),
      track.mood, track.title,
    ].filter(Boolean).join(" "));
  }, [track]);
  // Lexicon-first: consult the pre-generated word shelf too. When the song's own
  // regex finds no surface, the Lexicon's aggregated legos still might — proof of
  // the "no LLM at render time" path. Loads lazily; degrades to null.
  const [lex, setLex] = useState<Lexicon | null>(null);
  useEffect(() => { let on = true; loadLexicon().then((l) => on && setLex(l)).catch(() => {}); return () => { on = false; }; }, []);
  const lexSurface = useMemo<SurfaceMode | null>(() => {
    if (!lex) return null;
    const words = [...(track.planet?.analysis?.keywords?.map((k) => k.word) ?? []), ...(track.title?.split(/\s+/) ?? [])];
    const agg = aggregateLegos(lex, words);
    // Only trust a surface the client's registry actually knows how to render —
    // the hosted shelf may name a mode this build doesn't have yet.
    return (agg.surface.find((m) => m in SURFACE_SPECS) as SurfaceMode) ?? null;
  }, [lex, track]);
  // A preset/vibe can force a surface (or "none"); else the lyric-derived pick.
  const cfgSurface = (effects ?? track.planet?.effects)?.surface;
  const effectiveSurface = cfgSurface !== undefined
    ? (cfgSurface === "none" ? null : cfgSurface)
    : (surfaceMode ?? lexSurface);
  // ── STEM SENSES ── measured hearing from the planet's stems.json (if any).
  // Kicks thump the halo, snares ring, hats glint the weather, the bass bends
  // the type, the singer's real energy sizes each word, drum-cuts freeze the
  // world to silhouette, and risers charge a supernova that detonates on the
  // drop. Playback stays one mp3 — the stems were analyzed offline.
  const [stems, setStems] = useState<StemData | null>(null);
  const stemTrk = useRef<{ kick: OnsetTracker; snare: OnsetTracker; hat: OnsetTracker; beat: OnsetTracker } | null>(null);
  const kickPulse = useRef(0);
  const lastStemT = useRef(0);
  // PHASE 5 cinematic camera: the current section's energy drives the dolly push.
  const camPush = useRef(0.35);
  const [cutMode, setCutMode] = useState(false);
  const cutRef = useRef<[number, number] | null>(null);
  const riserRef = useRef<{ t: number; end: number } | null>(null);
  const [nova, setNova] = useState(0);
  useEffect(() => {
    setStems(null);
    stemTrk.current = null;
    setCutMode(false);
    if (pass < 3) return;
    const url = (track.planet?.assets as { stems?: string } | undefined)?.stems;
    if (!url) return;
    let on = true;
    loadStems(url).then((d) => {
      if (!on || !d) return;
      setStems(d);
      stemTrk.current = {
        kick: new OnsetTracker(d.kicks), snare: new OnsetTracker(d.snares),
        hat: new OnsetTracker(d.hats), beat: new OnsetTracker(d.beats),
      };
    });
    return () => { on = false; };
  }, [track.id, track.planet, pass]);
  // Pulse rings: landing ripples for charged/final words + beat-synced rings.
  const [pulseRings, setPulseRings] = useState<{ id: number; big: boolean }[]>([]);
  const pulseId = useRef(0);
  const spawnRing = useCallback((big: boolean) => {
    const id = ++pulseId.current;
    setPulseRings((r) => [...r.slice(-3), { id, big }]);
  }, []);
  const lastBeatSeen = useRef(0);
  const beatN = useRef(0);
  // Anchor word: a charged or line-closing word that arrives HUGE and lingers
  // translucently behind the following words. mode: 0 slide, 1 zoom, 2 rise.
  const [anchor, setAnchor] = useState<{ word: string; key: number; fromX: string; rot: number; mode: number } | null>(null);
  // Interactivity: tap a word and it reacts in THIS SONG'S language — the
  // choreographer LLM picked the effect per planet. (Stale indices go inert
  // on their own when the song moves to the next word.)
  const [touchBurn, setTouchBurn] = useState(-1);
  // Pile layer colors — 3 distinct hues from the song's own palette (the live
  // word owns the primary), so every layer of the stack reads separately.
  const layerColors = useMemo(() => {
    const pal = track.planet?.analysis?.palette as unknown;
    const arr: string[] = Array.isArray(pal)
      ? (pal as string[])
      : pal && typeof pal === "object"
        ? Object.values(pal as Record<string, string>)
        : [];
    const a = arr[1] || "var(--theme-secondary)";
    const b = arr[2] || "var(--theme-accent)";
    return [a, b, `color-mix(in srgb, ${b} 45%, white)`];
  }, [track.planet]);
  // Hold-to-charge: press and hold a word to charge it up — release for a
  // supersized burst (shockwave + stronger haptic).
  const [charging, setCharging] = useState(false);
  const chargeAt = useRef(0);
  // ── THE PILE: recent words stay on stage as grabbable, throwable toys ──
  // Positions are captured in px (measured) when the live word retires, so a
  // residue stays EXACTLY where its word actually stood. Max 3 layers, each
  // wearing a different palette color so the stack reads clearly.
  const [residue, setResidue] = useState<{ key: number; word: string; cx: number; cy: number; fs: number; rot: number; mono: boolean; layer: number; bornAt: number; dying?: boolean }[]>([]);
  const lastRendered = useRef<{ key: number; word: string; rot: number; mono: boolean } | null>(null);
  const layerSeq = useRef(0);
  const resCheck = useRef(0);
  // Physics: positions/velocities in refs, written straight to the DOM via
  // the CSS `translate` property (never touches framer's transform channel).
  const wordEls = useRef(new Map<number, HTMLElement>());
  const phys = useRef(new Map<number, { x: number; y: number; vx: number; vy: number; grab: boolean }>());
  const dragRef = useRef<{ key: number; lx: number; ly: number; lt: number } | null>(null);
  const dragMoved = useRef(false);

  // ── WORD PILEUP ── repeated-word chips that stack up and fill the screen on
  // a stutter run, cleared by swiping a finger across them.
  const [pile, setPile] = useState<{ id: number; word: string; x: number; y: number; rot: number; s: number; fx: number; fy: number; fr: number }[]>([]);
  const pileId = useRef(0);
  const pileRun = useRef(-1);   // id of the run currently piling
  const pileEmit = useRef(0);   // chips emitted so far this run
  useEffect(() => { setPile([]); pileRun.current = -1; pileEmit.current = 0; }, [track.id]);
  // Swipe across the pile to knock the chips away — any chip within the finger's
  // reach is removed and flings out (its fling vector was set when it landed).
  const pileSwipe = useCallback((e: React.PointerEvent) => {
    if (!pile.length) return;
    const R = window.innerWidth * 0.15;
    setPile((old) => old.filter((p) => {
      const px = (p.x / 100) * window.innerWidth, py = (p.y / 100) * window.innerHeight;
      return Math.hypot(px - e.clientX, py - e.clientY) > R;
    }));
  }, [pile.length]);
  // ── BEAT GAME: tap the stage on the beat, build a streak ──
  const beatDefault = mode !== "phrase"; // phrase mode: off by default, available
  const [beatOverride, setBeatOverride] = useState<string | null>(null);
  useEffect(() => { setBeatOverride(localStorage.getItem("x1c7-beat-game")); }, []);
  const beatOn = beatOverride ? beatOverride === "on" : beatDefault;
  const [streak, setStreak] = useState(0);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; hit: boolean }[]>([]);
  const rippleId = useRef(0);
  useEffect(() => { setStreak(0); beatClock.reset(); setResidue([]); phys.current.clear(); }, [track.id]);
  const toggleBeat = () => {
    const next = beatOn ? "off" : "on";
    localStorage.setItem("x1c7-beat-game", next);
    setBeatOverride(next);
    if (beatOn) setStreak(0);
  };
  // Stage taps: double-tap = FIREWORK (particle burst + shockwave at the tap
  // point), and every tap is scored against the live beat clock when the beat
  // game is on. Off-beat taps reset the streak; NOT tapping never does.
  const lastStageTap = useRef(0);
  const scoreTap = (e: React.PointerEvent) => {
    if (pass < 3) return;
    const t = e.target as HTMLElement;
    if (t.closest("button") || t.closest("[title*='Emotional']")) return;
    const nowT = performance.now();
    if (nowT - lastStageTap.current < 340) {
      lastStageTap.current = 0;
      particles.current?.burst(e.clientX, e.clientY, 80);
      setWave((w) => w + 1);
      navigator.vibrate?.([10, 30, 10]);
    } else lastStageTap.current = nowT;
    if (!beatOn) return;
    const off = beatClock.offBy(nowT);
    if (off === Infinity) return;
    const win = Math.max(90, beatClock.interval * 0.15);
    const hit = off <= win;
    if (hit) {
      navigator.vibrate?.(12);
      setStreak((sv) => {
        const ns = sv + 1;
        if (ns === 8 || ns === 16 || ns === 32 || ns === 64) {
          // Milestone: shockwave + a particle storm from the heart of the stage.
          setWave((w) => w + 1);
          particles.current?.burst(window.innerWidth / 2, window.innerHeight / 2, 40 + ns * 2);
          navigator.vibrate?.([20, 40, 20]);
        }
        return ns;
      });
    } else setStreak(0);
    const id = ++rippleId.current;
    setRipples((r) => [...r.slice(-5), { id, x: e.clientX, y: e.clientY, hit }]);
  };
  // Swipe comet: dragging a finger across open stage combs a glowing trail
  // through the weather layer (word drags are handled by their own physics).
  const stageMove = (e: React.PointerEvent) => {
    if (pass < 3 || !e.buttons || dragRef.current) return;
    particles.current?.trail(e.clientX, e.clientY, e.movementX, e.movementY);
  };
  // Grab & fling: any pile word follows the finger; release throws it.
  const grabStart = (key: number) => (e: React.PointerEvent) => {
    if (pass < 3) return;
    const pv = phys.current.get(key) ?? { x: 0, y: 0, vx: 0, vy: 0, grab: false };
    pv.grab = true; pv.vx = 0; pv.vy = 0;
    phys.current.set(key, pv);
    dragRef.current = { key, lx: e.clientX, ly: e.clientY, lt: performance.now() };
    dragMoved.current = false;
  };
  useEffect(() => {
    if (pass < 3) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current; if (!d) return;
      const pv = phys.current.get(d.key); if (!pv) return;
      const dx = e.clientX - d.lx, dy = e.clientY - d.ly;
      if (Math.abs(dx) + Math.abs(dy) > 10) dragMoved.current = true;
      pv.x += dx; pv.y += dy;
      const now = performance.now(); const dt = Math.max(8, now - d.lt);
      pv.vx = (dx / dt) * 800; pv.vy = (dy / dt) * 800;
      d.lx = e.clientX; d.ly = e.clientY; d.lt = now;
      const el = wordEls.current.get(d.key);
      if (el) el.style.translate = `${pv.x}px ${pv.y}px`;
    };
    const up = () => { const d = dragRef.current; if (!d) return; const pv = phys.current.get(d.key); if (pv) pv.grab = false; dragRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [pass]);
  const interactions = track.planet?.interactions;
  const tapFx = interactions?.tapEffect ?? "dissolve";
  // Preset/vibe effect biasing + per-word overrides (both optional). A live
  // `effects` prop (preset UI) wins over the planet's persisted config; when
  // neither is set the stage's own word-matching drives everything. PHASE 4:
  // the effect-bias seam (per-word overrides + preset allow/surface) is part of
  // the Kinetica upgrade, so it only engages at pass >= 4 — passes 1-3 render
  // with the engine's own natural picks, as they did before.
  const effectsCfg = pass >= 4 ? (effects ?? track.planet?.effects) : undefined;
  // MORE moments: beyond the LLM-choreographed ones, the engine reads the song
  // itself — the longest instrumental gap becomes a wipe, the biggest intensity
  // jump gets a blow (arrive the drop on a breath), the wildest section a shake.
  // Synthesized moments never collide with choreographed ones (±8s buffer).
  const wipeVeil = veilForWeather(particleMode);
  const allMoments = useMemo(() => {
    const out = [...(interactions?.moments ?? [])];
    const free = (t: number, end: number) => !out.some((m) => t < m.end + 8 && end > m.t - 8) && t > 12;
    // wipe: the longest sung-word gap (an instrumental break) ≥ 7s
    let gap = { len: 0, t: 0 };
    for (let i = 0; i < words.length - 1; i++) {
      const l = words[i + 1].t - words[i].t;
      if (l > gap.len) gap = { len: l, t: words[i].t + 1.4 };
    }
    if (gap.len >= 7 && free(gap.t, gap.t + Math.min(gap.len - 2.5, 10))) {
      out.push({ t: gap.t, end: gap.t + Math.min(gap.len - 2.5, 10), type: "wipe", layer: wipeVeil, prompt: `wipe the ${wipeVeil} away` });
    }
    if (sections?.length) {
      // blow: the sharpest intensity RISE — blow the drop in, just before it hits
      let rise = { d: 0, at: 0 };
      for (let i = 0; i < sections.length - 1; i++) {
        const d = sections[i + 1].intensity - sections[i].intensity;
        if (d > rise.d) rise = { d, at: sections[i + 1].start };
      }
      if (rise.d >= 0.25 && rise.at > 18 && free(rise.at - 6, rise.at - 0.5)) {
        out.push({ t: rise.at - 6, end: rise.at - 0.5, type: "blow", layer: "", prompt: "blow the drop in" });
      }
      // shake: the most intense section of the song
      const peak = [...sections].sort((a, b) => b.intensity - a.intensity)[0];
      if (peak && peak.intensity >= 0.72 && free(peak.start + 1, peak.start + 7)) {
        out.push({ t: peak.start + 1, end: peak.start + 7, type: "shake", layer: "", prompt: "shake it loose" });
      }
    }
    return out.sort((a, b) => a.t - b.t);
  }, [interactions, sections, words, wipeVeil]);
  // Choreographed wipe moments (also from the planet's interaction data).
  const [wipe, setWipe] = useState<{ layer: string; prompt: string } | null>(null);
  const wipeKey = useRef(-1);
  // Once a veil is wiped to release, its moment is "consumed" so the per-frame
  // loop (still inside the moment's time window) doesn't bring the fog back.
  const consumedWipe = useRef(-1);
  // The veil covers the SOUND too: a partial muffle when it rolls in, fully
  // restored by the time the listener has wiped ~a third away. Always cleared
  // on moment end/unmount.
  useEffect(() => {
    setMuffle(wipe ? 0.7 : 0);
    return () => setMuffle(0);
  }, [wipe, setMuffle]);
  const onWipeProgress = useCallback((cleared: number) => {
    // Sound is fully back by 33% cleared (the release point).
    setMuffle(Math.max(0, 0.7 * (1 - cleared / 0.33)));
  }, [setMuffle]);
  const onWipeReleased = useCallback(() => {
    consumedWipe.current = wipeKey.current;
    setMuffle(0);
    setWipe(null); // AnimatePresence exit dissolves the rest of the veil
  }, [setMuffle]);
  // Choreographed blow moments + the gust they trigger.
  const [blow, setBlow] = useState<{ prompt: string } | null>(null);
  const blowKey = useRef(-1);
  // Choreographed shake moments: a window where shaking the phone pays off big.
  const [shakeMo, setShakeMo] = useState<{ prompt: string } | null>(null);
  const shakeMoKey = useRef(-1);
  const shakeDone = useRef(false);
  // Choreographed SCREAM moments: shout into the mic (e.g. "GOOOLD" on the
  // chorus) and detonate a gold supernova. Broadband mic loudness, high bar.
  const [scream, setScream] = useState<{ prompt: string; shout: string } | null>(null);
  const screamKey = useRef(-1);
  const [gust, setGust] = useState(0);
  // Shake-to-scatter: a real phone shake rattles the stage and the current
  // word reacts in the song's own tap language.
  const [quake, setQuake] = useState(0);
  const anchorAt = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastWord = useRef(-1);
  const lastSec = useRef<string>("");
  // PHASE 5: when an earlier phase is selected, snap the cinematic camera back
  // to identity (the pass >= 5 tick stops writing --cam, so clear it here).
  useEffect(() => {
    if (pass >= 5) return;
    const r = rootRef.current;
    r?.style.setProperty("--cam-scale", "1");
    r?.style.setProperty("--cam-x", "0px");
    r?.style.setProperty("--cam-y", "0px");
    r?.style.setProperty("--cam-rot", "0deg");
  }, [pass]);
  const titleRef = useRef(true);

  // ── Motion senses (pass 3+) ────────────────────────────────────────────
  // Tilt parallax: the backdrop painting and anchor drift opposite the
  // device tilt (or mouse on desktop) — the world gains depth. Written as
  // CSS vars straight onto the root (zero React re-renders).
  useEffect(() => {
    if (pass < 3) return;
    const root = rootRef.current;
    if (!root) return;
    const set = (x: number, y: number) => {
      root.style.setProperty("--par-x", `${x.toFixed(1)}px`);
      root.style.setProperty("--par-y", `${y.toFixed(1)}px`);
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      set(Math.max(-14, Math.min(14, -e.gamma * 0.6)), Math.max(-10, Math.min(10, -(e.beta - 40) * 0.35)));
    };
    const onMouse = (e: MouseEvent) => {
      set((0.5 - e.clientX / window.innerWidth) * 22, (0.5 - e.clientY / window.innerHeight) * 14);
    };
    window.addEventListener("deviceorientation", onTilt);
    window.addEventListener("mousemove", onMouse);
    // iOS: motion sensors need a permission request from a user gesture —
    // piggyback on the first tap anywhere in the show.
    const askMotion = () => {
      type MotionCtor = { requestPermission?: () => Promise<string> };
      const dm = DeviceMotionEvent as unknown as MotionCtor;
      const dov = DeviceOrientationEvent as unknown as MotionCtor;
      dm.requestPermission?.().catch(() => {});
      dov.requestPermission?.().catch(() => {});
      window.removeEventListener("pointerdown", askMotion);
    };
    window.addEventListener("pointerdown", askMotion);
    // Shake detection: spikes in acceleration delta, with a cooldown.
    let lx = 0, ly = 0, lz = 0, energy = 0, cooldownUntil = 0;
    const onShake = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null || g.y == null || g.z == null) return;
      const d = Math.abs(g.x - lx) + Math.abs(g.y - ly) + Math.abs(g.z - lz);
      lx = g.x; ly = g.y; lz = g.z;
      energy = energy * 0.9 + d;
      const now = Date.now();
      if (energy > 55 && now > cooldownUntil) {
        cooldownUntil = now + 2500;
        energy = 0;
        navigator.vibrate?.(70);
        setQuake((q) => q + 1);
      }
    };
    window.addEventListener("devicemotion", onShake);
    return () => {
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("devicemotion", onShake);
      window.removeEventListener("pointerdown", askMotion);
    };
  }, [pass]);
  // A gust (blow moment payoff) sweeps the weather layer sideways too.
  useEffect(() => {
    if (gust > 0) particles.current?.gust(gust % 2 ? 1 : -1);
  }, [gust]);
  // A shake scatters the current word in the song's own tap language —
  // and during a choreographed shake moment it pays off BIG (full gust).
  useEffect(() => {
    if (quake === 0) return;
    particles.current?.quake();
    if (lastWord.current >= 0) setTouchBurn(lastWord.current);
    if (shakeMo && !shakeDone.current) {
      shakeDone.current = true;
      setGust((g) => g + 1);
      setWave((w) => w + 1);
      navigator.vibrate?.([30, 60, 30, 60]);
      setShakeMo(null);
    }
  }, [quake, shakeMo]);
  // …and physically rattles the stage (CSS animation, retriggered per shake).
  useEffect(() => {
    if (!quake) return;
    const el = stageRef.current;
    if (!el) return;
    el.classList.remove("kinetic-quake");
    void el.offsetWidth; // reflow so the animation restarts
    el.classList.add("kinetic-quake");
    const to = setTimeout(() => el.classList.remove("kinetic-quake"), 650);
    return () => clearTimeout(to);
  }, [quake]);

  // One rAF drives the active word (re-render on change) and the current section:
  // on a new section we color-grade the scene + set the emotional-intensity var.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const t = getCurrentTime();
      let i = activeWordIndex(words, t);
      // Dwell cap: during a long instrumental pause the last sung word (which
      // now owns the whole gap after re-anchoring) bows out instead of
      // sitting on stage — the show breathes, then the next word arrives on cue.
      if (i >= 0 && i < words.length - 1) {
        const air = words[i + 1].t - words[i].t;
        if (air > 3.4 && t - words[i].t > 3.2) i = -1;
      }
      if (i !== lastWord.current) {
        lastWord.current = i; setIdx(i);
        // The outgoing word joins the pile (max 3 residues + the live word).
        // Its true on-stage position + font size are measured off the DOM so
        // the residue takes over without a pixel of drift.
        if (pass >= 3 && mode === "dynamic" && lastRendered.current && lastRendered.current.key !== i) {
          const lr = lastRendered.current;
          lastRendered.current = null;
          const el = wordEls.current.get(lr.key);
          if (el && el.offsetParent) {
            const r: (typeof residue)[number] = {
              ...lr,
              cx: el.offsetLeft + el.offsetWidth / 2,
              cy: el.offsetTop + el.offsetHeight / 2,
              fs: parseFloat(getComputedStyle(el).fontSize),
              layer: layerSeq.current++ % 3,
              bornAt: performance.now(),
            };
            // Beyond 3 layers, the oldest fades out (marked dying, removed
            // when its fade completes) — never an instant pop.
            setResidue((old) => {
              const next = [...old.filter((o) => o.key !== r.key), r];
              const active = next.filter((x) => !x.dying);
              if (active.length <= 3) return next;
              const drop = new Set(active.slice(0, active.length - 3).map((x) => x.key));
              return next.map((x) => (drop.has(x.key) ? { ...x, dying: true } : x));
            });
          }
        }
        // Keyword art: when a charged word with a painting lands, it takes the
        // backdrop over the section mood art until the scene changes again.
        // Planet-specific art wins; the SHARED library covers cross-song words
        // — but only at emphasis moments (charged or line-final), so common
        // words don't churn the backdrop mid-line.
        if (i >= 0) {
          const w = clean(words[i].w).toLowerCase();
          const own = pooledArt(w, art?.[w] ?? null);
          const isFinal = words[i + 1] ? lineStarts.has(Math.round(words[i + 1].t * 100)) : true;
          const air = words[i + 1] ? words[i + 1].t - words[i].t : 3;
          if (own) setBgArt(pickArt(own));
          else if (pass >= 2) {
            const emphasis = isFinal || w in keywordEmotion;
            const sh = emphasis ? sharedArtFor(effectKey(w)) : null;
            if (sh) setBgArt(pickArt(sh));
          }
          // Anchor: charged words always take over the sky; line-closing words
          // with presence join them (rate-limited so anchors breathe).
          if (pass >= 3 && mode === "dynamic") {
            const charged = w in keywordEmotion;
            const worthy = isFinal && air >= 0.75 && clean(words[i].w).length >= 4 && t - anchorAt.current > 3.5;
            if (charged || worthy) {
              const shownW = clean(words[i].w);
              const sd = ((i * 2654435761) >>> 0);
              anchorAt.current = t;
              setAnchor({ word: shownW, key: i, fromX: sd % 2 ? "42vw" : "-42vw", rot: (sd % 17) - 8, mode: sd % 3 });
            }
          }
          // Landing ripple: emphasis words hit the stage with a ring (all modes).
          if (pass >= 3) {
            if (w in keywordEmotion) spawnRing(true);
            else if (isFinal && air >= 0.6) spawnRing(false);
          }
        }
      }
      // Anchor expiry — it hangs around for ~7s, then dissolves.
      if (anchorAt.current && t - anchorAt.current > 7) { anchorAt.current = 0; setAnchor(null); }
      // Pileup: while a stutter run plays, stack a chip for each repeat (×3 so
      // it fills fast). Clears ~2.6s after the last repeat, or on swipe.
      if (pass >= 3) {
        const run = stutterRuns.find((r) => t >= r.start - 0.06 && t <= r.end + 2.6);
        if (run) {
          if (pileRun.current !== run.id) { if (pileRun.current !== -1) setPile([]); pileRun.current = run.id; pileEmit.current = 0; }
          const target = Math.min(run.spots.length, run.times.filter((tt) => tt <= t + 0.03).length * 3);
          if (pileEmit.current < target) {
            const add: (typeof pile) = [];
            while (pileEmit.current < target) {
              const sp = run.spots[pileEmit.current++];
              // fling vector points outward from centre, so swiped/cleared chips scatter off-screen.
              add.push({ id: pileId.current++, word: run.word, x: sp.x, y: sp.y, rot: sp.rot, s: sp.s, fx: (sp.x - 50) * 14, fy: (sp.y - 45) * 14, fr: sp.rot * 2 });
            }
            setPile((old) => (old.length >= 34 ? old : [...old, ...add].slice(-34)));
          }
        } else if (pileRun.current !== -1) {
          pileRun.current = -1;
          setPile([]);
        }
      }
      // Fling physics: integrate free-flying pile words, bounce off edges.
      const nowP = performance.now();
      phys.current.forEach((pv, k) => {
        if (pv.grab || (Math.abs(pv.vx) < 10 && Math.abs(pv.vy) < 10)) return;
        pv.x += pv.vx / 60; pv.y += pv.vy / 60;
        pv.vx *= 0.965; pv.vy *= 0.965;
        const bx = window.innerWidth * 0.44, by = window.innerHeight * 0.38;
        if (Math.abs(pv.x) > bx) { pv.x = Math.sign(pv.x) * bx; pv.vx *= -0.62; }
        if (Math.abs(pv.y) > by) { pv.y = Math.sign(pv.y) * by; pv.vy *= -0.62; }
        const el = wordEls.current.get(k);
        if (el) el.style.translate = `${pv.x}px ${pv.y}px`;
      });
      // Pile expiry: after ~8s a residue starts dying (fades, then removes
      // itself on animation complete) unless held or still flying. The 12s
      // hard-remove is a safety net in case a fade callback never lands.
      if (nowP - resCheck.current > 800) {
        resCheck.current = nowP;
        setResidue((old) => {
          if (!old.length) return old;
          let changed = false;
          const next = old
            .filter((r) => {
              const gone = nowP - r.bornAt > 12000;
              if (gone) changed = true;
              return !gone;
            })
            .map((r) => {
              if (r.dying) return r;
              const pv = phys.current.get(r.key);
              const busy = pv && (pv.grab || Math.abs(pv.vx) + Math.abs(pv.vy) > 20);
              if (!busy && nowP - r.bornAt > 8000) { changed = true; return { ...r, dying: true }; }
              return r;
            });
          return changed ? next : old;
        });
      }
      // Beat rings: every second detected beat sends a circle through the stage.
      if (pass >= 3 && beatClock.ready && beatClock.lastBeatAt !== lastBeatSeen.current) {
        lastBeatSeen.current = beatClock.lastBeatAt;
        if (++beatN.current % 2 === 0) spawnRing(false);
      }
      // Choreographed + synthesized moment windows: enter/leave the moment.
      if (pass >= 3 && allMoments.length) {
        const mo = allMoments.find((mm) => mm.type === "wipe" && t >= mm.t && t < mm.end);
        const key = mo ? mo.t : -1;
        if (key !== wipeKey.current) {
          wipeKey.current = key;
          // Don't re-raise a veil the listener already wiped away this window.
          setWipe(mo && consumedWipe.current !== key ? { layer: mo.layer, prompt: mo.prompt } : null);
        }
        const bo = allMoments.find((mm) => mm.type === "blow" && t >= mm.t && t < mm.end);
        const bkey = bo ? bo.t : -1;
        if (bkey !== blowKey.current) {
          blowKey.current = bkey;
          setBlow(bo ? { prompt: bo.prompt } : null);
        }
        const so = allMoments.find((mm) => mm.type === "shake" && t >= mm.t && t < mm.end);
        const skey = so ? so.t : -1;
        if (skey !== shakeMoKey.current) {
          shakeMoKey.current = skey;
          shakeDone.current = false;
          setShakeMo(so ? { prompt: so.prompt } : null);
        }
        const cro = allMoments.find((mm) => mm.type === "scream" && t >= mm.t && t < mm.end);
        const crkey = cro ? cro.t : -1;
        if (crkey !== screamKey.current) {
          screamKey.current = crkey;
          setScream(cro ? { prompt: cro.prompt, shout: screamShout(cro) } : null);
        }
      }
      // ── STEM SENSES per-frame ── the measured song drives the stage live.
      if (stems && stemTrk.current) {
        const trk = stemTrk.current;
        const root = rootRef.current;
        // The live mix (stem bus): a muted instrument takes its visuals with
        // it — kill the drums and the kick-thumps, rings and beat-cuts die
        // too. All 1 while the mastered mp3 plays (every instrument present).
        const vg = (s: Parameters<typeof stemMixStore.visualGain>[0]) => stemMixStore.visualGain(s);
        const drumsG = vg("drums");
        // Beat grid → the beat game's clock locks to the real grid.
        if (trk.beat.consume(t) > 0) beatClock.record(performance.now());
        // Kicks thump (decaying --kick var), snares ring, hats glint.
        const dt2 = Math.max(0, Math.min(0.1, t - lastStemT.current));
        lastStemT.current = t;
        kickPulse.current = Math.max(0, kickPulse.current - dt2 * 5);
        if (trk.kick.consume(t) > 0 && drumsG > 0.35) { kickPulse.current = drumsG; }
        if (trk.snare.consume(t) > 0 && drumsG > 0.35 && !document.hidden) spawnRing(false);
        const hatN = trk.hat.consume(t);
        if (hatN > 0 && Math.max(drumsG, vg("perc")) > 0.35) particles.current?.glint(6 + hatN * 4);
        // These four drive audio-reactive micro-motion (stage bend, word glow,
        // ghost chorus, halo). On LITE every one of their consumers is already
        // frozen to a constant (perf-lite) or unrendered (the ghost layer is
        // !lite-gated) — but writing a custom property on :root still forces a
        // style recalc of every element whose cascade *references* it, ~160ms/s
        // of pure waste at 60fps. So on lite we simply don't write them: zero
        // visual change, the single biggest style cost on a stem'd planet gone.
        // (--charge stays — its riser vignette DOES render on lite.)
        if (root && !liteRef.current) {
          root.style.setProperty("--kick", kickPulse.current.toFixed(3));
          root.style.setProperty("--bass", (envAt(stems, "bass", t) * vg("bass")).toFixed(3));
          root.style.setProperty("--voice", (envAt(stems, "lead", t) * vg("lead")).toFixed(3));
          root.style.setProperty("--choir", (envAt(stems, "back", t) * vg("back")).toFixed(3));
        }
        // Beat-cut blackout: drums vanish → the world freezes to silhouette;
        // drums return → slam back with a shockwave. (Meaningless while the
        // listener has the drums muted — the drums are ALWAYS gone then.)
        const cut = t >= 1 && drumsG > 0.35 ? activeCut(stems, t) : null;
        if (!!cut !== !!cutRef.current) {
          cutRef.current = cut;
          setCutMode(!!cut);
          particles.current?.freeze(!!cut);
          if (!cut) {
            setWave((w) => w + 1);
            particles.current?.burst(window.innerWidth / 2, window.innerHeight / 2, 70);
            navigator.vibrate?.([20, 30, 40]);
          }
        }
        // Riser → implosion charge → SUPERNOVA exactly on the drop. The ramp
        // lives in the melodic bed — muted bed, no charge, no detonation.
        const bedG = Math.max(vg("synth"), vg("other"), vg("guitar"), vg("keys"));
        const riser = bedG > 0.3 ? activeRiser(stems, t) : null;
        if (riser && !riserRef.current) riserRef.current = riser;
        if (riserRef.current) {
          const r = riserRef.current;
          const p = Math.max(0, Math.min(1, (t - r.t) / Math.max(0.5, r.end - r.t)));
          root?.style.setProperty("--charge", (t < r.end ? p : 0).toFixed(3));
          if (t < r.end) particles.current?.implode(0.25 + p * 0.75);
          if (t >= r.end || t < r.t - 0.5) {
            riserRef.current = null;
            root?.style.setProperty("--charge", "0");
            if (t >= r.end && t < r.end + 1.5) {
              setNova((n) => n + 1);
              setWave((w) => w + 1);
              particles.current?.burst(window.innerWidth / 2, window.innerHeight / 2, 150);
              navigator.vibrate?.([30, 40, 80]);
            }
          }
        }
      }
      // Title card: only before the first sung word.
      const titled = words.length > 0 && t < words[0].t - 0.2;
      if (titled !== titleRef.current) { titleRef.current = titled; setShowTitle(titled); }
      if (sections?.length) {
        const s = activeSection(sections, t);
        const key = s ? `${s.name}${s.start}` : "";
        if (key !== lastSec.current) {
          lastSec.current = key;
          setSection(s);
          if (s) {
            gradeTo(s);
            camPush.current = s.intensity;
            stageRef.current?.style.setProperty("--emo", String(s.intensity));
            const mood = sectionArt?.[s.emotion.toLowerCase()];
            if (mood) setBgArt(pickArt(mood));
            // Pass 2: big scene changes send a shockwave through the stage.
            if (pass >= 2 && s.intensity >= 0.7) setWave((w) => w + 1);
          }
        }
      }
      // ── PHASE 5: the cinematic camera ── a slow directed dolly. It pushes in
      // with the section's energy, breathes on the kick, and drifts forever on
      // two out-of-phase sines so the frame never sits still. Gated to pass >= 5;
      // a reset effect returns it to identity when an earlier phase is selected.
      const camRoot = rootRef.current;
      if (camRoot && pass >= 5) {
        const push = camPush.current;                                  // 0..1 section energy
        const beat = liteRef.current ? 0 : kickPulse.current;          // live kick punch
        const scale = 1 + push * 0.13 + beat * 0.03;                   // ~1.00 .. 1.16 push-in
        const camX = Math.sin(t * 0.10) * (18 + push * 28);            // px, big slow drift
        const camY = Math.cos(t * 0.074) * (12 + push * 18);
        const rot = Math.sin(t * 0.055) * 0.8;                         // deg, gentle tilt
        camRoot.style.setProperty("--cam-scale", scale.toFixed(4));
        camRoot.style.setProperty("--cam-x", `${camX.toFixed(1)}px`);
        camRoot.style.setProperty("--cam-y", `${camY.toFixed(1)}px`);
        camRoot.style.setProperty("--cam-rot", `${rot.toFixed(3)}deg`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [words, sections, art, sectionArt, getCurrentTime, pass, mode, lineStarts, keywordEmotion, allMoments, pickArt, pooledArt, spawnRing, stems, stutterRuns]);

  const word = idx >= 0 ? words[idx]?.w : undefined;
  const shown = word ? clean(word) : "";
  const lower = shown.toLowerCase();
  const charged = !!word && lower in keywordEmotion;
  const treatment: SectionMotion = section ? sectionMotion(section) : "pulse";
  // Focus modes override the section's motion with a calm entrance + a clean
  // (Focus) or effect (Focus+, seeded per word) exit. Others ride the section.
  const m = focusMode
    ? { ...FOCUS_IN, exit: focusFx ? FOCUS_EXITS[((idx * 2654435761) >>> 0) % FOCUS_EXITS.length] : FOCUS_EXIT_PLAIN }
    : MOTION[treatment];
  // Shape-morph: lexicon words morph when they have air; charged words fall back
  // to a glyph chosen from their EMOTION, so the brain's picks always land big.
  const airtime = idx >= 0 ? (words[idx + 1] ? words[idx + 1].t - words[idx].t : 3) : 0;
  // Signature effects, by priority. Each gated on the word having enough air.
  const ek = effectKey(shown);
  const burns = airtime >= 0.75 && FIRE_WORDS.has(ek);
  const glitches = !burns && airtime >= 0.3 && GLITCH_WORDS.has(ek);
  const slams = !burns && !glitches && pass >= 2 && airtime >= 0.35 && SLAM_WORDS.has(ek);
  const wavy = !burns && !glitches && !slams && pass >= 2 && airtime >= 0.6 && WAVE_WORDS.has(ek);
  const neon = !burns && !glitches && !slams && !wavy && pass >= 2 && airtime >= 0.5 && NEON_WORDS.has(ek);
  const pulses = !burns && !glitches && !slams && !wavy && !neon && pass >= 2 && airtime >= 0.6 && PULSE_WORDS.has(ek);
  const whispers = !burns && !glitches && !slams && !wavy && !neon && !pulses && pass >= 2 && airtime >= 0.4 && WHISPER_WORDS.has(ek);
  const priorEffect = burns || glitches || slams || wavy || neon || pulses || whispers;
  const fizzes = !priorEffect && airtime >= 0.55 && FIZZ_WORDS.has(ek);
  const types = !priorEffect && !fizzes && airtime >= 0.45 && TYPE_WORDS.has(ek);
  // Newer treatments auto-fire on their own vocabulary, at the lowest priority —
  // only when no signature effect above claimed the word (a per-word override
  // still trumps this in resolveWordEffect). Gives the whole post-signature
  // family (freeze…tremor, redact…bleed, handwrite/tvoff) a life beyond the FX
  // panel. PHASE 4: this whole
  // family is the "Kinetica upgrade" pass, so it's gated behind pass >= 4 —
  // passes 1-3 stay exactly as they were before it.
  const extraFx: TextEffect | null = (pass >= 4 && !priorEffect && !fizzes && !types && airtime >= 0.5)
    ? (COLD_WORDS.has(ek) ? "freeze"
      : HEAT_WORDS.has(ek) ? "melt"
      : STONE_WORDS.has(ek) ? "carve"
      : GOLD_WORDS.has(ek) ? "shimmer"
      : RISE_WORDS.has(ek) ? "rise"
      : FALL_WORDS.has(ek) ? "fall"
      : ECHO_WORDS.has(ek) ? "echo"
      : TREMOR_WORDS.has(ek) ? "tremor"
      : REDACT_WORDS.has(ek) ? "redact"
      : CHROMA_WORDS.has(ek) ? "chromatic"
      : LIQUID_WORDS.has(ek) ? "liquid"
      : BLEED_WORDS.has(ek) ? "bleed"
      : HANDWRITE_WORDS.has(ek) ? "handwrite"
      : TVOFF_WORDS.has(ek) ? "tvoff"
      : null)
    : null;
  const glyph = !priorEffect && !fizzes && !types && !extraFx && shown && airtime >= 0.6
    ? (glyphFor(shown) ?? (charged ? glyphForEmotion(keywordEmotion[lower]) : null))
    : null;
  // Line-final: the word that CLOSES a lyric line — it owns the stage a beat
  // longer, so it gets extra size, glow, and the backdrop leans in.
  const final = idx >= 0 && (words[idx + 1] ? lineStarts.has(Math.round(words[idx + 1].t * 100)) : true);
  // Held: a long sung note. The word itself performs the hold — it swells over
  // the note's duration and breathes with the live bass (--beat) underneath.
  const held = pass >= 2 && idx >= 0 && airtime >= 1.3 && !burns;
  // Small out-of-the-way preview of what's coming — the owner likes it.
  // (The BIG word appearing early was the mis-anchor bug, fixed above.)
  const upcoming = (idx >= 0 ? words.slice(idx + 1, idx + 5) : words.slice(0, 4))
    .map((x) => clean(x.w)).join(" ");
  // Dynamic stagecraft for this word: off-center position, tilt, size tier,
  // occasional mono type, and an entrance direction of its own. Words are
  // CENTER-anchored (left/top mark the word's center; negative margins,
  // measured below, pull it back by half its true size) — the old left-edge
  // anchor made every word grow rightward and clip off the right side.
  const dynRaw = dynamic && idx >= 0
    ? stagecraft(idx, { charged, final, mono: glitches || types, stop: STOP_WORDS.has(lower) })
    : null;
  const dyn = dynRaw;
  // Measured delivery: the singer's REAL energy on this word (lead-vocal
  // envelope from the stems) scales how big it lands. Belted words tower;
  // murmured ones stay close. 1 when the planet has no stems.
  const delivery = stems && idx >= 0
    ? 0.82 + envAt(stems, "lead", words[idx].t + 0.18) * 0.42
    : 1;
  let estW = 0, estH = 0;
  if (dynRaw && shown) {
    const vwPx = typeof window !== "undefined" ? window.innerWidth : 1200;
    const basePx = Math.min(Math.max(vwPx * 0.16, 48), 224); // clamp(3rem,16vw,14rem)
    estH = basePx * dynRaw.size * delivery;
    estW = Math.min(shown.length * basePx * dynRaw.size * delivery * 0.62, vwPx * 0.95);
  }
  // FIT-FIRST, now MEASURED: before the browser paints, read the word's real
  // laid-out size (offset* — immune to entrance transforms), shrink the font
  // if it can't fit at all, and clamp its center into the safe band so nothing
  // ever crops. ~20% of would-be overflows deliberately park AT the wall and
  // react in the song's own tap language a beat later.
  useLayoutEffect(() => {
    if (!dynamic || idx < 0) return;
    const el = wordEls.current.get(idx);
    const box = el?.offsetParent as HTMLElement | null;
    if (!el || !box) return;
    let parked = false;
    const fit = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const pad = Math.max(10, vw * 0.03);
      if (el.offsetWidth > vw - pad * 2) {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        el.style.fontSize = `${Math.max(20, fs * ((vw - pad * 2) / el.offsetWidth))}px`;
      }
      const b = box.getBoundingClientRect();
      const w = el.offsetWidth, h = el.offsetHeight;
      const cx = b.left + el.offsetLeft + w / 2;
      const maxOff = Math.max(0, (vw - w) / 2 - pad);
      const want = cx - vw / 2;
      const off = Math.max(-maxOff, Math.min(maxOff, want));
      el.style.marginLeft = `${(parseFloat(el.style.marginLeft) || 0) + (vw / 2 + off - cx)}px`;
      // Vertical: keep the word between the chips (top) and the timeline (bottom).
      const cy = b.top + el.offsetTop + h / 2;
      const bandT = 84, bandB = vh - 150;
      const cyT = h >= bandB - bandT ? (bandT + bandB) / 2 : Math.max(bandT + h / 2, Math.min(bandB - h / 2, cy));
      el.style.marginTop = `${(parseFloat(el.style.marginTop) || 0) + (cyT - cy)}px`;
      parked = parked || Math.abs(want) > maxOff + 1;
    };
    fit();
    // Held notes swell their letter-spacing over seconds — re-clamp whenever
    // the word's layout size changes. (Margins don't retrigger the observer.)
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    let to: ReturnType<typeof setTimeout> | undefined;
    if (parked && idx % 5 === 0) {
      to = setTimeout(() => { setTouchBurn(idx); navigator.vibrate?.(20); }, 430);
    }
    return () => { ro.disconnect(); if (to) clearTimeout(to); };
     
  }, [idx, dynamic]);
  // Residues center themselves the same way: measured negative margins.
  useLayoutEffect(() => {
    for (const r of residue) {
      const el = wordEls.current.get(r.key);
      if (el) {
        el.style.marginLeft = `${-el.offsetWidth / 2}px`;
        el.style.marginTop = `${-el.offsetHeight / 2}px`;
      }
    }
  }, [residue]);
  // Remember the rendered word so it can join the pile when the next arrives.
  if (idx >= 0 && !phrase && shown) {
    lastRendered.current = { key: idx, word: shown, rot: dyn?.rot ?? 0, mono: !!dyn?.mono };
  }
  const lineIdx = phrase && idx >= 0 ? lineRanges.findIndex((r) => idx >= r.s && idx <= r.e) : -1;

  return (
    // Outer layer is NOT transformed — fixed/absolute layers (backdrop, title,
    // timeline) must live here, since the beat-scaled .kinetic-stage would
    // otherwise become their containing block and misplace them.
    <div ref={rootRef} className={`relative flex h-full w-full flex-col items-center justify-center${cutMode ? " stem-cut" : ""}`} onPointerDown={scoreTap} onPointerMove={stageMove}>
      {/* Generated song art — crossfading Ken-Burns backdrop behind the words */}
      <AnimatePresence>
        {bgArt && (
          <motion.div
            key={bgArt}
            className="pointer-events-none fixed inset-0 -z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: held ? 0.85 : 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: held ? 0.7 : 1.6, ease: "easeInOut" }}
          >
            {/* parallax shell — rides the device tilt / mouse via CSS vars */}
            <div className="h-full w-full" style={{ transform: "translate3d(calc(var(--par-x, 0px) + var(--cam-x, 0px) * 1.4), calc(var(--par-y, 0px) + var(--cam-y, 0px) * 1.4), 0) rotate(var(--cam-rot, 0deg)) scale(calc(1.05 * var(--cam-scale, 1)))", willChange: "transform" }}>
              { }
              <motion.img
                src={bgArt}
                alt=""
                className="h-full w-full object-cover"
                style={{ filter: held ? "brightness(1.22) saturate(1.12)" : "brightness(1)", transition: "filter 800ms ease" }}
                initial={{ scale: 1.06 }}
                animate={{ scale: 1.16 }}
                transition={{ duration: 24, ease: "linear" }}
              />
              <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 45%, transparent 42%, rgba(5,3,11,0.72) 100%)" }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The weather layer — song-matched particles riding between the
          backdrop painting and the words. Embers for fire worlds, rain for
          water, sparks for digital, snow, bubbles, dust — density follows the
          section's emotional intensity, and it answers every gesture. */}
      {pass >= 3 && (
        <KineticParticles
          ref={particles}
          mode={particleMode}
          intensity={section?.intensity ?? 0.35}
          palette={palette}
          scale={phrase ? 0.55 : 1}
          lite={lite}
          density={deck?.density}
        />
      )}

      {/* The surface layer — mud/rust/cracks/vines clinging to the glass and
          creeping in from the edges. Only for songs whose world calls for it.
          A second full-screen canvas that reallocates ~200 radial gradients per
          frame — dropped on phones, where it's the difference the eye won't
          miss but the GPU will. */}
      {pass >= 3 && effectiveSurface && !lite && (
        <SurfaceEffects mode={effectiveSurface} intensity={section?.intensity ?? 0.35} scale={phrase ? 0.5 : 1} />
      )}

      {/* Ghost chorus — when the backing vocals swell, the current word's
          echo materializes huge and translucent behind the stage. Opacity is
          the LIVE backing-vocal envelope (CSS var, zero re-renders). A 24vw
          blur(6px) layer recomposited every frame — skipped on phones. */}
      {stems && shown && !phrase && !lite && (
        <div
          className="pointer-events-none fixed inset-0 z-[2] flex items-center justify-center overflow-hidden"
          style={{ opacity: "clamp(0, calc((var(--choir, 0) - 0.28) * 1.1), 0.42)" }}
          aria-hidden
        >
          <span
            className="whitespace-nowrap font-display font-black uppercase"
            style={{ fontSize: "clamp(6rem, 24vw, 26rem)", color: "var(--theme-secondary)", filter: "blur(6px)", letterSpacing: "0.04em" }}
          >
            {shown}
          </span>
        </div>
      )}

      {/* Word pileup — on a stutter run the repeated word stacks up until it
          fills the screen; a finger swiped across the pile knocks the chips
          away. The full-screen catcher only exists while the pile does. */}
      {pass >= 3 && pile.length > 0 && (
        <div
          className="fixed inset-0 z-[7] overflow-hidden"
          style={{ touchAction: "none" }}
          onPointerDown={pileSwipe}
          onPointerMove={(e) => { if (e.buttons || e.pointerType === "touch") pileSwipe(e); }}
        >
          <AnimatePresence>
            {pile.map((p, k) => (
              <motion.span
                key={p.id}
                custom={p}
                aria-hidden
                className="pointer-events-none absolute font-display font-black uppercase select-none"
                style={{
                  left: `${p.x}%`, top: `${p.y}%`,
                  color: k % 2 ? "var(--theme-secondary)" : "var(--theme-primary)",
                  fontSize: `clamp(1.6rem, ${(3 + p.s * 4).toFixed(1)}vw, 9rem)`,
                  textShadow: "0 0 26px currentColor",
                  willChange: "transform, opacity",
                }}
                initial={{ opacity: 0, scale: 0.15, rotate: p.rot, x: "-50%", y: "-50%" }}
                animate="in"
                exit="out"
                variants={{
                  in: { opacity: 0.94, scale: p.s, rotate: p.rot, x: "-50%", y: "-50%", transition: { type: "spring", stiffness: 340, damping: 17 } },
                  out: (c: typeof p) => ({ opacity: 0, scale: p.s * 0.85, rotate: c.rot + c.fr, x: `calc(-50% + ${c.fx}px)`, y: `calc(-50% + ${c.fy}px)`, transition: { duration: 0.55, ease: "easeOut" } }),
                }}
              >
                {p.word}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Riser charge — the walls close in as the drop approaches (--charge
          is written per-frame from the stem riser window) */}
      {stems && (
        <div
          className="pointer-events-none fixed inset-0 z-[4]"
          style={{
            opacity: "var(--charge, 0)",
            background: "radial-gradient(circle at 50% 50%, transparent calc(62% - var(--charge, 0) * 34%), rgba(2,1,6,0.93) 100%)",
          }}
          aria-hidden
        />
      )}

      {/* Beat-cut blackout — the drums vanished; the world holds its breath */}
      <AnimatePresence>
        {cutMode && (
          <motion.div
            key="cut"
            className="pointer-events-none fixed inset-0 z-[4] bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.62 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.28 }}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* SUPERNOVA — the riser detonates exactly on the drop */}
      <AnimatePresence>
        {nova > 0 && (
          <motion.div
            key={`nova${nova}`}
            className="pointer-events-none fixed inset-0 z-[40]"
            style={{ background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.95), color-mix(in srgb, var(--theme-accent) 55%, transparent) 45%, transparent 75%)" }}
            initial={{ opacity: 1, scale: 0.6 }}
            animate={{ opacity: 0, scale: 1.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Title card — the brain's interpretation opens the show */}
      <AnimatePresence>
        {showTitle && (
          <motion.div
            key="title"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14, transition: { duration: 0.8 } }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="pointer-events-none fixed inset-0 z-10 flex flex-col items-center justify-center gap-6 px-8 text-center"
          >
            <p className="font-display text-4xl font-black uppercase tracking-tight glow-text sm:text-6xl" style={{ color: "var(--theme-primary)" }}>{track.title}</p>
            {track.planet?.respondsTo && (
              <p className="font-mono text-xs uppercase tracking-[0.35em]" style={{ color: "var(--theme-accent)" }}>
                an answer to {track.planet.respondsTo}
              </p>
            )}
            {analysis?.summary && <p className="max-w-2xl text-base leading-7 text-white/60 sm:text-lg">{analysis.summary}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Director's-deck frame grades (grain / vignette) — static overlays, so
          they carry no per-frame cost. Only mounted when the knob is non-zero. */}
      {deck?.grain ? (
        <div className="pointer-events-none fixed inset-0 z-[8]" aria-hidden style={{
          opacity: Math.min(1, deck.grain) * 0.5, mixBlendMode: "overlay",
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.06) 3px)",
        }} />
      ) : null}
      {deck?.vignette ? (
        <div className="pointer-events-none fixed inset-0 z-[8]" aria-hidden style={{
          opacity: Math.min(1, deck.vignette),
          background: "radial-gradient(ellipse at center, transparent 46%, rgba(0,0,0,0.85) 100%)",
        }} />
      ) : null}

      <div ref={stageRef} className="kinetic-stage z-[3] flex w-full flex-col items-center justify-center gap-6 text-center"
        style={deck?.glow && !lite ? { filter: `drop-shadow(0 0 ${(Math.min(1, deck.glow) * 0.6).toFixed(3)}em var(--theme-accent))` } : undefined}>
        {section && (
          <p className="font-mono text-[11px] uppercase tracking-[0.45em] transition-colors duration-700" style={{ color: "var(--theme-accent)" }}>
            {section.emotion}
          </p>
        )}
        <div className="relative flex min-h-[34vh] items-center justify-center">
          {/* beat halo — the stage breathes with the music even between words */}
          <div className="kinetic-halo" aria-hidden />
          {/* ambient dust — the pass-2 satellite's CSS particles (pass 3+ has
              the full canvas weather layer instead) */}
          {pass === 2 && Array.from({ length: 12 }).map((_, i) => (
            <span key={`d${i}`} className="kinetic-dust" aria-hidden style={{
              left: `${(i * 83 + 7) % 96}%`,
              animationDelay: `${(i * 1.7) % 9}s`,
              animationDuration: `${9 + (i * 2.3) % 7}s`,
              width: `${3 + (i % 3) * 2}px`,
              height: `${3 + (i % 3) * 2}px`,
            }} />
          ))}
          {/* section shockwave — big scene changes ripple outward as a
              staggered TRIPLE ring, accent/primary/white */}
          <AnimatePresence>
            {pass >= 2 && wave > 0 && [0, 1, 2].map((ri) => (
              <motion.span
                key={`w${wave}-${ri}`}
                className="pointer-events-none absolute rounded-full"
                style={{
                  width: "34vmin", height: "34vmin",
                  border: `2px solid ${ri === 0 ? "var(--theme-accent)" : ri === 1 ? "var(--theme-primary)" : "rgba(255,255,255,0.7)"}`,
                }}
                initial={{ opacity: 0.55 - ri * 0.14, scale: 0.25 }}
                animate={{ opacity: 0, scale: 3.4 - ri * 0.55 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.1, delay: ri * 0.14, ease: "easeOut" }}
                aria-hidden
              />
            ))}
          </AnimatePresence>
          {/* pulse rings — charged/line-final landings and the live beat
              breathe circles through the stage (self-removing) */}
          {pulseRings.map((r) => (
            <motion.span
              key={`p${r.id}`}
              className="pointer-events-none absolute rounded-full"
              style={{
                width: r.big ? "26vmin" : "15vmin", height: r.big ? "26vmin" : "15vmin",
                border: r.big ? "2px solid var(--theme-accent)" : "1.5px solid color-mix(in srgb, var(--theme-primary) 65%, transparent)",
              }}
              initial={{ opacity: r.big ? 0.5 : 0.28, scale: 0.3 }}
              animate={{ opacity: 0, scale: r.big ? 2.7 : 1.9 }}
              transition={{ duration: r.big ? 0.95 : 0.75, ease: "easeOut" }}
              onAnimationComplete={() => setPulseRings((rs) => rs.filter((x) => x.id !== r.id))}
              aria-hidden
            />
          ))}
          {phrase ? (
            /* ═══ PHRASE MODE — the whole line on stage, igniting word by word ═══ */
            <AnimatePresence mode="wait">
              {idx >= 0 && lineIdx >= 0 && (
                <motion.div
                  key={lineIdx}
                  className="flex max-w-[86vw] flex-wrap items-baseline justify-center gap-x-[1.4vw] gap-y-2 text-center"
                  initial={{ opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18, transition: { duration: 0.25 } }}
                  transition={{ duration: 0.4 }}
                >
                  {words.slice(lineRanges[lineIdx].s, lineRanges[lineIdx].e + 1).map((w, j) => {
                    const gi = lineRanges[lineIdx].s + j;
                    const sung = gi <= idx;
                    const active = gi === idx;
                    return (
                      <motion.span
                        key={gi}
                        className="phrase-word font-display font-black uppercase"
                        animate={{
                          opacity: sung ? 1 : 0.26,
                          scale: active ? 1.22 : 1,
                          color: active ? "var(--theme-accent)" : sung ? "var(--theme-primary)" : "rgba(255,255,255,0.8)",
                        }}
                        transition={{ duration: 0.22 }}
                        style={active ? { filter: "drop-shadow(0 0 18px var(--theme-accent))" } : undefined}
                      >
                        {clean(w.w)}
                      </motion.span>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
          <>
          {/* THE PILE — recent words linger, grabbable and throwable. Lifecycle
              is state-driven (dying → fade → self-remove): AnimatePresence
              exits were silently never completing here, leaking ghosts. */}
          {residue.map((r) => (
            <motion.div
              key={`res${r.key}`}
              ref={(el) => { if (el) { wordEls.current.set(r.key, el); const pv = phys.current.get(r.key); if (pv) el.style.translate = `${pv.x}px ${pv.y}px`; } else wordEls.current.delete(r.key); }}
              className={`kinetic-word absolute cursor-grab select-none${r.mono ? " !font-mono" : ""}`}
              style={{
                left: r.cx, top: r.cy,
                transform: `rotate(${r.rot}deg)`,
                fontSize: r.fs * 0.78,
                color: layerColors[r.layer],
                // static glow (no beat vars) — cheap on mobile, tinted per layer
                filter: "drop-shadow(0 0 10px currentColor)",
                zIndex: 1,
              }}
              initial={{ opacity: 0.85 }}
              animate={{ opacity: r.dying ? 0 : 0.4 }}
              transition={{ duration: r.dying ? 0.7 : 1.2 }}
              onAnimationComplete={r.dying ? () => setResidue((old) => old.filter((x) => x.key !== r.key)) : undefined}
              onPointerDown={grabStart(r.key)}
            >
              {r.word}
            </motion.div>
          ))}
          <AnimatePresence>
            {word && (
              <motion.div
                key={idx}
                className={`kinetic-word absolute${charged ? " kinetic-word--charged" : ""}${pass >= 2 && final ? " kinetic-word--final" : ""}${held ? " kinetic-word--held" : ""}${dyn?.mono ? " !font-mono" : ""}${pass >= 3 ? " cursor-pointer select-none" : ""}${charging ? " kinetic-charging" : ""}`}
                style={dyn ? { left: `calc(50% + ${dyn.x}vw)`, top: `calc(50% + ${dyn.y}vh)`, marginLeft: -estW / 2, marginTop: -estH / 2, rotate: dyn.rot, fontSize: `calc(clamp(3rem, 16vw, 14rem) * ${dyn.size * delivery})` } : undefined}
                ref={(el) => { if (el) { wordEls.current.set(idx, el); const pv = phys.current.get(idx); if (pv) el.style.translate = `${pv.x}px ${pv.y}px`; } }}
                onPointerDown={pass >= 3 ? (e) => { chargeAt.current = Date.now(); setCharging(true); grabStart(idx)(e); } : undefined}
                onPointerUp={pass >= 3 ? (e) => {
                  const heldMs = Date.now() - chargeAt.current;
                  setCharging(false);
                  if (dragMoved.current) return; // it was a throw, not a tap
                  if (heldMs >= 650) {
                    setWave((w) => w + 1);
                    particles.current?.burst(e.clientX, e.clientY, 60);
                    navigator.vibrate?.([15, 40, 20]);
                  } else {
                    particles.current?.burst(e.clientX, e.clientY, 22);
                    navigator.vibrate?.(25);
                  }
                  setTouchBurn(idx);
                } : undefined}
                onPointerLeave={pass >= 3 ? () => setCharging(false) : undefined}
                {...(m as MotionProps)}
              >
                {/* ghost echo — line-final and charged words leave an afterimage (not in focus) */}
                {pass >= 2 && (final || charged) && !burns && !focusMode && (
                  <motion.span
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0.35, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.9 }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                    aria-hidden
                  >
                    {shown}
                  </motion.span>
                )}
                <span className="kinetic-breathe">
                  {(() => {
                    // Focus / Focus+ render every word PLAIN and readable — no
                    // inner treatment (the effect lives on the exit, not the word).
                    // A live tap still reacts (touchBurn) even in focus.
                    if (focusMode && touchBurn !== idx) return <>{shown}</>;
                    // The word's inner treatment, shared by held + normal paths.
                    // Dynamic plain words ASSEMBLE: every letter flies in from
                    // its own golden-angle direction — no two ever match.
                    const assembles = dynamic && !glitches && !slams && !wavy && !neon && !pulses && !whispers && !fizzes && !types && !extraFx && !glyph;
                    // The stage's own natural pick for this word, in priority order;
                    // it resolves to one registry TextEffect id rendered via WORD_FX.
                    const naturalSig: TextEffect | null = burns ? "burn"
                      : glitches ? "glitch" : slams ? "slam" : wavy ? "wave"
                      : neon ? "neon" : pulses ? "pulse" : whispers ? "whisper"
                      : fizzes ? "fizz" : types ? "type" : extraFx;
                    // Bias seam (pure, shared with tests): per-word override wins,
                    // else the natural pick unless the preset `allow` list rules it out.
                    const resolvedFx = resolveWordEffect(naturalSig, effectsCfg, [ek, lower]);
                    const sigFx = resolvedFx && resolvedFx !== "burn" ? resolvedFx : null;
                    let inner: ReactNode = sigFx ? WORD_FX[sigFx](shown, airtime)
                      : glyph ? <WordMorph word={shown} glyph={glyph} treatment={treatment} />
                      : assembles ? <WordAssemble word={shown} baseAngle={idx * GOLDEN} charged={charged} />
                      : pass >= 2 && charged ? <CascadeWord word={shown} /> : <>{shown}</>;
                    // Tap reaction — in the song's own language (per-planet choreography).
                    if (touchBurn === idx) return WORD_FX[tapFx](shown, tapFx === "burn" ? Math.max(airtime, 1.2) : airtime);
                    if (resolvedFx === "burn") return WORD_FX.burn(shown, airtime);
                    // Effect words still rush in whole, from the golden-angle
                    // direction that belongs to this word alone. (Assembled
                    // words already fly per-letter; slams drop from above.)
                    if (dyn && !slams && !assembles) {
                      const a = (dyn.ang * Math.PI) / 180;
                      inner = (
                        <motion.span
                          className="inline-block"
                          initial={{ x: `${(Math.cos(a) * 24).toFixed(1)}vw`, y: `${(Math.sin(a) * 20).toFixed(1)}vh`, opacity: 0 }}
                          animate={{ x: "0vw", y: "0vh", opacity: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 26 }}
                        >
                          {inner}
                        </motion.span>
                      );
                    }
                    if (held) return (
                      // The held note performs: the word swells for the length of
                      // the note while the beat makes it breathe (CSS --beat scale).
                      <motion.span
                        className="inline-block"
                        initial={{ scale: 1, letterSpacing: "0em" }}
                        animate={{ scale: 1.24, letterSpacing: "0.045em" }}
                        transition={{ duration: Math.min(airtime * 0.92, 4.5), ease: "easeOut" }}
                      >
                        {inner}
                      </motion.span>
                    );
                    return inner;
                  })()}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          </>
          )}
        </div>
        {upcoming && <p className="kinetic-hint">{upcoming}</p>}
      </div>

      {/* Anchor word — a charged word looms huge and translucent OVER the show */}
      <AnimatePresence>
        {dynamic && anchor && (
          <motion.div
            key={`a${anchor.key}`}
            className="pointer-events-none fixed inset-0 z-[6] flex items-center justify-center overflow-hidden"
            style={{ transform: "translate3d(calc(var(--par-x, 0px) * 1.7), calc(var(--par-y, 0px) * 1.7), 0)", willChange: "transform" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1.1 } }}
          >
            <motion.span
              // `kinetic-anchor` carries the soft blur via CSS so perf-lite can
              // drop it: this layer ANIMATES scale on entrance, and scaling a
              // blurred layer forces a full re-raster every frame — the single
              // heaviest per-charged-word cost on a phone GPU. Lite freezes the
              // blur (crisp edges, same looming motion); desktop keeps it.
              className="kinetic-anchor pointer-events-auto cursor-pointer select-none whitespace-nowrap font-display font-black uppercase"
              style={{ fontSize: "clamp(8rem, 30vw, 34rem)", color: "var(--theme-accent)", letterSpacing: "-0.02em" }}
              // Three arrivals, chosen per word: 0 = slide across, 1 = zoom
              // through from way out front, 2 = rise up from below the floor.
              initial={anchor.mode === 1
                ? { opacity: 0, scale: 4.8, x: "0vw", y: "0vh", rotate: 0 }
                : anchor.mode === 2
                  ? { opacity: 0, scale: 2.1, x: "0vw", y: "52vh", rotate: anchor.rot }
                  : { opacity: 0, scale: 2.3, x: anchor.fromX, y: "0vh", rotate: anchor.rot * 2 }}
              animate={{ opacity: 0.15, scale: 1.72, x: "0vw", y: "0vh", rotate: anchor.rot }}
              whileTap={{ opacity: 0.45, scale: 1.95 }}
              onPointerDown={() => { anchorAt.current = 0; setAnchor(null); }}
              transition={{ duration: anchor.mode === 1 ? 1.35 : 1.15, ease: "easeOut" }}
            >
              {anchor.word}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Beat game — streak chip (tap to toggle) + tap ripples */}
      {pass >= 3 && (
        <button
          onClick={toggleBeat}
          className="fixed left-4 top-24 z-20 rounded-full border border-white/15 bg-black/45 px-3 py-2 font-mono text-[10px] uppercase tracking-wider backdrop-blur transition hover:scale-105"
          style={{ color: beatOn ? "var(--theme-accent)" : "rgba(255,255,255,0.35)" }}
          title="Tap-to-the-beat — tap the stage on the beat to build a streak. Tap here to toggle."
        >
          {beatOn ? (streak >= 2 ? `🔥 ${streak}` : "🥁 beat: on") : "🥁 beat: off"}
        </button>
      )}
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          className="pointer-events-none fixed z-20 rounded-full"
          style={{ left: r.x - 30, top: r.y - 30, width: 60, height: 60, border: `2px solid ${r.hit ? "var(--theme-accent)" : "rgba(255,255,255,0.3)"}` }}
          initial={{ opacity: 0.85, scale: 0.35 }}
          animate={{ opacity: 0, scale: r.hit ? 2.3 : 1.15 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          onAnimationComplete={() => setRipples((rs) => rs.filter((x) => x.id !== r.id))}
        />
      ))}

      {/* Pressure gauge — the emotional intensity as a living instrument */}
      {pass >= 3 && mode !== "focus" && <PressureGauge section={section} />}

      {/* Choreographed wipe moment — wipe the song's veil away (sound too) */}
      {pass >= 3 && <WipeLayer moment={wipe} onProgress={onWipeProgress} onReleased={onWipeReleased} lite={lite} />}

      {/* Choreographed blow moment — blow into the mic on cue */}
      {pass >= 3 && <BlowMoment moment={blow} onGust={() => setGust((g) => g + 1)} />}

      {/* Choreographed SCREAM moment — shout the song's word into the mic → nova.
          The payoff also erupts the weather (embers on a fire song): more fire. */}
      {pass >= 3 && (
        <ScreamMoment
          moment={scream}
          onScream={() => {
            setNova((n) => n + 1);
            setWave((w) => w + 1);
            spawnRing(true);
            particles.current?.burst(window.innerWidth / 2, window.innerHeight * 0.46, 150);
            navigator.vibrate?.([30, 40, 120]);
          }}
        />
      )}

      {/* Choreographed shake moment — shake the phone on cue (tap = fallback) */}
      <AnimatePresence>
        {pass >= 3 && shakeMo && (
          <motion.button
            key={shakeMo.prompt}
            onClick={() => setQuake((q) => q + 1)}
            transformTemplate={centerX}
            className="fixed left-1/2 top-24 z-[35] w-max max-w-[92vw] -translate-x-1/2 rounded-2xl border border-white/25 bg-black/55 px-5 py-3 text-center font-mono text-xs uppercase tracking-[0.3em] text-white backdrop-blur"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0, rotate: [0, -2.5, 2.5, -1.5, 1.5, 0] }}
            exit={{ opacity: 0 }}
            transition={{ rotate: { duration: 0.7, repeat: Infinity, repeatDelay: 0.5 } }}
          >
            📳 {shakeMo.prompt}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mic primer — ask ONCE at show start (never mid-song) when this
          song has a breath OR scream moment coming. */}
      {pass >= 3 && !blow && !scream && (
        <MicPrimer active={allMoments.some((mm) => mm.type === "blow" || mm.type === "scream")} />
      )}

      {/* The gust: wind streaks sweep through, the stage dims like a blown flame */}
      <AnimatePresence>
        {gust > 0 && (
          <motion.div
            key={`g${gust}`}
            className="pointer-events-none fixed inset-0 z-[34] overflow-hidden"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onAnimationComplete={() => setTimeout(() => setGust(0), 2400)}
          >
            {Array.from({ length: 26 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute h-[2px] rounded-full bg-white/70"
                style={{ top: `${(i * 89) % 100}%`, width: `${40 + (i * 37) % 120}px`, boxShadow: "0 0 8px var(--theme-accent)" }}
                initial={{ left: "-12%", opacity: 0 }}
                animate={{ left: "112%", opacity: [0, 0.9, 0] }}
                transition={{ duration: 0.7 + ((i * 13) % 10) / 18, delay: ((i * 7) % 12) / 30, ease: "easeIn" }}
              />
            ))}
            <motion.div
              className="absolute inset-0 bg-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.72, 0.55, 0] }}
              transition={{ duration: 2.6, times: [0, 0.25, 0.6, 1], ease: "easeInOut" }}
            />
            <motion.p
              transformTemplate={centerXY}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-sm uppercase tracking-[0.5em] text-white/70"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: [0, 1, 0], scale: 1.05 }}
              transition={{ duration: 2.4, times: [0, 0.3, 1] }}
            >
              ✨
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {sections && sections.length > 0 && <ArcTimeline sections={sections} bottomClass={timelineBottomClass} />}

      {/* Frame-rate meter for measuring on a real device (?fps=1). Hidden otherwise. */}
      <PerfHUD />
    </div>
  );
}

/* ========== PRESSURE GAUGE ==========
   The song's emotional intensity as a living instrument: a vertical column
   filled to the section's intensity, its needle quivering with the live bass
   (--beat), labeled with the emotion. Watch it plunge on breakdowns. */
function PressureGauge({ section }: { section: PlanetSection | null }) {
  const level = (section?.intensity ?? 0.25) * 100;
  return (
    <div className="pointer-events-none fixed right-3 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-2 sm:flex">
      <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-white/30">pressure</span>
      <div className="relative h-[38vh] w-1.5 overflow-visible rounded-full bg-white/10">
        <div
          className="absolute bottom-0 w-full rounded-full transition-[height] duration-700 ease-out"
          style={{ height: `${level}%`, background: "linear-gradient(to top, var(--theme-primary), var(--theme-accent))", boxShadow: "0 0 10px var(--theme-primary)" }}
        />
        <div
          className="absolute -left-1 h-[3px] w-3.5 rounded-full bg-white"
          style={{ bottom: `calc(${level}% + var(--beat) * 7%)`, boxShadow: "0 0 8px var(--theme-accent)", transition: "bottom 90ms ease-out" }}
        />
      </div>
      <span className="font-mono text-[9px] uppercase tracking-widest transition-colors duration-700" style={{ writingMode: "vertical-rl", color: "var(--theme-accent)" }}>
        {section ? `${section.emotion} · ${Math.round(section.intensity * 100)}` : "—"}
      </span>
    </div>
  );
}

/* ========== EMOTIONAL ARC TIMELINE ==========
   The planet made tangible: the song's emotion sections as a scrubbable strip.
   Click anywhere to jump; the playhead is driven imperatively (no re-renders). */
function ArcTimeline({ sections, bottomClass }: { sections: PlanetSection[]; bottomClass: string }) {
  const { duration, seek, getCurrentTime } = useMusicPlayer();
  const markerRef = useRef<HTMLDivElement>(null);
  const total = duration || (sections[sections.length - 1].start + 20);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (markerRef.current) markerRef.current.style.left = `${Math.min(100, (getCurrentTime() / total) * 100)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getCurrentTime, total]);

  return (
    <div className={`fixed inset-x-0 ${bottomClass} z-10 px-4 sm:px-8`}>
      <div
        className="group relative mx-auto h-2.5 max-w-4xl cursor-pointer overflow-visible rounded-full"
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * total); }}
        title="Emotional arc — click to travel"
      >
        <div className="flex h-full w-full overflow-hidden rounded-full opacity-80 transition-all group-hover:opacity-100">
          {sections.map((s, i) => {
            const end = sections[i + 1]?.start ?? total;
            const w = Math.max(0, ((end - s.start) / total) * 100);
            return (
              <div key={`${s.name}${s.start}`} style={{ width: `${w}%`, background: s.colorHint, opacity: 0.45 + s.intensity * 0.55 }}
                className="h-full transition-opacity" title={`${s.emotion} · ${s.name}`} />
            );
          })}
        </div>
        <div ref={markerRef} className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80"
          style={{ background: "var(--theme-primary)", boxShadow: "0 0 12px var(--theme-primary)" }} />
      </div>
    </div>
  );
}

/* ========== SHAPE-MORPH ==========
   The word lands, then dissolves into its glyph — which draws itself on and
   glows. The morph's character follows the section's emotion: shatter = hard
   snap, still/drift = slow dissolve. */
const MORPH_TIMING: Record<SectionMotion, { hold: number; morph: number; ease: string }> = {
  still:   { hold: 0.55, morph: 1.1, ease: "easeInOut" },
  drift:   { hold: 0.5,  morph: 0.9, ease: "easeInOut" },
  pulse:   { hold: 0.42, morph: 0.7, ease: "easeOut" },
  surge:   { hold: 0.36, morph: 0.55, ease: "easeOut" },
  shatter: { hold: 0.3,  morph: 0.38, ease: "backOut" },
};

/* ========== BURN ==========
   Fire words ignite: letters flash white-hot, char, and crumble into ash that
   drifts away — while embers rise off the word. Deterministic per-index
   pseudo-randomness (no Math.random) keeps renders stable; em units scale the
   physics with the giant type. The burn is paced to the word's airtime. */
function WordBurn({ word, airtime }: { word: string; airtime: number }) {
  const letters = [...word];
  const dur = Math.min(1.5, Math.max(0.8, airtime * 0.92)); // finish just before the next word
  const r = (i: number, m: number) => ((i * 73 + 41) % 89) / 89 * m; // 0..m, stable per index
  return (
    <span className="relative inline-flex items-center justify-center">
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ color: "#ffffff", opacity: 1, y: "0em", x: "0em", rotate: 0 }}
          animate={{
            color: ["#ffffff", "#ffd28a", "#ff6a00", "#7a3410", "#4a4a4a"],
            textShadow: [
              "0 0 0.5em #ffdca8, 0 0 1em #ff6a00",
              "0 0 0.4em #ffb35c, 0 0 0.9em #ff5400",
              "0 0 0.25em #ff5400",
              "0 0 0.08em #7a3410",
              "0 0 0em transparent",
            ],
            opacity: [1, 1, 1, 0.85, 0],
            y: ["0em", "0em", `-${0.02 + r(i, 0.03)}em`, `${0.1 + r(i + 3, 0.12)}em`, `${0.32 + r(i + 5, 0.3)}em`],
            x: ["0em", "0em", "0em", `${(i % 2 ? 1 : -1) * r(i + 7, 0.08)}em`, `${(i % 2 ? 1 : -1) * (0.08 + r(i + 9, 0.18))}em`],
            rotate: [0, 0, 0, (i % 2 ? 1 : -1) * r(i + 11, 9), (i % 2 ? 1 : -1) * (8 + r(i + 13, 14))],
            filter: ["blur(0px)", "blur(0px)", "blur(0px)", "blur(1px)", "blur(3px)"],
          }}
          transition={{ duration: dur, times: [0, 0.28, 0.45, 0.75, 1], delay: 0.15 + i * (dur * 0.04), ease: "easeIn" }}
        >
          {ch}
        </motion.span>
      ))}
      {/* rising embers */}
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.span
          key={`e${i}`}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${6 + ((i * 61) % 88)}%`,
            top: `${45 + ((i * 37) % 25)}%`,
            width: "0.045em",
            height: "0.045em",
            background: i % 3 === 0 ? "#ffd28a" : i % 3 === 1 ? "#ff8a3c" : "var(--theme-accent)",
            boxShadow: "0 0 0.12em #ff6a00",
          }}
          initial={{ opacity: 0, y: "0em" }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: ["0em", `-${0.35 + r(i, 0.5)}em`, `-${0.9 + r(i + 2, 0.9)}em`],
            x: ["0em", `${(i % 2 ? 1 : -1) * r(i + 4, 0.18)}em`, `${(i % 2 ? 1 : -1) * r(i + 6, 0.4)}em`],
          }}
          transition={{ duration: dur * 1.05, delay: 0.2 + (i % 7) * (dur * 0.07), ease: "easeOut" }}
        />
      ))}
    </span>
  );
}

/* ========== GLITCH ==========
   Connection words flicker like a dropping video call: RGB channel split,
   x-jitter, a brief "freeze" blur, then a clean snap. Fast by design. */
function WordGlitch({ word, airtime }: { word: string; airtime: number }) {
  const dur = Math.min(0.55, Math.max(0.35, airtime * 0.8));
  return (
    <motion.span
      className="inline-block"
      initial={{ x: 0 }}
      animate={{
        x: ["0em", "-0.04em", "0.05em", "-0.02em", "0.015em", "0em"],
        skewX: [0, -6, 5, -2, 0, 0],
        opacity: [1, 0.55, 1, 0.7, 1, 1],
        filter: ["blur(0px)", "blur(0px)", "blur(2px)", "blur(0px)", "blur(0px)", "blur(0px)"],
        textShadow: [
          "0.06em 0 0 rgba(67,247,255,0.9), -0.06em 0 0 rgba(255,36,64,0.9)",
          "-0.09em 0 0 rgba(67,247,255,0.9), 0.09em 0 0 rgba(255,36,64,0.9)",
          "0.045em 0.03em 0 rgba(67,247,255,0.9), -0.045em -0.03em 0 rgba(255,36,64,0.9)",
          "-0.02em 0 0 rgba(67,247,255,0.8), 0.02em 0 0 rgba(255,36,64,0.8)",
          "0.01em 0 0 rgba(67,247,255,0.4), -0.01em 0 0 rgba(255,36,64,0.4)",
          "0 0 0 transparent",
        ],
      }}
      transition={{ duration: dur, times: [0, 0.2, 0.4, 0.6, 0.8, 1], ease: "linear" }}
    >
      {word}
    </motion.span>
  );
}

/* ========== FIZZ ==========
   Drink words sparkle like carbonation: the word bobs gently while bubbles
   rise through and past it, popping at the top. */
function WordFizz({ word, airtime }: { word: string; airtime: number }) {
  const dur = Math.min(1.6, Math.max(0.9, airtime));
  const r = (i: number, m: number) => ((i * 53 + 29) % 97) / 97 * m;
  return (
    <span className="relative inline-flex items-center justify-center">
      <motion.span
        className="inline-block"
        animate={{ y: ["0em", "-0.03em", "0em", "-0.02em", "0em"] }}
        transition={{ duration: dur, ease: "easeInOut" }}
      >
        {word}
      </motion.span>
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute rounded-full border"
          style={{
            left: `${8 + ((i * 67) % 86)}%`,
            bottom: "8%",
            width: `${0.035 + r(i, 0.05)}em`,
            height: `${0.035 + r(i, 0.05)}em`,
            borderColor: "color-mix(in srgb, var(--theme-accent) 80%, white)",
            background: "color-mix(in srgb, var(--theme-accent) 18%, transparent)",
          }}
          initial={{ opacity: 0, y: "0em" }}
          animate={{
            opacity: [0, 0.9, 0.9, 0],
            y: ["0em", `-${0.5 + r(i + 3, 0.5)}em`, `-${1.0 + r(i + 5, 0.7)}em`],
            x: ["0em", `${(i % 2 ? 1 : -1) * r(i + 7, 0.1)}em`, `${(i % 2 ? -1 : 1) * r(i + 9, 0.12)}em`],
            scale: [0.6, 1, 1.15],
          }}
          transition={{ duration: dur, delay: (i % 6) * (dur * 0.08), ease: "easeOut" }}
        />
      ))}
    </span>
  );
}

/* ========== TYPE-ON ==========
   Code words type themselves out with a blinking cursor block. */
function WordType({ word, airtime }: { word: string; airtime: number }) {
  const letters = [...word];
  const per = Math.min(0.09, Math.max(0.035, (airtime * 0.55) / letters.length));
  return (
    <span className="inline-flex items-baseline">
      {letters.map((ch, i) => (
        <motion.span key={i} className="inline-block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 + i * per, duration: 0.02 }}
        >
          {ch}
        </motion.span>
      ))}
      <motion.span
        className="ml-[0.06em] inline-block w-[0.45em] self-stretch"
        style={{ background: "var(--theme-accent)" }}
        initial={{ opacity: 1 }}
        animate={{ opacity: [1, 1, 0, 1, 0, 1, 0] }}
        transition={{ duration: Math.max(0.9, airtime * 0.9), times: [0, 0.45, 0.55, 0.65, 0.78, 0.88, 1] }}
        aria-hidden
      />
    </span>
  );
}

/* ========== SLAM ==========
   Impact words drop from above, hit hard, and rattle the letters — with a
   flash of light on impact. Fast and violent by design. */
function WordSlam({ word }: { word: string }) {
  return (
    <motion.span
      className="inline-block"
      initial={{ y: "-0.55em", scale: 1.45, opacity: 0 }}
      animate={{
        y: ["-0.55em", "0em", "-0.035em", "0em", "-0.015em", "0em"],
        scale: [1.45, 1, 1.04, 1, 1.01, 1],
        opacity: [0, 1, 1, 1, 1, 1],
        x: ["0em", "0em", "-0.02em", "0.018em", "-0.008em", "0em"],
        textShadow: [
          "0 0 0em transparent",
          "0 0 0.55em #ffffff, 0 0 1em var(--theme-accent)",
          "0 0 0.3em var(--theme-accent)",
          "0 0 0.18em var(--theme-accent)",
          "0 0 0.1em var(--theme-accent)",
          "0 0 0.06em transparent",
        ],
      }}
      transition={{ duration: 0.55, times: [0, 0.22, 0.4, 0.58, 0.78, 1], ease: "easeOut" }}
    >
      {word}
    </motion.span>
  );
}

/* ========== WAVE ==========
   Water words roll: each letter rides a travelling swell, offset in phase. */
function WordWave({ word, airtime }: { word: string; airtime: number }) {
  const letters = [...word];
  const dur = Math.min(2.2, Math.max(1.0, airtime));
  return (
    <span className="inline-flex">
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          animate={{ y: ["0em", "-0.09em", "0em", "0.05em", "0em"], rotate: [0, -3, 0, 2, 0] }}
          transition={{ duration: dur * 0.7, delay: i * 0.06, repeat: airtime > 1.6 ? 1 : 0, ease: "easeInOut" }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

/* ========== NEON ==========
   Light words buzz on like a neon sign: stuttering ignition, then a steady
   saturated glow that hums for the rest of the word's airtime. */
function WordNeon({ word, airtime }: { word: string; airtime: number }) {
  return (
    <motion.span
      className="inline-block"
      initial={{ opacity: 0.2 }}
      animate={{
        opacity: [0.2, 1, 0.35, 1, 0.5, 1, 1],
        textShadow: [
          "0 0 0em transparent",
          "0 0 0.4em var(--theme-accent), 0 0 0.9em var(--theme-accent)",
          "0 0 0.08em var(--theme-accent)",
          "0 0 0.45em var(--theme-accent), 0 0 1em var(--theme-accent)",
          "0 0 0.12em var(--theme-accent)",
          "0 0 0.5em var(--theme-accent), 0 0 1.1em var(--theme-accent), 0 0 1.8em var(--theme-primary)",
          "0 0 0.45em var(--theme-accent), 0 0 1em var(--theme-accent), 0 0 1.6em var(--theme-primary)",
        ],
      }}
      transition={{ duration: Math.min(1.1, Math.max(0.6, airtime * 0.7)), times: [0, 0.12, 0.2, 0.34, 0.42, 0.6, 1], ease: "linear" }}
    >
      {word}
    </motion.span>
  );
}

/* ========== PULSE ==========
   Heartbeat words pump lub-dub — two quick beats, rest, repeat for the
   word's airtime, glowing warmer on each systole. */
function WordPulse({ word, airtime }: { word: string; airtime: number }) {
  const beats = Math.max(1, Math.min(3, Math.floor(airtime / 0.9)));
  return (
    <motion.span
      className="inline-block"
      animate={{
        scale: [1, 1.14, 1, 1.1, 1, 1],
        textShadow: [
          "0 0 0.1em transparent",
          "0 0 0.5em var(--theme-accent)",
          "0 0 0.15em transparent",
          "0 0 0.4em var(--theme-accent)",
          "0 0 0.1em transparent",
          "0 0 0.05em transparent",
        ],
      }}
      transition={{ duration: 0.9, times: [0, 0.14, 0.28, 0.42, 0.56, 1], repeat: beats - 1, ease: "easeOut" }}
    >
      {word}
    </motion.span>
  );
}

/* ========== WHISPER ==========
   Hushed words arrive small, soft, and breathy — wide-tracked, blurred at
   the edges, never fully solid. */
function WordWhisper({ word, airtime }: { word: string; airtime: number }) {
  return (
    <motion.span
      className="inline-block"
      style={{ fontWeight: 400 }}
      initial={{ opacity: 0, scale: 0.62, letterSpacing: "0.3em", filter: "blur(6px)" }}
      animate={{ opacity: 0.78, scale: 0.72, letterSpacing: "0.22em", filter: "blur(1.2px)" }}
      transition={{ duration: Math.min(1.2, Math.max(0.5, airtime * 0.6)), ease: "easeOut" }}
    >
      {word}
    </motion.span>
  );
}

/* ========== TAP EFFECTS ==========
   What tapping a word does is chosen PER SONG by the choreographer LLM —
   fire worlds burn (WordBurn above), breakup worlds shatter, dreamy worlds
   dissolve, love worlds bloom. */
function WordShatter({ word }: { word: string }) {
  const letters = [...word];
  const r = (i: number, m: number) => ((i * 61 + 17) % 83) / 83 * m;
  return (
    <span className="inline-flex">
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ x: "0em", y: "0em", rotate: 0, opacity: 1 }}
          animate={{
            x: `${(i % 2 ? 1 : -1) * (0.15 + r(i, 0.5))}em`,
            y: `${0.2 + r(i + 3, 0.7)}em`,
            rotate: (i % 2 ? 1 : -1) * (20 + r(i + 5, 50)),
            opacity: 0,
            color: "#ffffff",
            textShadow: "0 0 0.3em var(--theme-accent)",
          }}
          transition={{ duration: 0.75, delay: r(i + 7, 0.08), ease: [0.2, 0.6, 0.4, 1] }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

function WordDissolve({ word }: { word: string }) {
  const letters = [...word];
  return (
    <span className="inline-flex">
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
          animate={{ opacity: 0, y: "-0.45em", filter: "blur(7px)", letterSpacing: "0.1em" }}
          transition={{ duration: 1.1, delay: i * 0.05, ease: "easeOut" }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

function WordBloom({ word }: { word: string }) {
  const r = (i: number, m: number) => ((i * 47 + 13) % 71) / 71 * m;
  return (
    <span className="relative inline-flex items-center justify-center">
      <motion.span
        className="inline-block"
        animate={{ color: "#ffb7d5", scale: [1, 1.08, 1.02], textShadow: "0 0 0.5em rgba(255,150,200,0.8)" }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      >
        {word}
      </motion.span>
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute"
          style={{
            left: `${10 + ((i * 71) % 80)}%`, top: "45%",
            width: "0.09em", height: "0.13em", borderRadius: "60% 40% 55% 45%",
            background: i % 2 ? "#ffb7d5" : "color-mix(in srgb, var(--theme-accent) 70%, white)",
          }}
          initial={{ opacity: 0, y: "0em", scale: 0.4, rotate: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [`0em`, `-${0.4 + r(i, 0.5)}em`, `${0.3 + r(i + 2, 0.5)}em`],
            x: [`0em`, `${(i % 2 ? 1 : -1) * r(i + 4, 0.35)}em`],
            rotate: (i % 2 ? 1 : -1) * (60 + r(i + 6, 120)),
            scale: 1,
          }}
          transition={{ duration: 1.5, delay: r(i + 8, 0.25), ease: "easeOut" }}
        />
      ))}
    </span>
  );
}

/* ========== FREEZE ==========
   Cold words ice over: a frost-blue tint sweeps in, the letters give one small
   shiver, then lock rigid under a crystalline rime. A few frost specks bloom at
   the edges. Blur is animated once on the way in (short, one-shot) — never held. */
function WordFreeze({ word, airtime }: { word: string; airtime: number }) {
  const dur = Math.min(1.6, Math.max(0.8, airtime * 0.9));
  const r = (i: number, m: number) => ((i * 59 + 23) % 79) / 79 * m;
  return (
    <span className="relative inline-flex items-center justify-center">
      <motion.span
        className="inline-block"
        initial={{ color: "#ffffff", x: "0em" }}
        animate={{
          color: ["#ffffff", "#dbeeff", "#bfe2f7", "#a9d6f2"],
          x: ["0em", "-0.02em", "0.02em", "-0.01em", "0em"],
          textShadow: [
            "0 0 0em transparent",
            "0 0 0.25em #bfe2f7, 0 0 0.05em #ffffff",
            "0 0 0.4em #9cc4e4, 0 0 0.08em #ffffff",
            "0 0 0.45em #9cc4e4, 0 0 0.1em #eaf6ff",
          ],
          filter: ["blur(0.6px)", "blur(0px)", "blur(0px)", "blur(0px)"],
        }}
        transition={{ duration: dur, times: [0, 0.35, 0.7, 1], ease: "easeOut" }}
      >
        {word}
      </motion.span>
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${10 + ((i * 71) % 80)}%`,
            top: `${20 + ((i * 43) % 60)}%`,
            width: `${0.03 + r(i, 0.03)}em`,
            height: `${0.03 + r(i, 0.03)}em`,
            background: "#eaf6ff",
            boxShadow: "0 0 0.1em #bfe2f7",
          }}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 0.9, 0.7], scale: [0.3, 1, 1] }}
          transition={{ duration: dur, delay: 0.2 + (i % 5) * (dur * 0.09), ease: "easeOut" }}
        />
      ))}
    </span>
  );
}

/* ========== MELT ==========
   Heat words run: each letter sags on its own delay, stretching downward as its
   color bleeds warm, then drips off the baseline. A couple of drops fall clear. */
function WordMelt({ word, airtime }: { word: string; airtime: number }) {
  const letters = [...word];
  const dur = Math.min(1.8, Math.max(1.0, airtime * 0.95));
  const r = (i: number, m: number) => ((i * 67 + 31) % 89) / 89 * m;
  return (
    <span className="relative inline-flex">
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block origin-top"
          initial={{ y: "0em", scaleY: 1, color: "#ffffff", opacity: 1 }}
          animate={{
            y: ["0em", "0.04em", `${0.14 + r(i, 0.12)}em`, `${0.4 + r(i + 3, 0.3)}em`],
            scaleY: [1, 1.12, 1.5, 2.1],
            color: ["#ffffff", "#ffe0b0", "#ffb060", "#c86a2a"],
            opacity: [1, 1, 0.9, 0],
            filter: ["blur(0px)", "blur(0px)", "blur(0.6px)", "blur(2px)"],
          }}
          transition={{ duration: dur, times: [0, 0.3, 0.65, 1], delay: r(i + 5, 0.18), ease: "easeIn" }}
        >
          {ch}
        </motion.span>
      ))}
      {Array.from({ length: 5 }).map((_, i) => (
        <motion.span
          key={`d${i}`}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${18 + ((i * 59) % 64)}%`,
            top: "60%",
            width: `${0.04 + r(i, 0.03)}em`,
            height: `${0.06 + r(i, 0.05)}em`,
            background: "#ffb060",
            boxShadow: "0 0 0.08em #ff8a3c",
          }}
          initial={{ opacity: 0, y: "0em", scaleY: 1 }}
          animate={{ opacity: [0, 0.9, 0], y: ["0em", `${0.5 + r(i + 2, 0.5)}em`], scaleY: [1, 1.6, 1] }}
          transition={{ duration: dur, delay: dur * 0.4 + (i % 4) * (dur * 0.1), ease: "easeIn" }}
        />
      ))}
    </span>
  );
}

/* ========== CARVE ==========
   Permanent words are struck into stone: a chisel-hit jolt on arrival, a puff of
   grey dust, then the letters settle engraved — an inset shadow that reads as
   depth cut into the frame. Slow, heavy, final. */
function WordCarve({ word, airtime }: { word: string; airtime: number }) {
  const r = (i: number, m: number) => ((i * 53 + 19) % 73) / 73 * m;
  const settled = Math.min(1.4, Math.max(0.7, airtime * 0.8));
  return (
    <span className="relative inline-flex items-center justify-center">
      <motion.span
        className="inline-block"
        initial={{ scale: 1.12, y: "-0.03em", color: "#ffffff" }}
        animate={{
          scale: [1.12, 0.985, 1, 1],
          y: ["-0.03em", "0.015em", "0em", "0em"],
          x: ["0.02em", "-0.015em", "0.006em", "0em"],
          color: ["#ffffff", "#e6e2da", "#d8d2c6", "#cfc8ba"],
          textShadow: [
            "0 0 0.4em #ffffff",
            "0.015em 0.015em 0 rgba(0,0,0,0.55), -0.01em -0.01em 0 rgba(255,255,255,0.35)",
            "0.02em 0.02em 0.01em rgba(0,0,0,0.6), -0.012em -0.012em 0 rgba(255,255,255,0.4)",
            "0.02em 0.02em 0.01em rgba(0,0,0,0.6), -0.012em -0.012em 0 rgba(255,255,255,0.4)",
          ],
        }}
        transition={{ duration: settled, times: [0, 0.18, 0.4, 1], ease: "easeOut" }}
      >
        {word}
      </motion.span>
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${20 + ((i * 61) % 60)}%`,
            top: "52%",
            width: `${0.03 + r(i, 0.035)}em`,
            height: `${0.03 + r(i, 0.035)}em`,
            background: i % 2 ? "#b8b0a2" : "#8f887c",
          }}
          initial={{ opacity: 0, y: "0em", x: "0em" }}
          animate={{
            opacity: [0, 0.85, 0],
            y: ["0em", `${0.2 + r(i + 2, 0.4)}em`, `${0.5 + r(i + 4, 0.5)}em`],
            x: ["0em", `${(i % 2 ? 1 : -1) * (0.1 + r(i + 6, 0.3))}em`],
          }}
          transition={{ duration: settled * 0.9, delay: 0.06 + (i % 6) * 0.02, ease: "easeOut" }}
        />
      ))}
    </span>
  );
}

/* ========== SHIMMER ==========
   Luxe words catch the light: a gold-leaf gradient fills the letters and a bright
   highlight sweeps across them left-to-right, twice. */
function WordShimmer({ word, airtime }: { word: string; airtime: number }) {
  const dur = Math.min(2.2, Math.max(1.1, airtime));
  return (
    <motion.span
      className="inline-block bg-clip-text"
      style={{
        color: "transparent",
        backgroundImage: "linear-gradient(100deg, #b8860b 0%, #ffe9a8 42%, #fffbe6 50%, #ffe9a8 58%, #b8860b 100%)",
        backgroundSize: "300% 100%",
        WebkitBackgroundClip: "text",
         
      } as any}
      initial={{ backgroundPositionX: "120%" }}
      animate={{ backgroundPositionX: ["120%", "-20%", "120%", "50%"], textShadow: ["0 0 0.2em rgba(255,220,140,0.0)", "0 0 0.35em rgba(255,220,140,0.55)", "0 0 0.2em rgba(255,220,140,0.2)", "0 0 0.25em rgba(255,220,140,0.35)"] }}
      transition={{ duration: dur, times: [0, 0.4, 0.8, 1], ease: "easeInOut" }}
    >
      {word}
    </motion.span>
  );
}

/* ========== RISE ==========
   Uplift words float up and lift free — each letter drifts in from below on its
   own delay, then keeps rising a touch, weightless. */
function WordRise({ word, airtime }: { word: string; airtime: number }) {
  const letters = [...word];
  const dur = Math.min(1.8, Math.max(1.0, airtime));
  const r = (i: number, m: number) => ((i * 57 + 19) % 71) / 71 * m;
  return (
    <span className="inline-flex">
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ y: `${0.5 + r(i, 0.2)}em`, opacity: 0, filter: "blur(2px)" }}
          animate={{ y: [`${0.5 + r(i, 0.2)}em`, "0em", `-${0.06 + r(i, 0.05)}em`], opacity: [0, 1, 1], filter: ["blur(2px)", "blur(0px)", "blur(0px)"] }}
          transition={{ duration: dur, times: [0, 0.55, 1], delay: i * 0.045, ease: "easeOut" }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

/* ========== FALL ==========
   Gravity words sink: they arrive from just above, land, then sag and drop away
   heavily as they fade — letters staggered so the word crumbles downward. */
function WordFall({ word, airtime }: { word: string; airtime: number }) {
  const letters = [...word];
  const dur = Math.min(1.9, Math.max(1.0, airtime));
  const r = (i: number, m: number) => ((i * 63 + 29) % 83) / 83 * m;
  return (
    <span className="inline-flex">
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ y: `-${0.28 + r(i, 0.12)}em`, opacity: 0 }}
          animate={{ y: [`-${0.28 + r(i, 0.12)}em`, "0em", "0em", `${0.55 + r(i, 0.4)}em`], opacity: [0, 1, 1, 0], filter: ["blur(1px)", "blur(0px)", "blur(0px)", "blur(2px)"] }}
          transition={{ duration: dur, times: [0, 0.28, 0.62, 1], delay: 0.05 + i * 0.05, ease: "easeIn" }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

/* ========== ECHO ==========
   Reverb words repeat: the word holds while two ghost copies fan outward and
   fade, like a call bouncing off distance. */
function WordEcho({ word, airtime }: { word: string; airtime: number }) {
  const dur = Math.min(2.0, Math.max(1.0, airtime));
  return (
    <span className="relative inline-flex items-center justify-center">
      <motion.span className="inline-block" initial={{ opacity: 0.9 }} animate={{ opacity: 1 }}>{word}</motion.span>
      {[1, 2].map((n) => (
        <motion.span
          key={n}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ color: "var(--theme-accent)" }}
          initial={{ opacity: 0.4, scale: 1, x: "0em" }}
          animate={{ opacity: 0, scale: 1 + n * 0.14, x: `${n * 0.18}em`, filter: `blur(${n}px)` }}
          transition={{ duration: dur, delay: n * 0.18, ease: "easeOut", repeat: airtime > 1.7 ? 1 : 0, repeatDelay: 0.1 }}
          aria-hidden
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

/* ========== TREMOR ==========
   Anxious words tremble: a fast, small, jittery shake that never quite settles,
   with a faint blur on the hardest shudders. */
function WordTremor({ word, airtime }: { word: string; airtime: number }) {
  const dur = Math.min(1.4, Math.max(0.7, airtime * 0.9));
  return (
    <motion.span
      className="inline-block"
      animate={{
        x: ["0em", "0.02em", "-0.025em", "0.018em", "-0.02em", "0.012em", "-0.015em", "0em"],
        y: ["0em", "-0.015em", "0.02em", "-0.01em", "0.015em", "-0.008em", "0.01em", "0em"],
        rotate: [0, 0.8, -1, 0.6, -0.8, 0.4, -0.5, 0],
        filter: ["blur(0px)", "blur(0.4px)", "blur(0px)", "blur(0.3px)", "blur(0px)", "blur(0.2px)", "blur(0px)", "blur(0px)"],
      }}
      transition={{ duration: dur, times: [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.85, 1], ease: "linear", repeat: airtime > 1.4 ? 1 : 0 }}
    >
      {word}
    </motion.span>
  );
}

/* ========== REDACT ==========
   Secret words get censored: the word lands readable, then a black bar slams
   across it left-to-right and it stays struck out — classified. */
function WordRedact({ word, airtime }: { word: string; airtime: number }) {
  const dur = Math.min(1.8, Math.max(0.9, airtime));
  return (
    <span className="relative inline-flex items-center justify-center">
      <motion.span className="inline-block" initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0.4] }} transition={{ duration: dur, times: [0, 0.2, 0.45, 0.7] }}>
        {word}
      </motion.span>
      <motion.span
        className="pointer-events-none absolute -inset-x-[0.1em] inset-y-[0.08em] origin-left rounded-[0.06em]"
        style={{ background: "#0b0b0e", boxShadow: "0 0 0.1em rgba(0,0,0,0.85), inset 0 0 0.06em rgba(255,255,255,0.1)" }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 0, 1, 1], opacity: [0, 0, 1, 0.94] }}
        transition={{ duration: dur, times: [0, 0.45, 0.62, 1], ease: [0.7, 0, 0.2, 1] }}
        aria-hidden
      />
    </span>
  );
}

/* ========== CHROMATIC ==========
   Analog-memory words split into red/cyan ghosts that jitter apart like a
   worn VHS tape, then lock back into register. */
function WordChromatic({ word, airtime }: { word: string; airtime: number }) {
  const dur = Math.min(1.6, Math.max(0.9, airtime));
  return (
    <span className="relative inline-flex items-center justify-center">
      <motion.span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden
        style={{ color: "#ff3b52", mixBlendMode: "screen" }}
        initial={{ x: "-0.07em", y: "0.01em", opacity: 0.85 }}
        animate={{ x: ["-0.07em", "0.05em", "-0.035em", "0.015em", "0em"], y: ["0.01em", "-0.02em", "0.012em", "0em", "0em"], opacity: [0.85, 0.75, 0.6, 0.4, 0] }}
        transition={{ duration: dur, times: [0, 0.3, 0.55, 0.8, 1], ease: "easeOut" }}>
        {word}
      </motion.span>
      <motion.span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden
        style={{ color: "#2ee6ff", mixBlendMode: "screen" }}
        initial={{ x: "0.07em", y: "-0.01em", opacity: 0.85 }}
        animate={{ x: ["0.07em", "-0.05em", "0.035em", "-0.015em", "0em"], y: ["-0.01em", "0.02em", "-0.012em", "0em", "0em"], opacity: [0.85, 0.75, 0.6, 0.4, 0] }}
        transition={{ duration: dur, times: [0, 0.3, 0.55, 0.8, 1], ease: "easeOut" }}>
        {word}
      </motion.span>
      <motion.span className="inline-block" initial={{ opacity: 0.55 }} animate={{ opacity: 1 }} transition={{ duration: dur * 0.6 }}>
        {word}
      </motion.span>
    </span>
  );
}

/* ========== LIQUID ==========
   Water rises inside the letterforms: the word stands as an empty vessel and
   fills bottom-up with a sea gradient, wobbling as the level climbs. */
function WordLiquid({ word, airtime }: { word: string; airtime: number }) {
  const dur = Math.min(2.2, Math.max(1.2, airtime));
  return (
    <span className="relative inline-flex items-center justify-center">
      <span className="inline-block opacity-30">{word}</span>
      <motion.span
        className="pointer-events-none absolute inset-0 flex items-center justify-center bg-clip-text"
        style={{
          color: "transparent",
          backgroundImage: "linear-gradient(to top, #0b5f8a 0%, #2fa3d8 55%, #9fe0ff 100%)",
          WebkitBackgroundClip: "text",
        }}
        initial={{ clipPath: "inset(100% 0 0 0)" }}
        animate={{ clipPath: ["inset(100% 0 0 0)", "inset(58% 0 0 0)", "inset(66% 0 0 0)", "inset(30% 0 0 0)", "inset(38% 0 0 0)", "inset(0 0 0 0)"] }}
        transition={{ duration: dur, times: [0, 0.3, 0.42, 0.62, 0.72, 1], ease: "easeInOut" }}
        aria-hidden
      >
        {word}
      </motion.span>
    </span>
  );
}

/* ========== BLEED ==========
   Wounded words weep: a deep-red copy soaks through the word while thin drips
   run down from under the letters. The base word keeps the theme color. */
function WordBleed({ word, airtime }: { word: string; airtime: number }) {
  const dur = Math.min(2.0, Math.max(1.0, airtime));
  return (
    <span className="relative inline-flex items-center justify-center">
      <span className="inline-block">{word}</span>
      <motion.span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden
        style={{ color: "#a11620" }}
        initial={{ opacity: 0, y: "0em" }}
        animate={{ opacity: [0, 0.85, 0.92], y: ["0em", "0.008em", "0.014em"], textShadow: ["0 0 0em rgba(190,25,35,0)", "0 0 0.28em rgba(200,30,40,0.55)", "0 0 0.2em rgba(160,20,30,0.45)"] }}
        transition={{ duration: dur * 0.75, times: [0, 0.55, 1], ease: "easeIn" }}>
        {word}
      </motion.span>
      {[0.24, 0.55, 0.78].map((p, n) => (
        <motion.span key={n} className="pointer-events-none absolute top-[76%] w-[0.045em] origin-top rounded-b-full" aria-hidden
          style={{ left: `${p * 100}%`, height: `${0.4 + n * 0.14}em`, background: "linear-gradient(to bottom, #a11620, #5c0e12)" }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: [0, 0.45 + n * 0.2, 1], opacity: [0, 0.85, 0.7] }}
          transition={{ duration: dur * 0.9, times: [0, 0.5, 1], delay: 0.3 + n * 0.16, ease: "easeIn" }} />
      ))}
    </span>
  );
}

/* ========== HANDWRITE ==========
   Vow words write themselves on in script, revealed left-to-right behind a
   glowing pen-point that rides the ink edge. Duration scales with length —
   long promises take longer to sign. */
function WordHandwrite({ word }: { word: string }) {
  const dur = Math.min(1.6, Math.max(0.6, word.length * 0.09));
  return (
    <span className="relative inline-flex items-center justify-center"
      style={{ fontFamily: '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive' }}>
      <motion.span className="inline-block"
        initial={{ clipPath: "inset(-20% 100% -20% 0)" }}
        animate={{ clipPath: "inset(-20% -5% -20% 0)" }}
        transition={{ duration: dur, ease: "linear" }}>
        {word}
      </motion.span>
      <motion.span className="pointer-events-none absolute top-1/2 h-[0.08em] w-[0.08em] -translate-y-1/2 rounded-full" aria-hidden
        style={{ background: "currentColor", boxShadow: "0 0 0.35em currentColor" }}
        initial={{ left: "0%", opacity: 0.9 }}
        animate={{ left: "102%", opacity: [0.9, 0.9, 0] }}
        transition={{ duration: dur, ease: "linear", times: [0, 0.92, 1] }} />
    </span>
  );
}

/* ========== TV-OFF ==========
   Final words switch off like an old CRT: flash on from a scanline, hold,
   then collapse back to a bright line, then to a dot that dies out. */
function WordTVOff({ word, airtime }: { word: string; airtime: number }) {
  const dur = Math.min(2.2, Math.max(1.1, airtime));
  return (
    <span className="relative inline-flex items-center justify-center">
      <motion.span className="inline-block"
        initial={{ scaleY: 0.03, scaleX: 1.08, opacity: 0 }}
        animate={{
          scaleY: [0.03, 1, 1, 1, 0.02, 0.02],
          scaleX: [1.08, 1, 1, 1, 1, 0.03],
          opacity: [0.8, 1, 1, 1, 1, 0],
          filter: ["brightness(3)", "brightness(1)", "brightness(1)", "brightness(1)", "brightness(4)", "brightness(6)"],
        }}
        transition={{ duration: dur, times: [0, 0.12, 0.5, 0.74, 0.84, 1], ease: "easeInOut" }}>
        {word}
      </motion.span>
      {/* the dying phosphor dot */}
      <motion.span className="pointer-events-none absolute h-[0.07em] w-[0.07em] rounded-full bg-white" aria-hidden
        style={{ boxShadow: "0 0 0.3em rgba(255,255,255,0.9)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.95, 0] }}
        transition={{ duration: dur, times: [0, 0.86, 0.93, 1] }} />
    </span>
  );
}

/* ========== MIC PRIMER ==========
   Songs with blow moments ask for the mic ONCE, right at the start of the
   show — never mid-song. Once granted (this session or any earlier one),
   the moment itself auto-arms with no interruption at all. */
async function micPermissionGranted(): Promise<boolean> {
  try {
    const st = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return st.state === "granted";
  } catch { return false; }
}
function MicPrimer({ active }: { active: boolean }) {
  // "unknown" until checked; primer shows only when permission isn't granted yet.
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) { setShow(false); return; }
    let on = true;
    micPermissionGranted().then((ok) => { if (on) setShow(!ok); });
    return () => { on = false; };
  }, [active]);
  const prime = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop()); // permission secured; mic off again immediately
    } catch { /* declined — the moment will fall back to tap */ }
    setShow(false);
  };
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          transformTemplate={centerX}
          className="fixed left-1/2 top-20 z-[45] w-max max-w-[90vw] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/70 px-6 py-4 text-center backdrop-blur-md"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ delay: 0.8, duration: 0.7 }}
        >
          <p className="font-display text-sm font-black uppercase tracking-wide text-white sm:text-base">🎙️ This song has mic moments</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">blow &amp; shout along — enable your mic</p>
          <button onClick={prime} className="mt-3 rounded-full px-6 py-2 font-display text-xs font-bold uppercase tracking-wider text-black transition hover:brightness-110" style={{ background: "var(--theme-primary)" }}>
            Enable mic
          </button>
          <button onClick={() => setShow(false)} className="mt-2 block w-full font-mono text-[9px] uppercase tracking-widest text-white/40 hover:text-white/70">skip</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ========== BLOW MOMENT ==========
   A WarioWare-style beat: at a choreographed point the show asks the
   listener to BLOW into the mic (blow out the candle, scatter the ash).
   If permission was granted up-front (MicPrimer), it AUTO-ARMS — zero
   mid-song interruption. Detection = sustained broadband low-frequency
   energy; everything stops when the moment ends. Mic unavailable? Tap. */
function BlowMoment({ moment, onGust }: { moment: { prompt: string } | null; onGust: () => void }) {
  const [state, setState] = useState<"idle" | "listening" | "done" | "denied">("idle");
  const cleanupRef = useRef<() => void>(() => {});
  const startRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!moment) { cleanupRef.current(); setState("idle"); return () => cleanupRef.current(); }
    // Auto-arm when permission already exists — no tap, no interruption.
    let on = true;
    micPermissionGranted().then((ok) => { if (on && ok) startRef.current(); });
    return () => { on = false; cleanupRef.current(); };
  }, [moment]);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      let hot = 0; let raf = 0;
      const cleanup = () => { cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); ctx.close().catch(() => {}); };
      cleanupRef.current = cleanup;
      setState("listening");
      const loop = () => {
        an.getByteFrequencyData(buf);
        let low = 0;
        for (let i = 1; i < 40; i++) low += buf[i];
        low /= 40 * 255;
        hot = low > 0.5 ? hot + 1 : Math.max(0, hot - 1);
        if (hot > 10) { setState("done"); onGust(); cleanup(); return; }
        raf = requestAnimationFrame(loop);
      };
      loop();
    } catch { setState("denied"); }
  };
  startRef.current = start;
  return (
    <AnimatePresence>
      {moment && state !== "done" && (
        <motion.button
          key={moment.prompt}
          onClick={state === "listening" ? undefined : state === "denied" ? onGust : start}
          transformTemplate={centerX}
          className="stage-warn-pill fixed left-1/2 top-[15vh] z-[38] flex w-max max-w-[92vw] -translate-x-1/2 flex-col items-center gap-1.5 rounded-[2rem] px-8 py-5 text-center"
          initial={{ opacity: 0, y: -18, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
        >
          <span className="stage-warn text-3xl sm:text-5xl">
            {state === "listening" ? "🌬️ BLOW NOW!" : "🌬️ BLOW!"}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/80 sm:text-sm">
            {state === "idle" && <>{moment.prompt} — tap to ready the mic</>}
            {state === "listening" && <>{moment.prompt}</>}
            {state === "denied" && <>{moment.prompt} — tap!</>}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* ========== SCREAM MOMENT ==========
   The mirror of BlowMoment. At a choreographed point (the chorus) the show
   asks the listener to SCREAM into the mic — shout "GOOOLD" — and a gold
   supernova detonates on the payoff. Detection = sustained BROADBAND loudness
   (a real shout lights the whole spectrum), deliberately a higher bar than
   blow's low-frequency breath so the two never cross-trigger. Auto-arms when
   the mic is already granted; falls back to a tap if the mic is unavailable. */
function ScreamMoment({ moment, onScream }: { moment: { prompt: string; shout: string } | null; onScream: () => void }) {
  const [state, setState] = useState<"idle" | "listening" | "done" | "denied">("idle");
  const cleanupRef = useRef<() => void>(() => {});
  const startRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!moment) { cleanupRef.current(); setState("idle"); return () => cleanupRef.current(); }
    let on = true;
    micPermissionGranted().then((ok) => { if (on && ok) startRef.current(); });
    return () => { on = false; cleanupRef.current(); };
  }, [moment]);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      let hot = 0; let raf = 0;
      const cleanup = () => { cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); ctx.close().catch(() => {}); };
      cleanupRef.current = cleanup;
      setState("listening");
      const loop = () => {
        an.getByteFrequencyData(buf);
        // Broadband energy (skip the lowest breath bins so a blow can't win it).
        let band = 0;
        for (let i = 8; i < 300; i++) band += buf[i];
        band /= (300 - 8) * 255;
        hot = band > 0.4 ? hot + 1 : Math.max(0, hot - 2);
        if (hot > 8) { setState("done"); onScream(); cleanup(); return; }
        raf = requestAnimationFrame(loop);
      };
      loop();
    } catch { setState("denied"); }
  };
  startRef.current = start;
  return (
    <AnimatePresence>
      {moment && state !== "done" && (
        <motion.button
          key={moment.prompt}
          onClick={state === "listening" ? undefined : state === "denied" ? onScream : start}
          transformTemplate={centerX}
          className="stage-warn-pill fixed left-1/2 top-[15vh] z-[38] flex w-max max-w-[92vw] -translate-x-1/2 flex-col items-center gap-1.5 rounded-[2rem] px-8 py-5 text-center"
          initial={{ opacity: 0, y: -18, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: state === "listening" ? [1, 1.06, 1] : 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 22, scale: state === "listening" ? { duration: 0.6, repeat: Infinity } : undefined }}
        >
          <span className="stage-warn text-4xl sm:text-6xl" style={{ color: "var(--theme-primary)" }}>
            {state === "listening" ? `🔥 ${moment.shout}!` : "🎤 SCREAM!"}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/80 sm:text-sm">
            {state === "idle" && <>{moment.prompt} — tap to ready the mic</>}
            {state === "listening" && <>{moment.prompt}</>}
            {state === "denied" && <>{moment.prompt} — tap!</>}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* ========== WIPE LAYER ==========
   A choreographed moment: a themed veil (fog, ash, frost, steam, static, mud,
   dust, smoke, void) creeps IN from the edges — NOT a full-screen slab. It
   rolls in gradually (framer opacity+creep, so the one-time grain paint lands
   while invisible → no arrival hitch), leaves the center stage clear so the
   words stay readable, and once the listener wipes ~a third of it away the
   sound snaps back and the rest dissolves on its own. */
function WipeLayer({ moment, onProgress, onReleased, lite = false }: { moment: { layer: string; prompt: string } | null; onProgress?: (cleared: number) => void; onReleased?: () => void; lite?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!moment) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = (c.width = window.innerWidth), h = (c.height = window.innerHeight);
    const spec = VEIL_SPECS[moment.layer as VeilKind] ?? VEIL_SPECS.fog;
    const [c0, c1] = spec.colors;
    const grainPx = (spec.grain === "static" ? 3 : spec.grain === "blobs" ? 4 : 2) + (lite ? 1 : 0);
    // Screen-filling fog, visible EVERYWHERE (lighter over the center so the
    // words still read, denser toward the edges). A pale underlay guarantees it
    // shows even when the veil's own color is dark (ash/void/smoke) on a dark
    // scene — the old clear-core veil read as "no fog at all".
    const cx = w / 2, cy = h * 0.46;
    const coreR = Math.min(w, h) * 0.14;          // small soft eye at center
    const edgeR = Math.hypot(w, h) * 0.62;        // reaches the corners
    const under = ctx.createRadialGradient(cx, cy, coreR, cx, cy, edgeR);
    under.addColorStop(0, "rgba(206,212,222,0.24)");
    under.addColorStop(1, "rgba(206,212,222,0.42)");
    ctx.fillStyle = under; ctx.fillRect(0, 0, w, h);
    const base = ctx.createRadialGradient(cx, cy, coreR, cx, cy, edgeR);
    base.addColorStop(0, hexAlpha(c0, 0.30));
    base.addColorStop(0.55, hexAlpha(c0, 0.62));
    base.addColorStop(1, hexAlpha(c1, 0.85));
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    // Grain across the whole veil (paints under opacity 0, so no arrival hitch).
    const grains = lite ? 320 : 1200;
    for (let i = 0; i < grains; i++) {
      const gx = (i * 977) % w, gy = (i * 613) % h;
      ctx.globalAlpha = 0.04 + (i % 7) * 0.02;
      ctx.fillStyle = i % 2 ? "#ffffff" : "#000000";
      ctx.fillRect(gx, gy, grainPx, grainPx);
    }
    ctx.globalAlpha = 1;
    // Progress is measured against the whole (now screen-filling) veil.
    const veiledArea = w * h;
    let clearedPx = 0, strokes = 0, released = false, lastErase = 0;
    // Auto-clear the whole veil after 5s even if untouched — whichever comes
    // first, 25% wiped (below) or this timer, frees the sound and dissolves it.
    const autoClear = setTimeout(() => {
      if (!released) { released = true; onProgress?.(1); onReleased?.(); }
    }, 5000);
    const erase = (e: PointerEvent) => {
      if (released) return;
      if (e.pointerType === "mouse" && e.buttons === 0) return;
      const now = e.timeStamp || performance.now();
      if (lite && now - lastErase < 16) return;     // throttle to ~1 erase/frame
      lastErase = now;
      ctx.globalCompositeOperation = "destination-out";
      const R = Math.max(56, window.innerWidth * 0.055);
      clearedPx += Math.PI * R * R * 0.35;          // overlap-discounted estimate
      const cleared = Math.min(1, clearedPx / veiledArea);
      if (++strokes % 4 === 0) onProgress?.(cleared);
      if (lite) {
        ctx.globalAlpha = 0.85; ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(e.clientX, e.clientY, R, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        const g = ctx.createRadialGradient(e.clientX, e.clientY, R * 0.15, e.clientX, e.clientY, R);
        g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(e.clientX, e.clientY, R, 0, 7); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      // A quarter cleared: free the sound and let the rest dissolve on its own.
      if (!released && cleared >= 0.25) { released = true; onProgress?.(1); onReleased?.(); }
    };
    window.addEventListener("pointermove", erase);
    window.addEventListener("pointerdown", erase);
    return () => { clearTimeout(autoClear); window.removeEventListener("pointermove", erase); window.removeEventListener("pointerdown", erase); };
  }, [moment, onProgress, onReleased, lite]);
  return (
    <AnimatePresence>
      {moment && (
        <motion.div
          key={`${moment.layer}${moment.prompt}`}
          className="fixed inset-0 z-[30]"
          // Gradual roll-in (creep + fade) and a slow dissolve on exit. The
          // grain is painted at opacity ~0, so the fog "comes" smoothly.
          initial={{ opacity: 0, scale: 1.12 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.6, ease: "easeInOut" } }}
          transition={{ duration: 2.6, ease: "easeOut" }}
          style={{ transformOrigin: "50% 46%" }}
        >
          <canvas ref={canvasRef} className="h-full w-full touch-none" />
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-[10vh] flex flex-col items-center gap-1.5 px-6"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <span className={`text-3xl sm:text-5xl${lite ? " stage-warn-static" : " stage-warn"}`}>✋ {moment.prompt}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/75 sm:text-sm">swipe a third of it away</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// #rrggbb → rgba() with alpha (veil spec colors are 6-digit hex).
function hexAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ========== ASSEMBLE ==========
   The default dynamic entrance. Letter j of word i flies in from angle
   (i + j)·137.508° — the golden angle, an irrational slice of the circle —
   so within a word AND across consecutive words, no two letters ever share
   an approach vector. The formula guarantees it; no randomness needed. */
function WordAssemble({ word, baseAngle, charged }: { word: string; baseAngle: number; charged: boolean }) {
  const letters = [...word];
  // Each letter flies in from its own golden-angle direction. This used to be a
  // per-letter Framer spring (one JS animation per letter, ticked on the main
  // thread every frame) — the biggest main-thread cost dynamic mode adds. Now
  // it's a single compositor-driven CSS keyframe (`assemble-in`): the start
  // vector/rotation/scale ride in as CSS vars, the browser animates transform +
  // opacity off the main thread. Identical motion, near-zero script/style cost.
  return (
    <span className="inline-flex">
      {letters.map((ch, j) => {
        const a = ((baseAngle + j * 137.50776405003785) * Math.PI) / 180;
        const d = (charged ? 1.7 : 1.15) + ((j * 37) % 23) / 23; // em flight distance
        return (
          <span
            key={j}
            className="assemble-letter"
            style={{
              // start-of-flight transform, consumed by the @keyframes
              ["--ax" as string]: `${(Math.cos(a) * d).toFixed(2)}em`,
              ["--ay" as string]: `${(Math.sin(a) * d * 0.8).toFixed(2)}em`,
              ["--arot" as string]: `${(j % 2 ? 1 : -1) * (8 + ((j * 13) % 14))}deg`,
              ["--asc" as string]: charged ? 1.6 : 0.75,
              animationDelay: `${(j * 0.022).toFixed(3)}s`,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

/* ========== CASCADE ==========
   Charged words (the brain's emotional picks) build letter by letter — each
   character pops up in sequence so the word assembles itself on the beat. */
function CascadeWord({ word }: { word: string }) {
  const letters = [...word];
  return (
    <span className="inline-flex">
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, y: "0.32em", rotate: i % 2 ? 5 : -5, scale: 0.7 }}
          animate={{ opacity: 1, y: "0em", rotate: 0, scale: 1 }}
          transition={{ delay: i * 0.045, type: "spring", stiffness: 480, damping: 22 }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

function WordMorph({ word, glyph, treatment }: { word: string; glyph: Glyph; treatment: SectionMotion }) {
  const t = MORPH_TIMING[treatment];
  return (
    <span className="relative inline-flex items-center justify-center">
      {/* the word: lands, then gives itself to the shape */}
      <motion.span
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: [1, 1, 0], scale: [1, 1, treatment === "shatter" ? 1.5 : 0.72] }}
        transition={{ duration: t.hold + t.morph * 0.6, times: [0, t.hold / (t.hold + t.morph * 0.6), 1], ease: "easeIn" }}
      >
        {word}
      </motion.span>
      {/* the glyph: draws itself on, inheriting the word's glow */}
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute"
        style={{ width: "1.2em", height: "1.2em" }}
        initial={{ opacity: 0, scale: 0.5, rotate: treatment === "shatter" ? -8 : 0 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: t.hold, duration: t.morph, ease: t.ease === "backOut" ? [0.34, 1.56, 0.64, 1] : "easeInOut" }}
        aria-label={glyph.id}
      >
        <motion.path
          d={glyph.path}
          fillRule={glyph.fillRule}
          stroke="var(--theme-accent)"
          strokeWidth={3}
          fill="var(--theme-primary)"
          initial={{ pathLength: 0, fillOpacity: 0 }}
          animate={{ pathLength: 1, fillOpacity: 0.9 }}
          transition={{ delay: t.hold, duration: t.morph, ease: "easeInOut", fillOpacity: { delay: t.hold + t.morph * 0.5, duration: t.morph * 0.6 } }}
        />
      </motion.svg>
    </span>
  );
}
