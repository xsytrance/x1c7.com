#!/usr/bin/env node
// share-encode — turn render-cut masters into deliverable share files at
// NATIVE resolution (crf 23), auto-stepping crf up if a file would exceed the
// 30 MiB chat-upload cap, then extract QA frames for the eyes-on audit.
//
// Usage:
//   node scripts/clip/share-encode.mjs --in <master.mp4> [--in <master2.mp4> …] \
//     [--qa "1.5,14,27.5"] [--qa-dir <dir>] [--max-mb 30]
//
// Output: <master>-share.mp4 next to each input (name: master minus .mp4 +
// -share.mp4), QA jpegs in --qa-dir (default: alongside), one per timestamp
// per input. ALWAYS Read the QA frames before delivering (eyes-on-output law).

import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";

const argv = process.argv.slice(2);
const inputs = [];
let qa = [], qaDir = null, maxMb = 30;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--in") inputs.push(resolve(argv[++i]));
  else if (argv[i] === "--qa") qa = argv[++i].split(",").map(Number).filter((n) => !isNaN(n));
  else if (argv[i] === "--qa-dir") qaDir = resolve(argv[++i]);
  else if (argv[i] === "--max-mb") maxMb = Number(argv[++i]);
}
if (!inputs.length) { console.error("usage: share-encode.mjs --in master.mp4 [--in …] [--qa t1,t2,…]"); process.exit(1); }

for (const input of inputs) {
  const out = input.replace(/\.mp4$/, "-share.mp4");
  let crf = 23, size = Infinity;
  for (; crf <= 30; crf += 2) {
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", input,
      "-c:v", "libx264", "-preset", "medium", "-crf", String(crf),
      "-c:a", "aac", "-b:a", crf > 25 ? "144k" : "160k", "-movflags", "+faststart", out]);
    size = statSync(out).size;
    if (size <= maxMb * 1024 * 1024) break;
    console.error(`  ${basename(out)} ${(size / 1048576).toFixed(1)}MiB > ${maxMb}MiB at crf ${crf} — stepping up`);
  }
  console.log(`✦ ${out}  (crf ${crf}, ${(size / 1048576).toFixed(1)} MiB)`);
  const dir = qaDir ?? dirname(input);
  for (const t of qa) {
    const frame = join(dir, `qa-${basename(input, ".mp4")}-${t}.jpg`);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", String(t), "-i", out, "-frames:v", "1", frame]);
    console.log(`  📸 ${frame}`);
  }
}
