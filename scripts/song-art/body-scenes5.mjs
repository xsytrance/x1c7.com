#!/usr/bin/env node
// SAY IT WITH YOUR BODY — v3 art direction (owner, 2026-07-25): each image is
// exactly ONE MAN + ONE WOMAN (never 2 women / 2 men / 3 of anything), still
// pure silhouettes, but dressed in modern URBAN clothing and set in modern
// urban / LED / nightclub aesthetics. 6 variants per scene; every output gets
// a manual vision audit (count the people!) and the crop-a-couple fallback
// stays available if the model invites guests again.

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

const STYLE = "one man and one woman only, as PURE SOLID BLACK featureless silhouettes, modern urban streetwear outlines (bomber jacket, hoodie, sneakers, her hair loose), backlit by vivid LED neon light through nightclub haze, electric magenta and cyan glow, dark club atmosphere, cinematic minimalism, mysterious and intimate, film noir with neon, no text, no watermark";
const NEG = "three people, trio, third person, group, crowd, four people, extra person, second couple, multiple couples, several figures, bystander, two women, two men, extra hands, extra limbs, visible face, facial features, eyes, skin texture, lit body, lingerie, swimwear, revealing clothing, trees, forest, moon, nature, daylight, countryside, text, words, letters, watermark, logo, low quality, blurry";

const SCENES = [
  ["brooklyn", "a man and a woman standing together as black silhouettes on a rooftop at night, facing a vast city skyline glowing with LED billboards and neon signs through haze, one shared skyline glow behind them"],
  ["heartbeat", "a man and a woman chest to chest as black silhouettes in a dark nightclub, a single glowing neon heartbeat pulse line on the LED wall behind them, haze and darkness everywhere else"],
  ["slowly", "a man and a woman slow-dancing pressed together as black silhouettes in thick nightclub fog, one single beam of magenta LED light from above, empty dance floor"],
  ["hold", "a man and a woman melting into one single embracing silhouette shape in front of a glowing wall of LED panels seen through club haze, nobody else on the floor"],
  ["feel", "close-up of exactly two hands silhouetted in profile, a man's hand reaching from the left edge and a woman's hand reaching from the right edge, fingertips almost touching in the center, backlit by a cyan-magenta LED glow, nothing else visible"],
  ["body", "a man and a woman dancing facing each other as black silhouettes on an empty nightclub floor, a fan of laser beams and LED strips cutting the haze behind them"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdbody5" } },
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

let seed = 5_184_214;
for (const [word, scene] of SCENES) {
  for (let v = 1; v <= 6; v++) {
    log(`▶ ${word} v${v}`);
    const buf = await generate(`${scene}, ${STYLE}`, NEG, seed++);
    writeFileSync(join(OUT, `urban-${word}-v${v}.png`), buf);
  }
}
log("✦ urban LED pass done");
