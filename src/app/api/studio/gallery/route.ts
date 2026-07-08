import { NextRequest, NextResponse } from "next/server";
import { isOwnerRequest } from "@/lib/ownerGate";
import { getJSON, putJSON } from "@/lib/feed/r2";
import { SLUG_RE, relativize, type GalleryJson } from "@/lib/studio/shared";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/studio/gallery — full-replacement save of a planet's gallery.json
// art map. One op covers reorder AND remove: the app sends the complete
// ordered list per key; anything absent falls out of rotation (files stay on
// R2 until an explicit delete). Owner-gated (tailnet).
//   { slug, art: { <key>: [urls in display order] } } → { ok, gallery }
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  if (!isOwnerRequest(req.headers.get("host"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let b: { slug?: string; art?: Record<string, string[]> };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad JSON" }, { status: 400 }); }
  const slug = b.slug || "";
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });
  if (!b.art || typeof b.art !== "object") return NextResponse.json({ error: "art map required" }, { status: 400 });

  try {
    const art: Record<string, string[]> = {};
    for (const [key, urls] of Object.entries(b.art)) {
      if (!Array.isArray(urls)) return NextResponse.json({ error: `art["${key}"] must be an array` }, { status: 400 });
      const rels: string[] = [];
      for (const u of urls) {
        const rel = relativize(String(u), slug, "gallery/");
        if (!rel) return NextResponse.json({ error: `not a gallery path for this planet: ${String(u).slice(0, 120)}` }, { status: 400 });
        rels.push(rel);
      }
      if (rels.length) art[key] = rels;
    }
    const existing = await getJSON<GalleryJson>(`planets/${slug}/gallery.json`);
    const gallery: GalleryJson = { slug, model: existing?.model, art };
    await putJSON(`planets/${slug}/gallery.json`, gallery);
    return NextResponse.json({ ok: true, gallery });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
