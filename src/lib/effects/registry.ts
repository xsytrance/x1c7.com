// ═══════════════════════════════════════════════════════════════════════════
// THE EFFECT REGISTRY — the single manifest of every visual "lego" the show can
// pull from. This is the socket. Adding a new effect = adding a row here; the
// stage, the Lexicon, and (eventually) other creators' galaxies all read it.
//
// The key idea: effects are NOT one kind of thing. They fall into physics
// CLASSES that move differently and render differently. Pretending mud (which
// creeps up a wall) and snow (which falls through air) are the same primitive
// is what makes an effect system rigid. So we name the classes:
//
//   • airborne    — snow, ash, embers, dust, petals, pollen, sparks, bubbles.
//                    Particles that travel through the air. (KineticParticles.)
//   • volumetric  — fog, smoke, steam, haze. A veil that fills space. (WipeLayer.)
//   • surface     — mud, rust, cracks, condensation, vines, moss. They cling to
//                    the glass and creep from the edges. (SurfaceEffects.)
//   • light       — god-rays, flare, bloom, flicker, blackout. Grades the frame.
//   • textbound   — burn, shatter, dissolve, bloom. Effects that attach to WORDS.
//
// Every lego carries `tags` — the vocabulary that summons it — so a song's
// themes OR a single Lexicon word can light it up.
// ═══════════════════════════════════════════════════════════════════════════

import { particleModeFor, type ParticleMode } from "@/components/KineticParticles";

export type EffectClass = "airborne" | "volumetric" | "surface" | "light" | "textbound";

export type SurfaceMode =
  | "mud" | "rust" | "cracks" | "condensation" | "vines" | "moss" | "blood" | "sand";

export type VeilKind =
  | "fog" | "ash" | "frost" | "steam" | "static" | "mud" | "dust" | "smoke" | "void";

export type TextEffect =
  | "burn" | "shatter" | "dissolve" | "bloom" | "glitch" | "freeze" | "melt" | "carve"
  // Rendered "signature" word treatments the stage matches to a live vocabulary.
  // These share the same manifest so a vibe/preset or a per-word override can pick
  // any of them (see WORD_FX in KineticStage — the single id→component render map).
  | "slam" | "wave" | "neon" | "pulse" | "whisper" | "fizz" | "type"
  // Override-summonable treatments (no automatic word trigger yet): the FX panel
  // and vibe builder can pin any of these to a word.
  | "shimmer" | "rise" | "fall" | "echo" | "tremor"
  // Tranche 3 (Pillar 1): secrecy, analog memory, water, and blood.
  | "redact" | "chromatic" | "liquid" | "bleed"
  // Tranche 4 (Pillar 1 complete): the written word, and the final cut to dark.
  | "handwrite" | "tvoff"
  // Tranche 5 (the SUMMER DRIP cut): the DJ's chop and the glossy drip.
  | "chop" | "drip";

/** Every TextEffect id, in a stable display order — the single list the FX panel
 *  and vibe builder render (so their pickers can never drift from the union). */
export const ALL_TEXT_EFFECTS: TextEffect[] = [
  "burn", "shatter", "dissolve", "bloom", "glitch", "freeze", "melt", "carve",
  "slam", "wave", "neon", "pulse", "whisper", "fizz", "type",
  "shimmer", "rise", "fall", "echo", "tremor",
  "redact", "chromatic", "liquid", "bleed",
  "handwrite", "tvoff",
  "chop", "drip",
];

export interface EffectLego {
  id: string;
  class: EffectClass;
  /** the effect primitive this id drives (mode name within its class) */
  mode: string;
  /** words that summon this effect — matched against song / word vocabulary */
  tags: string[];
  /** default palette hint (self-colored effects may ignore it) */
  palette?: string[];
  /** one-line description for the Lexicon browser */
  blurb: string;
}

// ── AIRBORNE ────────────────────────────────────────────────────────────────
const AIRBORNE: EffectLego[] = [
  { id: "air.embers", class: "airborne", mode: "embers", blurb: "Hot sparks rising off a fire.", tags: ["fire", "burn", "flame", "ember", "blaze", "match", "heat"] },
  { id: "air.ash", class: "airborne", mode: "ash", blurb: "Spent grey flakes drifting down — what's left after the fire.", tags: ["ash", "ashes", "cinder", "smoulder", "charred", "burnt", "soot", "regret", "ruin", "aftermath"] },
  { id: "air.rain", class: "airborne", mode: "rain", blurb: "Streaking rain — storms, rivers, tears.", tags: ["rain", "storm", "river", "ocean", "water", "sea", "tide", "drown", "flood", "tears", "cry"] },
  { id: "air.snow", class: "airborne", mode: "snow", blurb: "Soft snow — winter, frost, cold distance.", tags: ["snow", "winter", "frost", "cold", "ice", "freeze", "frozen", "blizzard", "numb"] },
  { id: "air.dust", class: "airborne", mode: "dust", blurb: "Fine dust motes — the neutral, ambient default.", tags: ["dust", "desert", "old", "faded", "memory", "empty"] },
  { id: "air.bubbles", class: "airborne", mode: "bubbles", blurb: "Rising bubbles — champagne, celebration, the club.", tags: ["champagne", "cocktail", "drink", "bubble", "party", "fizz", "celebrate", "toast", "club"] },
  { id: "air.sparks", class: "airborne", mode: "sparks", blurb: "Electric static — glitch, signal, the digital.", tags: ["glitch", "static", "signal", "wifi", "data", "code", "server", "digital", "circuit", "neon"] },
  { id: "air.petals", class: "airborne", mode: "petals", blurb: "Rose petals tumbling — romance, bloom, tenderness.", tags: ["rose", "petal", "bloom", "blossom", "flower", "garden", "romance", "amor", "love", "valentine"] },
  { id: "air.pollen", class: "airborne", mode: "pollen", blurb: "Golden pollen suspended in warm light — summer, haze, honey.", tags: ["pollen", "meadow", "field", "dandelion", "wheat", "honey", "golden", "sunlit", "hazy", "summer"] },
];

// ── VOLUMETRIC (veils you wipe away) ─────────────────────────────────────────
export interface VeilSpec {
  colors: [string, string];
  /** grain style painted into the veil */
  grain: "dots" | "static" | "blobs";
}
export const VEIL_SPECS: Record<VeilKind, VeilSpec> = {
  fog: { colors: ["#a8b2bc", "#87929e"], grain: "dots" },
  ash: { colors: ["#241f1c", "#443a33"], grain: "dots" },
  frost: { colors: ["#cfe6f5", "#9cc4e4"], grain: "dots" },
  steam: { colors: ["#d8d8d8", "#b9b9b9"], grain: "dots" },
  static: { colors: ["#101010", "#2e2e2e"], grain: "static" },
  mud: { colors: ["#3a2b1e", "#5c4326"], grain: "blobs" },
  dust: { colors: ["#7a6f5c", "#a89877"], grain: "dots" },
  smoke: { colors: ["#2a2a2e", "#4a4a52"], grain: "blobs" },
  // The void: near-black with a faint molten under-glow. Wipe it away and the
  // gold backdrop beneath is revealed — "del vacío hasta el oro".
  void: { colors: ["#050403", "#140d05"], grain: "dots" },
};
const VOLUMETRIC: EffectLego[] = (Object.keys(VEIL_SPECS) as VeilKind[]).map((k) => ({
  id: `veil.${k}`, class: "volumetric" as const, mode: k,
  blurb: `A ${k} veil the listener wipes away.`, tags: [k],
}));

// ── SURFACE (they cling to the glass and creep from the edges) ───────────────
export interface SurfaceSpec {
  /** patch colors, darkest → lightest */
  colors: string[];
  /** how the growth reads */
  form: "splotch" | "crack" | "droplet" | "tendril";
  /** edges it grows from */
  from: ("bottom" | "top" | "left" | "right")[];
}
export const SURFACE_SPECS: Record<SurfaceMode, SurfaceSpec> = {
  mud: { colors: ["#241a10", "#3d2c19", "#5c4326"], form: "splotch", from: ["bottom"] },
  rust: { colors: ["#3d1e0e", "#7a3b18", "#a85a2c", "#c9822f"], form: "splotch", from: ["bottom", "left", "right"] },
  cracks: { colors: ["#0a0a0c", "#1a1a1f", "#3a3a44"], form: "crack", from: ["left", "right", "bottom", "top"] },
  condensation: { colors: ["#cfe6f5", "#abd0ea", "#8fbfe0"], form: "droplet", from: ["top", "bottom"] },
  vines: { colors: ["#12300f", "#1f5218", "#357a25", "#57a83a"], form: "tendril", from: ["bottom", "left", "right"] },
  moss: { colors: ["#1a2e14", "#2f4a1f", "#4a6a2c"], form: "splotch", from: ["bottom", "left"] },
  blood: { colors: ["#2a0608", "#5c0e12", "#8a1a1f"], form: "droplet", from: ["top"] },
  sand: { colors: ["#5c4a2a", "#8a6f3f", "#b89a5c"], form: "splotch", from: ["bottom"] },
};
const SURFACE: EffectLego[] = (Object.keys(SURFACE_SPECS) as SurfaceMode[]).map((k) => ({
  id: `surf.${k}`, class: "surface" as const, mode: k,
  blurb: `${k[0].toUpperCase()}${k.slice(1)} creeping in from the edges of the frame.`,
  tags: [k],
}));

// ── TEXTBOUND (attach to words) ──────────────────────────────────────────────
const TEXTBOUND: EffectLego[] = [
  { id: "text.burn", class: "textbound", mode: "burn", blurb: "The word chars and flakes to ash.", tags: ["fire", "burn", "rage", "anger", "desire"] },
  { id: "text.shatter", class: "textbound", mode: "shatter", blurb: "The word cracks and flies apart.", tags: ["break", "shatter", "glass", "heartbreak", "goodbye", "shatter"] },
  { id: "text.dissolve", class: "textbound", mode: "dissolve", blurb: "The word blurs and fades to nothing.", tags: ["fade", "forget", "ghost", "memory", "gone"] },
  { id: "text.bloom", class: "textbound", mode: "bloom", blurb: "The word blossoms open with light.", tags: ["love", "bloom", "hope", "joy", "grow"] },
  { id: "text.glitch", class: "textbound", mode: "glitch", blurb: "The word tears and jitters like bad signal.", tags: ["glitch", "digital", "error", "static", "code"] },
  { id: "text.freeze", class: "textbound", mode: "freeze", blurb: "The word ices over and stills.", tags: ["cold", "freeze", "frost", "numb", "winter"] },
  { id: "text.melt", class: "textbound", mode: "melt", blurb: "The word drips and runs.", tags: ["melt", "heat", "summer", "sweat", "drip"] },
  { id: "text.carve", class: "textbound", mode: "carve", blurb: "The word is struck into stone.", tags: ["stone", "carve", "forever", "monument", "name"] },
  // ── Signature treatments (rendered by dedicated Word* components) ──
  { id: "text.slam", class: "textbound", mode: "slam", blurb: "The word drops in and hits like a kick.", tags: ["boom", "drop", "crash", "break", "slam", "hit", "bang", "drum", "kick", "punch", "stomp", "hammer"] },
  { id: "text.wave", class: "textbound", mode: "wave", blurb: "The word rolls like water.", tags: ["ocean", "wave", "river", "tide", "water", "sea", "olas", "mar"] },
  { id: "text.neon", class: "textbound", mode: "neon", blurb: "The word buzzes on like a neon sign.", tags: ["light", "neon", "glow", "shine", "bright", "luz", "brilla"] },
  { id: "text.pulse", class: "textbound", mode: "pulse", blurb: "The word beats with the heart.", tags: ["heartbeat", "pulse", "beat", "corazón", "latido"] },
  { id: "text.whisper", class: "textbound", mode: "whisper", blurb: "The word breathes in soft and low.", tags: ["whisper", "quiet", "silence", "silencio", "hush", "secret", "softly"] },
  { id: "text.fizz", class: "textbound", mode: "fizz", blurb: "The word sparkles like a drink.", tags: ["cocktail", "drink", "glass", "ice", "sip", "champagne", "bubbles", "wine", "toast"] },
  { id: "text.type", class: "textbound", mode: "type", blurb: "The word types itself out in mono.", tags: ["code", "type", "tab", "debug", "commit", "prompt", "build", "program", "software", "keyboard", "laptop"] },
  { id: "text.shimmer", class: "textbound", mode: "shimmer", blurb: "A gold-leaf light sweeps across the word.", tags: ["gold", "golden", "crown", "rich", "luxury", "diamond", "jewel", "shine", "glitter", "treasure", "royal"] },
  { id: "text.rise", class: "textbound", mode: "rise", blurb: "The word floats up and lifts free.", tags: ["rise", "soar", "fly", "lift", "float", "higher", "ascend", "heaven", "wings", "hope"] },
  { id: "text.fall", class: "textbound", mode: "fall", blurb: "The word sinks and drops away.", tags: ["fall", "sink", "plunge", "tumble", "collapse", "descend", "gravity", "down", "drown"] },
  { id: "text.echo", class: "textbound", mode: "echo", blurb: "The word repeats in fading ghosts.", tags: ["echo", "repeat", "again", "memory", "remember", "distant", "reverb", "haunt"] },
  { id: "text.tremor", class: "textbound", mode: "tremor", blurb: "The word trembles with nerves.", tags: ["tremble", "shiver", "fear", "afraid", "nervous", "anxious", "panic", "quake", "quiver", "shudder"] },
  { id: "text.redact", class: "textbound", mode: "redact", blurb: "The word is shown, then struck out — classified.", tags: ["lie", "liar", "hidden", "classified", "censored", "redacted", "confidential", "forbidden", "conceal", "undercover"] },
  { id: "text.chromatic", class: "textbound", mode: "chromatic", blurb: "RGB ghosts tear apart and lock back in — analog memory.", tags: ["dream", "nostalgia", "analog", "vhs", "rewind", "retro", "vintage", "polaroid", "cassette", "flashback"] },
  { id: "text.liquid", class: "textbound", mode: "liquid", blurb: "Water rises inside the letterforms.", tags: ["tears", "cry", "weep", "flood", "soak", "spill", "pour", "overflow", "lágrimas"] },
  { id: "text.bleed", class: "textbound", mode: "bleed", blurb: "Red ink weeps down from the word.", tags: ["blood", "bleed", "wound", "scar", "vein", "bruise", "hurt", "pain", "ache", "sangre"] },
  { id: "text.handwrite", class: "textbound", mode: "handwrite", blurb: "The word writes itself on in script.", tags: ["write", "letter", "vow", "promise", "sign", "ink", "pen", "poem", "diary", "journal"] },
  { id: "text.tvoff", class: "textbound", mode: "tvoff", blurb: "The word switches off like an old TV — line, dot, dark.", tags: ["end", "goodbye", "farewell", "dead", "death", "die", "dying"] },
  { id: "text.chop", class: "textbound", mode: "chop", blurb: "The word re-triggers in sliced stutters — a DJ's chop.", tags: ["chop", "chopped", "screwed", "stutter", "skip", "remix", "again"] },
  { id: "text.drip", class: "textbound", mode: "drip", blurb: "Glossy droplets swell off the letters and fall — the word stays, dripping.", tags: ["drip", "dripping", "wet", "gloss", "glossy", "honey", "syrup", "sauce"] },
];

// ── LIGHT (grades the whole frame) ───────────────────────────────────────────
const LIGHT: EffectLego[] = [
  { id: "light.godrays", class: "light", mode: "godrays", blurb: "Shafts of light break through.", tags: ["light", "dawn", "hope", "heaven", "sun"] },
  { id: "light.flare", class: "light", mode: "flare", blurb: "A lens flare streaks the moment.", tags: ["shine", "star", "flash", "camera", "spotlight"] },
  { id: "light.flicker", class: "light", mode: "flicker", blurb: "The world flickers like a failing bulb.", tags: ["flicker", "doubt", "fear", "haunt", "old"] },
  { id: "light.blackout", class: "light", mode: "blackout", blurb: "Everything cuts to black.", tags: ["dark", "void", "silence", "death", "end"] },
];

/** The whole catalog — every lego in the box. */
export const EFFECT_CATALOG: EffectLego[] = [
  ...AIRBORNE, ...VOLUMETRIC, ...SURFACE, ...TEXTBOUND, ...LIGHT,
];

/** Index for fast lookup by id. */
export const EFFECTS_BY_ID: Record<string, EffectLego> =
  Object.fromEntries(EFFECT_CATALOG.map((e) => [e.id, e]));

// ── RESOLVERS ────────────────────────────────────────────────────────────────

/** The song's airborne weather. (Delegates to the particle engine's matcher.) */
export const weatherFor = particleModeFor;

/** Which veil a given weather mode wipes into. Exhaustive over ParticleMode. */
const WEATHER_VEIL: Record<ParticleMode, VeilKind> = {
  embers: "ash", ash: "ash", rain: "fog", snow: "frost", dust: "dust",
  bubbles: "steam", sparks: "static", petals: "fog", pollen: "dust",
  fireflies: "dust", confetti: "steam", leaves: "dust", stars: "fog",
};
export function veilForWeather(mode: ParticleMode): VeilKind {
  return WEATHER_VEIL[mode] ?? "fog";
}

const SURFACE_MATCHERS: [RegExp, SurfaceMode][] = [
  [/\b(mud|swamp|dirt|mire|bog|sink|stuck|filth)\b/, "mud"],
  [/\b(rust|decay|rot|corrode|old|abandon|ruin|neglect)\b/, "rust"],
  [/\b(crack|fracture|break|split|shatter|broken|fault)\b/, "cracks"],
  [/\b(condensation|steam|humid|sweat|fog.?up|window|breath)\b/, "condensation"],
  [/\b(vine|ivy|overgrow|jungle|wild|tangle|reclaim)\b/, "vines"],
  [/\b(moss|forest|damp|ancient|stone|green)\b/, "moss"],
  [/\b(blood|wound|bleed|scar|hurt|kill)\b/, "blood"],
  [/\b(sand|desert|dune|drought|dry|erode|hourglass)\b/, "sand"],
];
/** A song's surface growth, if any word calls for one. Null = clean glass. */
export function surfaceFor(text: string): SurfaceMode | null {
  const t = text.toLowerCase();
  for (const [re, mode] of SURFACE_MATCHERS) if (re.test(t)) return mode;
  return null;
}

const TEXT_MATCHERS: [RegExp, TextEffect][] = [
  [/\b(burn|fire|rage|ember|flame|desire)\b/, "burn"],
  [/\b(shatter|break|glass|heartbreak|goodbye|apart)\b/, "shatter"],
  [/\b(fade|forget|ghost|gone|vanish|erase)\b/, "dissolve"],
  [/\b(bloom|love|hope|joy|grow|flower)\b/, "bloom"],
  [/\b(glitch|error|signal|digital|static)\b/, "glitch"],
  [/\b(cold|freeze|frost|numb|ice)\b/, "freeze"],
  [/\b(chop|chopped|screwed|stutter)\b/, "chop"],
  [/\b(drip|drips|dripping|glossy|syrup)\b/, "drip"],
  [/\b(melt|heat|sweat|summer)\b/, "melt"],
  [/\b(stone|carve|forever|name|monument)\b/, "carve"],
  // Signature treatments — appended so the matchers above keep first-match priority.
  [/\b(boom|slam|crash|bang|stomp|hammer|kick|punch)\b/, "slam"],
  [/\b(ocean|wave|river|tide|sea|olas|mar)\b/, "wave"],
  [/\b(neon|glow|shine|bright|luz|brilla)\b/, "neon"],
  [/\b(heartbeat|pulse|corazón|latido)\b/, "pulse"],
  [/\b(whisper|quiet|hush|softly)\b/, "whisper"],
  [/\b(cocktail|champagne|bubbles|sip|toast)\b/, "fizz"],
  [/\b(code|debug|commit|keyboard|laptop)\b/, "type"],
  // Tranche 3 — appended so everything above keeps first-match priority.
  [/\b(lie|lies|liar|hidden|classified|censored|redacted|confidential)\b/, "redact"],
  [/\b(dream|dreams|nostalgia|analog|vhs|rewind|retro|vintage|polaroid|cassette)\b/, "chromatic"],
  [/\b(tears|cry|crying|weep|flood|spill|pour|overflow)\b/, "liquid"],
  [/\b(blood|bleed|bleeding|wound|scar|vein|bruise|ache)\b/, "bleed"],
  [/\b(write|written|letter|vow|promise|signature|poem|diary|journal)\b/, "handwrite"],
  [/\b(end|ending|goodbye|farewell|dead|death|die|dying)\b/, "tvoff"],
];
/** A word-level text treatment, if the vocabulary calls for one. */
export function textEffectFor(text: string): TextEffect | null {
  const t = text.toLowerCase();
  for (const [re, fx] of TEXT_MATCHERS) if (re.test(t)) return fx;
  return null;
}
