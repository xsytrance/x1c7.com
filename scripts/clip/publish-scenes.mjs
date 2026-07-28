#!/usr/bin/env node
// publish-scenes — convert scene picks to webp, upload to R2, and BYTE-VERIFY
// each file at the public edge (upload without verification has bitten us).
//
// Usage:
//   node scripts/clip/publish-scenes.mjs --slug <track-slug> \
//     --pick brooklyn=path/to/img.png --pick steam=path/other.png …
//   node scripts/clip/publish-scenes.mjs --slug <slug> --map picks.json
//
// picks.json: { "brooklyn": "path/img.png", … }
//
// Each pick lands at R2 planets/<slug>/scene-<key>.webp — the URL shape the
// planet's assets.keywords/sections expect. Prints the SQL-ready URL for each.
// Requires .env: ACCESS_KEY_ID, SECRET_ACCESS_KEY, ENDPOINT, BUCKET, and the
// public dev URL below.

import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

const argv = process.argv.slice(2);
const picks = {};
let slug = null, mapFile = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--slug") slug = argv[++i];
  else if (argv[i] === "--map") mapFile = argv[++i];
  else if (argv[i] === "--pick") { const [k, v] = argv[++i].split("="); picks[k] = v; }
}
if (mapFile) Object.assign(picks, JSON.parse(readFileSync(resolve(mapFile), "utf8")));
if (!slug || !Object.keys(picks).length) {
  console.error("usage: publish-scenes.mjs --slug <slug> (--pick key=img.png … | --map picks.json)");
  process.exit(1);
}

const env = Object.fromEntries(readFileSync(join(REPO, ".env"), "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
for (const k of ["ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENDPOINT", "BUCKET"]) {
  if (!env[k]) { console.error(`.env missing ${k}`); process.exit(1); }
}
const rcloneEnv = {
  ...process.env,
  RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: env.ACCESS_KEY_ID,
  RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: env.SECRET_ACCESS_KEY,
  RCLONE_CONFIG_R2_ENDPOINT: env.ENDPOINT,
};

let failures = 0;
for (const [key, src] of Object.entries(picks)) {
  const webp = join(tmpdir(), `scene-${key}-${Date.now()}.webp`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", resolve(src), "-c:v", "libwebp", "-quality", "90", webp]);
  const remote = `planets/${slug}/scene-${key}.webp`;
  execFileSync("rclone", ["copyto", webp, `R2:${env.BUCKET}/${remote}`, "--s3-no-check-bucket", "--no-traverse"], { env: rcloneEnv, stdio: ["ignore", "ignore", "ignore"] });
  const local = statSync(webp).size;
  const res = await fetch(`${PUBLIC}/${remote}?cb=${Math.floor(performance.now() * 1000)}`);
  const edge = (await res.arrayBuffer()).byteLength;
  const ok = local === edge;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${key}  local=${local} edge=${edge}  →  "/planets/${slug}/scene-${key}.webp"`);
}
if (failures) { console.error(`${failures} pick(s) NOT verified at edge — re-run before rendering`); process.exit(1); }
console.log(`✦ all ${Object.keys(picks).length} scenes live at the edge. Wire them into planet.assets.keywords / .sections.`);
