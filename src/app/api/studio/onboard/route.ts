import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isOwnerRequest } from "@/lib/ownerGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PUB } from "@/lib/feed/r2";
import { SLUG_RE } from "@/lib/studio/shared";
import { COLLECTOR_PALETTES, classifyCollector } from "@/lib/studio/collectorPalettes";
import { COLLECTOR, readManifest, writeManifest, renderAndPublish, type ManifestRecord } from "@/lib/studio/collectorPrint";

export const runtime = "nodejs";
export const maxDuration = 180;

// ═══════════════════════════════════════════════════════════════════════════
// /api/studio/onboard — Cover Studio 2 P4: a brand-new track becomes a
// collector citizen in one request instead of the manual prime-side ritual.
// Owner-gated, prime-local only (engine + manifest + ffmpeg live on disk).
//
// POST multipart/form-data:
//   title (required) · slug? (derived from title) · genre? mood? lang? geo?
//   bpm? artist? color? · explicit? unreleased? publish? ("1" flags)
//   art?   image file → originals/<Title>.png + first print (engine → R2)
//   audio? mp3 file   → collector/audio/<slug>.mp3, runtime + waveform peaks
//                       (build-manifest.mjs recipe), published to R2 music/
//   publish=1 requires BOTH art and audio → inserts the Supabase tracks row
//   (hidden=false, sort_order max+1) so the song goes live on /music.
//   Without publish: collector-only, like nights-drift-by pre-release.
// ═══════════════════════════════════════════════════════════════════════════

const exec = promisify(execFile);

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "·").trim();
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** mono 8kHz s16le PCM → 96 max-abs buckets, normalized 0..1 (build-manifest.mjs) */
async function peaksFor(mp3: string): Promise<number[] | null> {
  const { stdout } = await exec("ffmpeg", ["-v", "quiet", "-i", mp3, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
    { encoding: "buffer", maxBuffer: 1 << 28, timeout: 60_000 });
  const pcm = stdout as unknown as Buffer;
  const n = pcm.length >> 1, buckets = 96, out = new Array(buckets).fill(0);
  if (!n) return null;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(pcm.readInt16LE(i << 1));
    const b = Math.min(buckets - 1, Math.floor((i / n) * buckets));
    if (v > out[b]) out[b] = v;
  }
  const max = Math.max(...out, 1);
  return out.map((v) => +(v / max).toFixed(3));
}

async function durationOf(mp3: string): Promise<number | null> {
  const { stdout } = await exec("ffprobe", ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", mp3], { timeout: 30_000 });
  return parseFloat(String(stdout).trim()) || null;
}

export async function POST(req: NextRequest) {
  if (!isOwnerRequest(req.headers.get("host"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 }); }

  const str = (k: string) => { const v = form.get(k); return typeof v === "string" && v.trim() ? v.trim() : null; };
  const flag = (k: string) => form.get(k) === "1";
  const title = str("title");
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const slug = str("slug") || slugify(title);
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });

  const art = form.get("art");
  const audio = form.get("audio");
  const hasArt = art instanceof File && art.size > 0;
  const hasAudio = audio instanceof File && audio.size > 0;
  const publish = flag("publish");
  if (publish && (!hasArt || !hasAudio)) {
    return NextResponse.json({ error: "publish needs both art and audio — onboard collector-only, or attach the missing file" }, { status: 400 });
  }

  try {
    // collisions: one slug, one record, one row
    const manifest = readManifest();
    if (manifest.some((r) => r.slug === slug)) return NextResponse.json({ error: `collector record "${slug}" already exists` }, { status: 409 });
    const { data: existing, error: exErr } = await supabaseAdmin().from("tracks").select("id").eq("id", slug).maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (existing) return NextResponse.json({ error: `tracks row "${slug}" already exists` }, { status: 409 });

    const genre = str("genre");
    const bpmNum = Number(str("bpm"));

    // art → the untouched source the engine frames
    let coverFile: string | null = null;
    if (hasArt) {
      coverFile = `${safeName(title)}.png`;
      const sharp = (await import("sharp")).default;
      const png = await sharp(Buffer.from(await (art as File).arrayBuffer())).png().toBuffer();
      mkdirSync(join(COLLECTOR, "originals"), { recursive: true });
      writeFileSync(join(COLLECTOR, "originals", coverFile), png);
    }

    // audio → local copy, verified runtime + true waveform, R2 music/
    let runtime: string | null = null;
    let peaks: number[] | null = null;
    let audioUrl: string | null = null;
    if (hasAudio) {
      mkdirSync(join(COLLECTOR, "audio"), { recursive: true });
      const mp3 = join(COLLECTOR, "audio", `${slug}.mp3`);
      writeFileSync(mp3, Buffer.from(await (audio as File).arrayBuffer()));
      const dur = await durationOf(mp3);
      runtime = dur ? fmtTime(dur) : null;
      peaks = await peaksFor(mp3).catch(() => null);
      const audioName = `${safeName(title)}.mp3`;
      await exec("node", ["upload-file.mjs", mp3, `music/${audioName}`, "audio/mpeg"], { cwd: COLLECTOR, timeout: 120_000 });
      audioUrl = `${PUB}/music/${encodeURIComponent(audioName)}`;
    }

    // the manifest record — facts only, like build-manifest.mjs
    const rec: ManifestRecord = {
      slug, title,
      genre, mood: str("mood"), lang: str("lang"), geo: str("geo"),
      coverFile,
      bpm: Number.isFinite(bpmNum) && bpmNum > 0 ? Math.round(bpmNum) : null,
      runtime, peaks,
      ...(flag("explicit") ? { explicit: true } : {}),
      ...(flag("unreleased") ? { unreleased: true } : {}),
    };
    manifest.push(rec);
    writeManifest(manifest);

    // first print
    let rendered = false;
    if (hasArt) {
      rec.renderedAt = await renderAndPublish(slug);
      writeManifest(manifest);
      rendered = true;
    }

    // go live on /music
    let published = false;
    if (publish) {
      const { data: maxRow, error: maxErr } = await supabaseAdmin()
        .from("tracks").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      if (maxErr) throw new Error(maxErr.message);
      const auto = classifyCollector(genre);
      const { error: insErr } = await supabaseAdmin().from("tracks").insert({
        id: slug, title,
        artist: str("artist") || "xsytrance",
        genre, mood: str("mood"),
        color: str("color") || COLLECTOR_PALETTES[auto.key].accent,
        cover: `${PUB}/covers/collector/${slug}.png`,
        audio_url: audioUrl,
        sort_order: (Number(maxRow?.sort_order) || 0) + 1,
        hidden: false, featured: false,
      });
      if (insErr) throw new Error(insErr.message);
      published = true;
    }

    return NextResponse.json({ ok: true, slug, rendered, published, record: rec });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
