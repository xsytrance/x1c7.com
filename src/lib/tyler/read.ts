// ═══════════════════════════════════════════════════════════════════════════
// tyler.x1c7.com — public reads. Anon key only: RLS allows `select` on the
// three content tables and nothing else, so this module physically cannot
// write. Every write goes through /api/tyler/* with the service role.
//
// Called from server components, so the HTML a stranger gets is already
// populated (no spinner on a phone with two bars of signal).
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from "@/lib/supabase";
import {
  normalizeSite,
  type TylerMedia,
  type TylerMediaKind,
  type TylerSite,
  type TylerTrack,
} from "./types";

export async function getTylerSite(): Promise<TylerSite> {
  const { data } = await supabase.from("tyler_site").select("*").eq("id", "main").maybeSingle();
  return normalizeSite(data as Partial<TylerSite> | null);
}

export async function getTylerTracks(): Promise<TylerTrack[]> {
  const { data } = await supabase
    .from("tyler_tracks")
    .select("*")
    .eq("hidden", false)
    .order("sort_order", { ascending: true });
  return (data ?? []) as TylerTrack[];
}

export async function getTylerMedia(kinds?: TylerMediaKind[]): Promise<TylerMedia[]> {
  let q = supabase.from("tyler_media").select("*").eq("hidden", false);
  if (kinds?.length) q = q.in("kind", kinds);
  const { data } = await q.order("sort_order", { ascending: true });
  return (data ?? []) as TylerMedia[];
}

/** Everything the public page needs, in one trip. */
export async function getTylerPage() {
  const [site, tracks, media] = await Promise.all([getTylerSite(), getTylerTracks(), getTylerMedia()]);
  return { site, tracks, media };
}
