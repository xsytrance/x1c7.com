#!/usr/bin/env node
// MAYBE WAS THE ANSWER — charcoal voice, reroll of the 4 scenes that failed the
// eyes-on audit:
//   talk    — "red glow between the fingers" rendered as BLOODY HANDS, no phone.
//             Restaged entirely: a hand on a closed door, red light beneath it.
//             (Also stops it being a third phone shot.)
//   car     — "red tail lights" became red FLAMES and a fully red car.
//   laundry — messy piles for the THIRD time; the menace is that it's FOLDED.
//   warning — red light spilling from a door came back as blood spatter.
// The model's standing bias: any "one red element" wants to become blood, so
// gore is now hard-negated.
//
//   node scripts/song-art/maybe-charcoal-fix.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const OUT = join(HERE, "maybe-charcoal-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const STYLE = "charcoal and graphite drawing on textured paper, hand drawn, heavy smudged black shadows, rough hatching, deep contrast, monochrome greyscale, one blood-red element only, cinematic, fine art drawing";

const NEG_BASE = "face, head, portrait, eyes, mouth, lips, hair, person, people, human figure, crowd, " +
  "blood, gore, wound, bleeding, injury, blood splatter, blood stain, " +
  "text, words, letters, numbers, watermark, logo, signature, photorealistic, 3d render, anime, comic book, " +
  "halftone, risograph, screenprint, full color, colorful, blue, green, yellow, low quality, blurry, extra fingers";

const SCENES = [
  // Short, subject-first prompts — the long ones drifted every time.
  ["talk",    `${NEG_BASE}, phone, smartphone`,
   "one hand pressed flat against a closed door in a dark hallway, a thin bright red line of light glowing underneath the door, close-up on the hand and the door"],
  ["car",     `${NEG_BASE}, fire, flames, burning, red car, red paint, red bodywork`,
   "the back of a grey car parked on a dark empty street at night, its two rear tail lights glowing red, exhaust in the cold air"],
  ["laundry", `${NEG_BASE}, messy, crumpled, wrinkled, heap, pile, jumbled, chaos, laundry basket`,
   "three squarely folded towels stacked in a small neat tower on a smooth made bed, sharp crisp folded edges, the middle towel is red, empty room"],
  ["warning", `${NEG_BASE}, spatter, stain, drips`,
   "an empty grey room at night, a long clean rectangle of red light thrown across the wooden floorboards from a doorway"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdcharfix" } },
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

let seed = 606_1129;
for (const [key, neg, scene] of SCENES) {
  for (let v = 1; v <= 4; v++) {
    log(`▶ ${key} f${v}`);
    writeFileSync(join(OUT, `nf-${key}-f${v}.png`), await generate(`${scene}, ${STYLE}`, neg, seed++));
  }
}
log("✦ charcoal fix pass done");
