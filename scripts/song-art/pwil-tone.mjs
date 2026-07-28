#!/usr/bin/env node
// PRETTY WHEN I LIE — tone-setter candidates.
//
// Tyler Haze is his own planet. This is NOT a rebrand: the look is lifted from
// his own existing artwork (R2 tyler-haze/gallery/, and this song's own Suno
// cover), which is remarkably consistent —
//   · photoreal cinematic album-cover craft, deep blacks, hard rim light
//   · warm amber / sepia practicals against cold indigo night, ONE crimson accent
//   · the aftermath, not the party: dive bars, 3am rooms, wet streets, spilled glasses
//   · him read obliquely — head down, turned away, hand over the face, silhouette
//   · tattoos (face, neck, sleeves), layered silver chains, all black, messy dark shag
//
// The face is deliberately never the subject. That is how half his own covers
// are shot, AND it is the only honest way to keep one persona consistent across
// a couple of dozen generated frames.
//
// Portrait 832x1216 because the deliverable is 9:16 ONLY — landscape art in a
// portrait frame throws away most of the composition to object-cover.
//
// Usage: node scripts/song-art/pwil-tone.mjs [--n 6]

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "pwil-out");
mkdirSync(OUT, { recursive: true });
const HOST = "http://localhost:8188";
const W = 832, H = 1216;
const N = Number(process.argv.includes("--n") ? process.argv[process.argv.indexOf("--n") + 1] : 6);

// Juggernaut XL is the photoreal checkpoint in the roster — DreamShaper and
// SDXL Turbo both drift illustrative, which would read as a rebrand.
const CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors";
const LORA = "sdxl_lightning_8step_lora.safetensors";
const STEPS = 8, CFG = 1.5, SAMPLER = "euler", SCHED = "sgm_uniform";

const STYLE = "cinematic album cover photography, photoreal, dramatic chiaroscuro, "
  + "warm amber practical lamp light against cold indigo night, deep crushed blacks, "
  + "single crimson accent, shallow depth of field, 35mm film grain, moody, high production value";
const NEG = "face, facing camera, eye contact, portrait, smiling, bright, daylight, flat lighting, "
  + "cartoon, anime, illustration, cgi, 3d render, text, words, letters, watermark, logo, signature, "
  + "extra limbs, deformed hands, duplicate person, crowd, low quality, blurry, oversaturated";

// The song's thesis line: "Three in the morning, your dress on the floor /
// You know where I've been but you still lock the door."
const SCENE = "a young man sitting on the edge of an unmade bed in a dark hotel room at 3am, "
  + "seen from behind and slightly to the side, head down, elbows on knees, face hidden in shadow, "
  + "messy dark shaggy hair, black clothing, tattooed forearms, layered silver chain necklaces, "
  + "a woman's black dress crumpled on the carpet beside him, "
  + "a phone face-up on the floor glowing with an incoming call, "
  + "an empty glass and scattered pills on the nightstand, "
  + "one amber lamp, cold blue city light through a gap in the curtains";

function graph(seed) {
  return {
    1: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    8: { class_type: "LoraLoader", inputs: { model: ["1", 0], clip: ["1", 1], lora_name: LORA, strength_model: 1, strength_clip: 1 } },
    2: { class_type: "CLIPTextEncode", inputs: { clip: ["8", 1], text: `${SCENE}, ${STYLE}` } },
    3: { class_type: "CLIPTextEncode", inputs: { clip: ["8", 1], text: NEG } },
    4: { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    5: { class_type: "KSampler", inputs: {
      model: ["8", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0],
      seed, steps: STEPS, cfg: CFG, sampler_name: SAMPLER, scheduler: SCHED, denoise: 1.0 } },
    6: { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    7: { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "pwil" } },
  };
}

async function render(seed) {
  const r = await fetch(`${HOST}/prompt`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: graph(seed) }),
  });
  if (!r.ok) throw new Error(`queue ${r.status} ${await r.text()}`);
  const { prompt_id } = await r.json();
  for (let i = 0; i < 300; i++) {
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

let seed = 88_150_223;
for (let i = 1; i <= N; i++) {
  const buf = await render(seed++);
  writeFileSync(join(OUT, `tone-${i}.png`), buf);
  await sharp(buf).webp({ quality: 92 }).toFile(join(OUT, `tone-${i}.webp`));
  console.error(`✦ tone-${i}`);
}
