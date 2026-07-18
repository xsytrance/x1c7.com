// PRESS KIT — Bebas Neue fit math with real glyph metrics (baked from the TTF
// in src/lib/collector/bebasWidths.ts). Extracted from webEngine.ts
// (Pressing Plant P1): every spine/title fit across all formats solves with
// these, so text can never overrun its zone by construction.

import { bebasEm } from "@/lib/collector/bebasWidths";

export { bebasEm };

/** Rendered length of `text` at font-size `size` with per-gap letter-spacing `ls`. */
export const bebasLen = (text: string, size: number, ls = 4) =>
  bebasEm(text) * size + Math.max(0, text.length - 1) * ls;

/** Largest font-size at which `text` fits `room` with letter-spacing `ls`. */
export const bebasSizeToFit = (text: string, room: number, ls = 4) =>
  (room - Math.max(0, text.length - 1) * ls) / bebasEm(text);
