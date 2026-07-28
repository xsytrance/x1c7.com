#!/usr/bin/env node
// SAY IT WITH YOUR BODY — do-over (owner: "everything a silhouette, cohesive,
// mysterious, match the song"). The song is TWO strangers with no shared
// language meeting in darkness where only their bodies speak. Every scene:
// the same two PURE-BLACK silhouettes, one distant hazy light, fog, negative
// space. No faces, no skin, no costume detail — ever.
// Same six R2 keys as before (scene-{brooklyn,heartbeat,slowly,hold,feel,body})
// so the planet wiring stands untouched.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const OUT = join(HERE, "body-scenes-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const STYLE = "two figures as PURE SOLID BLACK silhouettes only, completely featureless dark shapes, backlit by one distant hazy light, thick volumetric fog, deep midnight blue darkness with a single warm amber glow, vast negative space, cinematic minimalism, mysterious intimate atmosphere, film noir, no text, no watermark";
const NEG = "visible face, facial features, eyes, skin, skin texture, lit body, leotard, swimwear, lingerie, revealing clothing, bright colors, neon, crowd, many people, interior detail, text, words, letters, watermark, logo, low quality, blurry";

const SCENES = [
  ["brooklyn", "a dark world horizon holding four faint distant city skylines barely glowing through haze, and above them two tiny black silhouettes dancing together on a rooftop under one shared moon"],
  ["heartbeat", "two black silhouettes standing chest to chest in fog, a single small warm glow exactly where their chests meet, everything else darkness"],
  ["slowly", "two black silhouettes slow-dancing in thick fog, backlit by one distant doorway of pale light, their long shadows stretching toward the viewer"],
  ["hold", "two black silhouettes melting into one embracing shape against a single hazy moon low in the mist, the merged figure almost a monolith"],
  ["feel", "two silhouetted hands in profile reaching for each other across darkness, almost touching, backlit by soft amber haze, nothing else visible"],
  ["body", "one black silhouette mid-dance-turn in fog, arms extended, a faint motion echo of the pose behind it, lit only by a thin rim of distant light"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdbody2" } },
  };
}

async function generate(prompt, negative, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(prompt, negative, seed) }) });
  if (!q.ok) throw new Error(`queue ${q.status}: ${await q.text()}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const h = await (await fetch(`${HOST}/history/${prompt_id}`)).json();
    const entry = h[prompt_id];
    if (entry?.status?.completed || entry?.outputs?.["7"]) {
      const img = entry.outputs?.["7"]?.images?.[0];
      if (!img) throw new Error("no image in outputs");
      const res = await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`);
      return Buffer.from(await res.arrayBuffer());
    }
    if (entry?.status?.status_str === "error") throw new Error("comfy error: " + JSON.stringify(entry.status));
  }
  throw new Error("timeout");
}

let seed = 900_184;
for (const [word, scene] of SCENES) {
  for (let v = 1; v <= 3; v++) {
    log(`▶ ${word} v${v}`);
    const buf = await generate(`${scene}, ${STYLE}`, NEG, seed++);
    writeFileSync(join(OUT, `sil-${word}-v${v}.png`), buf);
  }
}
log("✦ silhouette pass done");
