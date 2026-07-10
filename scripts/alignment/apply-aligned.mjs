#!/usr/bin/env node
// APPLY ALIGNED — the alignment plan's one new rule: OFFICIAL-ALIGNED word
// timings may REPLACE whisper timings (apply-shows only fills empty rows).
//
// Guards: only aligned.json with qa.pass applies (--include-flagged to
// override); rows already marked source:"aligned-official" are skipped
// unless --force; every replaced lyrics_synced is journaled to
// scripts/alignment/replaced-backup.jsonl BEFORE the update. LRC fills the
// lyrics column only where empty (that guard stays sacred).
//
//   node scripts/alignment/apply-aligned.mjs [--only s,s] [--dry]
//     [--include-flagged] [--force]

import { createClient } from "@supabase/supabase-js";
import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const PROFILES = join(REPO, "scripts", "song-analysis", "profiles");
const BACKUP = join(HERE, "replaced-backup.jsonl");

const env = Object.fromEntries(readFileSync(join(REPO, ".env"), "utf8").split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
if (!env.SUPABASE_SERVICE_ROLE_KEY) { console.error("no SUPABASE_SERVICE_ROLE_KEY in .env"); process.exit(1); }
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const FORCE = args.includes("--force");
const INCLUDE_FLAGGED = args.includes("--include-flagged");
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;

const ids = readdirSync(PROFILES).filter((d) => existsSync(join(PROFILES, d, "aligned.json")));
let applied = 0, skipped = 0, flagged = 0, missing = 0;

for (const id of ids) {
  if (only && !only.has(id)) continue;
  const a = JSON.parse(readFileSync(join(PROFILES, id, "aligned.json"), "utf8"));
  if (!a.qa?.pass && !INCLUDE_FLAGGED) { flagged++; console.error(`⚠ ${id}: QA flagged (clump ${(a.qa?.clumpRatio ?? 0) * 100}%) — skipped`); continue; }
  if (!a.words?.length) { console.error(`✘ ${id}: no words`); continue; }

  const { data: row, error } = await db.from("tracks").select("id, lyrics, lyrics_synced").eq("id", id).maybeSingle();
  if (error) { console.error(`✘ ${id}: ${error.message}`); continue; }
  if (!row) { missing++; console.error(`— ${id}: no DB row`); continue; }
  if (row.lyrics_synced?.source === "aligned-official" && !FORCE) { skipped++; continue; }

  const prevWords = row.lyrics_synced?.words?.length ?? 0;
  const patch = { lyrics_synced: { source: "aligned-official", alignedAt: new Date().toISOString().slice(0, 10), words: a.words } };
  if (!row.lyrics && a.lrc) patch.lyrics = a.lrc;

  if (DRY) { console.error(`(dry) ${id}: ${prevWords}w → ${a.words.length}w${patch.lyrics ? " + lrc" : ""}`); continue; }
  appendFileSync(BACKUP, JSON.stringify({ id, at: new Date().toISOString(), prev: row.lyrics_synced }) + "\n");
  const { error: e2 } = await db.from("tracks").update(patch).eq("id", id);
  if (e2) { console.error(`✘ ${id}: ${e2.message}`); continue; }
  applied++;
  console.error(`✔ ${id}: ${prevWords}w → ${a.words.length}w (official-aligned)${patch.lyrics ? " + lrc" : ""}`);
}
console.error(`\napplied ${applied} · QA-flagged ${flagged} · already aligned ${skipped} · no row ${missing}`);
