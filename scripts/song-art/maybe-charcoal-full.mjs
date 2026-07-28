#!/usr/bin/env node
// MAYBE WAS THE ANSWER — the directed-cut scene pass, voice #2 (FINAL).
// Voice: CHARCOAL & ASH — hand-drawn charcoal/graphite on textured paper,
// smudged, heavy black shadow, greyscale EXCEPT one blood-red accent per frame.
// The red is the story device: a rose in the chorus, a phone screen at 2am.
//
// OWNER CONSTRAINT: no human faces, no heads. Hands, objects, light, and
// abstract imagery only — so every scene is staged around what the hands do
// and what the room gives away. (Also sidesteps SDXL's inability to count people.)
//
//   node scripts/song-art/maybe-charcoal-full.mjs

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

const STYLE = "charcoal and graphite drawing on textured paper, hand drawn, heavy smudged black shadows, rough expressive hatching, fingerprint smears, deep contrast, monochrome greyscale, selective color: exactly one blood-red element against the grey, cinematic, fine art drawing";

// Faces/heads are hard-negated per the owner's constraint.
const NEG = "face, head, portrait, eyes, mouth, lips, hair, neck, shoulders, person, people, human figure, crowd, " +
  "text, words, letters, numbers, watermark, logo, signature, photorealistic, 3d render, anime, comic book, " +
  "halftone dots, risograph, screenprint, full color, colorful, rainbow, blue, green, yellow, low quality, blurry, extra fingers";

// [key, scene] — hands, objects, rooms, light. No faces, no heads.
const SCENES = [
  ["lady",       "two hands meeting over a small cafe table, one hand offering a single deep red rose, only hands and forearms in frame, close-up on the hands"],
  ["maybe",      "one hand holding out a deep red rose, a second hand hovering just short of taking it, fingers not quite touching, only hands in frame, close-up"],
  ["baby",       "a smartphone lying face up on rumpled bedsheets in a dark bedroom, its screen glowing blood-red across the folds of fabric, no hands, nobody"],
  ["talk",       "a single hand gripping a phone hard, knuckles tight and pale, red screen glow leaking between the fingers, close-up on the hand only"],
  ["confidence", "a pair of shoes walking away down a wet empty street, seen from ground level behind, long reflections, one red detail on the shoe, legs only no upper body"],
  ["missed",     "a hand holding a phone in a dark room, its screen filled with a long vertical stack of blood-red notification bars, close-up on hand and phone"],
  ["car",        "a car idling on an empty street at night, its rear tail lights burning blood-red, exhaust curling in cold air, charcoal grey street, nobody in frame"],
  ["chase",      "running legs and feet in motion blur on wet asphalt, lower bodies only, no upper bodies, a red streak of light trailing behind them"],
  ["saaaave",    "a single bare hand reaching up out of deep black water toward a small red light above, only the hand and wrist breaking the surface"],
  ["code",       "a hand pressing the buttons of a door keypad in a dark hallway, one single key glowing blood-red under the fingertip, close-up on hand and keypad"],
  ["kitchen",    "a plate of untouched food left on an empty kitchen counter under a low hanging lamp, a red rim around the plate, nobody there, unsettling stillness"],
  ["laundry",    "a stack of precisely folded shirts squared into a neat pile on a made bed, crisp sharp folded edges, one single red shirt in the middle of the stack, empty room"],
  ["warning",    "a door standing ajar in a dark empty hallway, blood-red light spilling through the gap and stretching across the floorboards toward the viewer, nobody in frame"],
  ["answer",     "a single deep red rose lying alone on a bare empty table, dark petals scattered around it, deep charcoal shadow, nobody in frame"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdchar2" } },
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
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
let seed = 77_310_9;
for (const [key, scene] of SCENES) {
  if (only && !only.has(key)) { seed += VARIANTS; continue; }
  for (let v = 1; v <= VARIANTS; v++) {
    log(`▶ ${key} n${v}`);
    writeFileSync(join(OUT, `nf-${key}-n${v}.png`), await generate(`${scene}, ${STYLE}`, NEG, seed++));
  }
}
log("✦ no-face charcoal pass done");
