// Shape-morph library: emotionally-charged words dissolve into glyphs.
// Paths are drawn in a 100x100 viewBox, stroke-based so they can "draw" themselves
// in via stroke-dash animation and glow with the theme.

export interface Glyph {
  id: string;
  path: string;      // svg path (100x100 box)
  fillRule?: "evenodd";
}

export const GLYPHS: Record<string, Glyph> = {
  flame: {
    id: "flame",
    path: "M50 8 C58 24 74 32 74 54 C74 72 63 86 50 92 C37 86 26 72 26 54 C26 44 31 36 36 30 C36 40 40 46 46 48 C42 36 46 20 50 8 Z M50 62 C55 66 58 70 56 76 C54 81 50 83 50 83 C50 83 46 81 44 76 C42 70 45 66 50 62 Z",
    fillRule: "evenodd",
  },
  heart: {
    id: "heart",
    path: "M50 88 C28 70 12 56 12 38 C12 24 22 14 34 14 C42 14 48 18 50 24 C52 18 58 14 66 14 C78 14 88 24 88 38 C88 56 72 70 50 88 Z",
  },
  dagger: {
    id: "dagger",
    path: "M50 4 L58 30 L54 30 L54 58 L62 58 L62 66 L54 66 L54 74 L58 78 L54 96 L46 96 L42 78 L46 74 L46 66 L38 66 L38 58 L46 58 L46 30 L42 30 Z",
  },
  bolt: {
    id: "bolt",
    path: "M58 4 L24 54 L44 54 L38 96 L76 42 L54 42 Z",
  },
  moon: {
    id: "moon",
    path: "M62 8 C42 14 28 32 28 52 C28 74 46 92 68 92 C72 92 76 91 80 90 C64 84 52 68 52 50 C52 32 62 16 78 10 C73 8 67 7 62 8 Z",
  },
  sun: {
    id: "sun",
    path: "M50 30 A20 20 0 1 0 50 70 A20 20 0 1 0 50 30 Z M50 2 L54 16 L46 16 Z M50 98 L46 84 L54 84 Z M2 50 L16 46 L16 54 Z M98 50 L84 54 L84 46 Z M16 16 L28 24 L22 30 Z M84 84 L72 76 L78 70 Z M84 16 L78 30 L72 24 Z M16 84 L22 70 L28 76 Z",
    fillRule: "evenodd",
  },
  droplet: {
    id: "droplet",
    path: "M50 6 C62 28 78 44 78 62 C78 79 65 92 50 92 C35 92 22 79 22 62 C22 44 38 28 50 6 Z",
  },
  eye: {
    id: "eye",
    path: "M50 26 C72 26 88 42 96 50 C88 58 72 74 50 74 C28 74 12 58 4 50 C12 42 28 26 50 26 Z M50 36 A14 14 0 1 0 50 64 A14 14 0 1 0 50 36 Z",
    fillRule: "evenodd",
  },
  skull: {
    id: "skull",
    path: "M50 6 C28 6 14 22 14 42 C14 54 20 64 28 70 L28 84 L38 84 L38 92 L46 92 L46 84 L54 84 L54 92 L62 92 L62 84 L72 84 L72 70 C80 64 86 54 86 42 C86 22 72 6 50 6 Z M34 38 A8 8 0 1 0 34 54 A8 8 0 1 0 34 38 Z M66 38 A8 8 0 1 0 66 54 A8 8 0 1 0 66 38 Z",
    fillRule: "evenodd",
  },
  broken: { // broken heart
    id: "broken",
    path: "M50 88 C28 70 12 56 12 38 C12 24 22 14 34 14 C42 14 48 18 50 24 C52 18 58 14 66 14 C78 14 88 24 88 38 C88 56 72 70 50 88 Z M50 24 L44 40 L56 52 L46 68 L50 88",
    fillRule: "evenodd",
  },
};

// word (lowercased, cleaned) → glyph id. Extend freely; the planet's keywords can
// override/extend via matching too.
const LEXICON: Record<string, string> = {
  fire: "flame", flame: "flame", burn: "flame", burning: "flame", match: "flame", ember: "flame", embers: "flame", smoke: "flame", lit: "flame", light: "sun",
  heart: "heart", love: "heart", loved: "heart", lover: "heart",
  heartbreak: "broken", heartbroken: "broken", wound: "broken", bruise: "broken", hurt: "broken", pain: "broken", scar: "broken",
  knife: "dagger", dagger: "dagger", blade: "dagger", cut: "dagger", sharp: "dagger",
  thunder: "bolt", lightning: "bolt", storm: "bolt", shock: "bolt", signal: "bolt",
  moon: "moon", night: "moon", midnight: "moon", dark: "moon",
  sun: "sun", daylight: "sun", morning: "sun", dawn: "sun",
  tears: "droplet", cry: "droplet", crying: "droplet", rain: "droplet", drown: "droplet",
  eyes: "eye", eye: "eye", see: "eye", watch: "eye",
  death: "skull", dead: "skull", die: "skull", ghost: "skull", ghosts: "skull",
};

export function glyphFor(word: string): Glyph | null {
  const id = LEXICON[word.toLowerCase()];
  return id ? GLYPHS[id] : null;
}

/** Fallback: pick a glyph from an EMOTION (for the planet's charged keywords
 * whose literal word isn't in the lexicon — e.g. "growth"→Ambition→sun). */
export function glyphForEmotion(emotion: string | undefined): Glyph | null {
  if (!emotion) return null;
  const e = emotion.toLowerCase();
  if (/love|devotion|tender|adorat|romance|intimacy/.test(e)) return GLYPHS.heart;
  if (/pain|hurt|broken|grief|loss|wound|heartbreak/.test(e)) return GLYPHS.broken;
  if (/anger|rage|conflict|resent|defian|intens/.test(e)) return GLYPHS.bolt;
  if (/hope|joy|triumph|euphori|ecsta|sun|happy|excite|determin|ambition|empower|success/.test(e)) return GLYPHS.sun;
  if (/sad|melanch|tear|sorrow|cry|yearn|longing/.test(e)) return GLYPHS.droplet;
  if (/fear|dark|myster|night|lonel|isolat/.test(e)) return GLYPHS.moon;
  if (/death|despair|hopeless/.test(e)) return GLYPHS.skull;
  if (/passion|desire|burn|fire|relax/.test(e)) return GLYPHS.flame;
  return null;
}
