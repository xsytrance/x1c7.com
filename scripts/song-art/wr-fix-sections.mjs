#!/usr/bin/env node
// Whistle on the River — align the B&W+gold section art with the planet's
// actual asset names. This planet predates the sec- prefix: sections live at
// /planets/whistle-on-the-river/<mood>.webp with a <mood>-2.webp twin.
// Uploads the redo set to those names and renders the missing twins in the
// same voice, then removes the unreferenced sec-*.webp uploads.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const SLUG = "whistle-on-the-river";
const OUT = join(HERE, "wr-redo-out");
const HOST = process.env.COMFY_HOST || "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const log = (...a) => console.error(...a);

const STYLE = "high-contrast black and white photography, mississippi river noir, deep blacks and silver mist, film grain, symbolic still life, no people, monochrome everything except money and gold which glow in rich saturated metallic gold, selective color";
const NEG = "person, people, face, faces, portrait, man, woman, body, hands, fingers, text, words, letters, watermark, logo, signature, cartoon, anime, low quality, blurry, rainbow, colorful scenery, sepia, vintage photograph, warm brown tones, yellowed paper";

const SECTIONS = [
  ["dark", "black river water at night, slow oily ripples, fog swallowing the far bank, monochrome"],
  ["mysterious", "river fog rolling over an empty monochrome pier, a single lantern haloed silver, shapes half-seen"],
  ["tense", "a monochrome poker table mid-hand, cards face down, coiled cigar smoke, one stack of gold coins as the pot"],
  ["menacing", "the shadow of a paddle steamer looming through fog onto a monochrome dock, black water churning"],
  ["confident", "a monochrome captain's wheel polished and steady, river ahead parting the fog, a gold coin wedged in the spoke"],
  ["aggressive", "the paddle wheel churning black water to white foam, close up, hard monochrome contrast, spray frozen"],
  ["crazy", "dice mid-tumble across a monochrome craps table, motion blur, chips scattering, gold coins skittering bright"],
  ["intense", "the boiler-room furnace door glowing through a monochrome engine room, gauges pinned, steam screaming from a valve"],
  ["excitement", "a monochrome riverboat deck strung with glowing bulbs in fog, streamers frozen mid-air, gold confetti of coins on the boards"],
];

function loadEnv(f) { const o = {}; if (!existsSync(f)) return o; for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); } return o; }
const E = loadEnv(join(ROOT, ".env"));
const rcloneEnv = {
  ...process.env, RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: E.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: E.SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: E.ENDPOINT,
};
const r2 = (...a) => execFileSync("rclone", a, { env: rcloneEnv, stdio: "ignore" });

function graph(prompt, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: NEG } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["6", 0] && ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "wrfix" } },
  };
}
async function generate(prompt, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(prompt, seed) }) });
  if (!q.ok) throw new Error(`queue ${q.status}: ${await q.text()}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const entry = (await (await fetch(`${HOST}/history/${prompt_id}`)).json())[prompt_id];
    if (entry?.status?.completed || entry?.outputs?.["7"]) {
      const img = entry.outputs?.["7"]?.images?.[0];
      if (!img) throw new Error("no image");
      const res = await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`);
      return Buffer.from(await res.arrayBuffer());
    }
  }
  throw new Error("timeout");
}
const seedOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

for (const [mood, scene] of SECTIONS) {
  // 1. the base: reuse the already-rendered redo image at the live name
  const src = join(OUT, `sec-${mood}.webp`);
  r2("copyto", src, `R2:${E.BUCKET}/planets/${SLUG}/${mood}.webp`, "--s3-no-check-bucket", "--no-traverse");
  // 2. the twin: fresh render, alternate composition, same voice
  const twinPath = join(OUT, `${mood}-2.webp`);
  if (!existsSync(twinPath)) {
    const buf = await generate(`${scene}, alternate composition, ${STYLE}`, seedOf(`${mood}-2`) + 7919);
    await sharp(buf).webp({ quality: 82 }).toFile(twinPath);
  }
  r2("copyto", twinPath, `R2:${E.BUCKET}/planets/${SLUG}/${mood}-2.webp`, "--s3-no-check-bucket", "--no-traverse");
  log(`✔ ${mood} + ${mood}-2`);
}
// 3. remove the unreferenced sec-*.webp uploads (this planet is prefix-less)
for (const [mood] of SECTIONS) r2("deletefile", `R2:${E.BUCKET}/planets/${SLUG}/sec-${mood}.webp`);
log("✔ sec-*.webp cleanup done");
