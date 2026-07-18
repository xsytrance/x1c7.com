#!/usr/bin/env node
// AGENOR Collector Cover System — deterministic cover compositor.
//
// Frames each ORIGINAL cover in premium video-game-case packaging:
//   • left genre spine (13%), genre-coded palette + texture, vertical genre
//   • AGENOR PRESENTS header band
//   • metadata footer: precise style, BPM (verified only), runtime, true waveform
//   • language / geography markers (verified only), real Braille (encodes genre)
//   • PARENTAL ADVISORY only where lyrics are actually explicit
// The original artwork stays dominant; nothing is invented.
//
// Usage: node engine.mjs [--only <slug>] [--out <dir>]

import sharp from "sharp";
import { readFileSync, readdirSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import os from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));

// ── Fonts are load-bearing ───────────────────────────────────────────────────
// librsvg resolves font-family through fontconfig. A fresh OS (or wiped $HOME)
// loses the installed fonts SILENTLY: every print falls back to a default sans
// ~65% wider than Bebas, so long spine titles crash into the genre block
// (discovered 2026-07-18 — every post-reinstall print had it). Self-heal:
// install the repo's fonts into the user font dir whenever they're missing.
const FONT_DIR = join(os.homedir(), ".local", "share", "fonts");
if (!existsSync(join(FONT_DIR, "BebasNeue-Regular.ttf"))) {
  mkdirSync(FONT_DIR, { recursive: true });
  for (const f of readdirSync(join(HERE, "fonts"))) {
    if (f.endsWith(".ttf")) copyFileSync(join(HERE, "fonts", f), join(FONT_DIR, f));
  }
  try { execFileSync("fc-cache", ["-f"], { stdio: "ignore" }); } catch { /* no fc-cache → fontconfig rescans by itself */ }
  console.error("⚠ fonts were missing from fontconfig — reinstalled from ./fonts (reprint anything printed while they were gone)");
}

// Exact Bebas advance widths (em units) straight from the TTF — the spine
// title/genre fit is solved with real glyph metrics, not a guess, so every
// title fills its zone edge-to-edge and can never overlap the genre block.
// (Minimal TTF reader: cmap format-4 + hmtx + head.unitsPerEm.)
function ttfWidths(path) {
  const b = readFileSync(path);
  const u16 = (o) => b.readUInt16BE(o), u32 = (o) => b.readUInt32BE(o);
  const tables = {};
  for (let i = 0; i < u16(4); i++) {
    const o = 12 + i * 16;
    tables[b.toString("ascii", o, o + 4)] = u32(o + 8);
  }
  const unitsPerEm = u16(tables.head + 18);
  const numH = u16(tables.hhea + 34);
  const advOf = (gid) => u16(tables.hmtx + Math.min(gid, numH - 1) * 4);
  let sub = null;
  for (let i = 0; i < u16(tables.cmap + 2); i++) {
    const off = u32(tables.cmap + 4 + i * 8 + 4);
    if (u16(tables.cmap + off) === 4) { sub = tables.cmap + off; break; }
  }
  const segX2 = u16(sub + 6);
  const ends = sub + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
  const gidOf = (code) => {
    for (let s = 0; s < segX2; s += 2) {
      if (code <= u16(ends + s)) {
        const start = u16(starts + s);
        if (code < start) return 0;
        const ro = u16(ranges + s);
        if (ro === 0) return (code + u16(deltas + s)) & 0xffff;
        const gi = u16(ranges + s + ro + (code - start) * 2);
        return gi === 0 ? 0 : (gi + u16(deltas + s)) & 0xffff;
      }
    }
    return 0;
  };
  return (ch) => advOf(gidOf(ch.codePointAt(0))) / unitsPerEm;
}
const bebasAdv = ttfWidths(join(HERE, "fonts", "BebasNeue-Regular.ttf"));
/** em-width of a string in Bebas Neue (letter-spacing excluded). */
const bebasEm = (text) => [...String(text)].reduce((a, c) => a + bebasAdv(c), 0);
const ORIG = join(HERE, "originals");
// Bespoke covers that already carry their own collector-case framing (hand-made
// in an external tool). If finished/<slug>.png exists it is the final print and
// is passed through verbatim — never re-framed, so reprint-all is safe.
const FINISHED = join(HERE, "finished");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]); return a;
}, []));
const OUT = args.out || join(HERE, "out");
mkdirSync(OUT, { recursive: true });

const W = 2048, H = 2048;
const BEZEL = 10;            // dark case edge
const GOLDLINE = 3;          // hairline trim
const SPINE = 268;           // 13.1% — inside spec's 10–14%
const FOOT = 152;            // footer bar height
const ARTX = SPINE, ARTW = W - SPINE, ARTH = H - FOOT;

// ── Genre → collector palette (spec system + AGENOR extensions) ─────────────
const PALETTES = {
  RNB:       { base: ["#1b2560", "#0c1233"], accent: "#d4af37", accent2: "#a3253a", ink: "#f3ead2", texture: "leather", label: "R&B" },
  HIPHOP:    { base: ["#161616", "#020202"], accent: "#d4af37", accent2: "#8a8a8a", ink: "#efe6cf", texture: "brushed", label: "HIP-HOP" },
  LATIN:     { base: ["#5f1519", "#1c2242"], accent: "#e2b64a", accent2: "#b0632a", ink: "#f6ecd8", texture: "wood", label: "LATIN" },
  HOUSE:     { base: ["#2b3138", "#101418"], accent: "#46e08c", accent2: "#9fb2c4", ink: "#e8f2ec", texture: "smoke", label: "HOUSE" },
  ELECTRONIC:{ base: ["#07231f", "#03100e"], accent: "#39ffa0", accent2: "#3fd4ff", ink: "#dcfef0", texture: "grid", label: "ELECTRONIC" },
  DANCE:     { base: ["#062024", "#030f12"], accent: "#3fd4ff", accent2: "#39ffa0", ink: "#dcf6fe", texture: "grid", label: "DANCE" },
  DNB:       { base: ["#122a4a", "#050f1f"], accent: "#4d8cff", accent2: "#46e0ff", ink: "#dbe8ff", texture: "grid", label: "DRUM & BASS" },
  TECHNO:    { base: ["#1d1d21", "#0a0a0c"], accent: "#ff5a1f", accent2: "#8c8c94", ink: "#f2e9e2", texture: "concrete", label: "TECHNO" },
  ROCK:      { base: ["#57290a", "#2b1206"], accent: "#e8a020", accent2: "#a02010", ink: "#f6e8d2", texture: "distressed", label: "ROCK" },
  AFROBEAT:  { base: ["#3a2410", "#150d05"], accent: "#c98a2d", accent2: "#7d4a1d", ink: "#f2e4c8", texture: "carved", label: "AFROBEAT" },
  POP:       { base: ["#43102f", "#190513"], accent: "#ff4fa3", accent2: "#e8c98a", ink: "#fbe8f2", texture: "satin", label: "POP" },
  SYNTHWAVE: { base: ["#241042", "#0c0522"], accent: "#b44dff", accent2: "#46e0ff", ink: "#ece0fb", texture: "retro", label: "SYNTHWAVE" },
  LOFI:      { base: ["#2c3835", "#121b19"], accent: "#e6d7b8", accent2: "#6fbfae", ink: "#efe9da", texture: "paper", label: "LO-FI" },
  AMBIENT:   { base: ["#191f38", "#090c1a"], accent: "#c9d4e8", accent2: "#5f74a8", ink: "#e8edf6", texture: "mist", label: "AMBIENT" },
  CINEMATIC: { base: ["#25272d", "#0d0e11"], accent: "#d8dce4", accent2: "#7d96b8", ink: "#eef0f4", texture: "brushed", label: "CINEMATIC" },
  ARCHIVE:   { base: ["#181818", "#040404"], accent: "#d4af37", accent2: "#6a6a6a", ink: "#efe6cf", texture: "leather", label: "AGENOR" },
  ASIA:      { base: ["#4a0d0d", "#120303"], accent: "#e2b64a", accent2: "#a3253a", ink: "#f6e8d2", texture: "satin", label: "ASIA" },
  DANCEHALL: { base: ["#5f1519", "#2a1607"], accent: "#e2b64a", accent2: "#b0632a", ink: "#f6ecd8", texture: "wood", label: "DANCEHALL" },
  VIDEOGAME: { base: ["#2c1052", "#0c0522"], accent: "#b44dff", accent2: "#46e0ff", ink: "#efe9ff", texture: "retro", label: "VIDEO GAME" },
};

// DB genre string → { spine bucket, precise footer style }
function classify(genre) {
  const g = (genre || "").toLowerCase();
  if (!g) return { key: "ARCHIVE", precise: null };
  if (g.includes("r&b")) return { key: "RNB", precise: genre };
  if (g.includes("hip")) return { key: "HIPHOP", precise: genre };
  if (g.includes("dancehall")) return { key: "DANCEHALL", precise: genre };
  if (g.includes("reggaeton") || g.includes("latin") || g.includes("dembow")) return { key: "LATIN", precise: genre.replace(/·/g, "/") };
  if (g.includes("deep house")) return { key: "HOUSE", precise: "Deep House" };
  if (g.includes("house")) return { key: "HOUSE", precise: genre };
  if (g.includes("drum") || g.includes("dnb") || g.includes("d&b") || g.includes("jungle")) return { key: "DNB", precise: genre };
  if (g.includes("techno") || g.includes("industrial")) return { key: "TECHNO", precise: genre };
  if (g.includes("rock") || g.includes("alternative")) return { key: "ROCK", precise: genre };
  if (g.includes("afro")) return { key: "AFROBEAT", precise: genre };
  if (g.includes("synthwave")) return { key: "SYNTHWAVE", precise: genre };
  if (g.includes("lo-fi") || g.includes("lofi")) return { key: "LOFI", precise: genre };
  if (g.includes("ambient")) return { key: "AMBIENT", precise: genre };
  if (g.includes("cinematic")) return { key: "CINEMATIC", precise: genre };
  if (g.includes("pop")) return { key: "POP", precise: genre };
  if (g.includes("dance")) return { key: "DANCE", precise: genre };
  if (g.includes("electronic") || g.includes("edm")) return { key: "ELECTRONIC", precise: genre };
  return { key: "ARCHIVE", precise: genre };
}

// ── Real Braille (Grade 1) — encodes the spine genre word ────────────────────
const BRAILLE = { a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5], k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5], p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5], u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6], "&": [1, 2, 3, 4, 6], "-": [3, 6] };
function brailleSVG(word, cx, y, dotR, color) {
  // Braille cells reading down; splits into two side-by-side columns for long
  // words so it never bleeds into the geo/series block below.
  const cells = [...word.toLowerCase()].map((ch) => BRAILLE[ch]).filter(Boolean);
  const colW = dotR * 3.2, rowH = dotR * 3.2, cellH = rowH * 3 + dotR * 2.6;
  const twoCol = cells.length > 5;
  const perCol = twoCol ? Math.ceil(cells.length / 2) : cells.length;
  const colX = (ci) => (twoCol ? cx + (ci < perCol ? -1 : 1) * dotR * 4.2 : cx);
  let svg = "";
  cells.forEach((dots, ci) => {
    const row = twoCol ? ci % perCol : ci;
    const top = y + row * cellH;
    const x0 = colX(ci);
    for (let d = 1; d <= 6; d++) {
      const col = d <= 3 ? 0 : 1, r = (d - 1) % 3;
      const on = dots.includes(d);
      svg += `<circle cx="${x0 + (col - 0.5) * colW}" cy="${top + r * rowH}" r="${dotR}" fill="${color}" opacity="${on ? 0.92 : 0.16}"/>`;
    }
  });
  return { svg, height: perCol * cellH };
}

// ── Spine texture filters ────────────────────────────────────────────────────
function textureDefs(t, id) {
  const turb = {
    leather:    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.10 0"/>`,
    brushed:    `<feTurbulence type="fractalNoise" baseFrequency="0.005 0.9" numOctaves="2" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.12 0"/>`,
    wood:       `<feTurbulence type="fractalNoise" baseFrequency="0.012 0.28" numOctaves="3" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.85  0 0 0 0 0.6  0 0 0 0.12 0"/>`,
    smoke:      `<feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0"/>`,
    grid:       `<feTurbulence type="turbulence" baseFrequency="0.35" numOctaves="1" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 0.6  0 0 0 0 1  0 0 0 0 0.9  0 0 0 0.07 0"/>`,
    concrete:   `<feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="4" seed="13"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.13 0"/>`,
    distressed: `<feTurbulence type="fractalNoise" baseFrequency="0.12 0.5" numOctaves="4" seed="21"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 0.7  0 0 0 0.16 0"/>`,
    carved:     `<feTurbulence type="turbulence" baseFrequency="0.05 0.18" numOctaves="2" seed="17"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.8  0 0 0 0 0.5  0 0 0 0.12 0"/>`,
    satin:      `<feTurbulence type="fractalNoise" baseFrequency="0.006 0.10" numOctaves="2" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 1  0 0 0 0.09 0"/>`,
    retro:      `<feTurbulence type="turbulence" baseFrequency="0.9 0.06" numOctaves="1" seed="8"/><feColorMatrix type="matrix" values="0 0 0 0 0.8  0 0 0 0 0.5  0 0 0 0 1  0 0 0 0.08 0"/>`,
    paper:      `<feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" seed="6"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.98  0 0 0 0 0.9  0 0 0 0.08 0"/>`,
    mist:       `<feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="2"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.10 0"/>`,
  }[t] || "";
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%">${turb}</filter>`;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// waveform bars from peaks (true audio), centered on a baseline.
// Loud masters flatten max-peaks, so expand dynamic range for display —
// the shape is still the song's own contour, just contrast-stretched.
function wavePath(peaks, x, midY, w, maxH, color, opacity = 0.95) {
  if (!peaks?.length) return "";
  const lo = Math.min(...peaks), hi = Math.max(...peaks);
  const norm = peaks.map((v) => Math.pow((v - lo) / Math.max(0.001, hi - lo), 1.4) * 0.92 + 0.08);
  const n = norm.length, bw = w / n;
  let s = "";
  for (let i = 0; i < n; i++) {
    const h = Math.max(2, norm[i] * maxH);
    s += `<rect x="${(x + i * bw).toFixed(1)}" y="${(midY - h / 2).toFixed(1)}" width="${(bw * 0.62).toFixed(1)}" height="${h.toFixed(1)}" rx="${(bw * 0.2).toFixed(1)}" fill="${color}" opacity="${opacity}"/>`;
  }
  return s;
}

function crownSVG(cx, cy, s, color) {
  return `<path d="M ${cx - s} ${cy + s * 0.55} L ${cx - s} ${cy - s * 0.1} L ${cx - s * 0.5} ${cy + s * 0.15} L ${cx} ${cy - s * 0.6} L ${cx + s * 0.5} ${cy + s * 0.15} L ${cx + s} ${cy - s * 0.1} L ${cx + s} ${cy + s * 0.55} Z" fill="${color}"/>
  <rect x="${cx - s}" y="${cy + s * 0.72}" width="${2 * s}" height="${s * 0.22}" rx="${s * 0.1}" fill="${color}"/>`;
}

function emblemSVG(cx, cy, r, color, dark) {
  // circled A monogram with orbit spikes — the AGENOR seal
  let spikes = "";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    spikes += `<line x1="${cx + Math.cos(a) * r * 1.06}" y1="${cy + Math.sin(a) * r * 1.06}" x2="${cx + Math.cos(a) * r * 1.3}" y2="${cy + Math.sin(a) * r * 1.3}" stroke="${color}" stroke-width="${r * 0.09}" stroke-linecap="round"/>`;
  }
  return `${spikes}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${r * 0.12}"/>
  <text x="${cx}" y="${cy + r * 0.42}" font-family="Bebas Neue" font-size="${r * 1.35}" fill="${color}" text-anchor="middle">A</text>`;
}

function clockSVG(cx, cy, r, color) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${r * 0.18}"/>
  <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - r * 0.62}" stroke="${color}" stroke-width="${r * 0.18}" stroke-linecap="round"/>
  <line x1="${cx}" y1="${cy}" x2="${cx + r * 0.5}" y2="${cy + r * 0.2}" stroke="${color}" stroke-width="${r * 0.18}" stroke-linecap="round"/>`;
}

function pulseSVG(x, cy, w, color) {
  const p = [[0, 0], [0.18, 0], [0.26, -0.5], [0.34, 0.9], [0.42, -1], [0.5, 0.55], [0.58, 0], [1, 0]];
  const amp = w * 0.16;
  const d = p.map(([px, py], i) => `${i ? "L" : "M"} ${(x + px * w).toFixed(1)} ${(cy + py * amp).toFixed(1)}`).join(" ");
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>`;
}

function buildOverlay(t) {
  const { key, precise } = classify(t.genre);
  // per-track overrides: t.palette picks the color system, t.spine the spine word
  let P = t.rooklyn ? { ...PALETTES.HIPHOP, label: PALETTES[key].label } : PALETTES[key];
  if (t.palette && PALETTES[t.palette]) P = { ...PALETTES[t.palette], label: P.label };
  const spineWord = t.spine || P.label;
  const gold = "#d4af37", goldHi = "#f0d878", goldLo = "#8a6d1e";
  const accent = P.accent, ink = P.ink;

  // ── spine ──
  const sx = BEZEL + GOLDLINE, sw = SPINE - sx;
  const spineTexture = textureDefs(P.texture, "tex");
  const innerX = sx + 14, innerW = sw - 28;

  // Spine text stack (rotated 90°, reads top→bottom): TITLE dominant, optional
  // subtitle (remix/parenthetical), then the genre — smaller, accent-colored,
  // pinned at a constant position so genres scan uniformly across a shelf.
  // After rotate(90) the glyph ascent extends toward +x, so shift each baseline
  // left by ~half the cap height to keep letters centered inside the spine.
  const stripCJK = (s) => s.replace(/[　-鿿가-힯＀-￯]/g, "").replace(/\s+/g, " ").trim();
  const rawTitle = stripCJK(String(t.title));
  const tm = rawTitle.match(/^([^([:]+)(?:[:([]+\s*([^)\]]*))?/);
  const mainTitle = (tm?.[1] || rawTitle).trim().toUpperCase();
  const subtitle = (tm?.[2] || "").trim().toUpperCase() || null;
  // Real Bebas metrics (bebasEm) + the actual letter-spacing each text uses in
  // the SVG below — title/subtitle 4, genre 8.
  const lenOf = (text, size, ls = 4) => bebasEm(text) * size + Math.max(0, text.length - 1) * ls;

  const genreSize = 40;
  const genreLen = lenOf(spineWord, genreSize, 8);
  const genreStart = H - 690 - genreLen;          // genre ends just above LANG block
  const vTop = 450;
  const zoneEnd = genreStart - 56;
  const zone = zoneEnd - vTop;

  // Solve sizes directly: title gets the zone (72% when a subtitle exists),
  // then scale the whole stack down if it still overruns. No floors that can
  // force an overflow into the genre block.
  const capW = (sw - 44) / 0.75;
  const sizeToFit = (text, room) => (room - Math.max(0, text.length - 1) * 4) / bebasEm(text);
  let titleSize = Math.min(150, capW, sizeToFit(mainTitle, zone * (subtitle ? 0.68 : 1)));
  let subSize = subtitle ? Math.min(titleSize * 0.45, sizeToFit(subtitle, zone * 0.24)) : 0;
  let titleLen = lenOf(mainTitle, titleSize);
  let stackLen = titleLen + (subtitle ? 44 + lenOf(subtitle, subSize) : 0);
  if (stackLen > zone) {
    const k = zone / stackLen;
    titleSize *= k; subSize *= k;
    titleLen = lenOf(mainTitle, titleSize);
    stackLen = titleLen + (subtitle ? 44 + lenOf(subtitle, subSize) : 0);
  }
  const stackStart = vTop + Math.max(0, (zone - stackLen) / 2);
  const baseFor = (size) => sx + sw / 2 - size * 0.355;

  const braille = brailleSVG(spineWord.replace(/[^a-z&-]/gi, ""), sx + sw / 2, H - 560, 5.2, ink);

  const seriesLabel = t.series ? `${t.series} Series`.toUpperCase() : (t.unreleased ? "ARCHIVE EDITION" : null);

  // spine mini-waveform (真 waveform of this actual track when known)
  const chip = t.peaks ? wavePath(t.peaks.filter((_, i) => i % 3 === 0), innerX + 24, 368, innerW - 48, 50, P.accent2 === "#8a8a8a" ? "#a3253a" : P.accent2) : "";

  // geo block
  const geoSVG = t.geo ? `
    <text x="${sx + sw / 2}" y="${H - 205}" font-family="Barlow Condensed SemiBold" font-size="30" letter-spacing="4" fill="${ink}" text-anchor="middle" opacity="0.9">${esc(t.geo)}</text>` : "";

  const langSVG = t.lang ? `
    <text x="${sx + sw / 2}" y="${H - 645}" font-family="Barlow Condensed Medium" font-size="26" letter-spacing="6" fill="${ink}" text-anchor="middle" opacity="0.6">LANG</text>
    <text x="${sx + sw / 2}" y="${H - 600}" font-family="Bebas Neue" font-size="44" letter-spacing="3" fill="${gold}" text-anchor="middle">${esc(t.lang)}</text>` : "";

  const spine = `
    <rect x="${sx}" y="${BEZEL}" width="${sw}" height="${H - 2 * BEZEL}" fill="url(#spineG)"/>
    <rect x="${sx}" y="${BEZEL}" width="${sw}" height="${H - 2 * BEZEL}" filter="url(#tex)"/>
    <rect x="${sx}" y="${BEZEL}" width="6" height="${H - 2 * BEZEL}" fill="#ffffff" opacity="0.10"/>
    <rect x="${SPINE - 8}" y="${BEZEL}" width="8" height="${H - 2 * BEZEL}" fill="#000000" opacity="0.45"/>
    <rect x="${SPINE - 2}" y="${BEZEL}" width="4" height="${H - 2 * BEZEL}" fill="url(#goldEdge)"/>
    ${crownSVG(sx + sw / 2, 92, 34, gold)}
    ${emblemSVG(sx + sw / 2, 222, 62, gold, P.base[1])}
    <line x1="${innerX + 16}" y1="312" x2="${sx + sw - 30}" y2="312" stroke="${ink}" stroke-width="1.5" opacity="0.25" stroke-dasharray="2 7"/>
    ${chip}
    <line x1="${innerX + 16}" y1="424" x2="${sx + sw - 30}" y2="424" stroke="${ink}" stroke-width="1.5" opacity="0.25" stroke-dasharray="2 7"/>
    <text x="${baseFor(titleSize)}" y="${stackStart}" font-family="Bebas Neue" font-size="${titleSize}" fill="url(#goldText)" text-anchor="start" letter-spacing="4"
      transform="rotate(90 ${baseFor(titleSize)} ${stackStart})" style="paint-order:stroke" stroke="#000000" stroke-width="3" stroke-opacity="0.35">${esc(mainTitle)}</text>
    ${subtitle ? `<text x="${baseFor(subSize)}" y="${stackStart + titleLen + 44}" font-family="Bebas Neue" font-size="${subSize}" fill="${ink}" opacity="0.75" text-anchor="start" letter-spacing="4"
      transform="rotate(90 ${baseFor(subSize)} ${stackStart + titleLen + 44})">${esc(subtitle)}</text>` : ""}
    <text x="${baseFor(genreSize)}" y="${genreStart}" font-family="Bebas Neue" font-size="${genreSize}" fill="${accent}" opacity="0.95" text-anchor="start" letter-spacing="8"
      transform="rotate(90 ${baseFor(genreSize)} ${genreStart})" style="paint-order:stroke" stroke="#000000" stroke-width="2" stroke-opacity="0.3">${esc(spineWord)}</text>
    ${langSVG}
    ${braille.svg}
    ${geoSVG}
    ${seriesLabel ? `<text x="${sx + sw / 2}" y="${H - 160}" font-family="Barlow Condensed Medium" font-size="24" letter-spacing="4" fill="${ink}" text-anchor="middle" opacity="0.55">${esc(seriesLabel)}</text>` : ""}
    <line x1="${innerX + 16}" y1="${H - 250}" x2="${sx + sw - 30}" y2="${H - 250}" stroke="${ink}" stroke-width="1.5" opacity="0.25" stroke-dasharray="2 7"/>
  `;

  // ── header band over art ──
  const hcx = ARTX + ARTW / 2;
  const header = `
    <rect x="${ARTX}" y="0" width="${ARTW}" height="270" fill="url(#headFade)"/>
    <text x="${hcx}" y="86" font-family="Barlow Condensed SemiBold" font-size="46" letter-spacing="22" fill="${gold}" text-anchor="middle">A G E N O R&#160;&#160;P R E S E N T S</text>
    <path d="M ${ARTX + 80} 70 l 13 -13 13 13 -13 13 Z" fill="${gold}"/>
    <path d="M ${W - BEZEL - 106} 70 l 13 -13 13 13 -13 13 Z" fill="${gold}"/>
    <line x1="${ARTX + 130}" y1="70" x2="${ARTX + 250}" y2="70" stroke="${gold}" stroke-width="3"/>
    <line x1="${W - BEZEL - 250}" y1="70" x2="${W - BEZEL - 130}" y2="70" stroke="${gold}" stroke-width="3"/>
  `;

  // ── footer ──
  const fy = H - FOOT;
  const cells = [];
  // Label chrome stays AGENOR; the small artist line is fact-driven so guest
  // tracks (Tyler Haze, Jayodeed…) credit their actual artist.
  cells.push({ w: 300, svg: (x) => `
    <text x="${x + 30}" y="${fy + 66}" font-family="Bebas Neue" font-size="52" letter-spacing="6" fill="${gold}">AGENOR</text>
    <text x="${x + 30}" y="${fy + 112}" font-family="Barlow Condensed Medium" font-size="30" letter-spacing="9" fill="#c94a3a">${esc(t.artist || "xsytrance")}</text>` });
  const styleText = precise && precise.toUpperCase() !== spineWord ? precise : (t.mood || null);
  if (styleText) cells.push({ w: 430, svg: (x) => `
    <text x="${x + 30}" y="${fy + 58}" font-family="Barlow Condensed SemiBold" font-size="30" letter-spacing="8" fill="#c94a3a">STYLE</text>
    <text x="${x + 30}" y="${fy + 108}" font-family="Barlow Condensed SemiBold" font-size="38" letter-spacing="2" fill="#e8e4da">${esc(String(styleText).toUpperCase())}</text>` });
  if (t.bpm) cells.push({ w: 300, svg: (x) => `
    ${pulseSVG(x + 26, fy + FOOT / 2, 90, "#c94a3a")}
    <text x="${x + 132}" y="${fy + 92}" font-family="Bebas Neue" font-size="62" fill="#f0ece2">${t.bpm}</text>
    <text x="${x + 226}" y="${fy + 90}" font-family="Barlow Condensed Medium" font-size="30" letter-spacing="2" fill="#9a958a">BPM</text>` });
  if (t.runtime) cells.push({ w: 290, svg: (x) => `
    ${clockSVG(x + 48, fy + FOOT / 2, 26, "#c94a3a")}
    <text x="${x + 94}" y="${fy + 92}" font-family="Bebas Neue" font-size="62" fill="#f0ece2">${esc(t.runtime)}</text>
    <text x="${x + 94}" y="${fy + 122}" font-family="Barlow Condensed Medium" font-size="24" letter-spacing="3" fill="#9a958a">RUNTIME</text>` });
  if (t.unreleased) cells.push({ w: 330, svg: (x) => `
    <text x="${x + 30}" y="${fy + 92}" font-family="Bebas Neue" font-size="46" letter-spacing="4" fill="#9a958a">UNRELEASED</text>` });

  let usedW = cells.reduce((a, c) => a + c.w, 0);
  const waveW = Math.max(0, W - BEZEL - 30 - (ARTX + usedW));
  let fx = ARTX;
  let footer = `
    <rect x="${ARTX}" y="${fy}" width="${ARTW}" height="${FOOT}" fill="#0a0a0c"/>
    <rect x="${ARTX}" y="${fy}" width="${ARTW}" height="3" fill="url(#goldEdge2)"/>`;
  cells.forEach((c, i) => {
    if (i) footer += `<line x1="${fx}" y1="${fy + 26}" x2="${fx}" y2="${fy + FOOT - 26}" stroke="${gold}" stroke-width="2" opacity="0.55"/>`;
    footer += c.svg(fx);
    fx += c.w;
  });
  if (t.peaks && waveW > 160) {
    footer += `<line x1="${fx}" y1="${fy + 26}" x2="${fx}" y2="${fy + FOOT - 26}" stroke="${gold}" stroke-width="2" opacity="0.55"/>`;
    footer += wavePath(t.peaks, fx + 24, fy + FOOT / 2, waveW - 40, FOOT * 0.55, accent);
  }

  // parental advisory (verified explicit only)
  const advisory = t.explicit ? (() => {
    const aw = 236, ah = 128, ax = W - BEZEL - GOLDLINE - 26 - aw, ay = fy - ah - 26;
    return `
    <g>
      <rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="#000000" opacity="0.92"/>
      <rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#ffffff" stroke-width="3"/>
      <text x="${ax + aw / 2}" y="${ay + 38}" font-family="Barlow Condensed SemiBold" font-size="30" letter-spacing="7" fill="#ffffff" text-anchor="middle">PARENTAL</text>
      <rect x="${ax + 10}" y="${ay + 50}" width="${aw - 20}" height="38" fill="#ffffff"/>
      <text x="${ax + aw / 2}" y="${ay + 80}" font-family="Barlow Condensed Bold" font-size="34" letter-spacing="4" fill="#000000" text-anchor="middle">ADVISORY</text>
      <text x="${ax + aw / 2}" y="${ay + 116}" font-family="Barlow Condensed SemiBold" font-size="22" letter-spacing="3" fill="#ffffff" text-anchor="middle">EXPLICIT CONTENT</text>
    </g>`;
  })() : "";

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="spineG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.base[0]}"/><stop offset="1" stop-color="${P.base[1]}"/>
    </linearGradient>
    <linearGradient id="goldEdge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${goldHi}"/><stop offset="0.5" stop-color="${gold}"/><stop offset="1" stop-color="${goldLo}"/>
    </linearGradient>
    <linearGradient id="goldEdge2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${goldLo}"/><stop offset="0.5" stop-color="${goldHi}"/><stop offset="1" stop-color="${goldLo}"/>
    </linearGradient>
    <linearGradient id="goldText" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${goldHi}"/><stop offset="0.45" stop-color="${gold}"/><stop offset="1" stop-color="${goldLo}"/>
    </linearGradient>
    <linearGradient id="headFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.82"/><stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    ${spineTexture}
  </defs>
  ${spine}
  ${header}
  ${footer}
  ${advisory}
  <rect x="${BEZEL / 2}" y="${BEZEL / 2}" width="${W - BEZEL}" height="${H - BEZEL}" fill="none" stroke="#050505" stroke-width="${BEZEL}"/>
  <rect x="${BEZEL + 1}" y="${BEZEL + 1}" width="${W - 2 * BEZEL - 2}" height="${H - 2 * BEZEL - 2}" fill="none" stroke="url(#goldEdge)" stroke-width="${GOLDLINE}"/>
</svg>`;
}

async function renderOne(t) {
  const src = join(ORIG, t.coverFile);
  if (!existsSync(src)) { console.error(`MISSING ORIGINAL: ${t.coverFile}`); return false; }
  const artAreaH = H - FOOT;
  // Full width, zero horizontal crop — the original survives intact. Square art
  // is slightly shorter than the area, so bottom-anchor it and let the gap
  // disappear under the dark header band.
  const meta = await sharp(src).metadata();
  const scaledH = Math.round(ARTW * meta.height / meta.width);
  let art, artTop;
  if (scaledH >= artAreaH) {
    // portrait art anchors to the top so baked titles survive the crop;
    // t.artTopCrop (fraction of height) skims off a baked header that would
    // double-expose with our AGENOR PRESENTS band
    if (meta.height > meta.width) {
      const resized = await sharp(src).resize(ARTW, scaledH).toBuffer();
      const top = Math.min(scaledH - artAreaH, Math.round((t.artTopCrop || 0) * scaledH));
      art = await sharp(resized).extract({ left: 0, top, width: ARTW, height: artAreaH }).toBuffer();
    } else {
      art = await sharp(src).resize(ARTW, artAreaH, { fit: "cover", position: "centre" }).toBuffer();
    }
    artTop = 0;
  } else {
    art = await sharp(src).resize(ARTW, scaledH).toBuffer();
    artTop = artAreaH - scaledH;
  }
  const overlay = Buffer.from(buildOverlay(t));
  await sharp({ create: { width: W, height: H, channels: 3, background: "#050505" } })
    .composite([
      { input: art, left: ARTX, top: artTop },
      { input: overlay, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, `${t.slug}.png`));
  return true;
}

const manifest = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));
let ok = 0, fail = 0;
for (const t of manifest) {
  if (args.only && t.slug !== args.only) continue;
  const finished = join(FINISHED, `${t.slug}.png`);
  if (existsSync(finished)) {
    // Normalize to the canonical W×H so bespoke covers slot into the shelf /
    // spine math like any engine print, whatever size they were authored at.
    const meta = await sharp(finished).metadata();
    if (meta.width === W && meta.height === H) copyFileSync(finished, join(OUT, `${t.slug}.png`));
    else await sharp(finished).resize(W, H, { fit: "cover", position: "centre" }).png({ compressionLevel: 9 }).toFile(join(OUT, `${t.slug}.png`));
    ok++; console.error(`✔ ${t.slug} (finished passthrough)`); continue;
  }
  try {
    if (await renderOne(t)) { ok++; console.error(`✔ ${t.slug}`); } else fail++;
  } catch (e) { fail++; console.error(`✘ ${t.slug}: ${e.message}`); }
}
console.error(`done — ${ok} rendered, ${fail} failed → ${OUT}`);
