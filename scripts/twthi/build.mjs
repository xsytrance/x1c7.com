#!/usr/bin/env node
// THE WORLD THAT HEARD ITSELF — 59s directed cut, window 227.80 → 286.80.
// Authors the full tracks row (words, LRC, planet) from hand-verified word
// times and mechanically RMS-checks every word onset against its own stem
// (lead vs backing — the female hook and "I said, Light" live ONLY on the
// backing stem; the lead is silent 213.5–233.4).
//
//   node scripts/twthi/build.mjs          # verify + write row.json
//   node scripts/twthi/build.mjs --skip-rms
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;
const PROF = join(ROOT, "scripts/song-analysis/profiles/the-world-that-heard-itself");
const OUT = join(ROOT, "scripts/twthi");
mkdirSync(OUT, { recursive: true });

const SLUG = "the-world-that-heard-itself";
const PUB = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const FROM = 227.8, TO = 286.8;

// ── words: [t, word, stem] — stem: L lead, B backing. Times from large-v3
// slice passes cross-checked against 100ms RMS maps; "Every sound" hand-split
// from whisper's "Anytime"; litany "into drums" redistributed so no word sits
// <0.15s after its predecessor (MAX_HOLD's line-dump gate).
const WORDS = [
  [228.10, "So", "B"], [228.42, "keep", "B"], [228.86, "this", "B"], [229.52, "world", "B"], [230.12, "with", "B"], [230.64, "me", "B"],
  [231.14, "I", "B"], [231.76, "said", "B"], [232.16, "Light", "B"],
  [233.36, "And", "L"], [233.50, "the", "L"], [233.62, "melody", "L"], [233.90, "turned", "L"], [234.24, "gold", "L"],
  [234.94, "I", "L"], [235.16, "said", "L"], [235.56, "Move", "L"],
  [236.20, "And", "L"], [236.78, "gravity", "L"], [237.36, "found", "L"], [237.78, "the", "L"], [237.98, "beat", "L"],
  [238.44, "I", "L"], [238.58, "said", "L"], [239.06, "Live", "L"],
  [239.92, "And", "L"], [240.24, "every", "L"], [240.68, "sound", "L"], [241.24, "came", "L"], [241.88, "home", "L"],
  [246.00, "Every", "L"], [246.62, "sound", "L"], [247.20, "becomes", "L"], [248.34, "a", "L"], [249.02, "body", "L"],
  [249.98, "Every", "L"], [251.06, "echo", "L"], [252.10, "learns", "L"], [252.84, "to", "L"], [253.78, "breathe", "L"],
  [254.76, "What", "L"], [255.24, "the", "L"], [255.76, "noise", "L"], [256.48, "creates", "L"],
  [257.66, "the", "L"], [257.98, "silence", "L"], [258.90, "takes", "L"],
  [259.74, "So", "L"], [260.04, "keep", "L"], [260.56, "this", "L"], [261.20, "world", "L"], [261.88, "with", "L"], [262.32, "me", "L"],
  [266.39, "Voices", "L"], [266.86, "into", "L"], [267.12, "brass", "L"],
  [269.32, "Steps", "L"], [269.78, "into", "L"], [270.00, "drums", "L"],
  [272.00, "Blood", "L"], [272.36, "into", "L"], [272.68, "bass", "L"],
  [274.29, "Rain", "L"], [274.58, "into", "L"], [275.10, "light", "L"],
  [277.50, "Every", "L"], [277.76, "echo", "L"], [278.40, "alive", "L"],
  [283.72, "Then", "L"], [285.50, "I", "L"], [285.75, "stopped", "L"], [286.00, "speaking", "L"],
];

// ── the mechanical check that beats re-reading: RMS(t, 0.18s) > -42 dB
if (!process.argv.includes("--skip-rms")) {
  const rms = (file, t) => {
    const raw = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-t", "0.18", "-i", file, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], { maxBuffer: 1 << 24 });
    const n = raw.length >> 2; let acc = 0;
    for (let i = 0; i < n; i++) acc += raw.readFloatLE(i * 4) ** 2;
    return 20 * Math.log10(Math.sqrt(acc / Math.max(n, 1)) + 1e-9);
  };
  const stems = { L: join(PROF, "stems-src/0 Lead Vocals.mp3"), B: join(PROF, "stems-src/1 Backing Vocals.mp3") };
  let bad = 0;
  for (const [t, w, s] of WORDS) {
    const db = rms(stems[s], t);
    if (db < -42) { console.error(`✗ ${w}@${t} on ${s}: ${db.toFixed(1)} dB — parked in silence`); bad++; }
  }
  if (bad) { console.error(`${bad} words failed the -42 dB check`); process.exit(1); }
  console.error(`✓ all ${WORDS.length} word onsets carry vocal energy`);
}

// ── LRC (window lines only; ≤6 words/line, portrait wraps to two rows)
const lrcT = (s) => `[${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.round((s % 1) * 100)).padStart(2, "0")}]`;
const LINES = [
  [228.10, "So keep this world with me"],
  [231.14, "I said, Light"],
  [233.36, "And the melody turned gold"],
  [234.94, "I said, Move"],
  [236.20, "And gravity found the beat"],
  [238.44, "I said, Live"],
  [239.92, "And every sound came home"],
  [246.00, "Every sound becomes a body"],
  [249.98, "Every echo learns to breathe"],
  [254.76, "What the noise creates"],
  [257.66, "the silence takes"],
  [259.74, "So keep this world with me"],
  [266.39, "Voices into brass"],
  [269.32, "Steps into drums"],
  [272.00, "Blood into bass"],
  [274.29, "Rain into light"],
  [277.50, "Every echo, alive"],
  [283.72, "Then, I stopped speaking"],
];
const lyrics = "[The Build]\n" + LINES.slice(0, 7).map(([t, l]) => lrcT(t) + l).join("\n") +
  "\n[The Climax]\n" + LINES.slice(7, 17).map(([t, l]) => lrcT(t) + l).join("\n") +
  "\n[The Collapse]\n" + LINES.slice(17).map(([t, l]) => lrcT(t) + l).join("\n");

// ── planet
const scene = (n) => `/planets/${SLUG}/scene-${n}.webp`;
const planet = {
  generatedAt: new Date().toISOString(),
  styleHint: "Cinematic orchestral hybrid — a spoken creation myth. THE AUDIBLE DESERT: Dalí-grade surrealist oil, vast empty plains, molten gold against deep teal, a world with no people where every sound is a body.",
  analysis: {
    themes: ["creation", "sound", "silence", "myth", "metamorphosis"],
    palette: ["#F2E9D8", "#E9B94F", "#7FB5A8", "#C97C3F"],
    summary: "An empty world waits to hear itself; a voice speaks sounds into bodies, and what the noise creates, the silence takes.",
    keywords: [],
    sections: [],
    overallMood: "mythic awe",
  },
  assets: {
    broll: [],
    stems: `${PUB}/planets/${SLUG}/stems/stems.json`,
    stemLag: 0,
    shots: {
      [scene("keep")]: "WIDE", [scene("light")]: "WIDE", [scene("gold")]: "MED", [scene("move")]: "WIDE",
      [scene("gravity")]: "WIDE", [scene("live")]: "MED", [scene("home")]: "WIDE", [scene("ear")]: "WIDE",
      [scene("breathe")]: "WIDE", [scene("silence")]: "WIDE", [scene("world")]: "WIDE", [scene("brass")]: "WIDE",
      [scene("drums")]: "WIDE", [scene("bass")]: "WIDE", [scene("alive")]: "WIDE",
      [scene("stopped")]: "WIDE",
    },
    keywords: {
      keep: scene("keep"), world: scene("world"), light: scene("light"), gold: scene("gold"),
      move: scene("move"), gravity: scene("gravity"), live: scene("live"), home: scene("home"),
      becomes: scene("ear"), echo: scene("alive"), breathe: scene("breathe"), silence: scene("silence"),
      voices: scene("brass"), steps: scene("drums"), blood: scene("bass"), rain: scene("light"),
      then: scene("stopped"),
    },
    sections: {
      hushed: scene("keep"), command: scene("light"), rising: scene("rising"),
      alive: scene("alive"), collapse: scene("stopped"),
    },
  },
  interactions: { moments: [], tapEffect: "bloom" },
  dynamicPlus: {
    v: 2,
    directed: `THE WORLD THAT HEARD ITSELF 59s cut — THE AUDIBLE DESERT voice, 17 surrealist plates, no humans anywhere. (window ${FROM}-${TO})`,
    scene: "AURORA",
    acts: [
      { start: FROM, end: 243.0, label: "I SAID LIGHT", why: "the commands — light, move, live" },
      { start: 243.0, end: 281.5, label: "EVERY ECHO ALIVE", why: "the climax — the world sings at full weight" },
      { start: 281.5, end: TO, label: "SILENCE TAKES", why: "he stops speaking and the world goes out" },
    ],
    modes: [
      { start: FROM, end: 232.10, mode: "phrase" },
      { start: 232.10, end: 232.69, mode: "dynamic" },
      { start: 232.69, end: 235.53, mode: "phrase" },
      { start: 235.53, end: 236.14, mode: "dynamic" },
      { start: 236.14, end: 239.02, mode: "phrase" },
      { start: 239.02, end: 239.86, mode: "dynamic" },
      { start: 239.86, end: TO, mode: "phrase" },
    ],
    words: {
      light: "bloom", gold: "melt", move: "quake", gravity: "fall", beat: "pulse",
      live: "rise", home: "cling", body: "slam", echo: "echo", breathe: "fogbreath",
      noise: "glitch", silence: "whisper", takes: "dissolve", world: "shimmer", keep: "squeeze",
      alive: "cling", voices: "wave", brass: "burn", steps: "tremor", drums: "pulse",
      blood: "bleed", bass: "liquid", rain: "drip", stopped: "tvoff", speaking: "dissolve",
    },
    deck: { glow: 1.3, grain: 0.5, density: 2.2, vignette: 0.6, giant: { life: 2200, pile: 0, clearOnSwitch: true }, motion: { swapMs: 900 } },
    hits: [{ t: 245.96, dur: 1.2 }],
    holds: [],
    rolls: [],
  },
};

const row = {
  id: SLUG,
  title: "The World That Heard Itself",
  artist: "AGENOR",
  genre: "Cinematic Orchestral Hybrid",
  mood: "mythic",
  color: "#E9B94F",
  cover: `${PUB}/planets/${SLUG}/cover.png`,
  audio_url: `/private/${SLUG}.mp3`,
  sort_order: 902,
  featured: false,
  hidden: true,
  lyrics,
  lyrics_synced: {
    source: `aligned-window-${FROM}-${TO}-cut`,
    refinedAt: new Date().toISOString(),
    words: WORDS.map(([t, w]) => ({ t, w })),
  },
  planet,
};

writeFileSync(join(OUT, "row.json"), JSON.stringify(row, null, 2));
console.error(`row.json written — ${WORDS.length} words, ${LINES.length} LRC lines, ${Object.keys(planet.assets.keywords).length} keywords`);
