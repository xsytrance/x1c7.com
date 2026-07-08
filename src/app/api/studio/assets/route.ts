import { NextRequest, NextResponse } from "next/server";
import { isOwnerRequest } from "@/lib/ownerGate";
import { supabase } from "@/lib/supabase";
import { getJSON, listObjects } from "@/lib/feed/r2";
import { SLUG_RE, absolutize, type GalleryJson, type GuidedJson } from "@/lib/studio/shared";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/studio/assets?slug=… — merged art inventory for one planet.
// Owner-gated (tailnet). Combines the planet/planet_draft asset maps (Supabase,
// public-read via anon client), gallery.json + guided.json (R2), and a signed
// R2 listing for sizes + orphan detection. Read-only.
// ═══════════════════════════════════════════════════════════════════════════

interface AssetsLike {
  keywords?: Record<string, string>;
  sections?: Record<string, string>;
  alt?: Record<string, string>;
}

function withTwins(map: Record<string, string> | undefined, alt: Record<string, string> | undefined) {
  const out: Record<string, { url: string; twin: string | null }> = {};
  for (const [k, v] of Object.entries(map ?? {})) {
    out[k] = { url: absolutize(v), twin: alt?.[v] ? absolutize(alt[v]) : null };
  }
  return out;
}

export async function GET(req: NextRequest) {
  if (!isOwnerRequest(req.headers.get("host"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });

  try {
    const [{ data: rows }, gallery, guided, objects] = await Promise.all([
      supabase.from("tracks").select("planet,planet_draft").eq("id", slug),
      getJSON<GalleryJson>(`planets/${slug}/gallery.json`),
      getJSON<GuidedJson>(`planets/${slug}/guided.json`),
      listObjects(`planets/${slug}/`).catch(() => [] as { key: string; size: number }[]),
    ]);
    const row = rows?.[0] as { planet?: { assets?: AssetsLike }; planet_draft?: { assets?: AssetsLike } } | undefined;
    if (!row) return NextResponse.json({ error: "unknown slug" }, { status: 404 });

    const live = row.planet?.assets;
    const draft = row.planet_draft?.assets;

    // Everything any manifest references, as R2 keys, for orphan detection.
    const referenced = new Set<string>();
    const ref = (u?: string | null) => {
      if (!u) return;
      const rel = u.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
      if (rel.startsWith(`/planets/${slug}/`)) referenced.add(rel.slice(1));
    };
    for (const a of [live, draft]) {
      for (const m of [a?.keywords, a?.sections]) Object.values(m ?? {}).forEach(ref);
      for (const [k, v] of Object.entries(a?.alt ?? {})) { ref(k); ref(v); }
    }
    Object.values(gallery?.art ?? {}).flat().forEach(ref);
    guided?.images?.forEach((i) => ref(i.url));
    guided?.references?.forEach((r) => ref(r.url));
    ref(`/planets/${slug}/gallery.json`); ref(`/planets/${slug}/guided.json`); ref(`/planets/${slug}/stems.json`);

    const sizes: Record<string, number> = {};
    const orphans: string[] = [];
    for (const o of objects) {
      sizes[o.key] = o.size;
      if (!referenced.has(o.key) && !o.key.startsWith(`planets/${slug}/guided/refs/`)) orphans.push(o.key);
    }

    return NextResponse.json({
      ok: true,
      slug,
      base: {
        keywords: withTwins(live?.keywords, live?.alt),
        sections: withTwins(live?.sections, live?.alt),
        draft: draft ? { keywords: withTwins(draft.keywords, draft.alt), sections: withTwins(draft.sections, draft.alt) } : null,
      },
      gallery: gallery ? { model: gallery.model, art: Object.fromEntries(Object.entries(gallery.art ?? {}).map(([k, v]) => [k, v.map(absolutize)])) } : { model: null, art: {} },
      guided: guided ?? { slug, references: [], images: [] },
      sizes,
      orphans,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
