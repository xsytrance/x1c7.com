#!/usr/bin/env node
// STILL ME: STILL YOU — a photoreal set to replace the illustrated plates.
//
// The song's existing art is 2D illustration and reads cheap at full frame
// under the lyrics. This is the same treatment Red Flags got: photoreal,
// NATIVE PORTRAIT 832x1472, one plate per word that actually means something.
//
// The song is long-distance love conducted by text message — two cities, one
// conversation, the gap between them. So the frame is nearly always an
// INTERIOR looking OUT, or a lit screen in a dark room: warm where the person
// is, cold where they are not. No people (§24: seeding figures repeatedly
// returns the same person and the set goes monotonous) — the absence is the
// subject here anyway, which is lucky.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://127.0.0.1:8188";
const CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors";
const W = 832, H = 1472;                     // NATIVE PORTRAIT — never landscape
const OUT = join(HERE, "still-me-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const STYLE = "cinematic photograph, night, shot on 35mm, shallow depth of field, film grain, city light through glass, warm tungsten interior against cold blue night, quiet and intimate, muted colour, volumetric haze, no people, no text";
const NEG = "people, person, man, woman, face, hands, figure, crowd, text, words, letters, writing, signage, readable letters, watermark, logo, caption, cartoon, illustration, painting, drawing, anime, manga, comic, concept art, 3d render, cgi, oversaturated, daylight, low quality, blurry, deformed";

const SCENES = [
  ["nights",   "the Manhattan skyline at night seen through a rain-flecked high-rise window from a dark room, city lights blurred in the water on the glass"],
  ["cold",     "a frosted apartment window at night with an old radiator beneath it, one small warm lamp reflected in the ice"],
  ["home",     "a front door standing slightly ajar, warm golden light spilling out into a dark narrow hallway"],
  ["miles",    "the window of an empty overnight train carriage, rain streaking sideways, distant town lights smeared in the dark"],
  ["heavy",    "an unmade bed at three in the morning lit only by a phone lying face down on the sheets, the rest of the room black"],
  ["calling",  "a phone resting on a pillow in a dark bedroom, its screen glowing with an active call, soft light on the creased linen"],
  ["building", "scaffolding around a half-finished high-rise at dusk, cranes above it, a city skyline going blue behind"],
  ["voice",    "a pair of earbuds left on a windowsill at night, the city out of focus in warm bokeh beyond the glass"],
  ["city",     "a wet avenue at night from street level, headlights and steam rising from a grate, reflections in the asphalt"],
  ["dreams",   "a dark bedroom ceiling with the moving light patterns of passing traffic thrown across it"],
  ["road",     "a long empty highway at first light seen through a windscreen, lane markings running to the horizon"],
  ["grow",     "a potted plant on a fire escape at sunrise, the city waking up behind it, first warm light on the leaves"],
  ["promise",  "two coffee mugs side by side on a windowsill in morning light, one of them untouched and long cold"],
  ["overtime", "a single office window still lit in a dark high-rise late at night, a desk lamp and a laptop glow inside"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 30, cfg: 6.0, sampler_name: "dpmpp_2m", scheduler: "karras", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "stillme" } },
  };
}

async function run(word, scene, seed) {
  const prompt = `${scene}, ${STYLE}`;
  if (prompt.length > 900) log(`  ! ${word}: prompt ${prompt.length} chars (>900 silently returns a black plate, §12a)`);
  const r = await fetch(`${HOST}/prompt`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: graph(prompt, NEG, seed) }),
  });
  const { prompt_id } = await r.json();
  for (;;) {
    await new Promise((s) => setTimeout(s, 1500));
    const h = await (await fetch(`${HOST}/history/${prompt_id}`)).json();
    const done = h[prompt_id];
    if (!done) continue;
    const img = done.outputs?.["7"]?.images?.[0];
    if (!img) throw new Error(`${word}: no image in history`);
    const bin = await (await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder ?? "")}&type=${img.type}`)).arrayBuffer();
    const path = join(OUT, `${word}.png`);
    writeFileSync(path, Buffer.from(bin));
    log(`  ✓ ${word.padEnd(10)} ${(bin.byteLength / 1024).toFixed(0)}kb`);
    return path;
  }
}

const only = process.argv.slice(2);
const list = only.length ? SCENES.filter(([w]) => only.includes(w)) : SCENES;
log(`${list.length} plates, ${W}x${H} portrait, ${CKPT}`);
for (const [word, scene] of list) await run(word, scene, Math.floor(Math.random() * 2 ** 31));
log("done");
