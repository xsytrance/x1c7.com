#!/usr/bin/env node
// "Under The Elevated" — THE PSYCHEDELIC CUT (45s window 190.6–235.6).
//
// A second, distinct voice for this planet: where ute-generate.mjs shot the
// song as cinematic night photography, this one shoots it as a 1970s blacklight
// liquid-light show — oil-wheel projection, fluorescent ink, fractal symmetry.
// The planet's standing law survives the change of voice: objects and light,
// never a person, never a face. (It also keeps SDXL out of the one job it
// reliably fails — counting people.)
//
// One image per sung moment in the window, illustrating THAT line's scene.
// Every key gets a twin (-2) so a repeated word never replays the same frame.
//
// Usage: node scripts/song-art/ute-psychedelic.mjs [--host http://localhost:8188]
//        [--only <key>] [--variants 2] [--dry]
// Writes PNG + webp into scripts/song-art/ute-psy-out/. Publishing is a
// separate, audited step — see ute-psychedelic-publish.mjs.

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
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

// DreamShaper XL Turbo holds a stylised, high-saturation look far better than
// SDXL Turbo, which keeps drifting back toward photography. DS_TURBO preset.
const CKPT = "DreamShaperXL_Turbo_v2_1.safetensors";
const STEPS = 7, CFG = 2, SAMPLER = "dpmpp_sde", SCHED = "karras";

const STYLE = "psychedelic blacklight poster art, 1970s liquid light show, oil wheel projection, "
  + "fluorescent ink on deep black, kaleidoscopic fractal symmetry, melting swirling forms, "
  + "halation and bloom, acid magenta electric cyan ultraviolet and toxic green, "
  + "visionary art, intricate detail, high contrast, symbolic still life, no people";
const NEG = "person, people, face, faces, portrait, man, woman, body, hands, fingers, "
  + "text, words, letters, watermark, logo, signature, photograph, realistic photo, "
  + "muted, desaturated, washed out, dull, low quality, blurry, jpeg artifacts, frame, border";

// ── One scene per sung moment. The lyric it illustrates is in the comment. ──
const SCENES = [
  // "You call me poison, but I call you mine"
  ["poison", "an ornate cut-crystal decanter of glowing violet poison, luminous liquid tendrils climbing out of the neck and blooming into fractal flowers"],
  ["mine", "a heart-shaped padlock fused shut around a heavy chain, both softening and melting, dripping into iridescent mirrored pools"],
  // "You call it weakness, I call it time"
  ["weakness", "a column of cracked glass splitting apart into prisms, rainbow light shattering outward through the fractures"],
  ["time", "a melting clock face unravelling into a logarithmic spiral of numerals and coloured smoke"],
  // "Don't call me yours" / "Then why do you answer?"
  ["yours", "a single wedding ring dissolving into concentric smoke rings receding down an infinite tunnel"],
  ["answer", "a payphone receiver hanging off the hook and melting, sound spreading from it as concentric rippling waves of colour"],
  // "Addiction don't always kick the door in"
  ["addiction", "an enormous serpent coiled around a glowing doorframe, its scales rendered as fractal mandalas"],
  ["door", "one door standing open in an infinite black void, kaleidoscopic light flooding through the gap"],
  // "Sometimes it uses your own voice"
  ["voice", "a mandala of concentric sound waves radiating out of an open speaker cone, fluorescent ripples"],
  ["sometimes", "endlessly nested echoing archways receding toward a fractal vanishing point"],
  // "Sometimes it says, you earned this"
  ["earned", "a golden trophy slumping and melting into a puddle of liquid metal that reflects a spiral galaxy"],
  // "At the counter with the music low"
  ["counter", "a bodega counter lined with bottles refracting into rainbow prism beams under blacklight"],
  ["low", "a glowing jukebox in a dark room, its illuminated bars melting downward into running liquid colour"],
  // "card in my hand, heart in my throat"
  ["heart", "an anatomical heart built from stained glass, lit from within, radiating fractal veins of light"],
  // "I ask myself, do I need this?"
  ["myself", "a shattered mirror where every shard reflects the same empty room in a different colour"],
  // "then laugh like it's some kind of joke"
  ["laugh", "a carnival mask cracked clean in half and grinning, painted in fluorescent swirls, nothing behind it"],
  ["joke", "a joker playing card warping and spiralling into a vortex of suits and colour"],
  // "What else could I do with this money / with this pain"
  ["money", "banknotes fanned into a perfect mandala, the outer edges burning into embers and colour"],
  ["pain", "barbed wire coiled tight around a glowing heart, the thorns blooming into neon flowers"],
  // "What man keeps building a future then burning the bridge in the rain"
  ["building", "a city of luminous crystal towers growing upward out of swirling liquid light"],
  ["bridge", "a long bridge burning in heavy rain, flames and reflections fracturing into kaleidoscope symmetry"],
  // "I'm chasing the dragon under the elevated"
  ["dragon", "an iridescent smoke dragon coiling and chasing its own tail, scales shimmering with oil-slick colour"],
  ["elevated", "elevated subway tracks overhead warping into an infinite fractal cathedral tunnel of steel girders"],
];

// ── Section-mood backdrops for the two sections the window spans ────────────
const SECTIONS = [
  ["sec-dangerous", "a seductive glowing violet doorway at the end of a warping corridor, hypnotic spiral walls"],
  ["sec-desperation", "a rain-slick street beneath elevated tracks dissolving into swirling oil-slick colour, empty and endless"],
];

function graph(prompt, negative, seed) {
  return {
    1: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    2: { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    3: { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    4: { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    5: { class_type: "KSampler", inputs: {
      model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0],
      seed, steps: STEPS, cfg: CFG, sampler_name: SAMPLER, scheduler: SCHED, denoise: 1.0 } },
    6: { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    7: { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "utepsy" } },
  };
}

async function render(prompt, seed) {
  const r = await fetch(`${HOST}/prompt`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: graph(prompt, NEG, seed) }),
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

const ALL = [...SCENES, ...SECTIONS];
const todo = args.only && args.only !== true ? ALL.filter(([k]) => k === args.only) : ALL;
if (!todo.length) { log(`no such key: ${args.only}`); process.exit(1); }

let seed = 77_310_450;
let made = 0, skipped = 0;
for (const [key, scene] of todo) {
  for (let v = 1; v <= VARIANTS; v++) {
    // v1 is the base (psy-<key>.webp), v2+ are the twins (psy-<key>-2.webp)
    const name = v === 1 ? `psy-${key}` : `psy-${key}-${v}`;
    const webp = join(OUT, `${name}.webp`);
    if (existsSync(webp) && !args.force) { skipped++; seed++; continue; }
    const prompt = `${scene}, ${STYLE}`;
    if (args.dry) { log(`[dry] ${name}  seed=${seed}\n      ${prompt.slice(0, 150)}…`); seed++; continue; }
    const t0 = Date.now();
    const buf = await render(prompt, seed++);
    writeFileSync(join(OUT, `${name}.png`), buf);
    await sharp(buf).webp({ quality: 90 }).toFile(webp);
    made++;
    log(`✦ ${name}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify({
  slug: "under-the-elevated", voice: "blacklight-liquid-light", model: CKPT,
  sampler: { steps: STEPS, cfg: CFG, sampler: SAMPLER, scheduler: SCHED }, size: [W, H],
  keys: ALL.map(([k]) => k), variants: VARIANTS,
}, null, 2));
log(`\ndone — ${made} made, ${skipped} already present → ${OUT}`);
