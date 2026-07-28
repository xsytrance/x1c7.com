#!/usr/bin/env node
// RE-ANALYSE — rebuild a song's measured senses from its release audio and
// republish them, fixing the old libsndfile stem truncation.
//
// The bug: stems were read only ~50-64% of the way through, so senses.json /
// stems.json carry ZERO energy past that point. The engine scales word size by
// measured lead-vocal energy and drives the backdrop, particles and riser
// charge off the same envelopes — so any moment past the cutoff renders at
// minimum size against a stage that does not react to the music at all. The
// render rig reports perfect A/V sync throughout, because frame-vs-audio sync
// was never the thing that was broken.
//
// This measures straight off the release mp3 (analyze_audio.py), which is never
// truncated, so coverage comes back at ~1.0 for the whole song.
//
//   node scripts/stem-analysis/reanalyze.mjs --track <slug> [--dry] [--force]
//   node scripts/stem-analysis/reanalyze.mjs --all [--min-coverage 0.85]
//
// Safe to re-run: a song already at full coverage is skipped unless --force.

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PY = join(REPO, "scripts/stem-analysis/.venv/bin/python");
const ANALYZE = join(REPO, "scripts/stem-analysis/analyze_audio.py");
const UPLOAD = join(REPO, "scripts/song-art/collector/upload-file.mjs");
const PROFILES = join(REPO, "scripts/song-analysis/profiles");

const env = Object.fromEntries(readFileSync(join(REPO, ".env"), "utf8").split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
const PUB = env.PUBLIC_URL || "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
  return a;
}, []));
const MINCOV = parseFloat(args["min-coverage"] ?? "0.85");

function coverage(senses) {
  const lead = senses?.env?.lead ?? [];
  if (!lead.length) return { cov: 0, endsAt: 0, dur: 0 };
  const hz = senses.envHz || 12.5;
  const nz = lead.reduce((n, v, i) => (v > 1e-6 ? i : n), 0);
  const live = lead.filter((v) => v > 1e-6).length;
  return { cov: live / lead.length, endsAt: nz / hz, dur: lead.length / hz };
}

async function reanalyze(slug) {
  const dir = join(PROFILES, slug);
  if (!existsSync(dir)) return { slug, skipped: "no profile dir" };
  const sensesPath = join(dir, "senses.json");
  const before = existsSync(sensesPath) ? JSON.parse(readFileSync(sensesPath, "utf8")) : null;
  const c0 = coverage(before);
  if (before && c0.cov >= MINCOV && !args.force) {
    return { slug, skipped: `already ${c0.cov.toFixed(2)}` };
  }

  const { data: row, error } = await db.from("tracks").select("audio_url,planet").eq("id", slug).single();
  if (error) return { slug, skipped: `not in DB (${error.message})` };

  // The renderer's canonical audio path. Fetch it if this profile never had one.
  const mp3 = join(dir, "release.mp3");
  if (!existsSync(mp3)) {
    if (!row.audio_url) return { slug, skipped: "no audio_url and no local mp3" };
    const r = await fetch(row.audio_url);
    if (!r.ok) return { slug, skipped: `audio fetch ${r.status}` };
    writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
  }

  if (args.dry) return { slug, would: `${c0.cov.toFixed(2)} → reanalyse`, dry: true };

  const backupDir = join(dir, "pre-refix-backup");
  mkdirSync(backupDir, { recursive: true });
  if (before && !existsSync(join(backupDir, "senses-truncated.json"))) {
    copyFileSync(sensesPath, join(backupDir, "senses-truncated.json"));
  }

  const tmp = join(dir, "senses-reanalyzed.json");
  execFileSync(PY, [ANALYZE, "--audio", mp3, "--out", tmp, "--no-demucs"], { stdio: "pipe" });
  const next = JSON.parse(readFileSync(tmp, "utf8"));

  // librosa's audio-only path frequently locks onto the 8th-note grid and
  // reports double tempo. The old stem-measured bpm is the better reference;
  // without this the stage pulses at twice the song's rate.
  if (before?.bpm && Math.abs(next.bpm - 2 * before.bpm) < 4) {
    next.bpm = Math.round(before.bpm * 1000) / 1000;
    next.beats = (next.beats ?? []).filter((_, i) => i % 2 === 0);
    next.halvedTempo = true;
  }
  writeFileSync(sensesPath, JSON.stringify(next));
  rmSync(tmp, { force: true });   // scratch file, not an artifact
  const c1 = coverage(next);

  // Republish the copy the ENGINE actually reads, if this song has one.
  let published = null;
  const stemsUrl = row.planet?.assets?.stems;
  if (stemsUrl) {
    const key = stemsUrl.replace(`${PUB}/`, "");
    const bak = join(backupDir, "stems-json-truncated.json");
    if (!existsSync(bak)) {
      const old = await fetch(`${stemsUrl}?cb=${Date.now()}`);
      if (old.ok) writeFileSync(bak, Buffer.from(await old.arrayBuffer()));
    }
    execFileSync("node", [UPLOAD, sensesPath, key, "application/json"], { stdio: "pipe" });
    const check = await fetch(`${stemsUrl}?cb=${Date.now()}${Math.random()}`, { cache: "no-store" });
    const live = check.ok ? coverage(await check.json()) : { cov: 0 };
    published = live.cov;
  }
  return { slug, cov0: c0.cov, cov1: c1.cov, endsAt0: c0.endsAt, dur: c1.dur, bpm: next.bpm, halved: !!next.halvedTempo, published };
}

const targets = args.all
  ? (await db.from("tracks").select("id")).data.map((r) => r.id).filter((id) => existsSync(join(PROFILES, id, "senses.json")))
  : [args.track].filter(Boolean);
if (!targets.length) { console.error("usage: reanalyze.mjs --track <slug> | --all"); process.exit(2); }

let fixed = 0;
for (const slug of targets) {
  const r = await reanalyze(slug);
  if (r.skipped) { console.log(`  ·  ${slug.padEnd(42)} skipped (${r.skipped})`); continue; }
  if (r.dry) { console.log(`  ?  ${slug.padEnd(42)} ${r.would}`); continue; }
  fixed++;
  console.log(`  ✦  ${slug.padEnd(42)} coverage ${r.cov0.toFixed(2)} (ended ${r.endsAt0.toFixed(0)}s of ${r.dur.toFixed(0)}s) → ${r.cov1.toFixed(2)}`
    + `${r.halved ? `  · bpm halved to ${r.bpm}` : `  · bpm ${r.bpm}`}`
    + `${r.published !== null ? `  · R2 verified ${r.published.toFixed(2)}` : "  · no R2 stems to publish"}`);
}
console.log(`\n${fixed} re-analysed`);
