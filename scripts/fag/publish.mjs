#!/usr/bin/env node
// FORGED ABOVE GOLD — push the non-scene assets to R2 and byte-verify the edge.
// (the 22 scene plates go through scripts/clip/publish-scenes.mjs --map picks.json)
//
//   node scripts/fag/publish.mjs
//
// Uploads:
//   planets/<slug>/stems/stems.json   <- senses.json, drives beat/kick/riser motion
//   planets/<slug>/cover.png          <- the single artwork
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const SLUG = "forged-above-gold-fire-cycle";
const PROF = join(REPO, "scripts/song-analysis/profiles", SLUG);

const env = Object.fromEntries(readFileSync(join(REPO, ".env"), "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#"))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));

const rcloneEnv = {
  ...process.env,
  RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: env.ACCESS_KEY_ID,
  RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: env.SECRET_ACCESS_KEY,
  RCLONE_CONFIG_R2_ENDPOINT: env.ENDPOINT,
};

const JOBS = [
  [join(PROF, "senses.json"), `planets/${SLUG}/stems/stems.json`],
  [join(REPO, "assets/art/forgedabovegold.png"), `planets/${SLUG}/cover.png`],
];

let bad = 0;
for (const [src, remote] of JOBS) {
  execFileSync("rclone", ["copyto", src, `R2:${env.BUCKET}/${remote}`,
    "--s3-no-check-bucket", "--no-traverse"], { env: rcloneEnv, stdio: ["ignore", "ignore", "inherit"] });
  const local = statSync(src).size;
  const res = await fetch(`${PUBLIC}/${remote}?cb=${Date.now()}`);
  const edge = (await res.arrayBuffer()).byteLength;
  const ok = local === edge;
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${remote}  local=${local} edge=${edge}`);
}
if (bad) { console.error(`${bad} asset(s) not verified at the edge`); process.exit(1); }
console.log("✦ stems + cover live at the edge");
