#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CURATOR · PRUNE LIGHT — reclaim the shelf from featherweight words.
//
// Owner decision (2026-07-14): light-tier words don't just stop earning new
// paint — their existing images come DOWN. This deletes light words' images
// from R2 and clears their sense.images, journaling every URL first to
// prune-journal.jsonl so the act is reversible (the Atelier can always
// repaint; the journal proves what hung where).
//
//   node scripts/curator/prune-light.mjs           # dry-run: list the cull
//   node scripts/curator/prune-light.mjs --apply   # delete + journal + republish
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const LEX = path.join(ROOT, "src", "data", "lexicon.json");
const JOURNAL = path.join(__dirname, "prune-journal.jsonl");
const APPLY = process.argv.includes("--apply");

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
// .env.local wins over .env (rotated keys land there after a reinstall).
const E = { ...loadEnv(path.join(ROOT, ".env")), ...loadEnv(path.join(ROOT, ".env.local")) };
const rcloneEnv = {
  ...process.env, RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare", RCLONE_CONFIG_R2_REGION: "auto",
  RCLONE_CONFIG_R2_ACCESS_KEY_ID: E.ACCESS_KEY_ID, RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: E.SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: E.ENDPOINT,
};
const RCLONE = fs.existsSync(`${process.env.HOME}/.local/bin/rclone`) ? `${process.env.HOME}/.local/bin/rclone` : "rclone";

const lex = JSON.parse(fs.readFileSync(LEX, "utf8"));
const light = Object.values(lex.entries).filter(
  (e) => e.gravity?.tier === "light" && e.senses.some((s) => (s.images ?? []).length > 0),
);
const urls = light.flatMap((e) => e.senses.flatMap((s) => s.images ?? []));
console.error(`prune-light: ${light.length} light words holding ${urls.length} images`);
console.error(light.map((e) => `${e.word}(${e.senses.reduce((n, s) => n + (s.images?.length ?? 0), 0)})`).join(" "));

if (!APPLY) { console.error("\n(dry run — pass --apply to delete from R2 + shelf; every URL is journaled first)"); process.exit(0); }
if (!["ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "ENDPOINT", "BUCKET"].every((k) => E[k])) {
  console.error("✗ missing R2 creds in .env"); process.exit(1);
}

const at = new Date().toISOString();
let deleted = 0, failed = 0;
for (const e of light) {
  const wordUrls = e.senses.flatMap((s) => s.images ?? []);
  if (!wordUrls.length) continue;
  fs.appendFileSync(JOURNAL, wordUrls.map((u) => JSON.stringify({ at, word: e.word, url: u, tier: "light", score: e.gravity.score })).join("\n") + "\n");
  try {
    execFileSync(RCLONE, ["purge", `R2:${E.BUCKET}/lexicon/${e.word}`, "--s3-no-check-bucket"], { env: rcloneEnv, stdio: "ignore" });
    for (const s of e.senses) s.images = [];
    deleted += wordUrls.length;
    console.error(`  ✕ ${e.word}: ${wordUrls.length} down`);
  } catch (err) { failed++; console.error(`  ! ${e.word}: ${err.message}`); }
}
fs.writeFileSync(LEX, JSON.stringify(lex, null, 2));
execFileSync(RCLONE, ["copyto", LEX, `R2:${E.BUCKET}/lexicon.json`, "--s3-disable-checksum", "--s3-no-check-bucket"], { env: rcloneEnv, stdio: "ignore" });
console.error(`✦ pruned ${deleted} images off ${light.length} words (${failed} failures) — journal: ${path.relative(ROOT, JOURNAL)}; shelf republished`);
