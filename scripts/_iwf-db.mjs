#!/usr/bin/env node
// Scratch Supabase helper for the i-won-t-be-your-fire 45s cut.
// usage: node db.mjs get <col>          -> prints JSON of that column
//        node db.mjs words <from> <to>  -> prints lyrics_synced words in window
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const REPO = "/home/xsyprime/Hermes/x1c7.com";
const env = Object.fromEntries(
  readFileSync(`${REPO}/.env`, "utf8").split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
const ID = "i-won-t-be-your-fire";

const [cmd, a, b] = process.argv.slice(2);
const { data, error } = await db.from("tracks").select("*").eq("id", ID).single();
if (error) { console.error(error); process.exit(1); }

if (cmd === "get") {
  console.log(JSON.stringify(data[a], null, 1));
} else if (cmd === "words") {
  const from = parseFloat(a), to = parseFloat(b);
  const w = (data.lyrics_synced?.words || []).filter((x) => x.t >= from && x.t <= to);
  console.log(`source=${data.lyrics_synced?.source} total=${data.lyrics_synced?.words?.length}`);
  console.log(w.map((x) => `${x.t.toFixed(2)} ${x.w}`).join("\n"));
} else if (cmd === "dump") {
  writeFileSync(a, JSON.stringify(data, null, 1));
  console.error(`wrote ${a}`);
} else {
  console.log("cols:", Object.keys(data).join(", "));
}
