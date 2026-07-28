#!/usr/bin/env node
// PRETTY WHEN I LIE — the hero frame.
//
// Three passes of dense "evidence flat-lay" (the song's own cover language)
// failed: SDXL cannot compose a table of many small distinct objects — it
// returns debris fields and garbled label text. Tyler's own covers are almost
// all SINGLE SUBJECT with hard rim light, which is exactly what this model
// class is good at. So: one figure, one light, one accent.
//
// Brand rules taken from his artwork, not invented:
//   · young, slim, clean-shaven, messy dark shag — NOT the bearded rock guy
//     Juggernaut defaults to
//   · all black, layered silver chains, tattooed arms/neck
//   · face turned away / obscured — half his own covers read him that way, and
//     it is the only honest way to hold one persona across many frames
//   · amber practical + cold night + ONE crimson accent
//
// Usage: node scripts/song-art/pwil-hero.mjs [--only doorway|window|mirror] [--n 4]

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "pwil-out");
mkdirSync(OUT, { recursive: true });
const HOST = "http://localhost:8188";
const W = 832, H = 1216;
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const N = args.includes("--n") ? Number(args[args.indexOf("--n") + 1]) : 4;

const CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors";
const STEPS = 32, CFG = 6.5, SAMPLER = "dpmpp_2m", SCHED = "karras";

const TYLER = "a slim young man in his early twenties, clean shaven, "
  + "messy dark shaggy hair falling over his face, all black clothing, "
  + "layered silver chain necklaces, heavily tattooed forearms and neck";

const STYLE = "professional album cover photography, photorealistic, cinematic still, "
  + "single subject, strong rim lighting, high contrast, deep crushed blacks, "
  + "amber practical light against cold blue night, one crimson red neon accent, "
  + "volumetric haze, shallow depth of field, 35mm film grain, "
  + "moody nocturnal, high production value, glossy commercial finish";

const NEG = "beard, moustache, facial hair, stubble, old man, middle aged, muscular, bodybuilder, "
  + "looking at camera, eye contact, smiling, happy, "
  + "cluttered, debris, many objects, product labels, bottle label, "
  + "cartoon, anime, illustration, painting, cgi, 3d render, plastic skin, doll, "
  + "flat lighting, daylight, bright, washed out, low contrast, amateur snapshot, "
  + "text, words, letters, watermark, logo, signature, "
  + "extra limbs, extra fingers, deformed hands, mutated, duplicate person, crowd, "
  + "low quality, blurry, oversaturated";

const SHOTS = {
  // "You know where I've been but you still lock the door."
  doorway: `${TYLER}, standing in a dark hotel doorway seen from behind and slightly to the side, `
    + "head lowered, face hidden by hair and shadow, one hand braced against the door frame, "
    + "crimson neon spilling from the corridor behind him, warm amber lamp inside the room, "
    + "long shadow across the carpet, full body, centred composition",
  // "You don't want the man I become in the light."
  window: `${TYLER}, standing at a rain-streaked hotel window at night in profile, `
    + "silhouetted against the cold blue city, head tilted down, face lost in shadow, "
    + "cigarette smoke curling through a shaft of amber lamplight, "
    + "red neon sign glowing far below through the glass, waist up, centred composition",
  // "You read me like subtitles, still turn the volume high."
  mirror: `${TYLER}, reflected in a cracked bathroom mirror in a dark hotel, seen over his shoulder, `
    + "his face fractured and unreadable across the broken glass, head bowed, "
    + "a smear of crimson lipstick dragged across the mirror surface, "
    + "single bare amber bulb above, black tile, steam, waist up, centred composition",
};

function graph(prompt, seed) {
  return {
    1: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    2: { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    3: { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: NEG } },
    4: { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    5: { class_type: "KSampler", inputs: {
      model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0],
      seed, steps: STEPS, cfg: CFG, sampler_name: SAMPLER, scheduler: SCHED, denoise: 1.0 } },
    6: { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    7: { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "pwilhero" } },
  };
}

async function render(prompt, seed) {
  const r = await fetch(`${HOST}/prompt`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: graph(prompt, seed) }),
  });
  if (!r.ok) throw new Error(`queue ${r.status} ${await r.text()}`);
  const { prompt_id } = await r.json();
  for (let i = 0; i < 600; i++) {
    await new Promise((s) => setTimeout(s, 800));
    const h = await (await fetch(`${HOST}/history/${prompt_id}`)).json();
    const d = h[prompt_id];
    if (!d) continue;
    const img = d.outputs?.["7"]?.images?.[0];
    if (!img) throw new Error("no image");
    const v = new URL(`${HOST}/view`);
    v.searchParams.set("filename", img.filename);
    v.searchParams.set("subfolder", img.subfolder ?? "");
    v.searchParams.set("type", img.type ?? "output");
    return Buffer.from(await (await fetch(v)).arrayBuffer());
  }
  throw new Error("timeout");
}

let seed = 71_004_820;
for (const [key, scene] of Object.entries(SHOTS)) {
  if (only && key !== only) continue;
  for (let i = 1; i <= N; i++) {
    const buf = await render(`${scene}, ${STYLE}`, seed++);
    writeFileSync(join(OUT, `h-${key}-${i}.png`), buf);
    await sharp(buf).webp({ quality: 92 }).toFile(join(OUT, `h-${key}-${i}.webp`));
    console.error(`✦ h-${key}-${i}`);
  }
}
