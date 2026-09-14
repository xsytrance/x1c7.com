#!/usr/bin/env bash
# Corner audit — the weighted negative suppressed the signature cartouche on
# most plates but NOT all, and a seal that is one smudge at contact-sheet scale
# is legible garbage type once it is 1080px wide on a phone. Woodblock
# signatures only ever live in the four corners, so crop all four at FULL
# resolution and read them.
#
#   bash scripts/ddb/corner_audit.sh <name>-<variant> [...]
set -euo pipefail
cd /home/xsyprime/Hermes/x1c7.com/.claude/worktrees/days-drift-by-cut
OUT=/home/xsyprime/.claude/jobs/f012ee95/tmp
P=scripts/ddb/plates
CW=300; CH=230          # corner box, full-res pixels

rows=(); args=(); i=0
for plate in "$@"; do
  args+=(-i "$P/$plate.png")
  rows+=("[$i:v]crop=$CW:$CH:0:0[tl$i]")
  rows+=("[$i:v]crop=$CW:$CH:in_w-$CW:0[tr$i]")
  rows+=("[$i:v]crop=$CW:$CH:0:in_h-$CH[bl$i]")
  rows+=("[$i:v]crop=$CW:$CH:in_w-$CW:in_h-$CH[br$i]")
  rows+=("[tl$i][tr$i][bl$i][br$i]hstack=inputs=4,drawtext=text='$plate  TL TR BL BR':x=6:y=6:fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.75[r$i]")
  i=$((i+1))
done
stack=""; for ((j=0;j<i;j++)); do stack+="[r$j]"; done
rows+=("${stack}vstack=inputs=$i[v]")
fc=$(IFS=';'; echo "${rows[*]}")
ffmpeg -y -v error "${args[@]}" -filter_complex "$fc" -map "[v]" "$OUT/corners.png"
echo "$OUT/corners.png"
