import { NextRequest, NextResponse } from "next/server";
import { isOwnerRequest } from "@/lib/ownerGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getJSON, PUB } from "@/lib/feed/r2";
import { loadLexicon, resolveWord } from "@/lib/lexicon/lookup";
import { SLUG_RE } from "@/lib/studio/shared";

// Cover Studio 2 P2 — the lexicon idea deck. A song's heavy words → their sense
// imagery prompts + the painting the lexicon already made of them + the lyric
// line that summoned them → one-tap prompt seeds beside the LLM art director.
// Owner-only. Sources: Supabase planet.analysis.keywords, R2 lexicon.json
// (senses), R2 planets/<slug>/lexicon-reel.json (curated word→painting reel).

export const runtime = "nodejs";
export const maxDuration = 60;

type Idea = { word: string; prompt: string; emotion?: string; line?: string; reading?: string; image?: string; palette?: string[] };
type Kw = { word?: string; emotion?: string; imageryPrompt?: string };
type ReelItem = { word?: string; img?: string; line?: string; reason?: string; featured?: boolean };
type Reel = { reel?: ReelItem[] };

const abs = (u?: string) => (!u ? undefined : u.startsWith("http") ? u : `${PUB}/${u.replace(/^\//, "")}`);

export async function POST(req: NextRequest) {
  if (!isOwnerRequest(req.headers.get("host"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { slug?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const slug = String(body.slug || "");
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });

  // song's analysis keywords (word + per-word imagery + emotion)
  let keywords: Kw[] = [];
  try {
    const { data } = await supabaseAdmin().from("tracks").select("planet").eq("id", slug).limit(1);
    const planet = data?.[0]?.planet as { analysis?: { keywords?: Kw[] } } | undefined;
    keywords = planet?.analysis?.keywords || [];
  } catch { /* keep going — the reel may still have words */ }

  // curated word→painting reel (lyric line, featured painting, match rationale)
  const reel = await getJSON<Reel>(`planets/${slug}/lexicon-reel.json`).catch(() => null);
  const reelByWord = new Map<string, ReelItem>();
  for (const r of reel?.reel || []) {
    const w = (r.word || "").toLowerCase();
    if (w && (!reelByWord.has(w) || r.featured)) reelByWord.set(w, r);
  }

  // the word set: analysis keywords first (the song's own), then any extra featured reel words
  const words: string[] = [];
  const seen = new Set<string>();
  const push = (w?: string) => { const k = (w || "").trim().toLowerCase(); if (k && !seen.has(k)) { seen.add(k); words.push((w || "").trim()); } };
  for (const kw of keywords) push(kw.word);
  for (const [, r] of reelByWord) if (r.featured) push(r.word);

  const lex = await loadLexicon().catch(() => null);

  const ideas: Idea[] = [];
  for (const word of words) {
    const key = word.toLowerCase();
    const kw = keywords.find((k) => (k.word || "").toLowerCase() === key);
    const entry = lex ? resolveWord(lex, word) : null;
    const sense = entry?.senses?.[0];
    const prompt = (sense?.imageryPrompts?.[0] || kw?.imageryPrompt || "").trim();
    if (!prompt) continue;
    const r = reelByWord.get(key);
    ideas.push({
      word,
      prompt: prompt.slice(0, 480),
      emotion: kw?.emotion || sense?.emotion,
      line: r?.line,
      reading: r?.reason,
      image: abs(r?.img || sense?.images?.[0]),
      palette: sense?.palette,
    });
    if (ideas.length >= 14) break;
  }

  if (!ideas.length) return NextResponse.json({ error: "no lexicon ideas for this song yet" }, { status: 404 });
  return NextResponse.json({ ok: true, slug, ideas });
}
