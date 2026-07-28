#!/usr/bin/env node
// I WON'T BE YOUR FIRE — FIRE REEL art set. 59s 9:16 cut, window 187.2 → 246.2.
//
// Direction comes from the owner's own FIRE REEL storyboards, not from me:
//   · visual style stated on the board as ANIME / REALISTIC HYBRID, 24fps,
//     ember FX + motion blur + depth of field
//   · present-tense STAGE performance intercut with MEMORIES —
//     the argument in the rain, the cold distance, the golden carnival
//   · arc: connection → rupture → desolation → focus → hope → fire
//   · palette: ember orange + deep black on stage, cool blue rain-city for the
//     memories, gold for the carnival
//
// HARD RULE: no faces, anywhere. Every shot is a rear view, a silhouette, a
// crop (hands, guitar neck, boots, mic stand), or an object. That is the
// owner's call, and it also means the lead reads as the same person in every
// frame — nothing that could drift is ever on screen.
//
// Portrait 832x1216: the deliverable is 9:16 only.
//
// Usage: node scripts/song-art/firereel-scenes.mjs [--only <key>] [--variants 2]

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "firereel-out");
mkdirSync(OUT, { recursive: true });
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
  return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const VARIANTS = Math.max(1, parseInt(args.variants ?? "2", 10));
const W = 832, H = 1216;

// DreamShaper holds the anime/realistic hybrid far better than Animagine, which
// collapsed both style-probe prompts into abstract noise.
const CKPT = "DreamShaperXL_Turbo_v2_1.safetensors";
const STEPS = 9, CFG = 3.5, SAMPLER = "dpmpp_sde", SCHED = "karras";

const STYLE = "anime realistic hybrid, cinematic digital painting, detailed illustration, "
  + "warm ember orange and deep black, floating embers and sparks, volumetric stage haze, "
  + "strong rim light, motion blur, shallow depth of field, high contrast, "
  + "dramatic concert lighting, 2.39 cinematic grade";

// The whole identity problem, solved by never showing it.
const NEG = "face, facial features, eyes, nose, mouth, portrait, looking at camera, "
  + "head on view of a person, detailed skin, nude, naked, "
  + "text, words, letters, watermark, logo, signature, "
  + "photograph, 3d render, cgi, bright, daylight, flat lighting, washed out, "
  + "extra limbs, extra fingers, deformed hands, bad anatomy, low quality, blurry";

// key = the sung word the painting lands on. Comment = the line it carries.
const SCENES = [
  // "Say you hate me / say you're done" — the ARGUMENT MEMORY
  ["hate", "two figures standing apart on a rain-lashed city street at night seen from behind, backs to camera, cold blue rain and distant warm orange streetlight, wet reflections, neon city bokeh"],
  // "I'm saying no" — the refusal
  ["saying", "extreme close up of a hand gripping a microphone stand tightly, knuckles tense, warm ember light raking across, black background, embers drifting"],
  // "because I love you enough" — back to the stage
  ["love", "wide shot of a lone long-haired figure in a studded leather jacket standing at a mic stand on a dark concert stage, seen from behind, orange spotlight beams cutting down through haze, drum kit behind, crowd in silhouette"],
  // "not to become another wound"
  ["wound", "extreme close up of an electric guitar neck, a snapped string curling loose, sparks and embers scattering off the fretboard, warm orange rim light, black"],
  // "I can miss you and still not answer"
  ["answer", "a phone lying face up glowing cold blue on a dark table beside a rain-streaked window at night, warm orange city light beyond the glass, no one there"],
  // "I can pray that you'll find daylight"
  ["daylight", "first pale dawn breaking over a wet city skyline seen through a rain-streaked window, cool blue turning to thin warm gold at the horizon"],
  // "without becoming your moon"
  ["moon", "a pale moon veiled behind drifting stage smoke above dark steel lighting rigs, cold light, embers rising toward it"],
  // "I can hold all the good parts" — the CARNIVAL MEMORY
  ["parts", "a golden lit fairground at night, ferris wheel and string lights glowing warm, heavy bokeh, two small figures walking away from camera hand in hand, dreamy soft focus"],
  // "and still bury the blade"
  ["blade", "a single guitar pick and a broken string lying on a wet dark stage floor, orange stage light reflected in the water, boots stepping away out of frame"],
  // "I can remember your soft voice"
  ["voice", "a vintage microphone alone in a single warm spotlight on an empty dark stage, thick haze, dust and embers floating in the beam, nobody there"],
  // "without entering the cage"
  ["cage", "silhouetted steel stage scaffolding and truss bars forming a cage of hard vertical lines, blazing orange light burning through the gaps from behind"],
  // "I can cry for the old days"
  ["cry", "rain running heavily down a black window pane with warm orange stage light smeared and distorted through the droplets, cold blue edges"],
  // "for the old us"
  ["us", "two silhouettes standing back to back on a wet rooftop at night, city lights below, one of them breaking apart into embers and blowing away"],
  // "another night"  — the owner's own reference frame
  ["night", "extreme close up of a single raindrop crown splashing on wet black asphalt, concentric ripples, warm orange stage light shattered across the water, embers glowing, shallow depth of field"],
  // "the worst thing I say becomes true"
  ["true", "grey ash and dying embers falling like snow over a dark empty stage, abandoned drum kit in shadow, one work light"],
  // "I WON'T BE YOUR FIRE" — the peak
  ["fire", "towering columns of fire erupting from both ends of a concert stage, a lone long-haired figure in silhouette between them with arms down, crowd hands raised in black silhouette, blazing orange and red"],
  // "just because you miss the burn"
  ["burn", "extreme close up of flames and heat shimmer, thick ember particles streaming upward through black air, out of focus orange glow"],
  // "I won't say the sharp words"
  ["words", "sparks exploding sideways off a crash cymbal in motion blur, drumstick caught mid strike, warm orange against deep black"],
];

const SECTIONS = [
  ["sec-desperate", "a rain-soaked empty city street at night, cold blue, one distant warm orange streetlamp, wet asphalt reflections, heavy rain"],
  ["sec-despairing", "an empty dark concert stage after the show, abandoned instruments, thick smoke, one cold work light, ash on the floor"],
  ["sec-defiant", "a long-haired figure in a studded leather jacket standing tall in full silhouette at a mic stand, back to camera, a wall of fire blazing behind, embers streaming past"],
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
    7: { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "firereel" } },
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

const ALL = [...SCENES, ...SECTIONS];
const todo = args.only && args.only !== true ? ALL.filter(([k]) => k === args.only) : ALL;
if (!todo.length) { console.error(`no such key: ${args.only}`); process.exit(1); }

let seed = 31_415_926;
let made = 0;
for (const [key, scene] of todo) {
  for (let v = 1; v <= VARIANTS; v++) {
    const name = v === 1 ? `fr-${key}` : `fr-${key}-${v}`;
    const webp = join(OUT, `${name}.webp`);
    if (existsSync(webp) && !args.force) { seed++; continue; }
    const buf = await render(`${scene}, ${STYLE}`, seed++);
    writeFileSync(join(OUT, `${name}.png`), buf);
    await sharp(buf).webp({ quality: 92 }).toFile(webp);
    made++;
    console.error(`✦ ${name}`);
  }
}
console.error(`\n${made} made → ${OUT}`);
