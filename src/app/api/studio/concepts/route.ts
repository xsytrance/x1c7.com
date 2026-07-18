import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isOwnerRequest } from "@/lib/ownerGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SLUG_RE } from "@/lib/studio/shared";

// Cover Studio 2 P2 — the LLM art director. Given a song's profile (planet
// analysis + genre/mood), local qwen3:14b writes N *distinct* cover concepts,
// each a one-tap prompt seed for the GENERATE deck. Owner-only (tailnet), and
// the model runs locally (Ollama) — same box as ComfyUI.

export const runtime = "nodejs";
export const maxDuration = 120;

const HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const MODEL = "qwen3:14b";
const COLLECTOR = join(process.cwd(), "scripts", "song-art", "collector");

type Concept = { label: string; prompt: string };

function manifestRecord(slug: string): { title?: string; genre?: string; mood?: string } | null {
  try {
    const m = JSON.parse(readFileSync(join(COLLECTOR, "manifest.json"), "utf8")) as Array<Record<string, unknown>>;
    const r = m.find((x) => x.slug === slug);
    return r ? { title: r.title as string, genre: r.genre as string, mood: r.mood as string } : null;
  } catch { return null; }
}

const SYSTEM = `You are an award-winning album-cover art director. For a given song you invent DISTINCT cover concepts — each a different visual world, not variations of one idea. Rules for every concept's "prompt":
- A concrete, vivid image-generation prompt: subject, setting, palette, light, mood, composition.
- NO text, letters, words, logos, or watermarks in the image. NO people unless the song truly demands a figure (prefer symbolic/environmental).
- Match the song's genre and emotional world; make the concepts genuinely varied (different scene, palette, and angle each).
Reply ONLY as JSON: {"concepts":[{"label":"2-4 word name","prompt":"the image prompt"}]}.`;

export async function POST(req: NextRequest) {
  if (!isOwnerRequest(req.headers.get("host"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { slug?: string; n?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const slug = String(body.slug || "");
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });
  const n = Math.max(2, Math.min(8, Number(body.n) || 5));

  // song profile: Supabase planet analysis first, manifest as fallback
  let title = slug.replace(/-/g, " "), genre = "", mood = "", summary = "", styleHint = "";
  let themes: string[] = [];
  try {
    const { data } = await supabaseAdmin().from("tracks").select("title,genre,mood,planet").eq("id", slug).limit(1);
    const row = data?.[0] as { title?: string; genre?: string; mood?: string; planet?: { analysis?: Record<string, unknown>; styleHint?: string } } | undefined;
    if (row) {
      title = row.title || title; genre = row.genre || ""; mood = row.mood || "";
      const a = row.planet?.analysis || {};
      summary = (a.summary as string) || "";
      themes = (a.themes as string[]) || [];
      styleHint = row.planet?.styleHint || "";
      if (!mood) mood = (a.overallMood as string) || "";
    }
  } catch { /* fall through to manifest */ }
  if (!genre || !mood) {
    const rec = manifestRecord(slug);
    genre = genre || rec?.genre || "";
    mood = mood || rec?.mood || "";
    title = rec?.title || title;
  }

  const profile = [
    `Song: "${title}"`,
    genre && `Genre: ${genre}`,
    mood && `Mood: ${mood}`,
    summary && `What it's about: ${summary}`,
    themes.length && `Themes: ${themes.join(", ")}`,
    styleHint && `Visual voice: ${styleHint}`,
  ].filter(Boolean).join("\n");

  let raw: string;
  try {
    const r = await fetch(`${HOST}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL, stream: false, format: "json", think: false,
        options: { temperature: 0.95, num_ctx: 8192, num_predict: 1400 },
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `${profile}\n\nWrite ${n} distinct cover concepts.` }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!r.ok) return NextResponse.json({ error: `llm ${r.status}` }, { status: 502 });
    raw = (await r.json())?.message?.content || "";
  } catch (e) {
    return NextResponse.json({ error: `llm unreachable: ${(e as Error).message}` }, { status: 502 });
  }

  let concepts: Concept[] = [];
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : (parsed.concepts || parsed.covers || []);
    concepts = (arr as Concept[])
      .filter((c) => c && typeof c.prompt === "string" && c.prompt.trim())
      .map((c) => ({ label: String(c.label || "Concept").slice(0, 40), prompt: c.prompt.trim().slice(0, 480) }))
      .slice(0, n);
  } catch {
    return NextResponse.json({ error: "llm returned unparseable json" }, { status: 502 });
  }
  if (!concepts.length) return NextResponse.json({ error: "no concepts produced" }, { status: 502 });

  return NextResponse.json({ ok: true, slug, profile, concepts });
}
