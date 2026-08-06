#!/usr/bin/env node
// "Yeah It's A.I. (Why?)" — Rooklyn cover art.
//
// Same two-stage shape as gen-cover.mjs (art from ComfyUI, typography composited
// deterministically) with three deliberate departures, all forced by this brief:
//
//   1. DreamShaperXL Turbo, not SDXL Turbo. The brief asks for "ultra-detailed"
//      1920s ink illustration; sdxl_turbo at 4 steps / cfg 1.0 renders mush at
//      that level of scene description. DreamShaper is the illustration model in
//      the roster and takes real steps.
//   2. The negative prompt PERMITS a person. gen-cover.mjs bans people outright
//      ("no people" is the house still-life rule); this cover is built around a
//      figure on the dock, so the ban is lifted and replaced with anatomy guards.
//   3. Title AND label typeset. gen-cover.mjs types a title + a fixed "xsytrance"
//      artist line; this needs AGENOR over LevelReady Records at the bottom.
//
// The look is THE RULE (owner's words, scripts/song-art/backfill-planet-art.mjs):
// black and white world, but the money still gold. Applies to Whistle on the
// River and anything Rooklyn / Riverboat Boys.
//
//   node yeah-its-ai-cover.mjs --gen            # render 6 candidates → gen/
//   node yeah-its-ai-cover.mjs --pick 1b        # typeset → originals/
//   node yeah-its-ai-cover.mjs --contact        # 6-up sheet to compare

import sharp from "sharp";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const GEN = join(HERE, "gen");
const ORIGINALS = join(HERE, "originals");
mkdirSync(GEN, { recursive: true });
mkdirSync(ORIGINALS, { recursive: true });

const HOST = "http://localhost:8188";
const CKPT = "DreamShaperXL_Turbo_v2_1.safetensors";
const SLUG = "yeah-its-ai-why";
const COVER_NAME = "Yeah Its AI (Why).png";

// Shared style spine — every candidate carries the Rooklyn voice so the six
// differ by composition, not by world.
const STYLE = [
  "premium hip-hop album cover illustration",
  "ultra-detailed gritty black and white crime illustration, vintage 1920s ink and rubber-hose animation aesthetic",
  "exaggerated inky shadows, expressive warped architecture, surreal noir atmosphere, completely original characters",
  "monochrome black white and silver-gray world, selective color: ONLY gold is colored, rich saturated metallic gold that glows",
  "massive cinematic lighting, dense rolling fog, heavy film grain, scratched old-film texture, projector flicker, deep contrast",
].join(", ");

// A figure is the point of this cover, so the usual "no people" guard is gone.
// What is left guards the things that actually go wrong: lettering, colour
// leaking into the monochrome, and hands (the brief hides them in pockets).
const NEG = [
  "text, words, letters, typography, caption, watermark, logo, signature, frame, border",
  "color, colours, blue tint, red tint, green tint, sepia, teal, rainbow, saturated background",
  "visible face, portrait, facing camera, deformed hands, extra fingers, extra limbs, malformed anatomy",
  "modern clothing, tracksuit, sneakers, cartoon mascot, chibi, cute, low quality, blurry, jpeg artifacts",
].join(", ");

// The dock, six ways. Each keeps: back-turned figure, riverboat, gold-only accents.
const SCENES = [
  // 0 — the brief, straight. Wide establishing shot.
  "a rain-soaked industrial dock at night, a confident anonymous gangster seen from behind in a long trench coat and fedora, hands in pockets, back fully turned to the viewer, facing out across a dark river, an old paddle-wheel riverboat emerging through thick mist, abandoned warehouses and cargo cranes and chains and stacked shipping containers and smoke stacks behind him, fog rolling over black water, his gold chain and gold wristwatch the only glints of colour, the river surface catching long gold reflections",
  // 1 — low hero angle, boat dominant.
  "low dramatic camera angle looking up at a lone figure in a long trench coat and fedora standing at the end of a wet dock with his back to the viewer, towering paddle-wheel riverboat looming out of the fog before him lit from within, huge cranes and chains arcing overhead, rain streaking through hard light, heavy gold chain hanging at his side catching a single warm gold highlight, gold light rippling on the black river",
  // 2 — the details pass: tech relics on the boards.
  "a rain-slicked dock in deep noir shadow, a trench-coated fedora silhouette standing far back turned away toward a misty paddle-wheel riverboat, in the near foreground on the wet planks a cracked smartphone lies face up, a single keyboard key rests in a puddle, loose lyric sheets blow across the boards in the wind, a small circuit-board motif spray-painted as graffiti on a shipping container, everything black and white except gold glints on his chain and watch and gold reflections in the water",
];

function graph(prompt, seed) {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: CKPT } },
    "2": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: prompt } },
    "3": { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: NEG } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
    // DreamShaperXL Turbo's documented band: 8 steps, cfg 2, dpmpp_sde + karras.
    "5": { class_type: "KSampler", inputs: {
      model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0],
      seed, steps: 8, cfg: 2.0, sampler_name: "dpmpp_sde", scheduler: "karras", denoise: 1.0 } },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: `yeahai` } },
  };
}

async function generate(prompt, seed) {
  const q = await fetch(`${HOST}/prompt`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: graph(prompt, seed) }),
  });
  if (!q.ok) throw new Error(`queue ${q.status}: ${await q.text()}`);
  const { prompt_id } = await q.json();
  for (let i = 0; i < 300; i++) {
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
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── typeset ──────────────────────────────────────────────────────────────────
// Gold serif title top, AGENOR + label bottom. Two scrims (top and bottom) keep
// the lettering readable over whatever the fog does in that candidate.
function overlay(W) {
  const gold0 = "#ffeab0", gold1 = "#c68b21";
  const t1 = Math.round(W * 0.098);   // "Yeah It's A.I."
  const t2 = Math.round(W * 0.072);   // "(Why?)"
  const yTop = Math.round(W * 0.085);
  const agenor = Math.round(W * 0.058);
  const label = Math.round(W * 0.021);
  const yAgenor = Math.round(W * 0.885);
  const yLabel = Math.round(W * 0.928);
  const rule = (y, half) =>
    `<line x1="${W / 2 - half}" y1="${y}" x2="${W / 2 - Math.round(half * 0.38)}" y2="${y}" stroke="${gold1}" stroke-width="${Math.max(2, Math.round(W * 0.0016))}" opacity="0.85"/>
     <line x1="${W / 2 + Math.round(half * 0.38)}" y1="${y}" x2="${W / 2 + half}" y2="${y}" stroke="${gold1}" stroke-width="${Math.max(2, Math.round(W * 0.0016))}" opacity="0.85"/>`;
  return `<svg width="${W}" height="${W}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${gold0}"/><stop offset="0.55" stop-color="#e8c25e"/><stop offset="1" stop-color="${gold1}"/>
      </linearGradient>
      <linearGradient id="topfade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000000" stop-opacity="0.72"/><stop offset="1" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="botfade" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#000000" stop-opacity="0.80"/><stop offset="1" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="${Math.round(W * 0.34)}" fill="url(#topfade)"/>
    <rect x="0" y="${Math.round(W * 0.74)}" width="${W}" height="${Math.round(W * 0.26)}" fill="url(#botfade)"/>

    <text x="${W / 2}" y="${yTop + t1}" font-family="Cormorant Garamond" font-size="${t1}"
          fill="url(#tg)" text-anchor="middle" style="paint-order:stroke"
          stroke="#120a04" stroke-width="${Math.round(W * 0.0035)}" stroke-opacity="0.55">${esc("Yeah It's A.I.")}</text>
    <text x="${W / 2}" y="${yTop + t1 + Math.round(t2 * 1.18)}" font-family="Cormorant Garamond" font-size="${t2}"
          font-style="italic" fill="url(#tg)" text-anchor="middle" style="paint-order:stroke"
          stroke="#120a04" stroke-width="${Math.round(W * 0.003)}" stroke-opacity="0.55">${esc("(Why?)")}</text>

    ${rule(yAgenor - Math.round(agenor * 0.78), Math.round(W * 0.20))}
    <text x="${W / 2}" y="${yAgenor}" font-family="Bebas Neue" font-size="${agenor}"
          letter-spacing="${Math.round(W * 0.011)}" fill="url(#tg)" text-anchor="middle"
          style="paint-order:stroke" stroke="#120a04" stroke-width="${Math.round(W * 0.0022)}" stroke-opacity="0.5">AGENOR</text>
    <text x="${W / 2}" y="${yLabel}" font-family="Barlow Condensed Medium" font-size="${label}"
          letter-spacing="${Math.round(W * 0.0068)}" fill="#ded2c0" text-anchor="middle" opacity="0.92">LEVELREADY RECORDS</text>
  </svg>`;
}

const mode = process.argv[2];

if (mode === "--gen") {
  let n = 0;
  for (const [si, scene] of SCENES.entries()) {
    for (const v of [0, 1]) {
      const tag = `${si}${v ? "b" : "a"}`;
      const buf = await generate(`${scene}, ${STYLE}`, seedOf(`${SLUG}-${si}-${v}`));
      const f = join(GEN, `${SLUG}-${tag}.png`);
      writeFileSync(f, buf);
      console.error(`✔ candidate ${++n}/6 → ${tag}`);
    }
  }
} else if (mode === "--contact") {
  const cell = 512, sheet = 3;
  const tiles = [];
  for (const [si] of SCENES.entries()) for (const v of [0, 1]) tiles.push(`${si}${v ? "b" : "a"}`);
  const comps = [];
  for (const [i, tag] of tiles.entries()) {
    const p = join(GEN, `${SLUG}-${tag}.png`);
    if (!existsSync(p)) continue;
    comps.push({ input: await sharp(p).resize(cell, cell).toBuffer(), left: (i % sheet) * cell, top: Math.floor(i / sheet) * cell });
  }
  const out = join(GEN, `${SLUG}-contact.png`);
  await sharp({ create: { width: cell * sheet, height: cell * 2, channels: 3, background: "#000" } })
    .composite(comps).png().toFile(out);
  console.error(`✔ contact sheet → ${out}`);
} else if (mode === "--pick") {
  const cand = process.argv[3];
  if (!cand) { console.error("usage: --pick <candidate e.g. 1b>"); process.exit(1); }
  const src = join(GEN, `${SLUG}-${cand}.png`);
  if (!existsSync(src)) { console.error(`no such candidate: ${src}`); process.exit(1); }
  const W = 2048;
  const art = await sharp(src).resize(W, W, { kernel: "lanczos3" }).toBuffer();
  const outPath = join(ORIGINALS, COVER_NAME);
  await sharp(art).composite([{ input: Buffer.from(overlay(W)) }]).png({ compressionLevel: 9 }).toFile(outPath);
  console.error(`✔ original written: ${outPath}`);
} else {
  console.error("usage: yeah-its-ai-cover.mjs --gen | --contact | --pick <candidate>");
  process.exit(1);
}
