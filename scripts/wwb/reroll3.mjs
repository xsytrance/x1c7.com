#!/usr/bin/env node
// Third pass: convert the nine object/macro plates into LANDSCAPES.
//
// The full-planet audit made the pattern obvious. In this lacquer voice SDXL
// paints Vietnamese night landscapes beautifully and object briefs terribly:
// "flawless polished lacquer" became a framed decorative mirror, "crushed
// eggshell with a hairline crack" became gold foliage, "a bowl of embers"
// became a photoreal bowl of chillies, and "a pair of sandals at the
// waterline" became a product shot of flip-flops on teal. Nine of eighteen.
//
// So stop fighting it. Every lyric here can be staged on the Han River at
// night, which is where the song actually happens, and staging them all in one
// place is also what makes eighteen plates read as one planet.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const HOST = "http://localhost:8188";
const OUT = join(new URL("../..", import.meta.url).pathname, "scripts/song-art/wwb-out");
mkdirSync(OUT, { recursive: true });
const W = 832, H = 1472;

const VOICE =
  ", traditional Vietnamese son mai lacquer painting, deep glossy black lacquer ground," +
  " genuine gold leaf and silver leaf, crushed duck eggshell inlay for white texture," +
  " cinnabar accents, hand-polished sheen, blue-black river water at night, flat" +
  " decorative depth, fine craquelure, museum lacquer panel, painted not photographed, no text";
const NEG =
  "still life, object on a table, product shot, bowl, cup, plate, dish, food, shoes, sandals," +
  " mirror, picture frame, decorative panel, ornament, lacquerware," +
  " dragon, serpent, lizard, creature, animal, beast," +
  " face, portrait, headshot, close-up of a person, kimono, geisha, hanfu," +
  " text, letters, signature, watermark, logo, photograph, photo, 3d render, cgi," +
  " low quality, blurry, oversaturated, cartoon, anime";

const SCENES = [
  ["chay", "Ấm mà không cháy", "WIDE",
   "a wide night river seen from the bank, a great burst of golden fire and sparks blooming high in the black sky above the far shore and its long shimmering reflection running toward the viewer across the blue-black water"],
  ["fire", "No need for fire", "MED",
   "a dark river bank at night, one single small warm lamp burning alone far across the black water, its thin gold reflection reaching all the way across the still surface, everything else deep black and empty"],
  ["break", "You don't have to break", "WIDE",
   "a perfectly still wide bay at night under a low moon, the water an unbroken sheet of dark mirror, one long thin unbroken path of gold moonlight lying across it, distant black hills, nothing disturbing the surface"],
  ["quantam", "để biết rằng em quan tâm", "MED",
   "two small wooden sampan boats moored quietly side by side against a stone river bank at night, warm gold lantern light on their hulls, blue-black lacquer water, no people aboard"],
  ["dark", "Warm without burning", "WIDE",
   "a long unlit steel arch bridge crossing a wide river at night, drawn only as a thin gold outline against a deep black sky, no lights burning on it, the water beneath perfectly glassy and still"],
  ["scars", "No scars", "MED",
   "an utterly calm stretch of night river with a completely unbroken glassy surface, a wide soft band of warm gold light lying across it, low mist along the far bank, no ripples anywhere"],
  ["run", "No reason to run", "WIDE",
   "wide empty stone steps descending into blue-black river water at night, slow silver ripples spreading across the surface, gold lantern light along the embankment above, completely deserted"],
  ["am", "Chỉ có hơi ấm", "MED",
   "a row of small riverside stilt houses at night glowing warm gold from within, their light spilling in long gold ribbons across the dark water in front of them, black hills behind"],
  ["dau", "dù chẳng ai đau", "MED",
   "a quiet empty bend of the river late at night under drifting mist, one distant gold light on the far bank, black water, black trees, nobody anywhere, deeply peaceful"],
];

const sdxl = ({ ckpt, steps, cfg, sampler, scheduler, loras = [] }) => ({ prompt, seed }) => {
  const g = { "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: ckpt } } };
  let model = ["1", 0], clip = ["1", 1];
  loras.forEach(([n, s], i) => { g[`L${i}`] = { class_type: "LoraLoader", inputs: { model, clip, lora_name: n, strength_model: s, strength_clip: s } }; model = [`L${i}`, 0]; clip = [`L${i}`, 1]; });
  Object.assign(g, {
    "2": { class_type: "CLIPTextEncode", inputs: { clip, text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip, text: NEG } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model, positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps, cfg, sampler_name: sampler, scheduler, denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "wwb3" } },
  });
  return g;
};
const dream = sdxl({ ckpt: "DreamShaperXL_Turbo_v2_1.safetensors", steps: 7, cfg: 2, sampler: "dpmpp_sde", scheduler: "karras" });
const fnv1a = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
async function submit(g) { const r = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: g }) }); if (!r.ok) throw new Error(await r.text()); return (await r.json()).prompt_id; }
async function waitFor(id) { for (;;) { await new Promise((r) => setTimeout(r, 2000)); let h; try { h = await (await fetch(`${HOST}/history/${id}`, { signal: AbortSignal.timeout(20000) })).json(); } catch { continue; } if (h[id]) { const st = h[id].status; if (st && st.status_str === "error") throw new Error(JSON.stringify(st.messages).slice(0, 300)); const im = Object.values(h[id].outputs).flatMap((o) => o.images || []); if (im.length) return im[0]; } } }
async function grab(i, d) { const u = `${HOST}/view?filename=${encodeURIComponent(i.filename)}&subfolder=${encodeURIComponent(i.subfolder || "")}&type=${i.type}`; writeFileSync(d, Buffer.from(await (await fetch(u)).arrayBuffer())); }
writeFileSync(join(OUT, "scenes-v3.json"), JSON.stringify(SCENES, null, 1));
for (const [name, lyric, shot, scene] of SCENES) {
  for (const s of [51, 52, 53, 54]) {
    const dest = join(OUT, `${name}-v3-${s}.png`);
    if (existsSync(dest)) continue;
    const t0 = Date.now();
    await grab(await waitFor(await submit(dream({ prompt: scene + VOICE, seed: (fnv1a(`wwb3:${name}:${s}`) % 2 ** 31) + s }))), dest);
    console.error(`✓ ${name}-v3-${s} [${shot}] ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}
console.error("v3 done");
