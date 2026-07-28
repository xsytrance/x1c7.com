// Toggle the dynamic mode windows. The huge single-word treatment overflows a
// 1080-wide frame (stagecraft's size tier x belted delivery), so the 9:16 cut
// ships phrase-only while the 16:9 keeps the full treatment.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync("/home/xsyprime/Hermes/x1c7.com/.env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>[l.slice(0,l.indexOf("=")).trim(), l.slice(l.indexOf("=")+1).trim().replace(/^["']|["']$/g,"")]));
const db = createClient("https://kxbrjmbovjiwwcnepsfh.supabase.co", env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await db.from("tracks").select("planet").eq("id","maybe-was-the-answer").single();
const planet = data.planet;
const FULL = [
  { start: 59.4, end: 62.9, mode: "phrase" }, { start: 62.9, end: 64.00, mode: "dynamic" },
  { start: 64.00, end: 80.30, mode: "phrase" }, { start: 80.30, end: 81.05, mode: "dynamic" },
  { start: 81.05, end: 88.50, mode: "phrase" }, { start: 88.50, end: 90.00, mode: "dynamic" },
  { start: 90.00, end: 98.40, mode: "phrase" }, { start: 98.40, end: 99.90, mode: "dynamic" },
  { start: 99.90, end: 101.20, mode: "dynamic" }, { start: 101.20, end: 103.50, mode: "phrase" },
  { start: 103.50, end: 104.85, mode: "dynamic" },
];
planet.dynamicPlus.modes = process.argv[2] === "flat" ? [{ start: 59.4, end: 104.85, mode: "phrase" }] : FULL;
const { error } = await db.from("tracks").update({ planet }).eq("id","maybe-was-the-answer");
if (error) { console.error(error); process.exit(1); }
console.log("modes:", process.argv[2] === "flat" ? "phrase-only (vertical)" : `full (${FULL.length} windows)`);
