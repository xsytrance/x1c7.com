// ═══════════════════════════════════════════════════════════════════════════
// tyler.x1c7.com — every write Juan can make, behind one door.
//
// The browser never touches the database directly: the anon key can only read
// (RLS), and the service role lives here, on the server, behind a session
// check. If this route says no, there is no other way in.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentSession } from "@/lib/tyler/auth";
import { deleteObject } from "@/lib/feed/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLES = { track: "tyler_tracks", media: "tyler_media" } as const;
type Kind = keyof typeof TABLES;

/** Fields Juan is allowed to set, per table. Anything else is ignored — an
 *  allowlist, so a stray key from a future UI can never write a column it
 *  shouldn't. */
const WRITABLE: Record<Kind, string[]> = {
  track: ["title", "subtitle", "story", "words", "art", "audio_url", "suno_url", "links", "show_slug", "sort_order", "spotlight", "hidden"],
  media: ["kind", "caption", "alt", "sort_order", "hidden"],
};

const SITE_WRITABLE = [
  "artist", "by_line", "album", "released", "genre", "cover", "tagline",
  "message", "rated", "palette", "sections", "links", "socials", "options",
];

function pick(src: Record<string, unknown>, allowed: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of allowed) if (k in src) out[k] = src[k];
  return out;
}

/** The page is cached for a minute; a save should show up now, not in a minute. */
function refresh() {
  revalidatePath("/tyler");
  revalidatePath("/tyler/admin");
}

export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, never>;
  const action = String(body.action ?? "");
  const db = supabaseAdmin();

  try {
    switch (action) {
      // ── the look, the copy, the section order, the links ────────────────
      case "site.update": {
        const patch = pick(body.patch ?? {}, SITE_WRITABLE);
        if (!Object.keys(patch).length) return NextResponse.json({ ok: true });
        const { error } = await db
          .from("tyler_site")
          .upsert({ id: "main", ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
        if (error) throw error;
        refresh();
        return NextResponse.json({ ok: true });
      }

      // ── songs and media: create / update / delete / reorder ─────────────
      case "track.create":
      case "media.create": {
        const kind: Kind = action.startsWith("track") ? "track" : "media";
        const row = pick(body.row ?? {}, WRITABLE[kind]);
        if (kind === "track" && !row.title) {
          return NextResponse.json({ ok: false, error: "A song needs a title." }, { status: 400 });
        }
        const { data, error } = await db.from(TABLES[kind]).insert(row).select().single();
        if (error) throw error;
        refresh();
        return NextResponse.json({ ok: true, row: data });
      }

      case "track.update":
      case "media.update": {
        const kind: Kind = action.startsWith("track") ? "track" : "media";
        const id = String(body.id ?? "");
        if (!id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
        const patch = pick(body.patch ?? {}, WRITABLE[kind]);
        const { error } = await db.from(TABLES[kind]).update(patch).eq("id", id);
        if (error) throw error;
        refresh();
        return NextResponse.json({ ok: true });
      }

      case "track.delete":
      case "media.delete": {
        const kind: Kind = action.startsWith("track") ? "track" : "media";
        const id = String(body.id ?? "");
        if (!id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });

        // Deleting a photo should not leave its bytes paying rent in R2 —
        // but a failed cleanup must not block the delete Juan asked for.
        if (kind === "media") {
          const { data } = await db.from("tyler_media").select("r2_key").eq("id", id).maybeSingle();
          if (data?.r2_key) await deleteObject(data.r2_key).catch(() => {});
        }
        const { error } = await db.from(TABLES[kind]).delete().eq("id", id);
        if (error) throw error;
        refresh();
        return NextResponse.json({ ok: true });
      }

      /** The whole new order in one shot — [{id, sort_order}, …]. */
      case "track.reorder":
      case "media.reorder": {
        const kind: Kind = action.startsWith("track") ? "track" : "media";
        const order = (body.order ?? []) as unknown as { id: string; sort_order: number }[];
        if (!Array.isArray(order)) return NextResponse.json({ ok: false, error: "Bad order." }, { status: 400 });
        for (const o of order) {
          const { error } = await db.from(TABLES[kind]).update({ sort_order: o.sort_order }).eq("id", o.id);
          if (error) throw error;
        }
        refresh();
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong saving that.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Everything the admin panel needs, including hidden rows the public never sees. */
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const db = supabaseAdmin();
  const [site, tracks, media] = await Promise.all([
    db.from("tyler_site").select("*").eq("id", "main").maybeSingle(),
    db.from("tyler_tracks").select("*").order("sort_order"),
    db.from("tyler_media").select("*").order("sort_order"),
  ]);
  return NextResponse.json({
    ok: true,
    username: session.username,
    viaTailnet: session.viaTailnet,
    site: site.data,
    tracks: tracks.data ?? [],
    media: media.data ?? [],
  });
}
