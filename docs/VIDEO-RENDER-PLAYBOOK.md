# Directed-cut playbook — everything we learned, cut by cut

The complete workflow for shipping a directed Kinetica video (16:9 + native
9:16 pair) for a song. Seven cuts deep as of 2026-07-25: summer-drip,
different-this-summer, fast-enough, cocktails-and-code, drink-drink,
say-it-with-your-body (×6 revisions — the richest lesson mine). Every rule
below was paid for.

Standing owner laws:
- **Both aspects, always** — 16:9 master + NATIVE 9:16 re-record (never crop).
- **Illustrate the scene** — art depicts the lyric's literal narrative, not
  word-matched decoration. Re-read the lyrics before art direction.
- **Own planet per song** — every song gets a DISTINCT art voice; resemblance
  only for songs in "similar orbit". Voices used so far: purple-gold comic
  noir, coral sunrise comic, 16-bit pixel + cars, '80s airbrush chrome,
  chiaroscuro oil, urban LED nightclub silhouettes.
- **Eyes on output** — visually audit every deliverable (zoomed crops, count
  the figures, read the letters) BEFORE shipping. VERIFY numbers prove sync,
  never looks.

## 0 · The one command

```bash
# from the repo root (cwd MATTERS — a stray `cd` into profiles/ breaks
# relative paths and the render dies with MODULE_NOT_FOUND):
node scripts/perf/render-cut.mjs --both \
  --track <slug> --from <sec> --to <sec> \
  --base http://localhost:3218 \
  --out scripts/song-analysis/profiles/<slug>/<slug>-30.mp4
```

| file | frame | notes |
|---|---|---|
| `<name>.mp4` | 1920×1080 · 60fps | master, crf 18 |
| `<name>-vertical.mp4` | 1080×1920 · 60fps | native portrait master |

- Headless by default (GPU via `--use-angle=vulkan`); survives a locked
  screen. `--headful` for eyeball debugging.
- `--shots 8` = stills-only QA pass of the window.
- `--ss 1` disables supersampling (don't — see §5).

## 1 · Pre-flight

1. **Dev server on :3218** with current code (`npx next dev -p 3218`).
   `:7272` is a stale production build — never render against it.
2. **release.mp3 in the profile** — fetch from R2 `music/` by LISTING the
   bucket (`rclone lsf`); filenames carry smart quotes/brackets, never guess.
3. **Re-analysis if stems predate the truncation fix** (libsndfile read only
   ~64% of every Suno stem before 2026-07-23): run ultimate.mjs audio-only,
   upload new senses.json → R2 `stems/stems.json` (back up the old one to
   `pre-refix-backup/`).

## 2 · Lyrics — verify before you direct (the say-it lesson)

The screen can only be as right as `tracks.lyrics_synced.words`. Check the
window's words against the OFFICIAL lyrics before doing anything else:

- **The LCS aligner degenerates on repeated chorus lines.** Six identical
  "Say it with your body" lines collapsed onto single timestamps and
  stretched one line across 4s; "Lagos" was invisible. Fix = rebuild the
  section's word times by hand from the whisper transcript's segment
  boundaries (transcript.json start/end per sung line, words distributed
  evenly inside), then SQL the corrected array into `lyrics_synced.words`
  and mirror it into the profile's aligned.json (backup first).
- **Strip stage-direction labels.** `(Male)`, `(Female)`, `(Together)`,
  `(whisper)`, `(Both)` leak into the word stream and render as sung words
  ("FEMALE" floating mid-video). Purge across the WHOLE track, not just the
  window.
- **Held notes**: give the word its true START time; the engine now keeps it
  (see §6 MAX_HOLD). "saaaame" appears when the singer opens her mouth and
  clings through the sustain.
- After edits, sanity-query the window ordered by t and read it out loud
  against the official section.

## 3 · Scene art — the SDXL Turbo survival guide

Per-line scenes in the song's own voice (script pattern:
`scripts/song-art/body-scenes*.mjs` — SDXL Turbo @ :8188, 1152×832, steps 4,
cfg 1.0, euler_ancestral).

**SDXL Turbo cannot count people.** ~60 generations of "exactly two people"
prompts yielded 3–5 figures nearly every time. Working tactics, in order:

1. **Medium close-up two-shot framing** ("two figures fill the frame,
   waist-up") — structurally limits the cast better than any count word.
2. **Over-the-shoulder framing** for watcher/performer scenes.
3. **Crop a clean pair out of a multi-couple composition** (PIL crop at the
   1.3846 target ratio → lanczos up to 1152×832 → GaussianBlur 0.4). The
   model composes couples beautifully even when it over-populates.
4. **Corner vignette** (soft black ellipse) over a stray limb in a dark zone;
   **clone-patch** (flipped neighboring texture, feathered mask) over a stray
   limb on a busy LED wall.
5. **Shadow-crush** (brightness ×0.72–0.82 + gamma 1.15–1.25 point LUT) sinks
   too-lit faces back into silhouette while neon stays hot.

Audit EVERY candidate with your own eyes (contact sheets → full-res of
shortlist): count the people, check faces/skin against the brief, check pose
mood (the "creepy hooded pair" got rejected — poses must read warm/sexy, not
ominous). Reject-and-re-roll; never pick the least-bad.

Publish: webp q90 (ffmpeg libwebp — cwebp isn't installed), upload to R2
`planets/<slug>/scene-<word>.webp`, then **byte-verify the edge** (curl the
public URL with a cache-buster, compare sizes). Reusing an existing filename
skips all SQL.

**Content risk for Suno hooks**: scan lyrics AND art for suggestive content
(Summer Drip's hook was rejected). Keep a tamer variant path in mind.

## 4 · Planet data wiring (Supabase `tracks.planet`)

- `assets.keywords` — word → scene URL (`/planets/<slug>/scene-<w>.webp`).
  Anchors ≥1s apart *after* any lyric retiming (we dropped `body` when the
  corrected times put it 0.7s from `slowly` — the climax `assets.sections`
  emotion still carries that art ambiently). Adding a keyword mid-window
  gives a scene change per sung response — great for chorus ladders.
- `assets.sections` — emotion → scene for ambient coverage between hits.
- **gallery.json on R2 pools per-word art variants that BYPASS
  assets.keywords** — upload `{slug, model, art:{}}` (backup first) or old
  art photobombs the video.
- `analysis.sections` intensities ≤0.71 (0.72+ synthesizes a "shake" banner).
- No `interactions.moments` overlapping the window (trim wipe ends).
- `dynamicPlus`: acts (billing pills — keep labels honest: the four-city act
  reads BROOKLYN → MANILA → LAGOS → SAIGON), `modes`, `words`, `scene`,
  `deck` (see §6).
- Everything revertible: code via git, data via `pre-refix-backup/`.

## 5 · Render rig facts (scripts/perf/render-cut.mjs)

- **Pixel clock** (do not regress): every frame carries audio.currentTime as
  binary cells painted in the engine's own rAF; frames are stamped by
  decoding the strip; `atrim` cuts audio sample-accurately; closed-loop
  VERIFY decodes the finished timeline (healthy ≤ ~16ms median, flag >40ms).
  CDP screencast timestamps run 180–700ms ahead — never trust them.
- **Supersampling `--ss 2` (default)**: capture at 2160×3896 via
  `--force-device-scale-factor=2` and downscale in assembly. This is the
  jagged-text fix: yuv420p stores chroma at quarter res, and saturated text
  on a mid background (hot pink on sage) keeps its edges ONLY in chroma —
  1× renders stair-step. Facts: screencast output is DIP-bound (context
  `deviceScaleFactor` and `Emulation.setDeviceMetricsOverride scale` do NOT
  raise it); the browser flag works but MULTIPLIES with Playwright's context
  DPR (keep context at 1); probe geometry and ffmpeg crop scale by SS.
  ~60fps holds at 2× on the 5060 Ti even with heavy FX.
- **Share encodes at NATIVE resolution** (no more 810×1440 downscale):

```bash
ffmpeg -i in.mp4 -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 160k -movflags +faststart out-share.mp4   # both aspects
```

- x264 `slow` can outlive the 600s tool timeout — `medium` + background.
- Renders re-read the DB on page load — data changes need no server restart;
  ENGINE changes need the dev server to recompile (it does, on request).

## 6 · The emotional treatment (engine features, all data-drivable)

- **Mode conductor micro-windows** (`dynamicPlus.modes`): drop into `dynamic`
  for each call-and-response answer so SLOWLY / HOLD ME / SHOW ME / KNOW ME
  render as HUGE single words (with a tape-warp one-shot per switch), snap
  back to `phrase` for the verse line. ~1.5–2s windows aligned to the
  response words; leave the switch ≥0.05s before the next verse word.
- **WORD_FX tranche 6** (registry + KineticStage): `quake` (violent shake),
  `tilt` (off-axis swing), `squeeze` (embrace-pinch), `cling` (enter big,
  settle over the FULL airtime — the held-note treatment). Map via
  `dynamicPlus.words`; earlier tranches: chop, drip, melt, echo, pulse,
  bloom, rise, tremor…
- **`dynamicPlus.deck`** `{density, glow, grain, vignette}` — plumbed
  planet → studio → KineticStage at pass 6. density 2.4 = the owner's "lots
  of particles". Per-song, no code.
- **MAX_HOLD fix** (KineticStage words memo): the engine used to snap any
  word with a >2.5s gap to the next word up against that next word — which
  silently DELAYED held notes by seconds ("same" appearing after the note
  ended). Now gated to line-dumped lyrics only (word sharing its stamp with
  the previous word). Any "word appears too late" complaint on word-synced
  lyrics: check this class of engine heuristic FIRST, before touching data.

## 7 · QA before delivery (the Inspector discipline)

1. VERIFY numbers from both renders (≤ ~16ms median).
2. Extract 4–6 frames from the files you'll actually SHIP (the share
   encodes), at the exact moments that changed: each keyword hit, each new
   FX, the retimed word. `ffmpeg -ss <t> -i share.mp4 -frames:v 1`.
3. 2× zoomed crops (`crop=…,scale=…:flags=neighbor`) of text when fonts/
   encode changed; A/B raw captured frame vs encoded frame isolates which
   stage degraded.
4. Count the people in every art frame. Read the words. Check the act pill.
5. Deliver via SendUserFile: 9:16 first (the Suno/socials file), 16:9 second.

## 8 · Next-song quickstart (copy this order)

1. Pre-flight (§1) → pick the 30s window from sections/whisper.
2. Verify + repair the window's lyrics (§2). Read them out loud.
3. Art-direct a NEW voice (owner picks/confirms vibe) → generate → eyes-on
   audit → publish + edge-verify (§3).
4. Wire planet data (§4): sections, acts, mode windows, word FX, keywords,
   deck. Trim moments.
5. Render `--both` (§0/§5) → QA (§7) → share encodes → deliver.
6. Log the new voice + any new gotcha in memory
   (summer-drip-directed-cut.md) and this file.
