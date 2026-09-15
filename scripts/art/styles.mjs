// STYLE REGISTRY for the song-cut pipeline — the answer to "all my videos are
// starting to look the same".
//
// It is an augmentation layer, not a new table. `recipes.mjs` already holds 26
// working recipes across five engines with fifteen style LoRAs wired up, built
// for the Lexsycon night job. No song cut has ever used any of them: every one
// of the seventeen shipped voices came from prompt-only work on three SDXL
// checkpoints. This file adds the two things the cut pipeline needs on top —
// a CATEGORY taxonomy so you can ask for a medium, and a MOTION profile so the
// camera stops being the same Ken-Burns push every time.
//
//   node scripts/art/styles.mjs                 # the whole registry
//   node scripts/art/styles.mjs --pick warm     # what to use next, given a mood
//   node scripts/art/styles.mjs --unused        # what has never been shipped
import { readFileSync, existsSync } from "node:fs";
import { RECIPES } from "./recipes.mjs";

// ── CATEGORIES ───────────────────────────────────────────────────────────────
// Deliberately about MEDIUM, not subject. "A river at dusk" is not a style;
// "woodblock print" is. Subject variety was never the problem — every cut has a
// different subject and they still look alike.
export const CATEGORIES = {
  photoreal: "reads as a photograph — lens, grain, real light",
  painterly: "visible paint or ink — oil, watercolour, lacquer, gouache",
  illustrated: "drawn by a hand — linework, storybook, graphic novel, woodblock",
  animated: "cel/anime language — flat fills, key lines, cartoon logic",
  graphic: "design, not depiction — poster, screen-print, flat geometry, type",
  texture: "material first — papercut, chalk, stained glass, collage",
  synthetic: "obviously computed — 3d render, pixel art, neon tube, glitch",
};

// ── MOTION PROFILES ──────────────────────────────────────────────────────────
// The real fix for sameness. `ART_MOVES` in KineticStage is eight Ken-Burns
// presets, ALL between scale 1.10 and 1.29, picked by hashing the image URL —
// so every cut ever made shares one camera. A viewer watches motion for sixty
// seconds; the medium changes and the film language never does.
//
// A profile says how a plate should be moved. Chosen by style + shot size
// rather than by a hash, so a woodblock wide shot can sit almost still while a
// photoreal close-up pushes in.
export const MOTION = {
  hold:     { scale: [1.00, 1.00], pan: 0.0, note: "dead still. Never used yet, and stillness is a choice." },
  drift:    { scale: [1.00, 1.06], pan: 3.2, note: "near-static, long slow lateral — painterly and woodblock" },
  push:     { scale: [1.10, 1.29], pan: 2.4, note: "the current default — photoreal only from now on" },
  parallax: { scale: [1.04, 1.12], pan: 4.0, note: "foreground and background at different rates" },
  handheld: { scale: [1.06, 1.10], pan: 1.2, jitter: true, note: "small random shake — analog, documentary" },
  snap:     { scale: [1.00, 1.00], pan: 0.0, cutOnBeat: true, note: "no move at all; cut on the beat — graphic, pixel, type" },
};

// ── TYPOGRAPHY per category ──────────────────────────────────────────────────
// All 18 shipped cuts used one typeface (Space Grotesk), centred, uppercase —
// while the words are on screen for essentially the whole runtime. One face
// across every video was quietly a bigger driver of sameness than the art was.
// Maps to deck.type, which the stage resolves to CSS variables.
export const TYPE_BY_CATEGORY = {
  photoreal:   { family: "display", case: "uppercase", tracking: "-0.03em" },
  painterly:   { family: "serif",   case: "none",      tracking: "0.01em"  },
  illustrated: { family: "serif",   case: "none",      tracking: "0.02em"  },
  animated:    { family: "heavy",   case: "uppercase", tracking: "0.01em"  },
  graphic:     { family: "heavy",   case: "uppercase", tracking: "0.04em"  },
  texture:     { family: "hand",    case: "none",      tracking: "0.03em"  },
  synthetic:   { family: "pixel",   case: "uppercase", tracking: "0.06em"  },
};

// ── the augmentation ─────────────────────────────────────────────────────────
// recipe id -> [categories, motion profile]. Anything not listed falls back to
// illustrated/drift, which is a safer default than push.
const TAGS = {
  cinema: [["photoreal"], "push"],
  noir: [["photoreal"], "push"],
  photo: [["photoreal"], "handheld"],
  "neon-night": [["photoreal", "synthetic"], "push"],
  "film-still": [["photoreal"], "handheld"],
  analog: [["photoreal", "texture"], "handheld"],
  "osaka-gold": [["photoreal", "painterly"], "drift"],
  "concept-art": [["illustrated", "painterly"], "parallax"],
  "dream-collage": [["texture", "painterly"], "parallax"],
  poster: [["graphic"], "snap"],
  "word-portrait": [["graphic", "painterly"], "drift"],
  "word-neon": [["graphic", "synthetic"], "snap"],
  "dark-surreal": [["painterly"], "drift"],
  "oil-light": [["painterly"], "drift"],
  watercolor: [["painterly"], "drift"],
  storybook: [["illustrated"], "drift"],
  papercut: [["texture"], "parallax"],
  "3d-toy": [["synthetic"], "push"],
  pixel: [["synthetic", "graphic"], "snap"],
  stickers: [["graphic", "synthetic"], "snap"],
  chalkboard: [["texture", "illustrated"], "hold"],
  "neon-sign": [["synthetic", "graphic"], "snap"],
  "stained-glass": [["texture", "graphic"], "hold"],
  "graphic-novel": [["illustrated", "graphic"], "snap"],
  anime: [["animated"], "push"],
  "manga-line": [["animated", "illustrated"], "snap"],
};

export const STYLES = RECIPES.map((r) => {
  const [categories, motion] = TAGS[r.id] ?? [["illustrated"], "drift"];
  return {
    id: r.id,
    engine: r.engine,
    moods: r.moods ?? ["any"],
    categories,
    motion,
    // the first category wins the typeface — it is the dominant medium
    type: TYPE_BY_CATEGORY[categories[0]] ?? TYPE_BY_CATEGORY.photoreal,
    loras: (r.sdxl?.loras ?? []).map(([f]) => f),
    recipe: r,
  };
});

// ── what has already been spent ──────────────────────────────────────────────
// The seventeen shipped voices were bespoke, not recipe ids, so they are
// recorded by CATEGORY — which is what actually repeats. This is the file that
// lets the pipeline refuse to make the same-looking video twice.
const USAGE_PATH = "docs/codex/style-usage.json";

export function usage() {
  if (!existsSync(USAGE_PATH)) return { cuts: [] };
  return JSON.parse(readFileSync(USAGE_PATH, "utf8"));
}

/** Categories used by the last `n` cuts — the ones to avoid repeating. */
export function recentCategories(n = 5) {
  const cuts = usage().cuts.slice(-n);
  return new Set(cuts.flatMap((c) => c.categories ?? []));
}

/**
 * Suggest styles for the next cut: the right mood, and a medium that has NOT
 * been on screen lately. Sorted so the most-overdue category comes first.
 */
export function pickStyle(mood = "any", { avoidLast = 5 } = {}) {
  const hot = recentCategories(avoidLast);
  const spent = new Map();
  for (const c of usage().cuts) for (const k of c.categories ?? []) spent.set(k, (spent.get(k) ?? 0) + 1);
  return STYLES
    .filter((s) => s.moods.includes("any") || s.moods.includes(mood))
    .map((s) => ({
      ...s,
      fresh: !s.categories.some((c) => hot.has(c)),
      spend: Math.min(...s.categories.map((c) => spent.get(c) ?? 0)),
    }))
    .sort((a, b) => (b.fresh - a.fresh) || (a.spend - b.spend));
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("styles.mjs")) {
  const argv = process.argv.slice(2);
  const u = usage();
  if (argv[0] === "--pick") {
    const mood = argv[1] ?? "any";
    const hot = [...recentCategories()];
    console.log(`mood "${mood}" · avoiding categories from the last 5 cuts: ${hot.join(", ") || "(none recorded)"}\n`);
    for (const s of pickStyle(mood).slice(0, 10)) {
      console.log(`  ${s.fresh ? "NEW " : "seen"}  ${s.id.padEnd(15)} ${s.engine.padEnd(7)} ` +
        `${s.categories.join("+").padEnd(22)} motion:${s.motion.padEnd(9)} type:${s.type.family.padEnd(8)} ${s.loras.join(", ")}`);
    }
  } else if (argv[0] === "--unused") {
    const spent = new Set(u.cuts.flatMap((c) => c.categories ?? []));
    const never = Object.keys(CATEGORIES).filter((c) => !spent.has(c));
    console.log(`categories NEVER shipped in a cut: ${never.join(", ") || "(all used)"}\n`);
    for (const s of STYLES.filter((s) => s.categories.some((c) => never.includes(c)))) {
      console.log(`  ${s.id.padEnd(15)} ${s.categories.join("+").padEnd(22)} motion:${s.motion}`);
    }
  } else {
    console.log(`${STYLES.length} styles · ${Object.keys(CATEGORIES).length} categories · ` +
      `${Object.keys(MOTION).length} motion profiles · ${u.cuts.length} cuts recorded\n`);
    for (const [cat, blurb] of Object.entries(CATEGORIES)) {
      const mine = STYLES.filter((s) => s.categories.includes(cat));
      console.log(`${cat.toUpperCase().padEnd(12)} ${blurb}`);
      console.log(`             ${mine.map((s) => s.id).join(", ")}\n`);
    }
  }
}
