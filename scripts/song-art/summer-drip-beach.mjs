#!/usr/bin/env node
// SUMMER DRIP — the beach pass (owner's call 2026-07-23: "a really big and
// fancy beach with lots of women in swimsuits and men gawking at them").
// Anchors: sun/skin/clouds carry the panorama through the "Two-piece low …
// clouds roll by" line; patio becomes a packed beachfront club. Same graph
// and style voice as summer-drip-scenes.mjs so the set stays one story.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const OUT = join(HERE, "summer-drip-scenes-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const STYLE = "vibrant dense comic book illustration, bold ink linework, halftone shading, rich purple magenta and gold palette, golden hour sunset glow, 90s hip-hop fashion, dynamic composition, no text, no watermark";
const NEG = "text, words, letters, watermark, logo, signature, caption, low quality, blurry, deformed hands, extra fingers, photorealistic, photograph, nudity";

const SCENES = [
  ["beach", 4, `a huge lavish luxury beach at golden hour, golden sand and turquoise waves, striped cabanas and palm trees, many glamorous women in colorful stylish swimsuits laughing and posing, men comically gawking with jaws dropped and sunglasses slipping off, a yacht on the horizon, purple sunset sky`],
  ["patio2", 2, `a packed beachfront club patio at sunset, every lounge chair filled, glamorous women in swimsuits and wraps with drinks raised, men gawking from the bar, string lights and palm trees, big speaker stack, waves behind, purple and gold sky`],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdbeach" } },
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

let seed = 88_216;
for (const [name, variants, scene] of SCENES) {
  for (let v = 1; v <= variants; v++) {
    log(`▶ ${name} v${v}`);
    const buf = await generate(`${scene}, ${STYLE}`, NEG, seed++);
    writeFileSync(join(OUT, `scene-${name}-v${v}.png`), buf);
  }
}
log("✦ beach pass done");
