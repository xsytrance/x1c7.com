#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SUNO PULL — the catalog, straight from the source.
//
// Suno's profile API is public (no auth): every clip ships its title, style
// tags, full lyrics (`prompt`), release mp3, and cover art. This pulls the
// whole profile and (optionally) materializes the assets the pipeline wants:
//
//   lyrics & styles/<slug>.lyrics.txt   ← metadata.prompt
//   lyrics & styles/<slug>.style.txt    ← metadata.tags
//   mp3/<Title>.mp3                     ← audio_url        (--download)
//   art/<Title>.<ext>                   ← image_large_url  (--download)
//
// Existing files are NEVER overwritten (hand-curated fixes win) unless
// --force. A catalog JSON always lands next to this script for other tools
// (ultimate.mjs --suno consumes it).
//
//   node scripts/song-analysis/suno-pull.mjs --handle xsytrance \
//     [--out assets/suno] [--write-lyrics] [--download] [--only <uuid|title>]
//     [--force] [--json]   # --json: print catalog to stdout, write nothing
// ═══════════════════════════════════════════════════════════════════════════

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const UA = "Mozilla/5.0 (X11; Linux x86_64)";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return a;
}, []));
const HANDLE = args.handle && args.handle !== true ? args.handle : "xsytrance";
const OUT = resolve(REPO, args.out && args.out !== true ? args.out : "assets/suno");
const ONLY = args.only && args.only !== true ? args.only.toLowerCase() : null;
const log = (...a) => console.error(...a);

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function page(n) {
  const url = `https://studio-api.prod.suno.com/api/profiles/${HANDLE}?playlists_sort_by=upvote_count&clips_sort_by=created_at&page=${n}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`suno api ${res.status} on page ${n}`);
  return res.json();
}

// ── 1. FETCH ALL PAGES ──────────────────────────────────────────────────────
const first = await page(1);
const clips = [...(first.clips ?? [])];
const total = first.num_total_clips ?? clips.length;
for (let n = 2; clips.length < total; n++) {
  const p = await page(n);
  if (!p.clips?.length) break;
  clips.push(...p.clips);
}
log(`@${HANDLE}: ${clips.length}/${total} clips`);

const catalog = clips.map((c) => ({
  id: c.id,
  title: c.title?.trim(),
  slug: slugify(c.title || c.id),
  createdAt: c.created_at,
  tags: c.metadata?.tags ?? null,
  lyrics: c.metadata?.prompt ?? null,
  duration: c.metadata?.duration ?? null,
  audioUrl: c.audio_url ?? null,
  imageUrl: c.image_large_url ?? c.image_url ?? null,
}));

if (args.json) {
  // process.exit() would truncate a large stdout mid-flush — end naturally.
  process.stdout.write(JSON.stringify(catalog, null, 2) + "\n");
} else {
  const catalogPath = join(HERE, `suno-catalog-${HANDLE}.json`);
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  log(`catalog → ${catalogPath}`);
}

// ── 2. MATERIALIZE ──────────────────────────────────────────────────────────
const pick = args.json ? []
  : ONLY ? catalog.filter((c) => c.id === ONLY || c.title?.toLowerCase().includes(ONLY) || c.slug.includes(ONLY)) : catalog;
const save = async (url, dest) => {
  if (!url) return false;
  if (existsSync(dest) && !args.force) { log(`  · keep ${dest} (exists)`); return false; }
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) { log(`  ✗ ${res.status} ${url}`); return false; }
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return true;
};

for (const c of pick) {
  if (!c.title) continue;
  log(`▸ ${c.title} (${c.slug})`);
  if (args["write-lyrics"]) {
    const ls = join(OUT, "lyrics & styles");
    mkdirSync(ls, { recursive: true });
    for (const [ext, body] of [["lyrics", c.lyrics], ["style", c.tags]]) {
      if (!body) continue;
      const f = join(ls, `${c.slug}.${ext}.txt`);
      if (existsSync(f) && !args.force) { log(`  · keep ${ext} (exists)`); continue; }
      writeFileSync(f, body.trim() + "\n");
      log(`  ✓ ${ext}`);
    }
  }
  if (args.download) {
    mkdirSync(join(OUT, "mp3"), { recursive: true });
    mkdirSync(join(OUT, "art"), { recursive: true });
    if (await save(c.audioUrl, join(OUT, "mp3", `${c.title}.mp3`))) log("  ✓ mp3");
    const ext = (c.imageUrl?.match(/\.(png|jpe?g|webp)/) || [, "jpeg"])[1];
    if (await save(c.imageUrl, join(OUT, "art", `${c.title}.${ext}`))) log("  ✓ cover");
  }
}
log("✦ done");
