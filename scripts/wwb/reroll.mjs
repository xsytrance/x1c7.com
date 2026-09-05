#!/usr/bin/env node
// Re-roll the eight plates the first pass got wrong (audited 2026-09-04).
//
// What failed, and why:
//   * "dragon bridge" -> LITERAL DRAGONS. SDXL does not know Da Nang's Dragon
//     Bridge, so it drew mythological beasts crawling on rocks. The word
//     "dragon" is now banned from the bridge prompts and sits in the negative.
//   * Every plate with a person failed. `here` asked for a featureless flat
//     silhouette and returned four fully rendered portrait FACES in Chinese
//     court dress -- with "face, facial features, portrait, eyes, mouth"
//     already in the negative. `stay` returned three figures where the brief
//     said two (§3: SDXL cannot count people).
//   * The people it did draw read Japanese/Chinese classical, not Vietnamese.
//
// Fix, following the TWTHI precedent (§18): where a human is not load-bearing,
// take the human OUT and let an object carry the lyric -- an empty chair, a lit
// lantern, two cups. Absence reads as presence in a song about someone staying.
// The two plates that genuinely need bodies get them at thumbnail scale in a
// vast landscape, which is the only framing SDXL reliably respects.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const HOST = "http://localhost:8188";
const ROOT = new URL("../..", import.meta.url).pathname;
const OUT = join(ROOT, "scripts/song-art/wwb-out");
mkdirSync(OUT, { recursive: true });
const W = 832, H = 1472;

const VOICE =
  ", traditional Vietnamese son mai lacquer painting, deep glossy black lacquer ground," +
  " genuine gold leaf and silver leaf, crushed duck eggshell inlay for all white texture," +
  " cinnabar vermilion accents, hand-polished mirror sheen, warm ember glow against" +
  " blue-black water, flat decorative depth, fine craquelure, museum lacquer panel, no text";

const NEG =
  "dragon, serpent, snake, creature, monster, beast, wings, scales," +
  " face, facial features, eyes, mouth, lips, portrait, headshot, bust, close-up of a person," +
  " kimono, geisha, hanfu, chinese court dress, japanese, robes, costume, jewellery," +
  " crowd, many people, group, figures in the foreground," +
  " text, letters, words, numbers, signature, watermark, logo, frame, border," +
  " photograph, photo, 3d render, cgi, low quality, blurry, oversaturated, cartoon, anime";

const SCENES = [
  ["burning", "Warm without burning", "WIDE",
   "a long modern steel arch bridge spanning a very wide black lacquer river at night, a great plume of golden fire arcing outward from one end of the bridge and out over the water, distant city lights as small squares of gold leaf along the far bank, seen from far away across the empty water, no people anywhere"],
  ["chay", "Ấm mà không cháy", "CLOSE",
   "a great soft plume of golden fire and drifting sparks bursting outward against a deep black lacquer void, crushed eggshell embers scattering upward, cinnabar red glowing at the core, abstract and very close, pure fire and darkness, no people, no animals"],
  ["stay", "to make me stay", "WIDE",
   "an immense empty night riverbank seen from very far away, two extremely small dark silhouettes sitting together on wide stone steps at the very bottom edge of the frame, tiny as thumbprints, dwarfed by a vast expanse of blue-black lacquer water and a far bank of gold leaf city lights under a huge night sky"],
  ["quantam", "để biết rằng em quan tâm", "MED",
   "two small ceramic tea cups resting side by side on a dark polished lacquer table, faint steam rising from both, warm gold light raking across them, deep black lacquer background, an intimate still life, no people, no hands"],
  ["oday", "mà em vẫn ở đây", "MED",
   "a single empty wooden chair standing alone on wide stone river steps at night, warm gold rim light along its edges, blue-black lacquer water stretching away beyond it, nobody there, quiet and still"],
  ["here", "I'm still here", "CLOSE",
   "one small paper lantern glowing warm gold, resting on an empty stone step at the water's edge, deep black lacquer night all around it, its reflection a thin gold line on perfectly still water, nobody there"],
  ["run", "No reason to run", "WIDE",
   "wide empty stone river steps descending into blue-black lacquer water at night, slow silver leaf ripples spreading outward across the surface, a single pair of sandals left neatly at the waterline, nobody there, calm"],
  ["stayed", "I thought somebody only stayed", "WIDE",
   "an immense river at first grey dawn seen from very far away, two extremely small dark silhouettes still sitting together on stone steps at the very bottom edge of the frame, tiny against a vast pale silver sky and a huge sweep of black lacquer water, low mist"],
];

const sdxl = ({ ckpt, steps, cfg, sampler, scheduler, loras = [] }) => ({ prompt, seed }) => {
  const g = { "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: ckpt } } };
  let model = ["1", 0], clip = ["1", 1];
  loras.forEach(([name, strength], i) => {
    g[`L${i}`] = { class_type: "LoraLoader", inputs: { model, clip, lora_name: name, strength_model: strength, strength_clip: strength } };
    model = [`L${i}`, 0]; clip = [`L${i}`, 1];
  });
  Object.assign(g, {
    "2": { class_type: "CLIPTextEncode", inputs: { clip, text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip, text: NEG } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model, positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps, cfg, sampler_name: sampler, scheduler, denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "wwb2" } },
  });
  return g;
};
const dreamGraph = sdxl({ ckpt: "DreamShaperXL_Turbo_v2_1.safetensors", steps: 7, cfg: 2, sampler: "dpmpp_sde", scheduler: "karras" });
const juggGraph = sdxl({ ckpt: "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors", loras: [["sdxl_lightning_8step_lora.safetensors", 1]], steps: 8, cfg: 1.5, sampler: "euler", scheduler: "sgm_uniform" });
const fnv1a = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };

async function submit(graph) {
  const res = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: graph }) });
  if (!res.ok) throw new Error(`submit ${res.status}: ${await res.text()}`);
  return (await res.json()).prompt_id;
}
async function waitFor(id) {
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    let h;
    try { h = await (await fetch(`${HOST}/history/${id}`, { signal: AbortSignal.timeout(20000) })).json(); } catch { continue; }
    if (h[id]) {
      const st = h[id].status;
      if (st && st.status_str === "error") throw new Error(`comfy error: ${JSON.stringify(st.messages).slice(0, 300)}`);
      const imgs = Object.values(h[id].outputs).flatMap((o) => o.images || []);
      if (imgs.length) return imgs[0];
    }
  }
}
async function fetchImage(info, dest) {
  const url = `${HOST}/view?filename=${encodeURIComponent(info.filename)}&subfolder=${encodeURIComponent(info.subfolder || "")}&type=${info.type}`;
  writeFileSync(dest, Buffer.from(await (await fetch(url)).arrayBuffer()));
}
writeFileSync(join(OUT, "scenes-v2.json"), JSON.stringify(SCENES, null, 1));
for (const [engine, graphFn, seeds] of [["dream", dreamGraph, [31, 32]], ["jugg", juggGraph, [41, 42]]]) {
  for (const [name, lyric, shot, scene] of SCENES) {
    for (const s of seeds) {
      const dest = join(OUT, `${name}-v2${engine}-${s}.png`);
      if (existsSync(dest)) { console.error(`· ${name}-v2${engine}-${s} exists`); continue; }
      const t0 = Date.now();
      await fetchImage(await waitFor(await submit(graphFn({ prompt: scene + VOICE, seed: (fnv1a(`wwb2:${name}:${engine}:${s}`) % 2 ** 31) + s }))), dest);
      console.error(`✓ ${name}-v2${engine}-${s} [${shot}] ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
}
console.error("reroll done");
