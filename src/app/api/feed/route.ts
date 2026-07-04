import { NextRequest, NextResponse } from "next/server";
import { isPrivateHost } from "@/lib/privateHost";
import { getGuided, addReference, removeReference, removeImage, clearGuided, generate } from "@/lib/feed/store";

export const runtime = "nodejs";
export const maxDuration = 300; // guided generation can take a couple minutes

// ═══════════════════════════════════════════════════════════════════════════
// /api/feed — the gravitational feed studio. OWNER-ONLY: gated to private hosts
// (localhost + Tailscale); the public site 403s. Also needs local ComfyUI + the
// R2 creds the deploy doesn't have.
//   GET  ?slug=…                      → current guided state
//   POST { slug, action, … }          → addRef | removeRef | generate | removeImage | clear
// ═══════════════════════════════════════════════════════════════════════════
function gate(req: NextRequest) {
  return isPrivateHost((req.headers.get("host") || "").split(":")[0]);
}
function dataUrlToBuffer(image: string): Buffer | null {
  const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(image);
  return m ? Buffer.from(m[2], "base64") : null;
}

export async function GET(req: NextRequest) {
  if (!gate(req)) return NextResponse.json({ error: "owner only" }, { status: 403 });
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  return NextResponse.json({ ok: true, guided: await getGuided(slug) });
}

export async function POST(req: NextRequest) {
  if (!gate(req)) return NextResponse.json({ error: "The feed is owner-only." }, { status: 403 });
  let b: { slug?: string; action?: string; image?: string; id?: string; prompt?: string; n?: number; denoise?: number; refIds?: string[] };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad JSON" }, { status: 400 }); }
  const slug = b.slug;
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  try {
    switch (b.action) {
      case "addRef": {
        const buf = dataUrlToBuffer(b.image || "");
        if (!buf) return NextResponse.json({ error: "image must be a data URL" }, { status: 400 });
        return NextResponse.json({ ok: true, guided: await addReference(slug, buf) });
      }
      case "removeRef":
        if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json({ ok: true, guided: await removeReference(slug, b.id) });
      case "removeImage":
        if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json({ ok: true, guided: await removeImage(slug, b.id) });
      case "clear":
        return NextResponse.json({ ok: true, guided: await clearGuided(slug) });
      case "generate": {
        if (!b.prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
        const n = Math.min(12, Math.max(1, Number(b.n) || 4));
        const denoise = Math.min(0.95, Math.max(0.2, Number(b.denoise) || 0.62));
        return NextResponse.json({ ok: true, guided: await generate(slug, Array.isArray(b.refIds) ? b.refIds : [], b.prompt, n, denoise) });
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 300) }, { status: 500 });
  }
}
