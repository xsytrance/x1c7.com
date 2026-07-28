#!/usr/bin/env node
// NEON TEETH re-roll: ultraviolet (single woman, was doubling) + teeth (the
// TITLE image = her wide smile, teeth glowing neon under blacklight).
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const OUT = join(HERE, "neon-teeth-out");
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.error(...a);

const GRADE = "cinematic film still, 35mm photograph, photorealistic, shallow depth of field, " +
  "dark nightclub drenched in ultraviolet blacklight, volumetric haze, glowing magenta and cyan neon, " +
  "moody low-key lighting, fine film grain, high detail, dramatic, sensual, dangerous, no text, no watermark";
const HER = "one beautiful dangerous woman with long glossy dark hair, smoky eyes, glossy dark red lipstick";
// count guard is stronger here
const NEG = "two women, twins, second woman, duplicate person, cloned face, extra person, third person, " +
  "group, crowd of faces, deformed, disfigured, extra limbs, extra fingers, mutated hands, bad anatomy, " +
  "cartoon, anime, illustration, painting, cgi, plastic skin, doll, watermark, signature, text, letters, " +
  "logo, oversaturated, blurry, low quality, nudity, naked, nsfw, explicit";

const SCENES = [
  ["ultraviolet",
    `solo portrait of ${HER} alone, centered, one woman by herself on a dark dancefloor, her fitted black ` +
    `dress glowing electric under ultraviolet blacklight, head tipped back lost in the bass, ${GRADE}`],
  ["teeth",
    `extreme close-up of ${HER}'s face, a wide dangerous open smile, her teeth glowing luminous electric ` +
    `blue-white under ultraviolet blacklight, dark red lips framing the glow, macro, the neon teeth, ${GRADE}`],
];

function graph(prompt, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: NEG } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "neonteethR" } },
  };
}
async function generate(prompt, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(prompt, seed) }) });
  if (!q.ok) throw new Error(`queue ${q.status}: ${await q.text()}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const h = await (await fetch(`${HOST}/history/${prompt_id}`)).json();
    const entry = h[prompt_id];
    if (entry?.status?.completed || entry?.outputs?.["7"]) {
      const img = entry.outputs?.["7"]?.images?.[0];
      if (!img) throw new Error("no image");
      const res = await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`);
      return Buffer.from(await res.arrayBuffer());
    }
    if (entry?.status?.status_str === "error") throw new Error("comfy error");
  }
  throw new Error("timeout");
}
let seed = 9_313_004;
for (const [key, prompt] of SCENES) {
  for (let v = 1; v <= 4; v++) {
    log(`▶ ${key} r${v}`);
    try { writeFileSync(join(OUT, `scene-${key}-r${v}.png`), await generate(prompt, seed++)); }
    catch (e) { log(`  ✗ ${key} r${v}: ${e.message}`); }
  }
}
log("✦ reroll done");
