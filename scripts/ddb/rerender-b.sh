#!/usr/bin/env bash
# Re-render part B only (the `stay` pool fix) and rebuild the splice.
# A and C are unaffected — neither contains a `stay` hit.
set -euo pipefail
cd /home/xsyprime/Hermes/x1c7.com/.claude/worktrees/days-drift-by-cut
AUDIO=scripts/song-analysis/profiles/days-drift-by-cut/release.mp3

node scripts/perf/render-cut.mjs --vertical --track days-drift-by-cut \
  --from 154.111 --to 177.656 --base http://localhost:3218 --audio "$AUDIO" \
  --out out/part-b.mp4

node scripts/clip/merge-cuts.mjs --a out/part-a-vertical.mp4 --b out/part-b-vertical.mp4 \
  --out out/part-ab.mp4 --transition fadeblack --dur 0.6
node scripts/clip/merge-cuts.mjs --a out/part-ab.mp4 --b out/part-c-vertical.mp4 \
  --out out/days-drift-by-60s-vertical.mp4 --transition fadeblack --dur 0.6

ffprobe -v error -show_entries format=duration -of csv=p=0 out/days-drift-by-60s-vertical.mp4
