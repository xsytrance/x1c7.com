#!/usr/bin/env node
// REVERT DYNAMIC+ — strips tracks.planet.dynamicPlus from every track, capping
// all shows back at Phase 5. Dumps each removed plan to a backup JSONL first.
// Idempotent: rows without dynamicPlus are never touched.
//
//   node scripts/song-analysis/revert-dynamic-plus.mjs [--dry]

import { createClient } from "@supabase/supabase-js";
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");

const env = Object.fromEntries(readFileSync(join(REPO, ".env"), "utf8").split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
if (!env.SUPABASE_SERVICE_ROLE_KEY) { console.error("no SUPABASE_SERVICE_ROLE_KEY in .env"); process.exit(1); }
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);

const DRY = process.argv.includes("--dry");
const BACKUP = join(HERE, "dynamic-plus-backup-2026-07-10.jsonl");

const { data: rows, error } = await db.from("tracks").select("id, planet").not("planet->dynamicPlus", "is", null);
if (error) { console.error(error.message); process.exit(1); }

let reverted = 0;
for (const row of rows ?? []) {
  const { dynamicPlus, ...planet } = row.planet;
  if (DRY) { console.error(`(dry) ${row.id}: ${dynamicPlus.acts?.length ?? 0} acts, ${Object.keys(dynamicPlus.words ?? {}).length} words`); continue; }
  appendFileSync(BACKUP, JSON.stringify({ id: row.id, dynamicPlus }) + "\n");
  const { error: e2 } = await db.from("tracks").update({ planet }).eq("id", row.id);
  if (e2) { console.error(`✘ ${row.id}: ${e2.message}`); continue; }
  reverted++;
  console.error(`🌙 ${row.id} → Phase 5`);
}
console.error(DRY ? `\n(dry) would revert ${rows?.length ?? 0} tracks` : `\nreverted ${reverted} tracks · backup → ${BACKUP}`);
