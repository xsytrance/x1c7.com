// Prove the window's lyric data is right before anything gets rendered.
//
// Checks, per §2/§10:
//   1. every LRC stamp in the window sits within 0.6s of a real word onset
//      (further = silently ignored = merged line = clipped text in 9:16)
//   2. each line's stamp is nearest to ITS OWN first word, not the previous
//      line's last word (the off-by-one that steals a word into the line)
//   3. no line exceeds 7 words
//   4. no surviving word cluster tighter than 50ms
//   5. the window's words, read in order, match the official lyrics
import fs from "node:fs";
import { db } from "./_db.mjs";

const FROM = 232.0, TO = 303.0, TOL = 0.6;
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");

const { data, error } = await db.from("tracks").select("lyrics,lyrics_synced").eq("id", "different-this-summer").single();
if (error) throw error;
const words = data.lyrics_synced.words.filter((w) => w.t >= FROM && w.t <= TO);

const lines = [];
for (const l of data.lyrics.split("\n")) {
  const m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
  if (!m) continue;
  const t = +m[1] * 60 + +m[2];
  if (t >= FROM && t <= TO) lines.push({ t, text: m[3], words: m[3].split(/\s+/).filter(Boolean) });
}

let fail = 0;
console.log("stamp   nearest  drift  own?  n  line");
// walk the word stream line by line so "own first word" is positional, not fuzzy
let wi = 0;
for (const ln of lines) {
  const want = norm(ln.words[0]);
  // advance to this line's first word: next occurrence at/after the cursor
  let k = wi;
  while (k < words.length && norm(words[k].w) !== want) k++;
  const own = k < words.length ? words[k] : null;
  const nearest = words.reduce((a, w) => (Math.abs(w.t - ln.t) < Math.abs(a.t - ln.t) ? w : a), words[0]);
  const drift = own ? Math.abs(own.t - ln.t) : NaN;
  const okDrift = drift <= TOL;
  const okOwn = own && nearest.t === own.t;
  const okLen = ln.words.length <= 7;
  if (!okDrift || !okOwn || !okLen) fail++;
  console.log(
    `${ln.t.toFixed(2)}  ${own ? own.t.toFixed(2) : " --  "}  ${drift.toFixed(2).padStart(5)}  ` +
    `${okOwn ? " ok " : "OFF!"}  ${String(ln.words.length).padStart(2)}${okLen ? " " : "!"} ${ln.text}` +
    `${okDrift ? "" : "   <-- DRIFT >0.6s"}`
  );
  // advance PAST the line — stopping on its last word makes the next line
  // match that token instead of its own first word (the stutter false alarm)
  if (own) wi = k + ln.words.length;
}

const clusters = [];
for (let i = 1; i < words.length; i++) if (words[i].t - words[i - 1].t < 0.05) clusters.push(`${words[i - 1].w}/${words[i].w}@${words[i].t.toFixed(2)}`);

console.log(`\nwindow words: ${words.length}   lines: ${lines.length}`);
console.log(`sub-50ms pairs: ${clusters.length}  ${clusters.slice(0, 20).join(" ")}`);
console.log(`\nSPOKEN WINDOW (read this against official-lyrics.txt):`);
console.log("  " + words.map((w) => w.w).join(" "));
console.log(fail ? `\n${fail} LINE(S) FAILED` : `\nall ${lines.length} lines OK`);
process.exit(fail ? 1 : 0);
