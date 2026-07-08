import { NextRequest, NextResponse } from "next/server";
import { isOwnerRequest } from "@/lib/ownerGate";
import { deleteObject, getJSON, putJSON } from "@/lib/feed/r2";
import { SLUG_RE, keyOf, relativize, type GalleryJson, type GuidedJson } from "@/lib/studio/shared";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/studio/assets/delete — remove art files from a planet, for real.
// Owner-gated (tailnet). Deletes the R2 objects AND logically strips them from
// gallery.json / guided.json. Cleaning planet_draft.assets maps is the app's
// job (it owns the draft document; single writer per document class).
//   { slug, keys: ["planets/<slug>/…" | absolute PUB urls] }
//   → { ok, deleted, galleryUpdated, guidedUpdated }
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  if (!isOwnerRequest(req.headers.get("host"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let b: { slug?: string; keys?: string[] };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad JSON" }, { status: 400 }); }
  const slug = b.slug || "";
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });
  if (!Array.isArray(b.keys) || !b.keys.length) return NextResponse.json({ error: "keys required" }, { status: 400 });
  if (b.keys.length > 200) return NextResponse.json({ error: "too many keys (max 200)" }, { status: 400 });

  try {
    // Normalize + fence every key inside this planet's prefix before touching storage.
    const rels: string[] = [];
    for (const k of b.keys) {
      const rel = relativize(String(k), slug);
      if (!rel) return NextResponse.json({ error: `key outside planets/${slug}/: ${String(k).slice(0, 120)}` }, { status: 400 });
      rels.push(rel);
    }
    const relSet = new Set(rels);
    const gone = (u: string) => relSet.has(relativize(u, slug) ?? "");

    for (const rel of rels) await deleteObject(keyOf(rel));

    let galleryUpdated = false;
    const gallery = await getJSON<GalleryJson>(`planets/${slug}/gallery.json`);
    if (gallery?.art) {
      const art: Record<string, string[]> = {};
      for (const [key, urls] of Object.entries(gallery.art)) {
        const kept = urls.filter((u) => !gone(u));
        if (kept.length !== urls.length) galleryUpdated = true;
        if (kept.length) art[key] = kept;
      }
      if (galleryUpdated) await putJSON(`planets/${slug}/gallery.json`, { ...gallery, art });
    }

    let guidedUpdated = false;
    const guided = await getJSON<GuidedJson>(`planets/${slug}/guided.json`);
    if (guided) {
      const images = (guided.images ?? []).filter((i) => !gone(i.url));
      const references = (guided.references ?? []).filter((r) => !gone(r.url));
      if (images.length !== (guided.images ?? []).length || references.length !== (guided.references ?? []).length) {
        guidedUpdated = true;
        await putJSON(`planets/${slug}/guided.json`, { ...guided, images, references });
      }
    }

    return NextResponse.json({ ok: true, deleted: rels, galleryUpdated, guidedUpdated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
