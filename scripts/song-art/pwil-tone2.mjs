#!/usr/bin/env node
// PRETTY WHEN I LIE — tone-setter, pass 2.
//
// Pass 1 failed the brand: lightning-LoRA at cfg 1.5 gave soft, naturalistic,
// evenly-lit indie-film stills. Tyler's covers are the opposite — glossy,
// high-contrast, hard rim light, teal-and-amber grade with one crimson accent,
// shot like a record sleeve rather than a scene. Full Juggernaut at cfg 6.5 /
// 30 steps buys back the prompt adherence the LoRA was trading away.
//
// Two directions, both drawn from his own artwork:
//   A · THE ROOM   — 3am aftermath, him read from behind/obscured (the way
//                    "Storms In November" and the bar shot read him)
//   B · THE EVIDENCE — the flat-lay language of this song's OWN Suno cover:
//                    polaroids, handwritten notes, pills, bullet lipstick,
//                    dead rose, spilled whiskey. No face to keep consistent.
//
// Usage: node scripts/song-art/pwil-tone2.mjs [--only A|B] [--n 4]

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
const STEPS = 30, CFG = 6.5, SAMPLER = "dpmpp_2m", SCHED = "karras";

const STYLE = "professional album cover photography, photorealistic, cinematic, "
  + "hard rim lighting, high contrast, deep crushed blacks, glossy commercial finish, "
  + "teal and amber colour grade, one crimson red accent, volumetric haze, "
  + "shallow depth of field, 35mm film grain, dramatic, high production value, moody nocturnal";

const NEG = "empty table, sparse, minimal, clean, tidy, studio product photography, softbox, "
  + "1940s, old hollywood, antique portrait of a woman, fresh red roses in bloom, rose bouquet, "
  + "cartoon, anime, illustration, cgi, 3d render, flat lighting, daylight, washed out, "
  + "low contrast, amateur, watermark, logo, signature, low quality, blurry, oversaturated";

const DIRECTIONS = {
  // "Three in the morning, your dress on the floor / You know where I've been
  // but you still lock the door."
  A: "shot from behind and above, a young man sitting hunched on the edge of an unmade bed "
    + "in a dark hotel room at 3am, face completely hidden, only the back of his head and "
    + "shoulder visible, messy dark shaggy hair, black t-shirt, heavily tattooed arms, "
    + "layered silver chain necklaces, a woman's black dress crumpled on the carpet, "
    + "a phone lying face-up on the floor glowing cold blue with an incoming call, "
    + "a tipped-over whiskey glass and scattered white pills on the nightstand, "
    + "a single amber lamp raking across him, red neon bleeding through the curtain gap",
  // The flat-lay language of the song's own cover.
  B: "overhead flat lay, a dark wooden table completely covered edge to edge with the "
    + "evidence of a bad night, many overlapping instant photo prints with thick white borders "
    + "showing dim blurred nightclub and dark bedroom moments, "
    + "torn scraps of paper covered in looping black handwritten marker scrawl, "
    + "spilled white pills, a worn brass bullet lipstick tube, "
    + "one wilted dead rose with dark dried curling petals, "
    + "a heavy whiskey tumbler with a smeared crimson lipstick print on the rim, "
    + "a tangled silver chain, a cracked phone lying face down, a hotel keycard, "
    + "warm amber lamplight raking in from one side, deep shadow in the corners, "
    + "dense cluttered layered composition, rich sepia brown and charcoal with crimson accents",
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
    7: { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "pwil2" } },
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

let seed = 20_260_727;
for (const [key, scene] of Object.entries(DIRECTIONS)) {
  if (only && key !== only) continue;
  for (let i = 1; i <= N; i++) {
    const t0 = Date.now();
    const buf = await render(`${scene}, ${STYLE}`, seed++);
    writeFileSync(join(OUT, `${key}-${i}.png`), buf);
    await sharp(buf).webp({ quality: 92 }).toFile(join(OUT, `${key}-${i}.webp`));
    console.error(`✦ ${key}-${i}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}
