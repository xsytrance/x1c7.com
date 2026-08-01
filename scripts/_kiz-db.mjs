#!/usr/bin/env node
// Scratch Supabase helper for the Kizuna Sato "Hajimemashite" debut cut.
//   node scripts/_kiz-db.mjs shape <track>        -> lyrics_synced/planet shape of an existing song
//   node scripts/_kiz-db.mjs get <track> <col>    -> print a column
//   node scripts/_kiz-db.mjs cols <track>         -> list columns
//   node scripts/_kiz-db.mjs upsert <file.json>   -> upsert a tracks row from a JSON file
//   node scripts/_kiz-db.mjs patch <track> <file.json> -> patch given columns
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const REPO = "/home/xsyprime/Hermes/x1c7.com";
const env = Object.fromEntries(
  readFileSync(`${REPO}/.env`, "utf8").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);

const [cmd, a, b] = process.argv.slice(2);

if (cmd === "shape") {
  const { data, error } = await db.from("tracks").select("*").eq("id", a).single();
  if (error) { console.error(error); process.exit(1); }
  console.log("COLUMNS:", Object.keys(data).join(", "));
  const ls = data.lyrics_synced ?? {};
  console.log("\nlyrics_synced keys:", Object.keys(ls).join(", "));
  console.log("source:", ls.source, "n words:", ls.words?.length);
  console.log("first 5 words:", JSON.stringify((ls.words ?? []).slice(0, 5)));
  const p = data.planet ?? {};
  console.log("\nplanet keys:", Object.keys(p).join(", "));
  for (const k of Object.keys(p)) {
    const v = p[k];
    console.log(`  ${k}:`, Array.isArray(v) ? `[${v.length}]` : typeof v === "object" && v ? Object.keys(v).join(",") : JSON.stringify(v)?.slice(0, 80));
  }
} else if (cmd === "get") {
  const { data, error } = await db.from("tracks").select(b).eq("id", a).single();
  if (error) { console.error(error); process.exit(1); }
  console.log(JSON.stringify(data[b], null, 1));
} else if (cmd === "cols") {
  const { data, error } = await db.from("tracks").select("*").eq("id", a).single();
  if (error) { console.error(error); process.exit(1); }
  for (const [k, v] of Object.entries(data)) {
    console.log(`${k.padEnd(22)} ${Array.isArray(v) ? `array[${v.length}]` : v === null ? "null" : typeof v}`);
  }
} else if (cmd === "upsert") {
  const row = JSON.parse(readFileSync(a, "utf8"));
  const { error } = await db.from("tracks").upsert(row, { onConflict: "id" });
  if (error) { console.error(error); process.exit(1); }
  console.log("upserted", row.id);
} else if (cmd === "patch") {
  const patch = JSON.parse(readFileSync(b, "utf8"));
  const { error } = await db.from("tracks").update(patch).eq("id", a);
  if (error) { console.error(error); process.exit(1); }
  console.log("patched", a, Object.keys(patch).join(","));
} else {
  console.error("unknown cmd"); process.exit(2);
}
