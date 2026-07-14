#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// MELODY · BATCH — run analyze_melody.py across the catalog, one command.
//
// For every live track that has BOTH timed words and a published lead stem:
// fetch the LIVE words from Supabase (never a local aligned.json — the 11
// QA-flagged tracks kept whisper timings, and melody indices must match what
// production actually plays), download the lead stem + align.lag from R2,
// run the analyzer, and QA the result with a DIATONIC RATIO gate: the share
// of pitched words that sit in the detected key's scale. A real sung melody
// scores high (i-won-t-be-your-fire: 0.97); a bad alignment or an
// instrumental bleed scores low and is held back from publishing.
//
//   node scripts/stem-analysis/melody-batch.mjs                # analyze all
//     [--only slug,slug] [--limit N] [--force]                 # re-analyze
//     [--publish]        # rclone the PASSING melody.json files to R2
//     [--min-diatonic 0.75] [--min-words 25]
//
// Output: scripts/stem-analysis/out/<slug>/melody.json + a summary table.
// Publishing needs rclone + R2 creds in .env (same as publish-stems.mjs).
// The engine loads planets/<slug>/melody.json by convention — no DB change.
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(__dirname, "out");
const PY = path.join(process.env.HOME || "/home/xsyprime", "librosa-venv", "bin", "python");
const R2_PUBLIC = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return a;
}, []));
const ONLY = args.only && args.only !== true ? new Set(String(args.only).split(",")) : null;
const LIMIT = args.limit && args.limit !== true ? Number(args.limit) : Infinity;
const FORCE = !!args.force;
const PUBLISH = !!args.publish;
const MIN_DIATONIC = args["min-diatonic"] && args["min-diatonic"] !== true ? Number(args["min-diatonic"]) : 0.75;
const MIN_WORDS = args["min-words"] && args["min-words"] !== true ? Number(args["min-words"]) : 25;
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
if (!env.SUPABASE_SERVICE_ROLE_KEY) { log("✗ SUPABASE_SERVICE_ROLE_KEY missing (.env.local)"); process.exit(1); }
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);

const abs = (u) => (u && !/^https?:/.test(u) ? R2_PUBLIC + (u.startsWith("/") ? u : `/${u}`) : u);

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}
async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return true;
  const r = await fetch(url);
  if (!r.ok) return false;
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return true;
}

// Diatonic ratio: pitched words whose pitch class sits in the detected scale.
// Minor admits the harmonic seventh (raised leading tone is normal singing).
const NOTE_PC = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
function diatonicRatio(melody) {
  const root = NOTE_PC[melody.key.root] ?? 0;
  const scale = melody.key.mode === "major" ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10, 11];
  const ok = new Set(scale.map((s) => (root + s) % 12));
  const n = melody.words.length;
  if (!n) return 0;
  return melody.words.filter((w) => ok.has(w.pc)).length / n;
}

function publishR2(local, remote) {
  const e = env;
  const rcloneEnv = {
    ...process.env,
    RCLONE_CONFIG_R2_TYPE: "s3",
    RCLONE_CONFIG_R2_PROVIDER: "Cloudflare",
    RCLONE_CONFIG_R2_REGION: "auto",
    RCLONE_CONFIG_R2_ACCESS_KEY_ID: e.ACCESS_KEY_ID,
    RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: e.SECRET_ACCESS_KEY,
    RCLONE_CONFIG_R2_ENDPOINT: e.ENDPOINT,
  };
  execFileSync("rclone", ["copyto", local, `R2:${e.BUCKET}/${remote}`, "--s3-no-check-bucket", "--no-traverse"], { env: rcloneEnv, stdio: "inherit" });
}

async function main() {
  const { data, error } = await db
    .from("tracks")
    .select("id, lyrics_synced, planet")
    .not("planet", "is", null);
  if (error) { log("✗ supabase:", error.message); process.exit(1); }

  const candidates = data.filter((row) => {
    const words = row.lyrics_synced?.words;
    const lead = row.planet?.assets?.stemAudio?.lead;
    return Array.isArray(words) && words.length >= MIN_WORDS && lead && (!ONLY || ONLY.has(row.id));
  }).slice(0, LIMIT);
  log(`melody batch: ${candidates.length} candidate track(s)${PUBLISH ? " → PUBLISH passing" : " (analysis only)"}\n`);

  const report = [];
  for (const row of candidates) {
    const slug = row.id;
    const dir = path.join(OUT, slug);
    fs.mkdirSync(dir, { recursive: true });
    const melodyPath = path.join(dir, "melody.json");
    try {
      if (!fs.existsSync(melodyPath) || FORCE) {
        const leadUrl = abs(row.planet.assets.stemAudio.lead);
        const stemsUrl = abs(row.planet.assets.stems);
        const stemsJson = stemsUrl ? await fetchJson(stemsUrl) : null;
        const lag = stemsJson?.align?.lag ?? 0;
        const leadPath = path.join(dir, "lead" + (path.extname(new URL(leadUrl).pathname) || ".m4a"));
        log(`▶ ${slug} (lag ${lag})`);
        if (!(await download(leadUrl, leadPath))) { report.push({ slug, status: "no-lead" }); continue; }
        const wordsPath = path.join(dir, "words.json");
        fs.writeFileSync(wordsPath, JSON.stringify({ words: row.lyrics_synced.words }));
        execFileSync(PY, [
          path.join(__dirname, "analyze_melody.py"),
          "--lead", leadPath, "--words", wordsPath, "--lag", String(lag), "--out", melodyPath,
        ], { stdio: ["ignore", 2, 2] });
      } else {
        log(`▶ ${slug} (cached)`);
      }
      const melody = JSON.parse(fs.readFileSync(melodyPath, "utf8"));
      const dia = diatonicRatio(melody);
      const coverage = melody.words.length / row.lyrics_synced.words.length;
      const pass = dia >= MIN_DIATONIC && melody.words.length >= MIN_WORDS * 0.4;
      report.push({
        slug,
        status: pass ? "pass" : "flag",
        key: `${melody.key.root} ${melody.key.mode}`,
        keyConf: melody.key.conf,
        pitched: melody.words.length,
        total: row.lyrics_synced.words.length,
        coverage: +coverage.toFixed(2),
        diatonic: +dia.toFixed(2),
      });
      if (PUBLISH && pass) {
        publishR2(melodyPath, `planets/${slug}/melody.json`);
        report[report.length - 1].published = true;
      }
    } catch (e) {
      report.push({ slug, status: "error", err: String(e).slice(0, 120) });
    }
  }

  // summary
  const pad = (s, n) => String(s ?? "").padEnd(n);
  log(`\n${pad("slug", 44)}${pad("status", 8)}${pad("key", 10)}${pad("pitched", 10)}${pad("cover", 7)}${pad("diatonic", 9)}pub`);
  for (const r of report.sort((a, b) => (b.diatonic ?? -1) - (a.diatonic ?? -1))) {
    log(`${pad(r.slug, 44)}${pad(r.status, 8)}${pad(r.key, 10)}${pad(r.pitched != null ? `${r.pitched}/${r.total}` : "", 10)}${pad(r.coverage ?? "", 7)}${pad(r.diatonic ?? "", 9)}${r.published ? "✓" : ""}`);
  }
  const passN = report.filter((r) => r.status === "pass").length;
  log(`\n${passN} pass · ${report.filter((r) => r.status === "flag").length} flagged · ${report.filter((r) => r.status === "error" || r.status === "no-lead").length} failed`);
  fs.writeFileSync(path.join(OUT, "melody-report.json"), JSON.stringify(report, null, 2));
  log(`report → scripts/stem-analysis/out/melody-report.json`);
}

main();
