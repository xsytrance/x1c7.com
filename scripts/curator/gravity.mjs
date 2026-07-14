#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CURATOR · GRAVITY — how much does a word weigh?
//
// Scores every lexicon word 0..1 by impact/sentiment/imagery so the Atelier
// spends its paint on "fire" and "soul", never on "every" and "really".
// Deterministic heuristics first (keyword membership, idf, frequency, title
// words, seed lists), then a cached local-LLM grade for the borderline middle.
//
// Writes entry.gravity into src/data/lexicon.json:
//   { score, tier: heavy|mid|light, parts:{...}, seed, llm:{...}|null, v:1 }
//
// Tiers drive budgets downstream: heavy = 6 images/sense, mid = 2, light = 0.
// Seeds are law: the LLM never overrides them.
//
//   node scripts/curator/gravity.mjs                  # heuristics only
//   node scripts/curator/gravity.mjs --grade-limit 60 # + LLM grade borderline
//   node scripts/curator/gravity.mjs --show heavy     # print a tier
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HEAVY_SEED, LIGHT_SEED } from "./gravity-seeds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const LEX = path.join(ROOT, "src", "data", "lexicon.json");
const SONG_ART = path.join(ROOT, "scripts", "song-art");
const PROFILES = path.join(ROOT, "scripts", "song-analysis", "profiles");
const OLLAMA = process.env.OLLAMA_HOST || "http://localhost:11434";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const GRADE_LIMIT = parseInt(args["grade-limit"], 10) || 0;
const MODEL = args.model && args.model !== true ? args.model : "qwen3:14b";
const log = (...a) => console.error(...a);

export const TIER = (score) => (score >= 0.6 ? "heavy" : score < 0.35 ? "light" : "mid");
const BUDGETS = { heavy: 6, mid: 2, light: 0 };

// Function-word shapes the seed lists can't enumerate: adverbs, auxiliaries,
// gerund-only fillers. A hit CAPS the score at 0.15 unless heavy-seeded.
const FUNCTIONISH = /(?:^(?:gonna|wanna|gotta|lemme|gimme|cause|cuz)$)|(?:ly$)/;

// ── gather signals ──────────────────────────────────────────────────────────
function keywordWords() {
  const set = new Set();
  const scan = (file) => {
    try {
      const p = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const kw of p.analysis?.keywords ?? []) {
        const w = typeof kw.word === "string" ? kw.word.toLowerCase().trim() : "";
        if (w) set.add(w.normalize("NFD").replace(/[̀-ͯ]/g, ""));
      }
    } catch { /* skip unreadable */ }
  };
  if (fs.existsSync(SONG_ART))
    for (const f of fs.readdirSync(SONG_ART).filter((f) => f.endsWith("planet-full.json"))) scan(path.join(SONG_ART, f));
  if (fs.existsSync(PROFILES))
    for (const d of fs.readdirSync(PROFILES)) {
      const dir = path.join(PROFILES, d);
      try { for (const f of fs.readdirSync(dir).filter((f) => f.endsWith("planet-full.json"))) scan(path.join(dir, f)); } catch { /* not a dir */ }
    }
  return set;
}

function titleWords() {
  const set = new Set();
  if (fs.existsSync(PROFILES))
    for (const d of fs.readdirSync(PROFILES))
      for (const w of d.split("-")) if (w.length >= 3) set.add(w);
  return set;
}

// ── LLM grading (borderline words only, cached forever) ────────────────────
async function grade(words) {
  const sys = "You grade song-lyric words for a visual dictionary. For each word return: grade (0..1, how much visual/emotional IMPACT the word carries in song lyrics — 'fire'=0.95, 'thing'=0.05), sent (0..1 emotional charge), concrete (0..1 how paintable/concrete the imagery is), reason (five words max). Respond ONLY with JSON: {\"<word>\":{\"grade\":n,\"sent\":n,\"concrete\":n,\"reason\":\"...\"}, ...}";
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, stream: false, format: "json", think: false,
      options: { temperature: 0.1, num_ctx: 4096, num_predict: 2000 },
      messages: [{ role: "system", content: sys }, { role: "user", content: `Grade these words: ${words.join(", ")}` }],
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const body = await res.json();
  return JSON.parse(body.message?.content ?? "{}");
}

// ── scoring ─────────────────────────────────────────────────────────────────
export function scoreEntry(e, ctx) {
  const w = e.word;
  const seed = HEAVY_SEED.has(w) ? "heavy" : LIGHT_SEED.has(w) ? "light" : null;
  const prior = e.gravity?.llm ?? null;

  const kw = ctx.keywords.has(w) ? 1 : 0;
  const sent = prior?.sent ?? 0.5;
  const concrete = prior?.concrete ?? 0.5;
  const idf = ctx.songCount > 1 ? 1 - (e.sources.length - 1) / (ctx.songCount - 1) : 0.5;
  const freqNorm = Math.min(1, Math.log(1 + e.freq) / Math.log(50));
  const title = ctx.titles.has(w) ? 1 : 0;

  let score = 0.25 * kw + 0.20 * sent + 0.20 * concrete + 0.15 * idf + 0.10 * freqNorm + 0.10 * title;
  if (prior) score = 0.5 * score + 0.5 * prior.grade; // a real grade outweighs defaults

  if (seed === "heavy") score = Math.max(score, 0.75);
  else if (seed === "light" || FUNCTIONISH.test(w)) score = Math.min(score, 0.15);

  score = Math.round(score * 100) / 100;
  return {
    score, tier: TIER(score),
    parts: { kw, sent, concrete, idf: Math.round(idf * 100) / 100, freq: Math.round(freqNorm * 100) / 100, title },
    seed, llm: prior, v: 1,
  };
}

async function main() {
  const lex = JSON.parse(fs.readFileSync(LEX, "utf8"));
  const entries = Object.values(lex.entries);
  const ctx = { keywords: keywordWords(), titles: titleWords(), songCount: new Set(entries.flatMap((e) => e.sources)).size };
  log(`gravity: ${entries.length} words · ${ctx.keywords.size} LLM-picked keywords · ${ctx.songCount} songs`);

  for (const e of entries) e.gravity = scoreEntry(e, ctx);

  // LLM pass: borderline, ungraded, most-frequent first.
  if (GRADE_LIMIT > 0) {
    const borderline = entries
      .filter((e) => !e.gravity.seed && !e.gravity.llm && e.gravity.score >= 0.35 && e.gravity.score <= 0.65)
      .sort((a, b) => b.freq - a.freq)
      .slice(0, GRADE_LIMIT);
    log(`grading ${borderline.length} borderline words with ${MODEL}…`);
    for (let i = 0; i < borderline.length; i += 35) {
      const batch = borderline.slice(i, i + 35);
      try {
        const graded = await grade(batch.map((e) => e.word));
        const at = new Date().toISOString();
        for (const e of batch) {
          const g = graded[e.word];
          if (!g || typeof g.grade !== "number") continue;
          e.gravity.llm = {
            grade: Math.max(0, Math.min(1, g.grade)), sent: Math.max(0, Math.min(1, g.sent ?? 0.5)),
            concrete: Math.max(0, Math.min(1, g.concrete ?? 0.5)), reason: String(g.reason ?? "").slice(0, 80),
            model: MODEL, at,
          };
          e.gravity = { ...scoreEntry(e, ctx), llm: e.gravity.llm };
        }
        log(`  graded ${Math.min(i + 35, borderline.length)}/${borderline.length}`);
      } catch (err) { log(`  grade batch failed: ${err.message}`); }
    }
    // hand VRAM back
    await fetch(`${OLLAMA}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, keep_alive: 0 }) }).catch(() => {});
  }

  const dist = { heavy: 0, mid: 0, light: 0 };
  for (const e of entries) dist[e.gravity.tier]++;
  fs.writeFileSync(LEX, JSON.stringify(lex, null, 2));
  log(`✦ gravity written: ${dist.heavy} heavy · ${dist.mid} mid · ${dist.light} light`);
  const budget = entries.reduce((n, e) => n + e.senses.length * BUDGETS[e.gravity.tier], 0);
  log(`✦ full-gallery budget at heavy=6/mid=2/light=0: ~${budget} images`);

  if (args.show) {
    const tier = String(args.show);
    const list = entries.filter((e) => e.gravity.tier === tier).sort((a, b) => b.gravity.score - a.gravity.score);
    log(`\n${tier} (${list.length}):`);
    log(list.slice(0, 120).map((e) => `${e.word}:${e.gravity.score}`).join("  "));
  }
}

// Allow import { scoreEntry, TIER } without running.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
