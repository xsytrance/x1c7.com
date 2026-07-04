#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// FEED A PLANET — the gravitational feed. You hand a planet a reference IMAGE
// and a PROMPT; ComfyUI generates guided art FROM that image (img2img), and it
// becomes the planet's GUIDED collection — the main star. The album art is the
// event horizon (the anchor); the auto-generated gallery stays as the secondary
// satellite. Owner-only: this needs local ComfyUI + the R2 creds in .env.
//
//   node scripts/song-art/feed.mjs --slug cocktails-and-code \
//     --image ~/refs/neon-bar.png --prompt "neon rooftop bar, rain, cinematic" \
//     [--n 4] [--denoise 0.62] [--steps 8]
//
// Writes R2 planets/<slug>/guided/*.webp + planets/<slug>/guided.json, which the
// show reads at runtime (guided art takes over as the primary backdrop).
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const CKPT = args.ckpt || "sdxl_turbo_1.0_fp16.safetensors";
const SLUG = args.slug;
const IMAGE = args.image;
const PROMPT = typeof args.prompt === "string" ? args.prompt : "";
const N = parseInt(args.n, 10) || 4;
const DENOISE = parseFloat(args.denoise) || 0.62;
const STEPS = parseInt(args.steps, 10) || 8;
const W = 1152, H = 832;
const ROOT = new URL("../..", import.meta.url).pathname;
const TMP = join(ROOT, "scripts/song-art/.topup-tmp");
const log = (...a) => console.error(...a);

if (!SLUG || !IMAGE || !PROMPT) { console.error("usage: --slug <slug> --image <path> --prompt \"<text>\" [--n 4] [--denoise 0.62]"); process.exit(1); }
if (!existsSync(IMAGE)) { console.error("✗ image not found:", IMAGE); process.exit(1); }

// ── R2 ────────────────────────────────────────────────────────────────────────
function loadEnv(f) { const o = {}; if (!existsSync(f)) return o; for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); } return o; }
const E = loadEnv(join(ROOT, ".env"));
const PUB = (E.PUBLIC_URL || "").replace(/\/$/, "");
if (!["ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENDPOINT", "BUCKET"].every((k) => E[k])) { console.error("✗ missing R2 creds in .env"); process.exit(1); }
const rcloneEnv = { ...process.env, RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto", RCLONE_CONFIG_R2_ACCESS_KEY_ID: E.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: E.SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: E.ENDPOINT };
const r2put = (local, key) => execFileSync("rclone", ["copyto", local, `R2:${E.BUCKET}/${key}`, "--s3-disable-checksum", "--s3-no-check-bucket"], { env: rcloneEnv, stdio: "ignore" });
async function remoteGuided() { if (!PUB) return { slug: SLUG, images: [], feeds: [] }; try { const r = await fetch(`${PUB}/planets/${SLUG}/guided.json`); if (r.ok) { const g = await r.json(); return { slug: SLUG, images: g.images || [], feeds: g.feeds || [] }; } } catch { /* new */ } return { slug: SLUG, images: [], feeds: [] }; }

// ── ComfyUI: upload the reference image, then img2img from it ─────────────────
async function uploadToComfy(path) {
  const buf = readFileSync(path);
  const fd = new FormData();
  fd.append("image", new Blob([buf]), basename(path));
  fd.append("overwrite", "true");
  const r = await fetch(`${HOST}/upload/image`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`comfy upload ${r.status}`);
  const j = await r.json();
  return j.subfolder ? `${j.subfolder}/${j.name}` : j.name;
}
function graph(image, prompt, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "10": { class_type: "LoadImage", inputs: { image } },
    "11": { class_type: "VAEEncode", inputs: { pixels: ["10", 0], vae: ["1", 2] } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: `${prompt}, cinematic still, moody atmospheric lighting, film grain, no text, no watermark` } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: "text, watermark, logo, caption, low quality, deformed, oversaturated, cartoon" } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["11", 0], seed, steps: STEPS, cfg: 1.4, sampler_name: "euler_ancestral", scheduler: "normal", denoise: DENOISE } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "feed" } },
  };
}
async function generate(image, prompt, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(image, prompt, seed) }) });
  if (!q.ok) throw new Error(`queue ${q.status}: ${await q.text()}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 300; i++) {
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

// ── Run ──────────────────────────────────────────────────────────────────────
mkdirSync(TMP, { recursive: true });
const g = await remoteGuided();
const ts = args.ts ? String(args.ts) : String(g.images.length + 1).padStart(3, "0");
log(`feeding "${SLUG}" — image ${basename(IMAGE)} · "${PROMPT}" · ${N} guided (denoise ${DENOISE})`);
const comfyName = await uploadToComfy(IMAGE);

// keep a copy of the reference itself (so the UI can show "what I fed")
const refKey = `planets/${SLUG}/guided/ref-${ts}.webp`;
const refTmp = join(TMP, `ref-${ts}.webp`);
await sharp(readFileSync(IMAGE)).resize(W, H, { fit: "cover" }).webp({ quality: 82 }).toFile(refTmp);
r2put(refTmp, refKey); try { unlinkSync(refTmp); } catch { /* best effort */ }
const refUrl = `${PUB}/${refKey}`;

const made = [];
let seed = 3_000_000 + (Date.now() % 500000);
for (let i = 1; i <= N; i++) {
  try {
    const buf = await generate(comfyName, PROMPT, seed++);
    const key = `planets/${SLUG}/guided/${ts}-${i}.webp`;
    const tmp = join(TMP, `feed-${ts}-${i}.webp`);
    await sharp(buf).webp({ quality: 82 }).toFile(tmp);
    r2put(tmp, key); try { unlinkSync(tmp); } catch { /* best effort */ }
    const url = `${PUB}/${key}`;
    made.push(url); g.images.push(url);
    log(`  ✓ ${key}`);
  } catch (e) { log(`  ✗ ${e.message}`); }
}
g.feeds.push({ at: args.ts ? Number(args.ts) : null, prompt: PROMPT, ref: refUrl, images: made });

const gjson = join(TMP, "guided.json");
writeFileSync(gjson, JSON.stringify(g, null, 2));
r2put(gjson, `planets/${SLUG}/guided.json`); try { unlinkSync(gjson); } catch { /* best effort */ }
log(`\n✦ fed ${made.length} guided images → ${SLUG} · guided total ${g.images.length}. The show picks them up on next load.`);
