#!/usr/bin/env node
// MAYBE WAS THE ANSWER — reroll pass. Three scenes failed the eyes-on audit:
//   baby    — SDXL kept drawing rotary landlines; the lyric is a phone that LIGHTS UP
//   missed  — came back acid-green, off the coral/ink-blue riso palette
//   laundry — came back as MESSY PILES; the menace is that it's NEATLY FOLDED
//
//   node scripts/song-art/maybe-reroll.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const OUT = join(HERE, "maybe-scenes-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const BASE = "two-color risograph screenprint poster, flat solid ink areas, coarse visible halftone dot texture, rough recycled paper grain, slight misregistration offset between the two ink layers, bold graphic composition, limited palette, retro soul record sleeve";
const WARM = `${BASE}, warm coral-red and soft peach inks with a little navy, sunlit and inviting`;
const COOL = `${BASE}, deep ink-blue and black inks with one bruised coral accent, cold and ominous, heavy shadow`;

const NEG_BASE = "text, words, letters, numbers, typography, watermark, logo, signature, caption, photorealistic, 3d render, anime, oil painting, smooth gradients, full color photograph, nudity, low quality, blurry, extra limbs, crowd";
// The palette leak that ruined the first `missed` pass.
const NEG_GREEN = `${NEG_BASE}, green, lime, acid green, neon green, teal, circuit board, computer chip, matrix code`;
const NEG_PHONE = `${NEG_BASE}, rotary phone, landline, telephone cord, coiled cable, vintage telephone, dial phone, answering machine`;
const NEG_MESS = `${NEG_BASE}, messy pile, crumpled, heap, jumbled, wrinkled, laundry basket, mess, chaos`;

const SCENES = [
  ["baby", WARM, NEG_PHONE,
   "a sleek modern flat touchscreen smartphone lying face up on rumpled bedsheets in a dark bedroom, its bright screen glowing and throwing a pool of light across the folds of fabric, close-up, nobody in frame"],
  ["missed", COOL, NEG_GREEN,
   "a dark bedroom at night, one hand holding a flat modern smartphone whose pale glowing screen shows a long vertical stack of identical blank notification bars filling the whole screen, deep ink-blue shadows, coral skin tone, close-up on the hand and phone"],
  ["laundry", COOL, NEG_MESS,
   "a stack of precisely folded shirts squared into a perfect neat pile on the corner of a smoothly made bed, crisp sharp folded edges, obsessively tidy and deliberate, empty silent bedroom, nobody in frame, unsettling order"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdmaybe2" } },
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

let seed = 771_204;
for (const [key, tone, neg, scene] of SCENES) {
  for (let v = 1; v <= 4; v++) {
    log(`▶ ${key} r${v}`);
    const buf = await generate(`${scene}, ${tone}`, neg, seed++);
    writeFileSync(join(OUT, `scene-${key}-r${v}.png`), buf);
  }
}
log("✦ reroll done");
