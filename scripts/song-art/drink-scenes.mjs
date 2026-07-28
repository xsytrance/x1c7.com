#!/usr/bin/env node
// DRINK DRINK [DON'T SAVE ME] — the directed-cut scene pass (window 97.8–128.3).
// Voice: dark chiaroscuro oil painting — one amber light source in deep
// blackness, whiskey glow, pours and spills, Baroque still-life despair.
// Fifth distinct voice in the series. Illustrate-the-scene law: each painting
// IS the line being sung.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const OUT = join(HERE, "drink-scenes-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const STYLE = "dark chiaroscuro oil painting, dramatic single-source amber candlelight, deep black shadows, Baroque still life realism, glowing whiskey amber, visible brushwork, oppressive late-night despair, muted umber and gold palette, no text, no watermark";
const NEG = "text, words, letters, watermark, logo, signature, caption, comic, pixel art, anime, airbrush, neon colors, bright daylight, cheerful, low quality, blurry, deformed hands";

const SCENES = [
  ["tonight", "a lone man slumped at a bar counter in near-total darkness, one overhead bulb, a single whiskey glass glowing amber before him, his face lost in shadow"],
  ["pour", "amber whiskey pouring in a thick slow stream from a bottle into a glass, the pour itself glowing like molten light against pure blackness, droplets suspended"],
  ["bottle", "a half-empty bottle glowing faint amber on a nightstand beside an unmade bed, moonlight through blinds striping the dark room"],
  ["pain", "a man's head buried in his hands at a table crowded with empty glasses of every kind, one guttering candle, deep shadow swallowing the room"],
  ["save", "a pale hand reaching out of pitch darkness toward a distant glass of amber light, fingers almost touching it, dust in the light beam"],
  ["spill", "a tipped-over glass on a dark wooden table, amber liquor spreading in a slow mirror-like pool reflecting a single flame, pure black background"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sddk" } },
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

let seed = 97_128;
for (const [word, scene] of SCENES) {
  for (let v = 1; v <= 2; v++) {
    log(`▶ ${word} v${v}`);
    const buf = await generate(`${scene}, ${STYLE}`, NEG, seed++);
    writeFileSync(join(OUT, `scene-${word}-v${v}.png`), buf);
  }
}
log("✦ scene pass done");
