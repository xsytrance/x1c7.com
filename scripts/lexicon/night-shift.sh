#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# LEXICON · NIGHT SHIFT — one night of alternating curation and painting.
#
# Cycles until GOAL new images or END_AT:
#   SCAN — vision-worker reads fresh paint · show-audit VLM-scans full shows
#          (appropriateness to the song, word match, render quality, lyric
#          timing) · prunes failures (journaled, rerolled) · match-reel
#          rebuilds each audited show from the refreshed readings
#   GEN  — art.mjs repaints the pruned slots (regen queue), then renders the
#          next chunk of gravity-budget jobs
#
# GPU guardrails: cool_gate between units (pause ≥82°C, resume ≤70°C) and a
# 20s watchdog probe that SIGSTOPs the workers at ≥86°C, SIGCONTs at ≤72°C.
# Whispers progress to the phone via Ossicle. At dawn: republish, re-arm
# lexicon-grow.timer (stamp touched first so Persistent doesn't double-run
# tonight's work in the morning).
#
#   bash scripts/lexicon/night-shift.sh            # defaults: GOAL=1000, END_AT=07:15
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail
export PATH="$HOME/.local/bin:/usr/bin:/usr/local/bin:$PATH"
cd /home/xsyprime/x1c7.com || exit 1

GOAL=${GOAL:-1000}                 # rendered images tonight (regen + growth)
END_AT=${END_AT:-07:15}            # hard stop, local time (morning)
CHUNK=${CHUNK:-120}                # gravity-budget jobs per gen chunk
SHOWS_PER_CYCLE=${SHOWS_PER_CYCLE:-5}
PAUSE_AT=82 RESUME_AT=70 EMERGENCY_AT=86 EMERGENCY_RESUME=72
LIVE=scripts/lexicon/.night-current.log
REGEN=scripts/curator/.audit-regen.txt
LOCK=/tmp/lexicon-night-shift.lock

exec 9>"$LOCK"
flock -n 9 || { echo "another night shift holds the lock — exiting"; exit 1; }

ts() { date -Iseconds; }
say() { echo "$(ts) · $*"; }

whisper() { # $1 text, $2 priority (optional)
  local TOKEN
  TOKEN=$(grep -m1 '^OSSICLE_INGEST_TOKEN=' /home/xsyprime/ossicle/.env | cut -d= -f2-) || return 0
  curl -s --max-time 10 -X POST http://127.0.0.1:8001/ossicle/a1/whisper \
    -H "x-ossicle-token: $TOKEN" -H "Content-Type: application/json" \
    -d "$(jq -cn --arg t "$1" --arg p "${2:-normal}" '{bee:"atelier-night",name:"Night Shift",priority:$p,category:"info",text:$t}')" >/dev/null || true
}

gpu_temp() { nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits | head -1; }
gpu_mem()  { nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1; }

cool_gate() { # block between units while the GPU is hot
  local t; t=$(gpu_temp)
  if (( t >= PAUSE_AT )); then
    say "🌡 GPU ${t}°C ≥ ${PAUSE_AT}°C — cooling pause"
    whisper "GPU hot (${t}°C) — night shift pausing to cool"
    while :; do sleep 60; t=$(gpu_temp); (( t <= RESUME_AT )) && break; done
    say "🌡 GPU ${t}°C — resuming"
    whisper "GPU cooled (${t}°C) — night shift resumed"
  fi
}

watchdog() { # emergency probe: SIGSTOP the workers if a long chunk overheats mid-run
  while :; do
    sleep 20
    local t; t=$(gpu_temp) || continue
    if (( t >= EMERGENCY_AT )); then
      local pids
      pids=$(pgrep -f "scripts/(lexicon/art|curator/(show-audit|vision-worker|match-reel))\.mjs" || true)
      [ -z "$pids" ] && continue
      kill -STOP $pids 2>/dev/null
      say "🚨 watchdog: GPU ${t}°C — workers paused (SIGSTOP $pids)"
      whisper "GPU ${t}°C — watchdog paused the night shift workers" critical
      while :; do sleep 30; t=$(gpu_temp); (( t <= EMERGENCY_RESUME )) && break; done
      kill -CONT $pids 2>/dev/null
      say "watchdog: GPU ${t}°C — workers resumed"
      whisper "GPU cooled to ${t}°C — workers resumed"
    fi
  done
}

comfy_free()    { curl -s --max-time 10 -X POST http://localhost:8188/free -H "Content-Type: application/json" -d '{"unload_models":true,"free_memory":true}' >/dev/null || true; }
ollama_unload() { local m; for m in "qwen3-vl:8b" "qwen3:14b" "qwen3-embedding:0.6b"; do curl -s --max-time 10 http://localhost:11434/api/generate -d "{\"model\":\"$m\",\"keep_alive\":0}" >/dev/null || true; done; }

past_end() { local now=$(date +%H:%M); [[ "$now" > "$END_AT" ]] && (( 10#$(date +%H) < 12 )); }

LAST_RENDERED=0
gen_chunk() { # run art.mjs, relay its log, count renders into LAST_RENDERED
  node scripts/lexicon/art.mjs "$@" >"$LIVE" 2>&1 || say "✗ art chunk exited nonzero"
  cat "$LIVE"
  LAST_RENDERED=$(grep -oP 'atelier done: \K\d+' "$LIVE" | tail -1)
  LAST_RENDERED=${LAST_RENDERED:-0}
}

# ═══ shift start ═══
watchdog & WATCHDOG_PID=$!
cleanup() { kill "$WATCHDOG_PID" 2>/dev/null; }
trap cleanup EXIT

if ! curl -sf --max-time 5 http://localhost:8188/system_stats >/dev/null; then
  say "✗ ComfyUI not up — aborting"; whisper "Night shift aborted: ComfyUI is down" critical; exit 1
fi

say "── night shift begins · goal ${GOAL} images · until ${END_AT} · GPU $(gpu_temp)°C"
whisper "Night shift on 🌙 — auditing every full show + painting toward ${GOAL} new lexicon images"

# 0) text growth first (cheap, same steps the nightly cron would have run)
node scripts/lexicon/harvest.mjs \
  && node scripts/curator/gravity.mjs --grade-limit 60 \
  && node scripts/lexicon/dream.mjs --limit 999 \
  && node scripts/lexicon/publish.mjs \
  && say "✦ text growth done" || say "✗ text growth step failed (continuing)"

# song queue — shows that already have reels first, then every aligned song
mapfile -t ALL_SONGS < <(cd scripts/song-analysis/profiles && for d in */; do d=${d%/};
  if [ -f "$d/lexicon-reel.json" ]; then echo "0 $d"; elif [ -f "$d/aligned.json" ]; then echo "1 $d"; fi; done | sort | awk '{print $2}')
say "song queue: ${#ALL_SONGS[@]} shows"

GEN_TOTAL=0 PRUNED_TOTAL=0 AUDITED=0 REELS_BUILT=0 DRY_STREAK=0
idx=0 cycle=0
while :; do
  past_end && { say "reached ${END_AT} — winding down"; break; }
  (( GEN_TOTAL >= GOAL )) && { say "goal reached — winding down"; break; }
  cycle=$((cycle+1))

  # ── SCAN ──────────────────────────────────────────────────────────────
  cool_gate; comfy_free
  node scripts/curator/vision-worker.mjs --limit 300 || say "✗ vision-worker failed"
  for ((j=0; j<SHOWS_PER_CYCLE; j++)); do
    past_end && break
    (( idx >= ${#ALL_SONGS[@]} )) && idx=0   # wrap — fresh-window makes re-audits cheap
    id=${ALL_SONGS[$idx]}; idx=$((idx+1))
    cool_gate
    if [ ! -f "scripts/song-analysis/profiles/$id/lexicon-reel.json" ]; then
      say "building reel: $id"
      node scripts/curator/match-reel.mjs --song "$id" --publish \
        && REELS_BUILT=$((REELS_BUILT+1)) || { say "✗ reel build failed: $id"; continue; }
    fi
    out=$(node scripts/curator/show-audit.mjs --song "$id" --apply 2> >(cat >&2)) || { say "✗ audit failed: $id"; continue; }
    AUDITED=$((AUDITED+1))
    p=$(jq -r '.pruned // 0' <<<"$out" 2>/dev/null || echo 0); PRUNED_TOTAL=$((PRUNED_TOTAL + p))
    # rebuild from the refreshed readings — drops pruned/misfit frames, recuts timing
    node scripts/curator/match-reel.mjs --song "$id" --publish || say "✗ reel rebuild failed: $id"
  done

  past_end && break

  # ── GEN ───────────────────────────────────────────────────────────────
  cool_gate; ollama_unload
  if [ -s "$REGEN" ]; then
    words=$(paste -sd, "$REGEN")
    say "regen queue: $words"
    gen_chunk --words "$words" --limit 100
    GEN_TOTAL=$((GEN_TOTAL + LAST_RENDERED))
    (( LAST_RENDERED > 0 )) && : > "$REGEN"
  fi
  cool_gate
  gen_chunk --limit "$CHUNK"
  GEN_TOTAL=$((GEN_TOTAL + LAST_RENDERED))
  if (( LAST_RENDERED == 0 )); then DRY_STREAK=$((DRY_STREAK+1)); else DRY_STREAK=0; fi
  if (( DRY_STREAK >= 3 )); then
    say "✗ three dry gen phases in a row — backing off 10 min"
    whisper "Night shift: generation stalled (3 dry chunks) — backing off" critical
    sleep 600; DRY_STREAK=0
  fi

  say "cycle ${cycle}: ${GEN_TOTAL}/${GOAL} painted · ${AUDITED} shows audited (${REELS_BUILT} reels built) · ${PRUNED_TOTAL} pruned · GPU $(gpu_temp)°C $(gpu_mem)MiB"
  (( cycle % 2 == 0 )) && whisper "Night shift: ${GEN_TOTAL}/${GOAL} painted · ${AUDITED} shows audited · ${PRUNED_TOTAL} pruned · GPU $(gpu_temp)°C"
done

# ═══ dawn — read the last batch, publish, re-arm the nightly timer ═══
comfy_free
node scripts/curator/vision-worker.mjs --limit 400 || say "✗ final vision pass failed"
node scripts/lexicon/publish.mjs || say "✗ final publish failed"
ollama_unload
touch "$HOME/.local/share/systemd/timers/stamp-lexicon-grow.timer"
systemctl --user start lexicon-grow.timer && say "✦ lexicon-grow.timer re-armed" || say "✗ could not re-arm lexicon-grow.timer"
say "── night shift done: ${GEN_TOTAL} painted · ${AUDITED} show audits (${REELS_BUILT} new reels) · ${PRUNED_TOTAL} pruned"
whisper "Night shift done ☀️ — ${GEN_TOTAL} images painted, ${AUDITED} show audits (${REELS_BUILT} new reels), ${PRUNED_TOTAL} pruned & rerolled. Timer re-armed."
