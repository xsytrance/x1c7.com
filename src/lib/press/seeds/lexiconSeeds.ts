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
