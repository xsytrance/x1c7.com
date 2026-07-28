#!/usr/bin/env node
// merge-cuts — join two rendered cuts into one video with a transition,
// with FULLY NORMALIZED timestamps (the naive xfade merge produced files
// that crash strict players — phones especially).
//
// Usage:
//   node scripts/clip/merge-cuts.mjs --a first.mp4 --b second.mp4 --out merged.mp4 \
//     [--transition fadeblack] [--dur 0.9]
//
// Normalization that must not be dropped: settb=AVTB on both inputs before
// xfade, CFR 60 output, 90kHz track timescale, explicit High@4.2 yuv420p,
// 48kHz audio. Ends with a full decode check — a merge that doesn't decode
// clean is deleted, not delivered.

import { execFileSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { resolve } from "node:path";

const argv = process.argv.slice(2);
const opt = { transition: "fadeblack", dur: "0.9" };
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[++i];
if (!opt.a || !opt.b || !opt.out) { console.error("usage: merge-cuts.mjs --a first.mp4 --b second.mp4 --out merged.mp4 [--transition fadeblack] [--dur 0.9]"); process.exit(1); }

const A = resolve(opt.a), B = resolve(opt.b), OUT = resolve(opt.out);
const dur = Number(opt.dur);
const lenA = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", A]).toString().trim());
const offset = (lenA - dur).toFixed(3);

execFileSync("ffmpeg", ["-y", "-v", "error", "-i", A, "-i", B,
  "-filter_complex",
  `[0:v]fps=60,format=yuv420p,settb=AVTB[v0];[1:v]fps=60,format=yuv420p,settb=AVTB[v1];` +
  `[v0][v1]xfade=transition=${opt.transition}:duration=${dur}:offset=${offset}[v];` +
  `[0:a]aresample=48000[a0];[1:a]aresample=48000[a1];[a0][a1]acrossfade=d=${dur}:c1=tri:c2=tri[a]`,
  "-map", "[v]", "-map", "[a]",
  "-r", "60", "-video_track_timescale", "90000",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-level:v", "4.2", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-ar", "48000", "-b:a", "192k", "-movflags", "+faststart", OUT]);

// decode check — silence on stderr = clean
const err = execFileSync("ffmpeg", ["-v", "error", "-i", OUT, "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }).toString?.() ?? "";
let decodeErr = "";
try { execFileSync("ffmpeg", ["-v", "error", "-i", OUT, "-f", "null", "-"]); } catch (e) { decodeErr = String(e.stderr || e.message); }
if (decodeErr.trim()) {
  unlinkSync(OUT);
  console.error(`✗ merged file failed decode check — deleted. Errors:\n${decodeErr}`);
  process.exit(1);
}
console.log(`✦ ${OUT}  (transition ${opt.transition} @ ${offset}s, decode clean). Encode a share with scripts/clip/share-encode.mjs.`);
