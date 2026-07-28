#!/usr/bin/env node
// I WON'T BE YOUR FIRE — wire tracks.planet for the 59s 9:16 cut.
// Window 187.2 → 246.2. Opens on "Say you hate me", closes on the title chorus.
//
// Backup of the pre-edit row:
//   profiles/i-won-t-be-your-fire/pre-fire-backup/track-row-before.json
//
// Usage: node scripts/_fire-wire.mjs [--dry]

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
const P = (f) => `/planets/${ID}/${f}`;
const FROM = 187.2, TO = 246.2;

// ── Scene ladder. Each key is the sung word the painting lands on, and each
// painting carries the whole SENTENCE, not the word. 18 scenes over 59s. ────
const KEYWORDS = [
  "hate", "saying", "love", "wound", "answer", "daylight", "moon", "parts",
  "blade", "voice", "cage", "cry", "us", "night", "true", "fire", "burn", "words",
];
// night / love / voice / moon are also engine-wide _shared fallback words, so
// mapping them here is what stops a stray non-fire frame from appearing.

const SECTION_ART = {
  desperate: "fr-sec-desperate.webp",
  despairing: "fr-sec-despairing.webp",
  defiant: "fr-sec-defiant.webp",
};

// ── Word effects. effects.overrides outranks dynamicPlus.words, so both get
// the same map. "no" carries the giant NO!!! — quake is the violent shake. ──
const WORDS = {
  hate: "burn", no: "quake", saying: "tremor", anything: "echo",
  love: "bloom", enough: "slam", wound: "bleed",
  // "miss" is held for 6.4s of open air — cling is the held-note treatment,
  // entering big and settling across the whole airtime.
  miss: "cling", answer: "echo", leave: "dissolve", room: "dissolve",
  pray: "shimmer", daylight: "bloom", moon: "melt",
  hold: "squeeze", parts: "shatter", bury: "drip", blade: "carve",
  remember: "echo", soft: "whisper", voice: "echo", cage: "carve",
  cry: "drip", old: "dissolve", us: "melt", through: "dissolve",
  night: "freeze", worst: "tremor", true: "slam",
  fire: "burn", burn: "burn", sharp: "shatter", words: "chop", silence: "freeze",
};

// ── Acts: short lifts on the moments that earn them. Long acts pin the art at
// 0.85 opacity and bury the lyric, so these only punctuate. ─────────────────
const ACTS = [
  { start: 188.50, end: 190.40, label: "NO", why: "Two flat refusals thrown back at 'say you hate me, say you're done'." },
  { start: 192.90, end: 194.00, label: "I'M SAYING NO", why: "The thesis: the no IS the love, not the absence of it." },
  { start: 198.95, end: 200.60, label: "I CAN MISS YOU", why: "The litany begins — missing someone and still not answering." },
  { start: 236.10, end: 239.00, label: "I WON'T BE YOUR FIRE", why: "The title lands in full band." },
  { start: 241.00, end: 242.00, label: "YOU MISS THE BURN", why: "The accusation underneath it: she wants the burning, not him." },
];

// ── Mode conductor. Mostly DYNAMIC (giant single words) with PHRASE reserved
// for the reflective "I can ___ and still ___" sentences, which need to be read
// as whole thoughts. Every boundary sits in a gap between words so a switch
// never re-renders a word mid-flight. ~59% dynamic. ────────────────────────
const MODES = [
  { start: 187.20, end: 206.16, mode: "dynamic" },  // SAY YOU HATE ME · NO · NO · I'M SAYING NO · I LOVE YOU ENOUGH · MISS
  { start: 206.16, end: 213.75, mode: "phrase" },   // "I can love you and leave the room / pray you find daylight / without becoming your moon"
  { start: 213.75, end: 218.55, mode: "dynamic" },  // I CAN HOLD ALL THE GOOD PARTS · AND STILL BURY THE BLADE
  { start: 218.55, end: 224.40, mode: "phrase" },   // "I can remember your soft voice without entering the cage"
  { start: 224.40, end: 229.40, mode: "dynamic" },  // I CAN CRY FOR THE OLD US · WITHOUT PULLING YOU THROUGH
  { start: 229.40, end: 235.60, mode: "phrase" },   // "another night where the worst thing I say becomes true"
  { start: 235.60, end: 241.90, mode: "dynamic" },  // I WON'T BE YOUR FIRE · JUST BECAUSE YOU MISS THE BURN
  { start: 241.90, end: 246.20, mode: "phrase" },   // "I won't say the sharp words just to make the silence hurt"
];

const { data: row, error } = await db.from("tracks").select("planet,lyrics_synced").eq("id", ID).single();
if (error) { console.error(error); process.exit(1); }
const planet = row.planet;

// The giant NO!!! — the two thrown refusals become NO!!! on stage. clean()
// strips the punctuation for the effect lookup, so they still key to "no".
const words = (row.lyrics_synced?.words ?? []).map((w) => {
  const t = Number(w.t);
  if ((Math.abs(t - 188.63) < 0.02 || Math.abs(t - 189.94) < 0.02) && /^no$/i.test(String(w.w).trim())) {
    return { ...w, w: "NO!!!" };
  }
  return w;
});
const noCount = words.filter((w) => w.w === "NO!!!").length;

const keywords = { ...(planet.assets?.keywords ?? {}) };
const alt = { ...(planet.assets?.alt ?? {}) };
for (const k of KEYWORDS) {
  keywords[k] = P(`fr-${k}.webp`);
  alt[P(`fr-${k}.webp`)] = P(`fr-${k}-2.webp`);
}
const sections = { ...(planet.assets?.sections ?? {}) };
for (const [emotion, file] of Object.entries(SECTION_ART)) sections[emotion] = P(file);

const next = {
  ...planet,
  analysis: {
    ...planet.analysis,
    // Ember palette. All four are high-luminance on purpose: the engine draws
    // words straight from this array, so a dark entry renders words invisible
    // against the art.
    palette: ["#ff7a2f", "#ffc247", "#ff4d4d", "#f5ece4"],
    // 0.72+ synthesises a "shake" banner over the frame — the Final Chorus sat
    // exactly on the line at 0.72.
    sections: (planet.analysis?.sections ?? []).map((s) =>
      (s.intensity > 0.71 ? { ...s, intensity: 0.71 } : s)),
  },
  assets: { ...planet.assets, keywords, alt, sections },
  effects: { ...planet.effects, overrides: { ...(planet.effects?.overrides ?? {}), ...WORDS } },
  interactions: {
    ...planet.interactions,
    // The shake at 199-207 and the scream at 236-250 both sat inside the window
    // and would have thrown a prompt banner over the cut's two biggest moments.
    moments: (planet.interactions?.moments ?? []).filter((m) => !(m.end > FROM && m.t < TO)),
  },
  dynamicPlus: {
    v: 2,
    directed: `I WON'T BE YOUR FIRE 59s 9:16 cut — hand-choreographed 2026-07-27 (window ${FROM}–${TO})`,
    acts: ACTS,
    modes: MODES,
    words: WORDS,
    scene: "EMBERS",
    deck: {
      density: 2.2, glow: 0.55, grain: 0.3, vignette: 0.5,
      motion: { dur: 2.4, amp: 1, swapMs: 1000, fade: 0.45 },
      // pile 0 — SOLO giant words. This song's dynamic runs are dense (0.1-0.3s
      // between words), so even a single ghost left three or four huge words
      // stacked on each other ("CAN" over "CAN" over "CRY"). One word at a
      // time, changing fast, is what actually reads.
      giant: { pile: 0, life: 1400, clearOnSwitch: true },
    },
  },
};

const dyn = MODES.filter((m) => m.mode === "dynamic").reduce((a, m) => a + (m.end - m.start), 0);
console.error(`keywords ${Object.keys(keywords).length} (+${KEYWORDS.length} fire) · sections ${Object.keys(sections).length}`);
console.error(`acts ${ACTS.length} · modes ${MODES.length} · dynamic ${dyn.toFixed(1)}s of ${(TO - FROM).toFixed(1)}s (${Math.round(dyn / (TO - FROM) * 100)}%)`);
console.error(`NO!!! patched: ${noCount}`);
const over = next.analysis.sections.filter((s) => s.intensity > 0.71 && s.start >= FROM - 30 && s.start <= TO);
console.error(over.length ? `⚠ intensity >0.71: ${JSON.stringify(over)}` : "intensity OK (<=0.71)");
const clash = next.interactions.moments.filter((m) => m.end > FROM && m.t < TO);
console.error(clash.length ? `⚠ moments overlap: ${JSON.stringify(clash)}` : `no moments overlap (dropped ${(planet.interactions?.moments ?? []).length - next.interactions.moments.length})`);

if (dry) { console.error("\n[dry] not written"); process.exit(0); }
const upd = { planet: next };
if (noCount) upd.lyrics_synced = { ...row.lyrics_synced, words };
const { error: uerr } = await db.from("tracks").update(upd).eq("id", ID);
if (uerr) { console.error(uerr); process.exit(1); }
console.error("\n✦ planet written");
