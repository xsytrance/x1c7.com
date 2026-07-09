// Per-song site theme: the palette the whole UI morphs to while a track plays.

export interface Theme {
  primary: string;   // hex — dominant accent (buttons, glows)
  secondary: string; // hex — supporting accent
  accent: string;    // hex — highlight (cursor, peaks)
  bg: string;        // hex — deep background base
  intensity: number; // 0..1 — how dramatic the morph is
}

/** Partial theme stored in tracks.theme (jsonb); any field may be pinned by admin. */
export type ThemeOverride = Partial<Theme>;

export const DEFAULT_THEME: Theme = {
  primary: "#ff2440",
  secondary: "#43f7ff",
  accent: "#8dff4a",
  bg: "#05030b",
  intensity: 0.6,
};

// ── hex ⇄ hsl helpers ──────────────────────────────────────────────────────
function normalizeHex(hex: string): string {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return "";
  return `#${h.toLowerCase()}`;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return [
    parseInt(n.slice(1, 3), 16),
    parseInt(n.slice(3, 5), 16),
    parseInt(n.slice(5, 7), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

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

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360 / 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
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
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return rgbToHex(r * 255, g * 255, b * 255);
}

/**
 * Derive a full theme from a single seed color — the baseline used when a track
 * has no auto-extracted palette and no manual override. Rotates hue for the
 * supporting accents and sinks a dark, faintly-tinted background.
 */
export function deriveTheme(seed: string): Theme {
  const rgb = hexToRgb(seed) || hexToRgb(DEFAULT_THEME.primary)!;
  const [h, s0, l0] = rgbToHsl(...rgb);
  // Near-greyscale seeds are INTENTIONAL (e.g. a black-and-white film world):
  // preserve the monochrome instead of vividizing it into a random hue.
  if (s0 < 0.08) {
    const l = Math.max(0.55, Math.min(0.85, l0 || 0.7));
    return {
      primary: hslToHex(0, 0, l),
      secondary: hslToHex(0, 0, Math.max(0.35, l - 0.25)),
      accent: hslToHex(0, 0, Math.min(0.95, l + 0.12)),
      bg: hslToHex(0, 0, 0.04),
      intensity: DEFAULT_THEME.intensity,
    };
  }
  const s = Math.max(0.55, s0);
  const l = Math.max(0.5, Math.min(0.62, l0 || 0.55));
  return {
    primary: rgbToHex(...rgb),
    secondary: hslToHex(h + 45, s * 0.95, l),
    accent: hslToHex(h - 35, Math.min(1, s * 1.05), Math.min(0.7, l + 0.08)),
    bg: hslToHex(h, Math.min(0.5, s * 0.6), 0.045),
    intensity: DEFAULT_THEME.intensity,
  };
}

/**
 * Resolve the theme for a track. Priority (lowest → highest):
 *   derived-from-color  <  auto-extracted palette  <  manual override.
 */
export function resolveTheme(seedColor: string, extracted?: ThemeOverride | null, override?: ThemeOverride | null): Theme {
  let theme = deriveTheme(seedColor);
  const apply = (o?: ThemeOverride | null) => {
    if (!o) return;
    for (const k of ["primary", "secondary", "accent", "bg"] as const) {
      const v = o[k];
      if (typeof v === "string" && normalizeHex(v)) theme[k] = normalizeHex(v);
    }
    if (typeof o.intensity === "number" && isFinite(o.intensity)) {
      theme.intensity = Math.max(0, Math.min(1, o.intensity));
    }
  };
  apply(extracted);
  apply(override);
  return theme;
}
