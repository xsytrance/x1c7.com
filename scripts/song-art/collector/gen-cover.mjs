#!/usr/bin/env node
// Create original cover art for tracks that never had any — ComfyUI (SDXL Turbo)
// base art in the song's established visual voice + baked title typography.
//
//   node gen-cover.mjs --gen amor-de-verdad          # render candidates → gen/
//   node gen-cover.mjs --pick amor-de-verdad 3       # typeset title onto candidate 3
//                                                    #   → originals/<Cover Name>.png

import sharp from "sharp";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const GEN = join(HERE, "gen");
mkdirSync(GEN, { recursive: true });
const HOST = "http://localhost:8188";
const CKPT = "sdxl_turbo_1.0_fp16.safetensors";
const NEG = "person, people, face, hands, text, words, letters, watermark, logo, signature, low quality, blurry, deformed";

const TRACKS = {
  "amor-de-verdad": {
    coverName: "Amor De Verdad.png",
    style: "cinematic still life photography, intimate night bedroom to first dawn light, warm phone-screen and candle glow, gauzy curtains, rumpled linen, terracotta and rose-gold against deep indigo, soft film grain, tender atmosphere, symbolic still life, no people",
    scenes: [
      "a phone glowing softly at 3 AM on rumpled indigo linen, a single candle burning low, gauzy curtain stirring, first hint of rose-gold dawn at the window edge",
      "two small coffee cups side by side on a windowsill at first dawn light, steam rising, gauzy curtains, warm gold morning seeping over deep indigo shadows",
      "an unmade bed split by light — one half in deep indigo candlelit night, the other half touched by warm terracotta sunrise through gauzy curtains",
    ],
    title: {
      lines: ["Amor", "De Verdad"], font: "Great Vibes", sizes: [230, 150],
      fill: ["#f6d7b0", "#e8b88a"], y: 0.16, artist: true,
    },
  },
};

function graph(prompt, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: NEG } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
    "5": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 4, cfg: 1.0, sampler_name: "euler_ancestral", scheduler: "normal", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "cover" } },
  };
}

async function generate(prompt, seed) {
  const q = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: graph(prompt, seed) }) });
  if (!q.ok) throw new Error(`queue ${q.status}: ${await q.text()}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 700));
    const h = await (await fetch(`${HOST}/history/${prompt_id}`)).json();
    const entry = h[prompt_id];
    if (!entry?.outputs) continue;
    for (const out of Object.values(entry.outputs)) {
      const img = out.images?.[0];
      if (!img) continue;
      const res = await fetch(`${HOST}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`);
      return Buffer.from(await res.arrayBuffer());
    }
  }
  throw new Error("timeout waiting for ComfyUI");
}

const seedOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const mode = process.argv[2], slug = process.argv[3];
const T = TRACKS[slug];
if (!T) { console.error(`unknown slug; have: ${Object.keys(TRACKS).join(", ")}`); process.exit(1); }

if (mode === "--gen") {
  let n = 0;
  for (const [si, scene] of T.scenes.entries()) {
    for (const v of [0, 1]) {
      const buf = await generate(`${scene}, ${T.style}`, seedOf(`${slug}-${si}-${v}`));
      const f = join(GEN, `${slug}-${si}${v ? "b" : "a"}.png`);
      writeFileSync(f, buf);
      console.error(`✔ candidate ${++n}: ${f}`);
    }
  }
} else if (mode === "--pick") {
  const cand = process.argv[4];
  const src = join(GEN, `${slug}-${cand}.png`);
  const W = 2048;
  const t = T.title;
  const y0 = Math.round(W * t.y);
  const lines = t.lines.map((ln, i) => {
    const yy = y0 + t.sizes.slice(0, i).reduce((a, s) => a + s * 0.98, 0);
    return `<text x="${W / 2}" y="${yy + t.sizes[i]}" font-family="${t.font}" font-size="${t.sizes[i]}" fill="url(#tg)" text-anchor="middle" style="paint-order:stroke" stroke="#1a0e08" stroke-width="7" stroke-opacity="0.5">${esc(ln)}</text>`;
  }).join("");
  const totalH = t.sizes.reduce((a, s) => a + s * 0.98, 0);
  const artistY = y0 + totalH + 130;
  const svg = `<svg width="${W}" height="${W}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${t.fill[0]}"/><stop offset="1" stop-color="${t.fill[1]}"/>
    </linearGradient></defs>
    <rect x="0" y="0" width="${W}" height="${Math.round(W * 0.42)}" fill="url(#fade)"/>
    <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d0820" stop-opacity="0.55"/><stop offset="1" stop-color="#0d0820" stop-opacity="0"/>
    </linearGradient></defs>
    ${lines}
    ${t.artist ? `<text x="${W / 2}" y="${artistY}" font-family="Barlow Condensed Medium" font-size="52" letter-spacing="26" fill="#e8d5c0" text-anchor="middle" opacity="0.9">x s y t r a n c e</text>
    <line x1="${W / 2 - 260}" y1="${artistY - 86}" x2="${W / 2 - 110}" y2="${artistY - 86}" stroke="#e8b88a" stroke-width="3" opacity="0.7"/>
    <line x1="${W / 2 + 110}" y1="${artistY - 86}" x2="${W / 2 + 260}" y2="${artistY - 86}" stroke="#e8b88a" stroke-width="3" opacity="0.7"/>` : ""}
  </svg>`;
  const art = await sharp(src).resize(W, W, { kernel: "lanczos3" }).toBuffer();
  const outPath = join(HERE, "originals", T.coverName);
  await sharp(art).composite([{ input: Buffer.from(svg) }]).png({ compressionLevel: 9 }).toFile(outPath);
  console.error(`✔ original written: ${outPath}`);
} else {
  console.error("usage: gen-cover.mjs --gen <slug> | --pick <slug> <candidate>");
}
