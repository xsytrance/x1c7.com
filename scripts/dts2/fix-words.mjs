// Rebuild the line-dumped word times inside the debut-cut window.
//
// §2 of the playbook: where the LCS aligner collapses a whole sung line onto
// one stamp, the repair is to take the line's true start/end from the whisper
// transcript's segment boundaries and distribute the words evenly inside.
//
// Six lines in 233–302 were dumped. The worst crammed "someday We gon learn a
// little something We gon" into 80ms, and "new game to play This summer" into
// 40ms — six words across TWO different lyric lines sharing an instant. In
// phrase mode that makes the highlight teleport; the words also stop matching
// the LRC line breaks that keep 9:16 text inside the frame.
//
// Each entry: the sung words, and the [start, end] the transcript heard them
// in. Words are laid out evenly across the span with a small tail margin so
// the last word does not butt against the next line's first.
import fs from "node:fs";
import { db } from "./_db.mjs";

const PROFILE = "/home/xsyprime/Hermes/x1c7.com/scripts/song-analysis/profiles/different-this-summer";

// [first word index anchor text, words, segStart, segEnd]  — spans come from
// transcript.json segment boundaries, read out loud against official-lyrics.
const SPEC = [
  { at: 254.7,   words: ["Got", "a", "brand", "new", "game", "to", "play"], start: 254.70, end: 256.20 },
  { at: 255.982, words: ["This", "summer", "gon", "be", "different"],       start: 256.34, end: 257.32 },
  { at: 257.29,  words: ["No", "more", "waiting", "on", "someday"],         start: 257.60, end: 259.98 },
  { at: 260.689, words: ["We", "gon", "learn", "a", "little", "something"], start: 260.42, end: 262.05 },
  { at: 260.749, words: ["We", "gon"],                                      start: 262.20, end: 262.60 },
  { at: 263.349, words: ["Pour", "it", "up"],                               start: 264.58, end: 265.00 },
  { at: 265.102, words: ["let", "it", "breathe"],                           start: 265.46, end: 265.95 },
  // the title stutter: three "different"s were crammed into 40ms AND collided
  // with the next chorus line's "This" at 277.02. Spread them across the gap
  // so the chop FX lands three separate hits instead of one smear.
  { at: 276.991, words: ["Different", "different", "different"],            start: 275.90, end: 276.86 },
];

const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");

function repair(words) {
  const out = words.map((w) => ({ ...w }));
  let fixed = 0;
  for (const spec of SPEC) {
    // find the run starting at the anchor time whose text matches the spec
    const i = out.findIndex((w) => Math.abs(w.t - spec.at) < 0.02 && norm(w.w) === norm(spec.words[0]));
    if (i < 0) { console.log(`  !! anchor not found: ${spec.at} ${spec.words[0]}`); continue; }
    const run = out.slice(i, i + spec.words.length);
    if (run.length !== spec.words.length || !run.every((w, k) => norm(w.w) === norm(spec.words[k]))) {
      console.log(`  !! text mismatch at ${spec.at}: got ${run.map((w) => w.w).join(" ")}`);
      continue;
    }
    const n = spec.words.length;
    const step = (spec.end - spec.start) / Math.max(1, n - 1 + 0.35); // tail margin
    run.forEach((w, k) => { w.t = +(spec.start + step * k).toFixed(3); fixed++; });
  }
  out.sort((a, b) => a.t - b.t);
  return { out, fixed };
}

const { data, error } = await db.from("tracks").select("lyrics_synced").eq("id", "different-this-summer").single();
if (error) throw error;
const before = data.lyrics_synced.words;
const { out, fixed } = repair(before);

console.log("\nREPAIRED WINDOW 253–267:");
for (const w of out.filter((w) => w.t >= 253 && w.t <= 267)) console.log(`  ${w.t.toFixed(3)}  ${w.w}`);

// prove no cluster survives in the whole cut window
const win = out.filter((w) => w.t >= 232 && w.t <= 303);
const bad = [];
for (let i = 1; i < win.length; i++) if (win[i].t - win[i - 1].t < 0.05) bad.push(`${win[i - 1].w}/${win[i].w}@${win[i].t}`);
console.log(`\n${fixed} word times rewritten; remaining <50ms pairs in window: ${bad.length}`);
if (bad.length) console.log("  " + bad.join("  "));

if (process.argv.includes("--write")) {
  fs.writeFileSync(`${PROFILE}/pre-refix-backup/lyrics-synced-before-debut-cut.json`, JSON.stringify(data.lyrics_synced));
  const next = { ...data.lyrics_synced, words: out, refinedAt: new Date().toISOString() };
  const { error: e2 } = await db.from("tracks").update({ lyrics_synced: next }).eq("id", "different-this-summer");
  if (e2) throw e2;
  // mirror into the profile so the next cut starts from the corrected data
  const al = JSON.parse(fs.readFileSync(`${PROFILE}/aligned.json`, "utf8"));
  fs.writeFileSync(`${PROFILE}/pre-refix-backup/aligned-before-debut-cut.json`, JSON.stringify(al));
  al.words = out;
  fs.writeFileSync(`${PROFILE}/aligned.json`, JSON.stringify(al, null, 1));
  console.log("WROTE to DB + mirrored into aligned.json (backups in pre-refix-backup/)");
} else {
  console.log("dry run — pass --write to apply");
}
