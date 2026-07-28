#!/usr/bin/env node
// Wire "Maybe Was The Answer" into Supabase: create the track row and build
// its planet (corrected section map, scene art, dynamicPlus treatment).
// Row is created HIDDEN — the directed cut renders from it without the song
// appearing on the public site until the owner flips it.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(readFileSync(join(REPO, ".env.local"), "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]));
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);

const SLUG = "maybe-was-the-answer";
const P = join(REPO, "scripts", "song-analysis", "profiles", SLUG);
const full = JSON.parse(readFileSync(join(P, `${SLUG}-planet-full.json`), "utf8"));
const profile = JSON.parse(readFileSync(join(P, "profile.json"), "utf8"));
const R2 = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const scene = (k) => `/planets/${SLUG}/scene-${k}.webp`;

// ── sections ──────────────────────────────────────────────────────────────
// The LLM section map put "The Flip" at 126s and Verse 2 at 109.5s; the
// transcript says 84.6 and 69.3. Rebuilt by hand from the sung boundaries.
// Intensities stay <= 0.71 — 0.72+ synthesizes an unwanted "shake" banner.
// colorHint feeds deriveTheme() → the WORD colors. So it must CONTRAST with
// that section's art, not match it: coral text on coral riso art vanished in
// the first QA pass. Warm/dark art → cyan or cream words; light art → ink navy.
const SECTIONS = [
  { name: "Intro",        start: 0,     emotion: "anticipation", intensity: 0.40, colorHint: "#3BA3FF" },
  { name: "Chorus",       start: 18.5,  emotion: "infatuation",  intensity: 0.68, colorHint: "#3BA3FF" },
  { name: "Verse 1",      start: 39.2,  emotion: "amusement",    intensity: 0.58, colorHint: "#3BA3FF" },
  { name: "Pre-Chorus",   start: 54.7,  emotion: "closure",      intensity: 0.50, colorHint: "#3BA3FF" },
  { name: "Chorus",       start: 59.4,  emotion: "swagger",      intensity: 0.70, colorHint: "#3BA3FF" },
  { name: "Verse 2",      start: 69.3,  emotion: "unease",       intensity: 0.66, colorHint: "#FFD2B0" },
  { name: "The Flip",     start: 84.6,  emotion: "reversal",     intensity: 0.71, colorHint: "#FFD2B0" },
  { name: "Verse 3",      start: 89.4,  emotion: "menace",       intensity: 0.68, colorHint: "#0E2A47" },
  { name: "Bridge",       start: 99.7,  emotion: "clarity",      intensity: 0.55, colorHint: "#0E2A47" },
  { name: "Final Chorus", start: 119.4, emotion: "panic",        intensity: 0.70, colorHint: "#FFD2B0" },
  { name: "Outro",        start: 146.4, emotion: "exhaustion",   intensity: 0.30, colorHint: "#FFD2B0" },
];

// word → scene art. Anchors are >=1s apart across the 59.4–104.85 window.
const KEYWORDS = Object.fromEntries(["lady", "maybe", "baby", "talk", "confidence", "missed",
  "car", "chase", "saaaave", "code", "kitchen", "laundry", "warning", "answer"].map((k) => [k, scene(k)]));

// ambient coverage between keyword hits
const SECTION_ART = {
  anticipation: scene("lady"),   infatuation: scene("lady"),    amusement: scene("confidence"),
  closure:      scene("talk"),   swagger:     scene("lady"),    unease:    scene("missed"),
  reversal:     scene("chase"),  menace:      scene("warning"), clarity:   scene("answer"),
  panic:        scene("car"),    exhaustion:  scene("saaaave"),
};

// ── the emotional treatment ───────────────────────────────────────────────
// Billing pills, labels kept honest (every one is a literal lyric).
const ACTS = [
  { start: 59.4,  end: 68.9,   label: "SHE SAID MAYBE",       why: "the sweet chorus, before the turn" },
  { start: 69.3,  end: 84.4,   label: "FORTY-SEVEN MISSED",   why: "the escalation — every other call" },
  { start: 84.6,  end: 89.5,   label: "NOW YOU CHASE ME",     why: "the flip: beat cuts, room goes dry" },
  { start: 89.5,  end: 99.6,   label: "THAT'S A WARNING",     why: "the door code, the folded laundry" },
  { start: 100.0, end: 104.85, label: "MAYBE WAS THE ANSWER", why: "the title drop" },
];

// Drop to `dynamic` so the payload words render HUGE and alone, snap back to
// `phrase` for the sung lines. Switches sit >=0.05s clear of the next word.
const MODES = [
  { start: 59.4,  end: 62.9,   mode: "phrase"  },
  { start: 62.9,  end: 64.00,  mode: "dynamic" }, // "Maybe"
  { start: 64.00, end: 80.30,  mode: "phrase"  },
  { start: 80.30, end: 81.05,  mode: "dynamic" }, // "missed"
  { start: 81.05, end: 88.50,  mode: "phrase"  },
  { start: 88.50, end: 90.00,  mode: "dynamic" }, // "saaaave" — the held note
  { start: 90.00, end: 98.40,  mode: "phrase"  },
  { start: 98.40, end: 99.90,  mode: "dynamic" }, // "warning / that's a warning"
  { start: 99.90, end: 101.20, mode: "dynamic" }, // "Maybe"
  { start: 101.20, end: 103.50, mode: "phrase" },
  { start: 103.50, end: 104.85, mode: "dynamic" }, // "answer"
];

const WORDS = {
  maybe: "cling", baby: "bloom", lady: "bloom", crazy: "tremor",
  confidence: "rise", funny: "tilt", talk: "echo", missed: "quake",
  car: "tremor", chase: "rise", real: "pulse", saaaave: "cling",
  mama: "tremor", code: "chop", door: "chop", kitchen: "tremor",
  laundry: "tremor", warning: "quake", answer: "cling", name: "echo",
};

const planet = {
  ...full,
  // analysis.palette IS the word-color source (KineticStage:601). The LLM's
  // palette put gold #c9b037 and mint #5eead4 on coral riso art — the amber
  // words and the green flash in QA. These four all read on cream, coral AND
  // ink-blue.
  analysis: { ...full.analysis, sections: SECTIONS, palette: ["#2FC2E8", "#F5E6D3", "#FF4D6D", "#0B1E3A"] },
  assets: {
    keywords: KEYWORDS,
    sections: SECTION_ART,
    stems: `${R2}/planets/${SLUG}/stems/stems.json`,
    stemLag: -0.023,
    stemAudio: Object.fromEntries(["lead", "back", "drums", "bass", "guitar", "keys", "synth"]
      .map((s) => [s, `${R2}/planets/${SLUG}/stems/${s}.m4a`])),
  },
  dynamicPlus: {
    v: 1, acts: ACTS, modes: MODES, words: WORDS,
    // riso voice wants visible grain; density 2.4 = the owner's "lots of particles"
    deck: { density: 2.4, glow: 0.42, grain: 0.62, vignette: 0.45 },
    directed: { window: [59.4, 104.85], voice: "risograph duotone" },
  },
  // nothing may overlap the render window
  interactions: { moments: [], tapEffect: "bloom" },
};

const row = {
  id: SLUG,
  title: "Maybe Was The Answer",
  artist: "xsytrance",
  genre: "Afro-fusion",
  mood: "Confident Haunted",
  color: "#3BA3FF",
  cover: `${R2}/covers/Maybe%20Was%20The%20Answer.png`,
  audio_url: `${R2}/music/Maybe%20Was%20The%20Answer.mp3`,
  suno_url: "https://suno.com/song/39c600b0-4bd2-46ea-9427-d0f2fcdded5c",
  sort_order: 1,
  featured: false,
  hidden: true, // stays off the public site until the owner says otherwise
  planet,
};

const dry = process.argv.includes("--dry");
if (dry) {
  console.log(JSON.stringify({ ...row, planet: "<planet>" }, null, 1));
  console.log("sections:", SECTIONS.length, "keywords:", Object.keys(KEYWORDS).length,
    "acts:", ACTS.length, "modes:", MODES.length, "words:", Object.keys(WORDS).length);
  console.log("max intensity:", Math.max(...SECTIONS.map((s) => s.intensity)));
  process.exit(0);
}
const { error } = await db.from("tracks").upsert(row, { onConflict: "id" });
if (error) { console.error(error); process.exit(1); }
console.log(`✦ ${SLUG} wired (hidden=true) — ${Object.keys(KEYWORDS).length} scenes, ${ACTS.length} acts, ${MODES.length} mode windows`);
console.log(`   style: ${profile.identity.styleSentence.slice(0, 90)}…`);
