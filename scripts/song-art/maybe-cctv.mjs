#!/usr/bin/env node
// MAYBE WAS THE ANSWER — style sample pass #3. Riso rejected, charcoal rejected.
// Candidate voice: CCTV SURVEILLANCE — modern urban spaces seen through a
// security camera. Fisheye distortion, sensor grain, scanlines, IR cast,
// blown highlights, compression artifacts.
//
// OWNER CONSTRAINT (hard): NO people, NO faces, NO heads, NO hands. Abstract
// imagery only — architecture, geometry, light. The song's dread comes from
// the empty room being watched, not from anyone in it.
//
//   node scripts/song-art/maybe-cctv.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const OUT = join(HERE, "maybe-cctv-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const STYLE = "CCTV security camera still frame, wide-angle fisheye lens distortion, heavy sensor noise and video grain, horizontal scanline interference, low-bitrate compression artifacts, blown-out highlights and crushed blacks, cold desaturated teal and sodium-amber palette, harsh vignette, night surveillance footage, modern architecture, geometric composition";

// Hands and figures are hard-negated — the whole point of this voice.
const NEG = "person, people, human, figure, silhouette, body, hand, hands, arm, finger, face, head, portrait, eyes, crowd, animal, " +
  "text, words, letters, numbers, timestamp, watermark, logo, signature, caption, " +
  "illustration, drawing, painting, charcoal, sketch, anime, comic, warm cozy lighting, daylight, sunny, low quality, blurry";

// Four abstract urban spaces spanning the song's arc.
const SCENES = [
  ["tower",     "the glass facade of a modern apartment tower at night, a grid of lit and unlit windows receding upward, seen from a camera across the street, geometric and cold"],
  ["garage",    "an empty underground concrete parking garage at night, one car parked alone under a harsh overhead light, long rows of empty bays, painted floor lines receding"],
  ["corridor",  "an empty modern apartment corridor at night, identical doors receding to a vanishing point, infrared night vision cast, one door slightly ajar with light spilling out"],
  ["crossing",  "an empty city intersection at night seen from a high pole-mounted camera looking down, wet asphalt, painted crosswalk stripes, streetlight bloom, no traffic"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdcctv" } },
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
let seed = 24_071_26;
for (const [key, scene] of SCENES) {
  for (let v = 1; v <= VARIANTS; v++) {
    log(`▶ ${key} c${v}`);
    writeFileSync(join(OUT, `cctv-${key}-c${v}.png`), await generate(`${scene}, ${STYLE}`, NEG, seed++));
  }
}
log("✦ cctv sample pass done");
