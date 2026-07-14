#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CURATOR · MATCH REEL — the right pictures find the right song.
//
// Two stages, accuracy first:
//   A) COSINE PREFILTER — for every word the song actually sings (or the LLM
//      picked as a keyword), embed "word + its lyric line + the song's themes
//      /summary/mood" and rank that word's images by cosine against their
//      cached vision readings. Top 3 per word survive.
//   B) THE JUDGE — qwen3:14b reads each candidate's READING (never pixels —
//      a wrong reading that doesn't fit the song gets rejected instead of
//      propagated) against the song's story and the lyric line. accept ≥0.55,
//      featured ≥0.7.
//
// Output: profiles/<id>/lexicon-reel.json; --publish ships it to R2
// planets/<id>/lexicon-reel.json for the dossier + the live show.
//
//   node scripts/curator/match-reel.mjs --song i-won-t-be-your-fire
//   node scripts/curator/match-reel.mjs --song <id> --publish
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { readingText } from "./vision-worker.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const LEX = path.join(ROOT, "src", "data", "lexicon.json");
const INDEX = path.join(__dirname, "vision-index.json");
const EMB = path.join(__dirname, ".cache", "embeddings.jsonl");
const PROFILES = path.join(ROOT, "scripts", "song-analysis", "profiles");
const OLLAMA = process.env.OLLAMA_HOST || "http://localhost:11434";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const SONG = args.song && args.song !== true ? String(args.song) : null;
if (!SONG) { console.error("need --song <id>"); process.exit(1); }
const JUDGE = args.model && args.model !== true ? args.model : "qwen3:14b";
const EMB_MODEL = "qwen3-embedding:0.6b";
const ACCEPT = args.accept ? parseFloat(args.accept) : 0.55;
const FEATURED = 0.7;
const CAP = parseInt(args.cap, 10) || 32;
const log = (...a) => console.error(...a);

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const E = { ...loadEnv(path.join(ROOT, ".env")), ...loadEnv(path.join(ROOT, ".env.local")) };
const PUB = (E.PUBLIC_URL || "").replace(/\/$/, "");
const RCLONE = fs.existsSync(`${process.env.HOME}/.local/bin/rclone`) ? `${process.env.HOME}/.local/bin/rclone` : "rclone";
const rcloneEnv = {
  ...process.env, RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: E.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: E.SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: E.ENDPOINT,
};

const norm = (w) => (w || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
const cos = (x, y) => { let s = 0, nx = 0, ny = 0; for (let i = 0; i < x.length; i++) { s += x[i] * y[i]; nx += x[i] * x[i]; ny += y[i] * y[i]; } return s / (Math.sqrt(nx) * Math.sqrt(ny)); };

async function embed(text) {
  const r = await fetch(`${OLLAMA}/api/embeddings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: EMB_MODEL, prompt: text }) });
  if (!r.ok) throw new Error(`embed ${r.status}`);
  return (await r.json()).embedding;
}
async function judge(song, cand) {
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: JUDGE, stream: false, format: "json", think: false,
      options: { temperature: 0.1, num_ctx: 4096, num_predict: 200 },
      messages: [
        { role: "system", content: 'You judge whether an image belongs in a song\'s visual reel. You get the SONG (story/themes/mood) and one IMAGE READING (a text description of the image) tied to a sung word and its lyric line. Score fit strictly: does this image belong in THIS song\'s world — subject, mood, symbolism? Respond ONLY JSON: {"score":0..1,"reason":"ten words max"}.' },
        { role: "user", content: `SONG: ${song.title}\nStory: ${song.story}\nThemes: ${song.themes}\nMood: ${song.mood}\n\nWORD: "${cand.word}" · LYRIC LINE: "${cand.line}"\nIMAGE READING: ${cand.text}` },
      ],
    }),
  });
  if (!r.ok) throw new Error(`judge ${r.status}`);
  const msg = (await r.json()).message ?? {};
  const raw = (msg.content || "").trim() || (msg.thinking || "").trim();
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  const j = JSON.parse(raw.slice(a, b + 1));
  return { score: Math.max(0, Math.min(1, Number(j.score ?? 0))), reason: String(j.reason ?? "").slice(0, 90) };
}

async function main() {
  const lex = JSON.parse(fs.readFileSync(LEX, "utf8"));
  const index = JSON.parse(fs.readFileSync(INDEX, "utf8"));
  const embs = new Map(fs.readFileSync(EMB, "utf8").split("\n").filter(Boolean).map((l) => {
    const j = JSON.parse(l);
    return [j.key, new Float32Array(Buffer.from(j.b64, "base64").buffer, 0, j.dim)];
  }));

  // ── the song's own words + context
  const profPath = path.join(PROFILES, SONG, "profile.json");
  const prof = JSON.parse(fs.readFileSync(profPath, "utf8"));
  const analysis = prof.analysis ?? {};
  const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", E.SUPABASE_SERVICE_ROLE_KEY);
  const { data: row } = await db.from("tracks").select("lyrics_synced").eq("id", SONG).single();
  const words = row?.lyrics_synced?.words ?? [];

  // word → first sung time + its lyric line (nearest words ±3s window)
  const firstT = new Map(), lineOf = new Map();
  for (let i = 0; i < words.length; i++) {
    const k = norm(words[i].w);
    if (!k || firstT.has(k)) continue;
    firstT.set(k, words[i].t);
    lineOf.set(k, words.filter((w) => Math.abs(w.t - words[i].t) < 3).map((w) => w.w).join(" "));
  }
  const song = {
    title: prof.identity?.title ?? SONG,
    story: analysis.meaning?.story || analysis.summary || "",
    themes: (analysis.themes ?? []).join(", "),
    mood: analysis.overallMood ?? "",
  };
  const songCtxBase = `${song.story}. Themes: ${song.themes}. Mood: ${song.mood}`;

  // ── candidates: sung/keyword words that own indexed images
  const wordSet = new Set([...firstT.keys(), ...(analysis.keywords ?? []).map((k) => norm(k.word))].filter(Boolean));
  const candidates = [];
  for (const w of wordSet) {
    const e = lex.entries[w];
    if (!e || e.gravity?.tier === "light") continue;
    e.senses.forEach((s, i) => {
      for (const url of s.images ?? []) {
        const key = String(url).replace(`${PUB}/`, "");
        const rd = index.images[key]?.reading;
        if (!rd || rd.quality < 0.5 || rd.wordMatch < 0.5) continue;
        if (!embs.has(key)) continue;
        candidates.push({ key, url, word: w, sense: i, recipe: index.images[key].recipe, text: readingText(rd), line: lineOf.get(w) ?? w, t: firstT.get(w) ?? null });
      }
    });
  }
  log(`match-reel ${SONG}: ${wordSet.size} song words · ${candidates.length} indexed candidates`);
  if (!candidates.length) { log("nothing to match — render + vision-index this song's words first"); process.exit(0); }

  // ── stage A: cosine per word, keep top 3
  const byWord = new Map();
  for (const c of candidates) { if (!byWord.has(c.word)) byWord.set(c.word, []); byWord.get(c.word).push(c); }
  const pool = [];
  for (const [w, cands] of byWord) {
    const ctx = await embed(`${w}. "${lineOf.get(w) ?? w}". ${songCtxBase}`);
    for (const c of cands) c.cosine = cos(ctx, embs.get(c.key));
    cands.sort((a, b) => b.cosine - a.cosine);
    pool.push(...cands.slice(0, 3));
  }
  pool.sort((a, b) => b.cosine - a.cosine);
  const judged = pool.slice(0, Math.max(CAP * 2, 48));
  log(`  stage A: ${pool.length} → judging ${judged.length}`);

  // ── stage B: the judge
  const reel = [];
  for (const c of judged) {
    try {
      const v = await judge(song, c);
      if (v.score >= ACCEPT) reel.push({
        img: c.url, key: c.key, word: c.word, line: c.line, t: c.t,
        score: Math.round(v.score * 100) / 100, cosine: Math.round(c.cosine * 1000) / 1000,
        reason: v.reason, recipe: c.recipe, featured: v.score >= FEATURED,
      });
    } catch (err) { log(`  judge failed ${c.key}: ${err.message}`); }
  }
  reel.sort((a, b) => b.score - a.score);
  const final = reel.slice(0, CAP);
  const byWordIdx = {};
  final.forEach((r, i) => { (byWordIdx[r.word] ??= []).push(i); });

  const out = {
    v: 1, id: SONG, generatedAt: new Date().toISOString(), model: JUDGE, embModel: EMB_MODEL,
    counts: { candidates: candidates.length, judged: judged.length, accepted: reel.length, kept: final.length },
    reel: final, byWord: byWordIdx,
  };
  const outPath = path.join(PROFILES, SONG, "lexicon-reel.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  log(`✦ reel: ${final.length} images (${final.filter((r) => r.featured).length} featured) → ${path.relative(ROOT, outPath)}`);
  for (const r of final.slice(0, 12)) log(`   ${r.featured ? "★" : "·"} ${r.word} ${r.score} ${r.recipe} — ${r.reason}`);

  if (args.publish) {
    execFileSync(RCLONE, ["copyto", outPath, `R2:${E.BUCKET}/planets/${SONG}/lexicon-reel.json`, "--s3-disable-checksum", "--s3-no-check-bucket"], { env: rcloneEnv, stdio: "ignore" });
    log(`✦ published → planets/${SONG}/lexicon-reel.json`);
  }
  await fetch(`${OLLAMA}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: JUDGE, keep_alive: 0 }) }).catch(() => {});
}

await main();
