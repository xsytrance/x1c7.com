// Place the LRC stamps inside the debut-cut window so phrase mode breaks the
// lines exactly where we wrote them.
//
// The engine's rule (KineticStage.tsx:420 phraseStartIdx) is NOT "nearest word
// after the stamp" — it is nearest word EITHER SIDE:
//
//   while (words[i+1].t <= t) i++;
//   j = |words[i+1].t - t| < |words[i].t - t| ? i+1 : i;
//   if (|words[j].t - t| <= 0.6) starts.add(j);
//
// So a stamp sitting a hair closer to the PREVIOUS line's last word starts the
// line one word early and drags that word in ("play This summer gon be
// different"). Three lines here did exactly that, and "right"/"Ooh" are only
// 10ms apart — with stamps quantised to centiseconds there is exactly one
// legal value.
//
// Rather than subtract a fixed lead and hope, this simulates the engine's own
// selection over every centisecond candidate and keeps the one that resolves
// to the line's own first word, preferring a natural ~0.10s lead.
import fs from "node:fs";
import { db } from "./_db.mjs";

const FROM = 232.0, TO = 303.0;
const PREFERRED_LEAD = 0.10;
const PROFILE = "/home/xsyprime/Hermes/x1c7.com/scripts/song-analysis/profiles/different-this-summer";
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");

const { data, error } = await db.from("tracks").select("lyrics,lyrics_synced").eq("id", "different-this-summer").single();
if (error) throw error;
const words = data.lyrics_synced.words;

// the engine's own resolution of one stamp -> word index
const resolve = (t) => {
  let i = 0;
  while (i < words.length - 1 && words[i + 1].t <= t) i++;
  const j = i < words.length - 1 && Math.abs(words[i + 1].t - t) < Math.abs(words[i].t - t) ? i + 1 : i;
  return Math.abs(words[j].t - t) <= 0.6 ? j : -1;
};

const fmt = (t) => {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `[${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}]`;
};

const lines = data.lyrics.split("\n");
let cursor = 0, changed = 0;
const report = [];

const out = lines.map((line) => {
  const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
  if (!m) return line;
  const t = +m[1] * 60 + +m[2], text = m[3];
  if (t < FROM || t > TO) return line;

  const first = norm(text.split(/\s+/).filter(Boolean)[0] || "");
  // this line's own first word = next matching token at/after the cursor
  let k = cursor;
  while (k < words.length && !(norm(words[k].w) === first && words[k].t > FROM - 2)) k++;
  if (k >= words.length) { report.push([t, t, text, "NO MATCH"]); return line; }
  const own = words[k];

  // every centisecond candidate that the engine would resolve to `own`
  const cands = [];
  for (let c = Math.round((own.t - 0.6) * 100); c <= Math.round((own.t + 0.3) * 100); c++) {
    const cand = c / 100;
    if (resolve(cand) === k) cands.push(cand);
  }
  if (!cands.length) { report.push([t, t, text, "NO LEGAL STAMP"]); cursor = k + 1; return line; }
  cands.sort((a, b) => Math.abs(own.t - PREFERRED_LEAD - a) - Math.abs(own.t - PREFERRED_LEAD - b));
  const nt = cands[0];
  report.push([t, nt, text, Math.abs(nt - t) > 0.005 ? `-> ${own.w}@${own.t.toFixed(2)}` : "kept"]);
  if (Math.abs(nt - t) > 0.005) changed++;
  // advance PAST this line's words — landing on its last word lets the next
  // line (e.g. the "Different, different, different" stutter) match the
  // previous line's final token instead of its own.
  cursor = k + text.split(/\s+/).filter(Boolean).length;
  return fmt(nt) + text;
});

console.log("old      new     status");
for (const [t, nt, text, status] of report) console.log(`${t.toFixed(2)} -> ${nt.toFixed(2)}  ${status.padEnd(22)} ${text}`);
console.log(`\n${changed} stamps moved`);

if (process.argv.includes("--write")) {
  const bak = `${PROFILE}/pre-refix-backup/lyrics-lrc-before-debut-cut.txt`;
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, data.lyrics);
  const { error: e2 } = await db.from("tracks").update({ lyrics: out.join("\n") }).eq("id", "different-this-summer");
  if (e2) throw e2;
  console.log("WROTE to DB");
} else {
  console.log("dry run — pass --write to apply");
}
