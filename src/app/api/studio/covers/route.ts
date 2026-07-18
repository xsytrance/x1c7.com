import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { isOwnerRequest } from "@/lib/ownerGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listObjects, PUB } from "@/lib/feed/r2";
import { SLUG_RE } from "@/lib/studio/shared";
import { COLLECTOR_PALETTES, classifyCollector } from "@/lib/studio/collectorPalettes";

export const runtime = "nodejs";
export const maxDuration = 120;

// ═══════════════════════════════════════════════════════════════════════════
// /api/studio/covers — the Cover Art Studio door (owner-gated, tailnet only).
//
// GET  → full cover inventory: every track (hidden included) merged with its
//        collector manifest record, effective palette, web-asset presence on
//        R2, and the palette table itself so clients preview in true colors.
// POST { slug, overrides?, track?, render? } →
//        overrides: patch the collector manifest record (palette, spine,
//                   series, lang, geo, explicit, unreleased, artTopCrop…);
//                   null deletes a key so the engine's defaults return.
//        track:     patch the tracks row (title/artist/genre/mood/color +
//                   theme as a jsonb MERGE — unknown theme keys survive).
//                   genre/mood/title mirror into the manifest so the printed
//                   case never disagrees with the database.
//        render:    re-run the collector engine for this slug and publish
//                   covers/collector/<slug>.png + covers/web/<slug>-{card,
//                   spine}.webp to R2. renderedAt is the cache-buster.
// ═══════════════════════════════════════════════════════════════════════════

const exec = promisify(execFile);
const COLLECTOR = join(process.cwd(), "scripts", "song-art", "collector");
const MANIFEST = join(COLLECTOR, "manifest.json");

type ManifestRecord = Record<string, unknown> & { slug: string };

// Only these keys may be patched from outside; everything else in a record
// (peaks, coverFile, bpm, runtime…) is produced by build-manifest.mjs.
const OVERRIDE_KEYS = [
  "title", "genre", "mood", "palette", "spine", "series", "lang", "geo",
  "explicit", "unreleased", "artTopCrop", "rooklyn", "instrumental",
] as const;
const TRACK_KEYS = ["title", "artist", "genre", "mood", "color"] as const;

const readManifest = (): ManifestRecord[] => JSON.parse(readFileSync(MANIFEST, "utf8"));
// 1-space indent — the file's existing format, keeps git diffs honest.
const writeManifest = (m: ManifestRecord[]) => writeFileSync(MANIFEST, JSON.stringify(m, null, 1) + "\n");

function coverItem(track: Record<string, unknown>, rec: ManifestRecord | undefined, webKeys: Set<string>) {
  const slug = String(track.id);
  const genre = (rec?.genre as string) ?? (track.genre as string | null);
  const forced = rec?.palette as string | undefined;
  const auto = classifyCollector(genre);
  return {
    slug,
    title: track.title,
    artist: track.artist,
    genre: track.genre,
    mood: track.mood,
    color: track.color,
    featured: track.featured,
    hidden: track.hidden,
    theme: track.theme,
    // The UNTOUCHED source art (R2 covers/ root, same file the engine reads
    // from originals/). track.cover is the finished collector print for most
    // tracks — feeding that to a preview nests the frame inside itself.
    original: rec?.coverFile
      ? `${PUB}/covers/${encodeURIComponent(String(rec.coverFile))}`
      : (track.cover as string | null),
    record: rec ?? null,
    paletteKey: forced && COLLECTOR_PALETTES[forced] ? forced : auto.key,
    autoPaletteKey: auto.key,
    hasCard: webKeys.has(`covers/web/${slug}-card.webp`),
    hasSpine: webKeys.has(`covers/web/${slug}-spine.webp`),
    urls: {
      card: `${PUB}/covers/web/${slug}-card.webp`,
      spine: `${PUB}/covers/web/${slug}-spine.webp`,
      collector: `${PUB}/covers/collector/${slug}.png`,
    },
  };
}

export async function GET(req: NextRequest) {
  if (!isOwnerRequest(req.headers.get("host"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { data: tracks, error } = await supabaseAdmin()
      .from("tracks")
      .select("id,title,artist,genre,mood,color,cover,featured,hidden,theme,sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const manifest = readManifest();
    const bySlug = new Map(manifest.map((r) => [r.slug, r]));
    const webKeys = new Set((await listObjects("covers/web/")).map((o) => o.key));
    const covers = (tracks ?? []).map((t) => coverItem(t as Record<string, unknown>, bySlug.get(String(t.id)), webKeys));
    // manifest records whose track vanished still deserve a spot on the wall
    const trackIds = new Set(covers.map((c) => c.slug));
    for (const r of manifest) {
      if (!trackIds.has(r.slug)) covers.push(coverItem({ id: r.slug, title: r.title ?? r.slug }, r, webKeys));
    }
    return NextResponse.json({ ok: true, palettes: COLLECTOR_PALETTES, covers });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}

async function renderAndPublish(slug: string): Promise<string> {
  const out = join(COLLECTOR, "out", `${slug}.png`);
  const before = existsSync(out) ? statSync(out).mtimeMs : 0;
  await exec("node", ["engine.mjs", "--only", slug], { cwd: COLLECTOR, timeout: 60_000 });
  if (!existsSync(out) || statSync(out).mtimeMs <= before) {
    throw new Error("engine produced no cover (missing original art?)");
  }
  // Uploads run in spawned plain node — Next's patched fetch drops
  // Content-Length on binary PUTs and R2 answers 411.
  await exec("node", ["make-web-assets.mjs", "--only", slug], { cwd: COLLECTOR, timeout: 60_000 });
  await exec("node", ["publish-one.mjs", slug], { cwd: COLLECTOR, timeout: 60_000 });
  return new Date().toISOString();
}

export async function POST(req: NextRequest) {
  if (!isOwnerRequest(req.headers.get("host"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let b: {
    slug?: string;
    overrides?: Record<string, unknown>;
    track?: Record<string, unknown> & { theme?: Record<string, unknown> | null };
    render?: boolean;
    applyCandidate?: string; // Cover Studio 2: promote a generated candidate to originals/ (implies render)
  };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad JSON" }, { status: 400 }); }
  const slug = b.slug || "";
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });

  try {
    const manifest = readManifest();
    const rec = manifest.find((r) => r.slug === slug);
    let manifestDirty = false;

    if (b.overrides) {
      if (!rec) return NextResponse.json({ error: "no collector record for this slug — onboard it first" }, { status: 404 });
      if (b.overrides.palette != null && !COLLECTOR_PALETTES[String(b.overrides.palette)]) {
        return NextResponse.json({ error: `unknown palette: ${String(b.overrides.palette).slice(0, 40)}` }, { status: 400 });
      }
      for (const k of OVERRIDE_KEYS) {
        if (!(k in b.overrides)) continue;
        const v = b.overrides[k];
        if (v === null) delete rec[k];
        else rec[k] = v;
        manifestDirty = true;
      }
    }

    if (b.track) {
      const patch: Record<string, unknown> = {};
      for (const k of TRACK_KEYS) if (k in b.track) patch[k] = b.track[k];
      if ("theme" in b.track) {
        // jsonb tolerance: merge onto the row's current theme so keys this
        // studio doesn't model survive; null values delete; {} collapses to null.
        const { data: cur, error } = await supabaseAdmin().from("tracks").select("theme").eq("id", slug).single();
        if (error) throw new Error(error.message);
        if (b.track.theme === null) patch.theme = null;
        else {
          const merged: Record<string, unknown> = { ...(cur?.theme as Record<string, unknown> | null ?? {}) };
          for (const [k, v] of Object.entries(b.track.theme ?? {})) {
            if (v === null) delete merged[k];
            else merged[k] = v;
          }
          patch.theme = Object.keys(merged).length ? merged : null;
        }
      }
      if (Object.keys(patch).length) {
        const { error } = await supabaseAdmin().from("tracks").update(patch).eq("id", slug);
        if (error) throw new Error(error.message);
      }
      // the printed case never disagrees with the database
      if (rec) {
        for (const k of ["title", "genre", "mood"] as const) {
          if (k in patch && !(b.overrides && k in b.overrides)) { rec[k] = patch[k]; manifestDirty = true; }
        }
      }
    }

    let applied = false;
    if (b.applyCandidate) {
      if (!rec) return NextResponse.json({ error: "no collector record for this slug — onboard it first" }, { status: 404 });
      const url = String(b.applyCandidate);
      // only accept candidates this studio generated — no arbitrary-URL fetches
      if (!url.startsWith(`${PUB}/covers/candidates/${slug}/`)) {
        return NextResponse.json({ error: "applyCandidate must be one of this slug's covers/candidates URLs" }, { status: 400 });
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`candidate fetch ${res.status}`);
      const sharp = (await import("sharp")).default;
      const png = await sharp(Buffer.from(await res.arrayBuffer())).png().toBuffer();
      const coverFile = (rec.coverFile as string) || `${(rec.title as string) ?? slug}.png`;
      const orig = join(COLLECTOR, "originals", coverFile);
      mkdirSync(join(COLLECTOR, "originals"), { recursive: true }); // reinstall may have taken the dir
      if (existsSync(orig)) { // applies are undoable — the replaced original is kept
        const prevDir = join(COLLECTOR, "originals", ".prev");
        mkdirSync(prevDir, { recursive: true });
        copyFileSync(orig, join(prevDir, `${Date.now()}-${coverFile}`));
      }
      writeFileSync(orig, png);
      if (!rec.coverFile) { rec.coverFile = coverFile; manifestDirty = true; }
      applied = true;
      b.render = true; // a new original always reprints the case
    }

    let rendered = false;
    if (b.render) {
      if (!rec) return NextResponse.json({ error: "no collector record for this slug — onboard it first" }, { status: 404 });
      if (manifestDirty) { writeManifest(manifest); manifestDirty = false; }
      rec.renderedAt = await renderAndPublish(slug);
      manifestDirty = true;
      rendered = true;
    }
    if (manifestDirty) writeManifest(manifest);

    const { data: track } = await supabaseAdmin()
      .from("tracks")
      .select("id,title,artist,genre,mood,color,cover,featured,hidden,theme")
      .eq("id", slug)
      .maybeSingle();
    const webKeys = new Set((await listObjects(`covers/web/${slug}-`)).map((o) => o.key));
    const cover = coverItem((track as Record<string, unknown>) ?? { id: slug, title: rec?.title ?? slug }, rec, webKeys);
    return NextResponse.json({ ok: true, rendered, applied, cover });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
