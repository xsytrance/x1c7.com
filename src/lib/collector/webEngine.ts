// ═══════════════════════════════════════════════════════════════════════════
// COLLECTOR CASE — WEB ENGINE (Cover Studio 2 P6, FREE tier)
//
// A faithful client-side twin of scripts/song-art/collector/engine.mjs:
// the same layout constants, palettes, textures, braille, waveform and
// spine-fit math (real Bebas glyph metrics), composed on a <canvas> in the
// visitor's browser. Nothing is uploaded anywhere — that's the FREE-tier
// privacy promise (docs/THREE-LEVELS.md law 4).
//
// One deliberate divergence from the print engine: the chrome is
// PARAMETERIZED. The public edition prints the visitor's label — their name
// on the header band, their monogram in the seal, their artist line in the
// footer — never AGENOR's. Keep both engines in step when layout changes.
// ═══════════════════════════════════════════════════════════════════════════
import { COLLECTOR_PALETTES, classifyCollector, type CollectorPalette } from "@/lib/studio/collectorPalettes";
import { bebasEm } from "./bebasWidths";
// Shared primitives live in the Pressing Plant kit (extracted move-only from
// this file, P1) — parity enforced by scripts/press/check-parity.mjs.
import { esc, brailleSVG, textureDefs, wavePath, crownSVG, emblemSVG, clockSVG, pulseSVG } from "@/lib/press/kit/svgPrimitives";
import { bebasLen, bebasSizeToFit } from "@/lib/press/kit/fitText";
import { embeddedFontCSS } from "@/lib/press/kit/fonts";
export { embeddedFontCSS };

export const W = 2048, H = 2048;
const BEZEL = 10, GOLDLINE = 3, SPINE = 268, FOOT = 152;
export const ARTX = SPINE, ARTW = W - SPINE, ARTH = H - FOOT;

export interface CaseSpec {
  title: string;
  genre?: string | null;
  palette?: string | null;    // force a palette key (else classified from genre)
  spine?: string | null;      // force the spine word (else the bucket label)
  label?: string;             // header + footer name (the visitor's imprint)
  handle?: string | null;     // small red footer line under the label
  monogram?: string | null;   // seal letter (default: label's first letter)
  lang?: string | null;
  geo?: string | null;
  series?: string | null;
  bpm?: number | null;
  runtime?: string | null;
  peaks?: number[] | null;
  explicit?: boolean;
  unreleased?: boolean;
  artTopCrop?: number;
}

// (esc, braille, textures, waveform, and house furniture now come from the kit)



/** The full case overlay (spine + header + footer + advisory) as an SVG string. */
export function buildOverlaySVG(t: CaseSpec, embeddedFontCSS = ""): string {
  const { key, precise } = classifyCollector(t.genre);
  let P: CollectorPalette = COLLECTOR_PALETTES[key];
  if (t.palette && COLLECTOR_PALETTES[t.palette]) P = { ...COLLECTOR_PALETTES[t.palette], label: P.label };
  const spineWord = t.spine || P.label;
  const gold = "#d4af37", goldHi = "#f0d878", goldLo = "#8a6d1e";
  const accent = P.accent, ink = P.ink;
  const label = (t.label || "YOUR LABEL").toUpperCase();
  const monogram = (t.monogram || label[0] || "A").toUpperCase().slice(0, 1);

  const sx = BEZEL + GOLDLINE, sw = SPINE - sx;
  const spineTexture = textureDefs(P.texture, "tex");
  const innerX = sx + 14, innerW = sw - 28;

  const stripCJK = (s: string) => s.replace(/[　-鿿가-힯＀-￯]/g, "").replace(/\s+/g, " ").trim();
  const rawTitle = stripCJK(String(t.title || "UNTITLED"));
  const tm = rawTitle.match(/^([^([:]+)(?:[:([]+\s*([^)\]]*))?/);
  const mainTitle = (tm?.[1] || rawTitle).trim().toUpperCase() || "UNTITLED";
  const subtitle = (tm?.[2] || "").trim().toUpperCase() || null;
  const lenOf = bebasLen;

  const genreSize = 40;
  const genreLen = lenOf(spineWord, genreSize, 8);
  const genreStart = H - 690 - genreLen;
  const vTop = 450;
  const zoneEnd = genreStart - 56;
  const zone = zoneEnd - vTop;

  const capW = (sw - 44) / 0.75;
  const sizeToFit = (text: string, room: number) => bebasSizeToFit(text, room, 4);
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
  const baseFor = (size: number) => sx + sw / 2 - size * 0.355;

  const braille = brailleSVG(spineWord.replace(/[^a-z&-]/gi, ""), sx + sw / 2, H - 560, 5.2, ink);
  const seriesLabel = t.series ? `${t.series} Series`.toUpperCase() : (t.unreleased ? "ARCHIVE EDITION" : null);
  const chip = t.peaks?.length ? wavePath(t.peaks.filter((_, i) => i % 3 === 0), innerX + 24, 368, innerW - 48, 50, P.accent2 === "#8a8a8a" ? "#a3253a" : P.accent2) : "";

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
    ${emblemSVG(sx + sw / 2, 222, 62, gold, monogram)}
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
    ${braille}
    ${geoSVG}
    ${seriesLabel ? `<text x="${sx + sw / 2}" y="${H - 160}" font-family="Barlow Condensed Medium" font-size="24" letter-spacing="4" fill="${ink}" text-anchor="middle" opacity="0.55">${esc(seriesLabel)}</text>` : ""}
    <line x1="${innerX + 16}" y1="${H - 250}" x2="${sx + sw - 30}" y2="${H - 250}" stroke="${ink}" stroke-width="1.5" opacity="0.25" stroke-dasharray="2 7"/>
  `;

  const hcx = ARTX + ARTW / 2;
  const presents = [...`${label} PRESENTS`].join(" ").replace(/ {3}/g, "  ");
  const header = `
    <rect x="${ARTX}" y="0" width="${ARTW}" height="270" fill="url(#headFade)"/>
    <text x="${hcx}" y="86" font-family="Barlow Condensed SemiBold" font-size="46" letter-spacing="22" fill="${gold}" text-anchor="middle">${esc(presents)}</text>
    <path d="M ${ARTX + 80} 70 l 13 -13 13 13 -13 13 Z" fill="${gold}"/>
    <path d="M ${W - BEZEL - 106} 70 l 13 -13 13 13 -13 13 Z" fill="${gold}"/>
    <line x1="${ARTX + 130}" y1="70" x2="${ARTX + 250}" y2="70" stroke="${gold}" stroke-width="3"/>
    <line x1="${W - BEZEL - 250}" y1="70" x2="${W - BEZEL - 130}" y2="70" stroke="${gold}" stroke-width="3"/>
  `;

  const fy = H - FOOT;
  const cells: { w: number; svg: (x: number) => string }[] = [];
  // Label footer cell width breathes with the name so long labels don't clip.
  const labelW = Math.max(300, Math.round(bebasEm(label) * 52 + label.length * 6 + 60));
  cells.push({ w: labelW, svg: (x) => `
    <text x="${x + 30}" y="${fy + 66}" font-family="Bebas Neue" font-size="52" letter-spacing="6" fill="${gold}">${esc(label)}</text>
    ${t.handle ? `<text x="${x + 30}" y="${fy + 112}" font-family="Barlow Condensed Medium" font-size="30" letter-spacing="9" fill="#c94a3a">${esc(t.handle)}</text>` : ""}` });
  const styleText = precise && precise.toUpperCase() !== spineWord ? String(precise) : null;
  if (styleText) cells.push({ w: 430, svg: (x) => `
    <text x="${x + 30}" y="${fy + 58}" font-family="Barlow Condensed SemiBold" font-size="30" letter-spacing="8" fill="#c94a3a">STYLE</text>
    <text x="${x + 30}" y="${fy + 108}" font-family="Barlow Condensed SemiBold" font-size="38" letter-spacing="2" fill="#e8e4da">${esc(String(styleText).toUpperCase())}</text>` });
  if (t.bpm) cells.push({ w: 300, svg: (x) => `
    ${pulseSVG(x + 26, fy + FOOT / 2, 90, "#c94a3a")}
    <text x="${x + 132}" y="${fy + 92}" font-family="Bebas Neue" font-size="62" fill="#f0ece2">${t.bpm}</text>
    <text x="${x + 226}" y="${fy + 90}" font-family="Barlow Condensed Medium" font-size="30" letter-spacing="2" fill="#9a958a">BPM</text>` });
  if (t.runtime) cells.push({ w: 290, svg: (x) => `
    ${clockSVG(x + 48, fy + FOOT / 2, 26, "#c94a3a")}
    <text x="${x + 94}" y="${fy + 92}" font-family="Bebas Neue" font-size="62" fill="#f0ece2">${esc(String(t.runtime))}</text>
    <text x="${x + 94}" y="${fy + 122}" font-family="Barlow Condensed Medium" font-size="24" letter-spacing="3" fill="#9a958a">RUNTIME</text>` });
  if (t.unreleased) cells.push({ w: 330, svg: (x) => `
    <text x="${x + 30}" y="${fy + 92}" font-family="Bebas Neue" font-size="46" letter-spacing="4" fill="#9a958a">UNRELEASED</text>` });

  const usedW = cells.reduce((a, c) => a + c.w, 0);
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
  if (t.peaks?.length && waveW > 160) {
    footer += `<line x1="${fx}" y1="${fy + 26}" x2="${fx}" y2="${fy + FOOT - 26}" stroke="${gold}" stroke-width="2" opacity="0.55"/>`;
    footer += wavePath(t.peaks, fx + 24, fy + FOOT / 2, waveW - 40, FOOT * 0.55, accent);
  }

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
  ${embeddedFontCSS ? `<style>${embeddedFontCSS}</style>` : ""}
  ${spine}
  ${header}
  ${footer}
  ${advisory}
  <rect x="${BEZEL / 2}" y="${BEZEL / 2}" width="${W - BEZEL}" height="${H - BEZEL}" fill="none" stroke="#050505" stroke-width="${BEZEL}"/>
  <rect x="${BEZEL + 1}" y="${BEZEL + 1}" width="${W - 2 * BEZEL - 2}" height="${H - 2 * BEZEL - 2}" fill="none" stroke="url(#goldEdge)" stroke-width="${GOLDLINE}"/>
</svg>`;
}

/** engine.mjs renderOne's art placement, as canvas draw params. */
export function artPlacement(imgW: number, imgH: number, artTopCrop = 0) {
  const artAreaH = H - FOOT;
  const scaledH = Math.round(ARTW * imgH / imgW);
  if (scaledH >= artAreaH) {
    if (imgH > imgW) {
      // portrait: top-anchor (skim artTopCrop) so baked titles survive
      const cropTopSrc = Math.min((scaledH - artAreaH) / scaledH, artTopCrop) * imgH;
      const srcH = imgW * artAreaH / ARTW;
      return { sx: 0, sy: cropTopSrc, sw: imgW, sh: srcH, dx: ARTX, dy: 0, dw: ARTW, dh: artAreaH };
    }
    // landscape/square-wider: cover, centred
    const srcW = imgH * ARTW / artAreaH;
    return { sx: (imgW - srcW) / 2, sy: 0, sw: srcW, sh: imgH, dx: ARTX, dy: 0, dw: ARTW, dh: artAreaH };
  }
  // short art bottom-anchors; the gap hides under the header band
  return { sx: 0, sy: 0, sw: imgW, sh: imgH, dx: ARTX, dy: artAreaH - scaledH, dw: ARTW, dh: scaledH };
}

/** True waveform from an audio file — build-manifest.mjs recipe, in-browser. */
export async function peaksFromAudio(file: File): Promise<number[] | null> {
  const ctx = new OfflineAudioContext(1, 8000, 8000);
  const buf = await file.arrayBuffer();
  const audio = await ctx.decodeAudioData(buf).catch(() => null);
  if (!audio) return null;
  const data = audio.getChannelData(0);
  const buckets = 96, out = new Array(buckets).fill(0);
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i]);
    const b = Math.min(buckets - 1, Math.floor((i / data.length) * buckets));
    if (v > out[b]) out[b] = v;
  }
  const max = Math.max(...out, 1e-6);
  return out.map((v) => +(v / max).toFixed(3));
}

export const fmtTime = (s: number) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`; };

export async function audioDuration(file: File): Promise<number | null> {
  const ctx = new OfflineAudioContext(1, 8000, 8000);
  const audio = await ctx.decodeAudioData(await file.arrayBuffer()).catch(() => null);
  return audio ? audio.duration : null;
}


/** Compose art + overlay on a 2048² canvas → PNG blob. Entirely client-side. */
export async function renderCasePNG(art: HTMLImageElement, spec: CaseSpec): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, W, H);
  const p = artPlacement(art.naturalWidth, art.naturalHeight, spec.artTopCrop || 0);
  ctx.drawImage(art, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);

  const svg = buildOverlaySVG(spec, await embeddedFontCSS());
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const overlay = new Image();
    overlay.src = url;
    await overlay.decode();
    ctx.drawImage(overlay, 0, 0, W, H);
  } finally {
    URL.revokeObjectURL(url);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas export failed"))), "image/png"));
}
