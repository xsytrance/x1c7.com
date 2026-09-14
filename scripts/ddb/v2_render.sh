#!/usr/bin/env bash
# Render v2's three windows and splice them. --vertical only, --audio explicit.
set -euo pipefail
cd /home/xsyprime/Hermes/x1c7.com/.claude/worktrees/days-drift-by-cut
AUDIO=scripts/song-analysis/profiles/days-drift-by-cut-v2/release.mp3
BASE=http://localhost:3218
mkdir -p out

render() {
  echo "=== $1  $2 -> $3 ==="
  node scripts/perf/render-cut.mjs --vertical --track days-drift-by-cut-v2 \
    --from "$2" --to "$3" --base "$BASE" --audio "$AUDIO" --out "out/$1.mp4"
}

render v2-w1 67.524 92.415
render v2-w2 110.829 135.883
render v2-w3 182.741 193.492

echo "=== splice W1+W2 ==="
node scripts/clip/merge-cuts.mjs --a out/v2-w1-vertical.mp4 --b out/v2-w2-vertical.mp4 \
  --out out/v2-w12.mp4 --transition fadeblack --dur 0.6
echo "=== splice W12+W3 ==="
node scripts/clip/merge-cuts.mjs --a out/v2-w12.mp4 --b out/v2-w3-vertical.mp4 \
  --out out/days-drift-by-v2-vertical.mp4 --transition fadeblack --dur 0.6

ffprobe -v error -show_entries format=duration -of csv=p=0 out/days-drift-by-v2-vertical.mp4
