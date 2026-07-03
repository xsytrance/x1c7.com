#!/usr/bin/env node
// Art-doubling pass: a second painting for EVERY existing planet image.
// For each public/planets/<slug>/<name>.webp, find the prompt that made it
// (generation manifests first, planet JSONs as fallback), re-render it with a
// fresh seed via local ComfyUI, and save <name>-2.webp beside the original.
// Idempotent: existing -2.webp files are skipped, so it's safe to re-run.
//
// Usage: node scripts/song-art/variants.mjs [--host http://localhost:8188]
//        [--ckpt sdxl_turbo_1.0_fp16.safetensors] [--only <slug>] [--dry]
// Emits scripts/song-art/variants/<slug>/<name>.png (archive, gitignored),
// public/planets/<slug>/<name>-2.webp, and variants-map.json (slug -> urls).

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import sharp from "sharp";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const CKPT = args.ckpt || "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const ROOT = new URL("../..", import.meta.url).pathname;
const ART = join(ROOT, "scripts/song-art");
const PLANETS = join(ROOT, "public/planets");
const log = (...a) => console.error(...a);

// Normalize a name for matching: strip accents, non-alnum -> nothing.
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// ── 1. Gather every generation manifest (they record the exact prompts) ────
const manifests = [];
const scan = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const mf = join(dir, e.name, "manifest.json");
      if (existsSync(mf)) {
        try { manifests.push({ dir: join(dir, e.name), mtime: statSync(mf).mtimeMs, ...JSON.parse(readFileSync(mf, "utf8")) }); }
        catch { /* skip corrupt */ }
      }
    }
  }
};
scan(ART);
scan(PLANETS); // some planet dirs carry their manifest too
manifests.sort((a, b) => a.mtime - b.mtime); // newest last => overrides on conflict

// ── 2. Planet JSONs: styleHint + mood per slug, imageryPrompts as fallback ──
const PLANET_JSON = {
  "the-big-top-has-wi-fi-now": "bt-planet-full.json",
  "cocktails-and-code": "cc-planet-full.json",
  "ceasefire-in-the-static-data-storm-version": "cs-planet-full.json",
  "different-this-summer": "dts-planet-full.json",
  "fast-enough": "fast-planet-full.json",
  "mi-gente": "gente-planet-full.json",
  "paper-that-cut-you": "paper-planet-full.json",
  "i-don-t-quit-right-now": "quit-planet-full.json",
  "23-respuestas": "resp-planet-full.json",
  "i-m-that-somebody": "smb-planet-full.json",
  "still-me-still-you": "still-planet-full.json",
  "void-into-gold": "vg-planet-full.json",
  "whistle-on-the-river": "wr-planet-full.json",
  "my-soul-lives-in-seoul": "seoul-planet-full.json",
  "i-won-t-be-your-fire": "fire-extra.json",
  "_shared": "shared-planet.json",
};
const planetMeta = {};
for (const [slug, file] of Object.entries(PLANET_JSON)) {
  try {
    const p = JSON.parse(readFileSync(join(ART, file), "utf8"));
    const a = p.analysis ?? p.planet?.analysis ?? {};
    planetMeta[slug] = { styleHint: p.styleHint ?? p.planet?.styleHint, mood: a.overallMood || "moody", prompts: {} };
    for (const k of a.keywords ?? []) planetMeta[slug].prompts[norm(k.word)] = k.imageryPrompt;
  } catch { planetMeta[slug] = { styleHint: null, mood: "moody", prompts: {} }; }
}
// gap-*.json carry the section-emotion prompts, keyed by their slug in the name
for (const f of readdirSync(ART)) {
  const m = f.match(/^gap-(.+)\.json$/);
  if (!m) continue;
  try {
    const p = JSON.parse(readFileSync(join(ART, f), "utf8"));
    const meta = (planetMeta[m[1]] ??= { styleHint: p.styleHint, mood: "moody", prompts: {} });
    meta.styleHint ??= p.styleHint;
    for (const k of p.analysis?.keywords ?? []) meta.prompts[norm(k.word)] ??= k.imageryPrompt;
  } catch { /* skip */ }
}

// ── 3. Slugs and their images; match manifests by file overlap ─────────────
const slugs = readdirSync(PLANETS).filter((d) => statSync(join(PLANETS, d)).isDirectory());
const bases = {}; // slug -> [name] (webp basenames, no variants)
for (const slug of slugs) {
  bases[slug] = readdirSync(join(PLANETS, slug))
    .filter((f) => f.endsWith(".webp") && !f.endsWith("-2.webp"))
    .map((f) => basename(f, ".webp"));
}
// prompt index per slug: norm(name) -> prompt
const promptIdx = Object.fromEntries(slugs.map((s) => [s, {}]));
for (const mf of manifests) {
  const files = (mf.images ?? []).map((i) => norm(basename(i.file, ".png")));
  if (!files.length) continue;
  let best = null, bestScore = 0;
  for (const slug of slugs) {
    const have = new Set(bases[slug].map(norm));
    const score = files.filter((f) => have.has(f)).length / files.length;
    if (score > bestScore) { bestScore = score; best = slug; }
  }
  if (!best || bestScore < 0.4) continue;
  for (const img of mf.images) promptIdx[best][norm(basename(img.file, ".png"))] = img.prompt;
}

// ── 4. ComfyUI ──────────────────────────────────────────────────────────────
function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "songart2" } },
  };
}
async function generate(prompt, negative, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(prompt, negative, seed) }) });
  if (!q.ok) throw new Error(`queue ${q.status}: ${await q.text()}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 700));
    const h = await (await fetch(`${HOST}/history/${prompt_id}`)).json();
    const entry = h[prompt_id];
    if (entry?.status?.completed || entry?.outputs?.["7"]) {
      const img = entry.outputs?.["7"]?.images?.[0];
      if (!img) throw new Error("no image in outputs");
      const res = await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`);
      return Buffer.from(await res.arrayBuffer());
    }
    if (entry?.status?.status_str === "error") throw new Error("comfy error: " + JSON.stringify(entry.status));
  }
  throw new Error("timeout");
}
const negExtra = typeof args.negative === "string" ? `, ${args.negative}` : "";
const NEGATIVE = `text, watermark, logo, caption, letters, low quality, deformed, oversaturated, cartoon${negExtra}`;

// ── 5. Run ──────────────────────────────────────────────────────────────────
const only = typeof args.only === "string" ? args.only : null;
const map = existsSync(join(ART, "variants-map.json")) ? JSON.parse(readFileSync(join(ART, "variants-map.json"), "utf8")) : {};
let done = 0, skipped = 0, failed = 0, seed = 990000;
const todo = [];
for (const slug of slugs) {
  if (only && slug !== only) continue;
  const meta = planetMeta[slug] ?? { styleHint: null, mood: "moody", prompts: {} };
  const style = meta.styleHint
    ? `${meta.styleHint}, cinematic, evocative of "${meta.mood}" mood, no text, no watermark`
    : `cinematic still, moody atmospheric lighting, film grain, shallow depth of field, dark ambient, evocative of "${meta.mood}" mood, no text, no watermark`;
  for (const name of bases[slug]) {
    const out = join(PLANETS, slug, `${name}-2.webp`);
    if (existsSync(out)) { skipped++; continue; }
    const core = promptIdx[slug][norm(name)] ?? meta.prompts[norm(name)]
      ?? `abstract evocative scene expressing '${name.replace(/[-_]/g, " ")}'`;
    todo.push({ slug, name, out, prompt: `${core}, ${style}` });
  }
}
log(`variants: ${todo.length} to render, ${skipped} already exist`);
if (args.dry) {
  for (const t of todo) log(`  ${t.slug}/${t.name}: ${t.prompt.slice(0, 110)}`);
  process.exit(0);
}
for (const t of todo) {
  try {
    const buf = await generate(t.prompt, NEGATIVE, seed++);
    const archive = join(ART, "variants", t.slug);
    mkdirSync(archive, { recursive: true });
    writeFileSync(join(archive, `${t.name}.png`), buf);
    await sharp(buf).webp({ quality: 82 }).toFile(t.out);
    (map[t.slug] ??= []).includes(`${t.name}-2.webp`) || (map[t.slug] ??= []).push(`${t.name}-2.webp`);
    writeFileSync(join(ART, "variants-map.json"), JSON.stringify(map, null, 2));
    done++;
    log(`  [${done}/${todo.length}] ${t.slug}/${t.name}-2.webp ok`);
  } catch (e) {
    failed++;
    log(`  ERROR ${t.slug}/${t.name}: ${e}`);
  }
}
log(`done: ${done} rendered, ${failed} failed, ${skipped} pre-existing`);
