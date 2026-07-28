#!/usr/bin/env node
// FIRE REEL / ARIA — style probe.
//
// The owner supplied the real direction for "I Won't Be Your Fire": an ANIMATED
// music video ("FIRE REEL") with a named lead character, ARIA — long wavy light
// hair, black rocker outfit, guitar — shot on a hazy stage in ember orange, plus
// rain-on-asphalt and ember-particle inserts. Semi-realistic painterly anime,
// NOT the photoreal silhouettes of the previous pass.
//
// This probe only answers one question: which checkpoint gets closest to that
// rendering? animagine (pure anime) vs dreamshaper (semi-real painterly).
// Two subjects x two models, so the look can be judged before any set is built.
//
// Usage: node scripts/song-art/aria-style-test.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "aria-out");
mkdirSync(OUT, { recursive: true });
const HOST = "http://localhost:8188";
const W = 832, H = 1216;

// ARIA's identity has to be stated the same way every time or she drifts.
const ARIA = "a young woman with very long wavy light golden-blonde hair, "
  + "black studded leather jacket over a black top, black choker, "
  + "holding an electric guitar";

const LOOKS = {
  animagine: {
    ckpt: "animagine-xl-4.0-opt.safetensors",
    lora: "sdxl_lightning_8step_lora.safetensors",
    steps: 8, cfg: 1.5, sampler: "euler", sched: "sgm_uniform",
    style: "anime illustration, detailed painterly rendering, cinematic lighting, "
      + "warm ember orange glow, deep black background, floating embers and sparks, "
      + "stage haze, rim light, high contrast, dramatic",
  },
  dreamshaper: {
    ckpt: "DreamShaperXL_Turbo_v2_1.safetensors",
    lora: null,
    steps: 8, cfg: 2.5, sampler: "dpmpp_sde", sched: "karras",
    style: "semi-realistic anime painterly illustration, digital painting, "
      + "cinematic lighting, warm ember orange glow, deep black background, "
      + "floating embers and sparks, stage haze, rim light, high contrast, dramatic",
  },
};

const SUBJECTS = {
  // Storyboard beat 2: "she steps in, grabs the mic" — the intro Juan preferred.
  stage: `${ARIA}, standing alone at a microphone stand on a dark concert stage, `
    + "seen from behind and to the side, warm orange spotlight beams cutting down through haze, "
    + "drum kit behind her, crowd in silhouette, embers drifting, wide shot",
  // The rain/ember insert.
  rain: "a single raindrop crown splashing on wet black asphalt at night, "
    + "concentric ripples, warm orange stage light reflected and shattered across the water, "
    + "embers glowing, extreme close up, shallow depth of field",
};

const NEG = "photograph, photorealistic, 3d render, cgi, bright, daylight, flat lighting, "
  + "washed out, low contrast, text, watermark, logo, signature, "
  + "extra limbs, extra fingers, deformed hands, bad anatomy, low quality, blurry";

function graph(look, prompt, seed) {
  const g = {
    1: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: look.ckpt } },
    4: { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    6: { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    7: { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "aria" } },
  };
  const modelSrc = look.lora ? ["8", 0] : ["1", 0];
  const clipSrc = look.lora ? ["8", 1] : ["1", 1];
  if (look.lora) {
    g[8] = { class_type: "LoraLoader", inputs: { model: ["1", 0], clip: ["1", 1], lora_name: look.lora, strength_model: 1, strength_clip: 1 } };
  }
  g[2] = { class_type: "CLIPTextEncode", inputs: { clip: clipSrc, text: prompt } };
  g[3] = { class_type: "CLIPTextEncode", inputs: { clip: clipSrc, text: NEG } };
  g[5] = { class_type: "KSampler", inputs: {
    model: modelSrc, positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0],
    seed, steps: look.steps, cfg: look.cfg, sampler_name: look.sampler, scheduler: look.sched, denoise: 1.0 } };
  return g;
}

async function render(look, prompt, seed) {
  const r = await fetch(`${HOST}/prompt`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: graph(look, prompt, seed) }),
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

let seed = 55_120_808;
for (const [lookName, look] of Object.entries(LOOKS)) {
  for (const [subjName, subj] of Object.entries(SUBJECTS)) {
    const buf = await render(look, `${subj}, ${look.style}`, seed++);
    const name = `${lookName}-${subjName}`;
    writeFileSync(join(OUT, `${name}.png`), buf);
    await sharp(buf).webp({ quality: 92 }).toFile(join(OUT, `${name}.webp`));
    console.error(`✦ ${name}`);
  }
}
