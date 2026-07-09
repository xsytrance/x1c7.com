#!/usr/bin/env node
// APPLY DYNAMIC+ — ships every cached choreography (profiles/<id>/dynamic-plus.json)
// into tracks.planet.dynamicPlus. Only touches rows that have a planet.
// Idempotent: re-applying just overwrites the same choreography.
//
//   node scripts/song-analysis/apply-dynamic-plus.mjs [--only slug,slug] [--dry]

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const PROFILES = join(HERE, "profiles");

const env = Object.fromEntries(readFileSync(join(REPO, ".env"), "utf8").split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
if (!env.SUPABASE_SERVICE_ROLE_KEY) { console.error("no SUPABASE_SERVICE_ROLE_KEY in .env"); process.exit(1); }
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;

let applied = 0, skipped = 0;
for (const id of readdirSync(PROFILES)) {
  if (only && !only.has(id)) continue;
  const cache = join(PROFILES, id, "dynamic-plus.json");
  if (!existsSync(cache)) continue;
  const plan = JSON.parse(readFileSync(cache, "utf8"));
  const { data: row, error } = await db.from("tracks").select("id, planet").eq("id", id).maybeSingle();
  if (error || !row?.planet) { skipped++; console.error(`— ${id}: ${error?.message ?? "no planet"}`); continue; }
  if (DRY) { console.error(`(dry) ${id}: ${plan.acts?.length ?? 0} acts, ${Object.keys(plan.words ?? {}).length} words`); continue; }
  const { error: e2 } = await db.from("tracks").update({ planet: { ...row.planet, dynamicPlus: plan } }).eq("id", id);
  if (e2) { console.error(`✘ ${id}: ${e2.message}`); continue; }
  applied++;
  console.error(`⚡ ${id}: ${(plan.acts ?? []).map((a) => a.reactor ?? a.stemSpot?.label).join(" · ") || "words only"}`);
}
console.error(`\nDYNAMIC+ live on ${applied} tracks${skipped ? ` · skipped ${skipped}` : ""}`);
