import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("/home/xsyprime/Hermes/x1c7.com/.env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>[l.slice(0,l.indexOf("=")).trim(), l.slice(l.indexOf("=")+1).trim().replace(/^["']|["']$/g,"")]));
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
const to = process.argv[2] === "public"
  ? { audio_url: "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/music/Maybe%20Was%20The%20Answer.mp3", hidden: false }
  : { audio_url: "/private/maybe-was-the-answer.mp3", hidden: true };
const { error } = await db.from("tracks").update(to).eq("id","maybe-was-the-answer");
if (error) { console.error(error); process.exit(1); }
console.log("set:", JSON.stringify(to));
