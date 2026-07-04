#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# CLEANUP — delete the OLD, now-orphaned storage after the reorg + Supabase
# migration. VERIFIED SAFE before writing this: no Supabase row (hidden or not)
# references these files; the live site serves audio from music/, covers from
# covers/, planet art from planets/. Run only AFTER confirming the live site
# plays audio + shows covers.
#
#   bash scripts/song-art/cleanup-old-storage.sh
#
# Deletes: MP3/ folder (41 files) + the 9 legacy "xsytrance - *.mp3" root files.
# Keeps: music/ covers/ planets/ lexicon/ lexicon.json (everything current).
# The old x1c7-art bucket covers are left as-is (this token can't write there).
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail
cd /home/xsyprime/x1c7.com || exit 1
set -a; . ./.env; set +a
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_REGION=auto \
  RCLONE_CONFIG_R2_ACCESS_KEY_ID="$ACCESS_KEY_ID" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$SECRET_ACCESS_KEY" \
  RCLONE_CONFIG_R2_ENDPOINT="$ENDPOINT"

echo "→ deleting old MP3/ folder (41 files)…"
rclone delete "R2:$BUCKET/MP3" --s3-disable-checksum

echo "→ deleting 9 legacy root files…"
while IFS= read -r f; do
  [ -z "$f" ] && continue
  rclone deletefile "R2:$BUCKET/$f" --s3-disable-checksum && echo "  ✓ $f" || echo "  ✗ $f (already gone?)"
done <<'EOF'
xsytrance - Different This Summer.mp3
xsytrance - I Don't Quit Right Now.mp3
xsytrance - I Won’t Be Your Fire (Japanese Mix).mp3
xsytrance - I Won’t Be Your Fire.mp3
xsytrance - I'm That Somebody.mp3
xsytrance - Mi Gente.mp3
xsytrance - My Soul Lives In Seoul.mp3
xsytrance - Paper That Cut You.mp3
xsytrance - Still Me_ Still You.mp3
EOF

echo
echo "✦ cleanup done. Bucket top level should now be: music/ covers/ planets/ lexicon/ lexicon.json"
rclone lsf "R2:$BUCKET" --dirs-only
