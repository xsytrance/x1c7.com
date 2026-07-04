// ═══════════════════════════════════════════════════════════════════════════
// THE LEXICON — a shared, ever-growing dictionary where every WORD is its own
// little world ("sub-planet"): the images, vibes, effects, and text treatments
// that word can wear. Songs are planets; words are the moons that make them.
//
// The dream: pre-generate so many "legos" per word that a creator never needs
// an LLM at render time — they pick from a curated shelf. One person's Lexicon
// is a GALAXY; galaxies can be shared, merged, and gifted.
//
// This file is the shape of that data. It's produced offline by
// scripts/lexicon/harvest.mjs (seed from songs) + dream.mjs (grow while idle),
// and read at runtime by the show and the /lexicon browser.
// ═══════════════════════════════════════════════════════════════════════════

/** The effect "legos" bound to a word-sense — ids/modes from the effect registry. */
export interface WordLegos {
  weather: string[];   // airborne modes: embers, ash, rain, snow, petals, pollen…
  surface: string[];   // surface modes: mud, rust, cracks, vines…
  veils: string[];     // volumetric veils to wipe away: fog, ash, smoke…
  text: string[];      // per-word text treatments: burn, shatter, bloom…
  light: string[];     // frame grades: godrays, flare, flicker, blackout…
}

export function emptyLegos(): WordLegos {
  return { weather: [], surface: [], veils: [], text: [], light: [] };
}

/** Words carry multiple SENSES — "spring" the season vs the coil vs the leap.
 *  Each sense keeps its own vibe + legos so the wrong world never shows up. */
export interface WordSense {
  gloss: string;                 // short disambiguator: "season", "coil", "water source"
  pos: "noun" | "verb" | "adj" | "adv" | "other";
  emotion: string;               // dominant feeling of this sense
  imageryPrompts: string[];      // text-to-image prompts (imagery legos)
  images: string[];              // generated asset URLs, once produced (R2)
  palette: string[];             // #hex[]
  legos: WordLegos;
  score: number;                 // curation weight (community votes bump this later)
}

export interface WordEntry {
  word: string;                  // normalized lemma key
  forms: string[];               // surface forms seen: run / running / ran
  senses: WordSense[];
  freq: number;                  // cross-song frequency (drives generation priority)
  sources: string[];             // song ids it appeared in (provenance)
  updatedAt: string | null;      // last dream-loop pass, ISO
}

export interface Lexicon {
  version: number;
  galaxy: string;                // this galaxy's name, e.g. "xsytrance-canon"
  generatedAt: string;
  /** stats for the browser + the dream loop's dashboard */
  stats?: { words: number; senses: number; images: number; filled: number };
  entries: Record<string, WordEntry>;
}

/** How "complete" an entry is — used by the dream loop to prioritize the frontier. */
export function isFilled(e: WordEntry): boolean {
  return e.senses.length > 0 && e.senses.every((s) => {
    const l = s.legos;
    return l.weather.length + l.surface.length + l.veils.length + l.text.length + l.light.length > 0;
  });
}
