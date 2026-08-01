// Defuse the MAX_HOLD heuristic for two words in the debut-cut window.
//
// KineticStage.tsx:325 —
//     if (out[i+1].t - out[i].t > 2.5) {
//       const lineDumped = i > 0 && out[i].t - out[i-1].t < 0.15;
//       if (lineDumped) out[i].t = out[i+1].t - 0.45;
//     }
//
// The rule is right: a line-dumped tail word really does belong up against the
// next line. But it fires on ANY word that inherited a dumped stamp and happens
// to sit before a long rest — and this window has two:
//
//   "light" 283.735 -> 286.340   (2.61s late)  — a SCENE ANCHOR. The club
//                                 painting was arriving two and a half seconds
//                                 after the word that summons it.
//   "Ooh"   287.646 -> 290.369   (2.72s late)  — dragged "right" into the next
//                                 lyric line, which is why the stills read
//                                 "RIGHT OOH NO MORE LOSING TIME".
//
// §6 says to suspect this class of heuristic FIRST on word-synced lyrics, and
// the fix belongs in the DATA: give each word its own honest stamp (>0.15s off
// its predecessor) and the gate stops matching. Times below keep each word at
// its true onset — they only stop three syllables sharing one instant.
//
// Run BEFORE fix-lrc.mjs: moving a word moves where its line must start.
import fs from "node:fs";
import { db } from "./_db.mjs";

const PROFILE = "/home/xsyprime/Hermes/x1c7.com/scripts/song-analysis/profiles/different-this-summer";
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");

// [anchor time, word, new time]
const SPEC = [
  [283.458, "on", 283.30],
  [283.725, "the", 283.55],
  [283.735, "light", 283.90],   // "…waiting on the LIGHT" — held, own stamp now
  [287.626, "it", 287.45],
  [287.636, "right", 287.72],
  [287.646, "Ooh", 288.20],     // the held Ooh that opens the next line
];

const { data, error } = await db.from("tracks").select("lyrics_synced").eq("id", "different-this-summer").single();
if (error) throw error;
const out = data.lyrics_synced.words.map((w) => ({ ...w }));

let fixed = 0;
for (const [at, word, nt] of SPEC) {
  const i = out.findIndex((w) => Math.abs(w.t - at) < 0.02 && norm(w.w) === norm(word));
  if (i < 0) { console.log(`  !! not found: ${word}@${at}`); continue; }
  out[i].t = nt;
  fixed++;
}
out.sort((a, b) => a.t - b.t);

// re-run the engine's own gate over the result
const victims = [];
for (let i = 1; i < out.length - 1; i++) {
  if (out[i].t < 233.1 || out[i].t > 303.2) continue;
  if (out[i + 1].t - out[i].t > 2.5 && out[i].t - out[i - 1].t < 0.15) {
    victims.push(`"${out[i].w}"@${out[i].t.toFixed(3)} -> ${(out[i + 1].t - 0.45).toFixed(3)}`);
  }
}

console.log(`${fixed} word times rewritten\n`);
console.log("WINDOW 279–292 after the fix:");
for (const w of out.filter((w) => w.t >= 279 && w.t <= 292)) console.log(`  ${w.t.toFixed(3)}  ${w.w}`);
console.log(`\nremaining MAX_HOLD victims in window: ${victims.length}${victims.length ? "  " + victims.join("  ") : ""}`);

if (victims.length) { console.error("still snapping — do not write"); process.exit(1); }

if (process.argv.includes("--write")) {
  const bak = `${PROFILE}/pre-refix-backup/lyrics-synced-before-holds.json`;
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, JSON.stringify(data.lyrics_synced));
  const next = { ...data.lyrics_synced, words: out, refinedAt: new Date().toISOString() };
  const { error: e2 } = await db.from("tracks").update({ lyrics_synced: next }).eq("id", "different-this-summer");
  if (e2) throw e2;
  const al = JSON.parse(fs.readFileSync(`${PROFILE}/aligned.json`, "utf8"));
  al.words = out;
  fs.writeFileSync(`${PROFILE}/aligned.json`, JSON.stringify(al, null, 1));
  console.log("WROTE to DB + aligned.json");
} else {
  console.log("dry run — pass --write to apply");
}
