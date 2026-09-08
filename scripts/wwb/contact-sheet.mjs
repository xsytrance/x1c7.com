#!/usr/bin/env node
// Contact sheets for the eyes-on audit (§3, §18). ~500px tiles, not 250 —
// SDXL sneaks stray figures into empty worlds and they are invisible smaller.
// One sheet per scene so all four candidates sit side by side.
import { readdirSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const OUT = "scripts/song-art/wwb-out/sheets"; mkdirSync(OUT, { recursive: true });
const files = readdirSync("scripts/song-art/wwb-out").filter((f) => f.endsWith(".png"));
const byScene = {};
for (const f of files) { const n = f.split("-")[0]; (byScene[n] ??= []).push(f); }
for (const [scene, list] of Object.entries(byScene)) {
  list.sort();
  execFileSync("ffmpeg", ["-v", "error", "-y",
    ...list.flatMap((f) => ["-i", `scripts/song-art/wwb-out/${f}`]),
    "-filter_complex", `${list.map((_, i) => `[${i}:v]scale=500:-1[v${i}]`).join(";")};${list.map((_, i) => `[v${i}]`).join("")}hstack=inputs=${list.length}`,
    `${OUT}/${scene}.png`]);
  console.log(`${scene}: ${list.length} candidates -> ${OUT}/${scene}.png  [${list.map((f) => f.replace(/\.png$/, "").split("-").slice(1).join("-")).join(", ")}]`);
}
