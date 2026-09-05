#!/usr/bin/env node
// Assemble the tracks row + planet for the "Osaka After Dark" RE-CUT.
//   node scripts/osaka2/build-planet.mjs  ->  scripts/osaka2/row.json
//
// The shipped 56s cut's planet is backed up in the scratchpad; this REPLACES
// lyrics_synced and the planet's window-specific wiring, because both were
// built for 155.02-211.35 and describe a different part of the song.
import { readFileSync, writeFileSync } from "node:fs";

const SLUG = "osaka-after-dark";
const words = JSON.parse(readFileSync("scripts/osaka2/words.json", "utf8"));
const anchors = JSON.parse(readFileSync("scripts/osaka2/anchors.json", "utf8"));
const sizes = JSON.parse(readFileSync("scripts/osaka2/sizes.json", "utf8"));
const prev = JSON.parse(readFileSync(process.argv[2], "utf8"));   // backup-planet.json

const url = (n) => `/planets/${SLUG}/scene-${n}.webp`;
// Five plates survive from the shipped cut; thirteen are new.
const REUSED = { wine: "MED", osaka: "WIDE", dripping: "MED", yamenaide: "MED", closer: "MACRO" };
const SHOT = Object.fromEntries([
  ...Object.entries(sizes).map(([n, s]) => [url(n), s]),
  ...Object.entries(REUSED).map(([n, s]) => [url(n), s]),
]);
const keywords = Object.fromEntries(Object.entries(anchors).map(([w, n]) => [w, url(n)]));
// `sawatte` carries no keyword (the four ad-libs are ~1.2s apart, too tight for
// two anchors), so it earns its place as ambient section cover instead.
const sections = { hook: url("osaka"), swagger: url("grammar"), intimate: url("sawatte"), peak: url("insane") };

// §14: keep every intensity <=0.71 and every consecutive delta <0.25, or the
// engine synthesizes SHAKE / BLOW banners over the cut.
const SECTIONS = [
  { start: 1.46,   name: "Intro",          emotion: "intimate", intensity: 0.18, colorHint: "#0a0710" },
  { start: 22.0,   name: "Verse 1",        emotion: "swagger",  intensity: 0.42, colorHint: "#1a0a18" },
  { start: 45.0,   name: "Pre-Chorus",     emotion: "hook",     intensity: 0.58, colorHint: "#240c22" },
  { start: 73.58,  name: "Chorus",         emotion: "hook",     intensity: 0.66, colorHint: "#2e0d28" },
  { start: 92.04,  name: "Ad-libs",        emotion: "intimate", intensity: 0.52, colorHint: "#190a1a" },
  { start: 97.60,  name: "Verse 2",        emotion: "swagger",  intensity: 0.64, colorHint: "#260c20" },
  { start: 116.94, name: "Male Response",  emotion: "intimate", intensity: 0.46, colorHint: "#140a18" },
  { start: 121.42, name: "Female Lead",    emotion: "swagger",  intensity: 0.62, colorHint: "#280d24" },
  { start: 132.08, name: "R&B Lift",       emotion: "hook",     intensity: 0.50, colorHint: "#1e0c20" },
];
for (let i = 1; i < SECTIONS.length; i++) {
  const d = Math.abs(SECTIONS[i].intensity - SECTIONS[i - 1].intensity);
  if (d >= 0.25) throw new Error(`BLOW risk: delta ${d.toFixed(2)} at ${SECTIONS[i].name}`);
  if (SECTIONS[i].intensity > 0.71) throw new Error(`SHAKE risk at ${SECTIONS[i].name}`);
}

const planet = {
  ...prev,
  analysis: { ...prev.analysis, sections: SECTIONS },
  assets: { ...prev.assets, keywords, sections, shots: SHOT, broll: [] },
  // The longest word gap in this window is 1.76s, far under the 7s that would
  // synthesize a wipe, so no blocker is strictly needed. This one sits past the
  // cut end anyway: never drawn, and it costs nothing to be certain.
  interactions: {
    tapEffect: "neon",
    moments: [{ t: 132.4, end: 133.4, type: "wipe", layer: "mist", prompt: "let the street go quiet" }],
  },
  dynamicPlus: {
    ...prev.dynamicPlus,
    v: 2,
    directed: true,
    scene: "WET NEON",
    acts: [
      { start: 73.58,  end: 78.10,  label: "WINE WITH ME",        why: "The hook lands — the title line of the chorus." },
      { start: 89.94,  end: 92.00,  label: "KONYA WA NEMURANAI",  why: "Tonight we don't sleep — the line the whole cut turns on." },
      { start: 97.60,  end: 100.40, label: "HIPS GOT GRAMMAR",    why: "Verse 2 opens on the best boast in the song." },
      { start: 107.94, end: 112.50, label: "TOKYO IN MY BLOOD",   why: "The Kansai/Tokyo brag, and the reason the city is the film." },
      { start: 126.70, end: 132.08, label: "HAND ON MY CHAIN",    why: "The turn: she reads it, and the room goes." },
    ],
    // Short lines land better as one huge word. Each window closes >=0.05s
    // before the next sung word (§6).
    modes: [
      { start: 93.21,  end: 94.58,  mode: "dynamic" },   // Sawatte
      { start: 95.79,  end: 97.10,  mode: "dynamic" },   // Yamenaide
      { start: 118.21, end: 119.03, mode: "dynamic" },   // Don't act shy
      { start: 120.69, end: 121.38, mode: "dynamic" },   // Tell me why
    ],
    words: {
      wine: "drip", osaka: "bloom", dark: "melt", grind: "quake", dripping: "drip",
      yamenaide: "cling", body: "pulse", beat: "pulse", dancehall: "quake",
      rude: "chop", konya: "shimmer", closer: "cling", sawatte: "tremor",
      grammar: "type", motion: "rise", ocean: "melt", bass: "quake",
      tokyo: "rise", kansai: "shimmer", midnight: "bloom", grace: "melt",
      cold: "freeze", shy: "tremor", why: "quake", panic: "chop",
      chain: "squeeze", insane: "quake",
    },
    deck: { ...prev.dynamicPlus.deck },   // the WET NEON deck, unchanged
  },
};

const row = {
  id: SLUG,
  hidden: true,
  audio_url: `/private/${SLUG}.mp3`,
  cover: url("osaka"),
  lyrics_synced: { words, source: "osaka2-chorus-window-73.58-132.08", alignedAt: new Date().toISOString() },
  planet,
};
writeFileSync("scripts/osaka2/row.json", JSON.stringify(row, null, 1));
const hist = {};
for (const s of Object.values(SHOT)) hist[s] = (hist[s] ?? 0) + 1;
const n = Object.keys(SHOT).length;
console.log(`row.json: ${words.length} words, ${Object.keys(keywords).length} keywords, ${n} plates`);
console.log("shot histogram:", hist,
  `| WIDE ${(100 * (hist.WIDE ?? 0) / n).toFixed(0)}%  CLOSE+MACRO ${(100 * ((hist.CLOSE ?? 0) + (hist.MACRO ?? 0)) / n).toFixed(0)}%`);
