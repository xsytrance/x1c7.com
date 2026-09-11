#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# THE CURATOR'S NIGHT WATCH — the Foundry reads what the Citadel painted.
#
# vision-worker asks a VLM what each lexicon image ACTUALLY shows, and scores it
# twice: does it look right (quality), and does it depict its own word (match).
# Readings are cached forever. This is what turns "we generated 16,000 images"
# into "the bad ones are known and can be pruned".
#
# ── why this runs on exxo ────────────────────────────────────────────────
# It needs Ollama, NOT ComfyUI. exxo (the Foundry) already serves Ollama on the
# tailnet and its RTX 3050 is idle around the clock, so the Citadel can paint
# all night on its own GPU while the Foundry grades in parallel. Nothing
# competes. The script runs here because the repo, the R2 credentials and the
# vision index live here; only the inference crosses the Ley Lines.
#
# Measured 2026-09-08 on the 3050: ~19s/image → ~34h of GPU to clear the 6,370
# images that had never been looked at. It is a finite backlog, not a treadmill.
#
#   systemctl --user start curator-watch.service     # or: night-watch start
#   night-watch stop                                 # safe, between images
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail
export PATH="$HOME/.local/bin:/usr/bin:/usr/local/bin:$PATH"
cd /home/xsyprime/x1c7.com || exit 1

# The Foundry's Ollama, over the Ley Lines. Overridable for a local fallback.
export OLLAMA_HOST="${OLLAMA_HOST:-http://100.121.251.66:11434}"

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/curator-watch"
STATE="$STATE_DIR/state.json"
FLAG="$STATE_DIR/stand-down"
LOCK="$STATE_DIR/lock"
LOG="$STATE_DIR/watch.log"          # cumulative — what `night-watch log` follows
PASS="$STATE_DIR/.current-pass.log" # truncated each pass — what progress is parsed from
BATCH=${BATCH:-1000}
mkdir -p "$STATE_DIR"

exec 9>"$LOCK"
flock -n 9 || { echo "$(date -Iseconds) · another watch holds the lock — exiting"; exit 0; }

STARTED=$(date -Iseconds)
READ_COUNT=0
CUR_STATE=running CUR_DETAIL=""

mark() { # $1 state, $2 detail
  CUR_STATE=$1 CUR_DETAIL=${2//\"/}
  local tmp="$STATE.tmp.$$"
  printf '{"state":"%s","step":"reading paintings","detail":"%s","started":"%s","updated":"%s","read":%s,"remaining":%s,"host":"exxo","pid":%s}\n' \
    "$CUR_STATE" "$CUR_DETAIL" "$STARTED" "$(date -Iseconds)" "$READ_COUNT" "${REMAINING:-0}" "$$" > "$tmp" \
    && mv -f "$tmp" "$STATE"
}
finish() { mark "$1" "$2"; rm -f "$FLAG"; echo "$(date -Iseconds) · ── watch $1: $2 ──"; }

STOPPING=0
request_stop() { STOPPING=1; touch "$FLAG"; mark "standing-down" "finishing the image it is reading"; }
trap request_stop TERM INT

rm -f "$FLAG"
REMAINING=0
echo "── $STARTED · curator night watch · reading on the Foundry ($OLLAMA_HOST) ──"

# Refuse to pretend. If the Foundry is unreachable the watch must say so, not
# quietly fall back to the Citadel's GPU and compete with the painter.
if ! curl -sf --max-time 15 "$OLLAMA_HOST/api/version" >/dev/null 2>&1; then
  finish "failed" "the Foundry's Ollama is unreachable at $OLLAMA_HOST — nothing was read"
  exit 1
fi

mark "running" "asking the Foundry to read the unread paintings"

# vision-worker prints "N unread images · reading M" and a final tally. Run it
# in the background and poll so a stand-down lands between images, not after
# the whole batch — the same contract as the night run.
# The pass log is truncated so progress is parsed from THIS pass only. Parsing
# `tail -1` of the cumulative log made a freshly-started pass report the previous
# pass's count until its own first progress line landed ~3 minutes later.
: > "$PASS"
node scripts/curator/vision-worker.mjs --limit "$BATCH" > >(tee -a "$LOG" > "$PASS") 2>&1 &
pid=$!
while kill -0 "$pid" 2>/dev/null; do
  if (( STOPPING )) || [ -e "$FLAG" ]; then
    STOPPING=1
    echo "$(date -Iseconds) · · stand-down — finishing the current image"
    kill -TERM "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
    READ_COUNT=$(grep -oP '^\s*\K\d+(?=/\d+ \(last:)' "$PASS" 2>/dev/null | tail -1); READ_COUNT=${READ_COUNT:-0}
    finish "stopped" "stood down · ${READ_COUNT} paintings read this pass"
    exit 0
  fi
  # Progress lines look like "  120/1000 (last: fire q=0.9 m=0.95)".
  READ_COUNT=$(grep -oP '^\s*\K\d+(?=/\d+ \(last:)' "$PASS" 2>/dev/null | tail -1); READ_COUNT=${READ_COUNT:-0}
  REMAINING=$(grep -oP 'vision-worker: \K\d+(?= unread)' "$PASS" 2>/dev/null | tail -1); REMAINING=${REMAINING:-0}
  mark "running" "the Foundry is reading · ${READ_COUNT} done this pass, ${REMAINING} were unread"
  sleep 10
done
wait "$pid"; rc=$?

READ_COUNT=$(grep -oP '\((\K\d+)(?= new)' "$PASS" 2>/dev/null | tail -1); READ_COUNT=${READ_COUNT:-0}
if (( rc == 0 )); then
  finish "done" "${READ_COUNT} paintings read this pass"
else
  finish "failed" "vision-worker exited ${rc} — see ${LOG}"
fi
exit "$rc"
