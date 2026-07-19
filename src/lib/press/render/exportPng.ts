// Per-surface print export: bg SVG → canvas → art (cover-fit) → fg SVG →
// hub holes punched to TRANSPARENT → PNG blob. Sequential, one canvas at a
// time, torn down after — phones survive a full vinyl sleeve run.

import { embeddedFontCSS } from "../kit/fonts";
import { exportDpiFor } from "../units";
import { renderSurfaceSVG, coverFit, artRegionMm } from "./renderSurface";
import type { ProjectSpec, SurfaceDef } from "../types";

async function svgToImage(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

export interface SurfaceExport { blob: Blob; dpi: number; widthPx: number; heightPx: number }

export async function exportSurfacePNG(
  s: SurfaceDef,
  p: ProjectSpec,
  art: HTMLImageElement | null,
): Promise<SurfaceExport> {
  const dpi = exportDpiFor(s.size, s.bleed, s.exportDpi ?? 300);
  const pxPerMm = dpi / 25.4;
  const px = (mm: number) => mm * pxPerMm;
  const W = Math.round(px(s.size.w + 2 * s.bleed)), H = Math.round(px(s.size.h + 2 * s.bleed));

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const fontCSS = await embeddedFontCSS();

  // 1. everything under the art
  ctx.drawImage(await svgToImage(renderSurfaceSVG(s, p, { pxPerMm, mode: "bg", bleed: true, fontCSS })), 0, 0, W, H);

  // 2. the art, cover-fit into its region (extended into bleed)
  const hasArtLayer = s.layers.some((l) => l.kind === "art");
  if (art && hasArtLayer) {
    const region = artRegionMm(s);
    const f = coverFit(art.naturalWidth, art.naturalHeight, region, px);
    ctx.save();
    if (s.shape === "circle") {
      ctx.beginPath();
      ctx.arc(px(s.size.w / 2 + s.bleed), px(s.size.h / 2 + s.bleed), px(Math.min(s.size.w, s.size.h) / 2 + s.bleed), 0, Math.PI * 2);
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
    }
    ctx.drawImage(art, f.x, f.y + 0, f.w, f.h);
    ctx.restore();
  }

  // 3. chrome/text/waveform over the art
  ctx.drawImage(await svgToImage(renderSurfaceSVG(s, p, { pxPerMm, mode: "fg", bleed: true, fontCSS })), 0, 0, W, H);

  // 4. circle trim + hub holes → transparent
  if (s.shape === "circle") {
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.arc(px(s.size.w / 2 + s.bleed), px(s.size.h / 2 + s.bleed), px(Math.min(s.size.w, s.size.h) / 2 + s.bleed), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  for (const h of s.holes ?? []) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(px(h.cx + s.bleed), px(h.cy + s.bleed), px(h.r), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas export failed"))), "image/png"));
  canvas.width = 0; canvas.height = 0; // explicit teardown
  return { blob, dpi, widthPx: W, heightPx: H };
}
