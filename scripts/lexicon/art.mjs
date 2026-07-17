#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LEXICON · ART — THE ATELIER. Every word gets real pixels, from a whole
// stable of engines instead of one.
//
// v2 (2026-07-14): one hardcoded SDXL-Turbo graph became a roster of five
// architectures (SDXL, Z-Image Turbo, FLUX.2 klein, Qwen-Image, Chroma) and
// ~25 named STYLE RECIPES (engine + checkpoint + LoRAs + prompt dressing +
// sampler math). Each word-sense's Nth image comes from a DIFFERENT recipe,
// chosen deterministically from the sense's mood affinity — so a dark word
// collects noir/surrealist takes while a euphoric word collects neon/sticker
// takes, and no two runs shuffle the assignment.
//
// Renders via local ComfyUI, uploads to R2 (lexicon/<word>/), writes URLs
// back into lexicon.json, republishes as it goes. Idempotent by image count
// per sense. Jobs are grouped by engine+checkpoint so the GPU never thrashes
// model reloads.
//
//   node scripts/lexicon/art.mjs --per-sense 4 --limit 300
//   node scripts/lexicon/art.mjs --engine zimage --word neon --dry
//   node scripts/lexicon/art.mjs --recipe word-portrait --limit 5
// ═══════════════════════════════════════════════════════════════════════════

import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const PER = parseInt(args["per-sense"], 10) || 0; // explicit override; 0 = gravity budgets
const LIMIT = parseInt(args.limit, 10) || 300;
// Word gravity (curator/gravity.mjs) decides how much paint a word deserves.
const TIER_BUDGET = { heavy: 6, mid: 2, light: 0 };
const MIN_GRAVITY = args["min-gravity"] ? parseFloat(args["min-gravity"]) : 0;
const ONLY_WORDS = args.words && args.words !== true ? new Set(String(args.words).split(",").map((w) => w.trim())) : null;
const SONG = args.song && args.song !== true ? String(args.song) : null;
const perSense = (e) => (PER > 0 ? PER : TIER_BUDGET[e.gravity?.tier ?? "mid"]);
const W = 1152, H = 832; // /64 for SDXL, /16 for the DiT engines
const ROOT = new URL("../..", import.meta.url).pathname;
const LEX = join(ROOT, "src/data/lexicon.json");
const TMP = join(ROOT, "scripts/song-art/.topup-tmp");
const log = (...a) => console.error(...a);

function loadEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
// .env.local wins over .env (rotated keys land there after a reinstall).
const E = { ...loadEnv(join(ROOT, ".env")), ...loadEnv(join(ROOT, ".env.local")) };
const PUB = (E.PUBLIC_URL || "").replace(/\/$/, "");
if (!args.dry && !["ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENDPOINT", "BUCKET"].every((k) => E[k])) {
  console.error("✗ missing R2 creds in .env"); process.exit(1);
}
const rcloneEnv = {
  ...process.env, RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: E.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: E.SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: E.ENDPOINT,
};
const RCLONE = existsSync(`${process.env.HOME}/.local/bin/rclone`) ? `${process.env.HOME}/.local/bin/rclone` : "rclone";
const r2put = (local, key) => execFileSync(RCLONE, ["copyto", local, `R2:${E.BUCKET}/${key}`, "--s3-disable-checksum", "--s3-no-check-bucket"], { env: rcloneEnv, stdio: "ignore" });

const fnv1a = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };

// ═══ ENGINES — graph builders, wired exactly like ComfyUI's own templates ═══
const NEG_SDXL = "text, watermark, logo, caption, letters, low quality, deformed, oversaturated";
const NEG_ANIME = "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, cropped, worst quality, low quality, jpeg artifacts, signature, watermark, username, blurry";
const NEG_CHROMA = "This low quality greyscale unfinished sketch is inaccurate and flawed. The image is very blurred and lacks detail with excessive chromatic aberrations and artifacts.";

function sdxlGraph({ ckpt, loras = [], steps, cfg, sampler, scheduler, prompt, negative, seed }) {
  const g = {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: ckpt } },
  };
  let model = ["1", 0], clip = ["1", 1];
  loras.forEach(([name, strength], i) => {
    const id = `L${i}`;
    g[id] = { class_type: "LoraLoader", inputs: { model, clip, lora_name: name, strength_model: strength, strength_clip: strength } };
    model = [id, 0]; clip = [id, 1];
  });
  Object.assign(g, {
    "2": { class_type: "CLIPTextEncode", inputs: { clip, text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip, text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model, positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps, cfg, sampler_name: sampler, scheduler, denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "lexart" } },
  });
  return g;
}

function zimageGraph({ prompt, seed }) {
  return {
    "u": { class_type: "UNETLoader", inputs: { unet_name: "z_image_turbo_bf16.safetensors", weight_dtype: "default" } },
    "ms": { class_type: "ModelSamplingAuraFlow", inputs: { model: ["u", 0], shift: 3 } },
    "c": { class_type: "CLIPLoader", inputs: { clip_name: "qwen_3_4b_fp8_mixed.safetensors", type: "lumina2", device: "default" } },
    "p": { class_type: "CLIPTextEncode", inputs: { clip: ["c", 0], text: prompt } },
    "n": { class_type: "ConditioningZeroOut", inputs: { conditioning: ["p", 0] } },
    "v": { class_type: "VAELoader", inputs: { vae_name: "flux1_ae.safetensors" } },
    "l": { class_type: "EmptySD3LatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["ms", 0], positive: ["p", 0], negative: ["n", 0], latent_image: ["l", 0], seed, steps: 8, cfg: 1, sampler_name: "res_multistep", scheduler: "simple", denoise: 1 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["v", 0] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "lexart" } },
  };
}

function flux2Graph({ prompt, seed }) {
  return {
    "u": { class_type: "UNETLoader", inputs: { unet_name: "flux-2-klein-4b.safetensors", weight_dtype: "default" } },
    "c": { class_type: "CLIPLoader", inputs: { clip_name: "qwen_3_4b_fp8_mixed.safetensors", type: "flux2", device: "default" } },
    "p": { class_type: "CLIPTextEncode", inputs: { clip: ["c", 0], text: prompt } },
    "n": { class_type: "ConditioningZeroOut", inputs: { conditioning: ["p", 0] } },
    "g": { class_type: "CFGGuider", inputs: { model: ["u", 0], positive: ["p", 0], negative: ["n", 0], cfg: 1 } },
    "sc": { class_type: "Flux2Scheduler", inputs: { steps: 4, width: W, height: H } },
    "ks": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } },
    "rn": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "l": { class_type: "EmptyFlux2LatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["rn", 0], guider: ["g", 0], sampler: ["ks", 0], sigmas: ["sc", 0], latent_image: ["l", 0] } },
    "v": { class_type: "VAELoader", inputs: { vae_name: "flux2_vae.safetensors" } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["v", 0] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "lexart" } },
  };
}

function qwenGraph({ prompt, seed }) {
  return {
    "u": { class_type: "UNETLoader", inputs: { unet_name: "qwen_image_fp8_e4m3fn.safetensors", weight_dtype: "default" } },
    "lo": { class_type: "LoraLoaderModelOnly", inputs: { model: ["u", 0], lora_name: "Qwen-Image-Lightning-4steps-V2.0-bf16.safetensors", strength_model: 1 } },
    "ms": { class_type: "ModelSamplingAuraFlow", inputs: { model: ["lo", 0], shift: 3.1 } },
    "c": { class_type: "CLIPLoader", inputs: { clip_name: "qwen_2.5_vl_7b_fp8_scaled.safetensors", type: "qwen_image", device: "default" } },
    "p": { class_type: "CLIPTextEncode", inputs: { clip: ["c", 0], text: prompt } },
    "n": { class_type: "CLIPTextEncode", inputs: { clip: ["c", 0], text: "" } },
    "v": { class_type: "VAELoader", inputs: { vae_name: "qwen_image_vae.safetensors" } },
    "l": { class_type: "EmptySD3LatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["ms", 0], positive: ["p", 0], negative: ["n", 0], latent_image: ["l", 0], seed, steps: 4, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 1 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["v", 0] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "lexart" } },
  };
}

function chromaGraph({ prompt, negative, seed }) {
  return {
    "u": { class_type: "UNETLoader", inputs: { unet_name: "Chroma1-HD-fp8mixed.safetensors", weight_dtype: "default" } },
    "ms": { class_type: "ModelSamplingAuraFlow", inputs: { model: ["u", 0], shift: 1 } },
    "c": { class_type: "CLIPLoader", inputs: { clip_name: "t5xxl_fp8_e4m3fn_scaled.safetensors", type: "chroma", device: "default" } },
    "p": { class_type: "CLIPTextEncode", inputs: { clip: ["c", 0], text: prompt } },
    "n": { class_type: "CLIPTextEncode", inputs: { clip: ["c", 0], text: negative || NEG_CHROMA } },
    "g": { class_type: "CFGGuider", inputs: { model: ["ms", 0], positive: ["p", 0], negative: ["n", 0], cfg: 3.5 } },
    "sc": { class_type: "BasicScheduler", inputs: { model: ["ms", 0], scheduler: "beta", steps: 20, denoise: 1 } },
    "ks": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } },
    "rn": { class_type: "RandomNoise", inputs: { noise_seed: seed } },
    "l": { class_type: "EmptySD3LatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["rn", 0], guider: ["g", 0], sampler: ["ks", 0], sigmas: ["sc", 0], latent_image: ["l", 0] } },
    "v": { class_type: "VAELoader", inputs: { vae_name: "flux1_ae.safetensors" } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["v", 0] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "lexart" } },
  };
}

// ═══ RECIPES — the style shelf. moods: which affinity buckets a recipe suits
// (dark / sad / warm / bright; "any" = always eligible). dress() turns a raw
// imagery prompt (+ the word itself) into the styled prompt.
const CKPT_TURBO = "sdxl_turbo_1.0_fp16.safetensors";
const CKPT_JUGG = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors";
const CKPT_DREAM = "DreamShaperXL_Turbo_v2_1.safetensors";
const CKPT_ANIM = "animagine-xl-4.0-opt.safetensors";
const LIGHTNING8 = "sdxl_lightning_8step_lora.safetensors";
const TURBO = { steps: 4, cfg: 1, sampler: "euler_ancestral", scheduler: "normal" };
const LIT8 = { steps: 8, cfg: 1.5, sampler: "euler", scheduler: "sgm_uniform" };
const DS_TURBO = { steps: 7, cfg: 2, sampler: "dpmpp_sde", scheduler: "karras" };

const RECIPES = [
  // ── SDXL Turbo — the fast baseline, two grades
  { id: "cinema", engine: "sdxl", moods: ["any"], sdxl: { ckpt: CKPT_TURBO, ...TURBO },
    dress: (p) => `${p}, cinematic still, moody atmospheric lighting, film grain, shallow depth of field, no text, no people` },
  { id: "noir", engine: "sdxl", moods: ["dark", "sad"], sdxl: { ckpt: CKPT_TURBO, ...TURBO },
    dress: (p) => `${p}, black and white film noir photograph, hard chiaroscuro light, deep shadows, 35mm grain, no text` },
  // ── Z-Image Turbo — the photoreal engine
  { id: "photo", engine: "zimage", moods: ["any"],
    dress: (p) => `Documentary photograph of ${p}. Natural light, shallow depth of field, subtle shadows, unfiltered, real life.` },
  { id: "neon-night", engine: "zimage", moods: ["dark", "bright"],
    dress: (p) => `Night street photograph of ${p}. Neon reflections on wet asphalt, cinematic teal and magenta palette, light rain, moody urban atmosphere.` },
  // ── FLUX.2 klein — the composition engine
  { id: "dream-collage", engine: "flux2", moods: ["any"],
    dress: (p) => `Surreal composition: ${p}. Impossible scale, dreamlike juxtaposition, floating elements, soft volumetric haze, highly detailed.` },
  { id: "poster", engine: "flux2", moods: ["bright"],
    dress: (p) => `Minimalist graphic poster of ${p}. Bold geometric shapes, flat color fields, strong diagonal composition, high contrast, screen-print texture.` },
  // ── Qwen-Image — the typography engine: paints THE WORD into the scene
  { id: "word-portrait", engine: "qwen", moods: ["any"],
    dress: (p, word) => `${p}. Integrated into the scene, the word "${word}" appears as elegant hand-painted lettering that belongs to the world of the image, cinematic light.` },
  { id: "word-neon", engine: "qwen", moods: ["dark", "bright"],
    dress: (p, word) => `${p}. A glowing neon sign reading "${word}" hangs in the scene, its light reflecting on nearby surfaces, night atmosphere, cinematic.` },
  // ── Chroma — the art-school wildcard (slow: used sparingly by weight)
  { id: "dark-surreal", engine: "chroma", moods: ["dark", "sad"],
    dress: (p) => `An unfiltered surrealist painting of ${p}. Dark dreamlike atmosphere, rich canvas texture, deep shadow, muted palette with one burning accent color.` },
  { id: "oil-light", engine: "chroma", moods: ["warm", "bright"],
    dress: (p) => `A luminous oil painting of ${p}. Thick impasto brushwork, dramatic golden light, deep color, gallery quality.` },
  // ── Juggernaut — cinematic photoreal
  { id: "film-still", engine: "sdxl", moods: ["any"], sdxl: { ckpt: CKPT_JUGG, loras: [[LIGHTNING8, 1]], ...LIT8 },
    dress: (p) => `${p}, cinematic film still, anamorphic lens, dramatic rim lighting, photorealistic, color graded, no text` },
  { id: "analog", engine: "sdxl", moods: ["warm", "sad"], sdxl: { ckpt: CKPT_JUGG, loras: [[LIGHTNING8, 1], ["analog_redmond_v2.safetensors", 0.9]], ...LIT8 },
    dress: (p) => `${p}, AnalogRedmAF, analog film photograph, faded kodak colors, light leak, grain, nostalgic, no text` },
  // ── DreamShaper Turbo — the illustration stable (carries most style LoRAs)
  { id: "concept-art", engine: "sdxl", moods: ["any"], sdxl: { ckpt: CKPT_DREAM, ...DS_TURBO },
    dress: (p) => `${p}, epic fantasy concept art, matte painting, volumetric light, intricate detail, no text` },
  { id: "watercolor", engine: "sdxl", moods: ["sad", "warm"], sdxl: { ckpt: CKPT_DREAM, loras: [["watercolor_sdxl.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `${p}, delicate watercolor painting, soft color washes, wet paper texture, white margins, no text` },
  { id: "storybook", engine: "sdxl", moods: ["warm"], sdxl: { ckpt: CKPT_DREAM, loras: [["storybook_redmond_v2.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `${p}, KidsRedmAF, warm children's storybook illustration, soft edges, gentle palette, no text` },
  { id: "papercut", engine: "sdxl", moods: ["warm", "bright"], sdxl: { ckpt: CKPT_DREAM, loras: [["papercut_sdxl.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `papercut of ${p}, layered paper craft, depth between layers, clean silhouettes, soft studio shadow, no text` },
  { id: "3d-toy", engine: "sdxl", moods: ["bright"], sdxl: { ckpt: CKPT_DREAM, loras: [["3d_render_style_xl.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `${p}, 3d style, cute 3d render, soft studio lighting, smooth materials, pastel palette, no text` },
  { id: "pixel", engine: "sdxl", moods: ["bright", "dark"], sdxl: { ckpt: CKPT_DREAM, loras: [["pixel-art-xl.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `pixel, pixel art of ${p}, 16-bit videogame scene, limited palette, crisp dithering, no text` },
  { id: "stickers", engine: "sdxl", moods: ["bright"], sdxl: { ckpt: CKPT_DREAM, loras: [["stickers_redmond.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `${p}, StickersRedmond, die-cut sticker, bold outlines, vibrant flat colors, white border, no text` },
  { id: "chalkboard", engine: "sdxl", moods: ["warm", "sad"], sdxl: { ckpt: CKPT_DREAM, loras: [["chalkboard_drawing.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `A colorful ChalkBoardDrawing of ${p}, chalk strokes on dark slate, dusty texture, hand-drawn, no text` },
  { id: "neon-sign", engine: "sdxl", moods: ["dark", "bright"], sdxl: { ckpt: CKPT_DREAM, loras: [["neon_sign_style.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `${p} as a glowing neon sign, PE_NeonSignStyle, electric glow on dark brick wall, night, no text` },
  { id: "stained-glass", engine: "sdxl", moods: ["warm", "dark"], sdxl: { ckpt: CKPT_DREAM, loras: [["stained_glass_portrait.safetensors", 0.85]], ...DS_TURBO },
    dress: (p) => `Stained Glass Portrait of ${p}, luminous colored glass panels, black lead lines, backlit, cathedral light, no text` },
  { id: "graphic-novel", engine: "sdxl", moods: ["dark"], sdxl: { ckpt: CKPT_DREAM, loras: [["graphic_novel_illustration.safetensors", 0.9]], ...DS_TURBO },
    dress: (p) => `graphic novel illustration of ${p}, inked shadows, halftone shading, dramatic panel composition, muted colors, no text` },
  // ── Animagine — the anime dialect
  { id: "anime", engine: "sdxl", moods: ["any"], sdxl: { ckpt: CKPT_ANIM, loras: [[LIGHTNING8, 1]], ...LIT8, negative: NEG_ANIME },
    dress: (p) => `${p}, masterpiece, high score, anime illustration, scenery, cinematic lighting, detailed background` },
  { id: "manga-line", engine: "sdxl", moods: ["dark", "sad"], sdxl: { ckpt: CKPT_ANIM, loras: [[LIGHTNING8, 1], ["lineani_redmond_v2.safetensors", 0.9]], ...LIT8, negative: NEG_ANIME },
    dress: (p) => `${p}, LineAniAF, clean line art, monochrome manga illustration, ink hatching, high contrast` },
];

// mood string (from song overallMood) → affinity bucket
function moodBucket(emotion) {
  const e = (emotion || "").toLowerCase();
  if (/dark|angry|aggress|brood|sinister|haunt|ominous|tense|fear|menac|rage/.test(e)) return "dark";
  if (/melanchol|sad|sorrow|longing|grief|bittersweet|wistful|lonel|yearn|regret|somber/.test(e)) return "sad";
  if (/nostalg|warm|tender|love|romantic|intimate|hope|gentle|peace|serene|dream|calm|reflect/.test(e)) return "warm";
  if (/euphor|uplift|joy|happy|celebrat|energetic|playful|triumph|empower|confident|fierce|party|dance|excit/.test(e)) return "bright";
  return "any";
}

// deterministic recipe rotation: the k-th image of (word, sense) draws the
// k-th distinct recipe from the sense's eligible pool, offset by a word hash.
function recipesFor(word, senseIdx, emotion) {
  const bucket = moodBucket(emotion);
  const pool = RECIPES.filter((r) => r.moods.includes("any") || r.moods.includes(bucket));
  const off = fnv1a(`${word}|${senseIdx}`) % pool.length;
  return (k) => pool[(off + k) % pool.length];
}

// ═══ render plumbing ═══
const ENGINE_GRAPH = { sdxl: sdxlGraph, zimage: zimageGraph, flux2: flux2Graph, qwen: qwenGraph, chroma: chromaGraph };
// group order: cheap+shared models first, heavyweights (qwen 19GB, chroma 20-step) last
const ENGINE_ORDER = ["sdxl", "zimage", "flux2", "chroma", "qwen"];

function buildGraph(job) {
  const { recipe, prompt, seed } = job;
  if (recipe.engine === "sdxl") {
    const s = recipe.sdxl;
    return sdxlGraph({ ...s, loras: s.loras || [], negative: s.negative || NEG_SDXL, prompt, seed });
  }
  return ENGINE_GRAPH[recipe.engine]({ prompt, seed, negative: recipe.negative });
}

async function generate(job) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: buildGraph(job) }) });
  if (!q.ok) throw new Error(`queue ${q.status}: ${(await q.text()).slice(0, 300)}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 600; i++) { // up to 10 min — first load of a 19GB engine reads from disk
    await new Promise((r) => setTimeout(r, 1000));
    const entry = (await (await fetch(`${HOST}/history/${prompt_id}`)).json())[prompt_id];
    if (entry?.status?.completed || entry?.outputs?.["7"]) {
      const img = entry.outputs?.["7"]?.images?.[0];
      if (!img) throw new Error("no image");
      const res = await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`);
      return Buffer.from(await res.arrayBuffer());
    }
    if (entry?.status?.status_str === "error") throw new Error("comfy: " + JSON.stringify(entry.status).slice(0, 300));
  }
  throw new Error("timeout");
}

// ═══ main ═══
mkdirSync(TMP, { recursive: true });
const lex = JSON.parse(readFileSync(LEX, "utf8"));
// Heaviest words first — gravity, then freq. Light words get no budget at all
// (unless explicitly named via --word/--words, which is the owner insisting).
const entries = Object.values(lex.entries)
  .sort((a, b) => (b.gravity?.score ?? 0.5) - (a.gravity?.score ?? 0.5) || b.freq - a.freq);
let unpublished = 0;
const save = (publish = false) => {
  writeFileSync(LEX, JSON.stringify(lex, null, 2));
  if (args.dry) return;
  unpublished++;
  if (publish || unpublished >= 10) { r2put(LEX, "lexicon.json"); unpublished = 0; }
};
// slots already rendered for a sense, parsed from its image URLs (s<i>-<k+1>[-recipe].webp)
const takenSlots = (s, i) => {
  const t = new Set();
  for (const u of s.images || []) {
    const m = String(u).match(new RegExp(`/s${i}-(\\d+)(?:-[a-z0-9-]+)?\\.webp$`));
    if (m) t.add(parseInt(m[1], 10) - 1);
  }
  return t;
};

// 1) collect jobs (deterministic), 2) group by engine+ckpt, 3) render
const jobs = [];
for (const e of entries) {
  if (jobs.length >= LIMIT) break;
  const named = (args.word && e.word === args.word) || ONLY_WORDS?.has(e.word);
  if (args.word && e.word !== args.word) continue;
  if (ONLY_WORDS && !ONLY_WORDS.has(e.word)) continue;
  if (SONG && !e.sources.includes(SONG)) continue;
  if ((e.gravity?.score ?? 0.5) < MIN_GRAVITY && !named) continue;
  const target = named ? Math.max(perSense(e), 2) : perSense(e);
  if (target <= 0) continue; // light words earn no paint
  for (let i = 0; i < e.senses.length && jobs.length < LIMIT; i++) {
    const s = e.senses[i];
    s.images ??= [];
    const prompts = (s.imageryPrompts || []).filter(Boolean);
    if (!prompts.length) prompts.push(`${e.word}, ${s.emotion.toLowerCase()} mood`);
    const pick = recipesFor(e.word, i, s.emotion);
    const taken = takenSlots(s, i);
    for (let k = 0; k < target && jobs.length < LIMIT; k++) {
      if (taken.has(k) || s.images.length >= target) continue;
      // reroll: when the curator prunes a slot it bumps s.reroll["<slot>"], so
      // the replacement draws a different recipe + prompt + seed + filename —
      // without a bump the deterministic seed would repaint the exact same image.
      const bump = s.reroll?.[String(k + 1)] || 0;
      const recipe = pick(k + bump);
      if (args.engine && recipe.engine !== args.engine) continue;
      if (args.recipe && recipe.id !== args.recipe) continue;
      jobs.push({
        entry: e, sense: s, senseIdx: i, k, bump, recipe,
        prompt: recipe.dress(prompts[(k + bump) % prompts.length], e.word),
        seed: fnv1a(`${e.word}|${i}|${k}${bump ? `#${bump}` : ""}`),
      });
    }
  }
}
const modelKey = (j) => `${ENGINE_ORDER.indexOf(j.recipe.engine)}:${j.recipe.sdxl?.ckpt || j.recipe.engine}:${(j.recipe.sdxl?.loras || []).map((l) => l[0]).join("+")}`;
jobs.sort((a, b) => modelKey(a).localeCompare(modelKey(b)));

const byRecipe = {};
jobs.forEach((j) => { byRecipe[j.recipe.id] = (byRecipe[j.recipe.id] || 0) + 1; });
log(`atelier: ${entries.length} words · ${jobs.length} jobs queued (${PER > 0 ? `per-sense ${PER}` : "gravity budgets h6/m2/l0"}, limit ${LIMIT})`);
log(`  recipes: ${Object.entries(byRecipe).map(([k, v]) => `${k}×${v}`).join(" · ")}`);

let done = 0, fail = 0;
for (const job of jobs) {
  const { entry: e, sense: s, senseIdx: i, k, recipe, prompt, seed } = job;
  if (args.dry) { log(`  [dry] ${e.word} s${i}#${k} ${recipe.id}: ${prompt.slice(0, 100)}`); done++; continue; }
  try {
    const buf = await generate(job);
    const key = `lexicon/${e.word}/s${i}-${k + 1}-${recipe.id}${job.bump ? `-r${job.bump}` : ""}.webp`;
    const tmp = join(TMP, `lex-${e.word}-${i}-${k + 1}.webp`);
    await sharp(buf).webp({ quality: 82 }).toFile(tmp);
    r2put(tmp, key);
    try { unlinkSync(tmp); } catch { /* temp cleanup best-effort */ }
    s.images.push(`${PUB}/${key}`);
    done++;
    log(`  [${done}/${jobs.length}] ${e.word} s${i}#${k} ${recipe.id} → ${key}`);
    save();
  } catch (err) { fail++; log(`  ERROR ${e.word} s${i}#${k} ${recipe.id}: ${err.message}`); }
}
if (args.dry) log("(dry run — no images generated)");
else save(true);
log(`\natelier done: ${done} rendered, ${fail} failed → lexicon.json updated + published`);
