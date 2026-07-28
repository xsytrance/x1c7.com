#!/usr/bin/env node
// I WON'T BE YOUR FIRE — TYPOGRAPHY CUT. 59s 9:16, window 187.2 → 246.2.
//
// No images at all. deck.art = false switches every scene painting off —
// keyword art, section moods, and the _shared fallback frames that words like
// "night" / "love" / "voice" / "moon" would otherwise pull in. What is left is
// the generative EMBERS backdrop and the ember particle weather, both drawn by
// the engine rather than photographed, so the frame still burns.
//
// The whole video is therefore carried by the words. Every meaningful word is
// mapped to an effect that PERFORMS its meaning rather than decorating it:
// "cry" drips, "shatter" breaks apart, "without" gets redacted, "miss" clings
// to its held note for six seconds, "fire" burns. Words left unmapped still
// animate — the engine picks a natural effect from the lexicon — so the stage
// is never static, it just isn't shouting on every syllable.
//
// Usage: node scripts/_fire-typo-wire.mjs [--dry]

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(readFileSync(join(REPO, ".env"), "utf8").split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
const ID = "i-won-t-be-your-fire";
const dry = process.argv.includes("--dry");
const FROM = 186.85, TO = 245.85;

// ── The choreography. Grouped by what the effect DOES, not alphabetically. ──
const WORDS = {
  // FIRE — the song's element. burn chars the letters from the inside.
  fire: "burn", burn: "burn", hate: "burn", flame: "burn", match: "burn",

  // THE REFUSAL — quake is a violent shake; the two thrown NO!!! ride it.
  no: "quake", dont: "quake", wont: "carve", never: "carve",

  // BREAKING — letters come apart.
  parts: "shatter", sharp: "shatter", break: "shatter", breaking: "shatter",
  blade: "carve", cage: "carve", war: "shatter",

  // WATER — the one the owner called out: "cry" actually cries.
  cry: "drip", tears: "drip", rain: "liquid", bury: "fall", falling: "fall",

  // COLD / STOPPED — freeze locks the word mid-air.
  still: "freeze", night: "freeze", silence: "freeze", quiet: "freeze", cold: "freeze",

  // VANISHING — the word leaves the way the person does.
  leave: "dissolve", room: "dissolve", through: "dissolve", gone: "dissolve",
  disappear: "dissolve", smoke: "dissolve",

  // ECHO — things said and re-heard.
  answer: "echo", voice: "echo", remember: "echo", anything: "echo",
  say: "type", said: "type", saying: "tremor", words: "chop",

  // NEGATION. "without" used to be mapped to `redact`, which paints a solid
  // near-black bar straight over the word — unreadable, and the reason a
  // stretch of this cut went blank. Never use redact on a lyric that has to be
  // read. `dissolve` carries the same meaning and stays legible.
  without: "dissolve",

  // WEIGHT — the declarations land hard.
  done: "slam", enough: "slam", true: "slam", real: "slam", proof: "slam",

  // THE HELD NOTE — "miss" sits alone in 6.4s of open air. cling enters big
  // and settles across the whole airtime instead of snapping in and waiting.
  miss: "cling", hold: "squeeze", holding: "squeeze",

  // MELTING — things that lose their shape.
  moon: "melt", us: "melt", becoming: "melt", become: "melt", melt: "melt",

  // TENDERNESS — small, close, fragile.
  soft: "whisper", love: "bloom", good: "bloom", kind: "bloom",
  pray: "shimmer", hope: "shimmer", light: "shimmer",
  daylight: "rise", find: "rise", morning: "rise",

  // DAMAGE
  wound: "bleed", hurt: "bleed", pain: "bleed", worst: "tremor",
  reason: "tremor", thunder: "quake",

  // MOVEMENT
  pulling: "wave", chasing: "wave", walking: "wave",
};

// ── Acts: short lifts on the beats that earn a billing chip. ───────────────
const ACTS = [
  { start: 188.15, end: 189.95, label: "NO", why: "Two flat refusals thrown straight back at 'say you hate me'." },
  { start: 190.95, end: 192.40, label: "I'M SAYING NO", why: "The thesis — the no IS the love, not the absence of it." },
  { start: 200.85, end: 202.15, label: "I CAN MISS YOU", why: "The litany opens." },
  { start: 236.10, end: 238.90, label: "I WON'T BE YOUR FIRE", why: "The title lands, full band." },
  { start: 239.00, end: 241.20, label: "YOU MISS THE BURN", why: "What she actually wants is the burning." },
];

// ── Mode conductor. DYNAMIC stages one giant word at a time; PHRASE lays the
// whole line out and highlights the sung word inside it. With no art to look
// at, the alternation between the two IS the edit. ~59% dynamic. ───────────
const MODES = [
  // Every boundary sits in a real gap between sung words, re-derived after the
  // transcript rebuild moved words by up to 3.7s.
  { start: 186.85, end: 203.20, mode: "dynamic" },  // SAY YOU HATE ME · NO!!! · NO!!! · I'M SAYING NO BECAUSE I LOVE YOU ENOUGH · NOT TO BECOME ANOTHER WOUND · I CAN MISS YOU
  { start: 203.20, end: 211.80, mode: "phrase" },   // "I can love you and leave the room / I can pray that you'll find daylight"
  { start: 211.80, end: 218.10, mode: "dynamic" },  // WITHOUT BECOMING YOUR MOON · HOLD ALL THE GOOD PARTS · BURY THE BLADE
  { start: 218.10, end: 224.10, mode: "phrase" },   // "I can remember your soft voice without entering the cage"
  { start: 224.10, end: 229.25, mode: "dynamic" },  // I CAN CRY FOR THE OLD US · WITHOUT PULLING YOU THROUGH
  { start: 229.25, end: 236.10, mode: "phrase" },   // "another night where the worst thing I say becomes true"
  { start: 236.10, end: 241.28, mode: "dynamic" },  // I WON'T BE YOUR FIRE · JUST BECAUSE YOU MISS THE BURN
  { start: 241.28, end: 245.85, mode: "phrase" },   // "I won't say the sharp words just to make the silence hurt"
];

const { data: row, error } = await db.from("tracks").select("planet").eq("id", ID).single();
if (error) { console.error(error); process.exit(1); }
const planet = row.planet;

const next = {
  ...planet,
  analysis: {
    ...planet.analysis,
    // Fire palette, all four high-luminance — with no art behind them the words
    // ARE the picture, so none of them may be dim.
    // Lead with near-white. Once the backdrop was pinned warm, orange-on-orange
    // words lost their edge — a bright cream carries most of the type and the
    // ember tones become accents rather than the whole palette.
    palette: ["#fff1e0", "#ffb04a", "#ff5a3c", "#ffd93c"],
    sections: (planet.analysis?.sections ?? []).map((s) =>
      (s.intensity > 0.71 ? { ...s, intensity: 0.71 } : s)),
  },
  effects: {
    ...planet.effects,
    // Merging leaves stale keys behind: dropping a word from WORDS does NOT
    // remove it from the stored overrides. `redact` had been mapped to "not"
    // and survived its own removal, still painting a black bar over the lyric.
    // Strip every redact mapping explicitly, then merge.
    overrides: Object.fromEntries(Object.entries({ ...(planet.effects?.overrides ?? {}), ...WORDS })
      .filter(([, e]) => e !== "redact")),
  },
  interactions: {
    ...planet.interactions,
    moments: (planet.interactions?.moments ?? []).filter((m) => !(m.end > FROM && m.t < TO)),
  },
  dynamicPlus: {
    v: 2,
    directed: `I WON'T BE YOUR FIRE 59s 9:16 TYPOGRAPHY cut — 2026-07-27 (window ${FROM}–${TO})`,
    acts: ACTS,
    modes: MODES,
    words: WORDS,
    // The generative fire world. With art off this is the only thing behind
    // the type, so it does the whole job of the backdrop.
    scene: "EMBERS",
    deck: {
      art: false,          // ← no images, anywhere
      // Pin the field warm. Left free, every section rolled its own hue from
      // hash(song, emotion) and a song about fire came out lilac and teal.
      backdropHue: 0,
      density: 3,          // heavy ember weather
      glow: 0.75,          // the words bloom in the accent colour
      grain: 0.24,
      vignette: 0.34,      // lighter than usual — no photo to darken, just type
      giant: { pile: 0, life: 1400, clearOnSwitch: true },
    },
  },
};

const dyn = MODES.filter((m) => m.mode === "dynamic").reduce((a, m) => a + (m.end - m.start), 0);
console.error(`word effects: ${Object.keys(WORDS).length} · acts ${ACTS.length} · modes ${MODES.length}`);
console.error(`dynamic ${dyn.toFixed(1)}s of ${(TO - FROM).toFixed(1)}s (${Math.round(dyn / (TO - FROM) * 100)}%)`);
console.error(`deck.art=${next.dynamicPlus.deck.art} (typography only) · scene=${next.dynamicPlus.deck && next.dynamicPlus.scene}`);
const clash = next.interactions.moments.filter((m) => m.end > FROM && m.t < TO);
console.error(clash.length ? `⚠ moments overlap: ${JSON.stringify(clash)}` : "no interaction moments overlap");

if (dry) { console.error("\n[dry] not written"); process.exit(0); }
const { error: uerr } = await db.from("tracks").update({ planet: next }).eq("id", ID);
if (uerr) { console.error(uerr); process.exit(1); }
console.error("\n✦ planet written (typography cut)");
