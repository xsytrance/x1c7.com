#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LEXICON · ART — give every word real pixels (fills each sense's images:[]).
//
// The Lexicon has imagery PROMPTS per word-sense but no images yet. This renders
// them via local ComfyUI (SDXL-Turbo), uploads to R2 (lexicon/<word>/), and
// writes the URLs back into lexicon.json — then publishes the shelf. THIS is what
// makes the gift real: a Suno creator pulls finished art per word, not prompts.
//
// Idempotent (skips senses already at --per-sense), batched (--limit), saves +
// republishes as it goes so progress is never lost. Needs R2 creds + ComfyUI up.
//
//   node scripts/lexicon/art.mjs --per-sense 2 --limit 300
//   node scripts/lexicon/art.mjs --dry
// ═══════════════════════════════════════════════════════════════════════════

import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const CKPT = args.ckpt || "sdxl_turbo_1.0_fp16.safetensors";
const PER = parseInt(args["per-sense"], 10) || 2;
const LIMIT = parseInt(args.limit, 10) || 300;
const W = 1152, H = 832;
const ROOT = new URL("../..", import.meta.url).pathname;
const LEX = join(ROOT, "src/data/lexicon.json");
const TMP = join(ROOT, "scripts/song-art/.topup-tmp");
const log = (...a) => console.error(...a);

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
  console.error("✗ missing R2 creds in .env"); process.exit(1);
}
const rcloneEnv = {
  ...process.env, RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: E.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: E.SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: E.ENDPOINT,
};
const r2put = (local, key) => execFileSync("rclone", ["copyto", local, `R2:${E.BUCKET}/${key}`, "--s3-disable-checksum", "--s3-no-check-bucket"], { env: rcloneEnv, stdio: "ignore" });

const STYLE = "cinematic still, moody atmospheric lighting, film grain, shallow depth of field, no text, no watermark, no people";
const NEGATIVE = "text, watermark, logo, caption, letters, low quality, deformed, oversaturated, cartoon";
function graph(prompt, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: NEGATIVE } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "lexart" } },
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

mkdirSync(TMP, { recursive: true });
const lex = JSON.parse(readFileSync(LEX, "utf8"));
const entries = Object.values(lex.entries).sort((a, b) => b.freq - a.freq);
const save = () => { writeFileSync(LEX, JSON.stringify(lex, null, 2)); if (!args.dry) r2put(LEX, "lexicon.json"); };

let budget = LIMIT, done = 0, fail = 0, seed = 2_000_000 + (Date.now() % 500000);
const totalNeed = entries.reduce((n, e) => n + e.senses.reduce((m, s) => m + Math.max(0, PER - (s.images?.length || 0)), 0), 0);
log(`lexicon art: ${entries.length} words · ~${totalNeed} images to reach ${PER}/sense · rendering up to ${LIMIT}`);

for (const e of entries) {
  if (budget <= 0) break;
  let changed = false;
  for (let i = 0; i < e.senses.length; i++) {
    if (budget <= 0) break;
    const s = e.senses[i];
    s.images ??= [];
    const prompts = (s.imageryPrompts || []).filter(Boolean);
    if (!prompts.length) prompts.push(`${e.word}, ${s.emotion.toLowerCase()} mood`);
    while (s.images.length < PER && budget > 0) {
      const k = s.images.length;
      const prompt = `${prompts[k % prompts.length]}, ${STYLE}`;
      if (args.dry) { log(`  ${e.word} s${i}: ${prompt.slice(0, 90)}`); s.images.push("(dry)"); budget--; done++; continue; }
      try {
        const buf = await generate(prompt, seed++);
        const key = `lexicon/${e.word}/s${i}-${k + 1}.webp`;
        const tmp = join(TMP, `lex-${e.word}-${i}-${k + 1}.webp`);
        await sharp(buf).webp({ quality: 82 }).toFile(tmp);
        r2put(tmp, key);
        try { unlinkSync(tmp); } catch { /* temp cleanup best-effort */ }
        s.images.push(`${PUB}/${key}`);
        changed = true; done++; budget--;
        log(`  [${done}] ${e.word} s${i} → ${key}`);
      } catch (err) { fail++; budget--; log(`  ERROR ${e.word} s${i}: ${err.message}`); break; }
    }
  }
  if (changed && !args.dry) save(); // persist + republish per word so nothing is lost
}
if (args.dry) log("(dry run — no images generated)");
else save();
log(`\ndone: ${done} rendered, ${fail} failed → images written into lexicon.json + published`);
