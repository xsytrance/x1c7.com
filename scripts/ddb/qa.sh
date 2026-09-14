#!/usr/bin/env bash
# QA sheets from the file that actually SHIPS (playbook §7) — not from the
# per-part renders, and not from the studio. Frames are pulled at the moments
# that change: each keyword hit, each splice, and the ending.
set -euo pipefail
cd /home/xsyprime/Hermes/x1c7.com/.claude/worktrees/days-drift-by-cut
F=out/days-drift-by-60s-vertical.mp4
OUT=/home/xsyprime/.claude/jobs/f012ee95/tmp/qa
rm -rf "$OUT"; mkdir -p "$OUT"

# final-timeline seconds -> label
shots=(
  "1.0:clouds"   "5.5:gray"     "7.9:sun-way"  "12.5:closer"
  "15.9:light"   "19.0:higher"  "21.4:leaves"  "22.6:SPLICE-AB"
  "25.0:days"    "29.5:breathe" "33.1:alive"   "36.6:floating"
  "39.1:stay"    "42.5:stay2"   "45.5:SPLICE-BC" "49.0:days3"
  "52.5:days4"   "55.5:lastlight" "58.6:ending"
)
i=0
for s in "${shots[@]}"; do
  t=${s%%:*}; name=${s##*:}
  printf -v n "%02d" "$i"
  ffmpeg -y -v error -ss "$t" -i "$F" -frames:v 1 \
    -vf "scale=300:-1,drawtext=text='${t}s ${name}':x=5:y=5:fontsize=20:fontcolor=yellow:box=1:boxcolor=black@0.75" \
    "$OUT/$n-$name.png"
  i=$((i+1))
done

cd "$OUT"
ffmpeg -y -v error -pattern_type glob -i '0[0-9]-*.png' -filter_complex \
  "tile=layout=10x1" row1.png 2>/dev/null || true
ls
