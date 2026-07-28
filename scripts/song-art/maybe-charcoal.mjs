#!/usr/bin/env node
// MAYBE WAS THE ANSWER — style sample pass #2 (risograph was rejected).
// Candidate voice: CHARCOAL & ASH with a SINGLE BLOOD-RED ACCENT. Hand-drawn
// charcoal/graphite, smudged, heavy black shadow, everything monochrome except
// one red object per frame — sweet when the red is a rose, a warning when it's
// a phone screen at 2am. Four samples spanning the song's tonal arc.
//
//   node scripts/song-art/maybe-charcoal.mjs

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

const STYLE = "charcoal and graphite drawing on textured paper, hand drawn, heavy smudged black shadows, rough expressive hatching, fingerprint smears, deep contrast, monochrome greyscale, selective color: exactly one blood-red object glowing against the grey, dramatic and cinematic, fine art drawing";
const NEG = "text, words, letters, numbers, watermark, logo, signature, photorealistic, 3d render, anime, comic book, halftone dots, risograph, screenprint, full color, colorful, rainbow, multiple colors, blue, green, yellow, low quality, blurry, extra limbs, crowd";

// One per act of the 45s window, so the arc is visible in the samples.
const SCENES = [
  ["rose", "a young man leaning across a small table offering a single deep red rose to a woman, both figures fill the frame waist-up, medium close-up two-shot, the rose is the only red thing in a charcoal grey world"],
  ["phone", "a hand holding a smartphone in a pitch dark bedroom, the screen burning bright blood-red and lighting the fingers and the sheets, everything else charcoal grey and black"],
  ["laundry", "a stack of precisely folded shirts squared in a perfect neat pile on a made bed in an empty grey bedroom, one single red garment in the middle of the stack, obsessive tidiness, nobody there"],
  ["face", "extreme close-up of a woman's face lit hard from one side, half swallowed in black shadow, lips parted mid-word, her lips the only red in the drawing, unreadable and still"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdcharcoal" } },
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
let seed = 451_1207;
for (const [key, scene] of SCENES) {
  for (let v = 1; v <= VARIANTS; v++) {
    log(`▶ ${key} v${v}`);
    writeFileSync(join(OUT, `char-${key}-v${v}.png`), await generate(`${scene}, ${STYLE}`, NEG, seed++));
  }
}
log("✦ charcoal sample pass done");
