#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ART TOP-UP — grow every song toward N art assets (default 100).
//
// Renders extra paintings per song via local ComfyUI (SDXL-Turbo, same graph as
// variants.mjs). Prompts come from THREE sources so the art stays varied and
// on-theme, not just reseeds of the same picture:
//   1. the song's own generation manifests (the exact prompts that made its art)
//   2. the LEXICON — imagery prompts for the song's words (the shared shelf,
//      finally feeding pixels back into the show)
//   3. reseeds of (1) as a last resort to guarantee we can always reach N
//
// Output goes to a GITIGNORED archive (scripts/song-art/topup/<slug>/) + a
// manifest — NOT committed (100/song × 19 ≈ 188 MB would bloat the repo). A
// separate publish step uploads them to the x1c7-art R2 bucket and wires the
// URLs into the planets. Idempotent + batched: --limit caps work per run so the
// nightly cron makes steady progress instead of one GPU marathon.
//
// Usage:
//   node scripts/song-art/topup.mjs --only cocktails-and-code --limit 3 --dry
//   node scripts/song-art/topup.mjs --target 100 --limit 60
// ═══════════════════════════════════════════════════════════════════════════

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import sharp from "sharp";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const CKPT = args.ckpt || "sdxl_turbo_1.0_fp16.safetensors";
const TARGET = parseInt(args.target, 10) || 100;
const LIMIT = parseInt(args.limit, 10) || 60;
const ONLY = typeof args.only === "string" ? args.only : null;
const W = 1152, H = 832;
const ROOT = new URL("../..", import.meta.url).pathname;
const ART = join(ROOT, "scripts/song-art");
const PLANETS = join(ROOT, "public/planets");
const TOPUP = join(ART, "topup");
const log = (...a) => console.error(...a);
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// ── Prompt sources ──────────────────────────────────────────────────────────
// (1) manifests: word -> prompt, grouped by best-matching slug (like variants).
const bases = {};
for (const slug of readdirSync(PLANETS, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== "_shared").map((e) => e.name)) {
  bases[slug] = [...new Set(readdirSync(join(PLANETS, slug)).filter((f) => f.endsWith(".webp")).map((f) => norm(basename(f, ".webp").replace(/-\d+$/, ""))))];
}
const slugs = Object.keys(bases);
const promptIdx = Object.fromEntries(slugs.map((s) => [s, {}]));
const scan = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const mf = join(dir, e.name, "manifest.json");
  if (!existsSync(mf)) continue;
  let m; try { m = JSON.parse(readFileSync(mf, "utf8")); } catch { continue; }
  const imgs = m.images || [];
  const files = imgs.map((i) => norm(basename(i.file || i.word || "", ".png")));
  let best = null, score = 0;
  for (const slug of slugs) { const have = new Set(bases[slug]); const sc = files.filter((f) => have.has(f)).length / Math.max(1, files.length); if (sc > score) { score = sc; best = slug; } }
  if (best && score >= 0.3) for (const i of imgs) promptIdx[best][norm(i.word || basename(i.file || "", ".png"))] = i.prompt;
} };
scan(ART); scan(PLANETS);

// (2) the Lexicon: word -> [imagery prompts across senses].
let lex = {};
try { lex = JSON.parse(readFileSync(join(ROOT, "src/data/lexicon.json"), "utf8")).entries || {}; } catch { /* optional */ }
const lexPromptsFor = (word) => {
  const e = lex[norm(word)] || lex[word];
  if (!e) return [];
  return e.senses.flatMap((s) => s.imageryPrompts || []).filter(Boolean);
};

const STYLE = "cinematic still, moody atmospheric lighting, film grain, shallow depth of field, no text, no watermark, no people";
const NEGATIVE = "text, watermark, logo, caption, letters, low quality, deformed, oversaturated, cartoon";

// ── ComfyUI (identical graph to variants.mjs) ────────────────────────────────
function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "topup" } },
  };
}
async function generate(prompt, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(prompt, NEGATIVE, seed) }) });
  if (!q.ok) throw new Error(`queue ${q.status}: ${await q.text()}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 700));
    const entry = (await (await fetch(`${HOST}/history/${prompt_id}`)).json())[prompt_id];
    if (entry?.status?.completed || entry?.outputs?.["7"]) {
      const img = entry.outputs?.["7"]?.images?.[0];
      if (!img) throw new Error("no image in outputs");
      const res = await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`);
      return Buffer.from(await res.arrayBuffer());
    }
    if (entry?.status?.status_str === "error") throw new Error("comfy: " + JSON.stringify(entry.status));
  }
  throw new Error("timeout");
}

// ── Plan: for each song, assemble a prompt queue toward TARGET ───────────────
function existingCount(slug) {
  const served = bases[slug].length ? readdirSync(join(PLANETS, slug)).filter((f) => f.endsWith(".webp")).length : 0;
  const archived = existsSync(join(TOPUP, slug)) ? readdirSync(join(TOPUP, slug)).filter((f) => f.endsWith(".webp")).length : 0;
  return served + archived;
}
function planFor(slug) {
  const need = TARGET - existingCount(slug);
  if (need <= 0) return [];
  const jobs = [];
  const words = bases[slug];
  // (2) lexicon prompts for this song's words — richest, most varied
  for (const w of words) for (const p of lexPromptsFor(w)) jobs.push({ slug, key: w, prompt: `${p}, ${STYLE}` });
  // (1) manifest prompts
  for (const w of words) { const p = promptIdx[slug]?.[w]; if (p) jobs.push({ slug, key: w, prompt: `${p}, ${STYLE}` }); }
  // (3) reseed fallback so we can always reach TARGET
  let g = 0; while (jobs.length < need) { const w = words[g % Math.max(1, words.length)]; g++; const p = promptIdx[slug]?.[w] || `evocative scene expressing '${w.replace(/[-_]/g, " ")}'`; jobs.push({ slug, key: w, prompt: `${p}, ${STYLE}` }); }
  return jobs.slice(0, need);
}

// ── Run ──────────────────────────────────────────────────────────────────────
const targets = (ONLY ? [ONLY] : slugs).filter((s) => bases[s]);
let queue = [];
for (const slug of targets) queue.push(...planFor(slug));
log(`topup: ${targets.length} song(s), ${queue.length} needed toward ${TARGET}/song, rendering up to ${LIMIT} this run`);
queue = queue.slice(0, LIMIT);
if (args.dry) { for (const j of queue) log(`  ${j.slug}/${j.key}: ${j.prompt.slice(0, 100)}`); process.exit(0); }

let done = 0, failed = 0, seed = 1_000_000 + (Date.now() % 500000);
const manifests = {};
for (const j of queue) {
  try {
    const buf = await generate(j.prompt, seed++);
    const dir = join(TOPUP, j.slug); mkdirSync(dir, { recursive: true });
    // next free index for this key
    let n = 1; while (existsSync(join(dir, `${j.key}-${n}.webp`))) n++;
    const file = `${j.key}-${n}.webp`;
    await sharp(buf).webp({ quality: 82 }).toFile(join(dir, file));
    (manifests[j.slug] ??= []).push({ key: j.key, file, prompt: j.prompt });
    done++; log(`  [${done}/${queue.length}] ${j.slug}/${file}`);
  } catch (e) { failed++; log(`  ERROR ${j.slug}/${j.key}: ${e.message}`); }
}
// append manifests
for (const [slug, imgs] of Object.entries(manifests)) {
  const mf = join(TOPUP, slug, "topup-manifest.json");
  const prev = existsSync(mf) ? JSON.parse(readFileSync(mf, "utf8")) : { songId: slug, model: CKPT, images: [] };
  prev.images.push(...imgs);
  writeFileSync(mf, JSON.stringify(prev, null, 2));
}
log(`done: ${done} rendered, ${failed} failed → ${TOPUP}/<slug>/ (gitignored)`);
