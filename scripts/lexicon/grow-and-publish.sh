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

echo "── $(date -Iseconds) · grow + publish ──"
if node scripts/lexicon/harvest.mjs \
   && node scripts/lexicon/dream.mjs --limit 999 \
   && node scripts/lexicon/publish.mjs; then
  echo "$(date -Iseconds) · ✦ done"
else
  echo "$(date -Iseconds) · ✗ failed (see above)"
  exit 1
fi
