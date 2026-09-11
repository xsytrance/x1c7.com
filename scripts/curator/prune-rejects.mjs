#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CURATOR · PRUNE REJECTS — corpus-wide, from the cached vision readings.
//
// show-audit.mjs prunes per-song, and only touches images that appear in an
// audited show's reel. This does the same job across the WHOLE shelf, using the
// readings exxo has already cached, so an image nobody has built a reel from is
// still judged. Same floor, same journal, same regen queue.
//
// For every image below the floor (quality < 0.45 OR wordMatch < 0.35):
//   1. journal it to prune-journal.jsonl (word, sense, url, scores, caption)
//   2. strip its URL out of the sense's images[] in lexicon.json
//   3. delete the object from R2
//   4. add its word to .audit-regen.txt so the painter repaints it that night
//
//   node scripts/curator/prune-rejects.mjs --dry          # show what would go
//   node scripts/curator/prune-rejects.mjs --apply        # do it
//   node scripts/curator/prune-rejects.mjs --apply --spare-file spared.txt
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const LEX = path.join(ROOT, "src", "data", "lexicon.json");
const INDEX = path.join(__dirname, "vision-index.json");
const JOURNAL = path.join(__dirname, "prune-journal.jsonl");
const REGEN = path.join(__dirname, ".audit-regen.txt");

const Q_FLOOR = 0.45, M_FLOOR = 0.35;

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
  return a;
}, []));
const APPLY = !!args.apply;

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const E = { ...loadEnv(path.join(ROOT, ".env")), ...loadEnv(path.join(ROOT, ".env.local")) };
const PUB = (E.PUBLIC_URL || "").replace(/\/$/, "");
const rcloneEnv = {
  ...process.env, RCLONE_CONFIG_R2_TYPE: "s3", RCLONE_CONFIG_R2_PROVIDER: "Cloudflare",
  RCLONE_CONFIG_R2_REGION: "auto", RCLONE_CONFIG_R2_ACCESS_KEY_ID: E.ACCESS_KEY_ID,
  RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: E.SECRET_ACCESS_KEY, RCLONE_CONFIG_R2_ENDPOINT: E.ENDPOINT,
};

const spared = new Set(
  args["spare-file"] && fs.existsSync(args["spare-file"])
    ? fs.readFileSync(args["spare-file"], "utf8").split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    : []
);

const index = JSON.parse(fs.readFileSync(INDEX, "utf8"));
const lex = JSON.parse(fs.readFileSync(LEX, "utf8"));

// ── decide ────────────────────────────────────────────────────────────────
const doomed = [];
for (const [key, v] of Object.entries(index.images)) {
  const r = v.reading || {};
  const q = r.quality, m = r.wordMatch;
  if (typeof q !== "number" || typeof m !== "number") continue;
  if (q >= Q_FLOOR && m >= M_FLOOR) continue;
  if (spared.has(key)) continue;
  doomed.push({ key, url: `${PUB}/${key}`, word: v.word, sense: v.sense, recipe: v.recipe,
                quality: q, wordMatch: m, caption: r.caption || "" });
}

// Only prune what the shelf actually still references — an image already gone
// must not be journalled twice or counted as work done.
const held = [], orphan = [];
for (const d of doomed) {
  const entry = lex.entries[d.word];
  const sense = entry?.senses?.[d.sense];
  (sense && Array.isArray(sense.images) && sense.images.includes(d.url) ? held : orphan).push(d);
}

console.log(`floor: quality < ${Q_FLOOR} or wordMatch < ${M_FLOOR}`);
console.log(`scored readings   : ${Object.keys(index.images).length}`);
console.log(`below the floor   : ${doomed.length + spared.size} (${spared.size} spared)`);
console.log(`still on the shelf: ${held.length}   ← these get pruned`);
console.log(`already gone      : ${orphan.length}`);
console.log(`words affected    : ${new Set(held.map(d => d.word)).size}`);

if (!APPLY) {
  console.log(`\n(dry run — nothing changed. Add --apply to prune.)`);
  console.log(`\nfirst 10 that would go:`);
  for (const d of held.slice(0, 10)) console.log(`  ${d.word.padEnd(14)} q=${d.quality} m=${d.wordMatch}  ${d.caption.slice(0, 62)}`);
  process.exit(0);
}

// ── apply ─────────────────────────────────────────────────────────────────
// Journal FIRST. If anything later fails, the record of what was removed — and
// the URL to re-fetch it from a backup — already exists on disk.
const stamp = new Date().toISOString();
fs.appendFileSync(JOURNAL, held.map(d => JSON.stringify({ ...d, prunedAt: stamp, by: "prune-rejects" })).join("\n") + "\n");
console.log(`\n✦ journalled ${held.length} to ${path.basename(JOURNAL)}`);

for (const d of held) {
  const sense = lex.entries[d.word].senses[d.sense];
  sense.images = sense.images.filter(u => u !== d.url);
}
lex.stats.images = Object.values(lex.entries)
  .reduce((n, e) => n + e.senses.reduce((k, s) => k + (s.images?.length || 0), 0), 0);
const tmp = `${LEX}.tmp-${process.pid}`;
fs.writeFileSync(tmp, JSON.stringify(lex, null, 2));
fs.renameSync(tmp, LEX);
console.log(`✦ shelf updated: ${lex.stats.images} images remain`);

const words = [...new Set(held.map(d => d.word))].sort();
const existing = fs.existsSync(REGEN) ? fs.readFileSync(REGEN, "utf8").split("\n").filter(Boolean) : [];
fs.writeFileSync(REGEN, [...new Set([...existing, ...words])].join("\n") + "\n");
console.log(`✦ regen queue: ${words.length} words queued in ${path.basename(REGEN)}`);

let gone = 0, failed = 0;
for (const d of held) {
  try {
    execFileSync("rclone", ["deletefile", `R2:${E.BUCKET}/${d.key}`, "--s3-no-check-bucket"],
                 { env: rcloneEnv, stdio: "ignore" });
    gone++;
  } catch { failed++; }
  if ((gone + failed) % 100 === 0) console.log(`  deleted ${gone}/${held.length} (${failed} failed)`);
}
console.log(`✦ R2: ${gone} deleted, ${failed} failed`);
console.log(`\nNext: publish the shelf so every install drops these too —`);
console.log(`  node scripts/lexicon/publish.mjs`);
