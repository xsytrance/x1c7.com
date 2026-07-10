#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE BOOKLET BATCH — an insert for the whole catalog.
//
//   node scripts/booklet/batch-booklets.mjs [--dry] [--force] [--only s,s]
//                                           [--include-hidden] [--limit N]
//
// Mirrors batch-dossiers.mjs: walks the song-analysis targets.json snapshot,
// skips tracks without a profile and (unless --force) tracks whose booklet is
// already on R2 — resume-safe, rerun after any crash. Serial by design (the
// LLM is the bottleneck); failures never stop the batch. Journal:
// scripts/booklet/batch-log.jsonl. Pre-flight: warm qwen3.5 (keep_alive 2h).
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const PROFILES = join(REPO, "scripts", "song-analysis", "profiles");
const PUB = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const JOURNAL = join(HERE, "batch-log.jsonl");
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const only = opt("--only") ? new Set(opt("--only").split(",")) : null;
const LIMIT = +opt("--limit", Infinity);
const log = (...a) => console.error(...a);

const targets = JSON.parse(readFileSync(join(REPO, "scripts", "song-analysis", "targets.json"), "utf8"));
const tracks = targets.tracks.filter((t) => (only ? only.has(t.id) : true) && (flag("--include-hidden") || !t.hidden));

let done = 0, skipped = [], failed = [];
for (const t of tracks) {
  if (done >= LIMIT) break;
  if (!existsSync(join(PROFILES, t.id, "profile.json"))) { skipped.push([t.id, "no profile"]); continue; }
  if (!flag("--force")) {
    const head = await fetch(`${PUB}/planets/${t.id}/booklet.json`, { method: "HEAD" }).catch(() => null);
    if (head?.ok) { skipped.push([t.id, "published"]); continue; }
  }
  if (flag("--dry")) { log(`would build: ${t.id}`); done++; continue; }
  const t0 = Date.now();
  try {
    execFileSync("node", [join(HERE, "build-booklet.mjs"), "--id", t.id, "--publish", ...(flag("--force") ? ["--force"] : [])], { stdio: ["ignore", "inherit", "inherit"] });
    const secs = Math.round((Date.now() - t0) / 1000);
    appendFileSync(JOURNAL, JSON.stringify({ id: t.id, ok: true, secs }) + "\n");
    done++;
    log(`━━ ${t.id} ✔ (${secs}s) — ${done} built`);
  } catch (e) {
    appendFileSync(JOURNAL, JSON.stringify({ id: t.id, ok: false, err: String(e.message).slice(0, 120) }) + "\n");
    failed.push([t.id, e.message]);
    log(`━━ ${t.id} ✘ ${e.message}`);
  }
}

log(`\nBATCH DONE — ${done} built, ${skipped.length} skipped, ${failed.length} failed`);
for (const [id, why] of skipped) log(`  · skip ${id}: ${why}`);
for (const [id, why] of failed) log(`  ✘ FAIL ${id}: ${String(why).slice(0, 100)}`);
process.exit(failed.length ? 1 : 0);
