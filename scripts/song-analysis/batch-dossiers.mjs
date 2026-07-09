#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// BATCH DOSSIERS — run the ultimate analyzer across the whole catalog.
//
// For every track in targets.json (a live-DB snapshot):
//   1. skip if R2 already has planets/<id>/profile.json (resume-safe; --force re-does)
//   2. find local stems: assets/suno/stems/<id>/ dir, else a zip whose
//      slugified name matches; no stems → still runs (demucs approx from mp3)
//   3. ultimate.mjs --suno <id> --id <id> --skip-vision --publish [--stems …]
//   4. if the mixer isn't live yet and stems exist: publish-stems.mjs, and the
//      emitted UPDATE is appended to batch-stems.sql (apply to Supabase after)
//
// Serial on purpose — every stage is GPU-bound. Failures are logged and the
// batch moves on; the summary lists every skip and failure (no silent caps).
//
//   node scripts/song-analysis/batch-dossiers.mjs [--dry] [--force]
//     [--only slug[,slug…]] [--include-hidden] [--limit N]
//
// Pre-flight first (see docs/SONIC-DOSSIER.md): free ComfyUI if RAM is tight,
// warm qwen3.5 with keep_alive 2h. ~4-5 min per song → full catalog ≈ 4 h.
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const STEMS_ROOT = join(REPO, "assets", "suno", "stems");
const PUB = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const SQL_OUT = join(HERE, "batch-stems.sql");
const LOG_OUT = join(HERE, "batch-log.jsonl");

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : null);
const DRY = has("--dry");
const FORCE = has("--force");
const ONLY = val("--only")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const LIMIT = val("--limit") ? +val("--limit") : Infinity;

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const targets = JSON.parse(readFileSync(join(HERE, "targets.json"), "utf8")).tracks;

// stems source: extracted dir named exactly <id>, else zip matching by slug
const zips = readdirSync(STEMS_ROOT).filter((f) => f.endsWith(".zip"));
function stemsFor(id, title) {
  const dir = join(STEMS_ROOT, id);
  if (existsSync(dir)) return dir;
  const want = new Set([id, slugify(title)]);
  const hit = zips.find((z) => want.has(slugify(z.replace(/ ?stems\.zip$/i, ""))));
  return hit ? join(STEMS_ROOT, hit) : null;
}

async function published(id) {
  try { return (await fetch(`${PUB}/planets/${id}/profile.json`, { method: "HEAD" })).ok; }
  catch { return false; }
}

const t0 = Date.now();
const done = [], skipped = [], failed = [];
let n = 0;

for (const t of targets) {
  if (ONLY && !ONLY.includes(t.id)) continue;
  if (t.hidden && !has("--include-hidden")) { skipped.push([t.id, "hidden"]); continue; }
  if (n >= LIMIT) { skipped.push([t.id, "over --limit"]); continue; }
  if (!FORCE && (await published(t.id))) { skipped.push([t.id, "already published"]); continue; }

  const stems = stemsFor(t.id, t.title);
  const s0 = Date.now();
  console.error(`\n━━ ${t.id} ${stems ? "" : "(NO LOCAL STEMS — demucs approx)"} ━━`);
  if (DRY) { console.error(`  (dry) stems=${stems ?? "none"} mixer=${t.stemsLive ? "live" : "NOT live"}`); done.push([t.id, 0]); n++; continue; }

  // 1. the analyzer (+ publish to R2)
  const aArgs = [join(HERE, "ultimate.mjs"), "--suno", t.id, "--id", t.id, "--skip-vision", "--publish"];
  if (stems) aArgs.push("--stems", stems);
  const a = spawnSync("node", aArgs, { cwd: REPO, stdio: ["ignore", "inherit", "inherit"] });
  if (a.status !== 0) {
    failed.push([t.id, `ultimate.mjs exit ${a.status}`]);
    appendFileSync(LOG_OUT, JSON.stringify({ id: t.id, ok: false, stage: "ultimate" }) + "\n");
    continue;
  }

  // 2. mixer not live yet? ship the stems + collect the SQL
  if (!t.stemsLive && stems && !stems.endsWith(".zip")) {
    const sensesJson = join(HERE, "profiles", t.id, "senses.json");
    const p = spawnSync("node", [join(REPO, "scripts", "stem-analysis", "publish-stems.mjs"),
      "--stems", stems, "--slug", t.id, "--stems-json", sensesJson], { cwd: REPO, encoding: "utf8" });
    const sql = (p.stdout || "").split("\n").find((l) => l.startsWith("UPDATE tracks SET"));
    if (p.status === 0 && sql) appendFileSync(SQL_OUT, sql + "\n");
    else failed.push([t.id, `publish-stems exit ${p.status} (dossier still published)`]);
    process.stderr.write(p.stderr || "");
  } else if (!t.stemsLive && stems?.endsWith(".zip")) {
    // ultimate.mjs unzipped it into profiles/<id>/stems-src — use that
    const src = join(HERE, "profiles", t.id, "stems-src");
    const sensesJson = join(HERE, "profiles", t.id, "senses.json");
    const p = spawnSync("node", [join(REPO, "scripts", "stem-analysis", "publish-stems.mjs"),
      "--stems", src, "--slug", t.id, "--stems-json", sensesJson], { cwd: REPO, encoding: "utf8" });
    const sql = (p.stdout || "").split("\n").find((l) => l.startsWith("UPDATE tracks SET"));
    if (p.status === 0 && sql) appendFileSync(SQL_OUT, sql + "\n");
    else failed.push([t.id, `publish-stems exit ${p.status} (dossier still published)`]);
    process.stderr.write(p.stderr || "");
  }

  const secs = Math.round((Date.now() - s0) / 1000);
  done.push([t.id, secs]);
  appendFileSync(LOG_OUT, JSON.stringify({ id: t.id, ok: true, secs }) + "\n");
  console.error(`✔ ${t.id} in ${secs}s  (${done.length} done)`);
  n++;
}

console.error(`\n════ BATCH SUMMARY ════ (${Math.round((Date.now() - t0) / 60000)} min)`);
console.error(`done ${done.length}: ${done.map(([id, s]) => `${id}(${s}s)`).join(", ") || "—"}`);
console.error(`skipped ${skipped.length}: ${skipped.map(([id, why]) => `${id}[${why}]`).join(", ") || "—"}`);
console.error(`FAILED ${failed.length}: ${failed.map(([id, why]) => `${id}[${why}]`).join(", ") || "—"}`);
if (existsSync(SQL_OUT)) console.error(`\nmixer SQL collected → ${SQL_OUT} — apply to Supabase to light up new mixers`);
process.exit(failed.length ? 1 : 0);
