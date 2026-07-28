import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(readFileSync(join(REPO, ".env"), "utf8").split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await db.from("tracks").select("id,title,artist,hidden,audio_url,lyrics_synced,planet");
const t = data.filter((r) => /tyler|haze|pretty|lie|neon teeth|mall rat|night shift|6th|madetobreak|damage/i.test(`${r.id} ${r.title} ${r.artist ?? ""}`));
for (const r of t) console.log(`${r.id.padEnd(34)} | ${String(r.title).padEnd(28)} | ${r.artist ?? "-"} | hidden=${r.hidden} | words=${r.lyrics_synced?.words?.length ?? 0} | planet=${r.planet ? "y" : "n"} | ${r.audio_url ? "audio" : "NO AUDIO"}`);
console.log("total tracks:", data.length);
