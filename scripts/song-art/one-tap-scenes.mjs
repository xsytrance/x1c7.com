#!/usr/bin/env node
// ONE TAP AWAY — the same voice, finally in portrait.
//
// Unlike Still Me, this song's art was never the problem: it is already
// photoreal and well directed (a thumb over a lit phone, a red server
// corridor). It is 1152x832 LANDSCAPE, so `object-cover` into a 1080x1920
// frame throws away ~58% of every plate before the camera move eats more —
// playbook §17. These are the same pictures, shot portrait.
//
// The song is digital isolation: everyone reachable, nobody reached. So the
// rule for the set is a LIT SCREEN AND NO ONE LOOKING UP — the glow is always
// the brightest thing in frame, and whatever it lights is alone.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://127.0.0.1:8188";
const CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors";
const W = 832, H = 1472;                     // NATIVE PORTRAIT — never landscape
const OUT = join(HERE, "one-tap-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

// Palette off the planet: near-black #1A202C, slate #4A5568, violet #9F7AEA,
// amber #EAB308 — cold screen light against one warm sodium accent.
const STYLE = "cinematic photograph at night, shot on 35mm, shallow depth of field, film grain, cold blue-violet screen glow as the brightest light in frame, one warm amber accent far behind, deep near-black shadows, urban loneliness, muted colour, volumetric haze, no faces, no text";
const NEG = "face, faces, portrait, smiling, eye contact, readable letters, text, words, writing, signage, watermark, logo, caption, cartoon, illustration, painting, anime, comic, concept art, 3d render, cgi, oversaturated, bright daylight, cheerful, low quality, blurry, deformed, extra fingers";

const SCENES = [
  ["tap",          "a thumb hovering just above a glowing phone screen in a pitch dark room, rows of small app lights reflected on the skin"],
  ["alone",        "one seated silhouette at the far end of a long empty bar counter at night, a phone face-up glowing in front of them"],
  ["names",        "a phone held in the dark showing an endless scrolling contact list, hundreds of identical blurred rows, cold white glow"],
  ["reach",        "an open hand reaching up out of frame toward a ceiling of cold fluorescent light, dark room below"],
  ["strangers",    "a crowded late-night subway platform, every person lit only by their own phone screen, nobody looking at anybody"],
  ["fake",         "a ring light and tripod set up facing an empty unmade bed in a bedroom, nobody in the room, phone mounted and glowing"],
  ["pocket",       "a phone glowing through the fabric of a dark coat pocket, the light bleeding through the weave"],
  ["conversation", "two phones lying face-up and lit on a cafe table between two empty chairs at night"],
  ["room",         "a crowded house party seen from a dark doorway, violet light, every guest looking down at a phone"],
  ["connect",      "a tangle of charging cables on a dark floor, lit by a single phone screen lying among them"],
  ["forget",       "a cracked phone screen face-up on wet pavement at night, neon signs reflected in the fractures"],
  ["comments",     "a phone screen scrolling too fast to read in a dark room, motion-blurred light trails on the glass"],
  ["fire",         "a single candle flame reflected in the black mirror of a switched-off phone lying on a table"],
  ["stars",        "a high-rise window at night full of distant city lights, a phone on the sill glowing brighter than all of them"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 30, cfg: 6.0, sampler_name: "dpmpp_2m", scheduler: "karras", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "onetap" } },
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
    writeFileSync(join(OUT, `${word}.png`), Buffer.from(bin));
    log(`  ✓ ${word.padEnd(13)} ${(bin.byteLength / 1024).toFixed(0)}kb`);
    return;
  }
}

const only = process.argv.slice(2);
const list = only.length ? SCENES.filter(([w]) => only.includes(w)) : SCENES;
log(`${list.length} plates, ${W}x${H} portrait, ${CKPT}`);
for (const [word, scene] of list) await run(word, scene, Math.floor(Math.random() * 2 ** 31));
log("done");
