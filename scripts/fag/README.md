# Forged Above Gold — the 62s cut

Tyler Haze × Kizuna Sato, *The Fire Cycle · Chapter V*. Twelfth art voice:
**THE ANVIL LIGHT**. Window **199.36 → 261.40 (62.04s)** — the whole final
chorus, the break, the spoken ending and the two whispers the song ends on.

Slug: `forged-above-gold-fire-cycle`.

## Run order

```bash
# ComfyUI first — the service instance hangs in the VAE, see finding 2
cd ~/AI/ComfyUI && .venv/bin/python main.py --listen 127.0.0.1 --port 8190 \
  --fp32-vae --disable-smart-memory &

node scripts/fag/build.mjs                        # verify times + write row.json
~/librosa-venv/bin/python scripts/fag/art.py      # 20 plates x 2 variants
~/whisper-venv/bin/python scripts/fag/people.py   # grade the two artist portraits
node scripts/fag/pick.mjs                         # eyes-on picks -> plates/<key>.png + picks.json
node scripts/clip/publish-scenes.mjs --slug forged-above-gold-fire-cycle --map scripts/fag/picks.json
node scripts/fag/publish.mjs               # stems.json + cover
node scripts/_kiz-db.mjs upsert scripts/fag/row.json
# RESTART the dev server — a tracks patch is invisible to a running one (playbook §5)
node scripts/perf/cut-preflight.mjs --track forged-above-gold-fire-cycle --from 199.36 --to 261.40
node scripts/perf/render-cut.mjs --vertical --track forged-above-gold-fire-cycle \
  --from 199.36 --to 261.40 --base http://localhost:3218 \
  --out scripts/song-analysis/profiles/forged-above-gold-fire-cycle/forged-above-gold-62.mp4
```

## What this cut learned

### 1. There were already TWO other "Forged Above Gold" entries, and neither is this song

`void-into-gold-forged-above-gold-mix` is a **332s female-gospel boom-bap
anthem** with a complete profile, planet, splice and analyzer entry;
`oro-de-la-presion-forged-above-gold` is a third. Searching the repo by title
finds them first. Anything that resolves a song by title alone will silently
work on the wrong record here — check `identity.title` and the duration before
trusting a profile directory whose name matches.

### 2. ComfyUI hangs forever in `AutoencoderKL` with a bfloat16 VAE

**This is the whole reason art generation appeared to be broken.** The
symptom looks exactly like the PRIME freeze: HTTP stops answering, the GPU sits
at 0%, ~7GB stays held, and no further log line ever arrives.

It is not a freeze and it is not VRAM. Sampling completes normally (26s for
832×1472 / 28 steps) and the log's last line is always:

```
Requested to load AutoencoderKL
Model AutoencoderKL prepared for dynamic VRAM loading. 159MB Staged.
```

The service unit runs bare `main.py`, so the VAE lands on
`cuda:0, dtype: torch.bfloat16` and the decode never returns. `VAEDecodeTiled`
does not help — it is the same VAE path. **`--fp32-vae` fixes it outright**;
two plates then take 38s total.

Rather than change the user's `comfyui.service`, this cut runs its own instance
and leaves the service alone:

```bash
cd ~/AI/ComfyUI && .venv/bin/python main.py --listen 127.0.0.1 --port 8190 \
  --fp32-vae --disable-smart-memory
```

`art.py` points at `:8190`. Kill it when the batch is done.

> Also worth knowing: the service listens on **:8189**. `:8188` is a
> systemd socket that raises it on demand.

### 3. A slow ComfyUI is not a wedged ComfyUI — do not diagnose it with a short curl

ComfyUI serves HTTP on the same event loop that runs sampling, so
`/system_stats` can take **13+ seconds** to answer while the GPU is busy. A
health check with `curl -m 6` reports the server dead and sends you restarting
a process that was working fine. Diagnose a real hang with **GPU utilisation at
0% plus no new journal line**, not with an HTTP timeout.

### 4. Whisper parked six words of the spoken outro inside silence

The sung body of the song aligned cleanly, but everything after the break did
not. Whisper placed `The` at 240.84 and `fire` at 242.72 — the lead stem is at
−70 to −103 dB across that whole span. The real line starts at **244.36**, so
those two words were **3.5 seconds early**, and `It`/`taught` were similarly
parked inside the scripted `[Pause]` (246.40–249.00).

Nothing about the transcript looks wrong; the segment text is correct and the
word probabilities are 0.90+. Only the RMS map catches it. The four post-break
lines are hand-timed here from 10ms voiced-span boundaries, and `build.mjs`
gates every onset (−42 dB for the sung body, −52 dB for the two whispers, which
sit ~20 dB lower).

### 5. `analysis.palette` is the WORD colour array, not a mood board

Preflight failed the first render attempt on this:

```
FAIL  palette contains near-black entries (#2A1B12) — the engine draws words
      from this array, so roughly one word in 4 renders invisible
```

The palette had been written as *the voice's colours* — gold, rust, the shadow
tone, violet — which is the natural thing to write and completely wrong.
KineticStage assigns sung words a colour from this array, and this film's frames
are near-black, so the shadow entry would have silently swallowed a quarter of
the lyric. Every entry must be legible on the darkest frame in the cut.

### 6. Do not diagnose a background job with `pgrep -f <pattern>` from a shell whose own command line contains that pattern

Three chained waiters (`until ! pgrep -f "scripts/fag/art.py"; do sleep; done`)
each matched **themselves** and never exited, so a re-roll queued behind them
never started and looked like a hung GPU. Match on the interpreter plus script
(`pgrep -f "python.*art[.]py"`), or check for the output file instead.

## What the verifiers check

`build.mjs` refuses to write `row.json` unless all five pass:

| check | why |
|---|---|
| −42/−52 dB RMS on every word onset | catches whisper parking a word in silence |
| MAX_HOLD line-dump gate | a word <0.15s after its predecessor with >2.5s ahead gets moved, and drags its scene painting with it |
| LRC stamps resolve to their own first word | `phraseStartIdx` takes the nearest onset on either side and will steal the previous line's last word |
| scene cuts ≥1s apart | closer than that and nothing cuts |
| shot-size histogram | ≥⅓ WIDE, ≤¼ CLOSE+MACRO — the cheap number that would have caught both hajimemashite cuts |

It found one real defect on the first run: `burn` fires **twice** in this window
(215.60 and 236.74) and the second hit landed 0.50s before `forever`. Fixed by
pointing `begging` at the `burn` plate and dropping the separate anchor.

## The people

Tyler and Kizuna appear as **one graded portrait each, from their own
photographs** — never generated, never matted. `people.py` documents the two
approaches that failed first (u2net returned the album **wordmark** as the
subject, then returned him as a blob) and why a real photo, graded into the
voice, beats both.

Each lands on their own line: hers at `fuerte` (212.10, *"Más fuerte que
ayer"*), his at `stand` (219.10, *"I can stand in the quiet"*). His grade is
warm (the forge), hers is cold (the quench and the cover's violet) — read off
the single artwork, where he is gold-lit and she is violet-lit.

Everything else in the film has no people in it at all.

## Window facts (all measured, not assumed)

| | |
|---|---|
| master | 261.60s · 8 stems, all decoding to 261.43s |
| stem drift | **none** — constant −0.05s, confirmed independently by `analyze_stems.py` (lag −0.023, score 0.98) |
| the drop | **201.70** — `analyze_stems.py` independently found the riser at 197.68→201.66 |
| the break | 241.60, all stems to −100 dB |
| the scripted pause | 246.40–249.00, 2.6s of true silence, left empty |
| the anvil pulse | 254.90–258.30 |
| SHARED_WORDS in window | **none** — no cross-song art can photobomb this cut |
| explicit content | none in the window (the one f-bomb is at ~70s) |


## The shot-size histogram earned its place

The first complete pick set measured **WIDE 27% · CLOSE+MACRO 36%** — both
outside the targets, i.e. the exact "powerpoint of close-ups" failure §17 was
written about. The fix was one plate: `fire` is the only keyword that fires
**twice** in the window, so its size counts double. Re-rolling it from a coke
macro into a wide establishing shot of the burnt-down hearth moved the whole set
to **WIDE 41% · CLOSE+MACRO 23%**.

Worth remembering: when a histogram is off, look for a repeated anchor before
re-rolling four separate plates.


## Two things the first render got wrong, and preflight did not catch

Both were found by pulling frames out of the finished file — the check that no
number replaces.

- **A `hits` accent blew the frame to white.** One hit was authored on the drop
  (201.70, dur 1.0). In a film where every frame is near-black it rendered as a
  full second of blown white. Removed; the mix lands the drop on its own.
- **The window opened on 4.3 seconds of black.** The first keyword was `flame`
  at 203.64, and `analysis.sections[0].at` was set to `FROM` — a section whose
  boundary *equals* the render start is never crossed, so no section art ever
  came up either. Fixed by starting that section at 190.00 (before the window,
  so it is already active on frame one) and pointing `came` (202.66) at the
  `flame` plate.
- Also `deck.motion.swapMs` 900 → 650: at 900ms two plates were visibly
  cross-dissolved into a double exposure on every cut.
