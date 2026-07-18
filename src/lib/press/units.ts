// Units for the Pressing Plant: everything physical is MILLIMETERS; pixels
// exist only at render time. px = mm / 25.4 × dpi.

export const PRINT_DPI = 300;
export const PREVIEW_DPI = 96;
export const TEXTURE_DPI = 150;      // 3D CanvasTexture budget (~1200px for a 12" sleeve → clamped)

export const mmToPx = (mm: number, dpi: number) => (mm / 25.4) * dpi;
export const pxToMm = (px: number, dpi: number) => (px * 25.4) / dpi;
export const ptToPx = (pt: number, dpi: number) => (pt / 72) * dpi;

/** px-converter factory a renderer hands to layer/chrome functions. */
export const pxAt = (dpi: number) => (mm: number) => mmToPx(mm, dpi);

// ── Canvas ceiling probe ─────────────────────────────────────────────────────
// iOS Safari historically caps canvases around 4096²; a 12" sleeve at 300dpi
// is 3768² + bleed, right at the edge. Probe once, binary-searching the max
// square side that still readbacks, and let exporters pick a fallback dpi.
let maxSideCache: number | null = null;
export function probeMaxCanvasSide(): number {
  if (maxSideCache) return maxSideCache;
  if (typeof document === "undefined") return (maxSideCache = 16384);
  let lo = 2048, hi = 16384;
  const ok = (side: number) => {
    try {
      const c = document.createElement("canvas");
      c.width = side; c.height = side;
      const ctx = c.getContext("2d");
      if (!ctx) return false;
      ctx.fillStyle = "#123456";
      ctx.fillRect(side - 1, side - 1, 1, 1);
      const d = ctx.getImageData(side - 1, side - 1, 1, 1).data;
      c.width = 0; c.height = 0; // release
      return d[0] === 0x12;
    } catch { return false; }
  };
  while (hi - lo > 256) {
    const mid = Math.floor((lo + hi) / 2 / 256) * 256;
    if (ok(mid)) lo = mid; else hi = mid;
  }
  return (maxSideCache = lo);
}

/** Best exportable dpi for a surface given the device ceiling (never upscales past want). */
export function exportDpiFor(trimMm: { w: number; h: number }, bleedMm: number, want = PRINT_DPI): number {
  const side = Math.max(trimMm.w, trimMm.h) + 2 * bleedMm;
  const max = probeMaxCanvasSide();
  const cap = Math.floor((max * 25.4) / side);
  return Math.min(want, cap);
}
