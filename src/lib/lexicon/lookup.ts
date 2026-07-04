// ═══════════════════════════════════════════════════════════════════════════
// LEXICON · RUNTIME LOOKUP — the show reads the shelf.
//
// The endgame is "no LLM at render time": a word's effects come from the
// pre-generated Lexicon. This is that seam. The JSON is loaded LAZILY (its own
// chunk, kept out of the main bundle), then words resolve to their legos —
// exact first, then a naive nearest-word fallback that stands in for the
// eventual embedding match. Every consumer degrades gracefully: no lexicon, no
// match → null, and the caller falls back to its own heuristic.
// ═══════════════════════════════════════════════════════════════════════════

import type { Lexicon, WordEntry, WordLegos } from "./types";
import { emptyLegos } from "./types";

let cache: Lexicon | null = null;
let loading: Promise<Lexicon> | null = null;

/** Load (and memoize) the Lexicon as a separate async chunk. */
export async function loadLexicon(): Promise<Lexicon> {
  if (cache) return cache;
  if (!loading) {
    loading = import("@/data/lexicon.json")
      .then((m) => (cache = m.default as unknown as Lexicon));
  }
  return loading;
}

const norm = (w: string) =>
  w.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");

const LEGO_KINDS = ["weather", "surface", "veils", "text", "light"] as const;

/** Exact/normalized hit, else nearest-word fallback (the embedding stand-in). */
export function resolveWord(lex: Lexicon, word: string): WordEntry | null {
  const k = norm(word);
  if (!k) return null;
  return lex.entries[k] ?? nearest(lex, k);
}

// Placeholder for the eventual vector match: pick the known word sharing the
// longest prefix (≥4 chars). Cheap, dependency-free, and good enough to prove
// the "unseen word still finds legos" path before embeddings land.
function nearest(lex: Lexicon, k: string): WordEntry | null {
  if (k.length < 4) return null;
  const head = k.slice(0, 4);
  let best: WordEntry | null = null;
  let bestScore = 0;
  for (const key in lex.entries) {
    if (!key.startsWith(head)) continue;
    let n = 0;
    while (n < key.length && n < k.length && key[n] === k[n]) n++;
    if (n > bestScore) { bestScore = n; best = lex.entries[key]; }
  }
  return bestScore >= 4 ? best : null;
}

/** Union of every lego across the given words' senses — the palette of options
 *  the director can pick from for a song built out of these words. */
export function aggregateLegos(lex: Lexicon, words: string[]): WordLegos {
  const out = emptyLegos();
  const seen = new Set<string>();
  for (const w of words) {
    const e = resolveWord(lex, w);
    if (!e) continue;
    for (const s of e.senses) {
      for (const kind of LEGO_KINDS) {
        for (const m of s.legos[kind]) {
          const tag = kind + ":" + m;
          if (!seen.has(tag)) { seen.add(tag); out[kind].push(m); }
        }
      }
    }
  }
  return out;
}
