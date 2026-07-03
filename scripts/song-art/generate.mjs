#!/usr/bin/env node
// Song-art generation: the planet's imagery prompts -> ComfyUI (local) -> images.
// Phase 4 of the lyric engine. Hard caps keep generation bounded.
//
// Usage: node generate.mjs --planet planet.json --out ./out --song <id>
//        [--host http://localhost:8188] [--ckpt sdxl_turbo_1.0_fp16.safetensors]
//        [--max 8] [--w 1152] [--h 832]
// planet.json = the track's planet jsonb ({ analysis: { keywords, overallMood, themes... } }).
// Emits <out>/<word>.png per keyword + manifest.json.

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]]); return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const CKPT = args.ckpt || "sdxl_turbo_1.0_fp16.safetensors";
const MAX = Math.min(parseInt(args.max || "8", 10), 16); // hard ceiling
const W = parseInt(args.w || "1152", 10), H = parseInt(args.h || "832", 10);
const log = (...a) => console.error(...a);

// SDXL Turbo txt2img graph (API format): 4 steps, cfg 1.
function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "songart" } },
  };
}

async function generate(prompt, negative, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(prompt, negative, seed) }) });
  if (!q.ok) throw new Error(`queue ${q.status}: ${await q.text()}`);
  const { prompt_id } = await q.json();
  // poll history
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 1000));
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

const planet = JSON.parse(readFileSync(args.planet, "utf8"));
const a = planet.analysis;
const songId = args.song || "song";
mkdirSync(args.out, { recursive: true });

// House style: consistent, cinematic, no text — prompts stay song-specific.
// planet.styleHint (derived from the artist's style prompt) overrides the default
// moody look so each song's art matches its own world.
const style = planet.styleHint
  ? `${planet.styleHint}, cinematic, evocative of "${a.overallMood}" mood, no text, no watermark`
  : `cinematic still, moody atmospheric lighting, film grain, shallow depth of field, dark ambient, evocative of "${a.overallMood}" mood, no text, no watermark`;
// Extra negative terms per song (e.g. "face, portrait, eye contact" to keep
// people anonymous) append to the house negative via --negative.
const negExtra = args.negative && args.negative !== true ? `, ${args.negative}` : "";
const negative = `text, watermark, logo, caption, letters, low quality, deformed, oversaturated, cartoon${negExtra}`;

const jobs = (a.keywords || []).slice(0, MAX);
log(`generating ${jobs.length} images (cap ${MAX}) via ${CKPT} @ ${W}x${H}`);
const manifest = { songId, model: CKPT, images: [] };
let seed = 4242;
for (const k of jobs) {
  const prompt = `${k.imageryPrompt}, ${style}`;
  log(`  ${k.word}: ${k.imageryPrompt}`);
  try {
    const buf = await generate(prompt, negative, seed++);
    const file = `${k.word.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.png`;
    writeFileSync(join(args.out, file), buf);
    manifest.images.push({ word: k.word, emotion: k.emotion, prompt: k.imageryPrompt, file });
    log(`    ok (${(buf.length / 1e6).toFixed(1)} MB)`);
  } catch (e) { log(`    ERROR: ${e}`); }
  writeFileSync(join(args.out, "manifest.json"), JSON.stringify(manifest, null, 2));
}
log(`done: ${manifest.images.length}/${jobs.length} -> ${args.out}`);
