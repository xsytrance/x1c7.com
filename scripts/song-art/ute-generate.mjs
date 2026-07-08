#!/usr/bin/env node
// "Under The Elevated" — the full symbolic art set, hand-authored prompts.
// Addiction & struggle told in objects and light: no people, no faces, ever.
// Generates keyword art (word.webp + word-2.webp twins) and section-mood
// backdrops via local ComfyUI (SDXL Turbo), then uploads straight to R2.
//
// Usage: node scripts/song-art/ute-generate.mjs [--host http://localhost:8188]
//        [--only <word>] [--dry] [--skip-upload]

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { AwsClient } from "aws4fetch";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const SLUG = "under-the-elevated";
const OUT = join(HERE, "ute-out");
mkdirSync(OUT, { recursive: true });

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const HOST = args.host || "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const W = 1152, H = 832;
const log = (...a) => console.error(...a);

// One visual voice for the whole planet: night NYC under the elevated, neon +
// sodium light, rain-slick, symbolic still life. NEVER a person or face.
const STYLE = "cinematic night photography, under elevated subway tracks New York, moody chiaroscuro, neon and sodium vapor glow, rain-slick surfaces, heavy atmosphere, film grain, symbolic still life, no people";
const NEG = "person, people, face, faces, portrait, man, woman, body, hands, fingers, text, words, letters, watermark, logo, signature, cartoon, anime, low quality, blurry";

// ── Keyword art: the sung words that summon a painting ──────────────────────
const KEYWORDS = [
  ["elevated", "rusted elevated train tracks overhead at night, steel columns receding, sodium light through the girders, empty street below"],
  ["dragon", "cigarette smoke curling into the shape of a dragon in a dark room, single shaft of neon light"],
  ["fire", "a single struck match burning in total darkness, close up, warm glow"],
  ["smoke", "grey smoke trapped swirling inside a corked glass bottle on a table, dark room"],
  ["chapel", "corner bodega storefront glowing at night like a shrine, votive candle glow in the window, wet sidewalk reflection"],
  ["glass", "one whiskey glass half full on a bar counter at midnight, backlit amber, everything else in shadow"],
  ["drink", "amber liquor pouring into a glass in slow motion, black background, droplets suspended"],
  ["cage", "an ornate iron birdcage with its door hanging open, empty, one feather on the floor beneath it"],
  ["chain", "a heavy rusted chain with one link snapped clean and glinting, on wet concrete"],
  ["prison", "hard bars of light and shadow cast through window blinds onto a bare wall, cinematic"],
  ["poison", "a beautiful cut-crystal bottle of dark liquid glowing violet on a shelf, seductive light"],
  ["bottle", "empty glass bottles lined on a windowsill catching city neon, night skyline blurred beyond"],
  ["train", "empty subway car interior at night, flickering fluorescent light, scratched windows, no passengers"],
  ["ghost", "an empty grey hoodie shaped as if worn, dissolving into fog under a streetlamp"],
  ["liar", "a cracked mirror on a wall reflecting only a red neon sign, shards on the dresser below"],
  ["truth", "a single bare lightbulb burning painfully bright in a dark empty room, cord swinging"],
  ["sorrow", "heavy rain streaking down a window pane at night, blurred city lights beyond like tears"],
  ["tomorrow", "first grey-gold light of dawn breaking over Brooklyn rooftops and water towers"],
  ["home", "one warm lit window in a dark brick apartment building at night, fire escape zigzag"],
  ["light", "a small lamp left glowing by an open apartment door, warm spill into a dark hallway"],
  ["morning", "low golden morning sun down an empty avenue, long shadows, steam rising from a manhole"],
  ["bridge", "a bridge in heavy rain and fog at night, cables vanishing upward, one span in flames reflected in the river"],
  ["rain", "rain hammering wet asphalt at night, neon signs reflected in the puddles, no one around"],
  ["money", "crumpled dollar bills on a bodega counter under harsh fluorescent light, card reader glowing"],
  ["pain", "barbed wire wrapped tight around a red paper heart, dark background, single spotlight"],
  ["craving", "a moth circling a bare flame in the dark, wings lit from below, motion blur"],
  ["heart", "a red paper heart lying face-down on worn wooden floorboards, moonlight through blinds"],
  ["free", "a flock of birds bursting out of an open cage into a night sky over elevated tracks, silhouettes"],
];

// ── Section-mood backdrops: the emotional weather behind each act ───────────
const SECTIONS = [
  ["melancholy", "empty late-night subway platform, one flickering light, mist, long exposure emptiness"],
  ["temptation", "a corner store beer fridge glowing seductively in a dark shop, halo of cold light"],
  ["denial", "a calm tidy apartment at night, everything in place, one drawer slightly open glowing faintly red"],
  ["desperation", "a payphone receiver hanging off the hook swinging under the elevated tracks at 3am, rain"],
  ["defiance", "sunrise cutting hard gold light between elevated train girders, steel silhouetted, hopeful"],
  ["breaking", "a glass shattering on a kitchen floor frozen mid-burst, shards catching blue night light"],
  ["confession", "a bare kitchen table at night with an open notebook and a burned-down candle, honest light"],
  ["hope", "the elevated tracks at dawn with the rails catching pink-gold first light, mist lifting, empty and clean"],
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
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "ute" } },
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
