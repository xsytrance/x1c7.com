import { NextRequest, NextResponse } from "next/server";
import type { Compiled } from "@/lib/splice/types";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/splice/refine — the AI "smooth the seams" pass (LOCAL/owner tier).
// The deterministic compiler already produced a working Suno prompt; this asks
// a model on the prime box's own Ollama to (a) reconcile the borrowed
// tempo/key into ONE cohesive style paragraph and (b) propose a stronger
// title. Lyrics are NEVER rewritten here — the art stays the user's. On the
// public deploy (no local model) it returns a soft error and the UI keeps the
// deterministic prompt. Nothing is persisted.
//   { compiled } -> { compiled: { title, styleOfMusic }, engine }
// ═══════════════════════════════════════════════════════════════════════════

const OLLAMA = process.env.SPLICE_OLLAMA_HOST || "http://127.0.0.1:11434";
// A fast instruct model that doesn't emit reasoning tokens (which fight
// format:json and blow the timeout). Override with SPLICE_OLLAMA_MODEL.
const MODEL = process.env.SPLICE_OLLAMA_MODEL || "llama3.1:8b";

export async function POST(req: NextRequest) {
  let body: { compiled?: Compiled };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad JSON" }, { status: 400 }); }
  const c = body.compiled;
  if (!c?.styleOfMusic) return NextResponse.json({ error: "compiled prompt required" }, { status: 400 });

  const seamNotes = (c.warnings ?? []).flatMap((w) => w.suggestions).slice(0, 8);
  const sys =
    "You are a Suno prompt engineer. You are given a mashup's STYLE line, its title, and the tempo/key seams from grafting sections of different songs together. " +
    "Rewrite the STYLE into ONE cohesive, vivid Suno 'Style of Music' paragraph (<= 60 words) that reconciles the borrowed tempo/key into a single coherent sound — commit to one BPM and one key, name instrumentation and vocal character, keep any Exclude clause. " +
    "Also propose a stronger, evocative TITLE (<= 5 words). Do NOT invent lyrics. Reply with STRICT JSON: {\"title\": string, \"styleOfMusic\": string}.";
  const user = JSON.stringify({
    title: c.title,
    style: c.styleOfMusic,
    target: c.target,
    seams: seamNotes,
    compatibility: c.compatibility,
  });

  try {
    const r = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL, stream: false, format: "json",
        options: { temperature: 0.7 },
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) return NextResponse.json({ error: `local model unavailable (${r.status}) — deterministic prompt still works` }, { status: 200 });
    const data = await r.json();
    const raw = data?.message?.content ?? "{}";
    let parsed: { title?: string; styleOfMusic?: string };
    try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ error: "model returned non-JSON — deterministic prompt still works" }, { status: 200 }); }
    const out: Partial<Compiled> = {};
    if (parsed.title && typeof parsed.title === "string") out.title = parsed.title.trim().slice(0, 80);
    if (parsed.styleOfMusic && typeof parsed.styleOfMusic === "string") out.styleOfMusic = parsed.styleOfMusic.trim().slice(0, 600);
    if (!out.title && !out.styleOfMusic) return NextResponse.json({ error: "model gave nothing usable" }, { status: 200 });
    return NextResponse.json({ compiled: out, engine: `ollama:${MODEL}` });
  } catch (e) {
    const msg = (e as Error).name === "TimeoutError" ? "local model timed out" : "no local model reachable";
    return NextResponse.json({ error: `${msg} — deterministic prompt still works` }, { status: 200 });
  }
}
