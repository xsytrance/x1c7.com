#!/usr/bin/env node
// WARM WITHOUT BURNING — the art planet, generated locally.
//
// Fourteenth voice: SƠN MÀI LACQUER. The song is Vietnamese, set on the Hàn
// River in Da Nang, so the medium is Vietnamese: sơn mài lacquer painting —
// deep black polished lacquer ground, gold and silver leaf, crushed duck
// eggshell inlay for every white, cinnabar for every red. It is already the
// song's palette ("gold and ember against blue-black water") and it is
// texture-first, so it survives a hard centre crop (§17).
//
// Chapter IV answers Chapter I. "I Won't Be Your Fire" was cage / knife /
// wire / moon — hard objects that cut. This planet is the same world with the
// blades put down: the bridge stops breathing fire and she is still sitting
// there. Figures are SILHOUETTE ONLY and small in frame — SDXL cannot count
// people (§3), and silhouettes make that irrelevant.
//
// SDXL only: the DiT engines (flux2/chroma) wedge ComfyUI on this box and the
// bfloat16 VAE hangs it too (--fp32-vae) — both still unfixed (§18, FAG).
// Native portrait 832×1472 per the 2026-08-01 owner law.
//
//   node scripts/song-art/wwb-art.mjs              # all candidates
//   node scripts/song-art/wwb-art.mjs --only gone  # one scene
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const HOST = "http://localhost:8188";
const ROOT = new URL("../..", import.meta.url).pathname;
const OUT = join(ROOT, "scripts/song-art/wwb-out");
mkdirSync(OUT, { recursive: true });
const W = 832, H = 1472;

// The clause that makes eighteen plates one voice.
const VOICE =
  ", traditional Vietnamese son mai lacquer painting, deep glossy black lacquer ground," +
  " genuine gold leaf and silver leaf, crushed duck eggshell inlay for all white texture," +
  " cinnabar vermilion accents, hand-polished mirror sheen, warm ember glow against" +
  " blue-black water, flat decorative depth, fine craquelure, museum lacquer panel, no text";

// Humans only ever as small flat silhouettes — never faces, never counted.
const NEG =
  "face, facial features, portrait, eyes, mouth, skin texture, hands, fingers, crowd, many people," +
  " text, letters, words, numbers, watermark, signature, logo, frame, border," +
  " photograph, photo, 3d render, cgi, low quality, blurry, oversaturated, cartoon, anime";

// [name, lyric it illustrates, shot size, scene]
// Shot sizes are load-bearing (§17): WIDE ≥ a third, CLOSE+MACRO ≤ a quarter,
// and never two identical sizes back to back. Current: 8 W / 6 M / 3 C / 1 X.
const SCENES = [
  ["burning", "Warm without burning", "WIDE",
   "a long dragon bridge arcing across still black lacquer water at night, the dragon's head at one end breathing a great plume of gold leaf fire up into the dark sky, two tiny flat silhouettes sitting far below on the river steps, city lights as small squares of gold leaf on the far bank"],
  ["chay", "Ấm mà không cháy", "CLOSE",
   "the head of a golden dragon in gold leaf and cinnabar, jaws open, the plume of fire leaving its mouth dissolving upward into a spray of crushed eggshell sparks against deep black lacquer"],
  ["fire", "No need for fire", "MED",
   "a single small clay oil lamp resting on a dark stone ledge, one steady warm gold flame, a wide field of polished black lacquer all around it, faint gold reflection pooling under the lamp"],
  ["stay", "to make me stay", "WIDE",
   "two small flat silhouettes seated side by side on wet stone river steps, not touching, a broad expanse of blue-black lacquer water before them, distant city lights in gold leaf across the water"],
  ["break", "You don't have to break", "MACRO",
   "extreme close detail of a black lacquer surface densely inlaid with crushed white duck eggshell, one fine hairline crack running across it, thin molten gold seeping into the crack but not spreading"],
  ["quantam", "để biết rằng em quan tâm", "MED",
   "two hands resting open and apart on a dark lacquer railing above water, rimmed in gold leaf, relaxed and not gripping, warm ember light from below, black lacquer night behind"],
  ["dark", "Warm without burning", "WIDE",
   "the same long dragon bridge at night but completely unlit, only its outline drawn in thin gold leaf on deep black lacquer, the water beneath it perfectly glassy and still, no fire anywhere"],
  ["nuoc", "Nước đang rơi đêm nay", "MED",
   "a falling curtain of water rendered as thousands of crushed eggshell fragments streaming down against blue-black lacquer, silver leaf river surface below catching the spray, warm gold light behind the water"],
  ["gone", "The fire is gone", "WIDE",
   "a wide still river at night under low mist, one thin horizontal line of gold leaf where a bridge stands far away, the water a vast unbroken sheet of polished black lacquer, utterly calm"],
  ["oday", "mà em vẫn ở đây", "MED",
   "a single small flat silhouette seated alone on wide stone river steps, rimmed in warm gold leaf, an empty space on the step beside her, black lacquer water stretching away"],
  ["here", "I'm still here", "CLOSE",
   "a three quarter profile silhouette of a woman as a flat black lacquer shape, a bright rim of gold leaf running along her cheek, jaw and shoulder, deep black ground, no facial features at all"],
  ["yen", "khi thành phố yên", "WIDE",
   "a sleeping city skyline across dark water rendered in flat black lacquer, its windows small squares of gold leaf, many of them already gone dark, thin silver leaf reflections on the river below"],
  ["scars", "No scars", "MED",
   "a broad expanse of flawless hand-polished black lacquer, completely unbroken and mirror smooth, a soft band of warm gold reflection sliding across its surface, nothing else"],
  ["run", "No reason to run", "WIDE",
   "wide stone river steps descending into blue-black lacquer water at night, a pair of bare feet as small flat silhouettes standing still at the waterline, silver leaf ripples spreading out slowly"],
  ["am", "Chỉ có hơi ấm", "CLOSE",
   "a shallow dark bowl of glowing embers, warm gold and cinnabar, no flame at all, gentle heat haze rising, held in deep black lacquer shadow"],
  ["stayed", "I thought somebody only stayed", "WIDE",
   "two small flat silhouettes still seated together on river steps as the first cold grey light of dawn enters the black lacquer sky, the gold leaf now pale and thin, mist on the water"],
  ["dau", "dù chẳng ai đau", "MED",
   "a single empty dark lacquer bowl resting on a black surface, one bright seam of gold leaf running where it was once mended, soft warm light, nothing else in the frame"],
  ["dawn", "Ấm mà không cháy", "WIDE",
   "the Han River at first light, the long bridge reduced to one thin calm line of gold leaf across a pale silver leaf sky, the water warm and completely still, black lacquer banks, peaceful"],
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
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "wwb" } },
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
    try { h = await (await fetch(`${HOST}/history/${id}`, { signal: AbortSignal.timeout(20000) })).json(); }
    catch { continue; }
    if (h[id]) {
      const st = h[id].status;
      if (st && st.status_str === "error") throw new Error(`comfy error: ${JSON.stringify(st.messages).slice(0, 400)}`);
      const imgs = Object.values(h[id].outputs).flatMap((o) => o.images || []);
      if (imgs.length) return imgs[0];
    }
  }
}
async function fetchImage(info, dest) {
  const url = `${HOST}/view?filename=${encodeURIComponent(info.filename)}&subfolder=${encodeURIComponent(info.subfolder || "")}&type=${info.type}`;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
writeFileSync(join(OUT, "scenes.json"), JSON.stringify(SCENES, null, 1));
// engine-grouped so the GPU never thrashes model reloads
for (const [engine, graphFn, seeds] of [["dream", dreamGraph, [11, 12]], ["jugg", juggGraph, [21, 22]]]) {
  for (const [name, lyric, shot, scene] of SCENES) {
    if (only && name !== only) continue;
    const prompt = scene + VOICE;
    for (const s of seeds) {
      const dest = join(OUT, `${name}-${engine}-${s}.png`);
      if (existsSync(dest)) { console.error(`· ${name}-${engine}-${s} exists`); continue; }
      const seed = (fnv1a(`wwb:${name}:${engine}:${s}`) % 2 ** 31) + s;
      const t0 = Date.now();
      const info = await waitFor(await submit(graphFn({ prompt, seed })));
      const bytes = await fetchImage(info, dest);
      console.error(`✓ ${name}-${engine}-${s} [${shot}] ${(bytes / 1024).toFixed(0)}KB ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
}
console.error("done");
