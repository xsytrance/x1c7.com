// CD JEWEL CASE — front insert, tray card with its two 6.5mm spines, disc
// label. The booklet rides separately through THE BINDERY (booklet/).
// Dielines are trade-nominal (120×120 insert, 151×118 tray, 120Ø disc with
// a 23mm hub punch that also covers the clamping ring) until print-verified.

import type { ProjectSpec, SurfaceDef, TemplateDescriptor } from "../types";
import { esc } from "../kit/svgPrimitives";
import { bebasSizeToFit } from "../kit/fitText";
import { paletteOf, publicWord, GOLD } from "../render/renderSurface";

const TRAY_W = 151, TRAY_H = 118, SPINE_W = 6.5;

function frontChrome(p: ProjectSpec, s: SurfaceDef, px: (mm: number) => number): string {
  const { pal } = paletteOf(p, s.id);
  const title = (p.identity.title || "UNTITLED").toUpperCase();
  const label = (p.identity.label || "YOUR LABEL").toUpperCase();
  const band = 14;
  const fit = Math.min(px(band * 0.52), bebasSizeToFit(title, px(s.size.w - 10), 2));
  return `
    <rect x="0" y="0" width="${px(s.size.w)}" height="${px(band)}" fill="#000" opacity="0.5"/>
    <rect x="0" y="${px(band)}" width="${px(s.size.w)}" height="${px(0.5)}" fill="${GOLD}" opacity="0.85"/>
    <text x="${px(4)}" y="${px(band * 0.7)}" font-family="Bebas Neue" font-size="${fit}" fill="url(#goldText-${s.id})" letter-spacing="2">${esc(title)}</text>
    <text x="${px(s.size.w - 4)}" y="${px(band * 0.66)}" font-family="Barlow Condensed SemiBold" font-size="${px(band * 0.22)}" fill="${pal.accent}" letter-spacing="3" text-anchor="end">${esc(label)}</text>
  `;
}

function trayChrome(p: ProjectSpec, s: SurfaceDef, px: (mm: number) => number): string {
  const { pal } = paletteOf(p, s.id);
  const title = (p.identity.title || "UNTITLED").toUpperCase();
  const label = (p.identity.label || "YOUR LABEL").toUpperCase();
  const word = publicWord(p, s.id);
  const spineFit = Math.min(px(SPINE_W * 0.66), bebasSizeToFit(title, px(TRAY_H - 16), 2));
  // both spines carry the title reading downward (left) / upward (right) like the shelf
  const spine = (x0: number, dir: 1 | -1) => `
    <rect x="${px(x0)}" y="0" width="${px(SPINE_W)}" height="${px(TRAY_H)}" fill="#0a0a10" opacity="0.94"/>
    <rect x="${px(x0 + (dir === 1 ? SPINE_W : 0)) - px(dir === 1 ? 0.5 : 0)}" y="0" width="${px(0.5)}" height="${px(TRAY_H)}" fill="${GOLD}" opacity="0.85"/>
    <text x="${px(x0 + SPINE_W / 2)}" y="${px(dir === 1 ? 6 : TRAY_H - 6)}" font-family="Bebas Neue" font-size="${spineFit}"
      fill="url(#goldText-${s.id})" letter-spacing="2" text-anchor="${dir === 1 ? "start" : "start"}"
      transform="rotate(${dir === 1 ? 90 : -90} ${px(x0 + SPINE_W / 2)} ${px(dir === 1 ? 6 : TRAY_H - 6)})">${esc(title)}</text>
  `;
  return `
    ${spine(0, 1)}
    ${spine(TRAY_W - SPINE_W, -1)}
    <text x="${px(SPINE_W + 4)}" y="${px(10)}" font-family="Bebas Neue" font-size="${px(6)}" fill="${pal.ink}" letter-spacing="2">${esc(title)}</text>
    ${word ? `<text x="${px(TRAY_W - SPINE_W - 4)}" y="${px(10)}" font-family="Barlow Condensed SemiBold" font-size="${px(3.2)}" fill="${pal.accent}" letter-spacing="3" text-anchor="end">${esc(word)}</text>` : ""}
    <line x1="${px(SPINE_W + 4)}" y1="${px(13)}" x2="${px(TRAY_W - SPINE_W - 4)}" y2="${px(13)}" stroke="${GOLD}" stroke-width="${px(0.35)}" opacity="0.85"/>
    <text x="${px(SPINE_W + 4)}" y="${px(TRAY_H - 5)}" font-family="Barlow Condensed SemiBold" font-size="${px(3)}" fill="${pal.accent}" letter-spacing="3">${esc(label)}</text>
    ${p.identity.handle ? `<text x="${px(TRAY_W - SPINE_W - 4)}" y="${px(TRAY_H - 5)}" font-family="Barlow Condensed Medium" font-size="${px(2.6)}" fill="#c94a3a" letter-spacing="2" text-anchor="end">${esc(p.identity.handle)}</text>` : ""}
  `;
}

function discChrome(p: ProjectSpec, s: SurfaceDef, px: (mm: number) => number): string {
  const { pal } = paletteOf(p, s.id);
  const c = s.size.w / 2;
  const title = (p.identity.title || "UNTITLED").toUpperCase();
  const label = (p.identity.label || "YOUR LABEL").toUpperCase();
  const fit = Math.min(px(8), bebasSizeToFit(title, px(s.size.w * 0.6), 2));
  return `
    <circle cx="${px(c)}" cy="${px(c)}" r="${px(c * 0.965)}" fill="none" stroke="${GOLD}" stroke-width="${px(0.5)}" opacity="0.9"/>
    <circle cx="${px(c)}" cy="${px(c)}" r="${px(23)}" fill="none" stroke="${pal.ink}" stroke-width="${px(0.25)}" opacity="0.35" stroke-dasharray="2 5"/>
    <text x="${px(c)}" y="${px(c - 30)}" font-family="Barlow Condensed SemiBold" font-size="${px(3.6)}" fill="${pal.accent}" letter-spacing="4" text-anchor="middle">${esc(label)}</text>
    <text x="${px(c)}" y="${px(c - 18)}" font-family="Bebas Neue" font-size="${fit}" fill="url(#goldText-${s.id})" letter-spacing="2" text-anchor="middle">${esc(title)}</text>
    ${p.facts.runtime ? `<text x="${px(c)}" y="${px(c + 32)}" font-family="Barlow Condensed Medium" font-size="${px(3)}" fill="${pal.ink}" opacity="0.75" letter-spacing="2" text-anchor="middle">${esc(p.facts.runtime)}${p.facts.bpm ? ` · ${p.facts.bpm} BPM` : ""}</text>` : ""}
  `;
}

export const JEWEL_CASE: TemplateDescriptor = {
  id: "jewel",
  name: "CD Jewel Case",
  era: "1985",
  blurb: "Front insert, tray with spines, disc — booklet in the Bindery.",
  surfaces: [
    {
      id: "front", name: "Front insert", size: { w: 120, h: 120 }, bleed: 3, safe: 4,
      layers: [
        { kind: "bg" },
        { kind: "art", slot: "cover" },
        { kind: "chrome", render: frontChrome },
        { kind: "advisory", region: { x: 120 - 30, y: 120 - 22, w: 26, h: 16 } },
      ],
    },
    {
      id: "tray", name: "Tray card", size: { w: TRAY_W, h: TRAY_H }, bleed: 3, safe: 4,
      folds: [{ at: SPINE_W, axis: "x", label: "spine L" }, { at: TRAY_W - SPINE_W, axis: "x", label: "spine R" }],
      layers: [
        { kind: "bg" },
        { kind: "chrome", render: trayChrome },
        { kind: "tracklist", region: { x: SPINE_W + 4, y: 18, w: TRAY_W - 2 * SPINE_W - 8, h: 74 } },
        { kind: "waveform", region: { x: SPINE_W + 4, y: 96, w: TRAY_W - 2 * SPINE_W - 8, h: 10 } },
      ],
    },
    {
      id: "disc", name: "Disc label", size: { w: 120, h: 120 }, bleed: 0, safe: 2,
      shape: "circle",
      holes: [{ cx: 60, cy: 60, r: 11.5 }],
      layers: [{ kind: "bg" }, { kind: "chrome", render: discChrome }],
    },
  ],
  shell: null, // the openable jewel shell arrives with THE BOOTH (P6)
};
