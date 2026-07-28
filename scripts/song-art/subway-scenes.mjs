#!/usr/bin/env node
// BETWEEN THE STATIONS — the "subway" planet of the NYC Nebula.
// Voice: CEL-SHADED NYC subway (flat vivid colors, bold line art, anime
// background energy, MTA line colors, graffiti accents). Owner's imagery
// list: real trains (1/7/E/F/N/Q/R/4/5/6), above+underground stations,
// borough shoutouts, bodega bacon-egg-n-cheese + Newports + vapes, cream
// cheese bagel, crosswalks, turnstiles, subway lamps.
// Nine keyword scenes (sung-word anchors ≥1s apart) + four section scenes.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const OUT = join(HERE, "subway-scenes-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const STYLE = "cel-shaded illustration, flat vivid colors with bold clean outlines, anime background art style, NYC subway atmosphere, MTA line colors (red purple blue orange yellow green accents), subtle graffiti tags, cinematic urban lighting, crisp, no watermark";
const NEG = "photorealistic, photograph, 3d render, blurry, low quality, watermark, logo, deformed faces, crowd of people, extra limbs, muted colors";

const SCENES = [
  // keyword scenes (anchor word → art)
  ["brooklyn", "a yellow N train with a round yellow line bullet crossing the Manhattan Bridge toward rows of Brooklyn brownstones at golden hour, East River below"],
  ["steam", "a Manhattan avenue at dawn, white steam rising from an orange-and-white striped manhole stack, skyscrapers behind, a yellow cab crossing zebra crosswalk stripes"],
  ["roses", "a bouquet of red roses lying on an empty orange-and-tan subway bench seat inside a graffiti-tagged train car, fluorescent light"],
  ["pain", "a lone silhouetted busker playing guitar under the arched cream tile of a dim underground subway station, open guitar case, one warm platform lamp"],
  ["signs", "black subway station signs hanging from a white tiled ceiling with colorful round line bullets — red 1, purple 7, green 4 5 6, yellow N Q R — uptown and downtown arrows"],
  ["time", "an empty underground platform at night, round green-and-white subway lamps glowing along the edge, a wooden bench and a station clock, long shadows"],
  ["cars", "view through the end-door windows between two moving subway cars, chained gates, tunnel lights streaking past in the dark, silver steel doors"],
  ["daylight", "a purple 7 train bursting out of a dark tunnel portal into bright daylight on elevated steel tracks above Queens, graffiti covering the retaining walls"],
  ["lights", "perspective straight down a dark subway tunnel, rows of small warm lamps glowing into the distance, red and green signal lights, steel rails catching the glow"],
  // section scenes (ambient emotion art)
  ["turnstile", "a row of steel subway turnstiles with a token booth behind them, cream tile walls with a colorful mosaic stripe, warm morning light slanting in"],
  ["bodega", "a bodega deli counter at night: a foil-wrapped bacon egg and cheese sandwich, a blue-and-white Greek coffee cup, a green cigarette pack and a small colorful vape on the counter, glowing fridge doors behind"],
  ["bagel", "an everything bagel piled with thick cream cheese on wax paper next to coffee, on a bodega window counter, an elevated train passing outside the window"],
  ["crosswalk", "looking straight down at a NYC crosswalk, bold white zebra stripes on dark asphalt, two long pedestrian shadows, the roof of one yellow cab clipping the corner"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdsubway" } },
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

let seed = 90_120_600;
for (const [word, scene] of SCENES) {
  for (let v = 1; v <= 3; v++) {
    log(`▶ ${word} v${v}`);
    const buf = await generate(`${scene}, ${STYLE}`, NEG, seed++);
    writeFileSync(join(OUT, `sub-${word}-v${v}.png`), buf);
  }
}
log("✦ subway pass done");
