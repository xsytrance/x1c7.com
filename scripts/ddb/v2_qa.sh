#!/usr/bin/env bash
# QA the v2 deliverable. Sampled at the FX beats — and ~0.3-0.6s after each word
# fires, not on it, so the frame shows the effect mid-arc rather than the
# outgoing plate (swapMs 650).
#
# final-timeline t = song t - 67.650   (W1)
#                  = song t - 86.617   (W2, after the 24.233s join)
#                  = song t - 133.941  (W3, after the 48.800s join)
set -euo pipefail
cd /home/xsyprime/Hermes/x1c7.com/.claude/worktrees/days-drift-by-cut
F=out/days-drift-by-v2-vertical.mp4
O=/home/xsyprime/.claude/jobs/f012ee95/tmp/qa2
rm -rf "$O"; mkdir -p "$O"
grab() {
  ffmpeg -y -v error -ss "$1" -i "$F" -frames:v 1 \
    -vf "scale=300:-1,drawtext=text='$1s $2':x=5:y=5:fontsize=19:fontcolor=yellow:box=1:boxcolor=black@0.8" "$O/$3.png"
}
# W1
grab 0.8  DAYS-drift      a1
grab 2.0  by-echo         a2
grab 3.4  phrase-knowwhy  a3
grab 6.4  BREATHE-inhale  a4
grab 9.0  phrase-alive    a5
grab 10.3 ALIVE-sunwake   a6
grab 12.0 DAYS-drift2     a7
grab 15.5 SKY-updraft     a8
grab 17.5 phrase-stay     a9
grab 22.0 STAY-linger     a10
# W2
grab 25.5 phrase-clouds   b1
grab 29.9 GRAY-greyout    b2
grab 31.2 SUN-sunwake     b3
grab 34.0 phrase-does     b4
grab 37.0 CLOSER-press    b5
grab 40.5 LIGHT-sunwake   b6
grab 42.5 HIGHER-updraft  b7
grab 45.8 LEAVES-updraft  b8
# W3
grab 50.5 DAYS-drift3     c1
grab 52.0 by-tail         c2
grab 56.5 DAYS-drift4     c3
grab 58.8 ending          c4

cd "$O"
ffmpeg -y -v error -i a1.png -i a2.png -i a3.png -i a4.png -i a5.png -i a6.png -i a7.png \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v][5:v][6:v]hstack=inputs=7[v]" -map "[v]" sheet1.png
ffmpeg -y -v error -i a8.png -i a9.png -i a10.png -i b1.png -i b2.png -i b3.png -i b4.png \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v][5:v][6:v]hstack=inputs=7[v]" -map "[v]" sheet2.png
ffmpeg -y -v error -i b5.png -i b6.png -i b7.png -i b8.png -i c1.png -i c2.png -i c3.png -i c4.png \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v][5:v][6:v][7:v]hstack=inputs=8[v]" -map "[v]" sheet3.png
echo "$O/sheet1.png $O/sheet2.png $O/sheet3.png"
