#!/usr/bin/env node
// OG share cards — 1200×630 link previews for /t/<slug> pages.
// Case art left, collector metadata right, the song's true waveform beneath.
// Uploads to R2 covers/og/<slug>.png (+ _music.png for the /music page).
import sharp from "sharp";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AwsClient } from "aws4fetch";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = JSON.parse(readFileSync(join(HERE, "tracks.json"), "utf8"));
const MANIFEST = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));
const byslug = new Map(MANIFEST.map((t) => [t.slug, t]));

function loadEnv(f) { const o = {}; if (!existsSync(f)) return o; for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); } return o; }
const E = { ...loadEnv(join(HERE, "..", "..", "..", ".env")), ...process.env };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;
const put = async (key, body) => {
  const r = await aws.fetch(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`, { method: "PUT", body, headers: { "Content-Type": "image/png" } });
  if (!r.ok) throw new Error(`put ${r.status} ${key}`);
};

const PALETTES = {
  RNB: ["#1b2560", "#d4af37"], HIPHOP: ["#161616", "#d4af37"], LATIN: ["#5f1519", "#e2b64a"],
  DANCEHALL: ["#5f1519", "#e2b64a"], HOUSE: ["#2b3138", "#46e08c"], ELECTRONIC: ["#07231f", "#39ffa0"],
  DANCE: ["#062024", "#3fd4ff"], TECHNO: ["#1d1d21", "#ff5a1f"], ROCK: ["#57290a", "#e8a020"],
  AFROBEAT: ["#3a2410", "#c98a2d"], POP: ["#43102f", "#ff4fa3"], SYNTHWAVE: ["#241042", "#b44dff"],
  LOFI: ["#2c3835", "#6fbfae"], AMBIENT: ["#191f38", "#c9d4e8"], CINEMATIC: ["#25272d", "#d8dce4"],
  DNB: ["#1a2026", "#46c8e0"], ARCHIVE: ["#181818", "#d4af37"],
};
function pal(genre) {
  const g = (genre || "").toLowerCase();
  if (g.includes("r&b")) return ["R&B", ...PALETTES.RNB];
  if (g.includes("hip")) return ["HIP-HOP", ...PALETTES.HIPHOP];
  if (g.includes("dancehall")) return ["DANCEHALL", ...PALETTES.DANCEHALL];
  if (g.includes("reggaeton") || g.includes("latin") || g.includes("dembow")) return ["LATIN", ...PALETTES.LATIN];
  if (g.includes("house")) return ["HOUSE", ...PALETTES.HOUSE];
  if (g.includes("techno") || g.includes("industrial")) return ["TECHNO", ...PALETTES.TECHNO];
  if (g.includes("rock") || g.includes("alternative")) return ["ROCK", ...PALETTES.ROCK];
  if (g.includes("afro")) return ["AFROBEAT", ...PALETTES.AFROBEAT];
  if (g.includes("synthwave")) return ["SYNTHWAVE", ...PALETTES.SYNTHWAVE];
  if (g.includes("lo-fi")) return ["LO-FI", ...PALETTES.LOFI];
  if (g.includes("ambient")) return ["AMBIENT", ...PALETTES.AMBIENT];
  if (g.includes("cinematic")) return ["CINEMATIC", ...PALETTES.CINEMATIC];
  if (g.includes("drum & bass") || g.includes("dnb")) return ["DRUM & BASS", ...PALETTES.DNB];
  if (g.includes("pop")) return ["POP", ...PALETTES.POP];
  if (g.includes("dance")) return ["DANCE", ...PALETTES.DANCE];
  if (g.includes("electronic")) return ["ELECTRONIC", ...PALETTES.ELECTRONIC];
  return ["AGENOR", ...PALETTES.ARCHIVE];
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const W = 1200, H = 630, CASE = 550, CX = 40, CY = 40;

// title wrap: Bebas ~0.45 width factor
function wrapTitle(title, maxW, size) {
  const words = title.toUpperCase().split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (trial.length * size * 0.45 > maxW && cur) { lines.push(cur); cur = w; }
    else cur = trial;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

async function makeOne(t) {
  const caseSrc = join(HERE, "out", `${t.slug}.png`);
  const refSrc = join(HERE, "originals", t.coverFile || "");
  const src = existsSync(caseSrc) ? caseSrc : (t.coverFile && existsSync(refSrc) ? refSrc : null);
  if (!src) return false;
  const m = byslug.get(t.slug) || t;
  const [label, baseCol, accent] = pal(t.genre);
  const caseBuf = await sharp(src).resize(CASE, CASE).toBuffer();

  const tx = CX + CASE + 46, tw = W - tx - 44;
  let size = 74;
  let lines = wrapTitle(t.title, tw, size);
  while (lines.length > 2 && size > 46) { size -= 8; lines = wrapTitle(t.title, tw, size); }
  const meta = [m.bpm && `${m.bpm} BPM`, m.runtime, t.lang, t.geo].filter(Boolean).join("   ·   ");
  const peaks = m.peaks || [];
  const waveY = 470, waveH = 90;
  let wave = "";
  if (peaks.length) {
    const lo = Math.min(...peaks), hi = Math.max(...peaks);
    const n = peaks.length, bw = tw / n;
    for (let i = 0; i < n; i++) {
      const v = Math.pow((peaks[i] - lo) / Math.max(0.001, hi - lo), 1.4) * 0.92 + 0.08;
      const h = Math.max(3, v * waveH);
      wave += `<rect x="${(tx + i * bw).toFixed(1)}" y="${(waveY - h / 2).toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${accent}" opacity="${0.35 + v * 0.6}"/>`;
    }
  }
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="0.28" cy="0.4" r="0.9">
      <stop offset="0" stop-color="${baseCol}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#08080a"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="#000" opacity="0.25"/>
  <text x="${tx}" y="102" font-family="Barlow Condensed SemiBold" font-size="26" letter-spacing="12" fill="#d4af37">AGENOR PRESENTS</text>
  ${lines.map((ln, i) => `<text x="${tx}" y="${168 + i * (size + 10)}" font-family="Bebas Neue" font-size="${size}" fill="#f2ede2">${esc(ln)}</text>`).join("")}
  <rect x="${tx}" y="${170 + lines.length * (size + 10)}" width="${label.length * 15 + 28}" height="40" rx="3" fill="${accent}"/>
  <text x="${tx + 14}" y="${198 + lines.length * (size + 10)}" font-family="Bebas Neue" font-size="28" letter-spacing="3" fill="#0b0b0d">${esc(label)}</text>
  ${meta ? `<text x="${tx}" y="${262 + lines.length * (size + 10)}" font-family="Barlow Condensed Medium" font-size="27" letter-spacing="2" fill="#ffffffb8">${esc(meta)}</text>` : ""}
  ${wave}
  <text x="${tx}" y="586" font-family="Barlow Condensed SemiBold" font-size="24" letter-spacing="6" fill="#ffffff8a">▶ HEAR THE DROP · x1c7.com</text>
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" fill="none" stroke="#d4af37" stroke-width="2" opacity="0.55"/>
  </svg>`;
  const png = await sharp({ create: { width: W, height: H, channels: 3, background: "#08080a" } })
    .composite([
      { input: Buffer.from(svg), left: 0, top: 0 },
      { input: caseBuf, left: CX, top: CY },
    ])
    .png({ compressionLevel: 9 }).toBuffer();
  await put(`covers/og/${t.slug}.png`, png);
  return true;
}

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

let n = 0;
for (const t of SRC.tracks) {
  if (only && t.slug !== only) continue;
  try { if (await makeOne(t)) console.error(`✔ ${++n} ${t.slug}`); }
  catch (e) { console.error(`✘ ${t.slug}: ${e.message}`); }
}
// the /music page card: center crop of the shelf
if (!only) {
  const shelf = await sharp(join(HERE, "out", "shelf.png")).resize(1200, 630, { fit: "cover", position: "centre" }).png().toBuffer();
  await put("covers/og/_music.png", shelf);
}
console.error(`done — ${n} track cards${only ? "" : " + _music.png"}`);
