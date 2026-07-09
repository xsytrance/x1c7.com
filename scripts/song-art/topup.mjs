#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ART TOP-UP — grow every song toward N art assets (default 100), hosted on R2.
//
// Renders extra paintings per song via local ComfyUI (SDXL-Turbo), uploads each
// straight to R2 (x1c7-music/planets/<slug>/gallery/), and maintains a per-song
// gallery.json the show fetches at runtime — so a word never shows the same
// backdrop twice, and the shelf grows without a redeploy.
//
// Prompts come from THREE sources so art stays varied and on-theme:
//   1. the song's generation manifests (the exact prompts that made its art)
//   2. the LEXICON's imagery prompts for the song's words (the shared shelf)
//   3. reseeds of (1) as a floor to always reach N
//
// Idempotent (counts what's already on R2) + batched (--limit caps per run so
// the nightly cron makes steady progress). Needs R2 creds in .env + ComfyUI up.
//
// Usage:
//   node scripts/song-art/topup.mjs --only cocktails-and-code --limit 3 --dry
//   node scripts/song-art/topup.mjs --target 100 --limit 120
// ═══════════════════════════════════════════════════════════════════════════

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const CKPT = args.ckpt || "sdxl_turbo_1.0_fp16.safetensors";
const TARGET = parseInt(args.target, 10) || 100;
const LIMIT = parseInt(args.limit, 10) || 120;
const ONLY = typeof args.only === "string" ? args.only : null;
const W = 1152, H = 832;
const ROOT = new URL("../..", import.meta.url).pathname;
const ART = join(ROOT, "scripts/song-art");
const PLANETS = join(ROOT, "public/planets");
const TMP = join(ART, ".topup-tmp");
const log = (...a) => console.error(...a);
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// ── R2 (reads creds from gitignored .env) ────────────────────────────────────
function loadEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const E = loadEnv(join(ROOT, ".env"));
const PUB = (E.PUBLIC_URL || "").replace(/\/$/, "");
if (!args.dry && !["ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENDPOINT", "BUCKET"].every((k) => E[k])) {
  console.error("✗ missing R2 creds in .env (ACCESS_KEY_ID/SECRET_ACCESS_KEY/ENDPOINT/BUCKET)"); process.exit(1);
}
const rcloneEnv = {
  ...process.env, RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: E.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: E.SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: E.ENDPOINT,
};
const r2put = (local, key) => execFileSync("rclone", ["copyto", local, `R2:${E.BUCKET}/${key}`, "--s3-disable-checksum", "--s3-no-check-bucket"], { env: rcloneEnv, stdio: "ignore" });
async function remoteGallery(slug) {
  if (!PUB) return { art: {}, passes: {} };
  try {
    const r = await fetch(`${PUB}/planets/${slug}/gallery.json?cb=${Date.now()}`);
    if (r.ok) { const j = await r.json(); return { art: j.art || {}, passes: j.passes || {} }; }
  } catch { /* new song */ }
  return { art: {}, passes: {} };
}

// ── Prompt sources ───────────────────────────────────────────────────────────
// Planets + base art live on R2 since the storage reorg (public/planets was
// slimmed out of the repo), so enumerate from the bucket — a local dir is
// used only as a fallback for offline dry runs.
const bases = {}, baseFiles = {};
try {
  const dirs = execFileSync("rclone", ["lsf", `R2:${E.BUCKET}/planets`, "--dirs-only"], { env: rcloneEnv, encoding: "utf8" })
    .split("\n").map((s) => s.replace(/\/$/, "").trim()).filter(Boolean)
    .filter((d) => d !== "_shared" && d !== "defaults");
  for (const slug of dirs) {
    const files = execFileSync("rclone", ["lsf", `R2:${E.BUCKET}/planets/${slug}`, "--files-only"], { env: rcloneEnv, encoding: "utf8" })
      .split("\n").map((s) => s.trim()).filter((f) => f.endsWith(".webp"));
    if (!files.length) continue; // stems-only planet — no base art to grow from yet
    baseFiles[slug] = files;
    bases[slug] = [...new Set(files.map((f) => norm(basename(f, ".webp").replace(/-\d+$/, ""))))];
  }
} catch (e) {
  log(`R2 enumeration failed (${e.message}) — falling back to local ${PLANETS}`);
  for (const slug of readdirSync(PLANETS, { withFileTypes: true }).filter((e2) => e2.isDirectory() && e2.name !== "_shared").map((e2) => e2.name)) {
    const files = readdirSync(join(PLANETS, slug)).filter((f) => f.endsWith(".webp"));
    if (!files.length) continue;
    baseFiles[slug] = files;
    bases[slug] = [...new Set(files.map((f) => norm(basename(f, ".webp").replace(/-\d+$/, ""))))];
  }
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
let lex = {};
try { lex = JSON.parse(readFileSync(join(ROOT, "src/data/lexicon.json"), "utf8")).entries || {}; } catch { /* optional */ }
const lexPromptsFor = (w) => (lex[norm(w)] || lex[w])?.senses.flatMap((s) => s.imageryPrompts || []).filter(Boolean) || [];

const STYLE = "cinematic still, moody atmospheric lighting, film grain, shallow depth of field, no text, no watermark, no people";
const NEGATIVE = "text, watermark, logo, caption, letters, low quality, deformed, oversaturated, cartoon";

// ── ComfyUI (same graph as variants.mjs) ─────────────────────────────────────
function graph(prompt, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: NEGATIVE } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "topup" } },
  };
}
async function generate(prompt, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(prompt, seed) }) });
  if (!q.ok) throw new Error(`queue ${q.status}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 700));
    const entry = (await (await fetch(`${HOST}/history/${prompt_id}`)).json())[prompt_id];
    if (entry?.status?.completed || entry?.outputs?.["7"]) {
      const img = entry.outputs?.["7"]?.images?.[0];
      if (!img) throw new Error("no image");
      const res = await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`);
      return Buffer.from(await res.arrayBuffer());
    }
    if (entry?.status?.status_str === "error") throw new Error("comfy: " + JSON.stringify(entry.status));
  }
  throw new Error("timeout");
}

function promptQueue(slug, need) {
  const jobs = [], words = bases[slug];
  for (const w of words) for (const p of lexPromptsFor(w)) jobs.push({ key: w, prompt: `${p}, ${STYLE}` });
  for (const w of words) { const p = promptIdx[slug]?.[w]; if (p) jobs.push({ key: w, prompt: `${p}, ${STYLE}` }); }
  let g = 0; while (jobs.length < need) { const w = words[g % Math.max(1, words.length)]; g++; const p = promptIdx[slug]?.[w] || `evocative scene expressing '${w.replace(/[-_]/g, " ")}'`; jobs.push({ key: w, prompt: `${p}, ${STYLE}` }); }
  return jobs.slice(0, need);
}

// ── Run ──────────────────────────────────────────────────────────────────────
mkdirSync(TMP, { recursive: true });
const targets = (ONLY ? [ONLY] : slugs).filter((s) => bases[s]);
let budget = LIMIT, totalDone = 0, totalFail = 0, seed = 1_000_000 + (Date.now() % 500000);

for (const slug of targets) {
  if (budget <= 0) break;
  const remote = await remoteGallery(slug);
  const gallery = remote.art;
  const baseCount = (baseFiles[slug] || []).length;
  const galCount = Object.values(gallery).reduce((n, a) => n + a.length, 0);
  const need = Math.min(budget, TARGET - baseCount - galCount);
  if (need <= 0) continue;
  const jobs = promptQueue(slug, need);
  log(`${slug}: ${baseCount} base + ${galCount} gallery → +${jobs.length} toward ${TARGET}`);
  if (args.dry) { for (const j of jobs.slice(0, 4)) log(`  ${j.key}: ${j.prompt.slice(0, 90)}`); continue; }

  let changed = false, addedThisSong = 0;
  for (const j of jobs) {
    if (budget <= 0) break;
    try {
      const buf = await generate(j.prompt, seed++);
      const n = (gallery[j.key]?.length || 0) + 1;
      const rel = `/planets/${slug}/gallery/${j.key}-${n}.webp`;
      const tmp = join(TMP, `${j.key}-${n}.webp`);
      await sharp(buf).webp({ quality: 82 }).toFile(tmp);
      r2put(tmp, `planets/${slug}/gallery/${j.key}-${n}.webp`);
      try { unlinkSync(tmp); } catch { /* temp cleanup best-effort */ }
      (gallery[j.key] ??= []).push(rel);
      changed = true; totalDone++; addedThisSong++; budget--;
      log(`  [${totalDone}] ${rel}`);
    } catch (e) { totalFail++; log(`  ERROR ${slug}/${j.key}: ${e.message}`); }
  }
  if (changed) {
    const gjson = join(TMP, "gallery.json");
    // --pass tags the run (e.g. X1) so gallery.json records which grow-pass
    // last touched it and how many images each pass added.
    const meta = { slug, model: CKPT, art: gallery };
    if (args.pass && args.pass !== true) {
      const p = String(args.pass);
      meta.pass = p;
      meta.passes = { ...remote.passes, [p]: { added: (remote.passes[p]?.added || 0) + addedThisSong, at: new Date().toISOString() } };
    } else if (Object.keys(remote.passes).length) {
      meta.passes = remote.passes;
    }
    writeFileSync(gjson, JSON.stringify(meta, null, 2));
    r2put(gjson, `planets/${slug}/gallery.json`);
    log(`  ↑ gallery.json updated for ${slug}${meta.pass ? ` (pass ${meta.pass})` : ""}`);
  }
}
log(`\ndone: ${totalDone} rendered+published, ${totalFail} failed`);
