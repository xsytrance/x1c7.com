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
// 2026-07-14 — THE LYRICS PASS: keywords are the LLM's dozen picks per song;
// the catalog actually SINGS thousands of timed words. Harvest now also mines
// `lyrics_synced` from the live DB — every word sung at least --min-freq
// times (default 2) across the catalog becomes a shelf entry, sensed by its
// song's mood. The dream loop then fills legos at its own pace (it's a
// queue). This is the 10× vocabulary jump.
//
// Usage:
//   node scripts/lexicon/harvest.mjs            # planets + the lyrics pass
//   node scripts/lexicon/harvest.mjs --fresh    # rebuild from scratch
//   node scripts/lexicon/harvest.mjs --no-lyrics --min-freq 3
//   node scripts/lexicon/harvest.mjs --galaxy xsytrance-canon
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const SONG_ART = path.join(ROOT, "scripts", "song-art");
const OUT = path.join(ROOT, "src", "data", "lexicon.json");

const args = process.argv.slice(2);
const FRESH = args.includes("--fresh");
const LYRICS = !args.includes("--no-lyrics");
const mfArg = args.indexOf("--min-freq");
const MIN_FREQ = mfArg >= 0 ? Number(args[mfArg + 1]) : 2;
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

// Lyric noise: interjections, fillers, and contractions that sing constantly
// but paint nothing. Only applied to the lyrics pass — a keyword the analyst
// chose stays a keyword.
const LYRIC_NOISE = new Set(
  ("oh ooh oohh ohh yeah yea yeh hey heyy na nah la da uh uhh um mm mmm hmm ah ahh aye ay ayy yo whoa woah " +
   "don't dont can't cant won't wont ain't aint i'm im it's you're we're they're he's she's that's there's what's " +
   "i'll you'll we'll he'll she'll i've you've we've they've i'd you'd he'd she'd we'd gonna wanna gotta lemme gimme " +
   "cause cuz cos 'cause got get let like know go going still right now one two way then when where who how why " +
   "your my our us them him her had has have was were been being off into onto only ever never always " +
   "es un no si sí ya le les tú él má má' pa pa' na' to' e a o u y").split(/\s+/),
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

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

// ── THE LYRICS PASS ── every timed word the catalog actually sings.
async function harvestLyrics(entries) {
  const env = { ...loadEnv(path.join(ROOT, ".env")), ...loadEnv(path.join(ROOT, ".env.local")) };
  if (!env.SUPABASE_SERVICE_ROLE_KEY) { console.error("· lyrics pass skipped (no Supabase key)"); return { seen: 0, added: 0, skippedRare: 0 }; }
  const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await db.from("tracks")
    .select("id, lyrics_synced, planet")
    .eq("hidden", false);
  if (error) { console.error("· lyrics pass skipped:", error.message); return { seen: 0, added: 0, skippedRare: 0 }; }

  // count catalog-wide first, so --min-freq means "sung in the catalog N times"
  const counts = new Map(); // key -> { n, forms:Set, songs:Map(source -> mood) }
  let seen = 0;
  for (const row of data) {
    const words = row.lyrics_synced?.words;
    if (!Array.isArray(words)) continue;
    const mood = row.planet?.analysis?.overallMood || "Neutral";
    for (const w of words) {
      const form = String(w.w || "").trim();
      const key = norm(form);
      if (!key || key.length < 3 || STOPWORDS.has(key) || LYRIC_NOISE.has(key)) continue;
      if (/^\d+$/.test(key)) continue;
      seen++;
      let c = counts.get(key);
      if (!c) { c = { n: 0, forms: new Set(), songs: new Map() }; counts.set(key, c); }
      c.n++;
      c.forms.add(form);
      if (!c.songs.has(row.id)) c.songs.set(row.id, mood);
    }
  }

  let added = 0, skippedRare = 0;
  for (const [key, c] of counts) {
    if (c.n < MIN_FREQ) { skippedRare++; continue; }
    let e = entries[key];
    if (!e) { e = entries[key] = { word: key, forms: [], senses: [], freq: 0, sources: [], updatedAt: null }; added++; }
    e.freq += c.n;
    for (const f of c.forms) uniqPush(e.forms, f);
    for (const [source, mood] of c.songs) {
      uniqPush(e.sources, source);
      // sense keyed by the song's mood — the dream loop refines the gloss
      let sense = e.senses.find((s) => s.emotion.toLowerCase() === mood.toLowerCase());
      if (!sense) {
        sense = { gloss: mood, pos: "other", emotion: mood, imageryPrompts: [], images: [], palette: [], legos: { weather: [], surface: [], veils: [], text: [], light: [] }, score: 1 };
        e.senses.push(sense);
      } else { sense.score++; }
    }
  }
  console.log(`✦ lyrics pass: ${seen} sung-word instances · ${added} new shelf words (min-freq ${MIN_FREQ}; ${skippedRare} rare words left for the songs to earn)`);
  return { seen, added, skippedRare };
}

async function main() {
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

  if (LYRICS) await harvestLyrics(entries);

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
