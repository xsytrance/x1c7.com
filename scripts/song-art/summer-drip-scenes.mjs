#!/usr/bin/env node
// SUMMER DRIP — the directed-cut scene pass. One illustration per lyric line
// of the 176–237s window, each painting THE SCENE the singer is describing
// (owner's note 2026-07-23: "illustrate every scene … rather than random
// images"). Same graph as generate.mjs (local ComfyUI, SDXL Turbo); a fixed
// protagonist phrase + one style voice keep the set reading as one story.
//
//   node scripts/song-art/summer-drip-scenes.mjs [--host http://localhost:8188]
//     [--variants 2] [--out scripts/song-art/summer-drip-scenes-out]
//
// Output: <out>/scene-<word>-v<N>.png + manifest.json. Upload + assets SQL
// happen separately once the picks are made.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const VARIANTS = Number(args.variants || 2);
const OUT = args.out && args.out !== true ? args.out : join(HERE, "summer-drip-scenes-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

// The protagonist — one woman, every scene, so the cut tells one story.
const HER = "a confident brown-skinned woman with long dark curls, gold hoop earrings and a gold chain";
const STYLE = "vibrant dense comic book illustration, bold ink linework, halftone shading, rich purple magenta and gold palette, summer night city block party energy, dramatic streetlamp and neon glow, 90s hip-hop fashion, dynamic composition, no text, no watermark";
const NEG = "text, words, letters, watermark, logo, signature, caption, low quality, blurry, deformed hands, extra fingers, photorealistic, photograph";

// word → the scene its lyric line describes. Word = the sung anchor that
// summons the painting (planet.assets.keywords key).
const SCENES = [
  ["sundress", `${HER} walking in a glowing yellow sundress under bright summer daylight, the dress radiating golden light like a halo, city sidewalk, admirers turning`],
  ["hips", `${HER} swaying her hips slow down a violet midnight street, long streetlamp shadows, motion echo trails behind her silhouette`],
  ["stride", `${HER} striding with flames trailing from her heels on dark pavement, a cold blue frozen heart glowing in her chest, night street`],
  ["step", `a gold stiletto heel stepping onto a marble star on the sidewalk, sparks of luxury light, jewelry glitter, red carpet aura, extreme close up`],
  ["smile", `close portrait of ${HER} with a sweet knowing smile, lip gloss catching golden hour light, teasing side glance`],
  ["shine", `brown skin shining under the warm cone of a streetlamp at night, glowing rim light, fireflies drifting, deep violet darkness all around`],
  ["perfume", `a thick shimmering golden perfume trail winding through night air, silhouetted admirers frozen mid-turn caught in the mist`],
  ["eyes", `a dark crowd of dozens of glowing hungry eyes all staring one direction, ${HER} walking past unbothered in a single spotlight`],
  ["skirt", `${HER} laughing as her skirt catches a gust of wind like a dancer's flourish, golden dusk street, hair lifted by the breeze`],
  ["patio", `a packed rooftop patio party at golden hour, friends laughing with drinks raised, string lights, big speaker stack, sun flare, summer joy`],
  ["crosswalk", `${HER} crossing a flashing neon crosswalk at night with hips swaying, a crowd raising glowing phones to film her, purple night sky`],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdscene" } },
  };
}

async function generate(prompt, negative, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(prompt, negative, seed) }) });
  if (!q.ok) throw new Error(`queue ${q.status}: ${await q.text()}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 800));
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

const manifest = { slug: "summer-drip", model: CKPT, style: STYLE, images: [] };
let seed = 77_177; // window start, roughly — any stable base works
for (const [word, scene] of SCENES) {
  for (let v = 1; v <= VARIANTS; v++) {
    const prompt = `${scene}, ${STYLE}`;
    log(`▶ ${word} v${v}`);
    const buf = await generate(prompt, NEG, seed++);
    const file = `scene-${word}-v${v}.png`;
    writeFileSync(join(OUT, file), buf);
    manifest.images.push({ word, variant: v, file, scene });
  }
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
log(`✦ ${manifest.images.length} scene paintings → ${OUT}`);
