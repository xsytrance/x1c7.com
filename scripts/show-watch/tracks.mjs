// ── SHOW-WATCH TRACKS ───────────────────────────────────────────────────────
// Track list + per-show sample points, all from the local analyzer caches
// (profiles/<slug>/profile.json + dynamic-plus.json) — no DB dependency.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROFILES = join(dirname(fileURLToPath(import.meta.url)), "..", "song-analysis", "profiles");

export function loadTracks({ only = null } = {}) {
  const slugs = readdirSync(PROFILES, { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name)
    .filter((s) => !only || only.has(s));
  const tracks = [];
  for (const slug of slugs) {
    const pPath = join(PROFILES, slug, "profile.json");
    if (!existsSync(pPath)) continue;
    try {
      const p = JSON.parse(readFileSync(pPath, "utf8"));
      const dPath = join(PROFILES, slug, "dynamic-plus.json");
      const dyn = existsSync(dPath) ? JSON.parse(readFileSync(dPath, "utf8")) : null;
      tracks.push({
        slug,
        title: p.identity?.title ?? slug,
        duration: p.measured?.duration ?? 240,
        sections: (p.analysis?.sections ?? []).map((s) => s.start).filter((t) => typeof t === "number"),
        acts: (dyn?.acts ?? []).flatMap((a) => [a.start, a.end]),
        weather: p.identity?.mood ?? "",
        hasStems: !!p.files?.stems || !!p.show?.vocalPresence,
        drops: (p.show?.dropMap ?? []).length,
      });
    } catch (e) {
      console.error(`  ! ${slug}: unreadable profile (${e.message}) — skipped`);
    }
  }
  return tracks.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Scrub-mode sample times: a base grid every 8s, plus each section start
 * bracketed at −1s/+1.5s (either side of the backdrop crossfade) and each act
 * boundary ±1s. Deduped within 1.5s. */
export function samplePoints(track) {
  const pts = [];
  for (let t = 4; t < track.duration - 4; t += 8) pts.push(t);
  for (const s of track.sections) { pts.push(s - 1, s + 1.5); }
  for (const a of track.acts) { pts.push(a - 1, a + 1); }
  const sorted = pts.filter((t) => t >= 1 && t < track.duration - 2).sort((x, y) => x - y);
  const out = [];
  for (const t of sorted) if (!out.length || t - out[out.length - 1] >= 1.5) out.push(+t.toFixed(1));
  return out;
}

/** Deterministic diverse subset for the on-device pass: spread across mood,
 * stems presence, drop count, and duration. */
export function pickRepresentative(tracks, n = 8) {
  const scored = tracks.map((t) => ({ t, key: `${t.weather}|${t.hasStems}|${t.drops > 4}|${t.duration > 220}` }));
  const byKey = new Map();
  for (const s of scored) (byKey.get(s.key) ?? byKey.set(s.key, []).get(s.key)).push(s.t);
  const picks = [];
  const keys = [...byKey.keys()].sort();
  let i = 0;
  while (picks.length < Math.min(n, tracks.length)) {
    const bucket = byKey.get(keys[i % keys.length]);
    if (bucket.length) picks.push(bucket.shift());
    i++;
    if (i > 500) break;
  }
  return picks;
}
