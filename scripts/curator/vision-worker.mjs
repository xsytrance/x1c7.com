#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CURATOR · VISION WORKER — the machine looks at its own paintings.
//
// For every lexicon image without a cached reading: fetch the webp from R2,
// resize to 672px JPEG, and ask a local VLM (qwen3-vl) what it actually
// shows — subjects, setting, mood, style, symbols, text-in-image — plus two
// self-QC scores: `quality` (render artifacts?) and `wordMatch` (does it
// depict its own word?). Readings are cached forever in vision-index.json
// (published to R2 as lexicon-vision.json for durability) and embedded via
// qwen3-embedding into a local-only cache for the matcher's cosine prefilter.
//
//   node scripts/curator/vision-worker.mjs --limit 400
//   node scripts/curator/vision-worker.mjs --word fire --limit 8
//   node scripts/curator/vision-worker.mjs --song i-won-t-be-your-fire
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const LEX = path.join(ROOT, "src", "data", "lexicon.json");
const INDEX = path.join(__dirname, "vision-index.json");
const CACHE_DIR = path.join(__dirname, ".cache");
const EMB = path.join(CACHE_DIR, "embeddings.jsonl");
const OLLAMA = process.env.OLLAMA_HOST || "http://localhost:11434";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const LIMIT = parseInt(args.limit, 10) || 400;
const MODEL = args.model && args.model !== true ? args.model : "qwen3-vl:8b";
const EMB_MODEL = "qwen3-embedding:0.6b";
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
const E = loadEnv(path.join(ROOT, ".env"));
const PUB = (E.PUBLIC_URL || "").replace(/\/$/, "");
const rcloneEnv = {
  ...process.env, RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: E.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: E.SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: E.ENDPOINT,
};
const RCLONE = fs.existsSync(`${process.env.HOME}/.local/bin/rclone`) ? `${process.env.HOME}/.local/bin/rclone` : "rclone";

const READ_SYS =
  "You examine one AI-generated artwork from a visual dictionary of song words. Respond ONLY with JSON keys: " +
  "caption (one vivid sentence), subjects (array of concrete things shown), setting (where/when), mood (array of feelings), " +
  "palette (array of 2-4 hex colors that dominate), style (art style in a few words), symbols (array: what the image evokes/means), " +
  "textInImage (exact visible text, empty string if none), " +
  "quality (0..1: render quality — artifacts, garbled anatomy or gibberish text lower it), " +
  "wordMatch (0..1: how well the image expresses its word).";

async function readImage(key, word) {
  const res = await fetch(`${PUB}/${key}`);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const jpg = await sharp(Buffer.from(await res.arrayBuffer())).resize(672, 672, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, stream: false, format: "json", think: false,
      options: { temperature: 0.1, num_ctx: 4096, num_predict: 600 },
      messages: [
        { role: "system", content: READ_SYS },
        { role: "user", content: `The word this image was painted for: "${word}"`, images: [jpg.toString("base64")] },
      ],
    }),
  });
  if (!r.ok) throw new Error(`ollama ${r.status}`);
  const msg = (await r.json()).message ?? {};
  // This ollama build sometimes routes qwen3-vl's JSON into `thinking` with
  // empty content — accept either, extract the outermost {...} span.
  const raw = (msg.content || "").trim() || (msg.thinking || "").trim();
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no JSON in VLM reply");
  const j = JSON.parse(raw.slice(a, b + 1));
  return {
    caption: String(j.caption ?? ""),
    subjects: Array.isArray(j.subjects) ? j.subjects.map(String).slice(0, 8) : [],
    setting: String(j.setting ?? ""),
    mood: Array.isArray(j.mood) ? j.mood.map(String).slice(0, 6) : [],
    palette: Array.isArray(j.palette) ? j.palette.map(String).slice(0, 4) : [],
    style: String(j.style ?? ""),
    symbols: Array.isArray(j.symbols) ? j.symbols.map(String).slice(0, 6) : [],
    textInImage: String(j.textInImage ?? ""),
    quality: Math.max(0, Math.min(1, Number(j.quality ?? 0.5))),
    wordMatch: Math.max(0, Math.min(1, Number(j.wordMatch ?? 0.5))),
  };
}

async function embed(text) {
  const r = await fetch(`${OLLAMA}/api/embeddings`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMB_MODEL, prompt: text }),
  });
  if (!r.ok) throw new Error(`embed ${r.status}`);
  return (await r.json()).embedding;
}
export const readingText = (rd) =>
  [rd.caption, rd.subjects.join(", "), rd.setting, rd.mood.join(", "), rd.symbols.join(", "), rd.style].filter(Boolean).join(". ");

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const lex = JSON.parse(fs.readFileSync(LEX, "utf8"));
  const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8"))
    : { v: 1, model: MODEL, generatedAt: null, images: {} };
  const embedded = new Set(
    fs.existsSync(EMB) ? fs.readFileSync(EMB, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).key) : [],
  );

  // job list: every image URL, newest words first (gravity desc)
  const jobs = [];
  for (const e of Object.values(lex.entries).sort((a, b) => (b.gravity?.score ?? 0.5) - (a.gravity?.score ?? 0.5))) {
    if (args.word && e.word !== args.word) continue;
    if (args.song && args.song !== true && !e.sources.includes(String(args.song))) continue;
    e.senses.forEach((s, i) => {
      for (const url of s.images ?? []) {
        const key = String(url).replace(`${PUB}/`, "");
        if (!args.force && index.images[key]) continue;
        jobs.push({ key, word: e.word, sense: i, url });
      }
    });
  }
  const todo = jobs.slice(0, LIMIT);
  log(`vision-worker: ${jobs.length} unread images · reading ${todo.length} with ${MODEL}`);

  let done = 0, fail = 0;
  const save = () => { index.generatedAt = new Date().toISOString(); fs.writeFileSync(INDEX, JSON.stringify(index, null, 2)); };
  for (const j of todo) {
    try {
      const reading = await readImage(j.key, j.word);
      const recipe = j.key.match(/-([a-z0-9-]+)\.webp$/)?.[1] ?? "first-brush";
      index.images[j.key] = { word: j.word, sense: j.sense, recipe, at: new Date().toISOString(), reading };
      if (!embedded.has(j.key)) {
        const v = await embed(readingText(reading));
        fs.appendFileSync(EMB, JSON.stringify({ key: j.key, dim: v.length, b64: Buffer.from(new Float32Array(v).buffer).toString("base64") }) + "\n");
        embedded.add(j.key);
      }
      done++;
      if (done % 10 === 0) { save(); log(`  ${done}/${todo.length} (last: ${j.word} q=${reading.quality} m=${reading.wordMatch})`); }
    } catch (err) { fail++; log(`  ERROR ${j.key}: ${err.message}`); }
  }
  save();
  if (!args.dry && E.BUCKET) {
    try { execFileSync(RCLONE, ["copyto", INDEX, `R2:${E.BUCKET}/lexicon-vision.json`, "--s3-disable-checksum", "--s3-no-check-bucket"], { env: rcloneEnv, stdio: "ignore" }); } catch { log("  (R2 publish of vision index failed — local copy intact)"); }
  }
  // hand VRAM back to ComfyUI
  await fetch(`${OLLAMA}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, keep_alive: 0 }) }).catch(() => {});
  const low = Object.values(index.images).filter((x) => x.reading.quality < 0.35).length;
  log(`✦ vision index: ${Object.keys(index.images).length} readings (${done} new, ${fail} failed) · ${low} low-quality flagged`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
