// THE IDEA SHELF — the Lexsycon lends its eyes. Match the visitor's lyric
// words against the public dictionary (a static R2 GET carrying none of their
// data; loadLexicon handles fetch + bundled fallback) and hand back sense
// paintings, palettes, and imagery prompts as one-tap seeds. Lazy: the 5.8MB
// shelf only loads when the drawer opens.

import { loadLexicon, resolveWord } from "@/lib/lexicon/lookup";

export interface LexSeed {
  word: string;
  emotion?: string;
  image?: string;          // public R2 painting (many senses have none)
  palette?: string[];      // sense palette hexes (tile fallback when no art)
  prompt?: string;         // imagery prompt — copy-paste seed
  gravity: string;
}

const STOP = new Set("the,a,an,and,or,but,in,on,at,to,for,of,with,is,was,are,be,been,it,its,im,i,you,your,we,our,they,them,he,she,his,her,my,me,this,that,these,those,as,so,if,then,than,too,very,just,dont,cant,wont,aint,got,get,let,gonna,wanna,like,yeah,oh,ooh,la,na,hey".split(","));

export async function lexiconSeeds(lyrics: string, max = 12): Promise<LexSeed[]> {
  const lex = await loadLexicon();
  const freq = new Map<string, number>();
  for (const raw of lyrics.toLowerCase().split(/[^a-z']+/)) {
    const w = raw.replace(/'/g, "");
    if (w.length < 3 || STOP.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const seeds: LexSeed[] = [];
  const seen = new Set<string>();
  for (const [word] of [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)) {
    const entry = resolveWord(lex, word);
    if (!entry || seen.has(entry.word)) continue;
    seen.add(entry.word);
    const tier = entry.gravity?.tier ?? "light";
    if (tier === "light") continue;                 // heavy words carry the looks
    const sense = entry.senses?.[0];
    if (!sense) continue;
    seeds.push({
      word: entry.word,
      emotion: sense.emotion,
      image: sense.images?.[0],
      palette: sense.palette,
      prompt: sense.imageryPrompts?.[0],
      gravity: tier,
    });
  }
  // heavy first, painted first
  return seeds
    .sort((a, b) => (b.gravity === "heavy" ? 1 : 0) - (a.gravity === "heavy" ? 1 : 0) || (b.image ? 1 : 0) - (a.image ? 1 : 0))
    .slice(0, max);
}

// ── PRESSINGS — Lexsycon-driven full variants ────────────────────────────────
// Each heavy word becomes a complete alternate look: the sense's own painted
// palette worn verbatim (base/accent synthesized from its hexes), the word on
// the spine, its painting on the chip. Variety straight from the dictionary.

import { COLLECTOR_PALETTES, type CollectorPalette } from "@/lib/studio/collectorPalettes";

export interface Pressing {
  word: string;
  emotion?: string;
  image?: string;
  custom: CollectorPalette;
  nearestKey: string;   // legacy engine + fallback bucket
}

const hexRgb = (h: string) => {
  const m = h.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)] as const;
};
const rgbHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const shade = (hex: string, k: number) => { const [r, g, b] = hexRgb(hex); return rgbHex(r * k, g * k, b * k); };
const lum = (hex: string) => { const [r, g, b] = hexRgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const hueOfHex = (hex: string): number | null => {
  const [r8, g8, b8] = hexRgb(hex);
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.08) return null;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
};
const hueDist = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

function nearestBucket(hexes: string[]): string {
  const target = hexes.map(hueOfHex).find((h) => h != null);
  if (target == null) return "ARCHIVE";
  let best = "ARCHIVE", bestD = 361;
  for (const [k, pal] of Object.entries(COLLECTOR_PALETTES)) {
    if (k === "ARCHIVE") continue;
    const h = hueOfHex(pal.accent);
    if (h == null) continue;
    const d = hueDist(target, h);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

/** Synthesize a wearable palette from a sense's raw hexes. */
export function paletteFromSense(word: string, hexes: string[], texture: string): CollectorPalette {
  const sorted = [...hexes].sort((a, b) => lum(b) - lum(a));
  const accent = sorted[0] ?? "#d4af37";
  const accent2 = sorted[1] ?? shade(accent, 0.7);
  const deep = sorted[sorted.length - 1] ?? "#101018";
  return {
    base: [shade(deep, 0.55), shade(deep, 0.22)],
    accent, accent2,
    ink: "#efeadd",
    texture,
    label: word.toUpperCase(),
  };
}

/** Build up to `max` full pressings from lyrics — heavy painted words first. */
export async function lexiconPressings(lyrics: string, max = 5): Promise<Pressing[]> {
  const seeds = await lexiconSeeds(lyrics, max * 2);
  return seeds
    .filter((s) => s.palette && s.palette.length >= 2)
    .slice(0, max)
    .map((s) => {
      const nearestKey = nearestBucket(s.palette!);
      const texture = COLLECTOR_PALETTES[nearestKey]?.texture ?? "leather";
      return { word: s.word, emotion: s.emotion, image: s.image, nearestKey, custom: paletteFromSense(s.word, s.palette!, texture) };
    });
}
