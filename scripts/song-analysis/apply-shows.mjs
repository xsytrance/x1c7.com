#!/usr/bin/env node
// APPLY SHOWS — the direct-DB twin of publish-shows.mjs (same guards, no SQL).
// For every profiles/<id>: set lyrics_synced (only where the row has none —
// official synced lyrics are sacred), lyrics LRC (only where empty), and
// planet.analysis (only where the planet has none). Idempotent; rerun freely.
//
//   node scripts/song-analysis/apply-shows.mjs [--only slug,slug] [--dry]

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

const ids = readdirSync(PROFILES).filter((d) => existsSync(join(PROFILES, d, "transcript.json")));
let shows = 0, analyses = 0, skipped = 0, missing = 0;

for (const id of ids) {
  if (only && !only.has(id)) continue;
  const dir = join(PROFILES, id);
  const transcript = JSON.parse(readFileSync(join(dir, "transcript.json"), "utf8"));
  const words = (transcript.segments ?? []).flatMap((s) => s.words ?? [])
    .filter((w) => typeof w.t === "number" && w.text)
    .map((w) => ({ t: Math.round(w.t * 100) / 100, w: String(w.text) }));
  const pfPath = join(dir, `${id}-planet-full.json`);
  const analysis = existsSync(pfPath) ? JSON.parse(readFileSync(pfPath, "utf8")).analysis : null;
  const lrc = existsSync(join(dir, "lyrics.lrc")) ? readFileSync(join(dir, "lyrics.lrc"), "utf8") : null;

  const { data: row, error } = await db.from("tracks").select("id, lyrics, lyrics_synced, planet").eq("id", id).maybeSingle();
  if (error) { console.error(`✘ ${id}: ${error.message}`); continue; }
  if (!row) { missing++; console.error(`— ${id}: no DB row (skipped)`); continue; }

  const patch = {};
  const hasSynced = (row.lyrics_synced?.words?.length ?? 0) > 0;
  if (!hasSynced && words.length) patch.lyrics_synced = { words };
  if (!row.lyrics && lrc) patch.lyrics = lrc;
  if (analysis && !row.planet?.analysis) patch.planet = { ...(row.planet ?? {}), analysis, generatedAt: row.planet?.generatedAt ?? new Date().toISOString() };

  if (!Object.keys(patch).length) { skipped++; continue; }
  if (DRY) { console.error(`(dry) ${id}: would set ${Object.keys(patch).join("+")}`); continue; }
  const { error: e2 } = await db.from("tracks").update(patch).eq("id", id);
  if (e2) { console.error(`✘ ${id}: ${e2.message}`); continue; }
  if (patch.lyrics_synced) shows++;
  if (patch.planet) analyses++;
  console.error(`✔ ${id}: ${Object.keys(patch).join(" + ")}${patch.lyrics_synced ? ` (${words.length} words)` : ""}`);
}
console.error(`\nnew shows: ${shows} · new analyses: ${analyses} · already complete: ${skipped} · no row: ${missing}`);
