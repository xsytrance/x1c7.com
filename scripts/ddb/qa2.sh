#!/usr/bin/env bash
# Second QA pass — sample ~1s AFTER each keyword hit, not on it.
# deck.motion.swapMs is 650, so a frame taken at the hit shows the OUTGOING
# plate mid-crossfade and reads as "the art didn't change".
set -euo pipefail
cd /home/xsyprime/Hermes/x1c7.com/.claude/worktrees/days-drift-by-cut
F=out/days-drift-by-60s-vertical.mp4
O=/home/xsyprime/.claude/jobs/f012ee95/tmp/qa

grab() {
  ffmpeg -y -v error -ss "$1" -i "$F" -frames:v 1 \
    -vf "scale=300:-1,drawtext=text='$1s $2':x=5:y=5:fontsize=20:fontcolor=yellow:box=1:boxcolor=black@0.75" \
    "$O/y$3.png"
}
grab 21.9 leaves 1
grab 39.9 stay 2
grab 41.0 stay-hold 3
grab 26.5 know-why 4
grab 9.5 does 5
ffmpeg -y -v error -i "$O/y1.png" -i "$O/y2.png" -i "$O/y3.png" -i "$O/y4.png" -i "$O/y5.png" \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v]hstack=inputs=5[v]" -map "[v]" "$O/sheetC.png"
echo "$O/sheetC.png"
