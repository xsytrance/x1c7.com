#!/usr/bin/env node
// DIFFERENT THIS SUMMER — the directed-cut scene pass (window 224.0–284.5).
// One painting per lyric line, each depicting THE SCENE being sung
// (illustrate-the-scene law). Brighter sunset voice than Summer Drip — coral/
// turquoise/gold, breezy optimism — same comic ink DNA. Fixed protagonists
// keep it one story: HIM (the builder) and THE CREW (the group-vocal women).

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const VARIANTS = 2;
const OUT = join(HERE, "dts-scenes-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const HIM = "a focused young Black man with short locs and headphones around his neck";
const CREW = "three joyful Black women singers in colorful summer dresses";
const STYLE = "vibrant dense comic book illustration, bold ink linework, halftone shading, warm coral orange turquoise and gold sunset palette, breezy summer optimism, golden hour glow, dynamic composition, no text, no watermark";
const NEG = "text, words, letters, watermark, logo, signature, caption, low quality, blurry, deformed hands, extra fingers, photorealistic, photograph";

const SCENES = [
  ["move", `${CREW} and ${HIM} striding forward together down a sunset boulevard, motion speed lines, palm trees, determined joy`],
  ["loading", `${HIM} at a glowing laptop in a dark room, a progress bar made of pure sunrise light filling across the screen, dawn breaking through the blinds`],
  ["door", `a heavy office door cracking open with brilliant golden light and streams of glowing code pouring through the gap, dark hallway behind`],
  ["official", `${HIM} standing on a rooftop at dusk as beams of light draw a glowing city skyline vision before him, blueprint made of stars`],
  ["sunshine", `${HIM} stepping out of a grey cubicle office straight onto a sunlit summer street, the grey world peeling away behind him, blinding warm sun ahead`],
  ["gear", `a frosty iced drink beside a brand new laptop and fresh headphones on a clean desk, sunset pouring through the window, condensation sparkling`],
  ["shoulders", `${CREW} on a rooftop at golden hour with warm sun rays landing on their shoulders, arms raised, city glowing behind`],
  ["game", `a giant glowing game board laid out across a beach at sunset, ${HIM} placing a golden piece, dice like dominoes, playful strategy`],
  ["build", `${HIM} and ${CREW} raising a glowing golden frame of a beach house together at sunset, scaffold of light, teamwork triumph`],
  ["pour", `a golden tropical drink being poured into a glass in extreme close up, sunset refracting through the pour, effervescent sparkle`],
  ["palm", `an open laptop on a beach lounge chair under two palm trees at sunset, turquoise waves, the dream office, no people`],
  ["working", `${HIM} typing on a laptop at the beach as the screen glow mixes with sunset glow on his face, calm confident smile, waves behind`],
  ["too", `a split scene: a grey tired silhouette walking away left while ${HIM} walks radiant into golden light on the right, transformation`],
  ["light", `${CREW} and ${HIM} as silhouettes on a dark beach watching the first light of sunrise crack the horizon, hopeful stillness`],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sddts" } },
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

let seed = 224_284;
for (const [word, scene] of SCENES) {
  for (let v = 1; v <= VARIANTS; v++) {
    log(`▶ ${word} v${v}`);
    const buf = await generate(`${scene}, ${STYLE}`, NEG, seed++);
    writeFileSync(join(OUT, `scene-${word}-v${v}.png`), buf);
  }
}
log("✦ scene pass done");
