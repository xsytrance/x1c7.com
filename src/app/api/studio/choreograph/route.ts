import { NextRequest, NextResponse } from "next/server";
import { isOwnerRequest } from "@/lib/ownerGate";
import { supabase } from "@/lib/supabase";
import { choreograph } from "@/lib/studio/choreograph";
import { SLUG_RE } from "@/lib/studio/shared";

export const runtime = "nodejs";
export const maxDuration = 120;

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/studio/choreograph — ask the local LLM (Ollama) to choreograph a
// planet's touch interactions. Synchronous: a warm model answers in seconds.
// Owner-gated (tailnet). The app writes the result into planet_draft itself.
//   { slug, draft?: boolean, model?: string }
//   → { ok, interactions: { tapEffect, moments } }
// ═══════════════════════════════════════════════════════════════════════════

interface PlanetLike {
  analysis?: { summary?: string; themes?: string[]; sections?: { name: string; emotion: string; start: number; intensity: number }[] };
  styleHint?: string;
}

export async function POST(req: NextRequest) {
  if (!isOwnerRequest(req.headers.get("host"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let b: { slug?: string; draft?: boolean; model?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad JSON" }, { status: 400 }); }
  const slug = b.slug || "";
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });

  try {
    const { data } = await supabase.from("tracks").select("title,planet,planet_draft").eq("id", slug);
    const row = data?.[0] as { title: string; planet?: PlanetLike; planet_draft?: PlanetLike } | undefined;
    if (!row) return NextResponse.json({ error: "unknown slug" }, { status: 404 });
    const planet = (b.draft ? row.planet_draft : null) ?? row.planet;
    if (!planet?.analysis?.sections?.length) return NextResponse.json({ error: "planet has no analysis sections" }, { status: 400 });

    const interactions = await choreograph(row.title, planet.analysis, planet.styleHint || "", { model: b.model });
    return NextResponse.json({ ok: true, interactions });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
