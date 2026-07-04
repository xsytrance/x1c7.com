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
  node scripts/song-art/topup.mjs --target 100 --limit 120 \
    && echo "$(date -Iseconds) · ✦ art top-up batch done" \
    || echo "$(date -Iseconds) · ✗ art top-up failed"
else
  echo "$(date -Iseconds) · · ComfyUI not up — skipping art top-up"
fi
