#!/usr/bin/env node
// RED FLAGS FROM THE BEGINNING — widening art coverage so more words can open.
//
// The reveal (deck.reveal) only fires on a word that OWNS a plate. This song
// had 31 keyworded words out of ~570, so most of the cut had nothing to open
// into. These ten are the image-able words with real airtime inside the
// 137-167s window, chosen so the effect can land several times a verse.
//
// PORTRAIT, 832x1472. The song's existing 39 plates are all 1152x832 LANDSCAPE
// — playbook §17, "the 58% crop": object-cover into a 1080x1920 frame keeps
// only the centre ~42% of a landscape plate, which is why figures in this
// song's cuts sit half outside the frame. Every script in scripts/song-art/
// hard-codes the landscape pair; that is where the bug keeps coming from.
//
// No faces. §24: seeding people repeatedly returns the same person and the set
// goes monotonous — and this song's story is told by its rooms anyway.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://127.0.0.1:8188";
const CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors";
const W = 832, H = 1472;                     // NATIVE PORTRAIT — never landscape
const OUT = join(HERE, "red-flags-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

// The voice, read off the existing plates: cinematic photoreal domestic night
// interiors, warm tungsten practicals against cold green window light, lived-in
// clutter, a red accent somewhere, 35mm grain, shallow depth.
const STYLE = "cinematic photograph, cramped lived-in apartment at night, warm tungsten practical lamp against cold green-teal light through the window, one red accent in frame, heavy clutter, shallow depth of field, 35mm film grain, muted desaturated colour, naturalistic kitchen-sink realism, volumetric haze, no people, no text";
const NEG = "people, person, man, woman, face, hands, figure, silhouette, text, words, letters, writing, signage, readable letters, watermark, logo, caption, subtitle, cartoon, illustration, painting, anime, cgi, 3d render, oversaturated, bright daylight, clean, tidy, luxury, low quality, blurry, deformed";

const SCENES = [
  ["lie",      "a bedside drawer pulled half open in lamplight, a wedding ring pushed to the very back corner of it, the rest of the bedroom falling into darkness"],
  ["glow",     "a red neon bar sign outside bleeding through a rain-streaked bedroom window onto an empty unmade bed"],
  ["signs",    "a fridge door covered in unpaid bills and curling sticky notes held by magnets, one note peeling off, cold green kitchen light"],
  ["debt",     "a kitchen table buried in torn-open envelopes and a pocket calculator, a single bare tungsten bulb hanging low over it"],
  ["joke",     "a cracked bathroom mirror above a cluttered sink, reflecting an empty bedroom doorway behind, green light from the hall"],
  ["passion",  "a tangled bedsheet half off the mattress in warm lamplight, an overturned wine glass on the floorboards beside it"],
  ["disguise", "a heavy coat hanging on a hook by a front door, keys still left in the lock, dark narrow hallway, cold blue night through the door glass"],
  ["hurt",     "a chipped mug of cold tea forgotten on a windowsill, heavy rain running down the black glass at night"],
  ["proof",    "a phone lying face up on a kitchen counter lighting the ceiling, notification glow, the rest of the room dark and empty"],
  ["forget",   "a hallway wall of hanging picture frames at night, one frame taken down leaving a clean pale rectangle in the faded paint"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 30, cfg: 6.0, sampler_name: "dpmpp_2m", scheduler: "karras", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "redflags" } },
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
    log(`  ✓ ${word.padEnd(10)} ${(bin.byteLength / 1024).toFixed(0)}kb  ${path}`);
    return path;
  }
}

const only = process.argv.slice(2);
const list = only.length ? SCENES.filter(([w]) => only.includes(w)) : SCENES;
log(`${list.length} plates, ${W}x${H} portrait, ${CKPT}`);
for (const [word, scene] of list) {
  await run(word, scene, Math.floor(Math.random() * 2 ** 31));
}
log("done");
