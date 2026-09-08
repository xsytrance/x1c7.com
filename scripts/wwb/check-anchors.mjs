#!/usr/bin/env node
// Validate a word->plate anchor map against the real word timings.
// assets.keywords fires on EVERY occurrence of a word, so a keyword is only
// safe if all of its firings — and its neighbours' — stay >=1s apart (§4).
import { readFileSync } from "node:fs";
const words = JSON.parse(readFileSync("scripts/wwb/words.json", "utf8"));
const MAP = JSON.parse(readFileSync(process.argv[2], "utf8"));

const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const fires = [];
for (const { t, w } of words) {
  const k = Object.keys(MAP).find((k) => norm(k) === norm(w));
  if (k) fires.push({ t, w, key: k, plate: MAP[k] });
}
fires.sort((a, b) => a.t - b.t);
console.log(`${fires.length} firings from ${Object.keys(MAP).length} keywords\n`);
let bad = 0;
for (let i = 0; i < fires.length; i++) {
  const f = fires[i], gap = i ? +(f.t - fires[i - 1].t).toFixed(2) : null;
  const same = i && fires[i - 1].plate === f.plate;
  // Same-url back-to-back hits never cut, so they are exempt from the 1s rule.
  const viol = gap !== null && gap < 1 && !same;
  if (viol) bad++;
  console.log(`${f.t.toFixed(3)}  ${(f.w).padEnd(12)} -> ${f.plate.padEnd(9)} gap=${gap ?? "-"}${viol ? "   <-- TOO CLOSE" : same && gap < 1 ? "  (same plate, ok)" : ""}`);
}
console.log(bad ? `\n${bad} VIOLATION(S)` : "\nall anchors >=1s apart (or same-plate)");
