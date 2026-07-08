#!/usr/bin/env node
// "Amor De Verdad" — gallery doubler. The show pools extra per-word variants
// from planets/<slug>/gallery.json; the old pool still held the pre-redo art.
// This regenerates the pool in the new visual voice (2 fresh variants per
// keyword/section = 28, on top of the 28 base+twin images → 56 total), writes
// a gallery.json that lists ONLY the new set, and deletes the old gallery
// objects from R2. Same voice, same graph as amor-generate.mjs.
//
// Usage: node scripts/song-art/amor-gallery.mjs [--host http://localhost:8188]
//        [--dry] [--skip-upload]

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { AwsClient } from "aws4fetch";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const SLUG = "amor-de-verdad";
const OUT = join(HERE, "amor-out", "gallery");
mkdirSync(OUT, { recursive: true });

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const log = (...a) => console.error(...a);
// Gallery keys are the diacritic/punctuation-stripped form the engine looks up.
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

const STYLE = "cinematic still life photography, intimate night bedroom to first dawn light, warm phone-screen and candle glow, gauzy curtains, rumpled linen, terracotta and rose-gold against deep indigo, soft film grain, tender atmosphere, symbolic still life, no people";
const NEG = "person, people, face, faces, portrait, man, woman, body, hands, fingers, text, words, letters, watermark, logo, signature, cartoon, anime, low quality, blurry";

// Same scenes as amor-generate.mjs; the pool varies them by composition.
const SCENES = [
  ["temble", "ripples trembling across the surface of a full teacup, warm lamplight from the side, dark room, extreme close up"],
  ["amor-de-verdad", "two intertwined gold rings on rumpled linen catching the first ray of dawn through gauzy curtains"],
  ["te", "two cups of tea steaming side by side on a windowsill at dawn, rose-gold light through gauze curtains"],
  ["aguas", "rain droplets sliding down a dark window pane at night, blurred warm city lights beyond like embers"],
  ["gasolina", "a lone gas station glowing warm at 3am, one pump under rose-gold sodium light, empty rain-wet street"],
  ["quedate", "a front door left ajar at night, warm lamplight spilling through the gap, a coat still hanging on its hook"],
  ["sol", "first sunlight breaking through gauzy curtains into a dark bedroom, dust motes glowing gold in the beam"],
  ["hope", "a thin gold line of dawn breaking over city rooftops seen from a bedroom window, indigo sky lifting"],
  ["yearning", "an empty unmade bed in moonlight, one pillow untouched, deep indigo shadows, rose-gold streetlight glow"],
  ["skepticism", "a phone lying face-down on a nightstand in the dark, a thin sliver of notification light escaping its edge"],
  ["frustration", "a cup of tea gone cold beside a tangled charger cable, hard slatted shadows across the table at 3am"],
  ["longing-for-truth", "a single bare lightbulb reflected in a dark window at 3am, far city lights beyond, honest light"],
  ["desire-for-honesty", "an open handwritten letter on rumpled linen lit by a burned-down candle, wax pooled on the saucer"],
  ["nervous-anticipation", "a phone lying face-up alone on rumpled sheets in a dark room, its glowing screen the only light, empty bed"],
];

const COMPS = ["wide establishing shot, distant view", "extreme close up, macro detail"];

function graph(prompt, negative, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: negative } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: W, height: H, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "amor-gal" } },
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

function loadEnv(f) { const o = {}; if (!existsSync(f)) return o; for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); } return o; }
const E = { ...loadEnv(join(ROOT, ".env")), ...process.env };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const r2url = (key) => `${(E.ENDPOINT || "").replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}/${encodeURI(key)}`;
async function r2put(key, body, type = "image/webp") {
  const r = await aws.fetch(r2url(key), { method: "PUT", body, headers: { "Content-Type": type } });
  if (!r.ok) throw new Error(`R2 put ${key} ${r.status}`);
}
async function r2del(key) {
  const r = await aws.fetch(r2url(key), { method: "DELETE" });
  if (!r.ok && r.status !== 404) throw new Error(`R2 delete ${key} ${r.status}`);
}

const seedOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

const jobs = [];
for (const [name, scene] of SCENES) {
  COMPS.forEach((comp, i) => {
    jobs.push({ key: norm(name), n: i + 1, prompt: `${scene}, ${comp}, ${STYLE}` });
  });
}

log(`⚛ ${jobs.length} gallery images to make${args.dry ? " (dry)" : ""}`);
if (args.dry) { jobs.forEach((j) => log(`  ${j.key}-${j.n}: ${j.prompt.slice(0, 90)}…`)); process.exit(0); }

const art = {};
let done = 0;
for (const j of jobs) {
  const file = `${j.key}-${j.n}.webp`;
  const webpPath = join(OUT, file);
  if (!existsSync(webpPath)) {
    // Offset keeps gallery seeds distinct from the base/twin set.
    const seed = (seedOf(j.key) + 104729 * j.n) >>> 0;
    const buf = await generate(j.prompt, seed);
    await sharp(buf).webp({ quality: 82 }).toFile(webpPath);
  }
  if (!args["skip-upload"]) await r2put(`planets/${SLUG}/gallery/${file}`, readFileSync(webpPath));
  (art[j.key] ??= []).push(`/planets/${SLUG}/gallery/${file}`);
  done++;
  log(`✔ ${done}/${jobs.length} ${j.key}-${j.n}`);
}

writeFileSync(join(OUT, "gallery.json"), JSON.stringify({ slug: SLUG, model: CKPT, art }, null, 2));
if (!args["skip-upload"]) {
  await r2put(`planets/${SLUG}/gallery.json`, readFileSync(join(OUT, "gallery.json")), "application/json");
  log("↑ gallery.json now lists only the new set");
}
// Optional sweep of the orphaned old pool (indices past the 2 we overwrote):
// run with --sweep after confirming — it DELETES objects from the bucket.
if (args.sweep && !args["skip-upload"]) {
  let swept = 0;
  for (const [name] of SCENES) {
    for (let n = 3; n <= 10; n++) { await r2del(`planets/${SLUG}/gallery/${norm(name)}-${n}.webp`); swept++; }
  }
  log(`🧹 swept ${swept} old gallery slots`);
}
log(`⚛ done — ${done} gallery images${args["skip-upload"] ? "" : " + uploaded"}`);
