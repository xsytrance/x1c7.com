#!/usr/bin/env node
// SYNC AUDIT — does the word stream actually land on the voice?
//
// The render rig already proves FRAME↔AUDIO sync (its pixel clock is decoded
// out of the finished video). What it cannot prove is that the WORD TIMES are
// right in the first place: if lyrics_synced is 200ms early, every frame is
// perfectly stamped and the whole video still feels off. This measures that
// second thing, objectively, against the song's own measured lead-vocal
// envelope (senses.json env.lead, 12.5 Hz, from the isolated vocal stem).
//
// Method: a correctly-timed word lands on a RISE in the vocal envelope. So
// shift the whole word stream by δ over a range, and for each δ score the sum
// of the positive envelope derivative sampled at the shifted word times. The δ
// that maximises that score is the stream's true offset. A clean alignment
// peaks sharply at δ≈0; a late/early stream peaks somewhere else; a drifting
// stream peaks at different δ for the first and second half of the window.
//
// Usage:
//   node scripts/alignment/sync-audit.mjs --track <slug> [--from S --to S]
//                                         [--apply] [--dry]
// --apply writes the measured offset back into tracks.lyrics_synced (window
// only), journalling the previous values first.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const env = Object.fromEntries(readFileSync(join(REPO, ".env"), "utf8").split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
  return a;
}, []));
const TRACK = args.track;
if (!TRACK) { console.error("usage: sync-audit.mjs --track <slug> [--from S --to S] [--apply]"); process.exit(2); }

const profile = join(REPO, "scripts/song-analysis/profiles", TRACK);
const senses = JSON.parse(readFileSync(join(profile, "senses.json"), "utf8"));
const HZ = senses.envHz || 12.5;
const LAG = senses.align?.lag ?? 0;      // stem clock → release clock
const lead = senses.env?.lead ?? [];
const back = senses.env?.back ?? [];
if (!lead.length) { console.error("no lead envelope in senses.json"); process.exit(1); }

// Voice = lead + a little of the doubles, so harmonised lines still register.
const voice = lead.map((v, i) => v + 0.5 * (back[i] ?? 0));

// Positive derivative — the onset signal. Smoothed by one sample either side so
// a single noisy frame can't dominate the score.
const d = new Float64Array(voice.length);
for (let i = 1; i < voice.length; i++) d[i] = Math.max(0, voice[i] - voice[i - 1]);
const onset = new Float64Array(voice.length);
for (let i = 1; i < voice.length - 1; i++) onset[i] = d[i] + 0.5 * (d[i - 1] + d[i + 1]);
let peak = 0; for (const v of onset) if (v > peak) peak = v;
if (peak > 0) for (let i = 0; i < onset.length; i++) onset[i] /= peak;

/** Sample the onset signal at a release-clock time (linear interpolation). */
const at = (tRelease) => {
  const idx = (tRelease - LAG) * HZ;          // release → stem → sample index
  if (idx < 1 || idx >= onset.length - 1) return 0;
  const i = Math.floor(idx), f = idx - i;
  return onset[i] * (1 - f) + onset[i + 1] * f;
};

const { data: row, error } = await db.from("tracks").select("lyrics_synced").eq("id", TRACK).single();
if (error) { console.error(error); process.exit(1); }
const allWords = row.lyrics_synced?.words ?? [];
const FROM = args.from ? parseFloat(args.from) : 0;
const TO = args.to ? parseFloat(args.to) : 1e9;

// Only words that START a sung attack are useful evidence. Words stamped within
// 120ms of the previous one are part of the same attack (line-dumped or fast
// syllables) and would just smear the score.
const win = allWords.filter((w) => w.t >= FROM && w.t <= TO);
const probes = win.filter((w, i, a) => i === 0 || w.t - a[i - 1].t > 0.12);
if (probes.length < 8) { console.error(`only ${probes.length} probe words in window — too few`); process.exit(1); }

function score(delta, list) {
  let s = 0;
  for (const w of list) s += at(w.t + delta);
  return s / list.length;
}

const RANGE = 1.2, STEP = 0.01;
let best = { delta: 0, s: -1 };
const curve = [];
for (let dlt = -RANGE; dlt <= RANGE + 1e-9; dlt += STEP) {
  const s = score(dlt, probes);
  curve.push([dlt, s]);
  if (s > best.s) best = { delta: dlt, s };
}
// Drift check: measure each half independently.
const mid = probes[Math.floor(probes.length / 2)].t;
const firstHalf = probes.filter((w) => w.t < mid);
const secondHalf = probes.filter((w) => w.t >= mid);
const bestOf = (list) => {
  let b = { delta: 0, s: -1 };
  for (let dlt = -RANGE; dlt <= RANGE + 1e-9; dlt += STEP) {
    const s = score(dlt, list);
    if (s > b.s) b = { delta: dlt, s };
  }
  return b;
};
const b1 = bestOf(firstHalf), b2 = bestOf(secondHalf);

const at0 = score(0, probes);
const gain = at0 > 0 ? best.s / at0 : Infinity;

console.log(`track            ${TRACK}`);
console.log(`window           ${FROM} → ${TO}   (${win.length} words, ${probes.length} attack probes)`);
console.log(`envelope         lead+back @ ${HZ}Hz, stem lag ${LAG}s`);
console.log(`\nBEST GLOBAL OFFSET   ${best.delta >= 0 ? "+" : ""}${best.delta.toFixed(3)}s   (score ${best.s.toFixed(4)})`);
console.log(`score at 0s          ${at0.toFixed(4)}   → shifting improves onset hit by ${((gain - 1) * 100).toFixed(0)}%`);
console.log(`first half           ${b1.delta >= 0 ? "+" : ""}${b1.delta.toFixed(3)}s`);
console.log(`second half          ${b2.delta >= 0 ? "+" : ""}${b2.delta.toFixed(3)}s`);
console.log(`drift                ${Math.abs(b2.delta - b1.delta).toFixed(3)}s across the window`);

const verdict = Math.abs(best.delta) < 0.06
  ? "ALIGNED — the word stream already sits on the voice."
  : `OFFSET — the stream reads ${best.delta > 0 ? "EARLY" : "LATE"} by ${Math.abs(best.delta).toFixed(3)}s; words should move ${best.delta > 0 ? "later" : "earlier"}.`;
console.log(`\n${verdict}`);
if (Math.abs(b2.delta - b1.delta) > 0.12) console.log("⚠ DRIFT — halves disagree; a single offset will not fix this.");

// Top of the curve, for eyeballing how sharp the peak is.
const top = [...curve].sort((a, b) => b[1] - a[1]).slice(0, 9).sort((a, b) => a[0] - b[0]);
console.log("\ncurve near peak:");
for (const [dlt, s] of top) console.log(`  ${dlt >= 0 ? "+" : ""}${dlt.toFixed(2)}s  ${"█".repeat(Math.round(s / best.s * 40))} ${s.toFixed(4)}`);

if (args.apply && Math.abs(best.delta) >= 0.02) {
  const backupDir = join(profile, "pre-fire-backup");
  mkdirSync(backupDir, { recursive: true });
  const bak = join(backupDir, `lyrics_synced-before-syncfix-${FROM}-${TO}.json`);
  if (!existsSync(bak)) writeFileSync(bak, JSON.stringify(row.lyrics_synced, null, 1));
  const shifted = allWords.map((w) => (w.t >= FROM && w.t <= TO ? { ...w, t: +(w.t + best.delta).toFixed(3) } : w));
  if (args.dry) { console.log(`\n[dry] would shift ${win.length} words by ${best.delta.toFixed(3)}s`); process.exit(0); }
  const { error: uerr } = await db.from("tracks")
    .update({ lyrics_synced: { ...row.lyrics_synced, words: shifted } }).eq("id", TRACK);
  if (uerr) { console.error(uerr); process.exit(1); }
  console.log(`\n✦ shifted ${win.length} words by ${best.delta.toFixed(3)}s (backup: ${bak})`);
}
