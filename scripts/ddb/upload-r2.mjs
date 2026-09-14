#!/usr/bin/env node
// Push the PAPER RIVER plates (and gallery.json) to R2 under
// planets/days-drift-by-cut/.
//
// This is not optional and public/planets/ is not a substitute: KineticStage
// resolves every "/planets/..." path through PLANET_BASE (lib/engineHost.ts),
// the R2 public bucket. `next dev` serves a local copy at 200 all day and the
// engine never asks for it — the symptom is a QA sheet of pure black frames
// with only text on them (playbook §20).
//
// PNG -> webp q90 via ffmpeg (cwebp isn't installed on this box). Every upload
// is edge-verified with a cache-buster before it counts.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";

const MAIN = "/home/xsyprime/Hermes/x1c7.com";
const SLUG = "days-drift-by-cut";
const SRC_PNG = "scripts/ddb/plates";
const SRC_WEBP = "scripts/ddb/webp";
const dry = process.argv.includes("--dry");

const loadEnv = (f) => Object.fromEntries(
  (existsSync(f) ? readFileSync(f, "utf8") : "").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const E = { ...loadEnv(join(MAIN, ".env")), ...loadEnv(join(MAIN, ".env.local")) };
const aws = new AwsClient({ accessKeyId: E.ACCESS_KEY_ID, secretAccessKey: E.SECRET_ACCESS_KEY, region: "auto", service: "s3" });
const base = `${E.ENDPOINT.replace(/\/$/, "")}/${E.BUCKET || "x1c7-music"}`;
const EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

mkdirSync(SRC_WEBP, { recursive: true });

// The eyes-on-approved variant per shot — edited after reviewing the contact
// sheet, never left at a blind default.
const PICKS = JSON.parse(readFileSync("scripts/ddb/picks.json", "utf8"));

const put = async (key, body, type) => {
  if (dry) { console.log(`· ${key} ${(body.length / 1024).toFixed(0)}KB (dry)`); return true; }
  const r = await aws.fetch(`${base}/${key}`, { method: "PUT", body, headers: { "content-type": type } });
  if (!r.ok) { console.log(`✗ ${key} PUT ${r.status}`); return false; }
  const got = await fetch(`${EDGE}/${key}?cb=${Date.now()}`, { cache: "no-store" });
  if (!got.ok || Number(got.headers.get("content-length")) !== body.length) {
    console.log(`✗ ${key} edge-verify failed (${got.status})`); return false;
  }
  return true;
};

console.log(`${Object.keys(PICKS).length} plates -> ${base}/planets/${SLUG}/`);
let ok = 0, bad = 0;
for (const [name, tag] of Object.entries(PICKS)) {
  const pngPath = join(SRC_PNG, `${name}${tag}.png`);
  if (!existsSync(pngPath)) { console.log(`✗ ${name} missing (${pngPath})`); bad++; continue; }
  const webpPath = join(SRC_WEBP, `${name}.webp`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", pngPath, "-quality", "90", webpPath]);
  const body = readFileSync(webpPath);
  if (await put(`planets/${SLUG}/scene-${name}.webp`, body, "image/webp")) {
    console.log(`✓ ${name} ${(body.length / 1024).toFixed(0)}KB`); ok++;
  } else bad++;
}

// gallery.json — the per-word pools that stop the repeated hook from freezing
// the screen on one plate (§3e).
const gal = readFileSync("scripts/ddb/gallery.json");
if (await put(`planets/${SLUG}/gallery.json`, gal, "application/json")) {
  console.log(`✓ gallery.json ${(gal.length / 1024).toFixed(1)}KB`); ok++;
} else bad++;

console.log(`\n${ok} uploaded, ${bad} failed`);
if (bad) process.exit(1);
