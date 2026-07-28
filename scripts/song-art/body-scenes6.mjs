#!/usr/bin/env node
// SAY IT WITH YOUR BODY — urban LED, round 2: MEDIUM CLOSE-UP framing.
// Full-length wide shots always came back with 4-5 people; a waist-up two-shot
// leaves no floor space for extras. feel is already solved (urban-feel-v6).

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const OUT = join(HERE, "body-scenes-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const STYLE = "medium close-up two-shot, the two figures fill the entire frame, one man and one woman only as pure black featureless silhouettes, modern urban streetwear outlines (bomber jacket, hoodie, her hair loose), backlit by vivid LED neon glow through nightclub haze, electric magenta and cyan light, dark club atmosphere, cinematic, mysterious and intimate, no text, no watermark";
const NEG = "three people, third person, trio, group, crowd, extra person, second couple, several figures, bystander, two women, two men, full body, wide shot, feet, dance floor crowd, extra hands, extra limbs, visible face, facial features, eyes, skin texture, lit skin, revealing clothing, trees, nature, moon, daylight, text, words, letters, watermark, logo, low quality, blurry";

const SCENES = [
  ["brooklyn", "waist-up silhouettes of a man and a woman side by side on a rooftop at night, seen from behind, looking out at a glowing neon city skyline with LED billboards, city glow wrapping their outlines"],
  ["heartbeat", "waist-up silhouettes of a man and a woman chest to chest, her hand flat on his chest, a glowing neon heartbeat pulse line crossing the LED wall directly behind them"],
  ["slowly", "waist-up silhouettes of a man and a woman slow-dancing cheek to cheek, his hand on her waist, wrapped in nightclub haze under one magenta LED beam"],
  ["hold", "waist-up silhouettes of a man and a woman in a tight embrace merging into one dark shape, her head on his shoulder, a wall of glowing LED hexagon panels behind them"],
  ["body", "waist-up silhouettes of a man and a woman dancing face to face, arms raised mid-move, a fan of laser beams and LED strips cutting the haze behind them"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdbody6" } },
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

let seed = 6_184_214;
for (const [word, scene] of SCENES) {
  for (let v = 1; v <= 4; v++) {
    log(`▶ ${word} v${v}`);
    const buf = await generate(`${scene}, ${STYLE}`, NEG, seed++);
    writeFileSync(join(OUT, `duo2-${word}-v${v}.png`), buf);
  }
}
log("✦ close-up pass done");
