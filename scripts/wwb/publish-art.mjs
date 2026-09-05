#!/usr/bin/env node
// Publish chosen lacquer plates: png -> webp q90 -> public/planets/<slug>/.
// cwebp is not installed on this box; ffmpeg's libwebp is what we have (§3).
//   node scripts/wwb/publish-art.mjs picks.json
import { readFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const SLUG = "warm-without-burning";
const OUT = `public/planets/${SLUG}`;
mkdirSync(OUT, { recursive: true });
const picks = JSON.parse(readFileSync(process.argv[2] ?? "scripts/wwb/picks.json", "utf8"));

let n = 0;
for (const [name, cand] of Object.entries(picks)) {
  const src = join("scripts/song-art/wwb-out", `${cand}.png`);
  if (!existsSync(src)) throw new Error(`missing candidate ${src}`);
  const dest = join(OUT, `scene-${name}.webp`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-c:v", "libwebp", "-quality", "90", dest]);
  const { width, height } = probe(dest);
  if (width >= height) throw new Error(`${dest} is LANDSCAPE (${width}x${height}) — §17, portrait only`);
  console.log(`${name.padEnd(9)} <- ${cand.padEnd(18)} ${width}x${height} ${(statSync(dest).size / 1024).toFixed(0)}KB`);
  n++;
}
function probe(f) {
  const o = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height", "-of", "csv=p=0", f]).toString().trim().split(",");
  return { width: +o[0], height: +o[1] };
}
console.log(`published ${n} plates to ${OUT}`);
