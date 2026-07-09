#!/usr/bin/env node
// "Whistle on the River" — full symbolic art redo, hand-authored prompts.
// THE RULE (owner's words): black and white world, but the money still gold.
// A river-noir gambling world — paddle steamer, fog, docks, dice and debts —
// rendered in hard monochrome; the ONLY color anywhere is the metallic gold
// of money. Same discipline as the other planets: no people, no faces, ever.
// Overwrites the existing set at the exact URLs the planet already points to.
//
// Usage: node scripts/song-art/wr-generate.mjs [--host http://localhost:8188]
//        [--only <word>] [--dry] [--skip-upload]

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { AwsClient } from "aws4fetch";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const SLUG = "whistle-on-the-river";
const OUT = join(HERE, "wr-redo-out");
mkdirSync(OUT, { recursive: true });

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const log = (...a) => console.error(...a);

// One visual voice: black-and-white river noir. Only money is allowed color —
// and that color is always gold.
const STYLE = "high-contrast black and white photography, mississippi river noir, deep blacks and silver mist, film grain, symbolic still life, no people, monochrome everything except money and gold which glow in rich saturated metallic gold, selective color";
const NEG = "person, people, face, faces, portrait, man, woman, body, hands, fingers, text, words, letters, watermark, logo, signature, cartoon, anime, low quality, blurry, rainbow, colorful scenery, sepia, vintage photograph, warm brown tones, yellowed paper";

// ── Keyword art: same words as the live planet (URLs must not change) ───────
const KEYWORDS = [
  ["whistle", "extreme close up of a brass-black riverboat steam whistle on an iron funnel mid-blast, huge plume of white steam against a pure black night sky, empty deck, no crew, strictly black and white, cold silver-grey tones"],
  ["riverboat", "a paddle-wheel steamboat silhouetted on a black glass river at night, thick fog, abandoned decks, no passengers, stark modern high-contrast black and white photograph, cold blue-grey and ink black, one row of casino windows glowing molten gold"],
  ["dock", "warped wooden dock planks vanishing into river fog at night, mooring rope coiled, black water below, monochrome, one gold coin dropped between the boards"],
  ["gold", "a battered black leather satchel spilling gold coins and gold-edged bills across a monochrome card table, the gold blazing in an otherwise black and white scene"],
  ["boys", "a row of black brimmed hats hanging on hooks in a monochrome boiler-room wall, steam drifting, one hatband holding a folded gold bill"],
  ["trouble", "playing cards frozen mid-scatter above an overturned monochrome poker table, dice in the air, one gold coin spinning bright among the grey"],
  ["foghorn", "a great iron foghorn on a mast bellowing into thick river fog, long exposure, monochrome, cold silver light"],
];

// ── Section-mood backdrops: the emotional weather behind each act ───────────
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

// SDXL Turbo txt2img graph (API format): 4 steps, cfg 1.
function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "wr" } },
  };
}

async function generate(prompt, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(prompt, NEG, seed) }) });
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
  }
  throw new Error("timeout waiting for ComfyUI");
}

// R2 upload (same signed-PUT path as feed-worker).
function loadEnv(f) { const o = {}; if (!existsSync(f)) return o; for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); } return o; }
const E = { ...loadEnv(join(ROOT, ".env")), ...process.env };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
async function r2put(key, body) {
  const r = await aws.fetch(`${(E.ENDPOINT || "").replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}/${encodeURI(key)}`, { method: "PUT", body, headers: { "Content-Type": "image/webp" } });
  if (!r.ok) throw new Error(`R2 put ${r.status}`);
}

const seedOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

const jobs = [];
for (const [word, scene] of KEYWORDS) {
  jobs.push({ name: word, prompt: `${scene}, ${STYLE}` });
  jobs.push({ name: `${word}-2`, prompt: `${scene}, alternate composition, ${STYLE}` });
}
for (const [moodName, scene] of SECTIONS) {
  jobs.push({ name: `sec-${moodName}`, prompt: `${scene}, ${STYLE}` });
}

const only = args.only && args.only !== true ? String(args.only) : null;
const todo = jobs.filter((j) => !only || j.name.startsWith(only));
log(`⚛ ${todo.length} images to make${args.dry ? " (dry)" : ""}`);
if (args.dry) { todo.forEach((j) => log(`  ${j.name}: ${j.prompt.slice(0, 90)}…`)); process.exit(0); }

const manifest = {};
let done = 0;
for (const j of todo) {
  const pngPath = join(OUT, `${j.name}.png`);
  const webpPath = join(OUT, `${j.name}.webp`);
  if (!existsSync(webpPath)) {
    const seed = seedOf(j.name) + (j.name.endsWith("-2") ? 7919 : 0);
    const buf = await generate(j.prompt, seed);
    writeFileSync(pngPath, buf);
    await sharp(buf).webp({ quality: 82 }).toFile(webpPath);
  }
  if (!args["skip-upload"]) {
    await r2put(`planets/${SLUG}/${j.name}.webp`, readFileSync(webpPath));
  }
  manifest[j.name] = { prompt: j.prompt, url: `/planets/${SLUG}/${j.name}.webp` };
  done++;
  log(`✔ ${done}/${todo.length} ${j.name}`);
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
log(`⚛ done — ${done} images generated${args["skip-upload"] ? "" : " + uploaded to R2"}`);
