# "I Won't Be Your Fire" — 4 new keyword paintings (SHIPPED 2026-07-06)

Rendered locally (SDXL-Turbo, song house style), staged in
`public/planets/i-won-t-be-your-fire/`, and now live on R2 + wired into the
planet. Each maps to a specific lyric line:

| word  | lyric                                   | files                      |
|-------|-----------------------------------------|----------------------------|
| knife | "I won't be your **knife**" (4:20)      | knife.webp / knife-2.webp  |
| cage  | "without entering the **cage**" (3:41)  | cage.webp / cage-2.webp    |
| moon  | "without becoming your **moon**" (3:30) | moon.webp / moon-2.webp    |
| wire  | "both hands on the **wire**" (1:35)     | wire.webp / wire-2.webp    |

Both steps below are **done**. Kept as the runbook for the next keyword drop.
(Once the R2 write creds in `.env` returned `401` — stale/rotated — they were
refreshed on 2026-07-06 and both steps ran clean.)

## Step 1 — upload the 8 webps to R2

Two ways; pick whichever is handy.

**a) aws4fetch signed-PUT (no rclone needed) — what actually shipped this drop:**

```bash
node scripts/song-art/fire-new-keywords.upload.mjs
# loads .env, PUTs all 8 webps via the same aws4fetch path feed-worker.mjs uses,
# then HEAD-verifies each is 200 on PUBLIC_URL. Exit 0 = all live.
```

**b) rclone (what topup.mjs / feed.mjs use):**

```bash
# NOTE: rclone is a userspace install at ~/.local/bin/rclone (no sudo / not the
# dnf package). It's on your login PATH, but a cron/systemd job with a minimal
# PATH must call the full path or add ~/.local/bin. Update it with `rclone selfupdate`.
set -a; source .env; set +a
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_REGION=auto \
  RCLONE_CONFIG_R2_ACCESS_KEY_ID="$ACCESS_KEY_ID" \
  RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$SECRET_ACCESS_KEY" \
  RCLONE_CONFIG_R2_ENDPOINT="$ENDPOINT"
for f in knife cage moon wire; do
  for s in "" "-2"; do
    rclone copyto "public/planets/i-won-t-be-your-fire/$f$s.webp" \
      "R2:$BUCKET/planets/i-won-t-be-your-fire/$f$s.webp" \
      --s3-disable-checksum --s3-no-check-bucket
  done
done
# verify:  curl -sI https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/planets/i-won-t-be-your-fire/knife.webp | head -1
```

## Step 2 — wire them into the planet (Supabase `tracks.planet`)

Run `scripts/song-art/fire-new-keywords.sql` (or paste it into the SQL editor;
Supabase project `kxbrjmbovjiwwcnepsfh`). Adds knife/cage/moon/wire to
`analysis.keywords` (charged), `assets.keywords` (backdrop art), and `assets.alt`
(twin alternation). Only do this AFTER Step 1, or those words will 404 to an
empty backdrop on the live show.

Idempotent — safe to re-run. The `RETURNING` reports the result: this drop landed
**13** total keywords (9 pre-existing + the 4 new; the "expect 11" in the SQL
comment was an under-estimate), 7 moments, `new_kw_art = true`.
