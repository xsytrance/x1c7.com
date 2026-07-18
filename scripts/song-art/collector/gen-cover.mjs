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
  // Drum & Bass · Weightless Serene — "leaves above, the river below / days drift by,
  // floating into the sky." Tranquil daytime nature, the anti-Rooklyn correction.
  "days-drift-by": {
    coverName: "Days Drift By.png",
    style: "serene liquid drum and bass album art, tranquil daytime nature, soft diffused sunlight, sky blue and white and pale gold palette, airy weightless dreamy film photography, gentle peaceful atmosphere, no people",
    scenes: [
      "a calm river winding through a lush green valley under a clear bright blue sky, sunlight glinting on the gentle current, soft distant hills, wildflowers on the banks",
      "vast white clouds drifting slowly across a luminous sky at golden hour, warm light spilling over a mirror-still river, reeds swaying in a soft breeze",
      "a warm shaft of morning sunlight breaking through pale fog over a quiet forest river, dew on drifting leaves, weightless and serene, soft golden haze",
    ],
    title: {
      lines: ["Days", "Drift By"], font: "Cormorant Garamond", sizes: [220, 150],
      fill: ["#eef7ff", "#a9d4ee"], y: 0.13, artist: true,
    },
  },
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
  // Dance · Defiant — "Bottle glowing by my bed / Pain keeps pounding" turned into neon defiance
  "drink-drink-don-t-save-me": {
    coverName: "Drink Drink Dont Save Me.png",
    style: "cinematic nightlife still life, electric blue and hot magenta neon on deep black, wet glass reflections, club light leaking through venetian blinds, high contrast, vaporous haze, no people",
    scenes: [
      "a glass bottle glowing from within like a neon beacon on a nightstand, club lights strobing through blinds behind it, condensation drops",
      "a toppled cocktail glass mid-spill frozen in strobe light, liquid arc glowing electric blue and magenta against black",
      "a row of shot glasses on a black bar top under a single hard magenta spotlight, smoke curling, one glass knocked over",
    ],
    title: { lines: ["DRINK DRINK", "DON'T SAVE ME"], font: "Bebas Neue", sizes: [220, 110], fill: ["#7ad4ff", "#ff4fa3"], y: 0.10, artist: true },
  },
  // Deep House · Seductive — low lights, slow move
  "push-it-on-me": {
    coverName: "Push It On Me.png",
    style: "smoky minimal deep house club interior, deep slate gray with a single electric green laser line, velvet textures, low light haze, frequency ripples, moody and seductive, cinematic, no people",
    scenes: [
      "a velvet rope and a single electric green laser beam cutting through dance floor haze, empty dark club, bass speaker in shadow",
      "close up of a speaker cone vibrating with green light tracing its rim, smoke drifting, black velvet backdrop",
      "two silhouetted cocktail glasses nearly touching on a reflective black table, green laser line passing between them, haze",
    ],
    title: { lines: ["PUSH IT", "ON ME"], font: "Bebas Neue", sizes: [230, 150], fill: ["#d8f5e8", "#46e08c"], y: 0.12, artist: true },
  },
  // R&B · Intimate · recovery — restrained, hopeful, per the serious-topics rule
  "one-more-breath-back-to-myself": {
    coverName: "One More Breath.png",
    style: "quiet cinematic still life, first morning light, white gauze curtains breathing in an open window, soft warm neutrals with deep blue shadow, gentle film grain, hopeful stillness, no people",
    scenes: [
      "white curtains billowing softly in an open window at sunrise, a glass of clear water on the sill catching golden light",
      "a neatly made bed in first morning light, one deep breath of wind lifting the curtain, dust motes in a sunbeam",
      "a fogged bathroom mirror with a clear circle wiped in the center reflecting warm window light, a folded towel, morning calm",
    ],
    title: { lines: ["One More Breath", "back to myself"], font: "Cormorant Garamond", sizes: [150, 84], fill: ["#f4ede0", "#c9b896"], y: 0.12, artist: true },
  },
  // Techno · Intense — brutalist industrial pulse
  "membrane-still-insane": {
    coverName: "Membrane Still Insane.png",
    style: "brutalist industrial techno environment, raw concrete corridor, pulsing acid orange strobe, cables and steel, volumetric haze, harsh minimal geometry, cinematic, no people",
    scenes: [
      "a long raw concrete corridor with one blinding acid-orange strobe at the far end, cables running along the walls, haze",
      "a wall of industrial speakers stacked floor to ceiling in orange strobe light, concrete dust in the air",
      "a translucent vibrating membrane stretched across a steel ring, backlit acid orange, concrete wall behind, sound pressure visible as ripples",
    ],
    title: { lines: ["MEMBRANE", "STILL INSANE"], font: "Bebas Neue", sizes: [210, 130], fill: ["#f2e9e2", "#ff5a1f"], y: 0.10, artist: true },
  },
  // R&B · Playful funk slow-jam — 70s lounge with a snake in it
  "who-s-that-snake-funky-slow-jam-mix": {
    coverName: "Whos That Snake.png",
    style: "1970s funk lounge still life, warm browns oranges and disco gold bokeh, velvet couch, vinyl records, soft snakeskin texture lurking in shadow, groovy retro cinematic, film grain, no people",
    scenes: [
      "a green snake coiled around a golden microphone stand in a warm 70s lounge, disco ball bokeh, velvet curtains",
      "a snakeskin-patterned vinyl record on a turntable, warm amber lounge light, whiskey glass nearby, disco sparkle",
      "a velvet couch in warm lounge light with a subtle snake silhouette shadow cast across it, gold disco bokeh, vinyl sleeves scattered",
    ],
    title: { lines: ["Who's That", "Snake?"], font: "Great Vibes", sizes: [180, 210], fill: ["#ffdf9e", "#e8a020"], y: 0.10, artist: true },
  },
  // Pop · Playful — the birthday song
  "another-year-looks-good-on-you-happy-birthday-song": {
    coverName: "Another Year Looks Good On You.png",
    style: "joyful cinematic still life, birthday celebration at golden hour, warm champagne glow with soft pink and gold, confetti mid-air, shallow depth of field, sparkling bokeh, no people",
    scenes: [
      "a birthday cake with lit candles on a table at golden hour, confetti frozen mid-air, champagne-gold bokeh, soft pink balloons out of focus",
      "a single lit sparkler on a small cake, warm golden light, drifting confetti, celebratory sparkle bokeh",
      "champagne glasses mid-clink with golden light refracting, confetti and streamers suspended, pink and gold glow",
    ],
    title: { lines: ["Another Year", "Looks Good On You"], font: "Great Vibes", sizes: [190, 120], fill: ["#ffe9b8", "#f0b46a"], y: 0.10, artist: true },
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
