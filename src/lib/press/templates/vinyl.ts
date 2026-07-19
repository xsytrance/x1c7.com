// VINYL — hell yeah. One factory, three sizes (12"/10"/7"): sleeve front +
// back, circle labels A/B with the true 7.3mm spindle hole. Sleeve mm are
// the trade-nominal jacket sizes; labeled nominal until print-verified.

import type { ProjectSpec, SurfaceDef, TemplateDescriptor } from "../types";
import { esc } from "../kit/svgPrimitives";
import { bebasSizeToFit } from "../kit/fitText";
import { paletteOf, GOLD } from "../render/renderSurface";

const SIZES = {
  12: { sleeve: 313, rpm: "33⅓ RPM", label: 100 },
  10: { sleeve: 260, rpm: "33⅓ RPM", label: 100 },
  7: { sleeve: 184, rpm: "45 RPM", label: 90 },
} as const;

function sleeveFrontChrome(p: ProjectSpec, s: SurfaceDef, px: (mm: number) => number): string {
  const { pal } = paletteOf(p, s.id);
  const title = (p.identity.title || "UNTITLED").toUpperCase();
  const label = (p.identity.label || "YOUR LABEL").toUpperCase();
  const W = s.size.w;
  const band = W * 0.12;
  const fit = Math.min(px(band * 0.5), bebasSizeToFit(title, px(W - band * 0.9), 3));
  return `
    <rect x="0" y="0" width="${px(W)}" height="${px(band)}" fill="#000" opacity="0.55"/>
    <rect x="0" y="${px(band)}" width="${px(W)}" height="${px(0.6)}" fill="${GOLD}" opacity="0.85"/>
    <text x="${px(band * 0.25)}" y="${px(band * 0.68)}" font-family="Bebas Neue" font-size="${fit}" fill="url(#goldText-${s.id})" letter-spacing="3">${esc(title)}</text>
    <text x="${px(W - band * 0.25)}" y="${px(band * 0.66)}" font-family="Barlow Condensed SemiBold" font-size="${px(band * 0.2)}" fill="${pal.accent}" letter-spacing="4" text-anchor="end">${esc(label)}</text>
  `;
}

function sleeveBackChrome(p: ProjectSpec, s: SurfaceDef, px: (mm: number) => number): string {
  const { pal } = paletteOf(p, s.id);
  const label = (p.identity.label || "YOUR LABEL").toUpperCase();
  const W = s.size.w, H = s.size.h;
  return `
    <text x="${px(W * 0.06)}" y="${px(H * 0.12)}" font-family="Bebas Neue" font-size="${px(W * 0.045)}" fill="${pal.ink}" letter-spacing="3">${esc((p.identity.title || "UNTITLED").toUpperCase())}</text>
    <line x1="${px(W * 0.06)}" y1="${px(H * 0.145)}" x2="${px(W * 0.94)}" y2="${px(H * 0.145)}" stroke="${GOLD}" stroke-width="${px(0.4)}" opacity="0.8"/>
    <text x="${px(W * 0.06)}" y="${px(H * 0.93)}" font-family="Barlow Condensed SemiBold" font-size="${px(W * 0.02)}" fill="${pal.accent}" letter-spacing="3">${esc(label)}</text>
    ${p.identity.handle ? `<text x="${px(W * 0.94)}" y="${px(H * 0.93)}" font-family="Barlow Condensed Medium" font-size="${px(W * 0.016)}" fill="#c94a3a" letter-spacing="2" text-anchor="end">${esc(p.identity.handle)}</text>` : ""}
  `;
}

function labelChrome(side: "A" | "B", rpm: string) {
  return (p: ProjectSpec, s: SurfaceDef, px: (mm: number) => number): string => {
    const { pal } = paletteOf(p, s.id);
    const D = s.size.w, c = D / 2;
    const title = (p.identity.title || "UNTITLED").toUpperCase();
    const label = (p.identity.label || "YOUR LABEL").toUpperCase();
    const fit = Math.min(px(7), bebasSizeToFit(title, px(D * 0.62), 2));
    return `
      <circle cx="${px(c)}" cy="${px(c)}" r="${px(c * 0.96)}" fill="none" stroke="${GOLD}" stroke-width="${px(0.45)}" opacity="0.9"/>
      <circle cx="${px(c)}" cy="${px(c)}" r="${px(c * 0.55)}" fill="none" stroke="${pal.ink}" stroke-width="${px(0.2)}" opacity="0.35" stroke-dasharray="2 5"/>
      <text x="${px(c)}" y="${px(c * 0.52)}" font-family="Barlow Condensed SemiBold" font-size="${px(3.4)}" fill="${pal.accent}" letter-spacing="4" text-anchor="middle">${esc(label)}</text>
      <text x="${px(c)}" y="${px(c * 0.8)}" font-family="Bebas Neue" font-size="${fit}" fill="url(#goldText-${s.id})" letter-spacing="2" text-anchor="middle">${esc(title)}</text>
      <text x="${px(c * 0.34)}" y="${px(c * 1.52)}" font-family="Bebas Neue" font-size="${px(8)}" fill="${GOLD}" text-anchor="middle">${side}</text>
      <text x="${px(c * 1.66)}" y="${px(c * 1.5)}" font-family="Barlow Condensed Medium" font-size="${px(2.8)}" fill="${pal.ink}" letter-spacing="1.5" text-anchor="middle">${esc(rpm)}</text>
      ${p.facts.bpm ? `<text x="${px(c)}" y="${px(c * 1.72)}" font-family="Barlow Condensed Medium" font-size="${px(2.6)}" fill="${pal.ink}" opacity="0.7" letter-spacing="2" text-anchor="middle">${p.facts.bpm} BPM${p.facts.runtime ? ` · ${esc(p.facts.runtime)}` : ""}</text>` : ""}
    `;
  };
}

export function makeVinyl(inch: 12 | 10 | 7): TemplateDescriptor {
  const v = SIZES[inch];
  const S = v.sleeve, L = v.label;
  const labelSurface = (side: "A" | "B"): SurfaceDef => ({
    id: `label${side}`, name: `Label ${side}`, size: { w: L, h: L }, bleed: 0, safe: 2,
    shape: "circle",
    holes: [{ cx: L / 2, cy: L / 2, r: 3.65 }],
    layers: [{ kind: "bg" }, { kind: "chrome", render: labelChrome(side, v.rpm) }],
  });
  return {
    id: `vinyl-${inch}`,
    name: `Vinyl ${inch}"`,
    era: "1948",
    blurb: `${inch}" sleeve front/back + labels A/B (${v.rpm}).`,
    surfaces: [
      {
        id: "sleeveFront", name: "Sleeve front", size: { w: S, h: S }, bleed: 3, safe: 6,
        layers: [
          { kind: "bg" },
          { kind: "art", slot: "cover" },
          { kind: "chrome", render: sleeveFrontChrome },
          { kind: "advisory", region: { x: S - 40, y: S - 28, w: 34, h: 20 } },
        ],
      },
      {
        id: "sleeveBack", name: "Sleeve back", size: { w: S, h: S }, bleed: 3, safe: 6,
        layers: [
          { kind: "bg" },
          { kind: "chrome", render: sleeveBackChrome },
          { kind: "tracklist", region: { x: S * 0.06, y: S * 0.2, w: S * 0.88, h: S * 0.45 } },
          { kind: "waveform", region: { x: S * 0.06, y: S * 0.72, w: S * 0.88, h: S * 0.1 } },
          { kind: "braille", region: { x: S * 0.06, y: S * 0.84, w: S * 0.1, h: S * 0.08 } },
        ],
      },
      labelSurface("A"),
      labelSurface("B"),
    ],
    shell: null, // the turntable arrives with THE BOOTH (P6)
  };
}
