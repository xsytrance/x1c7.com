#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# LEXICON · grow + publish — the nightly entrypoint.
#
# harvest (pick up any newly-onboarded songs) → dream (fill new legos on the
# frontier) → publish (upload the shelf to R2) → paint → curate. Every x1c7 +
# Kinetica install then fetches the update on next load, no redeploy.
# "Grows while you sleep, for everyone."
#
# Run by lexicon-night.timer at 00:00, hard-stopped at 05:00 (local).
# Run it by hand anytime:  lexicon-night start
# Stop it safely anytime:  lexicon-night stop     (or SUPER+SHIFT+N)
# Watch it:                the bar indicator, or `lexicon-night status`
#
# ── 2026-09-08, two bugs fixed here ──────────────────────────────────────
# 1. The art top-up had been skipped every night since 2026-08-03 (29 runs).
#    The gate below used `curl --max-time 5` against :8188, but :8188 is now
#    the Conjury's socket — the first connection RAISES ComfyUI, and a cold
#    start takes far longer than 5s. The check was killing the boot it had
#    just triggered, then reporting "not up". It now knocks and WAITS.
# 2. Nothing checked whether the Sovereign wanted it to stop, so the only way
#    to end a run was to kill it mid-write. See stand_down() below.
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail
export PATH="$HOME/.local/bin:/usr/bin:/usr/local/bin:$PATH"   # systemd/cron PATH lacks ~/.local/bin (where node lives) until a login shell imports it
cd /home/xsyprime/x1c7.com || exit 1

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/lexicon-night"
STATE="$STATE_DIR/state.json"
FLAG="$STATE_DIR/stand-down"
LOCK="$STATE_DIR/lock"
ART_LOG="$STATE_DIR/last-art.log"
REGEN_LOG="$STATE_DIR/last-regen.log"
REGENNED=0
LIVE_LOG=""      # which paint log run_step should count from right now
END_AT=${END_AT:-05:00}          # hard stop, local time — dawn
CONJURY_WAIT=${CONJURY_WAIT:-180} # seconds to let a cold ComfyUI finish booting
mkdir -p "$STATE_DIR"

# Single instance. A hand-run and the timer can never paint over each other.
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Iseconds) · another night run holds the lock — exiting"
  exit 0
fi

STARTED=$(date -Iseconds)
RENDERED=0

# ── state, for the bar indicator ──────────────────────────────────────────
# Atomic (tmp+mv) so the bar never reads a half-written file and blinks.
CUR_STATE=running CUR_STEP=starting CUR_DETAIL=""
mark() { # $1 state, $2 step, $3 detail
  CUR_STATE=$1 CUR_STEP=$2 CUR_DETAIL=${3//\"/}
  local tmp="$STATE.tmp.$$"
  printf '{"state":"%s","step":"%s","detail":"%s","started":"%s","updated":"%s","rendered":%s,"pid":%s}\n' \
    "$CUR_STATE" "$CUR_STEP" "$CUR_DETAIL" "$STARTED" "$(date -Iseconds)" "$RENDERED" "$$" > "$tmp" \
    && mv -f "$tmp" "$STATE"
}

# How many images the painter has actually finished. art.mjs only prints its
# "atelier done: N rendered" summary if it runs to completion, so a run that
# stood down mid-paint used to report 0 — while 90 images sat published in R2.
# Telling him nothing was kept when 90 were is a lie, so count the per-image
# lines ("  [90/189] curve s0#5 photo → …") and prefer the summary when it exists.
count_painted() { # $1 = log to read (default: the main art log)
  local f=${1:-${ART_LOG:-}}
  [ -s "$f" ] || { echo 0; return; }
  local done_line
  done_line=$(grep -oP 'atelier done: \K\d+' "$f" 2>/dev/null | tail -1)
  if [ -n "$done_line" ]; then echo "$done_line"; return; fi
  grep -cP '^\s*\[\d+/\d+\]' "$f" 2>/dev/null || echo 0
}
finish() { # $1 state, $2 detail
  mark "$1" "—" "$2"
  rm -f "$FLAG"
  echo "$(date -Iseconds) · ── night run $1: $2 ──"
}

# ── the safe stop ─────────────────────────────────────────────────────────
# Cooperative, and that is the whole point. `lexicon-night stop` drops a flag;
# we notice it BETWEEN steps, never inside one. The node step that is running
# finishes its current image and writes lexicon.json atomically (art.mjs save()),
# so a stand-down can never truncate the shelf or ship a broken one to R2.
# SIGTERM from systemd lands here too and does the same thing.
STOPPING=0
request_stop() { STOPPING=1; touch "$FLAG"; echo "$(date -Iseconds) · · stand-down requested — finishing the current step"; mark "standing-down" "finishing current step" "will stop cleanly, nothing is lost"; }
trap request_stop TERM INT

# Dawn only binds a run that actually began in the night window (00:00–END_AT).
# A hand-run started at 09:00 must not decide it is instantly "past dawn" and
# quit before painting anything — that is a night curfew, not a ban on working.
NIGHT_RUN=0
[[ "$(date +%H:%M)" < "$END_AT" ]] && NIGHT_RUN=1
past_end() {
  (( NIGHT_RUN )) || return 1
  [[ "$(date +%H:%M)" > "$END_AT" ]] && (( 10#$(date +%H) < 12 ))
}

# Seconds from now until END_AT. The paint steps are long enough to sail
# straight past dawn on their own (1200 images at ~15s each is 5 hours), so
# checking the clock only BETWEEN steps would not actually stop at 05:00.
# Every long step is wrapped in `timeout $(secs_to_dawn)`. Killing a render
# mid-flight is safe: art.mjs writes lexicon.json atomically, and a half-
# finished image is just a file that never gets referenced.
secs_to_dawn() {
  local now dawn
  now=$(date +%s)
  dawn=$(date -d "today $END_AT" +%s)
  (( dawn <= now )) && dawn=$(date -d "tomorrow $END_AT" +%s)
  local left=$(( dawn - now ))
  (( left < 60 )) && left=60
  echo "$left"
}

stand_down() { # true when we should stop before the next step
  (( STOPPING )) && return 0
  [ -e "$FLAG" ] && { STOPPING=1; echo "$(date -Iseconds) · · stand-down flag set"; return 0; }
  past_end && { echo "$(date -Iseconds) · · reached ${END_AT} — dawn, winding down"; return 0; }
  return 1
}

# run_step — run one long worker so that it can actually be interrupted.
#
# Checking the flag only BETWEEN steps is not good enough: a single
# `topup.mjs --limit 4000` can run for hours, and bash will not process a trap
# while it waits on a foreground child. So the worker runs in the background and
# we poll. When he stands down (or dawn arrives), the worker gets SIGTERM and we
# wait for it to land. That is safe: lexicon.json is written atomically, and a
# half-rendered image is just an unreferenced file.
run_step() { # $@ = command to run
  local pid rc budget waited=0
  budget=$(secs_to_dawn)
  "$@" &
  pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    if (( STOPPING )) || [ -e "$FLAG" ]; then
      STOPPING=1
      echo "$(date -Iseconds) · · stand-down — asking the current step to finish"
      kill -TERM "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
      return 130
    fi
    if (( waited >= budget )); then
      echo "$(date -Iseconds) · · reached ${END_AT} — dawn, stopping the current step"
      STOPPING=1
      kill -TERM "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
      return 130
    fi
    sleep 2
    waited=$((waited + 2))
    # Refresh the live count every ~10s so the bar shows the night's progress
    # as it happens rather than one number at the end.
    if (( waited % 10 == 0 )); then
      RENDERED=$(( REGENNED + $(count_painted "$LIVE_LOG") ))
      mark "$CUR_STATE" "$CUR_STEP" "$CUR_DETAIL"
    fi
  done
  wait "$pid"; rc=$?
  return $rc
}

rm -f "$FLAG"                     # a stale flag from last night must not stop tonight
: > "$ART_LOG"; : > "$REGEN_LOG"  # ...and last night's paint logs must not be counted as tonight's
echo "── $STARTED · nightly build ──"
mark "running" "starting" "night run began"

# ── preflight ─────────────────────────────────────────────────────────────
# rclone went missing in the 2026-09-05 reforging and nothing noticed, because
# art.mjs only reaches it after the first render — so a night would burn GPU and
# then die with a stack trace. Every image AND the shelf ship through rclone;
# without it this job cannot deliver anything. Fail in the first second, loudly.
for dep in node rclone curl jq; do
  command -v "$dep" >/dev/null 2>&1 && continue
  finish "failed" "$dep is not installed — the night run cannot publish anything. Install it, then: lexicon-night start"
  exit 1
done

# ═══ 1) LEXICON — text growth ═════════════════════════════════════════════
# Each step is bounded — a hung network/LLM/R2 call used to block ~4h until the
# systemd TimeoutStartSec killed the whole run (fixed 2026-08-11, Writ execution).
mark "running" "growing the shelf" "harvest → gravity → dream → publish"
# Each step keeps its own timeout (a hung network/LLM/R2 call used to block ~4h
# until systemd killed the whole run — fixed 2026-08-11, Writ execution) and is
# run through run_step so a stand-down is felt within seconds, not at the end of
# a 30-minute dream pass.
if run_step timeout 900 node scripts/lexicon/harvest.mjs \
   && run_step timeout 600 node scripts/curator/gravity.mjs --grade-limit 60 \
   && run_step timeout 1800 node scripts/lexicon/dream.mjs --limit 999 \
   && run_step timeout 600 node scripts/lexicon/publish.mjs; then
  echo "$(date -Iseconds) · ✦ lexicon done"
else
  echo "$(date -Iseconds) · ✗ lexicon step failed (see above)"
fi

stand_down && { finish "stopped" "stopped after text growth"; exit 0; }

# ═══ 2) THE CONJURY — knock, then wait for it to wake ═════════════════════
# :8188 is a systemd socket. Touching it raises ComfyUI; that boot is slow and
# it is NOT a failure. Knock once to trigger activation, then poll until the
# API actually answers. This is the line that was broken for 36 days.
mark "running" "waking the Conjury" "raising ComfyUI on :8188"
echo "$(date -Iseconds) · · knocking on the Conjury (:8188), up to ${CONJURY_WAIT}s for a cold start"
conjury_up=0
for ((i = 0; i < CONJURY_WAIT; i += 3)); do
  if curl -sf --max-time 10 http://localhost:8188/system_stats >/dev/null 2>&1; then
    conjury_up=1
    echo "$(date -Iseconds) · ✦ the Conjury answered after ~${i}s"
    break
  fi
  stand_down && break
  sleep 3
done

if (( ! conjury_up )); then
  finish "failed" "ComfyUI never answered on :8188 within ${CONJURY_WAIT}s — no art tonight"
  exit 1
fi

stand_down && { finish "stopped" "stopped before painting" ; exit 0; }

# ═══ GPU Watchbill lease — shared with Spellbook/Warden/watchmaker ════════
# Fail closed if another producer holds PRIME. Do not clear the Comfy queue.
LEASE_JSON=""
lease_admit() {
  LEASE_JSON=$(PYTHONPATH=/home/xsyprime/Projects/singularity/scripts python3 - <<'PY' 2>/dev/null
from estate_gpu_lexsycon_shim import admit
import json
print(json.dumps(admit(task_id='lexsycon-night')))
PY
) || true
  if [ -z "$LEASE_JSON" ] || ! printf '%s' "$LEASE_JSON" | grep -q '"state": "held"'; then
    finish "failed" "GPU Watchbill lease deferred or unavailable — no art tonight (another producer may hold PRIME)"
    exit 1
  fi
  echo "$(date -Iseconds) · ✦ GPU lease held for Lexsycon night"
  trap 'lease_release' EXIT
}
lease_release() {
  [ -n "$LEASE_JSON" ] || return 0
  local payload="$LEASE_JSON"
  LEASE_JSON=""   # prevent re-entry from EXIT after explicit release
  PYTHONPATH=/home/xsyprime/Projects/singularity/scripts LEASE_JSON="$payload" python3 - <<'PY' 2>/dev/null || true
import json, os
from estate_gpu_lexsycon_shim import release
lease = json.loads(os.environ['LEASE_JSON'])
print(json.dumps(release(lease, evidence={'note': 'lexsycon night complete'})))
PY
  echo "$(date -Iseconds) · ✦ GPU lease released"
}
lease_admit

# ═══ 3) ART TOP-UP ════════════════════════════════════════════════════════
# Render more paintings per song toward 100. Output is gitignored; a
# publish+wire step (x1c7-art R2) ships it once creds are in place.
mark "running" "painting song art" "topping songs up toward 100 plates"
run_step node scripts/song-art/topup.mjs --target 100 --limit 4000 \
  && echo "$(date -Iseconds) · ✦ song art top-up done" \
  || echo "$(date -Iseconds) · ✗ song art top-up ended early (stood down, dawn, or failed)"

stand_down && { finish "stopped" "stopped after song art"; exit 0; }

# ═══ 3a) THE REGEN QUEUE — repaint what the Curator threw out ═════════════
# This is the loop closing. exxo grades every image; anything below the floor
# is pruned from the shelf and from R2, and its WORD lands in .audit-regen.txt.
# Here the painter fills those holes back in, so the shelf ends each night with
# the same coverage and better pictures. Empty queue = nothing to do.
REGEN=scripts/curator/.audit-regen.txt
if [ -s "$REGEN" ]; then
  words=$(paste -sd, "$REGEN")
  n=$(wc -l < "$REGEN")
  mark "running" "repainting the Curator's rejects" "$n words the Curator threw out"
  echo "$(date -Iseconds) · · regen queue: ${n} words"
  LIVE_LOG=$REGEN_LOG
  regen() { node scripts/lexicon/art.mjs --words "$words" --limit 900 2>&1 | tee "$REGEN_LOG"; }
  run_step regen || echo "$(date -Iseconds) · ✗ regen ended early — queue kept for tomorrow"
  REGENNED=$(count_painted "$REGEN_LOG")
  RENDERED=$REGENNED
  echo "$(date -Iseconds) · ✦ regen: ${REGENNED} repainted"
  # Only clear the queue if work actually landed — a dry night must not
  # silently discard the list of words still missing their art.
  (( REGENNED > 0 )) && : > "$REGEN"
  stand_down && { finish "stopped" "stopped after regen · ${REGENNED} repainted"; exit 0; }
fi

# Lexicon community art — the Atelier fills senses by WORD GRAVITY
# (heavy words 6 images, mid 2, light 0 — curator/gravity.mjs decides).
mark "running" "painting the Lexicon" "filling senses by word gravity"
LIVE_LOG=$ART_LOG
paint() { node scripts/lexicon/art.mjs --limit 1200 2>&1 | tee "$ART_LOG"; }
if run_step paint; then
  echo "$(date -Iseconds) · ✦ lexicon art done"
else
  echo "$(date -Iseconds) · ✗ lexicon art ended early (stood down, dawn, or failed)"
fi
RENDERED=$(( REGENNED + $(count_painted "$ART_LOG") ))

stand_down && { finish "stopped" "stopped after painting · ${RENDERED} new images kept"; exit 0; }

# ═══ 4) THE CURATOR ═══════════════════════════════════════════════════════
# The machine looks at tonight's paintings (vision readings, cached forever),
# grades any new borderline words, and rebuilds the reels of songs whose
# vocabulary gained art. Runs AFTER the render batches so Ollama and ComfyUI
# trade the GPU cleanly; every curator step unloads its model (keep_alive 0).
mark "running" "reading tonight's paintings" "the Curator grades what was painted"
run_step node scripts/curator/vision-worker.mjs --limit 400 \
  && echo "$(date -Iseconds) · ✦ vision readings done" \
  || echo "$(date -Iseconds) · ✗ vision worker ended early (stood down, dawn, or failed)"

mark "running" "rebuilding reels" "refreshing shows whose vocabulary gained art"
for reel in scripts/song-analysis/profiles/*/lexicon-reel.json; do
  [ -e "$reel" ] || continue
  stand_down && { finish "stopped" "stopped during reel refresh · ${RENDERED} new images kept"; exit 0; }
  id=$(basename "$(dirname "$reel")")
  node scripts/curator/match-reel.mjs --song "$id" --publish >/dev/null 2>&1 \
    && echo "$(date -Iseconds) · ✦ reel refreshed: $id" \
    || echo "$(date -Iseconds) · ✗ reel failed: $id"
done

# Gravitational feed — drain any queued feed jobs (safety net for the watcher).
mark "running" "draining the feed queue" "safety net for the watcher"
node scripts/feed-worker.mjs \
  && echo "$(date -Iseconds) · ✦ feed queue drained" \
  || echo "$(date -Iseconds) · ✗ feed worker failed"

finish "done" "${RENDERED} new images painted, shelf published"
