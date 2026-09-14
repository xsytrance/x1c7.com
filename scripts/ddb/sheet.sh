#!/usr/bin/env bash
# Contact sheets for the eyes-on audit. SIX shots per sheet, both variants
# stacked (v0 top row, v1 bottom), each cell 340px wide.
#
# 340, not 250: playbook §18 — four of sixty-eight plates in an earlier cut had
# grown a stray human that was plainly visible at 500px and invisible at 250px.
# Anything smaller than ~300px hides exactly the defects a contact sheet exists
# to catch. Labels are burned in so a pick can be named without counting cells.
set -euo pipefail
cd /home/xsyprime/Hermes/x1c7.com/.claude/worktrees/days-drift-by-cut
OUT=/home/xsyprime/.claude/jobs/f012ee95/tmp
P=scripts/ddb/plates

sheet() {
  local name=$1; shift
  local args=() filters=() i=0
  for s in "$@"; do
    args+=(-i "$P/$s-0.png" -i "$P/$s-1.png")
    filters+=("[$((i*2)):v]scale=340:-1,drawtext=text='$s 0':x=6:y=6:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6[a$i]")
    filters+=("[$((i*2+1)):v]scale=340:-1,drawtext=text='$s 1':x=6:y=6:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6[b$i]")
    i=$((i+1))
  done
  local top="" bot=""
  for ((j=0;j<i;j++)); do top+="[a$j]"; bot+="[b$j]"; done
  filters+=("${top}hstack=inputs=$i[t]")
  filters+=("${bot}hstack=inputs=$i[u]")
  filters+=("[t][u]vstack=inputs=2[v]")
  local fc; fc=$(IFS=';'; echo "${filters[*]}")
  ffmpeg -y -v error "${args[@]}" -filter_complex "$fc" -map "[v]" "$OUT/sheet-$name.png"
  echo "$OUT/sheet-$name.png"
}

sheet 1 clouds fade gray sun way closer
sheet 2 light higher leaves days drift by
sheet 3 breathe alive floating sky stay tonight
sheet 4 rain heron pine gold
