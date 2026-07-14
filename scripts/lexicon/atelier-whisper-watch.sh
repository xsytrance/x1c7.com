#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# ATELIER · WHISPER WATCH — every 5 new lexicon images, whisper the count to
# the phone through Ossicle (bee "atelier"). Watches the shelf itself
# (lexicon.json image count), so it covers manual batches AND the nightly run
# without caring which process is painting. Ossicle's hub-side quiet hours,
# mutes, and whisper budget govern actual delivery — this just reports.
#
# Runs forever; installed as atelier-whisper.service (systemd user).
# ═══════════════════════════════════════════════════════════════════════════
set -u
LEX=/home/xsyprime/Hermes/x1c7.com/src/data/lexicon.json
STATE=${XDG_CACHE_HOME:-$HOME/.cache}/atelier-whisper.count
ENV_FILE=/home/xsyprime/ossicle/.env
HUB=http://127.0.0.1:8001/ossicle/a1/whisper
STEP=5
POLL=20

TOKEN=$(grep -m1 '^OSSICLE_INGEST_TOKEN=' "$ENV_FILE" | cut -d= -f2-)
[ -n "$TOKEN" ] || { echo "no OSSICLE_INGEST_TOKEN — exiting"; exit 1; }

count_images() {
  node -e '
    try {
      const l = require(process.argv[1]);
      let n = 0, need = 0, per = 4;
      for (const e of Object.values(l.entries)) for (const s of e.senses) {
        const k = (s.images || []).length; n += k; need += Math.max(0, per - k);
      }
      console.log(n + " " + need);
    } catch { process.exit(1) } // mid-write JSON — skip this cycle
  ' "$LEX" 2>/dev/null
}

last=$(cat "$STATE" 2>/dev/null || echo "")
if [ -z "$last" ]; then
  last=$(count_images | cut -d" " -f1)
  [ -n "$last" ] && echo "$last" > "$STATE"
fi
echo "watching $LEX from count=$last (whisper every $STEP)"

while true; do
  sleep "$POLL"
  read -r n need <<< "$(count_images)" || continue
  [ -n "${n:-}" ] || continue
  if [ "$n" -ge $((last + STEP)) ]; then
    made=$((n - last))
    curl -s -m 10 -X POST "$HUB" \
      -H "x-ossicle-token: $TOKEN" -H "Content-Type: application/json" \
      -d "{\"bee\":\"atelier\",\"name\":\"Atelier\",\"priority\":\"normal\",\"category\":\"info\",\"text\":\"$made new paintings — $n done of the ~$((n + need)) the full 4-per-sense gallery will hold.\"}" >/dev/null
    last=$n
    echo "$last" > "$STATE"
    echo "$(date -Iseconds) whispered at $n ($need remaining)"
  fi
done
