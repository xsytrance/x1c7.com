#!/usr/bin/env node
// I WON'T BE YOUR FIRE — the 59s cut (187.2 → 246.2), 9:16.
//
// Own planet: EMBER SILHOUETTE. Deep charcoal, one backlit figure against
// firelight, embers drifting up, ember-orange against cold blue-grey ash.
// Nobody's face is ever shown — silhouettes, rear views, hands, objects. That
// is what the song is (a person choosing not to be somebody's fire) and it
// keeps the frame universal: the viewer puts themselves in the silhouette.
//
// EVERY scene illustrates a whole sung SENTENCE, not the heavy word in it.
// "I can hold all the good parts and still bury the blade" is not a knife —
// it is hands cupping embers while the other hand buries something in ash.
// The comment above each entry is the line it has to carry.
//
// Portrait 832x1216 — the deliverable is 9:16 only, so the art is composed
// vertically instead of being centre-cropped out of a landscape frame.
//
// Usage: node scripts/song-art/fire-scenes.mjs [--only <key>] [--variants 2]

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "fire-out");
mkdirSync(OUT, { recursive: true });
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
  return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const VARIANTS = Math.max(1, parseInt(args.variants ?? "2", 10));
const W = 832, H = 1216;

const CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors";
const STEPS = 30, CFG = 6.5, SAMPLER = "dpmpp_2m", SCHED = "karras";

const STYLE = "cinematic silhouette photography, dark figure backlit by firelight, "
  + "deep charcoal blacks, glowing orange embers drifting through the air, "
  + "warm ember orange and amber against cold blue-grey ash, volumetric smoke and haze, "
  + "strong rim light, painterly, emotional, melancholy, wide negative space, "
  + "35mm film grain, high contrast, no faces";

const NEG = "nude, naked, nudity, bare skin, lingerie, face, facial features, eyes, mouth, portrait, close-up of a person, "
  + "detailed skin, celebrity, crowd, group of people, "
  + "text, words, letters, watermark, logo, signature, "
  + "cartoon, anime, cgi, 3d render, video game, plastic, "
  + "bright, daylight, flat lighting, washed out, low contrast, cheerful, "
  + "extra limbs, extra fingers, deformed hands, mutated, low quality, blurry";

// key = the sung word the scene is anchored to. Comment = the line it carries.
const SCENES = [
  // "Say you hate me / say you're done / say anything"
  ["hate", "two dark silhouettes standing apart in a doorway with their backs to each other, a wall of embers and sparks hanging in the air between them, one warm firelit room behind, one cold blue empty hallway"],
  // "I'm saying no —" the refusal itself
  ["saying", "a single silhouetted hand closing slowly over a candle flame to snuff it out, sparks escaping between the fingers, everything else black"],
  // "because I love you enough"
  ["love", "a lone silhouette walking away down a road with a house burning warm and bright far behind, embers rising into the night sky, the figure small and receding"],
  // "not to become another wound"
  ["wound", "a long healed burn scar across cracked grey ash, one ember still glowing faintly inside the crack, extreme close up, dark"],
  // "I can miss you and still not answer"
  ["answer", "a phone lying face up on a dark wooden floor glowing cold blue in an empty room, a silhouette sitting turned completely away from it, one candle burning low"],
  // "I can pray that you'll find daylight"
  ["daylight", "a silhouette standing at a tall window with the first cold grey dawn breaking outside, embers dying on the sill, back to the camera"],
  // "without becoming your moon"
  ["moon", "a pale moon dissolving into drifting smoke above a dark treeline, its light going out, embers rising to meet it"],
  // "I can hold all the good parts"
  ["parts", "two cupped silhouetted hands holding a small pile of glowing embers protectively, warm light spilling up through the fingers, black background"],
  // "and still bury the blade"
  ["blade", "a hand pressing a knife down into deep grey ash until it disappears, embers scattered around the burial, low angle, dark"],
  // "I can remember your soft voice"
  ["voice", "a vintage cassette tape lying on a dark table with its ribbon pulled out and tangled, lit by a single warm ember glow, dust in the air, black background"],
  // "without entering the cage"
  ["cage", "an iron birdcage with its door hanging wide open, empty, lit from inside by dying embers, one feather drifting out"],
  // "I can cry for the old days"
  ["cry", "rain running down a black window with a fire reflected and distorted in the glass, warm orange smeared through cold droplets"],
  // "without pulling you through"
  ["us", "two silhouettes standing back to back, one of them coming apart into smoke and embers and blowing away, the other still solid"],
  // "another night where the worst thing I say becomes true"
  ["night", "a match burned almost all the way down to the fingers holding it, the flame about to touch skin, everything else black"],
  // "...becomes true"
  ["true", "thick grey ash and glowing sparks falling through the air like heavy snowfall, backlit by distant orange firelight, a dark empty field below, wide shot"],
  // "I won't be your fire"
  ["fire", "a huge bonfire collapsing into a bed of embers, a lone silhouette walking out of frame away from it, sparks spiralling upward"],
  // "just because you miss the burn"
  ["burn", "a pair of scarred silhouetted hands reaching toward a flame but stopping just short of it, heat shimmer between them, dark"],
  // "I won't say the sharp words"
  ["words", "a scatter of glowing embers flying sideways through black air like thrown sparks, motion trails, nothing else"],
];

// Section moods for the three sections the window spans.
const SECTIONS = [
  ["sec-desperate", "a silhouette on its knees in a dark room lit only by a dying fire, head bowed, long shadow stretching away, embers settling"],
  ["sec-despairing", "a wide empty burnt room after a fire, charred walls, grey ash on the floor, one shaft of cold light, smoke still hanging"],
  ["sec-defiant", "a silhouette in a long heavy coat standing tall and still with its back to the camera facing a wall of fire, feet planted, embers streaming past, fully clothed, refusing to move"],
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
    7: { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "fire" } },
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

let seed = 60_114_907;
let made = 0, skipped = 0;
for (const [key, scene] of todo) {
  for (let v = 1; v <= VARIANTS; v++) {
    const name = v === 1 ? `fire-${key}` : `fire-${key}-${v}`;
    const webp = join(OUT, `${name}.webp`);
    if (existsSync(webp) && !args.force) { skipped++; seed++; continue; }
    const t0 = Date.now();
    const buf = await render(`${scene}, ${STYLE}`, seed++);
    writeFileSync(join(OUT, `${name}.png`), buf);
    await sharp(buf).webp({ quality: 92 }).toFile(webp);
    made++;
    console.error(`✦ ${name}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}
console.error(`\n${made} made, ${skipped} present → ${OUT}`);
