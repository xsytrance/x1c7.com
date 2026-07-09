#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// STEMS · PUBLISH — ship a song's separated Suno stems to the live mixer.
//
// analyze_stems.py turns the stem folder into stems.json (the engine's
// measured hearing); THIS script ships the audio itself: transcode each
// recognized stem WAV/mp3 to a lean web m4a (~3-4 MB vs ~40 MB WAV), upload
// to R2 planets/<slug>/stems/, and emit the planet.assets JSON + Supabase SQL
// that switches the live mixer on for the track.
//
//   node scripts/stem-analysis/publish-stems.mjs \
//     --stems ~/suno/oro-stems --slug oro-de-la-presion \
//     --stems-json scripts/stem-analysis/out/oro/stems.json [--bitrate 160k] [--dry]
//
// Needs: ffmpeg, rclone, and R2 creds in .env (same as lexicon/publish.mjs).
// The stems.json is uploaded too (if given) — align.lag from it becomes
// assets.stemLag, the number that keeps stem audio on the release clock.
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1]?.startsWith("--") || arr[i + 1] === undefined ? true : arr[i + 1]]);
  return a;
}, []));
const need = (k) => { if (!args[k] || args[k] === true) { console.error(`missing --${k}`); process.exit(1); } return args[k]; };
const STEMS_DIR = path.resolve(need("stems"));
const SLUG = need("slug");
const STEMS_JSON = args["stems-json"] && args["stems-json"] !== true ? path.resolve(args["stems-json"]) : null;
const BITRATE = args.bitrate && args.bitrate !== true ? args.bitrate : "160k";
const DRY = !!args.dry;
const log = (...a) => console.error(...a);

// Same filename → bucket map as analyze_stems.py: the two halves of the
// pipeline must always agree on what an instrument is called.
const PATTERNS = [
  ["lead", "lead voc"], ["back", "backing voc"], ["drums", "drum"], ["bass", "bass"],
  ["perc", "perc"], ["synth", "synth"], ["other", "other"], ["guitar", "guitar"], ["keys", "keyboard"],
  ["strings", "strings"], ["woodwinds", "woodwind"], ["brass", "brass"],
];

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

// ── 1. RECOGNIZE ────────────────────────────────────────────────────────────
const names = {};
for (const f of fs.readdirSync(STEMS_DIR).sort()) {
  const low = f.toLowerCase();
  if (!/\.(mp3|wav|flac)$/.test(low)) continue;
  for (const [key, pat] of PATTERNS) if (low.includes(pat)) names[key] = path.join(STEMS_DIR, f);
}
if (!Object.keys(names).length) { console.error(`✗ no recognizable stems in ${STEMS_DIR}`); process.exit(1); }
log(`stems: ${Object.keys(names).join(", ")}`);

// ── 2. TRANSCODE ────────────────────────────────────────────────────────────
const outDir = path.join(STEMS_DIR, "web");
fs.mkdirSync(outDir, { recursive: true });
const files = {};
for (const [key, src] of Object.entries(names)) {
  const out = path.join(outDir, `${key}.m4a`);
  if (!fs.existsSync(out)) {
    log(`▶ transcoding ${key} → m4a ${BITRATE} …`);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-vn", "-c:a", "aac", "-b:a", BITRATE, "-movflags", "+faststart", out], { stdio: ["ignore", 2, 2] });
  }
  files[key] = out;
  log(`  ${key}.m4a  ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
}

// ── 3. UPLOAD ───────────────────────────────────────────────────────────────
const e = loadEnv(path.join(ROOT, ".env"));
const missing = ["ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENDPOINT", "BUCKET"].filter((k) => !e[k]);
if (missing.length && !DRY) { console.error(`✗ missing in .env: ${missing.join(", ")}`); process.exit(1); }
const env = {
  ...process.env,
  RCLONE_CONFIG_R2_TYPE: "s3",
  RCLONE_CONFIG_R2_PROVIDER: "Cloudflare",
  RCLONE_CONFIG_R2_REGION: "auto",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: e.ACCESS_KEY_ID,
  RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: e.SECRET_ACCESS_KEY,
  RCLONE_CONFIG_R2_ENDPOINT: e.ENDPOINT,
};
const put = (local, remote) => {
  if (DRY) { log(`  (dry) ${path.basename(local)} → ${remote}`); return; }
  execFileSync("rclone", ["copyto", local, `R2:${e.BUCKET}/${remote}`, "--s3-no-check-bucket", "--no-traverse"], { env, stdio: "inherit" });
};
const base = `planets/${SLUG}/stems`;
log(`↑ uploading → ${base}/ …`);
for (const [key, local] of Object.entries(files)) put(local, `${base}/${key}.m4a`);
if (STEMS_JSON) put(STEMS_JSON, `${base}/stems.json`);

// ── 4. WIRE ─────────────────────────────────────────────────────────────────
// Absolute URLs, same convention as tracks.audio_url: the player consumes
// stemAudio directly (it never passes through the stage's PLANET_BASE
// prefixer for relative planet-art paths), and R2 serves open CORS.
const pub = (e.PUBLIC_URL || "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev").replace(/\/$/, "");
const stemAudio = Object.fromEntries(Object.keys(files).map((k) => [k, `${pub}/${base}/${k}.m4a`]));
const assets = { stemAudio };
if (STEMS_JSON) {
  assets.stems = `${pub}/${base}/stems.json`;
  const lag = JSON.parse(fs.readFileSync(STEMS_JSON, "utf8"))?.align?.lag;
  if (typeof lag === "number") assets.stemLag = lag;
}
console.log("\n— merge into the track's planet.assets (Supabase `tracks.planet`) —\n");
console.log(JSON.stringify(assets, null, 2));
console.log(`\n— or apply directly —\n`);
console.log(
  `UPDATE tracks SET planet = jsonb_set(coalesce(planet, '{}'::jsonb), '{assets}', coalesce(planet->'assets', '{}'::jsonb) || '${JSON.stringify(assets)}'::jsonb) WHERE id = '${SLUG}';`,
);
log(`\n✦ done — the live mixer lights up for "${SLUG}" once the row updates.`);
