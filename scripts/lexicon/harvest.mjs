#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LEXICON · HARVEST — seed the word dictionary from every song we've analyzed.
//
// Every planet-full.json the pipeline already produces carries `keywords`
// (word + emotion + imageryPrompt) plus a palette and mood. That data used to
// live and die inside one song. Harvest pours it into ONE global Lexicon, where
// each word accumulates senses, prompts, palettes, and provenance across every
// song it ever appears in. Run it after onboarding songs — it's idempotent and
// merges into the existing lexicon.json.
//
// Usage:
//   node scripts/lexicon/harvest.mjs            # merge all song-art planets
//   node scripts/lexicon/harvest.mjs --fresh    # rebuild from scratch
//   node scripts/lexicon/harvest.mjs --galaxy xsytrance-canon
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const SONG_ART = path.join(ROOT, "scripts", "song-art");
const OUT = path.join(ROOT, "src", "data", "lexicon.json");

const args = process.argv.slice(2);
const FRESH = args.includes("--fresh");
const galaxyArg = args.indexOf("--galaxy");
const GALAXY = galaxyArg >= 0 ? args[galaxyArg + 1] : "xsytrance-canon";

// Function words carry no imagery — never worth a sub-planet.
const STOPWORDS = new Set(
  ("a an and or but the of to in on at for with by from as is are was were be been am " +
   "i you he she it we they me my your his her its our their this that these those " +
   "so if then than too very just not no yes do does did will would can could should " +
   "up down out over under again once here there all any some more most " +
   "el la los las un una y o de del en con por para que se su tu mi lo al").split(/\s+/),
);

const norm = (w) =>
  (w || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "").replace(/\s+/g, " ").trim();

function loadLexicon() {
  if (!FRESH && fs.existsSync(OUT)) {
    try { return JSON.parse(fs.readFileSync(OUT, "utf8")); } catch { /* rebuild */ }
  }
  return { version: 1, galaxy: GALAXY, generatedAt: null, entries: {} };
}

function uniqPush(arr, v) { if (v && !arr.includes(v)) arr.push(v); }

function main() {
  if (!fs.existsSync(SONG_ART)) { console.error("no song-art dir at", SONG_ART); process.exit(1); }
  const files = fs.readdirSync(SONG_ART).filter((f) => f.endsWith("planet-full.json"));
  const lex = loadLexicon();
  lex.galaxy = GALAXY;
  const entries = lex.entries;

  let seen = 0, added = 0;
  for (const file of files) {
    let planet;
    try { planet = JSON.parse(fs.readFileSync(path.join(SONG_ART, file), "utf8")); }
    catch { continue; }
    const a = planet.analysis || planet;
    const source = file.replace(/-planet-full\.json$/, "").replace(/-planet\.json$/, "");
    const palette = Array.isArray(a.palette) ? a.palette : [];
    const mood = a.overallMood || "";
    const keywords = Array.isArray(a.keywords) ? a.keywords : [];

    for (const kw of keywords) {
      const form = (kw.word || "").trim();
      const key = norm(form);
      if (!key || key.length < 2 || STOPWORDS.has(key)) continue;
      seen++;
      const emotion = (kw.emotion || mood || "Neutral").trim();
      const prompt = (kw.imageryPrompt || "").trim();

      let e = entries[key];
      if (!e) { e = entries[key] = { word: key, forms: [], senses: [], freq: 0, sources: [], updatedAt: null }; added++; }
      e.freq++;
      uniqPush(e.forms, form);
      uniqPush(e.sources, source);

      // Group by emotion as a first-pass sense key (the dream loop refines glosses).
      let sense = e.senses.find((s) => s.emotion.toLowerCase() === emotion.toLowerCase());
      if (!sense) {
        sense = { gloss: emotion, pos: "other", emotion, imageryPrompts: [], images: [], palette: [], legos: { weather: [], surface: [], veils: [], text: [], light: [] }, score: 1 };
        e.senses.push(sense);
      } else { sense.score++; }
      uniqPush(sense.imageryPrompts, prompt);
      for (const c of palette) uniqPush(sense.palette, c);
    }
  }

  // Recompute stats.
  const all = Object.values(entries);
  const senses = all.reduce((n, e) => n + e.senses.length, 0);
  const images = all.reduce((n, e) => n + e.senses.reduce((m, s) => m + s.images.length, 0), 0);
  lex.stats = { words: all.length, senses, images, filled: 0 };
  lex.generatedAt = new Date().toISOString();

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(lex, null, 2));
  console.log(`✦ harvested ${files.length} songs · ${seen} keyword-instances`);
  console.log(`✦ lexicon "${GALAXY}": ${all.length} words (${added} new), ${senses} senses`);
  console.log(`✦ wrote ${path.relative(ROOT, OUT)}`);
  console.log(`  next: node scripts/lexicon/dream.mjs   (grow the legos)`);
}

main();
