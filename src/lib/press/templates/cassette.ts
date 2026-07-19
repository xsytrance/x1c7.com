// CASSETTE — J-card (front 65mm / spine 12.7mm / back flap 14.3mm, Norelco
// nominal) + shell labels A/B with hub windows. Dielines are nominal until
// print-verified (exports carry the fold guides the Bindery way).

import type { ProjectSpec, SurfaceDef, TemplateDescriptor } from "../types";
import { esc } from "../kit/svgPrimitives";
import { bebasSizeToFit } from "../kit/fitText";
import { paletteOf, publicWord, GOLD } from "../render/renderSurface";

// J-card panels (y, from top): front 0–65 · spine 65–77.7 · flap 77.7–92
const JW = 101.6, JH = 92, SPINE_Y = 65, FLAP_Y = 77.7;

function jcardChrome(p: ProjectSpec, s: SurfaceDef, px: (mm: number) => number): string {
  const { pal } = paletteOf(p, s.id);
  const title = (p.identity.title || "UNTITLED").toUpperCase();
  const label = (p.identity.label || "YOUR LABEL").toUpperCase();
  const word = publicWord(p, s.id);
  // spine band: darkened plate; title fitted to the width with real metrics
  const spineH = FLAP_Y - SPINE_Y;
  const fit = Math.min(px(spineH * 0.52), bebasSizeToFit(title, px(JW - 30), 2));
  return `
    <rect x="0" y="${px(SPINE_Y)}" width="${px(JW)}" height="${px(spineH)}" fill="#0a0a10" opacity="0.94"/>
    <rect x="0" y="${px(SPINE_Y)}" width="${px(JW)}" height="${px(0.5)}" fill="${GOLD}" opacity="0.8"/>
    <rect x="0" y="${px(FLAP_Y) - px(0.5)}" width="${px(JW)}" height="${px(0.5)}" fill="${GOLD}" opacity="0.8"/>
    <text x="${px(4)}" y="${px(SPINE_Y + spineH / 2) + fit * 0.36}" font-family="Bebas Neue" font-size="${fit}" fill="url(#goldText-${s.id})" letter-spacing="2">${esc(title)}</text>
    <text x="${px(JW - 4)}" y="${px(SPINE_Y + spineH / 2) + px(1.1)}" font-family="Barlow Condensed SemiBold" font-size="${px(3.2)}" fill="${pal.accent}" letter-spacing="3" text-anchor="end">${esc(word)}</text>
    <rect x="0" y="${px(58)}" width="${px(JW)}" height="${px(7)}" fill="#000" opacity="0.55"/>
    <text x="${px(4)}" y="${px(63)}" font-family="Barlow Condensed SemiBold" font-size="${px(3.4)}" fill="#e8e4da" letter-spacing="2">${esc(label)}</text>
    ${p.identity.handle ? `<text x="${px(JW - 4)}" y="${px(63)}" font-family="Barlow Condensed Medium" font-size="${px(2.8)}" fill="#c94a3a" letter-spacing="2" text-anchor="end">${esc(p.identity.handle)}</text>` : ""}
  `;
}

function shellChrome(side: "A" | "B") {
  return (p: ProjectSpec, s: SurfaceDef, px: (mm: number) => number): string => {
    const { pal } = paletteOf(p, s.id);
    const title = (p.identity.title || "UNTITLED").toUpperCase();
    const label = (p.identity.label || "YOUR LABEL").toUpperCase();
    return `
      <circle cx="${px(8)}" cy="${px(18)}" r="${px(5.2)}" fill="none" stroke="${GOLD}" stroke-width="${px(0.5)}"/>
      <text x="${px(8)}" y="${px(20.2)}" font-family="Bebas Neue" font-size="${px(6.4)}" fill="${GOLD}" text-anchor="middle">${side}</text>
      <text x="${px(16)}" y="${px(13)}" font-family="Bebas Neue" font-size="${px(5.6)}" fill="${pal.ink}" letter-spacing="1.5">${esc(title.slice(0, 30))}</text>
      <text x="${px(16)}" y="${px(19)}" font-family="Barlow Condensed Medium" font-size="${px(3)}" fill="${pal.accent}" letter-spacing="2">${esc(label)}</text>
      <line x1="${px(16)}" y1="${px(15)}" x2="${px(78)}" y2="${px(15)}" stroke="${pal.ink}" stroke-width="${px(0.25)}" opacity="0.3" stroke-dasharray="2 4"/>
    `;
  };
}

export const CASSETTE: TemplateDescriptor = {
  id: "cassette",
  name: "Cassette",
  era: "1979",
  blurb: "J-card with real folds, shell labels A/B.",
  surfaces: [
    {
      id: "jcard", name: "J-card", size: { w: JW, h: JH }, bleed: 3, safe: 3,
      folds: [{ at: SPINE_Y, axis: "y", label: "spine fold" }, { at: FLAP_Y, axis: "y", label: "flap fold" }],
      layers: [
        { kind: "bg" },
        { kind: "art", slot: "cover" },       // fills the front panel visually (cover-fit whole card; spine/flap plates draw over)
        { kind: "chrome", render: jcardChrome },
        { kind: "waveform", region: { x: 6, y: 80, w: JW - 12, h: 8 } },
        { kind: "advisory", region: { x: JW - 26, y: 38, w: 22, h: 16 } },
      ],
    },
    {
      id: "labelA", name: "Shell label A", size: { w: 84, h: 36 }, bleed: 1, safe: 2,
      holes: [{ cx: 22, cy: 21, r: 6.5 }, { cx: 62, cy: 21, r: 6.5 }],
      layers: [{ kind: "bg" }, { kind: "chrome", render: shellChrome("A") }],
    },
    {
      id: "labelB", name: "Shell label B", size: { w: 84, h: 36 }, bleed: 1, safe: 2,
      holes: [{ cx: 22, cy: 21, r: 6.5 }, { cx: 62, cy: 21, r: 6.5 }],
      layers: [{ kind: "bg" }, { kind: "chrome", render: shellChrome("B") }],
    },
  ],
  shell: null, // the cassette shell arrives with THE BOOTH (P6)
};
