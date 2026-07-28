#!/usr/bin/env node
// MAYBE WAS THE ANSWER — the directed-cut scene pass (window 59.4–104.6).
// Voice: TWO-COLOR RISOGRAPH SCREENPRINT — flat coral and ink-blue inks,
// halftone dots, paper grain, misregistered layers. One voice with a tonal
// dial: coral-dominant for the sweet chorus, ink-blue-dominant as the song
// curdles into the stalker flip. Eighth distinct voice (own-planet law).
//
//   node scripts/song-art/maybe-scenes.mjs

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

// The print process is the constant; the ink mix is the tonal dial.
const BASE = "two-color risograph screenprint poster, flat solid ink areas, coarse visible halftone dot texture, rough recycled paper grain, slight misregistration offset between the two ink layers, bold graphic composition, limited palette, retro soul record sleeve";
const WARM = `${BASE}, warm coral-red and soft peach inks with a little navy, sunlit and inviting`;
const COOL = `${BASE}, deep ink-blue and black inks with one bruised coral accent, cold and ominous, heavy shadow`;

const NEG = "text, words, letters, numbers, typography, watermark, logo, signature, caption, photorealistic, 3d render, anime, oil painting, smooth gradients, full color photograph, nudity, low quality, blurry, extra limbs, crowd";

// [key, tone, scene] — each ILLUSTRATES that lyric's literal narrative.
// Two-shots are framed waist-up medium close-up: SDXL Turbo cannot count
// people, but tight framing structurally limits the cast.
const SCENES = [
  ["lady",       WARM, "a young man in a satin shirt leaning across a small cafe table offering a single flower to a woman, both figures fill the frame waist-up, medium close-up two-shot, warm evening light"],
  ["maybe",      WARM, "extreme close-up of a woman's face turned half away, one eyebrow raised in a noncommittal shrug, small ambivalent half-smile, coy and unreadable"],
  ["baby",       WARM, "a phone lying face-up on rumpled bedsheets in a dark bedroom, its screen glowing bright, spill of light across the fabric, nobody in frame"],
  ["talk",       WARM, "a woman pressing a phone hard to her ear standing in a narrow doorway, tense shoulders, waist-up single figure"],
  ["confidence", WARM, "a man walking away down a sunlit street with an easy relaxed stride, hands in pockets, seen from behind, single figure"],
  ["missed",     COOL, "a phone screen glowing in a pitch dark room showing a long vertical stack of blank call notification bars, held in one hand, close-up"],
  ["car",        COOL, "a car idling on an empty street at night with headlights burning and exhaust curling in cold air, viewed from inside through parted window blinds"],
  ["chase",      COOL, "two running figures in silhouette, the one in front twisting to look back over their shoulder in alarm, medium shot, the pursuit reversed"],
  ["save",       COOL, "a man alone in a bare dry room, hands clasped on top of his head, one harsh overhead bulb, long shadow, single figure"],
  ["code",       COOL, "a close-up of a hand pressing the buttons of a door keypad in a dark apartment hallway, only the hand and the door in frame"],
  ["kitchen",    COOL, "a single plate of untouched food left on an empty kitchen counter under a low hanging lamp, nobody there, unsettling stillness"],
  ["laundry",    COOL, "a stack of neatly folded laundry squared on the corner of a made bed in an empty bedroom, oppressive tidiness, nobody there"],
  ["warning",    COOL, "an empty tidy room seen from a doorway with the long stretched shadow of a standing figure falling across the floor toward the viewer"],
  ["answer",     COOL, "extreme close-up of a woman's face lit from one side in deep shadow, lips parted mid-word, expression unreadable and still"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdmaybe" } },
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

const VARIANTS = Number(process.env.VARIANTS ?? 3);
let seed = 594_1046;
for (const [key, tone, scene] of SCENES) {
  for (let v = 1; v <= VARIANTS; v++) {
    log(`▶ ${key} v${v}`);
    const buf = await generate(`${scene}, ${tone}`, NEG, seed++);
    writeFileSync(join(OUT, `scene-${key}-v${v}.png`), buf);
  }
}
log("✦ scene pass done");
