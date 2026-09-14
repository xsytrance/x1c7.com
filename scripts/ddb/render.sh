#!/usr/bin/env bash
# Render the three windows, then splice them into the deliverable.
#
# --audio is passed explicitly (playbook §21): render-cut.mjs resolves
# release.mp3 under the repo it runs from, and a worktree is not the main
# checkout. --vertical only, never --both (owner law 2026-08-01).
set -euo pipefail
cd /home/xsyprime/Hermes/x1c7.com/.claude/worktrees/days-drift-by-cut
AUDIO=scripts/song-analysis/profiles/days-drift-by-cut/release.mp3
BASE=http://localhost:3218
mkdir -p out

render() {  # name from to
  echo "=== $1  $2 -> $3 ==="
  node scripts/perf/render-cut.mjs --vertical --track days-drift-by-cut \
    --from "$2" --to "$3" --base "$BASE" --audio "$AUDIO" --out "out/$1.mp4"
}

render part-a 110.829 133.840
render part-b 154.111 177.656
render part-c 181.743 195.558

echo "=== splice A+B ==="
node scripts/clip/merge-cuts.mjs --a out/part-a-vertical.mp4 --b out/part-b-vertical.mp4 \
  --out out/part-ab.mp4 --transition fadeblack --dur 0.6
echo "=== splice AB+C ==="
node scripts/clip/merge-cuts.mjs --a out/part-ab.mp4 --b out/part-c-vertical.mp4 \
  --out out/days-drift-by-60s-vertical.mp4 --transition fadeblack --dur 0.6

ffprobe -v error -show_entries format=duration -of csv=p=0 out/days-drift-by-60s-vertical.mp4
