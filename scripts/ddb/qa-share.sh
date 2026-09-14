#!/usr/bin/env bash
# Eyes-on the SHARE encode, not just the master — the share is what actually
# reaches the phone, and it is a different encode (higher crf). Playbook §7:
# extract frames from the file you will actually SHIP.
set -euo pipefail
cd /home/xsyprime/Hermes/x1c7.com/.claude/worktrees/days-drift-by-cut
F=out/days-drift-by-60s-vertical-share.mp4
O=/home/xsyprime/.claude/jobs/f012ee95/tmp/qa-share
mkdir -p "$O"
grab() {
  ffmpeg -y -v error -ss "$1" -i "$F" -frames:v 1 \
    -vf "scale=330:-1,drawtext=text='$1s $2':x=5:y=5:fontsize=20:fontcolor=yellow:box=1:boxcolor=black@0.75" "$O/s$3.png"
}
grab 5.5 gray 1
grab 21.9 leaves 2
grab 26.5 knowwhy 3
grab 39.9 stay 4
grab 52.5 days 5
grab 58.6 ending 6
ffmpeg -y -v error -i "$O/s1.png" -i "$O/s2.png" -i "$O/s3.png" -i "$O/s4.png" -i "$O/s5.png" -i "$O/s6.png" \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v][5:v]hstack=inputs=6[v]" -map "[v]" "$O/sheet.png"
echo "$O/sheet.png"
