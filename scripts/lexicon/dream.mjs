#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LEXICON · DREAM LOOP — grow the legos while you sleep.
//
// Harvest seeds words + senses. This walks the FRONTIER — the words that don't
// yet have effects — in priority order (frequency × salience) and fills in the
// code-tier legos: which weather, surface, veil, text, and light effects each
// word-sense should be able to wear, plus extra imagery prompts. Code-tier
// legos are near-free (params, not pixels), so we generate them exhaustively;
// the expensive image legos are left as prompts for a separate pass.
//
// It's a QUEUE, not a firehose: --limit words per run, resumable, and it LOGS
// what it skipped so "covered everything" never lies. Run it on a cron, or in a
// /loop, and the shelf keeps filling.
//
// Usage:
//   node scripts/lexicon/dream.mjs                 # fill next 40 unfilled words
//   node scripts/lexicon/dream.mjs --limit 999     # do the whole frontier
//   node scripts/lexicon/dream.mjs --force         # re-dream already-filled words
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const LEX = path.join(ROOT, "src", "data", "lexicon.json");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const li = args.indexOf("--limit");
const LIMIT = li >= 0 ? parseInt(args[li + 1], 10) || 40 : 40;

// ── The lego vocabularies — which words summon which effect. ────────────────
// The registry (src/lib/effects/registry.ts) is the runtime source of truth,
// and its literal EffectLego rows are EXTRACTED from source at run time — so a
// new effect row lands in the dream loop automatically. (The old hand-copied
// tables drifted 16 text effects behind the registry; this kills that class of
// bug.) EXTRA_* below layers the dream loop's own enrichments on top: shelf-
// only vocabulary that would be too loose for the live stage matchers.
const REGISTRY = path.join(ROOT, "src", "lib", "effects", "registry.ts");
function registryTags() {
  const src = fs.readFileSync(REGISTRY, "utf8");
  const rows = [...src.matchAll(
    /\{\s*id:\s*"[\w.]+",\s*class:\s*"(airborne|textbound|light|surface)"[^}]*?mode:\s*"([\w-]+)"[^}]*?tags:\s*\[([^\]]*)\]/g,
  )];
  const out = { airborne: {}, textbound: {}, light: {}, surface: {} };
  for (const [, cls, mode, tagSrc] of rows) {
    const tags = [...tagSrc.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    out[cls][mode] = [...new Set([...(out[cls][mode] || []), ...tags])];
  }
  return out;
}
const mergeTags = (base, extra) => {
  const out = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(extra)]))
    out[k] = [...new Set([...(base[k] || []), ...(extra[k] || [])])];
  return out;
};

const EXTRA_WEATHER_TAGS = {
  ash: ["smoke"],
  embers: ["spark"],
  rain: ["tear", "cry", "wave"],
  bubbles: ["night"],
  sparks: ["screen", "tech"],
  petals: ["kiss"],
  pollen: ["warm"],
  dust: ["road", "wander"],
};
// SURFACE rows in the registry are generated from SURFACE_SPECS with only their
// own name as a tag, so the dream loop's richer vocabulary is the real matcher.
const EXTRA_SURFACE_TAGS = {
  mud: ["mud", "swamp", "dirt", "mire", "bog", "sink", "stuck", "filth"],
  rust: ["rust", "decay", "rot", "corrode", "abandon", "ruin", "neglect", "metal"],
  cracks: ["crack", "fracture", "break", "split", "shatter", "broken", "fault", "glass"],
  condensation: ["condensation", "humid", "sweat", "window", "breath", "steam"],
  vines: ["vine", "ivy", "overgrow", "jungle", "wild", "tangle", "reclaim"],
  moss: ["moss", "forest", "damp", "ancient", "stone", "green"],
  blood: ["blood", "wound", "bleed", "scar", "hurt", "kill", "vein"],
  sand: ["sand", "dune", "drought", "dry", "erode", "hourglass", "time"],
};
const EXTRA_TEXT_TAGS = {
  burn: ["rage"],
  shatter: ["apart"],
  dissolve: ["vanish", "erase", "regret"],
  glitch: ["error"],
};
const EXTRA_LIGHT_TAGS = {
  godrays: ["rise"],
  flare: ["glow"],
  flicker: ["ghost"],
  blackout: ["empty"],
};

const REG = registryTags();
// Parser drift guard — if the registry's row format changes and extraction goes
// blind, fail LOUDLY instead of silently dreaming with empty tables.
if (!Object.keys(REG.textbound).length || !Object.keys(REG.airborne).length || !Object.keys(REG.light).length) {
  console.error("✗ could not extract effect rows from registry.ts — the row format drifted from this parser");
  process.exit(1);
}
const WEATHER_TAGS = mergeTags(REG.airborne, EXTRA_WEATHER_TAGS);
const SURFACE_TAGS = mergeTags(REG.surface, EXTRA_SURFACE_TAGS);
const TEXT_TAGS = mergeTags(REG.textbound, EXTRA_TEXT_TAGS);
const LIGHT_TAGS = mergeTags(REG.light, EXTRA_LIGHT_TAGS);
const WEATHER_VEIL = { embers: "ash", ash: "ash", rain: "fog", snow: "frost", dust: "dust", bubbles: "steam", sparks: "static", petals: "fog", pollen: "dust" };

// Emotion → guaranteed legos, so even an abstract word gets a fitting treatment.
const EMOTION_RULES = [
  [/rage|anger|fury|defian|intens|desper/, { weather: "embers", text: "burn", light: "flicker" }],
  [/sad|grief|regret|sorrow|melanchol|loss|lonel|pensive/, { weather: "ash", text: "dissolve", light: "blackout" }],
  [/love|romance|tender|desire|passion|amor/, { weather: "petals", text: "bloom", light: "flare" }],
  [/hope|joy|euphor|excite|uplift|triumph|freedom/, { weather: "pollen", text: "bloom", light: "godrays" }],
  [/cold|numb|distant|empty|isolat/, { weather: "snow", text: "freeze", light: "blackout" }],
  [/fear|anxious|dread|haunt|paranoi/, { weather: "sparks", text: "glitch", light: "flicker" }],
  [/nostalg|wistful|longing|yearn|remini|bittersweet/, { weather: "dust", text: "chromatic", light: "flare" }],
  [/hurt|pain|wound|betray|anguish|torment/, { weather: "ash", text: "bleed", light: "flicker" }],
  [/calm|peace|relax|serene|dream/, { weather: "dust", text: "dissolve", light: "godrays" }],
];

const push = (arr, v) => { if (v && !arr.includes(v)) arr.push(v); };
// Token/stem matching — NOT substring. "crashing" must not match the "ash" tag,
// "voice" must not match "ice". Whole-word hits, plus a short stem for tags ≥4
// chars (so "fire"→"fires", "love"→"loved") without swallowing unrelated words.
function makeHas(text) {
  const tokens = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));
  return (tag) => {
    if (tag.includes(" ")) return text.includes(tag);
    if (tokens.has(tag)) return true;
    if (tag.length >= 4) for (const tk of tokens) if (tk.startsWith(tag) && tk.length - tag.length <= 2) return true;
    return false;
  };
}
function matchTags(has, table, out) {
  for (const [mode, tags] of Object.entries(table)) {
    if (tags.some(has)) push(out, mode);
  }
}

function dreamSense(word, sense) {
  // The semantic CORE of the sense — what the word actually means.
  const core = [word, sense.gloss, sense.emotion].join(" ").toLowerCase();
  // The full text also folds in imagery prompts — fine for atmospheric picks,
  // but those prompts are scene dressing ("a lantern in a dark FOREST path")
  // full of incidental nouns.
  const text = [core, ...(sense.imageryPrompts || [])].join(" ").toLowerCase();
  const has = makeHas(text);
  // SURFACE is the exception: it's a texture that creeps over the WHOLE frame,
  // so a false positive is loud (a breakup song draped in green moss because its
  // imagery merely mentioned a forest). Tag it from the word's meaning ONLY, not
  // from incidental scene-dressing in the prompts.
  const hasCore = makeHas(core);
  const legos = sense.legos || (sense.legos = { weather: [], surface: [], veils: [], text: [], light: [] });

  matchTags(has, WEATHER_TAGS, legos.weather);
  matchTags(hasCore, SURFACE_TAGS, legos.surface);
  // TEXT is word-attached, so like SURFACE it matches the word's MEANING only.
  // Matching the full prompt text put neon on every sense in the shelf — the
  // generated prompt suffix "…volumetric light, film grain" hits neon's
  // "light" tag. Scene dressing must not pick word treatments.
  matchTags(hasCore, TEXT_TAGS, legos.text);
  matchTags(has, LIGHT_TAGS, legos.light);

  // Emotion guarantees — never leave a sense empty.
  const emo = sense.emotion.toLowerCase();
  for (const [re, rule] of EMOTION_RULES) {
    if (re.test(emo)) {
      if (rule.weather) push(legos.weather, rule.weather);
      if (rule.text) push(legos.text, rule.text);
      if (rule.light) push(legos.light, rule.light);
      break;
    }
  }
  if (!legos.weather.length) push(legos.weather, "dust");
  if (!legos.text.length) push(legos.text, "dissolve");
  // Veils follow from the weather (what you'd wipe away).
  for (const w of legos.weather) push(legos.veils, WEATHER_VEIL[w] || "fog");

  // Cheap imagery-prompt variants so image generation has angles to pick from.
  const base = sense.imageryPrompts[0];
  if (base && sense.imageryPrompts.length < 4) {
    push(sense.imageryPrompts, `${base} — extreme close-up, shallow depth of field`);
    push(sense.imageryPrompts, `${word}, ${sense.emotion.toLowerCase()} mood, cinematic, volumetric light, film grain`);
  } else if (!base) {
    push(sense.imageryPrompts, `${word}, ${sense.emotion.toLowerCase()} mood, cinematic, volumetric light`);
  }
  return legos;
}

const filled = (e) => e.senses.length > 0 && e.senses.every((s) => {
  const l = s.legos || {};
  return (l.weather?.length || 0) + (l.surface?.length || 0) + (l.veils?.length || 0) + (l.text?.length || 0) + (l.light?.length || 0) > 0;
});

function main() {
  if (!fs.existsSync(LEX)) { console.error("no lexicon — run harvest.mjs first"); process.exit(1); }
  const lex = JSON.parse(fs.readFileSync(LEX, "utf8"));
  const all = Object.values(lex.entries);

  // Priority: unfilled first, then frequency × salience × word gravity —
  // heavy words dream first (curator/gravity.mjs; 0.25 floor keeps ungraded
  // words in the queue rather than starving them).
  const grav = (e) => 0.25 + (e.gravity?.score ?? 0.5);
  const queue = all
    .filter((e) => FORCE || !e.updatedAt || !filled(e))
    .sort((a, b) => (b.freq * (b.senses.length || 1) * grav(b)) - (a.freq * (a.senses.length || 1) * grav(a)));

  const todo = queue.slice(0, LIMIT);
  const skipped = queue.length - todo.length;
  const now = new Date().toISOString();

  let dreamt = 0, newLegos = 0;
  for (const e of todo) {
    for (const s of e.senses) {
      const before = Object.values(s.legos || {}).reduce((n, a) => n + (a?.length || 0), 0);
      dreamSense(e.word, s);
      newLegos += Object.values(s.legos).reduce((n, a) => n + a.length, 0) - before;
    }
    e.updatedAt = now;
    dreamt++;
  }

  // Stats.
  const f = all.filter(filled).length;
  const senses = all.reduce((n, e) => n + e.senses.length, 0);
  const images = all.reduce((n, e) => n + e.senses.reduce((m, s) => m + (s.images?.length || 0), 0), 0);
  lex.stats = { words: all.length, senses, images, filled: f };
  lex.generatedAt = now;

  fs.writeFileSync(LEX, JSON.stringify(lex, null, 2));
  console.log(`✦ registry loaded: ${Object.keys(REG.textbound).length} text · ${Object.keys(REG.airborne).length} weather · ${Object.keys(REG.light).length} light effects`);
  console.log(`✦ dreamt ${dreamt} words (+${newLegos} legos)`);
  console.log(`✦ lexicon now ${f}/${all.length} words filled · ${senses} senses`);
  // Shelf coverage — how many senses can wear each text effect. Effects at zero
  // aren't a bug (no harvested word matches their tags yet), but they should be
  // VISIBLE, not silently absent — that's how the old drift went unnoticed.
  const wear = {};
  for (const e of all) for (const s of e.senses) for (const t of s.legos?.text ?? []) wear[t] = (wear[t] || 0) + 1;
  console.log("✦ text-effect coverage: " + Object.entries(wear).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" "));
  const never = Object.keys(TEXT_TAGS).filter((t) => !wear[t]);
  if (never.length) console.log(`  not yet worn by any sense: ${never.join(", ")} — the shelf grows as songs bring their vocabulary`);
  if (skipped > 0) console.log(`  ${skipped} more on the frontier — run again to keep growing`);
  else console.log(`  frontier clear — every word has legos ✨`);
}

main();
