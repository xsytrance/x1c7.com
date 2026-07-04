import { NextRequest, NextResponse } from "next/server";
import { verifyToken, SESSION_COOKIE } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getGuided, addReference, removeReference, removeImage, clearGuided } from "@/lib/feed/store";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// /api/feed — the feed studio API. Owner-gated by the session cookie (set via
// /api/auth). Management writes R2 directly (aws4fetch). GENERATE enqueues a job
// in feed_jobs; the home worker (GPU) processes it.
//   GET  ?slug=…                → { guided, jobs }
//   POST { slug, action, … }    → addRef | removeRef | removeImage | clear | generate
// ═══════════════════════════════════════════════════════════════════════════
async function owner(req: NextRequest) {
  return verifyToken(process.env.SESSION_SECRET || "", req.cookies.get(SESSION_COOKIE)?.value);
}
function dataUrl(image: string): { buf: Buffer; ext: string } | null {
  const m = /^data:image\/([\w.+-]+);base64,(.+)$/.exec(image);
  if (!m) return null;
  return { buf: Buffer.from(m[2], "base64"), ext: m[1].replace("jpeg", "jpg") };
}
async function jobsFor(slug: string) {
  try {
    const { data } = await supabaseAdmin().from("feed_jobs").select("id,prompt,n,status,error,created_at").eq("slug", slug).in("status", ["pending", "running", "error"]).order("created_at", { ascending: false }).limit(20);
    return data ?? [];
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  if (!(await owner(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  return NextResponse.json({ ok: true, guided: await getGuided(slug), jobs: await jobsFor(slug) });
}

export async function POST(req: NextRequest) {
  if (!(await owner(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let b: { slug?: string; action?: string; image?: string; id?: string; prompt?: string; n?: number; denoise?: number; refIds?: string[] };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad JSON" }, { status: 400 }); }
  const slug = b.slug;
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  try {
    switch (b.action) {
      case "addRef": {
        const d = dataUrl(b.image || "");
        if (!d) return NextResponse.json({ error: "image must be a data URL" }, { status: 400 });
        return NextResponse.json({ ok: true, guided: await addReference(slug, d.buf, d.ext) });
      }
      case "removeRef":
        return NextResponse.json({ ok: true, guided: await removeReference(slug, b.id || "") });
      case "removeImage":
        return NextResponse.json({ ok: true, guided: await removeImage(slug, b.id || "") });
      case "clear":
        return NextResponse.json({ ok: true, guided: await clearGuided(slug) });
      case "generate": {
        if (!b.prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
        const n = Math.min(12, Math.max(1, Number(b.n) || 4));
        const denoise = Math.min(0.95, Math.max(0.2, Number(b.denoise) || 0.62));
        const refIds = Array.isArray(b.refIds) ? b.refIds : [];
        if (!refIds.length) return NextResponse.json({ error: "select at least one reference" }, { status: 400 });
        await supabaseAdmin().from("feed_jobs").insert({ slug, ref_ids: refIds, prompt: b.prompt, n, denoise, status: "pending" });
        return NextResponse.json({ ok: true, guided: await getGuided(slug), jobs: await jobsFor(slug), queued: true });
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
