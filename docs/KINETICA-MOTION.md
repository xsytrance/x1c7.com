# Kinetica — the motion & melody system

What the stage knows about the song, and every knob that spends it. The
playbook (`VIDEO-RENDER-PLAYBOOK.md` §27–§29) records how each of these was
found, in the order it hurt. This is the same material organised as a system,
for a session that needs to *use* it rather than re-derive it.

**Everything here defaults to the old behaviour.** A cut that sets none of these
knobs renders byte-identically to how it did before 2026-09-23.

---

## 1 · What the engine measures

| file | written by | carries |
|---|---|---|
| `stems.json` | `analyze_stems.py` | `beats`, `kicks`, `snares`, `hats`, `cuts` (drum-silence windows), `risers`, per-stem loudness `env` at 12.5 Hz, `align.lag` |
| `melody.json` | `analyze_melody.py` **or** `melody_from_midi.py` | per-word `{i, t, midi, pc, conf}` + the song's `key` |
| `senses.json` | (a profile's local copy of stems.json) | same shape |
| `barGrid()` | `stemSense.ts`, at runtime | `beatSec`, `barSec`, `phase`, `downbeats`, `strength`, `margin` |

All times are on the **release mp3's clock**. `analyze_stems.py` cross-correlates
the stems against the release and folds the offset in, so nothing downstream
should ever re-apply `align.lag`.

### The margin rule

`barGrid` infers the downbeat by asking which beat-phase actually carries kicks.
It reports `strength` (the winner's hit rate) and `margin` (winner minus
runner-up). **Gate on margin, never strength:**

| song | strength | margin | |
|---|---|---|---|
| hajimemashite | 0.71 | **0.37** | real downbeat |
| fast-enough | 0.91 | **0.09** | four-on-the-floor; every phase scores alike |
| one-tap-away | 0.84 | **0.01** | no downbeat information at all |

Strength alone would have confidently mis-phased two of three. Anything that
*aligns* to the downbeat requires `margin >= 0.15` and silently falls back
otherwise. Anything that only needs bar **length** works everywhere.

---

## 2 · Melody

`melody.json` gives each word the note it was sung on. Consumers: word hue
(circle-of-fifths distance from the tonic), octave-driven word scale, melodic
motion on entry/exit, and `featureBus.setKey`.

**Take the notes from Suno's MIDI export, not from pYIN.** Across the 50 songs
with a pYIN `melody.json`, only **4–41% of words** (typically ~1 in 5) clear the
engine's `conf >= 0.35` gate, so the melody sense was mostly dark in shipped
cuts. From MIDI it is ~93%, needs no librosa, and runs in under a second.

```bash
node scripts/stem-analysis/melody-batch.mjs --only <slug> --force \
     --midi assets/stems/<song>-midi [--publish]
```

- The MIDI vocal track is a **contour, not a syllable track** (111 notes under
  134 words). Read notes by OVERLAP with each word's window, never by matching
  onsets.
- **The clock comes from the drums.** Vocal-onset agreement is ~29% even at the
  correct offset; drum onsets against `stems.json` kicks peak unmistakably
  (82% vs a 26% background). The analyzer exits non-zero without that peak.
- **Suno's MIDI key signatures are garbage** — the 0x59 `sf` byte must be −7..+7
  and Suno writes 15 and 12. Key comes from K-S on the notes instead.

### Colour

- `pitchSpread` (0..1) — how far a note may pull a word's hue off the theme.
- `pitchSat` / `pitchLight` (0..100, default 82/66) — **lightness is contrast.**
  `pitchColor` used to pin lightness flat, which silently overwrote a word's
  legibility; on a grade whose art sits at the theme hue that is gold-on-gold.
  Spread cannot fix it: narrow loses words on bright plates, wide loses them on
  dark ones.
- `palette[0]` anchors the whole pitch wheel. `hexHue()` returns **190 for any
  grey**, so a palette leading with white or near-black anchors the song to a
  cyan its art does not contain (6 of 74 tracks). `themeHueFrom()` skips greys.

---

## 3 · The camera

Two independent systems. Know which one you are tuning.

**The cinematic camera** — `pass >= 5`, so it runs on **every** cut whether or
not `deck.motion` is set. Its default is three free-running sines, and
`sin(t * 0.10)` has a **63-second period**: across a 60s cut it performs one
slow sweep, unrelated to tempo. It never rests and never lands.

- **`deck.camSync: true`** — hold on the downbeat, accelerate, arrive as the bar
  ends, hold again. Frames completely still go from **14% → 54%**. Needs margin.

**The per-plate move** — `ART_MOVES` / `WIDE_MOVES`, 12 presets, gated on
`deck.motion`. **56 of 71 directed cuts never set it** and therefore run the
default `scale 1.06 → 1.16 over 24s, linear` on every plate.

- **`deck.motion.sync: true`** — snap a shot's `dur` to whole bars. Bar length
  only, so it works even where the phase is ambiguous.
- **`deck.motion.ease: "arrive"`** — accelerate into the endpoint instead of
  easeOut's settle.

**Do not build a parallax driver.** `--par-x/--par-y` are genuinely zero in a
headless render, but they share a transform with `--cam-*`, which is alive. One
was built, A/B'd, measured to change nothing, and removed (§28).

---

## 4 · The picture

- **`deck.artSync: true`** — a plate swap waits for the next downbeat instead of
  landing whenever the `swapMs` throttle expires (an arbitrary point in the
  bar). Capped at 1.5 bars. Also lets a **drum return cut the picture
  immediately**, so the image lands ON the drop rather than a beat after it.
- **`deck.inserts: { every, hold, at, height, minPush }`** — a SECOND plate,
  hard cut into a band and gone again, riding the same bar counter `camSync`
  steps on. No crossfade: a crossfade is what a slideshow does between slides.
  - Draws from shown-history ∪ `assets.keywords` ∪ gallery. History alone is not
    enough — a cut can hold one plate for a whole act.
  - Lives at `-z-[9]`: above the backdrop (`-z-10`), below every text layer.
  - `at: "bottom", height: 34` keeps the two planes out of each other's way;
    a centred 40% band fights centred lyrics.

---

## 5 · How to know whether any of it worked

This system has produced, repeatedly, changes that *look* fine and do nothing.
Three rules paid for in this repo:

1. **Make the check able to fail.** "Most words got a note" scored 133/134 — and
   129 with the MIDI shifted 1.7s off. A check that passes at every offset is
   worse than no check.
2. **Measure the engine, not the pixels.** A downscaled frame-difference cannot
   see a camera move of 0.35 px/frame and will report "no change" for a change
   that is real. Drive the page with playwright and sample `--cam-x` off the
   **stage root div** (it is not on `documentElement`).
3. **A stopped clock looks exactly like a dead branch.** There is no
   `<audio>`/`<video>` element on the studio page to check `paused` on, so watch
   the data: a bar counter frozen at one value while energy never moves is
   frozen playback, not a broken feature. Verify in a real render, which plays.

4. **A vision model needs a control it cannot fail, and a NEGATIVE one too.**
   Local VLMs can check renders, but only if the question is shaped for them
   and both controls pass:

   - **Ask the easy question.** "Does the word grow across these 12 filmstrip
     tiles?" was answered "no" by `qwen3-vl:8b` even on a strip synthesised to
     grow 1.0x -> 2.6x. The same model, shown **two labelled panels** and asked
     "bigger in A, bigger in B, or the same?", gets it right. The format was
     the failure, not the model.
   - **Bigger is not better.** `gemma3:12b` answered "B BIGGER" to all three
     images including the negative control — a yes-bias that makes every
     answer worthless. The 8b model that passed its control is the more useful
     instrument.
   - **Watch for silence.** `qwen3-vl:8b` returns an empty completion on some
     images. An empty answer is not a "no".

   Use the model to corroborate a pixel measurement, never as the only witness.

5. **Compare against natural variation, not against zero.** Words already
   differ in size (`stagecraft` size tiers x delivery x octave), so "the peak
   word is bigger than a typical word" is true in every cut. The honest figure
   is the ratio WITH the effect against the ratio WITHOUT it, measured the same
   way: the fly-past scores peak/typical word area **13.3x (about 3.6x linear)**
   against **2.9x (1.7x linear)** for the same window with the effect off.

Preflight (`scripts/perf/cut-preflight.mjs`) now checks the hue anchor and
reports how many words in the window actually clear the melody gate — both
classes of silent failure it used to pass.

---

## 6 · The row trap

A cut's direction lives in its own track row (`hajimemashite-v5`), while the
profile folder, stems, release.mp3 and melody live under the **base** slug
(`hajimemashite`). Rendering `--track hajimemashite` produces a technically
valid video with none of the art direction — no camera, one flat phrase window,
no quakes. It cost a full render and a wrong deliverable. Check which row
carries `dynamicPlus.deck.motion` before rendering, and pass
`--audio scripts/song-analysis/profiles/<base>/release.mp3` for a `-vN` row.
