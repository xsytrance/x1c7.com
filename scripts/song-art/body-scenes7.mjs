#!/usr/bin/env node
// SAY IT WITH YOUR BODY — "hold" redo (owner: the hooded pair looks creepy).
// Two silhouettes only: a sexy woman and a fit man caught in a sexy dance
// move (dip / wrapped close), urban LED nightclub world, faces dark.

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

const STYLE = "two-shot filling the frame, one fit athletic man and one beautiful curvy woman only, as dark featureless silhouettes, elegant sensual dance pose, modern urban club wear outlines, backlit by vivid LED neon glow through nightclub haze, electric magenta and cyan light, dark club atmosphere, cinematic, mysterious and intimate, no text, no watermark";
const NEG = "three people, third person, trio, group, crowd, extra person, second couple, several figures, bystander, two women, two men, hood, hoodie up, extra hands, extra limbs, visible face, facial features, eyes, skin texture, lit skin, nudity, lingerie, trees, nature, daylight, text, words, letters, watermark, logo, low quality, blurry";

const POSES = [
  ["a", "a man dipping a woman low in a dramatic tango dip, her back arched, one of her legs extended, his arm holding her waist"],
  ["b", "a woman pressed back-to-chest against a man, both mid body-roll, her arm reaching up around his neck"],
  ["c", "a man and a woman dancing bachata pressed close, her leg wrapped around his, leaning into each other"],
  ["d", "a man lifting a woman slightly as she arches back, her hair flying, caught mid dance spin"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdbody7" } },
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

let seed = 7_197_900;
for (const [key, pose] of POSES) {
  for (let v = 1; v <= 2; v++) {
    log(`▶ ${key} v${v}`);
    const buf = await generate(`${pose}, ${STYLE}`, NEG, seed++);
    writeFileSync(join(OUT, `dance-${key}-v${v}.png`), buf);
  }
}
log("✦ dance pass done");
