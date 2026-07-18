// ═══════════════════════════════════════════════════════════════════════════
// PRESS KIT — SVG primitives shared by every format's chrome.
// EXTRACTED move-only from src/lib/collector/webEngine.ts (Pressing Plant P1);
// webEngine re-imports these, and scripts/press/check-parity.mjs proves the
// collector case's output is byte-identical. The print engine's originals
// live in scripts/song-art/collector/engine.mjs — keep all three in step.
// ═══════════════════════════════════════════════════════════════════════════

export const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── Real Braille (Grade 1) ───────────────────────────────────────────────────
export const BRAILLE: Record<string, number[]> = { a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5], k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5], p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5], u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6], "&": [1, 2, 3, 4, 6], "-": [3, 6] };
export function brailleSVG(word: string, cx: number, y: number, dotR: number, color: string): string {
  const cells = [...word.toLowerCase()].map((ch) => BRAILLE[ch]).filter(Boolean);
  const colW = dotR * 3.2, rowH = dotR * 3.2, cellH = rowH * 3 + dotR * 2.6;
  const twoCol = cells.length > 5;
  const perCol = twoCol ? Math.ceil(cells.length / 2) : cells.length;
  const colX = (ci: number) => (twoCol ? cx + (ci < perCol ? -1 : 1) * dotR * 4.2 : cx);
  let svg = "";
  cells.forEach((dots, ci) => {
    const row = twoCol ? ci % perCol : ci;
    const top = y + row * cellH;
    const x0 = colX(ci);
    for (let d = 1; d <= 6; d++) {
      const col = d <= 3 ? 0 : 1, r = (d - 1) % 3;
      svg += `<circle cx="${x0 + (col - 0.5) * colW}" cy="${top + r * rowH}" r="${dotR}" fill="${color}" opacity="${dots.includes(d) ? 0.92 : 0.16}"/>`;
    }
  });
  return svg;
}

// ── Texture filters ──────────────────────────────────────────────────────────
export function textureDefs(t: string, id: string): string {
  const turb: Record<string, string> = {
    leather: `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.10 0"/>`,
    brushed: `<feTurbulence type="fractalNoise" baseFrequency="0.005 0.9" numOctaves="2" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.12 0"/>`,
    wood: `<feTurbulence type="fractalNoise" baseFrequency="0.012 0.28" numOctaves="3" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.85  0 0 0 0 0.6  0 0 0 0.12 0"/>`,
    smoke: `<feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="4" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0"/>`,
    grid: `<feTurbulence type="turbulence" baseFrequency="0.35" numOctaves="1" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 0.6  0 0 0 0 1  0 0 0 0 0.9  0 0 0 0.07 0"/>`,
    concrete: `<feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="4" seed="13"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.13 0"/>`,
    distressed: `<feTurbulence type="fractalNoise" baseFrequency="0.12 0.5" numOctaves="4" seed="21"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 0.7  0 0 0 0.16 0"/>`,
    carved: `<feTurbulence type="turbulence" baseFrequency="0.05 0.18" numOctaves="2" seed="17"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.8  0 0 0 0 0.5  0 0 0 0.12 0"/>`,
    satin: `<feTurbulence type="fractalNoise" baseFrequency="0.006 0.10" numOctaves="2" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.9  0 0 0 0 1  0 0 0 0.09 0"/>`,
    retro: `<feTurbulence type="turbulence" baseFrequency="0.9 0.06" numOctaves="1" seed="8"/><feColorMatrix type="matrix" values="0 0 0 0 0.8  0 0 0 0 0.5  0 0 0 0 1  0 0 0 0.08 0"/>`,
    paper: `<feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" seed="6"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.98  0 0 0 0 0.9  0 0 0 0.08 0"/>`,
    mist: `<feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="2"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.10 0"/>`,
  };
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%">${turb[t] || ""}</filter>`;
}

// ── Waveform bars ────────────────────────────────────────────────────────────
export function wavePath(peaks: number[], x: number, midY: number, w: number, maxH: number, color: string, opacity = 0.95): string {
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

// ── House furniture ──────────────────────────────────────────────────────────
export const crownSVG = (cx: number, cy: number, s: number, color: string) =>
  `<path d="M ${cx - s} ${cy + s * 0.55} L ${cx - s} ${cy - s * 0.1} L ${cx - s * 0.5} ${cy + s * 0.15} L ${cx} ${cy - s * 0.6} L ${cx + s * 0.5} ${cy + s * 0.15} L ${cx + s} ${cy - s * 0.1} L ${cx + s} ${cy + s * 0.55} Z" fill="${color}"/>
  <rect x="${cx - s}" y="${cy + s * 0.72}" width="${2 * s}" height="${s * 0.22}" rx="${s * 0.1}" fill="${color}"/>`;

export function emblemSVG(cx: number, cy: number, r: number, color: string, letter: string): string {
  let spikes = "";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    spikes += `<line x1="${cx + Math.cos(a) * r * 1.06}" y1="${cy + Math.sin(a) * r * 1.06}" x2="${cx + Math.cos(a) * r * 1.3}" y2="${cy + Math.sin(a) * r * 1.3}" stroke="${color}" stroke-width="${r * 0.09}" stroke-linecap="round"/>`;
  }
  return `${spikes}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${r * 0.12}"/>
  <text x="${cx}" y="${cy + r * 0.42}" font-family="Bebas Neue" font-size="${r * 1.35}" fill="${color}" text-anchor="middle">${esc(letter)}</text>`;
}

export const clockSVG = (cx: number, cy: number, r: number, color: string) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${r * 0.18}"/>
  <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - r * 0.62}" stroke="${color}" stroke-width="${r * 0.18}" stroke-linecap="round"/>
  <line x1="${cx}" y1="${cy}" x2="${cx + r * 0.5}" y2="${cy + r * 0.2}" stroke="${color}" stroke-width="${r * 0.18}" stroke-linecap="round"/>`;

export function pulseSVG(x: number, cy: number, w: number, color: string): string {
  const p = [[0, 0], [0.18, 0], [0.26, -0.5], [0.34, 0.9], [0.42, -1], [0.5, 0.55], [0.58, 0], [1, 0]];
  const amp = w * 0.16;
  const d = p.map(([px, py], i) => `${i ? "L" : "M"} ${(x + px * w).toFixed(1)} ${(cy + py * amp).toFixed(1)}`).join(" ");
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>`;
}
