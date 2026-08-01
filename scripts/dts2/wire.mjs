// Wire the planet for the AGENOR debut cut (233.10 -> 303.20, 9:16 only).
//
// Everything here is checked against the playbook's paid-for rules before it
// is written, and the whole prior planet is backed up to the profile first.
//
//   §4   keyword anchors >=1s apart; no interactions.moments over the window
//   §11  a dynamic window must hold EXACTLY ONE word, and never a belt
//   §14  banners are SYNTHESISED when interactions.moments is empty — so the
//        list is trimmed, never emptied
//   pooledArt (KineticStage:643) rotates gallery.json pools in over our art,
//        so gallery.json is rewritten empty (handled by publish-gallery.mjs)
import fs from "node:fs";
import { db } from "./_db.mjs";

const ID = "different-this-summer";
const FROM = 233.10, TO = 303.20;
const B = "/planets/different-this-summer/debut";
const PROFILE = "/home/xsyprime/Hermes/x1c7.com/scripts/song-analysis/profiles/different-this-summer";

const { data, error } = await db.from("tracks").select("planet,lyrics_synced").eq("id", ID).single();
if (error) throw error;
const planet = structuredClone(data.planet);
const words = data.lyrics_synced.words;
const win = words.filter((w) => w.t >= FROM && w.t <= TO);
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");

// ── BACKDROP ────────────────────────────────────────────────────────────────
// 17 scenes, in narrative order. Every anchor word is unique inside the window
// so each painting lands exactly once, where it was written to land.
const SCENES = ["sleepwalking", "here", "gear", "away", "shoulders", "play", "someday",
  "learn", "build", "breathe", "fantasy", "working", "future", "too", "light", "losing", "me"];
const keywords = Object.fromEntries(SCENES.map((w) => [w, `${B}/scene-${w}.webp`]));
// "time" is the ONE word in this window that lives in KineticStage's
// SHARED_WORDS list, so without an entry here it would ghost in a cross-song
// painting and break the voice — twice. Pointing it at the road scene makes
// its 291.5 hit a no-op and gives "no more waiting for the RIGHT TIME" at
// 239.4 the road-at-dawn frame, which is the right picture for the line.
keywords.time = `${B}/scene-losing.webp`;

// Section art fires on analysis.sections emotion names (lowercased). The old
// map used noun forms (optimism/determination) that match NOTHING here, so it
// never fired at all. These four do match — the first establishes the opening
// frame before any word is sung; the other three are deliberate no-ops that
// simply hold whatever keyword scene is already up.
const sections = {
  determined: `${B}/scene-sleepwalking.webp`,  // 224.9 — the cold open
  uplifting: `${B}/scene-gear.webp`,           // 247.6 — holds `gear` (247.07)
  hopeful: `${B}/scene-too.webp`,              // 280.2 — holds `too` (279.60)
  reflective: `${B}/scene-losing.webp`,        // 295.5 — holds `losing` (291.12)
};

// ── THE MODE CONDUCTOR ──────────────────────────────────────────────────────
// Phrase carries the body: at 1080px wide a belted chorus in dynamic overflows
// the frame (§11), and phrase with correct LRC lines reads better anyway.
// Dynamic is spent on four QUIET single words — two in the male rap bridge and
// two in the spoken outro — where a huge word is a statement, not a smear.
const DYN = [
  // "time" was a dynamic window too and had to be dropped: measured at the
  // render viewport its giant word sat at left=-60px, losing the T. The
  // giant-word fitter DOES compute a positional clamp, but its imperative
  // marginLeft is clobbered by the element's inline style on the next React
  // render (the code says so at KineticStage:1662), so an FX that inflates the
  // word past its offsetWidth escapes the clamp. `here` measures left=+19 and
  // renders clean, so the statement lands on "right HERE" instead — one big
  // line rather than two adjacent ones, which reads better anyway.
  // "Yeah" went the same way as "time", for the same measured reason: whatever
  // treatment the giant word carries (letter-assemble by default, or any FX)
  // renders WIDER than the box the fitter clamped, and the fitter's positional
  // correction is overwritten before it can compensate — its Y sat at -42px.
  // Only words short enough to absorb that inflation survive at 1080px.
  [243.12, 244.80, "here"],   // measured left=+19, renders clean
  [299.70, 303.20, "me"],     // 2 letters, left=+245 — "new ME" over the crest
];
const modes = [];
let cur = FROM;
for (const [s, e] of DYN) {
  if (s > cur) modes.push({ start: +cur.toFixed(2), end: +s.toFixed(2), mode: "phrase" });
  modes.push({ start: s, end: e, mode: "dynamic" });
  cur = e;
}
if (cur < TO) modes.push({ start: +cur.toFixed(2), end: TO, mode: "phrase" });

// ── WORD FX ─────────────────────────────────────────────────────────────────
// Tranche 7 does the heavy lifting: `wake` on the line that names the theme,
// `draft` on every word that is a plan turning into a fact.
const fx = {
  // `time` is a DYNAMIC word (239.35). `cling` enters at scale 1.28, and the
  // giant-word fitter reserves exactly 78% of the frame as entrance headroom
  // (1/0.78 = 1.28) — so cling spends all of it and the tilt pushed the T off
  // the left edge. `neon` glows without growing.
  sleepwalking: "wake", sunshine: "neon", waiting: "echo", right: "slam", time: "neon",
  here: "slam", cold: "freeze", drink: "liquid", clear: "wake", mind: "draft", gear: "type",
  different: "chop", summer: "shimmer", fade: "dissolve", away: "dissolve",
  sun: "bloom", shoulders: "rise", brand: "draft", game: "type", play: "pulse",
  someday: "dissolve", learn: "type", little: "type", build: "draft", own: "draft", way: "draft",
  pour: "liquid", breathe: "whisper", palm: "wave", trees: "wave", fantasy: "shimmer",
  working: "pulse", glows: "bloom", future: "rise", easy: "drip",
  too: "cling", light: "neon", losing: "melt", me: "cling",
  official: "draft", vision: "draft", loading: "type", signal: "tremor",
  // "Yeah" is a DYNAMIC word (294.72). With no FX it falls back to the
  // letter-assemble entrance, which spreads the glyphs wider than the fitted
  // box — measured, its Y sat at left=-70. An explicit FX replaces that
  // entrance entirely, and `neon` glows without moving anything.
  yeah: "neon",
};

// ── THE BILLING ─────────────────────────────────────────────────────────────
const acts = [
  { start: 233.10, end: 243.00, label: "NO MORE SLEEPWALKING", why: "the thesis — the line he asked to open on" },
  { start: 259.00, end: 265.80, label: "BUILD OUR OWN WAY", why: "the drafting table: the plan becoming the life" },
  { start: 266.00, end: 272.00, label: "WORKING WHILE IT GLOWS", why: "the laptop on the sand — the whole argument in one shot" },
  { start: 296.00, end: 303.20, label: "SAME SUN · NEW ME", why: "AGENOR is his real name, carried; the crest lands here" },
];

// ── THE DECK ────────────────────────────────────────────────────────────────
const deck = {
  density: 2.3,        // the owner's "lots of particles", a hair under Summer Drip
  glow: 0.55,
  grain: 0.34,         // blueprint paper tooth
  vignette: 0.42,
  backdropHue: -0.06,  // lean the generative backdrop cold, toward the cyan voice
  // Scenes live 1.2–4s in this cut; the stock 24s ken-burns would show ~5% of
  // one move and every painting would read as a still. swapMs must drop below
  // the tightest anchor gap (1.22s, breathe -> fantasy) or that cut is eaten.
  motion: { dur: 2.4, amp: 1.0, swapMs: 900, fade: 0.34 },
  // SOLO staging for the four dynamic words: no residue pile to double-draw
  // over the phrase line underneath (§11's "SATOLEVELREADY").
  giant: { pile: 0, life: 2600, clearOnSwitch: true },
};

// ── VALIDATE BEFORE WRITING ─────────────────────────────────────────────────
const fail = [];

for (const [s, e, want] of DYN) {
  const inside = win.filter((w) => w.t >= s && w.t <= e);
  if (inside.length !== 1) fail.push(`dynamic ${s}-${e} holds ${inside.length} words: ${inside.map((w) => w.w).join(" ")}`);
  else if (norm(inside[0].w) !== norm(want)) fail.push(`dynamic ${s}-${e} holds "${inside[0].w}", expected "${want}"`);
  const before = win.filter((w) => w.t < s).pop(), after = win.find((w) => w.t > e);
  if (before && s - before.t < 0.05) fail.push(`dynamic ${s} starts <0.05s after "${before.w}"@${before.t}`);
  if (after && after.t - e < 0.05) fail.push(`dynamic ${e} ends <0.05s before "${after.w}"@${after.t}`);
}

const hits = Object.keys(keywords)
  .flatMap((k) => win.filter((w) => norm(w.w) === k).map((w) => ({ k, t: w.t, url: keywords[k] })))
  .sort((a, b) => a.t - b.t);
// The >=1s rule guards against the backdrop CHURNING, so it only applies when
// consecutive hits resolve to different paintings. `time` deliberately points
// at the same road scene as `losing`, so its 291.65 hit re-requests an image
// already on screen — no cut, nothing to space out.
let lastChange = null;
for (const h of hits) {
  if (lastChange && h.url !== lastChange.url && h.t - lastChange.t < 1.0) {
    fail.push(`scene change ${lastChange.k}@${lastChange.t.toFixed(2)} -> ${h.k}@${h.t.toFixed(2)} is <1s apart`);
  }
  if (!lastChange || h.url !== lastChange.url) lastChange = h;
}

const moments = (planet.interactions?.moments ?? []).filter((m) => !(m.end > FROM && m.t < TO));
const dropped = (planet.interactions?.moments ?? []).length - moments.length;
if (!moments.length) fail.push("interactions.moments would be EMPTY — the engine then SYNTHESISES banners (§14)");

const secs = planet.analysis?.sections ?? [];
for (let i = 1; i < secs.length; i++) {
  const d = secs[i].intensity - secs[i - 1].intensity;
  if (d >= 0.25) fail.push(`section rise ${d.toFixed(2)} at ${secs[i].at ?? secs[i].start} >= 0.25 -> synthesised BLOW`);
}
for (const s of secs) if (s.intensity >= 0.72) fail.push(`section intensity ${s.intensity} >= 0.72 -> synthesised SHAKE`);

console.log(`window ${FROM}-${TO}  words=${win.length}  scenes=${SCENES.length}  keyword hits=${hits.length}`);
console.log(`modes: ${modes.length} (${modes.filter((m) => m.mode === "dynamic").length} dynamic)`);
console.log(`moments: ${moments.length} kept, ${dropped} dropped as overlapping the window`);
console.log("\nBACKDROP TIMELINE");
for (const h of hits) console.log(`  ${h.t.toFixed(2)}  ${h.k}`);

if (fail.length) { console.error("\nVALIDATION FAILED:\n  " + fail.join("\n  ")); process.exit(1); }
console.log("\nall checks pass");

planet.assets = { ...planet.assets, keywords, sections };
planet.interactions = { ...planet.interactions, moments };
planet.dynamicPlus = { v: 2, acts, modes, words: fx, deck };

if (process.argv.includes("--write")) {
  const bak = `${PROFILE}/pre-refix-backup/planet-before-debut-cut.json`;
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, JSON.stringify(data.planet, null, 1));
  const { error: e2 } = await db.from("tracks").update({ planet }).eq("id", ID);
  if (e2) throw e2;
  fs.writeFileSync(`${PROFILE}/planet-debut-cut.json`, JSON.stringify(planet, null, 1));
  console.log(`WROTE planet (backup: ${bak})`);
} else {
  console.log("dry run — pass --write to apply");
}
