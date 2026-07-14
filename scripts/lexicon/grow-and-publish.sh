#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# LEXICON · grow + publish — the nightly cron entrypoint.
#
# harvest (pick up any newly-onboarded songs) → dream (fill new legos on the
# frontier) → publish (upload the shelf to R2). Every x1c7 + Kinetica install
# then fetches the update on next load, no redeploy. "Grows while you sleep,
# for everyone."
#
# Installed in crontab to run nightly. Logs to cron.log beside this script.
# Run it by hand anytime: bash scripts/lexicon/grow-and-publish.sh
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail
export PATH="/usr/bin:/usr/local/bin:$PATH"   # cron has a minimal PATH
cd /home/xsyprime/x1c7.com || exit 1

echo "── $(date -Iseconds) · nightly build ──"

# 1) LEXICON — harvest new songs → dream new legos → publish the shelf to R2.
if node scripts/lexicon/harvest.mjs \
   && node scripts/curator/gravity.mjs --grade-limit 60 \
   && node scripts/lexicon/dream.mjs --limit 999 \
   && node scripts/lexicon/publish.mjs; then
  echo "$(date -Iseconds) · ✦ lexicon done"
else
  echo "$(date -Iseconds) · ✗ lexicon step failed (see above)"
fi

# 2) ART TOP-UP — render more paintings per song toward 100 (needs ComfyUI up).
#    Batched so it's a few minutes of GPU, not a marathon. Output is gitignored;
#    a publish+wire step (x1c7-art R2) ships it once creds are in place.
if curl -sf --max-time 5 http://localhost:8188/system_stats >/dev/null 2>&1; then
  node scripts/song-art/topup.mjs --target 100 --limit 4000 \
    && echo "$(date -Iseconds) · ✦ song art top-up done" \
    || echo "$(date -Iseconds) · ✗ song art top-up failed"
  # Lexicon community art — the Atelier fills senses by WORD GRAVITY
  # (heavy words 6 images, mid 2, light 0 — curator/gravity.mjs decides).
  # 1200/night ≈ a few hours of GPU; heavyweight engines render last.
  node scripts/lexicon/art.mjs --limit 1200 \
    && echo "$(date -Iseconds) · ✦ lexicon art done" \
    || echo "$(date -Iseconds) · ✗ lexicon art failed"
  # 3) THE CURATOR — the machine looks at tonight's paintings (vision
  #    readings, cached forever), grades any new borderline words, and
  #    rebuilds the reels of songs whose vocabulary gained art. Runs AFTER
  #    the render batches so Ollama and ComfyUI trade the GPU cleanly;
  #    every curator step ends by unloading its model (keep_alive 0).
  node scripts/curator/vision-worker.mjs --limit 400 \
    && echo "$(date -Iseconds) · ✦ vision readings done" \
    || echo "$(date -Iseconds) · ✗ vision worker failed"
  for reel in scripts/song-analysis/profiles/*/lexicon-reel.json; do
    [ -e "$reel" ] || continue
    id=$(basename "$(dirname "$reel")")
    node scripts/curator/match-reel.mjs --song "$id" --publish >/dev/null 2>&1 \
      && echo "$(date -Iseconds) · ✦ reel refreshed: $id" \
      || echo "$(date -Iseconds) · ✗ reel failed: $id"
  done

  # Gravitational feed — drain any queued feed jobs (safety net for the watcher).
  node scripts/feed-worker.mjs \
    && echo "$(date -Iseconds) · ✦ feed queue drained" \
    || echo "$(date -Iseconds) · ✗ feed worker failed"
else
  echo "$(date -Iseconds) · · ComfyUI not up — skipping art top-up"
fi
