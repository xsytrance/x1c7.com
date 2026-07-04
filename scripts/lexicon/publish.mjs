#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LEXICON · PUBLISH — push the grown shelf to the hosted URL (Cloudflare R2).
//
// Reads S3 creds from .env (gitignored, never committed). Pair it with the
// dream loop for a grow-then-publish cron — the shelf grows and republishes
// itself, and every x1c7 + Kinetica install fetches the update on next load
// with NO redeploy. That's the "grows while you sleep, for everyone" vision.
//
//   node scripts/lexicon/dream.mjs --limit 999 && node scripts/lexicon/publish.mjs
//
// .env needs: ACCESS_KEY_ID, SECRET_ACCESS_KEY, ENDPOINT, BUCKET (+ PUBLIC_URL).
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const LEX = path.join(ROOT, "src", "data", "lexicon.json");
const ENV = path.join(ROOT, ".env");

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const e = loadEnv(ENV);
const missing = ["ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENDPOINT", "BUCKET"].filter((k) => !e[k]);
if (missing.length) {
  console.error(`✗ missing in .env: ${missing.join(", ")}`);
  console.error(`  add your R2 S3 credentials to ${path.relative(ROOT, ENV)} (gitignored).`);
  process.exit(1);
}
if (!fs.existsSync(LEX)) { console.error("✗ no lexicon.json — run harvest + dream first"); process.exit(1); }

const env = {
  ...process.env,
  RCLONE_CONFIG_R2_TYPE: "s3",
  RCLONE_CONFIG_R2_PROVIDER: "Cloudflare",
  RCLONE_CONFIG_R2_REGION: "auto",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: e.ACCESS_KEY_ID,
  RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: e.SECRET_ACCESS_KEY,
  RCLONE_CONFIG_R2_ENDPOINT: e.ENDPOINT,
};

try {
  const size = (fs.statSync(LEX).size / 1024).toFixed(0);
  console.log(`↑ publishing lexicon.json (${size} KB) → ${e.BUCKET}`);
  execFileSync("rclone", ["copyto", LEX, `R2:${e.BUCKET}/lexicon.json`, "--s3-no-check-bucket", "--no-traverse"], { env, stdio: "inherit" });
  const url = (e.PUBLIC_URL || "").replace(/\/$/, "") + "/lexicon.json";
  console.log(`✦ published → ${url}`);
  console.log(`  every x1c7 + Kinetica install now fetches this shelf on next load — no redeploy.`);
} catch (err) {
  console.error("✗ upload failed:", err.message);
  process.exit(1);
}
