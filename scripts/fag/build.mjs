#!/usr/bin/env node
// FORGED ABOVE GOLD — Tyler Haze x Kizuna Sato, The Fire Cycle Chapter V.
// 62s directed cut, window 199.36 -> 261.40: the whole final chorus, the break,
// the spoken ending, and the two whispers the song actually ends on.
//
// The song is NOT the catalogue's existing "Forged Above Gold"
// (void-into-gold-forged-above-gold-mix is a different, 332s gospel boom-bap
// record). This is a fresh ingest under its own slug.
//
// Word times: official lyrics supply the TEXT, whisper large-v3 on the lead
// stem supplies the TIMING, and every onset is mechanically checked against
// 180ms of RMS on its own stem (playbook 16). Whisper parked six words of the
// spoken outro inside silence -- "The" and "fire" were 3.5s early -- so the
// four post-break lines are hand-timed from 10ms voiced-span boundaries.
//
//   node scripts/fag/build.mjs            # verify + write row.json
//   node scripts/fag/build.mjs --skip-rms
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;
const SLUG = "forged-above-gold-fire-cycle";
const PROF = join(ROOT, "scripts/song-analysis/profiles", SLUG);
const OUT = join(ROOT, "scripts/fag");
const PUB = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const FROM = 199.36, TO = 261.40;
mkdirSync(OUT, { recursive: true });

// ── words: [t, word, stem]. L = lead, B = backing (Kizuna's doubles).
// Corrections applied to whisper, each one measured:
//   "Not" 204.28 -> 205.44  (whisper stretched it over the held tail of "flame";
//                            the other two "not X" pairs sit 0.18-0.22s apart)
//   "light"      -> 225.00  (whisper heard "fate" and gave it 0.14s)
//   "Sin"  225.30 -> 225.44 (keeps >=0.15s off "light" so MAX_HOLD's line-dump
//                            gate cannot claim either of them)
//   "Let"  227.20 -> 227.90 (p=0.11; the rest of the line sits 0.34-0.42 apart)
//   "weren't"               (official text; whisper heard "were")
//   the whole spoken outro  (hand-timed from voiced spans 244.36-246.19,
//                            249.00-251.25, 251.66-253.45, 256.92-260.65)
const WORDS = [
  // [Final Chorus - Tyler + Kizuna] — band is out, riser under; drop lands 201.70
  [199.38, "Forged", "L"], [200.90, "above", "L"], [201.12, "gold", "L"],
  [202.00, "We", "L"], [202.66, "came", "L"], [202.94, "through", "L"], [203.36, "the", "L"], [203.64, "flame", "L"],
  [205.44, "Not", "L"], [205.66, "untouched", "L"],
  [206.60, "not", "L"], [206.82, "unchanged", "L"],
  [207.78, "not", "L"], [207.96, "ashamed", "L"],
  [209.34, "Forged", "L"], [210.20, "above", "L"], [210.54, "gold", "L"],
  [211.44, "Más", "L"], [212.10, "fuerte", "L"], [212.56, "que", "L"], [213.00, "ayer", "L"],
  [213.52, "No", "L"], [214.14, "more", "L"], [214.44, "begging", "L"], [214.88, "for", "L"], [215.26, "the", "L"], [215.60, "burn", "L"],
  [216.04, "just", "L"], [216.46, "to", "L"], [216.72, "know", "L"], [217.06, "somebody's", "L"], [218.02, "there", "L"],
  // the trade — Tyler English / Kizuna Spanish, four lines
  [218.30, "I", "L"], [218.90, "can", "L"], [219.10, "stand", "L"], [219.44, "in", "L"], [219.94, "the", "L"], [220.22, "quiet", "L"],
  [220.72, "Yo", "L"], [221.26, "me", "L"], [221.42, "puedo", "L"], [221.92, "quedar", "L"],
  [222.44, "I", "L"], [223.54, "can", "L"], [223.80, "carry", "L"], [224.30, "my", "L"], [224.70, "own", "L"], [225.00, "light", "L"],
  [225.44, "Sin", "L"], [225.90, "tenerte", "L"], [226.32, "que", "L"], [226.66, "salvar", "L"],
  // [Both]
  [227.90, "Let", "L"], [228.14, "the", "L"], [228.48, "old", "L"], [228.90, "fire", "L"], [229.26, "go", "L"],
  [230.92, "There", "L"], [231.50, "is", "L"], [232.08, "nothing", "L"], [232.54, "left", "L"], [233.24, "to", "L"], [233.84, "prove", "L"],
  [234.48, "We", "L"], [235.08, "weren't", "L"], [235.38, "made", "L"], [235.90, "to", "L"], [236.74, "burn", "L"], [237.24, "forever", "L"],
  [239.20, "We", "L"], [240.00, "were", "L"], [240.20, "forged", "L"],
  // [Break - Everything Cuts] at 241.60 ─────────────────────────────────────
  // [Tyler, Spoken]
  [244.36, "The", "L"], [244.66, "fire", "L"], [245.02, "didn't", "L"], [245.34, "make", "L"], [245.56, "me", "L"], [245.80, "gold", "L"],
  // [Pause] 246.40 - 249.00 — 2.6s of true silence, left empty on purpose
  [249.00, "It", "L"], [249.44, "taught", "L"], [250.05, "me", "L"],
  [251.66, "I", "L"], [252.06, "was", "L"], [252.50, "worth", "L"], [252.95, "more", "L"],
  // [Kizuna - Whisper] / [Tyler - Whisper]
  [256.92, "Más", "L"], [257.66, "que", "L"], [258.06, "oro", "L"],
  [258.78, "Forged", "L"], [259.24, "above", "L"], [259.62, "gold", "L"],
];

// ── the mechanical check that beats re-reading the alignment
if (!process.argv.includes("--skip-rms")) {
  const rms = (file, t) => {
    const raw = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-t", "0.18", "-i", file,
      "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], { maxBuffer: 1 << 24 });
    const n = raw.length >> 2; let acc = 0;
    for (let i = 0; i < n; i++) acc += raw.readFloatLE(i * 4) ** 2;
    return 20 * Math.log10(Math.sqrt(acc / Math.max(n, 1)) + 1e-9);
  };
  const stems = { L: join(PROF, "stems-src/0 Lead Vocals.mp3"), B: join(PROF, "stems-src/1 Backing Vocals.mp3") };
  let bad = 0;
  for (const [t, w, s] of WORDS) {
    // the whispered outro sits 20dB below the sung body; gate it at -52
    const floor = t > 254 ? -52 : -42;
    const db = rms(stems[s], t);
    if (db < floor) { console.error(`✗ ${w}@${t} on ${s}: ${db.toFixed(1)} dB (floor ${floor})`); bad++; }
  }
  if (bad) { console.error(`${bad} word onsets are parked in silence`); process.exit(1); }
  console.error(`✓ all ${WORDS.length} word onsets carry vocal energy`);
}

// ── MAX_HOLD: a word <0.15s after its predecessor with >2.5s of rest ahead gets
// dragged forward by the engine — and drags its scene painting with it (§17).
{
  let bad = 0;
  for (let i = 1; i < WORDS.length - 1; i++) {
    if (WORDS[i + 1][0] - WORDS[i][0] > 2.5 && WORDS[i][0] - WORDS[i - 1][0] < 0.15) {
      console.error(`✗ MAX_HOLD would move "${WORDS[i][1]}"@${WORDS[i][0]}`); bad++;
    }
  }
  if (bad) process.exit(1);
  console.error("✓ no word trips the MAX_HOLD line-dump gate");
}

// ── LRC — <=6 words a line so portrait wraps to two rows, and every stamp must
// resolve to its own line's first word (playbook 15: phraseStartIdx takes the
// nearest onset on EITHER side, so a stamp a hair nearer the previous line's
// last word steals it).
const LINES = [
  [199.38, "Forged above gold"],
  [202.00, "We came through the flame"],
  [205.44, "Not untouched"],
  [206.60, "not unchanged"],
  [207.78, "not ashamed"],
  [209.34, "Forged above gold"],
  [211.44, "Más fuerte que ayer"],
  [213.52, "No more begging for the burn"],
  [216.04, "just to know somebody's there"],
  [218.30, "I can stand in the quiet"],
  [220.72, "Yo me puedo quedar"],
  [222.44, "I can carry my own light"],
  [225.44, "Sin tenerte que salvar"],
  [227.90, "Let the old fire go"],
  [230.92, "There is nothing left to prove"],
  [234.48, "We weren't made to burn forever"],
  [239.20, "We were forged—"],
  [244.36, "The fire didn't make me gold."],
  [249.00, "It taught me"],
  [251.66, "I was worth more."],
  [256.92, "Más que oro."],
  [258.78, "Forged above gold."],
];

// simulate phraseStartIdx: does each stamp resolve to its own line's first word?
{
  const ws = WORDS.map(([t]) => t);
  let bad = 0;
  for (const [t, line] of LINES) {
    let i = 0; while (i + 1 < ws.length && ws[i + 1] <= t) i++;
    const j = (i + 1 < ws.length && Math.abs(ws[i + 1] - t) < Math.abs(ws[i] - t)) ? i + 1 : i;
    if (Math.abs(ws[j] - t) > 0.6) { console.error(`✗ LRC "${line}" @${t} matches nothing within 0.6s`); bad++; }
    else if (Math.abs(ws[j] - t) > 0.001) { console.error(`✗ LRC "${line}" @${t} resolves to "${WORDS[j][1]}"@${ws[j]}`); bad++; }
  }
  if (bad) process.exit(1);
  console.error(`✓ all ${LINES.length} LRC stamps resolve to their own first word`);
}

const lrcT = (s) => `[${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.round((s % 1) * 100)).padStart(2, "0")}]`;
const lyrics =
  "[Final Chorus – Tyler + Kizuna]\n" + LINES.slice(0, 13).map(([t, l]) => lrcT(t) + l).join("\n") +
  "\n[Both]\n" + LINES.slice(13, 17).map(([t, l]) => lrcT(t) + l).join("\n") +
  "\n[Break – Everything Cuts]\n" + LINES.slice(17).map(([t, l]) => lrcT(t) + l).join("\n");

// ── planet
const scene = (n) => `/planets/${SLUG}/scene-${n}.webp`;

// word -> plate. Only words that fire ONCE in the window, except `fire` and
// `burn`, which fire twice and deliberately resolve to the same plate — the
// engine never cuts between two hits on the same url (§18), and both hits mean
// the same thing in the lyric.
const KEYWORDS = {
  // `came` and `flame` resolve to the SAME plate on purpose: they are 0.98s
  // apart, which would be an illegal cut between two different paintings, but
  // two hits on one url never cut (§18). It buys the drop its picture.
  came: "flame", flame: "flame", untouched: "untouched", unchanged: "unchanged",
  fuerte: "fuerte", begging: "burn", "somebody's": "somebodys",
  stand: "stand", quiet: "quiet", puedo: "puedo", carry: "carry", light: "light",
  salvar: "salvar", fire: "fire", nothing: "nothing", prove: "prove",
  made: "made", forever: "forever", were: "were", taught: "quench",
  worth: "worth", oro: "endcard",
};
const SIZES = {
  flame: "WIDE", untouched: "MACRO", unchanged: "MED", fuerte: "MED",
  burn: "CLOSE", somebodys: "WIDE", stand: "CLOSE", quiet: "MED", puedo: "CLOSE",
  carry: "WIDE", light: "MED", salvar: "MED", fire: "WIDE", nothing: "WIDE",
  prove: "CLOSE", made: "MED", forever: "WIDE", were: "WIDE", quench: "MED",
  worth: "WIDE", endcard: "MED",
};

// ── anchor spacing: two DIFFERENT plates must be >=1s apart or nothing cuts
{
  const hits = [];
  for (const [t, w] of WORDS) {
    const k = KEYWORDS[w] || KEYWORDS[w.toLowerCase()];
    if (k) hits.push([t, k]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  let bad = 0;
  for (let i = 1; i < hits.length; i++) {
    if (hits[i][1] !== hits[i - 1][1] && hits[i][0] - hits[i - 1][0] < 1.0) {
      console.error(`✗ ${hits[i - 1][1]}@${hits[i - 1][0]} -> ${hits[i][1]}@${hits[i][0]} is ${(hits[i][0] - hits[i - 1][0]).toFixed(2)}s apart`);
      bad++;
    }
  }
  if (bad) process.exit(1);
  console.error(`✓ ${hits.length} scene hits, all cuts >=1s apart`);

  // shot-size histogram — the cheap QA number that would have caught two
  // shipped cuts (§17). >=1/3 WIDE, <=1/4 CLOSE+MACRO, never two the same in a row.
  const seq = hits.map(([, k]) => SIZES[k]);
  const n = seq.length;
  const c = (x) => seq.filter((s) => s === x).length;
  const wide = c("WIDE") / n, tight = (c("CLOSE") + c("MACRO")) / n;
  let runs = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1] && hits[i][1] !== hits[i - 1][1]) runs++;
  console.error(`  shots: WIDE ${(wide * 100).toFixed(0)}% · CLOSE+MACRO ${(tight * 100).toFixed(0)}% · ${runs} same-size back-to-back`);
  if (wide < 0.33) console.error("  ⚠ under a third WIDE — every frame will read as a close-up");
  if (tight > 0.25) console.error("  ⚠ over a quarter tight");
}

const planet = {
  generatedAt: new Date().toISOString(),
  styleHint: "THE ANVIL LIGHT — documentary photography of a real working blacksmith shop at night. The only light in any frame is hot metal, the coal fire, or the cold violet of the quench. Deep black, muted, dirty, unglamorous. No fantasy, no spark showers, no crowns.",
  analysis: {
    themes: ["forging", "survival", "fire", "worth", "letting go"],
    // NOT a mood board — KineticStage draws the sung WORDS from this array, so
    // every entry has to be legible on a near-black frame. The first pass put
    // the voice's own shadow tone (#2A1B12) in here and preflight caught that
    // one word in four would have rendered invisible.
    palette: ["#E8A33D", "#F2E4CE", "#D9722F", "#A98BEE"],
    summary: "Two people who came through fire decide it did not ruin them — it made them. The fire is not the enemy and it is not the saviour; it is the process, and it gets let go of at the end.",
    keywords: [],
    // deltas kept < 0.25 so KineticStage cannot synthesise a "BLOW!" banner,
    // and none >= 0.72 so it cannot synthesise a "shake" (§14)
    sections: [
      // starts BEFORE the window: a section whose `at` equals the render start is
      // never crossed, so the opening frames had no section art at all
      { at: 190.00, label: "final chorus", emotion: "resolve", intensity: 0.58 },
      { at: 209.34, label: "both voices", emotion: "together", intensity: 0.66 },
      { at: 227.90, label: "let it go", emotion: "release", intensity: 0.70 },
      { at: 241.60, label: "the break", emotion: "hush", intensity: 0.48 },
      { at: 249.00, label: "the quench", emotion: "cooling", intensity: 0.34 },
      { at: 256.92, label: "más que oro", emotion: "settled", intensity: 0.22 },
    ],
    overallMood: "hard-won calm",
  },
  assets: {
    broll: [],
    stems: `${PUB}/planets/${SLUG}/stems/stems.json`,
    stemLag: 0,
    shots: Object.fromEntries(Object.entries(SIZES).map(([k, v]) => [scene(k), v])),
    keywords: Object.fromEntries(Object.entries(KEYWORDS).map(([w, k]) => [w, scene(k)])),
    sections: {
      resolve: scene("flame"), together: scene("somebodys"), release: scene("fire"),
      hush: scene("nothing"), cooling: scene("worth"), settled: scene("endcard"),
    },
  },
  interactions: { moments: [], tapEffect: "bloom" },
  dynamicPlus: {
    v: 2,
    directed: `FORGED ABOVE GOLD 62s cut — THE ANVIL LIGHT voice, 22 plates, the artists matted from their own photographs rather than generated. (window ${FROM}-${TO})`,
    scene: "EMBER",
    acts: [
      { start: FROM, end: 218.30, label: "FORGED ABOVE GOLD", why: "the final chorus, both voices" },
      { start: 218.30, end: 241.60, label: "THE TRADE", why: "English and Spanish alternating, then let the fire go" },
      { start: 241.60, end: TO, label: "MÁS QUE ORO", why: "the break, the spoken truth, the quench" },
    ],
    // phrase throughout. `dynamic` is barely usable at 1080px (§15) and this
    // window's key words are long — FORGED, UNTOUCHED, FOREVER — exactly the
    // lengths that hang off the left edge. Correct LRC lines read better.
    modes: [{ start: FROM, end: TO, mode: "phrase" }],
    words: {
      Forged: "cling", forged: "cling", gold: "shimmer", flame: "melt",
      untouched: "press", unchanged: "press", ashamed: "smudge",
      fuerte: "quake", burn: "melt", begging: "tremor",
      quiet: "fogbreath", puedo: "tilt", carry: "rise", light: "bloom",
      salvar: "dissolve", fire: "melt", nothing: "dissolve", prove: "press",
      forever: "cling", were: "slam", taught: "quake", worth: "rise",
      more: "cling", oro: "shimmer", Más: "shimmer",
    },
    deck: { glow: 1.15, grain: 0.62, density: 1.6, vignette: 0.72,
            giant: { life: 2000, pile: 0, clearOnSwitch: true },
            // tightest DIFFERENT-plate gap is 1.14s (fire -> nothing at the top of the
            // outro); 900ms cross-dissolved two plates into a visible double exposure
            motion: { swapMs: 650 } },
    // NO `hits` entry. One was authored on the drop (201.70) and it rendered as
    // a full-frame white wash for a whole second — in a film whose every frame is
    // near-black it read as a blown exposure, not an accent. The drop does not
    // need help; the mix already lands it.
    hits: [],
    holds: [{ start: 246.40, end: 249.00 }],  // the scripted [Pause] — hold, don't fill
    rolls: [],
  },
};

const row = {
  id: SLUG,
  title: "Forged Above Gold",
  artist: "Tyler Haze × Kizuna Sato",
  genre: "Alternative R&B",
  mood: "hard-won calm",
  color: "#E8A33D",
  cover: `${PUB}/planets/${SLUG}/cover.png`,
  audio_url: `/private/${SLUG}.mp3`,   // §13: hidden rows need a /private/ url
  sort_order: 903,
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
console.error(`row.json written — ${WORDS.length} words, ${LINES.length} LRC lines, ${Object.keys(KEYWORDS).length} keywords`);
