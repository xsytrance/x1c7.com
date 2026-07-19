// 8-TRACK — the cartridge nobody expects. Face label + edge strip. A pure
// descriptor: zero engine changes needed to add it, which is the abstraction
// doing its job. Nominal dieline (Stereo 8 cart face ≈ 133×99mm).

import type { ProjectSpec, SurfaceDef, TemplateDescriptor } from "../types";
import { esc } from "../kit/svgPrimitives";
import { bebasSizeToFit } from "../kit/fitText";
import { paletteOf, publicWord, GOLD } from "../render/renderSurface";

function faceChrome(p: ProjectSpec, s: SurfaceDef, px: (mm: number) => number): string {
  const { pal } = paletteOf(p, s.id);
  const title = (p.identity.title || "UNTITLED").toUpperCase();
  const label = (p.identity.label || "YOUR LABEL").toUpperCase();
  const word = publicWord(p, s.id);
  const W = s.size.w, H = s.size.h, band = 26;
  const fit = Math.min(px(9), bebasSizeToFit(title, px(W - band - 14), 2));
  return `
    <rect x="0" y="${px(H - band)}" width="${px(W)}" height="${px(band)}" fill="#0a0a10" opacity="0.94"/>
    <rect x="0" y="${px(H - band)}" width="${px(W)}" height="${px(0.6)}" fill="${GOLD}" opacity="0.85"/>
    <text x="${px(5)}" y="${px(H - band + 11)}" font-family="Bebas Neue" font-size="${fit}" fill="url(#goldText-${s.id})" letter-spacing="2">${esc(title)}</text>
    <text x="${px(5)}" y="${px(H - 5)}" font-family="Barlow Condensed SemiBold" font-size="${px(3.4)}" fill="${pal.accent}" letter-spacing="3">${esc(label)}</text>
    ${word ? `<text x="${px(W - 24)}" y="${px(H - 5)}" font-family="Barlow Condensed Medium" font-size="${px(2.8)}" fill="${pal.ink}" opacity="0.8" letter-spacing="2" text-anchor="end">${esc(word)}</text>` : ""}
    <g transform="translate(${px(W - 20)} ${px(H - band + 3)})">
      <rect x="0" y="0" width="${px(16)}" height="${px(9)}" fill="none" stroke="${GOLD}" stroke-width="${px(0.4)}" rx="${px(1)}"/>
      <text x="${px(8)}" y="${px(6.6)}" font-family="Bebas Neue" font-size="${px(5.4)}" fill="${GOLD}" text-anchor="middle">8</text>
    </g>
    <text x="${px(W - 20 + 8)}" y="${px(H - band + 15.5)}" font-family="Barlow Condensed Medium" font-size="${px(2)}" fill="${pal.ink}" opacity="0.7" letter-spacing="1.5" text-anchor="middle">STEREO 8</text>
  `;
}

function edgeChrome(p: ProjectSpec, s: SurfaceDef, px: (mm: number) => number): string {
  const { pal } = paletteOf(p, s.id);
  const title = (p.identity.title || "UNTITLED").toUpperCase();
  const label = (p.identity.label || "YOUR LABEL").toUpperCase();
  const fit = Math.min(px(s.size.h * 0.55), bebasSizeToFit(title, px(s.size.w * 0.62), 2));
  return `
    <text x="${px(4)}" y="${px(s.size.h * 0.68)}" font-family="Bebas Neue" font-size="${fit}" fill="url(#goldText-${s.id})" letter-spacing="2">${esc(title)}</text>
    <text x="${px(s.size.w - 4)}" y="${px(s.size.h * 0.66)}" font-family="Barlow Condensed SemiBold" font-size="${px(s.size.h * 0.28)}" fill="${pal.accent}" letter-spacing="2" text-anchor="end">${esc(label)}</text>
  `;
}

export const EIGHT_TRACK: TemplateDescriptor = {
  id: "eighttrack",
  name: "8-Track",
  era: "1965",
  blurb: "Cartridge face + edge strip. Program 1 begins.",
  surfaces: [
    {
      id: "face", name: "Cartridge face", size: { w: 133, h: 99 }, bleed: 2, safe: 4,
      layers: [
        { kind: "bg" },
        { kind: "art", slot: "cover" },
        { kind: "chrome", render: faceChrome },
        { kind: "advisory", region: { x: 133 - 26, y: 6, w: 22, h: 15 } },
      ],
    },
    {
      id: "edge", name: "Edge strip", size: { w: 133, h: 16 }, bleed: 2, safe: 2,
      layers: [{ kind: "bg" }, { kind: "chrome", render: edgeChrome }],
    },
  ],
  shell: null,
};
