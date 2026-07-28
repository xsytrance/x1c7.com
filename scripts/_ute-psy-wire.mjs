#!/usr/bin/env node
// Wire tracks.planet for the UNDER THE ELEVATED psychedelic 45s cut.
// Window 190.6 → 235.6 — "You call me poison" through "under the elevated".
//
// Read-modify-write, and deliberately surgical: keyword art outside the window
// keeps the song's original night-noir voice, so only the cut changes. The
// pre-edit row is already journalled to
// profiles/under-the-elevated/pre-psy-backup/track-row-before.json.
//
// Usage: node scripts/_ute-psy-wire.mjs [--dry]

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(readFileSync(join(REPO, ".env"), "utf8").split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
if (!env.SUPABASE_SERVICE_ROLE_KEY) { console.error("no SUPABASE_SERVICE_ROLE_KEY in .env"); process.exit(1); }
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
const ID = "under-the-elevated";
const dry = process.argv.includes("--dry");
const P = (f) => `/planets/${ID}/${f}`;

// ── The scene ladder: sung word → the painting of THAT line ─────────────────
// Anchors are >= 1.0s apart after the deck's swap floor, so every one lands.
const KEYWORDS = [
  "poison", "mine", "weakness", "time", "yours", "answer", "addiction", "door",
  "voice", "sometimes", "earned", "counter", "low", "heart", "myself", "laugh",
  "joke", "money", "pain", "building", "bridge", "rain", "dragon", "elevated",
];
// "rain" earns its place defensively as well as dramatically: it is both an old
// night-noir keyword AND one of the engine's _shared fallback words, so leaving
// it unmapped would drop a stray non-psychedelic frame into the closing bars.

const SECTION_ART = { dangerous: "psy-sec-dangerous.webp", desperation: "psy-sec-desperation.webp" };

// ── Word effects. effects.overrides outranks dynamicPlus.words, so the cut's
// choices go in BOTH — otherwise the planet's existing poison→melt and
// dragon→echo would quietly win. ───────────────────────────────────────────
const WORDS = {
  poison: "drip", mine: "cling", weakness: "shatter", time: "melt",
  yours: "dissolve", answer: "echo", addiction: "tremor", door: "slam",
  in: "slam", voice: "echo", sometimes: "echo", earned: "shimmer",
  counter: "glitch", low: "melt", card: "glitch", heart: "pulse",
  throat: "squeeze", myself: "chromatic", need: "tremor", laugh: "glitch",
  joke: "tilt", money: "burn", pain: "bleed", building: "rise",
  future: "rise", burning: "burn", bridge: "burn", rain: "liquid",
  chasing: "wave", dragon: "quake",
  // "cling" enters big and settles across the full airtime — the title has to
  // come to rest, and "rise" was still carrying it across the frame at cut.
  elevated: "cling",
};

// ── The acts of the cut. Kept SHORT on purpose: an act sets `boost`, which
// lifts the backdrop from 0.6 to 0.85 opacity and brightens it 22%. The first
// wiring ran acts end to end across the window, so the art never dropped back
// and the dimmed non-active words in each phrase were unreadable over it.
// Acts now punctuate the five moments that earn the lift; the rest of the cut
// sits at 0.6 where the lyric wins. ───────────────────────────────────────
const ACTS = [
  { start: 190.6, end: 193.6, label: "YOU CALL ME POISON", why: "Addiction speaks in the first person and claims him — seduction, not threat." },
  { start: 204.2, end: 206.1, label: "IT USES YOUR OWN VOICE", why: "He names the mechanism: the craving arrives sounding exactly like himself." },
  { start: 210.1, end: 211.9, label: "AT THE COUNTER", why: "The moment of giving in — card in hand, the music low." },
  { start: 220.8, end: 226.5, label: "WHAT ELSE COULD I DO", why: "The bargain: what else the money and the pain could ever have been for." },
  { start: 231.6, end: 235.6, label: "UNDER THE ELEVATED", why: "The title lands — still chasing, still under the tracks." },
];

// ── Mode conductor: drop to `dynamic` only on a punch word, so it lands as one
// huge word, then snap back to `phrase` for the line.
//
// Two hard constraints, both learned the expensive way on this cut:
//  1. The conductor polls every 250ms, so a window under ~0.6s is simply never
//     seen. The first pass had 0.40–0.48s windows on TIME and MONEY that
//     silently never fired.
//  2. A dynamic window must contain exactly ONE word. This song's delivery is
//     dense (0.1–0.6s between words), and two huge words inside one window
//     render stacked on top of each other — "the dragon" came out as one
//     illegible smear, and its ghost was still sitting over the closing title
//     a second later.
// So: every window below is >= 0.6s AND holds a single word whose successor
// falls outside it. Everything else stays in phrase, which handles the density.
// Nine bursts. Some hold ONE word; some hold a two-word pair that assembles
// into a poster (the second word lands huge with the first still glowing
// behind it) and is wiped clean when the burst ends. Stop words like "the"
// stay small in dynamic mode, so the content word still owns the stage.
const DYNAMIC = [
  { start: 191.68, end: 192.40, mode: "dynamic" },   // POISON            (poison 191.80)
  { start: 193.18, end: 193.78, mode: "dynamic" },   // MINE              (mine 193.27)
  { start: 202.30, end: 204.25, mode: "dynamic" },   // DOOR · IN         (202.37, 202.96)
  { start: 209.00, end: 210.10, mode: "dynamic" },   // EARNED · THIS     (209.06, 209.58)
  { start: 211.36, end: 212.60, mode: "dynamic" },   // LOW               (low 211.42)
  { start: 222.55, end: 223.05, mode: "dynamic" },   // MONEY             (money 222.66)
  { start: 225.90, end: 226.55, mode: "dynamic" },   // PAIN              (pain 225.99)
  { start: 233.02, end: 233.75, mode: "dynamic" },   // (the) DRAGON      (233.05, 233.14)
  { start: 234.55, end: 235.60, mode: "dynamic" },   // ELEVATED — the title lands
];
// Portrait pass: 1080px cannot hold a huge single word — POISON, MONEY and
// ELEVATED all clipped at both edges in the 9:16 render. The vertical master is
// therefore cut phrase-only, which is how the earlier portrait cuts were saved.
const flat = process.argv.includes("--flat");
const MODES = flat
  ? [{ start: 190.6, end: 235.6, mode: "phrase" }]
  : (() => {
    const out = [];
    let t = 190.6;
    for (const d of DYNAMIC) {
      if (d.start > t) out.push({ start: t, end: d.start, mode: "phrase" });
      out.push(d);
      t = d.end;
    }
    if (t < 235.6) out.push({ start: t, end: 235.6, mode: "phrase" });
    return out;
  })();

const { data: row, error } = await db.from("tracks").select("planet").eq("id", ID).single();
if (error) { console.error(error); process.exit(1); }
const planet = row.planet;

// Keyword art + the twin map, merged over the existing night-noir set.
const keywords = { ...(planet.assets?.keywords ?? {}) };
const alt = { ...(planet.assets?.alt ?? {}) };
for (const w of KEYWORDS) {
  keywords[w] = P(`psy-${w}.webp`);
  alt[P(`psy-${w}.webp`)] = P(`psy-${w}-2.webp`);
}
const sections = { ...(planet.assets?.sections ?? {}) };
for (const [emotion, file] of Object.entries(SECTION_ART)) sections[emotion] = P(file);

const next = {
  ...planet,
  analysis: {
    ...planet.analysis,
    // Word colours for the cut. ALL FOUR must be high-luminance: the engine
    // draws words straight from this array, so the near-black 4th entry the
    // planet shipped with rendered roughly one word in four invisible once the
    // backdrop became bright psychedelic art.
    palette: ["#ff2bd6", "#3df5ff", "#b4ff3d", "#ffd93d"],
  },
  assets: { ...planet.assets, keywords, alt, sections },
  effects: { ...planet.effects, overrides: { ...(planet.effects?.overrides ?? {}), ...WORDS } },
  interactions: {
    ...planet.interactions,
    // The fog wipe ran to 191.52 and would have opened the cut with a prompt
    // banner over "You call me poison". Ends before the window now.
    moments: (planet.interactions?.moments ?? []).map((m) =>
      (m.t === 180.52 ? { ...m, end: 190.4 } : m)),
  },
  dynamicPlus: {
    v: 2,
    directed: "UNDER THE ELEVATED 45s psychedelic cut — hand-choreographed 2026-07-27 (window 190.6–235.6)",
    acts: ACTS,
    modes: MODES,
    words: WORDS,
    scene: "SYRUP",
    deck: {
      density: 2.4, glow: 0.5, grain: 0.32, vignette: 0.5,
      // MOTION SHOTS — a fresh camera move per scene, finished inside the shot.
      motion: { dur: 2.0, amp: 1, swapMs: 1000, fade: 0.42, trip: 0.55 },
      // GIANT WORDS — a shallow, short-lived pile that wipes at every switch,
      // so each burst reads as its own poster instead of collecting strays
      // from ten seconds ago. Both aspects now use the same schedule: residues
      // re-fit to the frame, so nothing clips in portrait any more.
      giant: { pile: 0, life: 2200, clearOnSwitch: true },
    },
  },
};

const inWindow = (planet.analysis?.sections ?? []).filter((s) => s.start >= 180 && s.start <= 236);
console.error(`keywords ${Object.keys(keywords).length} (+${KEYWORDS.length} psy) · alt ${Object.keys(alt).length} · sections ${Object.keys(sections).length}`);
console.error(`acts ${ACTS.length} · modes ${MODES.length} · overrides ${Object.keys(next.effects.overrides).length}`);
console.error(`window sections: ${inWindow.map((s) => `${s.start} ${s.emotion} ${s.intensity}`).join(" | ")}`);
const over = (planet.analysis?.sections ?? []).filter((s) => s.intensity > 0.71 && s.start >= 185 && s.start <= 236);
console.error(over.length ? `⚠ intensity >0.71 inside window: ${JSON.stringify(over)}` : "intensity in window OK (<=0.71)");
const clash = (next.interactions.moments ?? []).filter((m) => m.end > 190.6 && m.t < 235.6);
console.error(clash.length ? `⚠ moments still overlap: ${JSON.stringify(clash)}` : "no interaction moments overlap the window");

if (dry) { console.error("\n[dry] not written"); process.exit(0); }
const { error: uerr } = await db.from("tracks").update({ planet: next }).eq("id", ID);
if (uerr) { console.error(uerr); process.exit(1); }
console.error("\n✦ planet written");
