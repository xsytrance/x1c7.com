#!/usr/bin/env node
// REBUILD WORD TIMES FROM THE WHISPER TRANSCRIPT.
//
// The LCS aligner that produced lyrics_synced degenerates on repeated and
// fast-sung lines: whole phrases collapse onto one timestamp and then the
// stream jumps to catch up. On "I Won't Be Your Fire" the line
//   "I'm saying no because I love you enough"
// had "I love you enough" stamped at 196.91-197.07 when the singer actually
// sings it at 192.66-193.88 — over three seconds late — followed by a fake
// 3.7s gap and a 6.4s one. A global offset cannot fix that; only per-word
// times can.
//
// The transcript keeps a per-word clock (segments[].words[].t). Its TEXT is
// worse than the official lyric (mishearings), but its TIMES are measured. So:
// keep the database's words, take the transcript's clock, match the two
// sequences, and interpolate across anything that doesn't match.
//
//   node scripts/alignment/rebuild-from-transcript.mjs --track <slug>
//        --from S --to S [--apply] [--max-shift 4]
//
// Without --apply it only reports. Always journals before writing.

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
const TRACK = args.track, FROM = parseFloat(args.from), TO = parseFloat(args.to);
const MAXSHIFT = parseFloat(args["max-shift"] ?? "4");
if (!TRACK || !isFinite(FROM) || !isFinite(TO)) {
  console.error("usage: --track <slug> --from <sec> --to <sec> [--apply]"); process.exit(2);
}

const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const profile = join(REPO, "scripts/song-analysis/profiles", TRACK);
const tr = JSON.parse(readFileSync(join(profile, "transcript.json"), "utf8"));
// Pad the read window so the matcher has anchors either side of the repair.
const PAD = 6;
const ref = [];
for (const seg of tr.segments ?? []) {
  for (const w of seg.words ?? []) {
    const t = w.t ?? w.start;
    if (typeof t !== "number") continue;
    if (t < FROM - PAD || t > TO + PAD) continue;
    const n = norm(w.text ?? w.word ?? "");
    if (n) ref.push({ t, n });
  }
}
ref.sort((a, b) => a.t - b.t);
if (ref.length < 5) { console.error("transcript has no per-word clock in this range"); process.exit(1); }

const { data: row, error } = await db.from("tracks").select("lyrics_synced").eq("id", TRACK).single();
if (error) { console.error(error); process.exit(1); }
const all = row.lyrics_synced?.words ?? [];
const idxs = all.map((w, i) => i).filter((i) => all[i].t >= FROM - PAD && all[i].t <= TO + PAD);
const cur = idxs.map((i) => ({ i, t: all[i].t, n: norm(all[i].w), w: all[i].w }));

// ── LCS over normalised tokens: the database's word order is authoritative,
// the transcript only contributes a clock. ────────────────────────────────
const A = cur.length, B = ref.length;
const L = Array.from({ length: A + 1 }, () => new Uint16Array(B + 1));
for (let i = A - 1; i >= 0; i--) {
  for (let j = B - 1; j >= 0; j--) {
    L[i][j] = cur[i].n === ref[j].n ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  }
}
const pairs = [];
let i = 0, j = 0;
while (i < A && j < B) {
  if (cur[i].n === ref[j].n) { pairs.push([i, j]); i++; j++; }
  else if (L[i + 1][j] >= L[i][j + 1]) i++;
  else j++;
}

// Anchors = matched pairs whose proposed move is believable. A pair that wants
// to jump more than --max-shift is more likely a bad match than a bad time.
const anchors = pairs
  .map(([a, b]) => ({ a, t: ref[b].t, was: cur[a].t }))
  .filter((p) => Math.abs(p.t - p.was) <= MAXSHIFT);

if (anchors.length < 4) { console.error(`only ${anchors.length} usable anchors — refusing`); process.exit(1); }

// Rebuild: matched words take the transcript clock; everything between two
// anchors is redistributed proportionally to how it was spaced before.
const out = cur.map((c) => ({ ...c, nt: null }));
for (const p of anchors) out[p.a].nt = p.t;
for (let k = 0; k < out.length; k++) {
  if (out[k].nt !== null) continue;
  let lo = k - 1; while (lo >= 0 && out[lo].nt === null) lo--;
  let hi = k + 1; while (hi < out.length && out[hi].nt === null) hi++;
  if (lo < 0 || hi >= out.length) { out[k].nt = out[k].t; continue; }
  const span0 = out[hi].t - out[lo].t, span1 = out[hi].nt - out[lo].nt;
  const f = span0 > 1e-6 ? (out[k].t - out[lo].t) / span0 : (k - lo) / (hi - lo);
  out[k].nt = out[lo].nt + f * span1;
}
// Monotonic, and never two words on the exact same stamp.
out.sort((a, b) => a.nt - b.nt);
for (let k = 1; k < out.length; k++) if (out[k].nt <= out[k - 1].nt) out[k].nt = out[k - 1].nt + 0.01;

const moved = out.filter((o) => Math.abs(o.nt - o.t) > 0.15);
console.log(`track      ${TRACK}   window ${FROM}–${TO} (+/-${PAD}s pad)`);
console.log(`words      ${cur.length} in range · transcript refs ${ref.length}`);
console.log(`matched    ${pairs.length} · usable anchors ${anchors.length}`);
console.log(`moved >150ms: ${moved.length}\n`);
for (const o of moved.slice(0, 28)) {
  const d = o.nt - o.t;
  console.log(`  ${o.t.toFixed(2)} → ${o.nt.toFixed(2)}  ${d >= 0 ? "+" : ""}${d.toFixed(2)}s  ${o.w}`);
}
if (moved.length > 28) console.log(`  … ${moved.length - 28} more`);

if (!args.apply) { console.log("\n[report only] pass --apply to write"); process.exit(0); }

const backupDir = join(profile, "pre-fire-backup");
mkdirSync(backupDir, { recursive: true });
const bak = join(backupDir, `lyrics_synced-before-rebuild-${FROM}-${TO}.json`);
if (!existsSync(bak)) writeFileSync(bak, JSON.stringify(row.lyrics_synced, null, 1));

const next = all.slice();
for (const o of out) next[o.i] = { ...all[o.i], t: +o.nt.toFixed(3) };
next.sort((a, b) => a.t - b.t);
const { error: uerr } = await db.from("tracks")
  .update({ lyrics_synced: { ...row.lyrics_synced, words: next, source: "aligned-transcript-rebuild" } }).eq("id", TRACK);
if (uerr) { console.error(uerr); process.exit(1); }
console.log(`\n✦ rebuilt ${out.length} word times (backup: ${bak})`);
