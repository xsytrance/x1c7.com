#!/usr/bin/env node
// COCKTAILS && CODE — the directed-cut scene pass (window 225.0–285.5).
// Voice: 1980s airbrush album-cover gloss — chrome, glass, neon condensation,
// teal/magenta/amber. One painting per lyric line (illustrate-the-scene law),
// fourth distinct voice in the series (comic noir / coral comic / pixel / THIS).

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const OUT = join(HERE, "cocktails-scenes-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const STYLE = "1980s airbrush album cover illustration, glossy chrome and glass, smooth luminous gradients, teal magenta and amber neon palette, soft studio glow, fine condensation droplets, luxurious late-night lounge mood, subtle film grain, no text, no watermark";
const NEG = "text, words, letters, watermark, logo, signature, caption, comic, pixel art, ink lines, halftone, photorealistic photograph, people faces, low quality, blurry";

const SCENES = [
  ["glass", "a crystal cocktail glass with ice glowing beside a backlit keyboard on a chrome desk, sheer curtain lifting in a night breeze, city bokeh beyond the balcony"],
  ["boat", "a gleaming chrome sailboat gliding on a mirror-calm neon sea at night, moonlight path on the water, stars like pixels"],
  ["cocktails", "a row of luxurious cocktails on a chrome bar, each glowing a different neon color, garnishes sparkling, condensation beading"],
  ["dream", "a tiny glowing beach with two palm trees and a sunset held inside a cocktail glass, dreamlike scale, chrome table reflection"],
  ["fire", "a heart-shaped flame burning steadily inside a clear glass orb, chrome base, magenta and amber reflections"],
  ["load", "a horizontal bar of golden light filling across a midnight balcony railing like a progress bar made of sunrise, city lights below"],
  ["future", "a tall chrome doorway opening onto a sunrise over a calm ocean, light flooding through, lens flare, silhouette of palm fronds"],
  ["sip", "extreme close-up of a neon-teal cocktail with two straws and rising bubbles, glass rim glinting, magenta backlight"],
  ["source", "a waterfall of luminous teal glyphs cascading down behind a black palm tree silhouette, amber horizon glow"],
  ["ice", "macro of glowing ice cubes stacked in a glass, catching magenta and teal neon light, refraction sparkle"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdcc" } },
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

let seed = 225_285;
for (const [word, scene] of SCENES) {
  for (let v = 1; v <= 2; v++) {
    log(`▶ ${word} v${v}`);
    const buf = await generate(`${scene}, ${STYLE}`, NEG, seed++);
    writeFileSync(join(OUT, `scene-${word}-v${v}.png`), buf);
  }
}
log("✦ scene pass done");
