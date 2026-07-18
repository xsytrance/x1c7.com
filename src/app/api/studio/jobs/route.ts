import { NextRequest, NextResponse } from "next/server";
import { isOwnerRequest } from "@/lib/ownerGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SLUG_RE } from "@/lib/studio/shared";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// /api/studio/jobs — the art job queue for the Planet Studio phone app.
// Owner-gated (tailnet). Enqueue only — scripts/art-worker.mjs (GPU, ComfyUI)
// does the rendering and reports per-image progress into the row.
//   GET  ?slug=…                      → { jobs } (last 20, all statuses)
//   POST { slug, kind, payload }      → enqueue  (kinds below)
//   POST { action:"cancel", id }      → cancel a pending/running job
//
// Kinds:
//   regenerate-base { targets:[{key,kind:"keyword"|"section",scene}], style?, negative?, twins? }
//   topup           { keys:[…], perKey, style?, negative? }
//   oneoff          { prompt, key?, n, style?, negative?, seed? }
//   cover-gen       { prompt?, lane?: photo|paint|poster|anime, n?, seed? }
//                   → covers/candidates/<slug>/ (Cover Studio 2; prompt
//                     defaults to a planet-analysis seed, built worker-side)
// ═══════════════════════════════════════════════════════════════════════════

const MAX_IMAGES = 24;
const MAX_PROMPT = 500;

interface Target { key?: string; kind?: string; scene?: string }
interface Payload {
  targets?: Target[]; twins?: boolean;
  keys?: string[]; perKey?: number;
  prompt?: string; key?: string; n?: number; seed?: number;
  style?: string; negative?: string;
  lane?: string;
}

const COVER_LANES = ["photo", "paint", "poster", "anime"];

function validate(kind: string, p: Payload): { total: number } | { error: string } {
  const tooLong = (s?: string) => s && s.length > MAX_PROMPT;
  if (tooLong(p.style) || tooLong(p.negative) || tooLong(p.prompt)) return { error: `prompts are capped at ${MAX_PROMPT} chars` };
  if (kind === "regenerate-base") {
    if (!Array.isArray(p.targets) || !p.targets.length) return { error: "targets required" };
    for (const t of p.targets) {
      if (!t.key || !t.scene || !["keyword", "section"].includes(t.kind || "")) return { error: "each target needs key, kind (keyword|section), scene" };
      if (tooLong(t.scene)) return { error: `prompts are capped at ${MAX_PROMPT} chars` };
    }
    return { total: p.targets.length * (p.twins === false ? 1 : 2) };
  }
  if (kind === "topup") {
    if (!Array.isArray(p.keys) || !p.keys.length) return { error: "keys required" };
    const perKey = Math.max(1, Math.min(8, Number(p.perKey) || 2));
    p.perKey = perKey;
    return { total: p.keys.length * perKey };
  }
  if (kind === "oneoff") {
    if (!p.prompt) return { error: "prompt required" };
    const n = Math.max(1, Math.min(12, Number(p.n) || 4));
    p.n = n;
    return { total: n };
  }
  if (kind === "cover-gen") {
    if (p.lane && !COVER_LANES.includes(p.lane)) return { error: `lane must be one of ${COVER_LANES.join("|")}` };
    const n = Math.max(1, Math.min(8, Number(p.n) || 4));
    p.n = n;
    return { total: n };
  }
  return { error: "unknown kind" };
}

async function jobsFor(slug: string) {
  const { data } = await supabaseAdmin()
    .from("art_jobs")
    .select("id,kind,status,total,done,progress,error,payload,created_at,updated_at")
    .eq("slug", slug)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function GET(req: NextRequest) {
  if (!isOwnerRequest(req.headers.get("host"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, jobs: await jobsFor(slug) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isOwnerRequest(req.headers.get("host"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let b: { slug?: string; kind?: string; payload?: Payload; action?: string; id?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad JSON" }, { status: 400 }); }

  try {
    if (b.action === "cancel") {
      if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await supabaseAdmin().from("art_jobs").update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", b.id).in("status", ["pending", "running"]);
      return NextResponse.json({ ok: true });
    }

    const slug = b.slug || "";
    if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });
    const kind = b.kind || "";
    const payload = b.payload ?? {};
    const v = validate(kind, payload);
    if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
    if (v.total > MAX_IMAGES) return NextResponse.json({ error: `job too large (${v.total} images, max ${MAX_IMAGES})` }, { status: 400 });

    const { data, error } = await supabaseAdmin()
      .from("art_jobs")
      .insert({ slug, kind, payload, total: v.total, status: "pending" })
      .select("id,kind,status,total,done,created_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, job: data, jobs: await jobsFor(slug) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
