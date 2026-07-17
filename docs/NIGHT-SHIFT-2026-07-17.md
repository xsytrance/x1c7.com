# Night Shift — 2026-07-17 (00:59 → 05:48 EDT)

One overnight run of `scripts/lexicon/night-shift.sh`, alternating **show
auditing** (a vision model scans every full show's images for song fit, word
match, render quality, and lyric timing) with **painting** (Atelier batches
toward 1000 new images). Stopped by the owner at 05:48, mid-cycle 7, at a
clean cycle boundary. GPU never left the 40s (°C); the 82°C cooling gate and
86°C SIGSTOP watchdog were armed all night and never needed to fire.

## Totals

| metric | value |
|---|---|
| images painted | **722** (10 chunks; 23 failed renders retried into later chunks) |
| lexicon shelf now | 1551 words · 5849 senses · **4260 images** |
| shows audited (VLM, pixel-level) | **30** — 655 reel images scanned, 0 errors |
| new reels built | **24** (4 songs had reels before tonight → **28** now, all republished to R2 `planets/<id>/lexicon-reel.json`) |
| images pruned + rerolled | **7** (all repainted before dawn; regen queue drained) |
| misfits documented (kept, flagged) | 7 |
| lyric-timing flags | 69 (see below) |
| vision index | 1853 → **3645** cached readings (`lexicon-vision.json` republished) |
| average scores across scanned reel images | quality 0.89 · wordMatch 0.89 · songFit 0.79 |

Nightly text growth (harvest → gravity → dream → publish) ran first, same as
the cron would have: 56 songs harvested, no new shelf words (frontier stable).

## The 7 prunes (documented in `scripts/curator/prune-journal.jsonl`, reason `show-audit`)

Every prune was journaled with the VLM's concrete issues, deleted from R2,
removed from `sense.images`, and its slot **rerolled** (new recipe + seed +
filename) then repainted the same night:

| word | show | q / wm | why |
|---|---|---|---|
| somebody | 1st-of-the-month-walk-it-out | 0.75 / 0.30 | silhouettes too generic to read as "somebody" |
| respuestas | 23-respuestas | 0.90 / 0.30 | painted text reads "respiates", not "respuestas" |
| light | between-the-stations | 0.20 / 0.40 | extreme blur, no distinct light subject |
| light | days-drift-by | 0.30 / 0.80 | extreme blur, subjects unreadable |
| slow | fast-enough | 0.90 / 0.30 | "slow" neon contradicts the song's speed theme (songFit 0.2) |
| slow | jayodeed-going-crazy-rooklyn-mix | 0.90 / 0.30 | nothing in frame expresses slowness |
| membrane | membrane-still-insane | 0.90 / 0.30 | off-word and off-story (songFit 0.2) |

Pattern worth knowing: abstract tempo/identity words ("slow", "somebody",
"membrane") fail on **wordMatch** with clean renders — the reroll gives them a
different recipe, which is the right lever. Both "light" prunes were the
same failure mode (blur) — render-quality, not concept.

## Misfits (documented only — reading refreshed, reel judge re-decided on rebuild)

`international-heat/light`, `i-don-t-quit-right-now/night`,
`i-don-t-quit-right-now/soul`, `i-won-t-be-your-fire-japanese-mix/fire`,
`low-lights-tokyo-night/body`, `membrane-still-insane/storm`,
`one-tap-away-riverboat-bad-boys-remix/dream` — each scored songFit < 0.45 on
pixels. Their cached readings were replaced with what the image actually
shows, and the post-audit `match-reel` rebuild re-judged them from that.

## Lyric timing — 69 flags investigated, 63 were the auditor's own mistake

**Correction (morning session).** The overnight audit checked reel cues
against the local `aligned.json` — but 8 of the 9 flagged songs have
`qa.pass: false` there (header junk stamped `t=0`, clumped words, drift).
The reel cues come from Supabase `lyrics_synced`, which is what the player
actually shows (`useTracks.ts`), and the human-authored `lyrics.lrc` sides
with Supabase (e.g. summer-drip "Gold chain" at 01:03.0 ≈ cue 63.588 — the
"27.3s drift" was aligned.json being wrong). So the timing checker was
convicting good cues with bad evidence.

`show-audit.mjs` fixed accordingly: aligned.json is only trusted when its
QA passed (ignoring unplaced `t=0` words), otherwise it falls back to
line-level LRC checking (±8s), otherwise no verdict — plus a `--timing-only`
mode that re-verifies cues in seconds without the VLM. Re-run over all 28
reels: **summer-drip verifies fully clean (32/32 cues)**, and 69 flags
collapse to **6 distinct genuinely-suspect cues** in 5 songs:

| song | word | cue t | Δ | evidence |
|---|---|---|---|---|
| move-over-minimal-groove-mix | move | 0.05 | 12.5s | cue sits at t≈0 — intro/title junk in lyrics_synced |
| move-over-minimal-groove-mix | somebody | 0.72 | 106.5s | same t≈0 junk |
| ceasefire-…-data-storm-version | silence | 59.2 | 73.5s | "silence" not sung near there (LRC) |
| fast-enough | night | 25.6 | 75.3s | "night" not sung near there (LRC) |
| jayodeed-going-crazy-rooklyn-mix | crazy | 3.8 | 23.9s | first "crazy" sung ~27.7s |
| brooms-in-the-boiler-room | brooms | 29.1 | 4.8s | marginal — just over tolerance |

These are **Supabase-side cue errors** (mostly first-occurrence picks
landing on t≈0 intro tokens): the affected images would pop at the wrong
lyric moment in the live show. Fix is upstream of the reels: clean the
t≈0/wrong-first-occurrence words in `tracks.lyrics_synced` for those 5
songs (or teach match-reel to skip t≈0 first occurrences), then rebuild
their reels. All verdicts: `audit-journal.jsonl`, `action:"timing-only"`.

## What's new in the codebase (tonight's tooling, reusable)

- **`scripts/curator/show-audit.mjs`** — VLM show auditor. Scans reel images
  in song context (songFit/quality/wordMatch + issues[]), refreshes
  vision-index readings + embeddings, checks lyric timing, journals to
  `audit-journal.jsonl`, and with `--apply` prunes + rerolls + queues regen
  (`.audit-regen.txt`). 20h freshness window makes re-runs cheap.
- **`scripts/lexicon/art.mjs`** — per-slot `reroll` bumps (`s.reroll` in
  lexicon.json): a pruned slot repaints with a different recipe, prompt,
  seed, and filename (`-rN` suffix) instead of regenerating the identical
  deterministic image.
- **`scripts/lexicon/night-shift.sh`** — the orchestrator: SCAN ⇄ GEN cycles,
  cool-gate (pause ≥82°C / resume ≤70°C), 20s SIGSTOP watchdog (≥86°C),
  Ossicle whispers (`atelier-night` bee), dawn wind-down that re-arms
  `lexicon-grow.timer` after touching its systemd stamp so `Persistent=true`
  doesn't double-run the night.

## State on handoff

- `lexicon.json` + `lexicon-vision.json` published to R2; all 28 reels
  published. `lexicon-grow.timer` re-armed → next run Sat 2026-07-18 01:00
  (no catch-up fired; stamp touched).
- Ollama models unloaded, ComfyUI VRAM freed (GPU idle, 46°C, ~2.4GB —
  Ossicle's resident share).
- 22 aligned songs still have no reel (the queue wrapped at 30 of ~50);
  another night-shift run — or just the SCAN half — will finish them.
