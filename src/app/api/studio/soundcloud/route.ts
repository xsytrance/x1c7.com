import { NextRequest, NextResponse } from "next/server";
import { isOwnerRequest } from "@/lib/ownerGate";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════════════════
// /api/studio/soundcloud — the SoundCloud cover DRIFT REPORT (Cover Studio 2
// P3). Owner-gated, prime-local only: it reads scripts/song-art/
// soundcloud-map.json (written by the soundcloud-sync scan job / the CLI) and
// HEADs each matched cover on R2 to see whether the art changed since it was
// last pushed. No browser, no login, read-only — pushing goes through
// /api/studio/jobs { kind: "soundcloud-sync" }.
//
//   GET → { ok, scanned, scannedAt?, matches?: [{ slug, title, sc, state,
//           appliedAt? }], unmatchedSc?, unmatchedCovers?, counts? }
//   state: never (matched, not yet pushed) · stale (art changed since the
//   push, or pre-etag push history) · synced
// ═══════════════════════════════════════════════════════════════════════════

interface MapMatch { slug?: string; title: string; sc: string; cover: string; done?: boolean; appliedAt?: string; etag?: string }
interface MapFile { scannedAt?: string; matches?: MapMatch[]; unmatchedSc?: { title: string; url: string }[]; unmatchedCovers?: { slug?: string; title: string }[] }

export async function GET(req: NextRequest) {
  if (!isOwnerRequest(req.headers.get("host"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let map: MapFile;
  try {
    map = JSON.parse(await readFile(join(process.cwd(), "scripts", "song-art", "soundcloud-map.json"), "utf8"));
  } catch {
    return NextResponse.json({ ok: true, scanned: false, note: "no soundcloud-map.json yet — run a scan (prime-local)" });
  }
  try {
    const matches = await Promise.all((map.matches ?? []).map(async (m) => {
      let currentEtag: string | null = null;
      try {
        const r = await fetch(m.cover, { method: "HEAD", cache: "no-store" });
        if (r.ok) currentEtag = (r.headers.get("etag") || "").replace(/"/g, "") || null;
      } catch { /* unreachable cover → can't judge, counts as synced */ }
      const state = !m.done ? "never" : currentEtag && m.etag !== currentEtag ? "stale" : "synced";
      return { slug: m.slug ?? null, title: m.title, sc: m.sc, state, done: !!m.done, appliedAt: m.appliedAt ?? null };
    }));
    const count = (s: string) => matches.filter((m) => m.state === s).length;
    return NextResponse.json({
      ok: true, scanned: true, scannedAt: map.scannedAt ?? null, matches,
      unmatchedSc: map.unmatchedSc ?? [], unmatchedCovers: map.unmatchedCovers ?? [],
      counts: { synced: count("synced"), stale: count("stale"), never: count("never"), unmatchedSc: map.unmatchedSc?.length ?? 0, unmatchedCovers: map.unmatchedCovers?.length ?? 0 },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
