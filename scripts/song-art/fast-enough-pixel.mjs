#!/usr/bin/env node
// FAST ENOUGH — pixel pass (owner's call 2026-07-24: "16-bit pixelart retro
// look with lots of cars" — distinct from the comic voice of the other cuts).
// A street-racing romance in Genesis-era pixels: every scene has cars.
// Authentic pixel grid: render at full res, then downscale ~4× and
// nearest-neighbor back up, so the pixels are real, crisp squares.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const sharp = createRequire(import.meta.url)(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "node_modules", "sharp"));

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const OUT = join(HERE, "fast-enough-scenes-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const STYLE = "detailed 16-bit pixel art, retro 90s racing videogame aesthetic, side-scroller background art, vibrant sunset gradient sky with dithering, chunky sprites, neon signage glow, palm trees, chrome reflections, nostalgic arcade colors, no text, no watermark";
const NEG = "text, words, letters, watermark, logo, signature, caption, photorealistic, photograph, 3d render, smooth gradients, sonic the hedgehog, sega logo, real brand cars, low quality, blurry";

const SCENES = [
  ["shine", "a pixel art couple leaning on a glowing retro sports car under boardwalk neon lights at night, string lights, ocean pier behind, sprites holding hands"],
  ["springs", "a pixel art red convertible launching off a giant spring ramp high over a checkered green hillside, big blue sky, motion sparkle trail"],
  ["sky", "a pixel art convertible driving up an impossible spiral skyway into bright clouds, sun rays, tiny cars on loops below"],
  ["invincible", "a pixel art sports car glowing with a golden star aura, sparkles orbiting it, racing down a coastal highway leaving light trails"],
  ["golden", "a pixel art highway passing through an arch of giant floating gold rings, sunset sky, a heart-shaped ring glowing at the peak, cars streaming through"],
  ["catch", "a pixel art street race: one glowing car streaking past a row of rival cars frozen in grey, gold and cyan speed lines"],
  ["move", "a pixel art drive-in dance party at night, cars parked in a circle around a neon dance floor, couples dancing, headlights as spotlights"],
  ["level", "a pixel art stacked highway of glowing platforms rising toward a giant golden up-arrow sun, cars climbing level by level"],
  ["somebody", "a pixel art couple in a parked convertible at a cliff overlook, giant pixel sunset over the sea, heart sparkles above the car"],
  ["caught", "a pixel art rear view of a convertible speeding into a dusk horizon, two long tail-light trails, rival headlights far behind, palm silhouettes"],
  ["unlocked", "a pixel art golden checkpoint arch opening onto a brand new zone: a sunrise valley with a fresh highway winding into checkered green hills, confetti pixels"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdfepx" } },
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

let seed = 160_916;
for (const [word, scene] of SCENES) {
  for (let v = 1; v <= 2; v++) {
    log(`▶ ${word} px v${v}`);
    const buf = await generate(`${scene}, ${STYLE}`, NEG, seed++);
    // real pixel grid: 4× down (area), nearest back up
    const px = await sharp(buf).resize(Math.round(W / 4), Math.round(H / 4), { kernel: "lanczos3" }).toBuffer();
    const up = await sharp(px).resize(W, H, { kernel: "nearest" }).png().toBuffer();
    writeFileSync(join(OUT, `px-${word}-v${v}.png`), up);
  }
}
log("✦ pixel pass done");
