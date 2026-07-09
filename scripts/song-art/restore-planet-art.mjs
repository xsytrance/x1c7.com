#!/usr/bin/env node
// RESTORE PLANET ART — put a planet's base art back on R2 at the exact URLs
// its Supabase assets point to. The storage reorg left some planets' art
// behind (404s in the live show): singles usually survive locally as PNGs in
// the generation dirs; twins and anything else missing are regenerated from
// the ORIGINAL manifest prompts so the new images match the set's style.
//
// Usage:
//   node scripts/song-art/restore-planet-art.mjs --slug push-it-on-me \
//     --expected expected.json --manifests dirA,dirB [--host http://localhost:8188] [--dry]
//   expected.json: ["/planets/<slug>/<name>.webp", ...]

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const SLUG = args.slug, HOST = args.host || "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const log = (...a) => console.error(...a);
if (!SLUG || !args.expected || !args.manifests) { console.error("need --slug --expected --manifests"); process.exit(1); }
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Same voice the original generation runs appended to every scene prompt.
const STYLE = "cinematic still, moody atmospheric lighting, film grain, shallow depth of field, no text, no watermark, no people";
const NEGATIVE = "text, watermark, logo, caption, letters, low quality, deformed, oversaturated, cartoon, person, face, portrait";

function loadEnv(f) { const o = {}; if (!existsSync(f)) return o; for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); } return o; }
const E = loadEnv(join(ROOT, ".env"));
const rcloneEnv = {
  ...process.env, RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: E.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: E.SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: E.ENDPOINT,
};
const r2put = (local, key) => execFileSync("rclone", ["copyto", local, `R2:${E.BUCKET}/${key}`, "--s3-disable-checksum", "--s3-no-check-bucket"], { env: rcloneEnv, stdio: "ignore" });

// Prompt + local-png index from the original manifests.
const prompts = {}, pngs = {};
for (const dir of String(args.manifests).split(",")) {
  const d = join(HERE, dir.trim());
  if (!existsSync(d)) { log(`(no dir ${dir})`); continue; }
  let m = null;
  try { m = JSON.parse(readFileSync(join(d, "manifest.json"), "utf8")); } catch { /* no manifest */ }
  for (const i of m?.images || []) {
    const k = norm(basename(i.file || i.word || "", ".png"));
    if (i.prompt) prompts[k] ??= i.prompt;
    const kw = norm(i.word || "");
    if (kw && i.prompt) prompts[kw] ??= i.prompt;
  }
  for (const f of readdirSync(d).filter((f) => f.endsWith(".png"))) pngs[norm(basename(f, ".png"))] ??= join(d, f);
}

function graph(prompt, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: `${prompt}, ${STYLE}` } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: NEGATIVE } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "restore" } },
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
  }
  throw new Error("timeout");
}
const seedOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

const expected = JSON.parse(readFileSync(args.expected, "utf8"));
const TMP = join(HERE, ".restore-tmp"); mkdirSync(TMP, { recursive: true });
let fromLocal = 0, generated = 0, failed = 0;
for (const url of expected) {
  const name = basename(url, ".webp");
  const isTwin = /-2$/.test(name);
  const base = name.replace(/-2$/, "");
  const key = `planets/${SLUG}/${name}.webp`;
  const tmp = join(TMP, `${name}.webp`);
  const localPng = !isTwin && pngs[norm(base)];
  if (args.dry) { log(`${name}: ${localPng ? "local png" : prompts[norm(base)] ? "regen from manifest prompt" : "regen from fallback prompt"}`); continue; }
  try {
    if (localPng) {
      await sharp(localPng).webp({ quality: 82 }).toFile(tmp);
      fromLocal++;
    } else {
      const scene = prompts[norm(base)] || `evocative symbolic scene expressing '${base.replace(/-/g, " ")}'`;
      const buf = await generate(isTwin ? `${scene}, alternate composition` : scene, seedOf(name) + (isTwin ? 7919 : 0));
      await sharp(buf).webp({ quality: 82 }).toFile(tmp);
      generated++;
    }
    r2put(tmp, key);
    log(`✔ ${name} ${localPng ? "(local)" : "(generated)"}`);
  } catch (e) { failed++; log(`✗ ${name}: ${e.message}`); }
}
log(`done: ${fromLocal} restored from local, ${generated} regenerated, ${failed} failed`);
