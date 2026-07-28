#!/usr/bin/env node
// NEON TEETH — Tyler Haze's OWN visual voice: ULTRAVIOLET NOIR.
// Photoreal cinematic nightclub, blacklight-drenched. A dangerous woman whose
// dress + smile glow under ultraviolet, and the tattooed antihero who leans in
// anyway. Distinct from every x1c7 painterly voice (this one is a film still).
// SDXL Turbo @ :8188, 1152x832, steps 4, cfg 1.0, euler_ancestral.

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

// Shared photoreal ultraviolet-noir grade.
const GRADE = "cinematic film still, 35mm photograph, photorealistic, shallow depth of field, " +
  "dark nightclub drenched in ultraviolet blacklight, volumetric haze, glowing magenta and cyan neon, " +
  "wet reflections, moody low-key lighting, fine film grain, high detail, dramatic, sensual, dangerous, " +
  "nocturnal, no text, no watermark";

// Consistent characters (repeat verbatim so the cast reads the same each scene).
const HIM = "a lean handsome young man with messy tousled jet-black hair over his eyes, sharp jawline, " +
  "dark stubble, fine black tattoos on his neck and hands, black tank top, layered silver chain necklaces";
const HER = "a stunning dangerous woman with long glossy dark hair, smoky eyes, glossy dark red lipstick, " +
  "fitted little black dress that glows faintly under blacklight";

const NEG = "extra people, crowd of faces, third person, group, duplicate person, second couple, " +
  "deformed, disfigured, extra limbs, extra arms, extra fingers, mutated hands, bad anatomy, bad face, " +
  "cartoon, anime, illustration, painting, drawing, cgi render, plastic skin, doll, " +
  "watermark, signature, text, letters, logo, oversaturated, washed out, blurry, low quality, " +
  "nudity, naked, nsfw, explicit";

// word -> [scene prompt]. Framing tactics from the playbook: her-only close-ups
// are count-safe; the two-shots use over-the-shoulder framing to hold the cast.
const SCENES = [
  ["distance",
    `${HIM}, seen from behind and side, walking toward a woman through a hazy crowded nightclub, ` +
    `jaw set and eyes locked ahead, torn and magnetic, hero shot, ${GRADE}`],
  ["ultraviolet",
    `${HER}, arms raised on a dark dancefloor, her black dress and skin glowing electric under ultraviolet ` +
    `blacklight, head tipped back, lost in the bass, full figure, ${GRADE}`],
  ["smoke",
    `close-up of ${HER}, a slow crooked smile cutting through a veil of cigarette smoke and heat haze, ` +
    `neon backlight rimming her hair, over the shoulder of a man in dark foreground, ${GRADE}`],
  ["teeth",
    `intimate two-shot, over the shoulder, ${HIM} leaning in very close to ${HER}, his face near her jaw, ` +
    `her lips parted in a luminous neon-white smile glowing under ultraviolet, teeth glowing, dangerous ` +
    `intimacy, sparks between them, ${GRADE}`],
  ["trouble",
    `${HER} standing lit like trouble against the dark, silhouetted and rim-lit by a glowing red neon bar ` +
    `sign behind her, one hip cocked, staring straight at camera, magnetic and lethal, ${GRADE}`],
  ["poison",
    `extreme close-up of ${HER}'s glossy dark red lips barely parted near the rim of a cocktail glass, ` +
    `a single drop of light, sweet poison, ultraviolet glow, macro, ${GRADE}`],
  ["chemistry",
    `intimate two-shot, ${HIM} and ${HER} pressed close together in a packed neon nightclub crowd, faces ` +
    `inches apart about to kiss, electric ultraviolet light between them, over-the-shoulder framing, ${GRADE}`],
];

function graph(prompt, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: NEG } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "neonteeth" } },
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
      if (!img) throw new Error("no image in outputs");
      const res = await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`);
      return Buffer.from(await res.arrayBuffer());
    }
    if (entry?.status?.status_str === "error") throw new Error("comfy error: " + JSON.stringify(entry.status));
  }
  throw new Error("timeout");
}

const VARIANTS = Number(process.env.VARIANTS || 3);
let seed = 4_820_617;
for (const [key, prompt] of SCENES) {
  for (let v = 1; v <= VARIANTS; v++) {
    log(`▶ ${key} v${v}`);
    try {
      const buf = await generate(prompt, seed++);
      writeFileSync(join(OUT, `scene-${key}-v${v}.png`), buf);
    } catch (e) { log(`  ✗ ${key} v${v}: ${e.message}`); }
  }
}
log("✦ neon-teeth scene pass done ->", OUT);
