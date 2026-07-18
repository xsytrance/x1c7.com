#!/usr/bin/env node
// Backfill missing VERIFIED facts (runtime, waveform peaks, bpm) into
// manifest.json for records that have a live audio source. Facts only, same
// recipes as build-manifest.mjs: runtime/peaks from the actual MP3 (ffprobe/
// ffmpeg), bpm from the track's stems.json when it exists. Records with no
// audio anywhere stay null — the engine omits what can't be verified.
//
//   node backfill-facts.mjs [--dry]
//
// Born 2026-07-18: the post-reinstall manifest rebuild left peaks:null on 20
// tracks the old AUDIO map didn't know, so their spines printed without the
// waveform chip — a shelf inconsistency the owner spotted instantly.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = join(HERE, "audio");
mkdirSync(AUDIO_DIR, { recursive: true });
const dry = process.argv.includes("--dry");

const SUPABASE_URL = "https://kxbrjmbovjiwwcnepsfh.supabase.co";
const ANON = "sb_publishable_W6GH_BAujfZz0KxKr07Wbg_OuQePF7-";
const PUB = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

const fmtTime = (s) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`; }; // round FIRST or 299.6s prints "4:60"

function peaksFor(mp3) {
  const pcm = execFileSync("ffmpeg", ["-v", "quiet", "-i", mp3, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
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
const durationOf = (mp3) => parseFloat(execFileSync("ffprobe", ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).toString().trim()) || null;

const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/tracks?select=id,audio_url`, { headers: { apikey: ANON, authorization: `Bearer ${ANON}` } })).json();
const audioOf = new Map(rows.map((r) => [r.id, r.audio_url]));

const manifest = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));
let touched = 0;
for (const rec of manifest) {
  const needPeaks = !rec.peaks, needRuntime = !rec.runtime, needBpm = !rec.bpm;
  if (!needPeaks && !needRuntime && !needBpm) continue;
  const url = audioOf.get(rec.slug);
  if (!url) { console.error(`— ${rec.slug}: no audio row, stays null`); continue; }

  let bpm = rec.bpm ?? null, durationSec = null;
  try {
    const r = await fetch(`${PUB}/planets/${rec.slug}/stems/stems.json`);
    if (r.ok) { const j = await r.json(); bpm = bpm ?? (j.bpm ? Math.round(j.bpm) : null); durationSec = j.duration || null; }
  } catch { /* no stems — mp3 facts only */ }

  const mp3 = join(AUDIO_DIR, `${rec.slug}.mp3`);
  if ((needPeaks || (needRuntime && !durationSec)) && !existsSync(mp3)) {
    const r = await fetch(url);
    if (!r.ok) { console.error(`✗ ${rec.slug}: audio ${r.status} — skipped`); continue; }
    writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
  }
  try {
    if (needRuntime) { const d = durationSec ?? durationOf(mp3); if (d) rec.runtime = fmtTime(d); }
    if (needPeaks) rec.peaks = peaksFor(mp3);
    if (needBpm && bpm) rec.bpm = bpm;
    touched++;
    console.error(`✓ ${rec.slug}: bpm=${rec.bpm ?? "—"} runtime=${rec.runtime ?? "—"} peaks=${rec.peaks ? "yes" : "—"}`);
  } catch (e) {
    console.error(`✗ ${rec.slug}: ${e.message.split("\n")[0]}`);
  }
}
if (!dry && touched) writeFileSync(join(HERE, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
console.error(dry ? `dry: would update ${touched}` : `updated ${touched} record(s) in manifest.json`);
