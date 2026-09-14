# Days Drift By — the 59.2s vertical cut (PAPER RIVER)

Seventeenth voice. Liquid drum & bass that refuses to hurry, cut to a
three-window splice and illustrated as ukiyo-e woodblock: **one forested river
valley across one day**.

## The pipeline, in order

```bash
# 1 · transcript — Parakeet TDT on the ISOLATED lead stem, never the mix
ffmpeg -y -i "0 Lead Vocals.mp3" -ar 16000 -ac 1 lead.wav
export LD_LIBRARY_PATH="$HOME/whisper-venv/lib/python3.14/site-packages/nvidia/cudnn/lib:$LD_LIBRARY_PATH"
~/whisper-venv/bin/python scripts/ddb/transcribe.py lead.wav out.json

# 2 · verify anything the ASR claims, against stem energy
python3 scripts/ddb/rms_map.py lead.wav 150 200 0.5

# 3 · words + windows (fails if any window would trip preflight's 6s dead-air rule)
python3 scripts/ddb/build_words.py

# 4 · art — proof ONE plate before batching (§12a, and this voice's cartouche problem)
python3 scripts/ddb/art.py --ckpt dream --variants 2 days
python3 scripts/ddb/art.py --ckpt dream --variants 2
bash scripts/ddb/sheet.sh                      # contact sheets @340px
bash scripts/ddb/corner_audit.sh <plate> ...   # full-res corner read — see below
python3 scripts/ddb/art.py --ckpt dream --variants 4 --seedbase 70000 by stay rain heron

# 5 · row + plates
python3 scripts/ddb/build_row.py               # self-checks the silent schema traps
node scripts/_kiz-db.mjs upsert scripts/ddb/row.json
node scripts/ddb/upload-r2.mjs                 # R2, edge-verified — public/planets is NOT enough

# 6 · restart the dev server (data changes are invisible until you do), preflight, render
node scripts/perf/cut-preflight.mjs --track days-drift-by-cut --from 110.829 --to 133.840
bash scripts/ddb/render.sh
```

## The windows

| part | window | beats | content |
|---|---|---|---|
| A | 110.829 → 133.840 | 210 → 255 | Verse 2 + the Bridge ascent |
| B | 154.111 → 177.656 | 295 → 341 | the final chorus |
| C | 181.743 → 195.558 | 349 → 376 | the drift-away repeats |

60.37s raw, **59.17s** after two 0.6s crossfades. Every edge is on a beat, and
both joins are bar-aligned (40 beats = 10 bars, then 8 beats = 2 bars), so the
`acrossfade` in `merge-cuts.mjs` blends drum patterns that are in phase.

**Why three windows.** This song has no 60 contiguous dense seconds anywhere —
it is built out of long instrumentals (24.5s, 28.8s, and a 9.1s liquid break).
The obvious two-window cut runs 60.8s and `cut-preflight` FAILS it: the break
is 24% of that window, over the 6s of dead air a viewer reads as "it's broken".
Splicing **inside** the break rather than around it removes 4.09s of it, leaves
3.10s and 1.96s on either side, and keeps every lyric including the ending.

## What this song cost, specifically

- **The repo's own `lyrics.lrc` invents a line.** It stamps a final "Days drift
  by" at 210.92. The lead stem is digitally silent (-98 dB) from 203.5 to the
  end. The last real lyric is "by" at 190.80.
- **191–202 is not silence and not words**: ~-25 dB of sustained wordless vocal
  texture (the sheet's "distant vocal echoes"). Parakeet renders it as "Breath
  of the city" spread across 13 seconds with a word at 203.84, inside the
  silence. Discarded.
- **A short slice recovers lines the full pass loses.** The full-song pass
  missed the whole "Days drift by / We don't have to know why / ... / Floating
  into the sky" run; re-running Parakeet on just the 39s Part-B slice resolved
  every one of them with usable onsets.
- **`sun finds HIS way`**, not "its" — the lyric sheet says "its", but the ASR
  and the repo's own hand-built LRC independently agree on "his". Sung text won.
- The uploaded stems' mp3 headers claim 181s–372s for a 212.35s song. Decode,
  never trust the container.

## The cartouche

Real woodblock prints are signed, and the model knows it. An unweighted negative
listing kanji / calligraphy / signature / seal / cartouche **did nothing**. Two
changes fixed it:

1. Stop calling it a "print" in the positive. The model renders a print as a
   complete OBJECT — paper margin and signature block included. Ask for a
   "ukiyo-e woodblock style illustration ... full bleed ... unsigned".
2. Weight the glyph terms, and name the THING rather than the writing:
   `(artist signature:1.8)`, `(red seal:1.8)`, `(vertical text column:1.7)`,
   `(inscription:1.6)`.

Even then it leaked on 6 of 22 plates — always in ONE corner, always invisible
on a 340px contact sheet. `corner_audit.sh` crops all four corners at full
resolution; that is the only thing that caught them.
