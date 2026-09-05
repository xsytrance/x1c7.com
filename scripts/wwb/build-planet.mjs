#!/usr/bin/env node
// Assemble the tracks row + planet for the "Warm Without Burning" cut.
//   node scripts/wwb/build-planet.mjs   ->  scripts/wwb/row.json  (feed to _kiz-db.mjs upsert)
import { readFileSync, writeFileSync } from "node:fs";

const SLUG = "warm-without-burning";
const P = `scripts/song-analysis/profiles/${SLUG}`;
const words = JSON.parse(readFileSync("scripts/wwb/words.json", "utf8"));
const anchors = JSON.parse(readFileSync("scripts/wwb/anchors.json", "utf8"));
const shots = JSON.parse(readFileSync("scripts/wwb/shots.json", "utf8"));
const base = JSON.parse(readFileSync(`${P}/${SLUG}-planet-full.json`, "utf8"));
const track = JSON.parse(readFileSync(`${P}/tracks.json`, "utf8"))[0];

const url = (n) => `/planets/${SLUG}/scene-${n}.webp`;
const SHOT = Object.fromEntries(Object.entries(shots).map(([n, sh]) => [url(n), sh]));

// word -> plate url
const keywords = Object.fromEntries(Object.entries(anchors).map(([w, n]) => [w, url(n)]));
// the two plates no keyword reaches, used as ambient section cover
const sections = { steadfast: url("dark"), peace: url("dawn") };

// §14: keep every intensity <=0.71 (0.72+ synthesises a SHAKE banner) and every
// consecutive delta <0.25 (>=0.25 synthesises a BLOW banner). The onboarding
// planet had 0.90 and a 0.58 jump; both would have fired over this window.
const SECTIONS = [
  { start: 2.08,   name: "Intro",           emotion: "hushed",    intensity: 0.10, colorHint: "#0b0f16" },
  { start: 3.00,   name: "Verse 1",         emotion: "tender",    intensity: 0.30, colorHint: "#1a1410" },
  { start: 44.25,  name: "Chorus",          emotion: "steadfast", intensity: 0.54, colorHint: "#2b1c10" },
  { start: 114.87, name: "Bridge",          emotion: "hushed",    intensity: 0.40, colorHint: "#101820" },
  { start: 149.86, name: "Drop",            emotion: "peace",     intensity: 0.30, colorHint: "#0d1418" },
  { start: 160.25, name: "Rebuild",         emotion: "tender",    intensity: 0.52, colorHint: "#241a12" },
  { start: 182.73, name: "Final Chorus",    emotion: "steadfast", intensity: 0.68, colorHint: "#3a2410" },
  { start: 201.93, name: "Final Variation", emotion: "tender",    intensity: 0.56, colorHint: "#2a1d14" },
  { start: 222.80, name: "Outro",           emotion: "peace",     intensity: 0.34, colorHint: "#101a1e" },
  { start: 243.57, name: "Last Whisper",    emotion: "peace",     intensity: 0.22, colorHint: "#0c1216" },
];
for (let i = 1; i < SECTIONS.length; i++) {
  const d = Math.abs(SECTIONS[i].intensity - SECTIONS[i - 1].intensity);
  if (d >= 0.25) throw new Error(`BLOW banner risk: delta ${d.toFixed(2)} at ${SECTIONS[i].name}`);
  if (SECTIONS[i].intensity > 0.71) throw new Error(`SHAKE banner risk at ${SECTIONS[i].name}`);
}

const PALETTE = ["#08111C", "#FFD98A", "#FF8A4C", "#FFF4E2"];

const planet = {
  ...base,
  analysis: { ...base.analysis, palette: PALETTE, sections: SECTIONS },
  assets: { keywords, sections, shots: SHOT, alt: {} },
  // §14 is too loose: synthesis is not gated on moments being EMPTY, it is
  // gated on free(), which only refuses when a CHOREOGRAPHED moment sits within
  // +/-8s of the synthesized one (KineticStage ~1054). A decoy parked at t=96
  // therefore blocked nothing, and the 8.6s ambience gap before the last
  // whisper synthesized a "WIPE THE ASH AWAY" prompt straight into the outro.
  // Nobody taps a rendered video, so any banner here is stray UI.
  // The blocker has to be adjacent to the synthesized window, not far from it:
  // this one starts just AFTER the cut ends (246.43) so it is never drawn, but
  // still lands inside free()'s 8s buffer and refuses the wipe.
  interactions: {
    tapEffect: "ember",
    moments: [{ t: 246.6, end: 247.6, type: "wipe", layer: "mist", prompt: "let the river go quiet" }],
  },
  dynamicPlus: {
    v: 2,
    directed: true,
    scene: "LACQUER",
    // Billing pills. Plain-language labels, honest to what is actually sung.
    acts: [
      { start: 182.73, end: 186.05, label: "WARM WITHOUT BURNING", why: "The title lands, full band, English then its Vietnamese twin." },
      { start: 198.20, end: 199.42, label: "THE FIRE IS GONE",     why: "The premise of the whole Fire Cycle, finally in the past tense." },
      { start: 201.93, end: 203.06, label: "I'M STILL HERE",       why: "The answer to Chapter I — the fire went out and she stayed." },
      { start: 208.14, end: 211.16, label: "NO SCARS",             why: "The thesis: a love that left no marks to show for it." },
      { start: 243.57, end: 246.30, label: "ẤM MÀ KHÔNG CHÁY",     why: "The last whisper — the title, in her own language, alone." },
    ],
    // Micro-windows of `dynamic` so the short lines land as one huge word.
    // Each ends >=0.05s before the next sung word (§6).
    modes: [
      { start: 208.09, end: 209.40, mode: "dynamic" },
      { start: 228.71, end: 229.95, mode: "dynamic" },
      { start: 243.52, end: 246.35, mode: "dynamic" },
    ],
    words: {
      warm: "bloom", burning: "melt", fire: "burn", break: "fracture",
      gone: "dissolve", here: "cling", still: "cling", scars: "press",
      run: "rise", "không": "quake", "ấm": "pulse", "cháy": "melt",
      "đây": "shimmer", "đau": "bleed", stayed: "cling", water: "drip",
    },
    deck: {
      art: true,
      density: 1.6,        // embers, not a blizzard
      glow: 0.9,
      grain: 0.30,         // lacquer craquelure
      vignette: 0.56,      // darker edges so the words carry over mid-tone water
      backdropHue: 28,
      giant: { life: 1500, pile: 0, clearOnSwitch: true },
      motion: { dur: 2.4, amp: 0.9, swapMs: 1000, fade: 0.42 },
    },
  },
};

const row = {
  id: SLUG,
  title: track.title,
  artist: track.artist,
  genre: track.genre,
  mood: track.mood,
  // §13: hidden=true AND a /private audio_url, or useTracks silently renders
  // a DIFFERENT song. The lyrics outside the cut window are still ASR draft,
  // so this row must not go public.
  hidden: true,
  audio_url: `/private/${SLUG}.mp3`,
  cover: `/planets/${SLUG}/scene-burning.webp`,
  lyrics: track.lyrics,
  lyrics_synced: { words, source: "wwb-lead-stem-rebuild", alignedAt: new Date().toISOString() },
  planet,
};
writeFileSync("scripts/wwb/row.json", JSON.stringify(row, null, 1));
console.log(`row.json: ${words.length} words, ${Object.keys(keywords).length} keywords, ${Object.keys(SHOT).length} shots`);
const hist = {};
for (const s of Object.values(shots)) hist[s] = (hist[s] ?? 0) + 1;
console.log("shot histogram:", hist);
