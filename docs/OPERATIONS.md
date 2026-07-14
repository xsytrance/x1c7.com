# Operations — how the living system runs

_Where things live, what runs itself, and the few commands you'll ever need._

This ties together the effects engine, the Lexicon, the shared-with-Kinetica engine,
and the R2 storage. Deep-dives: [`EFFECTS-AND-LEXICON.md`](EFFECTS-AND-LEXICON.md),
[`ENGINE-SYNC.md`](ENGINE-SYNC.md).

---

## Where everything lives

**One R2 bucket — `x1c7-music`** (`https://pub-d3fd6ef07c…r2.dev`):
```
music/         all 47 songs
covers/        all album art
planets/       planet backdrop art  +  <slug>/gallery/ (top-up art)  +  <slug>/gallery.json
               + <slug>/profile.json (Sonic Dossier)  +  <slug>/booklet.json (THE BOOKLET)
               + <slug>/show.json (word timings + LRC + analysis backfill)
lexicon/       per-word generated art (lexicon/<word>/sN-n.webp)
lexicon.json   the hosted word shelf (words · legos · imagery · image URLs)
```

**Supabase is the runtime source of truth for tracks.** Project `kxbrjmbovjiwwcnepsfh`,
table `tracks`. The live site reads `audio_url` / `cover` / `planet` from there —
`src/data/tracks.ts` is only the SSR/first-paint fallback. **If you move a song or cover
in the bucket, update the `tracks` row too**, or the live site won't see it.

**The repo** holds the code + the bundled `src/data/lexicon.json` fallback. Planet art is
served from R2 (via `engineHost.PLANET_BASE`), not the repo.

---

## What runs itself — the nightly pipeline (cron, 1 AM ET)

`scripts/lexicon/grow-and-publish.sh` — now a **systemd user timer**
(`lexicon-grow.timer`, 1 AM, `Persistent=true` so a sleeping machine runs it
on wake; the crontab install died in the 2026-07 OS reinstall and the timer
replaced it 2026-07-14) — does, in order:

1. **Lexicon grow** — `harvest.mjs` (pull new songs' words) → `dream.mjs` (fill legos) →
   `publish.mjs` (upload `lexicon.json` to R2).
2. **Song art top-up** *(if ComfyUI is up)* — `topup.mjs` renders backdrops toward
   **100/song**, uploads to R2 `planets/<slug>/gallery/`, updates each `gallery.json`.
3. **Lexicon art** *(if ComfyUI is up)* — `art.mjs` renders **2 images/word-sense**,
   uploads to R2 `lexicon/<word>/`, writes the URLs into `lexicon.json`, republishes.

Everything publishes to R2, so growth reaches the live site + every Kinetica install
**with no redeploy**. Idempotent — once a target is met, the step is a no-op. Logs:
`scripts/lexicon/cron.log`.

> Cron only fires if the machine is awake at 1 AM. If it sleeps, switch to a systemd
> timer with `Persistent=true`.

---

## The commands you'll actually use

```bash
# Grow + publish everything right now (what the cron runs):
bash scripts/lexicon/grow-and-publish.sh

# Just the shelf (fast, no GPU):
node scripts/lexicon/harvest.mjs && node scripts/lexicon/dream.mjs && node scripts/lexicon/publish.mjs

# Fill art faster / on demand (needs ComfyUI at localhost:8188):
node scripts/song-art/topup.mjs --target 100 --limit 4000     # song backdrops
node scripts/lexicon/art.mjs --per-sense 2 --limit 4000        # word art

# Ship a song's separated Suno stems to the live mixer (transcode → R2 → SQL):
node scripts/stem-analysis/publish-stems.mjs --stems <suno-stem-dir> --slug <track-id> \
  --stems-json <stems.json>          # see docs/STEM-MIXER.md

# Release the shared engine to Kinetica:
node scripts/engine/sync-to-kinetica.mjs --apply

# Verify every song's audio + cover resolves (after any storage change):
npx tsx scripts/verify-track-urls.ts
```

R2 uploads need `--s3-disable-checksum` (a rclone/R2 quirk) — the scripts already pass it.
Credentials live in a gitignored `.env` (`ACCESS_KEY_ID` / `SECRET_ACCESS_KEY` / `ENDPOINT`
/ `BUCKET` / `PUBLIC_URL`).

---

## The storage reorg → live checklist (already done once)

When you re-home files in the bucket, the live site only follows if Supabase does too:

1. **Copy** files into the new location (additive — old paths keep serving).
2. **Update Supabase** `tracks.audio_url` / `cover` (SQL string-replace) — *this* is the
   go-live for the site.
3. **Verify** every URL 200 (`verify-track-urls.ts` for the static list; a SQL preview +
   HTTP check for the live rows).
4. **Only then delete** the old objects: `bash scripts/song-art/cleanup-old-storage.sh`.

Planet art is different: the engine rewrites relative `/planets/…` → R2 at render
(`PLANET_BASE`), so no Supabase change is needed for backdrops.

---

## Browse it

- `/galaxy` — the songs as planets.
- `/lexicon` — the word shelf, now visual: each word wears its generated art; open one to
  see its senses, palettes, legos, imagery, and image gallery. `?word=<w>` deep-links.
- `/vr` — the WebXR lyric world.
