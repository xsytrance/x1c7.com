#!/usr/bin/env node
// scene-gen — generic ComfyUI scene generator for directed-cut art passes.
// Replaces the per-song copy-paste scripts (summer-drip-scenes.mjs etc).
//
// Usage:
//   node scripts/clip/scene-gen.mjs --spec spec.json [--host http://localhost:8188]
//
// spec.json:
// {
//   "out": "scripts/song-art/<song>-out",       // output dir (created)
//   "prefix": "myscene",                        // filename prefix
//   "style": "…style suffix appended to every prompt…",
//   "neg": "…negative prompt…",
//   "variants": 3,
//   "width": 1152, "height": 832,               // optional (defaults 1152x832)
//   "seed": 12345,                              // optional base seed
//   "scenes": { "key": "scene prompt", … }
// }
// Output: <out>/<prefix>-<key>-v<N>.png  (skips files that already exist,
// retries generations that come back without an image — ComfyUI sometimes
// reports completed with empty outputs under load).
//
// After generating: audit EVERY image with your own eyes (count the people!),
// then publish picks with scripts/clip/publish-scenes.mjs.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) =>
  a.startsWith("--") ? [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? true : all[i + 1]] : []).filter(Boolean));
if (!args.spec) { console.error("need --spec spec.json (see header for format)"); process.exit(1); }

const spec = JSON.parse(readFileSync(resolve(args.spec), "utf8"));
const HOST = args.host ?? "http://localhost:8188";
const W = spec.width ?? 1152, H = spec.height ?? 832;
const VARIANTS = spec.variants ?? 3;
const OUT = resolve(spec.out);
mkdirSync(OUT, { recursive: true });

const CKPT = spec.checkpoint ?? "sdxl_turbo_1.0_fp16.safetensors";
const graph = (prompt, seed) => ({
  "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
  "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
  "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: spec.neg ?? "" } },
  "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
  "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
  "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
  "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: spec.prefix ?? "scenegen" } },
});

async function generate(prompt, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(prompt, seed) }) });
  if (!q.ok) throw new Error(`queue ${q.status}: ${await q.text()}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const h = await (await fetch(`${HOST}/history/${prompt_id}`)).json();
    const e = h[prompt_id];
    if (e?.status?.status_str === "error") throw new Error("comfy error: " + JSON.stringify(e.status));
    if (e?.status?.completed || e?.outputs?.["7"]) {
      const img = e.outputs?.["7"]?.images?.[0];
      if (!img) return null; // completed-but-empty: caller retries with a new seed
      const res = await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`);
      return Buffer.from(await res.arrayBuffer());
    }
  }
  return null;
}

let seed = spec.seed ?? Math.abs([...JSON.stringify(spec.scenes)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 90_000_000;
let made = 0, skipped = 0;
for (const [key, scene] of Object.entries(spec.scenes)) {
  for (let v = 1; v <= VARIANTS; v++) {
    const out = join(OUT, `${spec.prefix}-${key}-v${v}.png`);
    if (existsSync(out)) { skipped++; continue; }
    let buf = null;
    for (let attempt = 0; attempt < 3 && !buf; attempt++) {
      buf = await generate(`${scene}, ${spec.style ?? ""}`, seed++ + attempt * 7);
      if (!buf) console.error(`  ↻ ${key} v${v} retry ${attempt + 1}`);
    }
    if (!buf) { console.error(`✗ ${key} v${v} failed after retries`); continue; }
    writeFileSync(out, buf);
    made++;
    console.error(`▶ ${key} v${v}`);
  }
}
console.error(`✦ done: ${made} generated, ${skipped} already existed → ${OUT}`);
