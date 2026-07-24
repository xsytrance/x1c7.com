# Video render playbook — every cut ships as a pair

Standing rule (owner, 2026-07-23): **every directed Kinetica video is delivered
twice** — the desktop 16:9 master and a mobile 9:16 version. The 9:16 is a
**native portrait re-record**, never a crop: the stage lays itself out for the
tall frame (phrase lines wrap, art fills the height), so both cuts look
designed, not adapted.

## The one command

```bash
# both aspect ratios, back to back (~2× realtime + encode):
DISPLAY=:0 node scripts/perf/render-cut.mjs --both \
  --track <slug> --from <sec> --to <sec> \
  --base http://localhost:3218 \
  --out scripts/song-analysis/profiles/<slug>/<slug>-cut.mp4
```

Outputs land side by side:

| file | frame | purpose |
|---|---|---|
| `<name>.mp4` | 1920×1080 · 30fps | desktop / YouTube / site |
| `<name>-vertical.mp4` | 1080×1920 · 30fps | phone / Suno hook / Shorts / Reels |

Single-aspect runs: omit `--both` (16:9) or add `--vertical` (9:16 only).
QA loop first: `--shots 8` plays the window once and drops stills instead of
recording.

## Timing: the pixel clock (v2 — do not regress this)

The first rig stamped frames with CDP screencast `metadata.timestamp` mapped
through a sampled anchor. **Measured error: ~390ms constant** (CDP stamps run
ahead of the frame's true content time), which shipped videos with lyrics
~0.4s ahead of the audio — the owner heard it immediately.

v2 stamps every frame with a **pixel clock**: a strip of binary cells at the
top of the viewport encodes `audio.currentTime` in ms, painted in the same
rAF the engine renders from. The rig decodes the strip from each captured
JPEG (that decoded value IS the frame's timestamp), crops the strip out of
the output, and trims audio sample-accurately with `atrim` (never an mp3
input `-ss`, which is only frame-accurate). Output is 60fps to halve CFR
quantization.

Every render ends with a **closed-loop VERIFY**: the strip alone is rebuilt
through the identical concat+fps timeline, decoded back out of the encoded
result, and the residual |A/V error| is printed (median/p95). Healthy is
single-digit-to-low-double-digit ms; the rig flags >40ms. If VERIFY
complains, trust it over your eyes and bisect the pipeline.

Word-timing truth is a separate question from pipeline truth: use the onset
checker (librosa, vocal-band onsets vs `lyrics_synced` times for pre-gap
words) to confirm the alignment itself — on this catalog it measures within
±40ms (median ~5ms), so pipeline error dominates.

## How the rig works (scripts/perf/render-cut.mjs)

- Drives `/studio?track=<slug>&embed=1&autoplay=1&pass=6&mode=dynamic&t=<from>`
  in headful Chromium on the real GPU; the `?t=` start-seek is a studio-page
  contract added for this rig.
- Captures via CDP screencast; every frame is stamped against the **audio
  clock** (the player's `new Audio()` element, reached via a constructor hook),
  then assembled VFR → 30fps with the exact audio slice muxed from the
  profile's `release.mp3` (0.35s fades). Sync is a few ms.
- Chrome-free frame: player bar, beat pill, sound pill, and the Next dev
  indicator are hidden by injected CSS; the boot ceremony is skipped via
  `localStorage x1c7-boot-seen`.
- Mic permission is granted so a `blow` moment can never raise the primer
  banner — but keep the window free of interactive moments anyway (see below).

## Pre-flight checklist for a directed cut

1. **Server**: the rig needs a server running CURRENT code — `:7272` is a
   production `next start` (old build); run `npx next dev -p 3218` for renders
   after engine changes, or rebuild+restart 7272 deliberately.
2. **Planet hygiene for the window** (all in Supabase `tracks.planet`):
   - no `interactions.moments` overlapping the window (wipe veils sit unwiped
     and blow/shake show prompt banners in a passive recording);
   - section intensities **≤ 0.71** across the song, or a synthesized "shake"
     banner appears on the peak section (`allMoments`, threshold 0.72);
   - `dynamicPlus`: acts (billing chips), `modes` (the phrase↔dynamic
     schedule), `scene` (e.g. `"SYRUP"`), `words` (per-word FX).
3. **Scene art**: one painting per lyric line, anchored via
   `planet.assets.keywords` (the illustrate-the-scene law — see
   `scripts/song-art/summer-drip-scenes.mjs` for the pattern). Keep anchor
   words ≥ 1s apart to avoid backdrop churn.
4. **Reel**: hand-pin `lexicon-reel.json` featured entries, publish to R2.

## Share encodes (chat/socials size caps)

```bash
# 16:9 → ~28 MB
ffmpeg -i in.mp4 -c:v libx264 -preset slow -crf 23 -vf scale=1600:900 \
  -c:a aac -b:a 160k -movflags +faststart out-share.mp4
# 9:16 → ~18 MB
ffmpeg -i in-vertical.mp4 -c:v libx264 -preset slow -crf 24 -vf scale=810:1440 \
  -c:a aac -b:a 160k -movflags +faststart out-vertical-share.mp4
```

## Reference render

Summer Drip (2026-07-23): window 176.4–236.9, both cuts + share encodes in
`scripts/song-analysis/profiles/summer-drip/`. The direction data lives in that
profile's `dynamic-plus.json` (applied to Supabase) — use it as the template
for the next song.
