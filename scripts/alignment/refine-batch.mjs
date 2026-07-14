#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ALIGNMENT · REFINE BATCH — run the onset refiner across the catalog.
//
// For every live track with timed words + a published lead stem: fetch the
// LIVE words from Supabase, reuse the lead stems already cached by the melody
// batch (scripts/stem-analysis/out/<slug>/lead.m4a — downloads any missing),
// run refine-alignment.py, and report BEFORE→AFTER scores. The refiner never
// adds/removes/reorders words, so melody.json (keyed by word INDEX) survives
// re-timing untouched.
//
//   node scripts/alignment/refine-batch.mjs                # analyze only
//     [--only slug,slug] [--limit N]
//     [--apply]   # write refined timings to Supabase (lyrics_synced), with
//                 # the previous values journaled to refine-backup.jsonl.
//                 # Gated: applies only when the refined score is a strict
//                 # improvement (onset-dist down, silence not up).
//
// After an --apply: re-run any show/booklet pipelines that cache timings.
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const STEM_OUT = path.join(ROOT, "scripts", "stem-analysis", "out");
const PY = path.join(process.env.HOME || "/home/xsyprime", "librosa-venv", "bin", "python");
const R2_PUBLIC = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const JOURNAL = path.join(__dirname, "refine-backup.jsonl");

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return a;
}, []));
const ONLY = args.only && args.only !== true ? new Set(String(args.only).split(",")) : null;
const LIMIT = args.limit && args.limit !== true ? Number(args.limit) : Infinity;
const APPLY = !!args.apply;
const log = (...a) => console.error(...a);

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = { ...loadEnv(path.join(ROOT, ".env")), ...loadEnv(path.join(ROOT, ".env.local")) };
if (!env.SUPABASE_SERVICE_ROLE_KEY) { log("✗ SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
const abs = (u) => (u && !/^https?:/.test(u) ? R2_PUBLIC + (u.startsWith("/") ? u : `/${u}`) : u);

async function fetchJson(url) {
  const r = await fetch(url).catch(() => null);
  return r?.ok ? r.json() : null;
}
async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return true;
  const r = await fetch(url).catch(() => null);
  if (!r?.ok) return false;
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return true;
}

async function main() {
  const { data, error } = await db.from("tracks").select("id, lyrics_synced, planet").not("planet", "is", null);
  if (error) { log("✗ supabase:", error.message); process.exit(1); }
  const candidates = data.filter((row) =>
    Array.isArray(row.lyrics_synced?.words) && row.lyrics_synced.words.length >= 20 &&
    row.planet?.assets?.stemAudio?.lead && (!ONLY || ONLY.has(row.id))
  ).slice(0, LIMIT);
  log(`refine batch: ${candidates.length} track(s)${APPLY ? " → APPLY improvements" : " (analysis only)"}\n`);

  const report = [];
  for (const row of candidates) {
    const slug = row.id;
    const dir = path.join(STEM_OUT, slug);
    fs.mkdirSync(dir, { recursive: true });
    try {
      const leadUrl = abs(row.planet.assets.stemAudio.lead);
      const leadPath = path.join(dir, "lead" + (path.extname(new URL(leadUrl).pathname) || ".m4a"));
      if (!(await download(leadUrl, leadPath))) { report.push({ slug, status: "no-lead" }); continue; }
      const stemsJson = row.planet.assets.stems ? await fetchJson(abs(row.planet.assets.stems)) : null;
      const lag = stemsJson?.align?.lag ?? 0;
      const wordsPath = path.join(dir, "refine-words.json");
      fs.writeFileSync(wordsPath, JSON.stringify({ words: row.lyrics_synced.words }));
      const outPath = path.join(dir, "refined.json");
      execFileSync(PY, [
        path.join(__dirname, "refine-alignment.py"),
        "--lead", leadPath, "--words", wordsPath, "--lag", String(lag), "--out", outPath,
      ], { stdio: ["ignore", 2, 2] });
      const r = JSON.parse(fs.readFileSync(outPath, "utf8"));
      const b = r.score.before, a = r.score.after;
      const better = a.meanOnsetDist < b.meanOnsetDist && a.silenceRate <= b.silenceRate + 0.005;
      const entry = {
        slug,
        status: better ? "improved" : "no-gain",
        source: row.lyrics_synced.source ?? "?",
        distBefore: b.meanOnsetDist, distAfter: a.meanOnsetDist,
        clumpBefore: b.clumpRatio, clumpAfter: a.clumpRatio,
        lag: b.globalLag, shifted: r.shifted,
      };
      if (APPLY && better) {
        fs.appendFileSync(JOURNAL, JSON.stringify({ at: new Date().toISOString(), slug, prev: row.lyrics_synced }) + "\n");
        const patch = {
          lyrics_synced: {
            ...row.lyrics_synced,
            source: "aligned-refined",
            refinedAt: new Date().toISOString().slice(0, 10),
            words: r.words,
          },
        };
        const { error: e2 } = await db.from("tracks").update(patch).eq("id", slug);
        if (e2) { entry.status = "apply-error"; entry.err = e2.message; }
        else entry.applied = true;
      }
      report.push(entry);
      log(`  ${slug}: dist ${b.meanOnsetDist}→${a.meanOnsetDist}s · clump ${b.clumpRatio}→${a.clumpRatio} · lag ${b.globalLag}s ${entry.applied ? "✓ applied" : ""}`);
    } catch (e) {
      report.push({ slug, status: "error", err: String(e).slice(0, 120) });
      log(`  ${slug}: ERROR ${String(e).slice(0, 80)}`);
    }
  }

  const pad = (s, n) => String(s ?? "").padEnd(n);
  log(`\n${pad("slug", 44)}${pad("status", 10)}${pad("dist b→a", 15)}${pad("clump b→a", 14)}${pad("lag", 8)}applied`);
  for (const r of report.sort((x, y) => (y.distBefore ?? 0) - (x.distBefore ?? 0))) {
    log(`${pad(r.slug, 44)}${pad(r.status, 10)}${pad(r.distBefore != null ? `${r.distBefore}→${r.distAfter}` : "", 15)}${pad(r.clumpBefore != null ? `${r.clumpBefore}→${r.clumpAfter}` : "", 14)}${pad(r.lag ?? "", 8)}${r.applied ? "✓" : ""}`);
  }
  const gains = report.filter((r) => r.status === "improved");
  log(`\n${gains.length} improved · ${report.filter((r) => r.status === "no-gain").length} no-gain · ${report.filter((r) => r.status === "error" || r.status === "no-lead").length} failed`);
  if (gains.length) {
    const avg = (k) => (gains.reduce((s, r) => s + r[k], 0) / gains.length).toFixed(3);
    log(`mean onset distance across improved: ${avg("distBefore")}s → ${avg("distAfter")}s`);
  }
  fs.writeFileSync(path.join(STEM_OUT, "refine-report.json"), JSON.stringify(report, null, 2));
  log(`report → scripts/stem-analysis/out/refine-report.json`);
}

main();
