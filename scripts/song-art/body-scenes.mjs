#!/usr/bin/env node
// SAY IT WITH YOUR BODY — the directed-cut scene pass (window 184.0–214.5).
// Voice: long-exposure LIGHT PAINTING — silhouetted dancers whose motion draws
// ribbons of light through blackness. The body as language, literally drawn.
// Sixth distinct voice (own-planet law).

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const OUT = join(HERE, "body-scenes-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const STYLE = "long-exposure light painting photography, silhouetted dancers, luminous ribbons of light tracing every motion, deep black studio void, gold cyan and magenta light trails, elegant sensual movement, subtle film grain, cinematic, no text, no watermark";
const NEG = "text, words, letters, watermark, logo, signature, caption, comic, pixel art, anime, oil painting, daylight, cluttered background, nudity, low quality, blurry";

const SCENES = [
  ["brooklyn", "four distant dancing silhouettes on a dark world horizon of faint city skylines — a bridge, tropical towers, a lagoon city, river lights — their light trails arcing up and converging into one glowing ribbon across the sky"],
  ["heartbeat", "a dancer's hand drawing a glowing heartbeat pulse line in the air, red-gold ECG trail hanging in blackness, her silhouette barely lit"],
  ["slowly", "two silhouettes slow-dancing cheek to cheek, their circling motion drawn as intertwined ribbons of cyan and magenta light wrapping around them"],
  ["hold", "two light-trail figures merging into a single embrace, their separate gold and cyan ribbons braiding into one column of light"],
  ["feel", "a hand reaching through darkness toward another hand, fingertips trailing a stream of glowing particles between them, almost touching"],
  ["body", "a dancer mid-leap, entire body outlined in flowing white-gold light ribbons, motion echoes fanning behind her, pure black void"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdbody" } },
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

let seed = 184_214;
for (const [word, scene] of SCENES) {
  for (let v = 1; v <= 2; v++) {
    log(`▶ ${word} v${v}`);
    const buf = await generate(`${scene}, ${STYLE}`, NEG, seed++);
    writeFileSync(join(OUT, `scene-${word}-v${v}.png`), buf);
  }
}
log("✦ scene pass done");
