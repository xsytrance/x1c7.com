// ═══════════════════════════════════════════════════════════════════════════
// tyler.x1c7.com — uploads. Photos, flyers, one-sheets, logos, audio, and
// Suno stem ZIPs, straight from Juan's camera roll into R2.
//
// The file rides through this route rather than a presigned URL on purpose:
// it keeps the R2 credentials server-side with no signed-URL window to leak,
// and Vercel's body limit is well above anything a phone photo will hit.
// Images are already downscaled in the browser before they get here.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentSession } from "@/lib/tyler/auth";
import { objectUrl, putObject } from "@/lib/feed/r2";
import type { TylerMediaKind } from "@/lib/tyler/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KINDS: TylerMediaKind[] = ["photo", "press", "flyer", "logo", "stem", "other"];

// Generous but not unbounded. A stem ZIP is the big one; everything else is
// far smaller once the browser has resized it.
const LIMITS: Record<string, number> = { stem: 200 * 1024 * 1024, default: 25 * 1024 * 1024 };

/** A filename that will survive a URL, a bucket listing, and a year. */
function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = (dot > 0 ? name.slice(dot + 1) : "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "file";
  return ext ? `${stem}.${ext}` : stem;
}

export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file arrived." }, { status: 400 });
  }

  const kind = (String(form?.get("kind") ?? "photo") as TylerMediaKind);
  if (!KINDS.includes(kind)) return NextResponse.json({ ok: false, error: "Unknown kind." }, { status: 400 });

  const limit = LIMITS[kind] ?? LIMITS.default;
  if (file.size > limit) {
    return NextResponse.json(
      { ok: false, error: `That file is ${(file.size / 1048576).toFixed(0)}MB — the limit here is ${limit / 1048576}MB.` },
      { status: 413 },
    );
  }

  const folder = kind === "stem" ? "stems" : kind === "photo" ? "gallery" : "press";
  const key = `tyler-haze/${folder}/${Date.now()}-${safeName(file.name)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    await putObject(key, bytes, file.type || "application/octet-stream");
  } catch (e) {
    const message = e instanceof Error ? e.message : "upload failed";
    return NextResponse.json({ ok: false, error: `Couldn't store that file: ${message}` }, { status: 502 });
  }

  const db = supabaseAdmin();
  const { data: last } = await db
    .from("tyler_media")
    .select("sort_order")
    .eq("kind", kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await db
    .from("tyler_media")
    .insert({
      kind,
      r2_key: key,
      url: objectUrl(key),
      caption: (form?.get("caption") as string) || null,
      alt: (form?.get("alt") as string) || null,
      bytes: file.size,
      content_type: file.type || null,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  revalidatePath("/tyler");
  return NextResponse.json({ ok: true, row: data });
}
