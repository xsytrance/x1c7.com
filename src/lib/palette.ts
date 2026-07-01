// Auto palette extraction from cover art. Draws the cover to a small canvas and
// samples dominant vibrant colors. REQUIRES CORS (GET *) on the art bucket +
// crossOrigin="anonymous"; otherwise the canvas taints and getImageData throws —
// in which case we resolve to null and the caller falls back to the seed color.

import type { ThemeOverride } from "./theme";

const cache = new Map<string, ThemeOverride | null>();
const inflight = new Map<string, Promise<ThemeOverride | null>>();

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = (((h % 360) + 360) % 360) / 360;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Push a swatch toward neon: keep the hue, floor the saturation, and pull the
// lightness into a punchy mid-range so muddy/dark covers still yield vivid
// accents that read on the black UI. `min` lets accents sit slightly brighter.
function vivid(r: number, g: number, b: number, minL = 0.5): string {
  const [h, s, l] = rgbToHsl(r, g, b);
  const [vr, vg, vb] = hslToRgb(h, Math.max(0.62, s), Math.max(minL, Math.min(0.66, l < 0.5 ? l + 0.22 : l)));
  const c = (v: number) => v.toString(16).padStart(2, "0");
  return `#${c(vr)}${c(vg)}${c(vb)}`;
}

interface Bucket { r: number; g: number; b: number; h: number; s: number; l: number; weight: number; }

function samplePalette(data: Uint8ClampedArray): ThemeOverride | null {
  // Quantize into 30°-wide hue buckets, weighting by saturation so vivid pixels
  // dominate. Near-greyscale pixels are ignored for the accents.
  const bins = new Array(12).fill(null).map(() => ({ r: 0, g: 0, b: 0, s: 0, count: 0, weight: 0 }));
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);
    if (l < 0.12 || l > 0.9 || s < 0.18) continue; // skip near-black/white/grey
    const w = s * (1 - Math.abs(l - 0.5)); // vivid + mid-lightness weighted
    const bin = bins[Math.floor(h / 30) % 12];
    bin.r += r * w; bin.g += g * w; bin.b += b * w; bin.s += s * w;
    bin.count++; bin.weight += w;
  }

  const buckets: Bucket[] = bins
    .filter((b) => b.weight > 0)
    .map((b) => {
      const r = Math.round(b.r / b.weight), g = Math.round(b.g / b.weight), bl = Math.round(b.b / b.weight);
      const [h, s, l] = rgbToHsl(r, g, bl);
      return { r, g, b: bl, h, s, l, weight: b.weight };
    })
    .sort((a, b) => b.weight - a.weight);

  if (buckets.length === 0) return null;

  // Pick up to 3 hue-distinct swatches for primary/secondary/accent.
  const picks: Bucket[] = [];
  for (const b of buckets) {
    if (picks.every((p) => Math.abs(((p.h - b.h + 540) % 360) - 180) > 25)) picks.push(b);
    if (picks.length === 3) break;
  }
  while (picks.length < 3) picks.push(picks[picks.length - 1] || buckets[0]);

  return {
    primary: vivid(picks[0].r, picks[0].g, picks[0].b, 0.52),
    secondary: vivid(picks[1].r, picks[1].g, picks[1].b, 0.5),
    accent: vivid(picks[2].r, picks[2].g, picks[2].b, 0.58),
  };
}

export function extractPalette(url: string): Promise<ThemeOverride | null> {
  if (!url || url.startsWith("data:")) return Promise.resolve(null);
  if (cache.has(url)) return Promise.resolve(cache.get(url)!);
  const existing = inflight.get(url);
  if (existing) return existing;

  const p = new Promise<ThemeOverride | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    const done = (result: ThemeOverride | null) => {
      cache.set(url, result);
      inflight.delete(url);
      resolve(result);
    };
    img.onload = () => {
      try {
        const size = 40;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return done(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size); // throws if tainted (no CORS)
        done(samplePalette(data));
      } catch {
        done(null); // tainted canvas — CORS not enabled on the art bucket yet
      }
    };
    img.onerror = () => done(null);
    img.src = url;
  });

  inflight.set(url, p);
  return p;
}
