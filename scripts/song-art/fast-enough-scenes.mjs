#!/usr/bin/env node
// FAST ENOUGH — the directed-cut scene pass (window 77.6–138.1).
// Illustrate-the-scene law: one painting per lyric line. Voice: retro 16-bit
// summer romance — gold rings, red springs, checkered green hills, pixel
// sparkle, chrome blue sky — evoking the Genesis era without any copyrighted
// character. Protagonists: the couple, every scene.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const OUT = join(HERE, "fast-enough-scenes-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const DUO = "a stylish young Black couple in 90s streetwear — him with short locs and a gold chain, her with long braids and gold hoop earrings";
const STYLE = "vibrant dense comic book illustration, bold ink linework, halftone shading, bright turquoise blue gold and coral palette, retro 16-bit videogame summer energy, pixel sparkle accents, chrome shine, dynamic speed lines, no text, no watermark";
const NEG = "text, words, letters, watermark, logo, signature, caption, sonic the hedgehog, sega, video game character, mascot, low quality, blurry, deformed hands, extra fingers, photorealistic, photograph";

const SCENES = [
  ["shine", `${DUO} glowing under boardwalk string lights at night, warm light halos around them, ocean behind`],
  ["springs", `${DUO} bouncing impossibly high off giant red coil springs over a checkered green hillside, bright blue sky, joyful mid-air pose`],
  ["sky", `two hands reaching up together into a brilliant blue sky full of small puffy clouds and golden sparkles, sun flare`],
  ["invincible", `${DUO} running at super speed surrounded by an aura of golden stars and sparkles, speed lines streaking behind them, invincible energy`],
  ["golden", `a floating trail of large gold rings arcing through a summer sky, one heart-shaped golden ring glowing at the center, pixel sparkle`],
  ["catch", `${DUO} blurring past a frozen crowd as two streaks of light, everyone else standing still in grey, motion trails in gold and blue`],
  ["move", `${DUO} dancing on a glowing neon dance floor made of giant game blocks, night sky, crowd cheering, disco light beams`],
  ["level", `a monumental glowing golden up-arrow monument with rising light platforms spiraling around it, ${DUO} climbing together, sunburst sky`],
  ["somebody", `${DUO} face to face about to kiss on a boardwalk at night, city lights bokeh behind, hearts of light floating between them`],
  ["caught", `${DUO} speeding away on a retro convertible leaving two long light trails down a coastal highway at dusk, palm trees whipping past`],
  ["unlocked", `a giant golden gate swinging open onto a sunrise over a checkered green valley, confetti of pixel squares raining, triumphant light`],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdfe" } },
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

let seed = 77_138;
for (const [word, scene] of SCENES) {
  for (let v = 1; v <= 2; v++) {
    log(`▶ ${word} v${v}`);
    const buf = await generate(`${scene}, ${STYLE}`, NEG, seed++);
    writeFileSync(join(OUT, `scene-${word}-v${v}.png`), buf);
  }
}
log("✦ scene pass done");
