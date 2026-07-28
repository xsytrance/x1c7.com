#!/usr/bin/env node
// SAY IT WITH YOUR BODY — count-strict re-roll (owner: "2 people only please;
// not 3"). SDXL Turbo drifts on figure count, so: prompts open with the count,
// NEG bans trios/groups/extra limbs, 6 variants per scene, and every output
// gets a manual vision audit before picking. Scenes: slowly / hold / feel
// (body swaps to the already-clean sil-body-v1).

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

const STYLE = "PURE SOLID BLACK silhouettes, completely featureless dark shapes, backlit by one distant hazy light, thick volumetric fog, deep midnight blue darkness with a single warm amber glow, vast negative space, cinematic minimalism, mysterious intimate atmosphere, film noir, no text, no watermark";
const NEG = "three people, trio, third person, group, crowd, four people, five people, extra person, multiple couples, bystander, extra hands, four hands, extra limbs, extra fingers, visible face, facial features, eyes, skin, skin texture, lit body, leotard, swimwear, lingerie, revealing clothing, bright colors, neon, interior detail, text, words, letters, watermark, logo, low quality, blurry";

const SCENES = [
  ["slowly", "exactly two people, one couple alone: a man and a woman slow-dancing pressed together as black silhouettes in thick fog, empty room, backlit by one distant doorway of pale light, their two long shadows stretching toward the viewer"],
  ["hold", "exactly two people, one couple alone: a man and a woman melting into one single embracing silhouette shape against a single hazy moon low in the mist, nobody else, the merged figure almost a monolith"],
  ["feel", "exactly two hands: one single hand reaching from the left edge and one single hand reaching from the right edge, silhouetted in profile, fingertips almost touching in the center, backlit by soft amber haze, nothing else visible"],
];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "sdbody3" } },
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

let seed = 2_184_214;
for (const [word, scene] of SCENES) {
  for (let v = 1; v <= 6; v++) {
    log(`▶ ${word} v${v}`);
    const buf = await generate(`${scene}, ${STYLE}`, NEG, seed++);
    writeFileSync(join(OUT, `duo-${word}-v${v}.png`), buf);
  }
}
log("✦ count-strict pass done");
