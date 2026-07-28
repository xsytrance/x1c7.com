#!/usr/bin/env node
// Re-roll for the keys where the psychedelic pass collapsed into ornament.
//
// The first pass carried "kaleidoscopic fractal symmetry" + "symbolic still
// life" in the shared STYLE, and DreamShaper obeyed the style over the subject:
// 9 of 25 scenes came back as a generic radial mandala with no trace of the
// lyric. This pass keeps the palette and the blacklight ink but drops every
// symmetry cue, negative-prompts the ornament away, and raises cfg/steps so the
// noun in the prompt survives. Composition cues are deliberately off-centre —
// 25 centred roundels in a row reads as wallpaper, not as cut footage.
//
// Usage: node scripts/song-art/ute-psy-reroll.mjs [--only <key>] [--variants 2]

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "ute-psy-out");
mkdirSync(OUT, { recursive: true });

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
  return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const VARIANTS = Math.max(1, parseInt(args.variants ?? "2", 10));
const W = 1152, H = 832;
const log = (...a) => console.error(...a);

const CKPT = "DreamShaperXL_Turbo_v2_1.safetensors";
const STEPS = 9, CFG = 3.5, SAMPLER = "dpmpp_sde", SCHED = "karras";

// Same world, no symmetry instruction.
const STYLE = "psychedelic blacklight poster illustration, 1970s liquid light show, "
  + "fluorescent ink glowing on deep black, oil-wheel projection colour, "
  + "acid magenta electric cyan ultraviolet and toxic green, halation glow, "
  + "visionary poster art, intricate linework, high contrast, no people";
// Everything the first pass drifted into.
const NEG = "mandala, kaleidoscope, radial symmetry, symmetrical ornament, doily, rosette, "
  + "concentric circles, circular frame, medallion, wallpaper pattern, "
  + "person, people, face, faces, portrait, man, woman, body, hands, fingers, "
  + "text, words, letters, watermark, logo, signature, photograph, "
  + "muted, desaturated, washed out, low quality, blurry, frame, border, white edge, white band, paper edge, canvas edge, statue, sculpture, skeleton, silhouette, figure";

// Subject first and stated plainly, with an off-centre composition cue.
const SCENES = [
  ["addiction", "a huge serpent coiled around a doorway, its body wrapping the frame, scales glowing, seen from below at an angle"],
  ["bridge", "a long suspension bridge burning in heavy rain at night, flames along the deck, reflections streaking the water below, wide angle from the riverbank"],
  ["building", "a skyline of tall luminous crystal towers under construction, scaffolding and cranes, rising out of glowing liquid, low angle"],
  ["door", "a single wooden door standing ajar in an empty dark room, brilliant light pouring out through the gap across the floor, three-quarter view"],
  ["earned", "a golden trophy cup tipped over on a table, melting and running into a bright puddle, side view, dramatic light"],
  // "joker" summons the Batman character — a person, which this planet never
  // shows. Name the object, not the archetype.
  ["joke", "a single playing card tumbling end over end through empty black air, bending as it falls, bright motion streaks trailing behind it"],
  // First roll put a white canvas edge across the top of the frame; pinning the
  // background to black and negating the paper edge clears it.
  ["money", "a scattered heap of banknotes burning on a dark floor, orange flames and rising embers, deep black background filling the frame, close three-quarter view"],
  ["myself", "a tall shattered mirror leaning against a wall, cracks spreading across it, each shard reflecting a different colour, angled view"],
  // Gothic "archways" came back populated with carved figures and skeletons.
  ["sometimes", "a long empty tunnel of plain repeating concrete arches receding into darkness, each arch rimmed in a different colour of light, bare walls, one-point perspective"],
];

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
    7: { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "utepsy2" } },
  };
}

async function render(prompt, seed) {
  const r = await fetch(`${HOST}/prompt`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: graph(prompt, seed) }),
  });
  if (!r.ok) throw new Error(`queue ${r.status} ${await r.text()}`);
  const { prompt_id } = await r.json();
  for (let i = 0; i < 300; i++) {
    await new Promise((s) => setTimeout(s, 800));
    const h = await (await fetch(`${HOST}/history/${prompt_id}`)).json();
    const done = h[prompt_id];
    if (!done) continue;
    const img = done.outputs?.["7"]?.images?.[0];
    if (!img) throw new Error("no image in history");
    const v = new URL(`${HOST}/view`);
    v.searchParams.set("filename", img.filename);
    v.searchParams.set("subfolder", img.subfolder ?? "");
    v.searchParams.set("type", img.type ?? "output");
    return Buffer.from(await (await fetch(v)).arrayBuffer());
  }
  throw new Error("timed out waiting for ComfyUI");
}

const todo = args.only && args.only !== true ? SCENES.filter(([k]) => k === args.only) : SCENES;
let seed = 63_220_711;
for (const [key, scene] of todo) {
  for (let v = 1; v <= VARIANTS; v++) {
    const name = v === 1 ? `psy-${key}` : `psy-${key}-${v}`;
    const t0 = Date.now();
    const buf = await render(`${scene}, ${STYLE}`, seed++);
    writeFileSync(join(OUT, `${name}.png`), buf);
    await sharp(buf).webp({ quality: 90 }).toFile(join(OUT, `${name}.webp`));
    log(`✦ ${name}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}
log("\nre-roll done");
