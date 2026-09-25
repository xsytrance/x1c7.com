# Directed-cut playbook — everything we learned, cut by cut

The complete workflow for shipping a directed Kinetica video (16:9 + native
9:16 pair) for a song. Ten cuts deep as of 2026-07-31: summer-drip,
different-this-summer, fast-enough, cocktails-and-code, drink-drink,
say-it-with-your-body (×6 revisions — the richest lesson mine),
maybe-was-the-answer, hajimemashite (the first cut for a song that was not
already in the catalogue), different-this-summer-debut (the AGENOR Facebook
debut — first PORTRAIT-ONLY cut, see §15). Plus one RE-cut: hajimemashite v2
for the Kizuna Solo Revamp, 2026-08-01 — first time an already-shipped cut had
its audio replaced under it (see §16). Every rule below was paid for.

Standing owner laws:
- **ONE video: 9:16 only, master quality** *(owner law 2026-08-01 — REPLACES
  "both aspects, always")*. Ship a single vertical master. Do not render 16:9,
  do not produce `-share` encodes, do not hand over four files. The owner's
  words: *"i only need 1 video; not 4. just the vertical 9:16 high quality
  version."* Render with `--vertical`, not `--both`.
  Consequence that is easy to miss: with no 16:9 deliverable there is no reason
  to author landscape art ever again — see the next law.
- **Generate art NATIVE PORTRAIT, 832×1472** *(owner law 2026-08-01)*. Never
  author landscape plates for a vertical cut. See §17 — this is the single
  biggest quality bug we have shipped.
- **Illustrate the scene** — art depicts the lyric's literal narrative, not
  word-matched decoration. Re-read the lyrics before art direction.
- **Own planet per song** — every song gets a DISTINCT art voice; resemblance
  only for songs in "similar orbit". Voices used so far: purple-gold comic
  noir, coral sunrise comic, 16-bit pixel + cars, '80s airbrush chrome,
  chiaroscuro oil, urban LED nightclub silhouettes, ultraviolet-noir photoreal,
  risograph duotone, Osaka gold-leaf night (photoreal, Kontext — see §12),
  blueprint dawn (photoreal + cyan drafting linework, Kontext — see §15),
  THE AUDIBLE DESERT (§18), THE ANVIL LIGHT (§19), SƠN MÀI LACQUER (§20),
  Osaka WET NEON re-cut (§21), ONE WORLD GATE (§22), THE GOLDEN ATLAS (§23).
- **Eyes on output** — visually audit every deliverable (zoomed crops, count
  the figures, read the letters) BEFORE shipping. VERIFY numbers prove sync,
  never looks.

## 0 · The one command

```bash
# from the repo root (cwd MATTERS — a stray `cd` into profiles/ breaks
# relative paths and the render dies with MODULE_NOT_FOUND):
node scripts/perf/render-cut.mjs --vertical \
  --track <slug> --from <sec> --to <sec> \
  --base http://localhost:3218 \
  --out scripts/song-analysis/profiles/<slug>/<slug>-30.mp4
```

| file | frame | notes |
|---|---|---|
| `<name>-vertical.mp4` | 1080×1920 · 60fps | **the deliverable**, crf 18 |

`--vertical`, not `--both` — one video, 9:16, master quality (owner law
2026-08-01, top of this file). The 16:9 pass and the `-share` encodes are
retired; ship the vertical master itself. `--both` still works if a 16:9 is
ever specifically asked for, but it is no longer the default and never the
deliverable.

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
- ENGINE changes need the dev server to recompile (it does, on request).
- **Data changes DO need a dev-server restart.** The old note here said
  renders re-read the DB on page load. They do not: Next's fetch cache holds
  the track row from the server's first read, so a `tracks` patch applied
  while the server is up is invisible to the render. Symptom is nasty because
  it looks like an engine bug — on the hajimemashite v2 QA sheet the giant
  word froze on "WHAT" for 15s while the ambient line and act pill advanced
  correctly (those come from data the page had already resolved). Restart the
  server after ANY `_kiz-db.mjs patch`, then re-shoot. `rm -rf
  .next/cache/fetch-cache` alone is not enough.

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

## 9 · Ingesting a song that is NOT already in the catalogue

`hajimemashite` was the first cut built from a bare Suno export. Order that
worked: stems + master → conform → analyse → hand-align → art → row → render.

- **Suno mp3 headers lie.** `ffprobe` reported 224s / 511s / 696s for seven
  stems that all decode to 169.75s. ALWAYS take duration from a decode
  (`ffmpeg -i x -f null -`), never the container. `analyze_stems.py` already
  decodes via ffmpeg for exactly this reason.
- **The stems and the master are NOT the same timebase.** A "Stems" export and
  the "Revamp" master of the same song were a *drifting* −0.53s → −0.26s apart:
  same performance, stems running 0.166% slow. Word times measured on the vocal
  stem then land up to half a second wrong against the audio the render uses.
  Detect with a windowed envelope cross-correlation; if the lag *drifts*, a
  constant offset cannot fix it — `analyze_stems.py`'s `align` is a single
  global number and will happily report a healthy score anyway.
  Conform the stems onto the master first:

  ```bash
  # fit master_t = m * stem_t + c over confident windows, then:
  ffmpeg -i stem.mp3 -filter:a "atempo=$(1/m),atrim=start=$(-c/m),asetpts=PTS-STARTPTS" out.mp3
  ```

  For this song m=1.001657, c=−0.5996 (residual rms 14 ms); afterwards
  `analyze_stems.py` measured the leftover offset as +0.023s.
- **Transcribe the CONFORMED vocal stem, not the mix** — and use two passes.
  `medium` was cleaner on the verses; `small` caught the belted final chorus
  that `medium` lost under the backing vocals. Take segment boundaries from
  whichever heard each section, and let the OFFICIAL lyrics supply the text.

## 10 · Phrase-mode line breaks come from the LRC, and they matter

`phraseStartIdx` (KineticStage:420) builds lines from LRC stamps in
`tracks.lyrics`. **With no stamps it falls back to breath-gap segmentation
capped at 12 words per line** — which overruns 1920px and clips the last word
off the right edge (the title word, in our case). Symptom: long readable lines
that end in a half-letter.

- Write real stamps (`[mm:ss.cc]text`) for every line in the window; keep lines
  **≤7 words**. Each stamp must land within **0.6s** of a word onset or it is
  silently ignored, and at least `max(2, words/40)` must match or the engine
  drops back to breath-gaps.
- Unstamped lines and `[Section]` headers are skipped, so the full lyric can
  still live in the column with only the window stamped.

## 11 · `dynamic` mode is not free — it clips at loud moments

The mode conductor's HUGE-single-word treatment scales with vocal *delivery*,
so the loudest moment of the song overflows the frame **regardless of token
length**: `naaaame` → "NAAAAM", and shortening it to `name` still clipped. It
also double-draws during the switch ("KIZUNAKIZUNA SATO SATO").

- Reserve `dynamic` for quiet/mid moments, never a belt or a 13-character word.
- A dynamic window must contain **exactly one** word. `125.32–126.05` swallowed
  Kizuna + Sato + LevelReady and drew LevelReady huge on top of the phrase line
  ("SATOLEVELREADY").
- When in doubt ship **phrase throughout** — with correct LRC lines it reads
  better than a clipped spectacle, and 9:16 needs it anyway (§ maybe-was-the-answer).

## 12 · Character-consistent scene art from a real photo (Kontext)

The "own planet per song" law meets a named artist with a FACE. SDXL cannot
hold a likeness; **Flux Kontext img2img can** — it is an instruction-editor, so
it keeps the subject and rebuilds the world around them.

- `flux/kontext-max/image-to-image` via aimlapi, curl only (urllib gets
  Cloudflare 1010). ~$0.10/image, ~17s each. Key in `~/.bfl_key`.
- Prompt shape that worked: an explicit **identity clause** (name every feature
  and garment, "do not change her identity"), then the scene, then a shared
  **grade clause** so 17 scenes read as one voice.
- Feed it a LANDSCAPE canvas — scale the portrait to full height on a
  1152×832 bed, fill the sides with a blurred blow-up of the same photo, and
  tell it to fill the frame. It outpaints the sides convincingly.
- It still writes **gibberish signage** even when told not to; if a sign is the
  focal point, re-roll asking for an abstract light source instead of text.
- Ninth art voice: **OSAKA GOLD-LEAF NIGHT** — photoreal Dotonbori night graded
  to black and molten gold, her real face in all 17 scenes.

### 12a · Kontext returns a BLACK PLATE, and never tells you why

Three of sixteen hajimemashite v3 plates came back as solid black. The API
returns **HTTP 200 with a real image URL**, bills you (~$0.05 each), and the
file is simply black — no error, no moderation flag, nothing in the response
body. `walking`, `doors` and `face` all "succeeded" and the pipeline reported
them as done.

**Detect it, because nothing else will:**

- A black plate is **~2.2 KB** as webp (a real one is 70–390 KB). Size alone
  catches it — gate on it and quarantine.
- The refusal also comes back at the **wrong dimensions**: successful portrait
  requests return 752×1392, black ones return **1024×768**, the model's default.
  A landscape response to a portrait request means you got nothing.

**What actually causes it** (measured, in order of how much time each wasted):

1. **An over-written prompt.** This was the real cause for two of the three.
   `doors` failed at 2,565 characters and succeeded at 540 with the same scene,
   same source, same everything. It is not a length *limit* — `warm` succeeded
   at 3,191 — it is elaboration: stacked clauses, meta-language about "the film",
   heavy adjectival prose. Keep scene prompts tight and concrete; ~600–900
   characters is a good working band.
2. **A context-free facial close-up.** `face` failed three times — long prompt,
   short prompt, reframed prompt — while asking for "head and shoulders only,
   no environment". The same face in a street, waist-up, with a blurred crowd
   behind her, generated first try. `secret` (her face in canal water) and
   `reverl` (her laughing in an alley) never failed either. Kontext will edit a
   real person's likeness inside a world; it will not hand you a bare portrait
   crop of them. **Give every face shot an environment.**
3. **NOT `safety_tolerance`.** Raising it 2 → 5 changed nothing. Note it must be
   a **string**: `"5"` is accepted, `5` returns HTTP 400 "Validation failed".
4. **NOT the source image, and NOT the scene content.** `They` and `walking`
   share a source; `trap` and `doors` share one. In each pair one passed and one
   failed. Doors thrown open with light pouring out is not unsafe content.

The pipeline should verify every plate before it claims success — file size,
dimensions, and that the decoded image is not uniformly black.

## 13 · A hidden row is invisible to the renderer (again)

Restated here because it cost the first QA sheet of this cut too: `useTracks`
queries `hidden.eq.false,audio_url.like./private/*`. A `hidden=true` row with a
public `audio_url` makes the studio **silently fall back to another track** —
the render completes, VERIFY passes, and you get somebody else's song. Keep
`hidden=true` and point `audio_url` at `/private/<slug>.mp3`.
**Any "wrong song rendered" → check this first.**

## 14 · The frame banners are synthesised, not just choreographed

`cut-preflight` passing "no interaction moments overlap" does NOT mean no
banner. KineticStage:961 *invents* moments from the song when
`interactions.moments` is empty:

- **blow** ("blow the drop in") — from the sharpest RISE between consecutive
  `analysis.sections` intensities, if the delta is **≥0.25**, placed at
  `rise.at − 6 … rise.at − 0.5`. A quiet bridge (0.40) into a big chorus (0.70)
  put a "BLOW!" prompt over five seconds of this cut.
  Fix: keep every consecutive intensity delta **< 0.25**.
- **wipe** — the longest sung-word gap ≥7s. **Careful: synthesis is NOT gated
  on `interactions.moments` being empty.** It is gated on `free(t, end)`, which
  only refuses when a *choreographed* moment sits within **±8s of the
  synthesized window**. A decoy moment parked far away (we tried t=96) blocks
  nothing. To suppress a wipe, the blocker must be **adjacent** to it — and it
  can sit just past the cut's end so it is never drawn:
  `moments: [{ t: <cutEnd + 0.2>, end: <cutEnd + 1.2>, type: "wipe", … }]`.
  WWB's 8.6s ambience gap before the last whisper put a "WIPE THE ASH AWAY"
  prompt into the outro of an otherwise finished render. Nobody taps a rendered
  video, so any banner in a cut is stray UI.
- **shake** — any section intensity ≥0.72 (the one preflight already catches).

## 15 · The portrait-only cut (the AGENOR Facebook debut)

`different-this-summer-debut` was the first cut the owner asked for as **9:16
only** — an explicit override of the both-aspects law, because the deliverable
was one Facebook post. Rendering `--vertical` alone (no `--both`) is the whole
change at the rig; everything expensive is upstream of it.

Window 233.10 → 303.20 (70.1s). Scripts for the whole cut live in
`scripts/dts2/`; run them in this order, each is dry-run by default and takes
`--write`:

```bash
node scripts/dts2/fix-holds.mjs --write     # de-dump words MAX_HOLD would move
node scripts/dts2/fix-words.mjs --write     # redistribute line-dumped stamps
node scripts/dts2/fix-lrc.mjs   --write     # re-place LRC stamps (simulates the engine)
node scripts/dts2/verify-lyrics.mjs         # must print "all N lines OK"
python3 scripts/dts2/art.py                 # 16 Kontext Pro scenes
python3 scripts/dts2/endcard.py             # the 17th, composited
node scripts/clip/publish-scenes.mjs --slug different-this-summer/debut --map scripts/dts2/picks.json
node scripts/dts2/publish-gallery.mjs --write
node scripts/dts2/wire.mjs --write          # validates before it writes
node scripts/perf/cut-preflight.mjs --track different-this-summer --from 233.10 --to 303.20
node scripts/dts2/measure.mjs               # phrase lines: no overrun
node scripts/dts2/measure-dyn.mjs 244 300.8 # giant words: no overhang
```

**Mine the owner's own vault for the story, don't invent one.** `~/singularity`
(local API on :8801, `POST /api/search/answer`) indexes his chat/agent history,
and for this song it returned the autobiography the lyrics are *about* — the
9-6 job he finds boring, "building with AI really excites me; it doesn't even
feel like work", the GitHub and SoundCloud numbers. It also turned up that
AGENOR is his real given name and an inherited one (an ancestor, Puerto Rico →
New York), which is what made "same sun / new me" the closing beat instead of a
generic sunset. Ask it narrow questions; it answers with citations. This is the
cheapest possible way to make a cut personal, and it beats any prompt you could
write from the lyrics alone.

**Scene art must be generated PORTRAIT.** The stage draws scene art with
`object-cover`. A 1152×832 landscape plate in a 1080×1920 frame scales 2.31×
and keeps only **40% of its width** — every composition is centre-punched and
the thirds you art-directed are off-screen. Build the Kontext plates at 832×1472
instead (§12's blurred-blow-up outpainting trick works the same, just rotated).

**Phrase lines overrun at 1080px, and it is not the word count.** §10's "≤7
words" was measured against a 1920px master. At 1080 the five-word line "this
summer gon be different" already fills `max-w-[86vw]`, and then the word being
sung is drawn at `scale(1.22)` — a transform, which flex layout cannot see. The
last word gets pushed past the frame and the final letter is eaten
("DIFFEREN", "AWA"). Fixed in the engine, not the data: `.phrase-line` +
`.phrase-word` now take a tighter box, a shorter type ramp, and a wider
`column-gap` under `@media (max-aspect-ratio: 3/4)`, so portrait wraps to two
rows and 16:9 is untouched. The gap matters as much as the box — the sung
word's `scale(1.22)` grows a 150px word by ~16px each side, which exactly
swallowed the old 1.4vw gutter and ran the words together ("AINTLETTING",
"BEDIFFERENT"). `scripts/dts2/measure.mjs` walks every line in a window and
reports the furthest pixel any word reaches — run it before rendering a
portrait cut; a downscaled still is too lossy to judge a clipped letter from.

**`dynamic` is barely usable at 1080px, and word LENGTH is the real limit.**
This cut planned four dynamic windows (`time`, `here`, `Yeah`, `me`) and shipped
**two**. What kills the other two is not the belt (§11's warning) — all four are
quiet 2–4 letter words — it is that the giant word's *visual* width exceeds the
box the fitter measured:

- The fitter (KineticStage ~1645) reserves 78% of the frame as entrance
  headroom and computes a positional clamp — but its imperative `marginLeft`
  is overwritten by the element's own inline style on the next React render.
  The code says so in its own comment. So any treatment that inflates the word
  escapes the clamp and hangs off the LEFT edge.
- Everything inflates. An explicit FX inflates (`neon` measured **+24%** over
  its parent box); with no FX the default letter-assemble entrance spreads the
  glyphs even wider. There is no "safe" treatment, only words short enough to
  absorb the overflow.
- Measured at the render viewport: `time` left=**−60px**, `Yeah` left=**−42px**
  (its Y sliced off), `here` left=**+19px**, `me` left=**+245px**. Two letters
  is comfortable; four is a coin toss decided by the per-index stagecraft
  offset, which is deterministic — so **measure, don't hope**.
  `scripts/dts2/measure-dyn.mjs <t…>` prints every giant element's rect and
  flags overhang.

Verdict for portrait: spend `dynamic` on your two or three most important
moments, keep them very short, measure each one, and let phrase carry the rest.

**A dynamic micro-window double-draws its own word** — this is the real cause of
§11's "KIZUNAKIZUNA". The anchor ghost (KineticStage ~2269) is meant to be the
lingering shadow of a word we have moved PAST, but a directed micro-window holds
one word for its whole length, so the ghost and the giant word are the same
token at two scales ("YEAHH" over "YEAH"). Fixed by gating the anchor on
`anchor.key !== idx`. `deck.giant.pile: 0` does NOT cover this — the pile and
the anchor are different layers.

**`deck.motion.swapMs` must clear your tightest anchor gap.** The default 2000ms
silently swallows any scene change faster than 2s; this cut's tightest is 1.22s
(`breathe` → `fantasy`), so it runs at 900.

**Tranche 7 word FX**: `draft` (letters stroke in as cyan blueprint, then ink
solid — for a plan becoming a fact) and `wake` (arrives blurred and
letter-spaced, then snaps sharp — written for "no more sleepwalking").

**Tenth voice — BLUEPRINT DAWN.** Warm dawn photoreal under cyan architectural
drafting linework, and the linework THINS across the cut: the opening frame is
90% drawing, the last has none left. The song's own argument ("little by little
the vision gets official") rendered as a grade rather than decoration. Kontext
Pro img2img over the artist's own brand images (`assets/art/xsytrance/*`) keeps
one hooded, headphoned protagonist across all 17 scenes.

**Never let Kontext draw the artist's face.** Fed a silhouette source it will
happily invent a photoreal face, and it will not be his. Every scene in this
voice keeps him a back view or a silhouette; the one generation that produced a
face was rejected and re-rolled with "do NOT show his face".

**Composite the end card, never generate it.** §12 says Kontext mangles
lettering, and a debut post cannot ship a garbled label name. `scripts/dts2/
endcard.py` screen-blends the real `agenor-logo2a.png` (gold on pure black, so
screen drops the black with no hand-cut mask) over the cut's own `future`
sunrise — the same sun the lyric names.

**`gallery.json` will photobomb a re-voiced song.** `pooledArt`
(KineticStage:643) rotates its per-word variants in alongside `assets.keywords`,
and for words with no keyword of yours (`different`, `summer`) the OLD pool is
the *only* source. This song's pool held 66 images of the previous SDXL voice.
Empty it (`scripts/dts2/publish-gallery.mjs`) and publish the new art under a
`debut/` subpath so nothing is overwritten and the whole change reverts by
restoring two JSON backups.

**The one SHARED_WORD in the window was `time`.** `sharedArtFor` ghosts in
cross-song paintings for 17 common words at line-final/charged moments. Grep
your window against that list and give any hit a keyword of your own, or the
voice breaks mid-video. When two keywords resolve to the SAME url the ≥1s
spacing rule does not apply — nothing cuts, so `wire.mjs` compares resolved
urls rather than hit times.

**MAX_HOLD moves SCENE ANCHORS, not just words — and silently.** §6 documents
the heuristic as a lyric-timing fix; what it did NOT say is that a keyword whose
time it rewrites also drags its *painting* with it. KineticStage:325:

```js
if (out[i+1].t - out[i].t > 2.5) {                       // long rest ahead
  const lineDumped = i > 0 && out[i].t - out[i-1].t < 0.15;
  if (lineDumped) out[i] = { ...out[i], t: out[i+1].t - 0.45 };
}
```

Two words in this window qualified. `light` — a scene anchor — was moved
283.735 → 286.340, so the club painting arrived **2.6s after the word that
summons it**, and nothing anywhere reported it: preflight passed, VERIFY passed,
and the keyword-spacing check passed because it was reading the *raw* times.
The held `Ooh` was moved 287.646 → 290.369, which also dragged "right" into the
next lyric line ("RIGHT OOH NO MORE LOSING TIME" on screen).

The gate is `<0.15s after the previous word`, so the fix is in the DATA: give
the word an honest distinct stamp and the heuristic stops matching
(`scripts/dts2/fix-holds.mjs` re-runs the engine's own gate afterwards and
refuses to write while any victim remains). **Scan for this before wiring
keywords** — a scene anchor that is also a line-final held note is exactly the
shape that trips it.

**Placing an LRC stamp is not "put it just before the word".** `phraseStartIdx`
takes the nearest onset on EITHER side, and stamps are quantised to
centiseconds:

```js
while (words[i+1].t <= t) i++;
j = |words[i+1].t - t| < |words[i].t - t| ? i+1 : i;
if (|words[j].t - t| <= 0.6) starts.add(j);
```

So a stamp a hair nearer the previous line's LAST word starts the line one word
early and steals it. Three lines here did that, and `right`/`Ooh` were 10ms
apart — leaving exactly one legal centisecond value. Do not subtract a fixed
lead and hope: `fix-lrc.mjs` simulates that selection over every candidate and
keeps the one that resolves to the line's own first word. Watch the cursor
too — advancing to a line's LAST word instead of past it makes the next line
match the wrong token (it silently mis-broke the "Different, different,
different" stutter, and my first verifier reproduced the same off-by-one and
reported a false failure).

**Sanity-check what a "safe area" test is actually measuring.** The phrase-line
rects came back wider than their own `max-width` — because `getBoundingClientRect`
is viewport space and includes the stage's camera-push transform on an ancestor.
That is the number you want (it is what lands in frame), but only once you know
why it disagrees with the CSS.

## 16 · Re-cutting a song whose audio got revamped (hajimemashite v2)

Kizuna's debut came back as "Hajimemashite III — Kizuna Solo Revamp": same
song, 168.16s → 191.73s, verse 1 and one bridge line rewritten. A revamp is
NOT a new cut — most of the expensive work survives. Sort the assets first:

**Survives untouched** — the whole art planet. All 17 Kontext scenes, `deck`,
the 26-entry word-FX map, `assets.sections`, `analysis.palette`, `scene`.
Character-consistent art is the costly part and the singer has not changed.

**Must be rebuilt** — anything carrying a timestamp: `lyrics_synced`, the LRC
stamps in `lyrics`, `dynamicPlus.acts`, `dynamicPlus.modes`, and `senses.json`.

**Check by hand** — `assets.keywords`. Diff the old lyrics against the new and
find anchors whose word no longer exists. Here exactly one died: the bridge
lost "I wasn't discovered / I introduced myself" and gained "The doors swung
open, lights hit and we felt it", orphaning `introduced`.
**Open the orphaned art before you retire it.** `scene-introduced.webp` turned
out to be her stepping through a literal open doorway into the light — a
better illustration of the NEW line than the old one. Re-anchored
`introduced` → `doors`, no regeneration, no cost. Word-matching would have
thrown away a scene that already depicted the replacement.

**Two stale-pointer traps**, both silent, both shipped-looking:

1. `planet.assets.stems` points at R2 `planets/<slug>/stems/stems.json`.
   That file is the OLD `senses.json` until you re-upload it — the beat, kick
   and riser visuals will drive off the previous arrangement while everything
   else is correct. Confirm before overwriting (`md5sum` it against the v1
   profile's `senses.json`; here they matched exactly), back it up to
   `pre-refix-backup/`, upload, then byte-verify the edge.
2. The dev-server fetch cache — see §5.

**Finding the new window.** Don't scale the old one; the added time is never
evenly distributed (+23.6s here landed almost entirely in verse 1 and the
outro). Transcribe, find the same *sections*, and let the length fall out.
v1's window was 82.45–141.45 (59.00s); v2's equivalent is 97.60–157.55
(59.95s) — nearly identical duration at a completely different offset.

**Whisper on a breathy/processed lead vocal.** `medium` dropped all of verse 1
(a 27s hole) and looped "But it's delicious" ×4 — the classic
`condition_on_previous_text` hallucination. Re-run large-v3 with:

```bash
whisper "stems/0 Lead Vocals.mp3" --model large-v3 --language en \
  --condition_on_previous_text False --no_speech_threshold 0.35 \
  --initial_prompt "<the song's proper nouns and loanwords>" \
  --word_timestamps True --output_format json
```

Prime `--initial_prompt` with the names it will otherwise mangle (it still
heard "Tsuki tsuki sono sakto" for "Kizuna Sato" — fine, since official
lyrics supply the TEXT and whisper only supplies TIMING).

**Don't trust whisper word times through a mis-transcription.** It heard
"faith" for "face" in the final chorus, so the greedy official→whisper matcher
latched the first "Remember" onto the SECOND one and dragged the line 1.2s
late. Hand-time any line whisper got wrong, from 50ms RMS onsets on the vocal
stem. Then run the cheap mechanical check that catches the rest:

```
for each word: RMS(t, 0.18s) on the lead-vocal stem must be > -42 dB
```

Two words failed it here — whisper had parked "we" and "But" inside silence
(-64 dB and -72 dB), 0.34s and 0.65s before their true onsets. That check is
worth more than re-reading the alignment.

**mp3 header durations on Suno stems are garbage.** `ffprobe` reported the
lead vocal at 274.63s and percussion at 718.93s against a 191.73s release —
VBR without a Xing header, so it estimates from bitrate. Every stem decoded to
exactly 191.76s. Measure with a full decode (`ffmpeg -i x -f null -`) before
concluding a stem is broken; this looks exactly like the 2026-07-23 truncation
bug and is not it.

## 17 · The 58% crop — why landscape art makes every shot a selfie

**The worst bug in this playbook's history, and it shipped twice.** Read this
before authoring a single plate.

Scene art is drawn `object-cover` (`KineticStage.tsx`, `h-full w-full
object-cover`). Feed a 1184×880 LANDSCAPE plate into a 1080×1920 portrait
frame and the browser scales to cover the *height*: 1920/880 = 2.18×, so the
image becomes 2584px wide against a 1080px viewport.

```
visible width = 1080 / 2584 = 41.8%     →  58.2% of every image is thrown away
```

It is a **centre crop**, so it keeps the middle of the frame — the face — and
discards the world. Composition does not survive it. A carefully directed
medium two-shot arrives on screen as a head. Sixteen of them in a row arrive
as, in the owner's words, *"a powerpoint presentation of kizuna selfies"*.

**How it hides.** Every individual plate looks great in a contact sheet, and
the rendered video looks "fine but samey" — so the instinct is to blame the
prompts and ask for wider framing. That treats the symptom: ask for a wide
shot, lose 58% of it, get a medium shot. You cannot prompt your way out of a
geometry bug.

**The fix is generation-side, not prompt-side.** Generate native portrait
832×1472 (Flux Kontext honours an explicit portrait canvas — `scripts/dts2/art.py`
has done this since the AGENOR cut). Then `object-cover` into 1080×1920 is
nearly a no-op and the frame you directed is the frame that ships.

**Diagnose any existing planet in one line:**

```bash
for f in public/planets/<slug>/scene-*.webp; do \
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height \
  -of csv=p=0 "$f"; done | sort -u        # anything wider than tall = this bug
```

**THREE independent causes stack, and all three must be fixed:**

1. *Geometry* — landscape plates centre-cropped to portrait (above): −58.2%.
2. *The camera* — `ART_MOVES` (KineticStage.tsx ~line 256) holds 8 Ken-Burns
   presets and **every one of them sits at scale 1.10–1.29**. None rests at
   1.0. That multiplies on top of the crop:

   | stage | source width still on screen |
   |---|---|
   | landscape plate, `object-cover` into 1080×1920 | 41.8% |
   | × gentlest preset (s 1.10) | **38.0%** |
   | × strongest preset (s 1.29) | **32.4%** |

   Roughly **two-thirds of every plate never reaches the screen.** Worse,
   `artMoveFor(url)` picks the move by *hashing the image URL* — stable, but
   blind to content, so a wide establishing shot can be handed "push in to
   1.29" and stop being wide. Shot size must drive the camera: WIDE gets a
   move that rests near 1.00–1.06 or pulls out; only CLOSE/MACRO may push.
3. *Prompt shape* — §3's crowd-control tactic ("two figures fill the frame,
   waist-up") is a fix for SDXL over-populating a **two-person** scene. Applied
   to a **solo artist** it just orders a close-up every time. For a single
   subject, direct shot size explicitly and vary it.

**The lexicon has the same bug, all 15,930 of it.** `scripts/lexicon/art.mjs`
line 41 is `const W = 1152, H = 832` — every Lexsycon painting is landscape.
object-cover into 1080×1920 scales 832→1920 (2.31×) for 2659px of width against
a 1080px frame: **59% lost**, same as the scene plates. So you cannot fix a
vertical cut by swapping in lexicon art — it arrives just as cropped.

Triage them instead of full-bleeding them:

- `crop: "safe"` — full-field texture, grain, light, abstract wash. No subject
  to lose, survives a hard centre crop. Full-bleed these.
- `crop: "letterbox"` — a composed scene with a subject. Show it as a
  1080×780 widescreen band inside the portrait frame (or blur-extend the
  sides, or slow-pan across it). **Never object-cover.**

The band is not a compromise — a widescreen inset floating in a vertical frame
reads as deliberate film grammar, and it gives the 9:16 layout something to do
with its height. Pair it with the stacked-panel split.

Changing the lexicon's own generation to portrait is a bigger call than one
cut: those images also feed /lexicon, /galaxy and the Sonic Dossier, where
landscape is right. Ask before touching `art.mjs`.

**The letterbox band only works over a plate with nothing to protect.** v3
shipped a `band` roll window across the bridge, where a Lexsycon plate is drawn
as a 1080×780 strip through the middle of the frame. Over a full-body portrait
plate the result is a CHIMERA — her head and torso above the band, a stranger's
jeans and trainers inside it, her bare legs and heels below, reading as one
mangled body. Over the `doors` plate it simply cut a composed image in half with
unrelated bokeh.

Two rules from that:

- A band may only sit over art with no subject that crosses it — an abstract
  wash, a texture, an empty room. Never over a standing figure.
- **Audit bands at full size, on a phone.** The defect was invisible in a
  330px-wide contact sheet and obvious the instant it was played back at
  1080×1920. Contact sheets are for coverage and shot variety; they are not
  sufficient for compositing.

`bleed` (the B plate underneath at ~0.26 screen) gives the same second-voice
presence with nothing to slice, and is the safe default. Reach for `band` only
deliberately, and check that specific frame.

Fixing only one of the three leaves the video looking the same. The geometry
fix alone still loses 10–29% to the camera; the prompt fix alone feeds better
compositions into the same meat grinder.

**Enforce variety structurally, not by good intentions.** Tag every asset
WIDE/MED/CLOSE/MACRO and check the histogram before you render: at least a
third WIDE, no more than a quarter CLOSE+MACRO, and never two identical sizes
back to back. A shot-size histogram is a cheap QA number that would have caught
both hajimemashite cuts.

**Also check the source photos before generating.** hajimemashite v1 and v2 both
used one tight portrait as the Kontext source when
`assets/art/kizunasato/` held three full-body environmental shots — a rooftop
over a night skyline, arms-up in a wet Dotonbori street, and a studio desk.
The range was there the whole time and the pipeline never looked.

## 18 · The World That Heard Itself — the no-humans cut (2026-08-03)

Eleventh voice: **THE AUDIBLE DESERT** — Dalí-grade surrealist oil on one
continuous desert stage: razor-flat horizon, cavernous twilight sky, ochre and
deep teal with molten gold, and NOT ONE HUMAN in any plate (owner order:
"absolutely no humans at all"). The song is a creation myth where sounds become
bodies, so the ban costs nothing — the narrator is the unseen voice, and every
lyric line is an object miracle: a melting gold piano for "the melody turned
gold", planet-pendulums striking a drumhead desert for "gravity found the
beat", a crimson river feeding a whale-sized double bass for "Blood into
bass". Scripts in `scripts/twthi/`; art generator `scripts/song-art/twthi-art.mjs`.

- **The DiT engines wedge ComfyUI on this box — cut art is SDXL-only until
  that is fixed.** flux2-klein hung ComfyUI mid-model-load (HTTP dead, 0% GPU,
  10.5GB held, no log line for 8+ minutes) — the same still-unfixed failure
  mode as the PRIME freeze, triggered interactively this time. Killed the
  process, restarted, and regenerated everything on DreamShaperXL Turbo +
  Juggernaut/Lightning. SDXL does Dalí pastiche superbly; nothing was lost.
  Whisper also cannot share the GPU with a generating ComfyUI (16GB box: CUDA
  OOM) — short slices on `--device cpu` are fine.
- **A whole vocal section can live ONLY on the backing stem.** The female hook
  and "I said, Light." (213.5–233.4) have a silent lead stem; both whisper
  passes on the lead simply skipped them, and the words had to be timed from
  `1 Backing Vocals.mp3`. If a section seems missing, RMS-map BOTH vocal stems
  before concluding Suno didn't render it.
- **The −42 dB gate catches what slice-whisper gets wrong.** Six litany/build
  line-start words came back parked 0.3–0.6s into silence. The build script
  (`twthi/build.mjs`) runs the §16 RMS check over every word on its OWN stem
  and refuses to write while any fail — make the check part of the builder,
  not a separate step you can forget.
- **A word that fires twice can share one plate.** "light" appears at "I said,
  Light" (232.16) and "Rain into light" (275.10), and the retimed litany put
  the `rain` anchor 0.81s before the second fire — an illegal cut. Fix: point
  `rain` and `light` at the SAME url (§15: same-url hits never cut) and paint
  one plate that serves both lines (the dark-sky orb dripping gold into a lit
  river). Merging two scene concepts beats weakening either moment.
- **Suno skipped the lyric sheet's dramatic silence.** The sheet promises
  "[Several seconds of emptiness]" after "I stopped speaking"; the mix keeps
  pads at −12 dB and the narrator walks straight on. The 59s window ends at
  286.8, inside the 0.5s breath gap after "speaking", so the cut lands on the
  collapse line without slicing "The stars went—".
- **Contact-sheet the candidates at ~500px before picking: SDXL sneaks tiny
  humans into empty worlds.** 4 of 68 candidates grew a figure (a walker
  between monoliths, two on a canyon floor, one silhouetted at a crack, one on
  a horizon) despite "no people" positives and negatives. All four were
  visible at 500px and invisible at 250px.

## 19 · Forged Above Gold — the ComfyUI VAE hang, and two more silent traps (2026-09-03)

Twelfth voice: **THE ANVIL LIGHT** — documentary photography of a real working
blacksmith shop at night, lit only by hot metal, the coal fire, or the cold
violet of the quench. Deep black, muted, dirty. Built to an explicit owner brief
— *"the visuals are secondary; i just dont want them to be cheesy"* — so the
negative prompt (no fantasy, no sword, no crown, no spark shower, no epic, no
god rays) did as much work as the positive one. Window 199.36 → 261.40 (62.0s):
the whole final chorus, the break, the spoken ending and the two whispers the
song actually ends on. Scripts in `scripts/fag/`, full write-up in its README.

**Search by title and you will get the wrong song.** The catalogue already held
`void-into-gold-forged-above-gold-mix` (a 332s gospel boom-bap record, complete
with profile, planet, splice and analyzer entries) *and*
`oro-de-la-presion-forged-above-gold`. Neither is the Tyler × Kizuna song. Check
`identity.title` and the measured duration before trusting a profile directory
whose name matches your song.

**ComfyUI hangs forever in `AutoencoderKL` when the VAE is bfloat16.** This
looked exactly like the PRIME freeze and is not it: HTTP stops answering, the
GPU sits at 0%, ~7GB stays held, no further log line. Sampling *completes*
normally (26s at 832×1472/28 steps); the last line is always `Requested to load
AutoencoderKL`. Not VRAM (it hangs with 13GB free) and `VAEDecodeTiled` does not
help — same VAE path. **`--fp32-vae` fixes it outright**: two plates in 38s.
The service unit runs bare `main.py`, so rather than edit it, run a private
instance for the batch and leave the service alone:

> **Correction (§21, 2026-09-04):** the bfloat16 VAE was a red herring. The
> real cause was `MemoryHigh=8G` on the `comfyui.service` cgroup throttling it
> into permanent reclaim; a private instance "fixed" it only because it ran
> outside that cgroup. Fixed properly at the unit — the standard service
> (`comfyui.socket` → `comfyui.service`, see the skill's infra check) no
> longer needs this workaround. Keep the diagnostic technique (GPU 0% + no new
> journal line = hung, not busy) — only the fix changes.

```bash
cd ~/AI/ComfyUI && .venv/bin/python main.py --listen 127.0.0.1 --port 8190 \
  --fp32-vae --disable-smart-memory
```

Also: the service listens on **:8189**; `:8188` is a systemd socket that raises
it on demand.

**A busy ComfyUI is not a wedged ComfyUI.** It serves HTTP on the same event
loop that runs sampling, so `/system_stats` can take **13+ seconds** to answer
mid-generation. A `curl -m 6` health check calls it dead and sends you
restarting a process that was working — which is exactly what happened here,
twice, before the real bug was found. Diagnose a hang with **GPU utilisation at
0% AND no new journal line**, never with an HTTP timeout.

**`analysis.palette` is the WORD colour array, not a mood board.** Preflight
failed the first render: `palette contains near-black entries (#2A1B12) — the
engine draws words from this array, so roughly one word in 4 renders invisible`.
Writing the palette as "the voice's colours" is the natural thing to do and
completely wrong; every entry has to be legible on the darkest frame in the cut.

**Whisper parks spoken-word outros inside silence.** The sung body aligned
cleanly, but after the break whisper placed `The` at 240.84 and `fire` at
242.72 against a lead stem sitting at −70 to −103 dB — the line actually starts
at **244.36**, so both were 3.5s early, and `It`/`taught` landed inside the
scripted `[Pause]`. Segment text was correct and word probabilities were 0.90+;
only the RMS map catches it. Gate whispered sections at **−52 dB**, not −42:
they sit ~20 dB below the sung body and a −42 gate rejects honest onsets.

**A repeated anchor counts twice in the shot-size histogram.** The first
complete pick set came in at WIDE 27% / CLOSE+MACRO 36% — both outside §17's
targets. The fix was a single plate: `fire` is the only keyword that fires twice
in the window, so re-rolling it from a coke macro into a wide establishing shot
moved the whole set to **WIDE 43% / CLOSE+MACRO 22%**. When a histogram is off,
look for a repeated anchor before re-rolling four separate plates.

**Two defects that every automated check passed, and only frames caught:**

- A `hits` accent on the drop (`{t: 201.70, dur: 1.0}`) rendered as a **full
  second of blown white** in a film whose every frame is near-black. Preflight,
  VERIFY and the histogram were all green. Deleted — the mix lands the drop.
- The window opened on **4.3s of black**: the first keyword was at 203.64, and
  `analysis.sections[0].at` had been set to `FROM`. A section boundary that
  *equals* the render start is never crossed, so no section art came up either.
  Set the opening section's `at` BEFORE the window (190.00 here) so it is
  already active on frame one.

Also `deck.motion.swapMs` 900 → 650: at 900ms consecutive plates were visibly
cross-dissolved into a double exposure.

**Do not put the artists in with u2net if their sources are album covers.**
u2net treats large graphic TYPE as foreground (`extract-subject.py` warns about
this in its own docstring), so matting `#MADETOBREAK` returned the *wordmark* —
the first composite pass put a floating orange "ME" into two plates. Cropping
the title block off exposed the real problem: on a wet-street cover the matte
takes the reflection, and on a bust the hair fringes; he arrived as a dark blob
with a jagged rim. **What worked was not compositing at all** — one graded
portrait each from their real photographs, full-bleed, on their own line (hers
at *"Más fuerte que ayer"*, his at *"I can stand in the quiet"*), warm for the
forge and cold for the quench. Unmistakably them, zero artifacts, and two
portraits among twenty forge plates is a deliberate beat rather than §17's
"powerpoint of selfies".

**Don't `pgrep -f <pattern>` from a shell whose own command line contains the
pattern.** Three chained `until ! pgrep -f "scripts/fag/art.py"` waiters each
matched themselves and never exited, so a queued re-roll never started and
looked like another GPU hang. Match the interpreter too, or poll for the output
file.

## 20 · Warm Without Burning — the bilingual cut (2026-09-04)

Fourteenth voice: **SƠN MÀI LACQUER** — Vietnamese lacquer painting for a
Vietnamese song. Black lacquer ground, gold and silver leaf, crushed eggshell,
cinnabar. Chapter IV of the Fire Cycle answering Chapter I: the same river with
cage / knife / wire put down. Scripts in `scripts/wwb/`, art in
`scripts/song-art/wwb-art.mjs` + `reroll.mjs` + `reroll3.mjs`.

**Look in `assets/` FIRST.** Every song has its own folders there — `lyrics/`,
`mp3/`, `wav/`, `stems/<Title> Stems.zip`. This cut was half-built off a librosa
REPET-SIM foreground of the full mix before the Sovereign pointed at it. The
lyrics there were byte-identical to the profile's `official-lyrics.txt`, but the
**stems** moved real numbers: retiming off the isolated lead vocal shifted line
starts by up to 0.9s and rewrote the whole outro.

- **Decode Suno stems with ffmpeg, never librosa/libsndfile.** These mp3s carry
  bogus duration headers — `ffprobe` reported 366s and 755s for a 246.4s song —
  and libsndfile truncates on them. Every line gate-checked as "silent" until
  `ffmpeg -i "0 Lead Vocals.mp3" -ar 22050 -ac 1 lead.wav`. This is the old
  stem-truncation bug wearing a new hat.
- **Gate windows must be wider than a syllable's onset jitter.** A ±230ms probe
  at the last whisper landed in the gap before the onset and reported the line
  dead on both vocal stems. It was really 370ms later and ran to the song's end;
  acting on that reading would have sliced the title line in half.
- **A whispered outro can only be phrase-mapped, not whisper-timed.** Both ASR
  passes hallucinated over the Hàn River ambience — inventing English lines, and
  reproducing the "La La School subscribe" outro whenever given a `vi` language
  hint (it survives foreground extraction). A −46dB run map over the lead stem,
  where the whisper is the only thing playing, is the honest source.

**Non-Latin text needs its font subset declared.** `layout.tsx` loaded Space
Grotesk with `subsets: ["latin"]`. Vietnamese needs 12 characters from the
`vietnamese` subset (U+1EA0–U+1EFF) plus đ / ơ / ư from `latin-ext`; every
Vietnamese line would have rendered as fallback glyphs or tofu. Check this
before any cut whose lyrics leave ASCII.

**Plates MUST be uploaded to R2 — `public/planets/` is not enough.**
`KineticStage` resolves every `/planets/…` path through `PLANET_BASE`
(`lib/engineHost.ts`), the R2 public bucket. `next dev` serves the local copies
happily at 200 and the engine never asks for them, so the first QA sheet came
back as **pure black frames with only text**. `scripts/wwb/upload-r2.mjs`
byte-verifies each plate against the edge with a cache-buster.

**In this style SDXL paints landscapes and cannot paint objects.** 108
candidates for 18 plates, over three passes:

1. "dragon bridge" → literal mythological dragons. SDXL does not know Da Nang's
   Dragon Bridge; ban the word and describe a steel arch bridge with a separate
   fire plume.
2. Every plate with a person failed. `here` asked for a flat featureless
   silhouette and returned four fully rendered portrait **faces** in Chinese
   court dress, against a negative that already said face / portrait / eyes /
   mouth. `stay` returned three figures where the brief said two (§3 again).
3. The real rule, only visible once the whole planet was on one sheet: object
   and macro briefs collapse into decorative lacquerware or photoreal product
   shots — "flawless polished lacquer" became a framed mirror, "a bowl of
   embers" became a bowl of chillies, "sandals at the waterline" became a
   product shot on teal. **Nine of eighteen.** Restaging every lyric as a Hàn
   River night landscape fixed all nine at once, and is also what makes the
   plates read as one planet.

Corollaries worth keeping: where a human is not load-bearing, take the human out
and let an object carry the lyric — an empty chair, a lit lantern, two moored
boats. Absence reads as presence in a song about someone staying. Where bodies
are genuinely needed, thumbnail scale in a vast landscape is the only framing
SDXL respects. **And audit the assembled planet on one sheet, not just per
scene** — picking blind from unviewed sheets is what shipped the nine failures
into the first publish.

**render-cut.mjs cannot run from a git worktree as-is.** It resolves `sharp`
through `createRequire` against a hardcoded `<repo>/node_modules/sharp`, and a
worktree has no `node_modules` at all. `next dev` works regardless because Node
walks up to the parent checkout, which makes the failure look inconsistent.
Symlink `sharp` and `@img` into the worktree before rendering.

## 21 · Osaka After Dark — the second cut, and the cgroup that was never a VAE bug (2026-09-04)

A second, different cut of a song already shipped: the first chorus through the
end of the Female Lead section, **73.58 → 132.08 (59s)**, distinct from the
already-shipped 56s cut (155.02–211.35). Same voice, **WET NEON**, no new
planet — `tracks.lyrics_synced` held only the first cut's window, so the word
array for this one had to be rebuilt from scratch against the official lyrics
(`assets/lyrics/osakaafterdark.txt`) and the existing lead-stem whisper pass.

- **A re-cut of an already-shipped song needs its OWN lyrics_synced build,
  even with a whisper pass already sitting there.** The prior cut's window is
  all that got baked into the DB; a new window is a new alignment job, not a
  slice of the old one.
- **When several official lines share one ASR segment, only WORD-level
  stamps can split them.** Four ad-libs landed in one 5-second blob and both
  response couplets were two lines apiece; the lead stem sits at a continuous
  -38dB across the whole window, so no energy gate could find the seams
  between lines — only the whisper pass's own word timestamps could.
- **Five of eighteen plates survived from the first cut** (reused verbatim);
  the other thirteen were generated fresh with the ORIGINAL script's *exact*
  voice clause, negative prompt, checkpoint and sampler, then put through the
  same darken grade (gain 0.46 / contrast 1.18 / sat 1.10) — matching every
  knob, not just the prompt text, is what let old and new plates cut together
  without a visible seam. The grade is load-bearing, not cosmetic: phrase mode
  draws an un-sung word at 0.26 opacity, and the base checkpoint returns
  brighter frames than this voice wants.
- **SDXL still puts people at food stalls no matter how the negative prompt
  bans them.** Both `kansai` candidates (a street-food griddle) grew blurred
  figures despite an eleven-way ban on people. The fix was compositional, not
  lexical: crop the brief down to the griddle itself and leave no room in
  frame for a person to stand.
- **See the §19 correction above** — the "ComfyUI VAE hang" that drove FAG to
  a private `:8190` instance was actually `MemoryHigh=8G` throttling the
  `comfyui.service` cgroup into permanent reclaim; the private instance only
  "worked" by running outside that cgroup. Fixed at the unit on this date —
  render against the standard service now.
- **`render-cut.mjs` resolves `release.mp3` under the repo it runs from.** An
  untracked profile that exists only in the main checkout is invisible from a
  worktree render. Pass `--audio` explicitly instead of copying the mp3
  between checkouts.
- The row stays `hidden=true` with a `/private` `audio_url` (§13); this patch
  replaced only `lyrics_synced` and the window-specific planet wiring, leaving
  title/cover/etc. from the first cut untouched.

## 22 · International Mode — the first SPLICED cut, and two schema bugs that fake a black backdrop (2026-09-08)

Sixteenth voice: **ONE WORLD GATE** — dozens of real national flags raised
together at festival dusk, diverse crowds, a stamp thrown in mixed-flag ink
instead of black — built to an explicit owner brief: *"use lots of flags and
lots of imagery from different countries. i want this song to unite people."*
First cut whose window is not one continuous span: **25.04–39.2s** (the first
hook) **+ 120.14–166.0s** (Build into Final Drop), spliced with a 0.6s
fadeblack/crossfade, ~60s total. Also first cut using **NVIDIA Parakeet TDT
0.6b-v3** (via `onnx-asr`) instead of whisper for the transcript — see the
`kinetica-video-cut` skill's §3b for the install (cuDNN, provider conflict,
token-not-word API) and §3c for the splice technique itself.

**Two data-schema bugs, both silent, both produce the identical symptom** (a
render that completes, passes VERIFY, draws words correctly — and shows
nothing but the particle starfield for a backdrop, because NO scene or
section art ever paints):

1. `assets.keywords` (and `dynamicPlus.words`) must be keyed **lowercase**.
   `KineticStage.tsx`'s render loop does `clean(words[i].w).toLowerCase()`
   before the `art?.[w]` lookup; a dict keyed with the display casing
   (`"Stamp"`) never matches.
2. `analysis.sections[]` entries must use `{start, name, colorHint}` — NOT
   `{at, label}`. `activeSection()` (`src/lib/planet.ts`) reads `s.start`.
   **§19's own row.json (Forged Above Gold) uses `{at, label}`** — meaning
   that shipped cut's section-driven ambient art may never have painted
   either, and nobody caught it because its keyword density was high enough
   to cover the window without it. Worth auditing before assuming any older
   row's `analysis.sections` actually does anything.

Neither preflight nor VERIFY checks a row's field names against the
`PlanetSection`/keyword types — both passed clean on the broken data. The
only thing that catches this is pulling a real frame and looking at it.
**Do this before, not after, believing a render "succeeded."**

**A splice's cut point should land where the SONG is already quiet.** Chose
120.14 for the second window's start because it's a real measured
drum-silence gap from `analyze_stems.py`'s `cuts` array (the riser before
Build), not a freehand pick — the crossfade never has to reconcile two live,
unrelated drum patterns because there's real silence to fade through on one
side already.

**`merge-cuts.mjs` crashed on its own success path** — an unused, duplicate
decode-check line returned `null` from `execFileSync` (stdout was `ignore`d)
and then tried to read a property off it. Deleted the dead line; the real
check two lines below (a try/catch around the same ffmpeg decode) was
already correct and unaffected.

**A spliced cut carries 1-3s of stale phrase text across the join** — the
engine has no notion of "the song just jumped 80 seconds," so it keeps
showing the last LRC line active before the cut until the second window's
own first stamped line arrives. Mostly hidden inside the fadeblack dip here;
not fixed, logged as a known cosmetic gap for the next spliced cut to close
(stamp a blank/reset line at the second window's exact start).

**Title-collision trap, same shape as FAG's §19:** "International Mode" and
the already-catalogued "International Heat" are different songs; searching
assets by partial title would have grabbed the wrong one.

## 23 · International Mode, THE GOLDEN ATLAS — the re-cut where the text finally got big (2026-09-15)

Sixteenth voice: **THE GOLDEN ATLAS** — golden-hour photoreal travel
documentary, a real named landmark with a real crowd celebrating in front of
it, the country changing on the hook word. Monuments identify the country;
flags are incidental. 21 plates, all native portrait 832×1472. One continuous
window **0.00 → 62.40** (62.40s), PURE DYNAMIC throughout. VERIFY median
8.0ms / p95 15.0ms, 3580 clean frames. Shot histogram 50% WIDE / 45% MED /
5% CLOSE — inside §17 on both ends.

The owner's note on the previous pass was *"the problem is mostly the text"*,
plus *"the timing is off on the lyrics"*, and the reference he pointed at was
Warm Without Burning (§20). Everything below is what separated the two.

### The single most expensive lesson: check WHICH CHECKOUT the dev server serves

Three full probe renders in a row came back byte-identically wrong after
engine edits that were definitely on disk and definitely typechecked. The dev
server answering on :3218 was running from
`.claude/worktrees/days-drift-by-cut`, another session's worktree. Every
`src/` edit went to the main checkout and was never served; only the DB row
changes landed, which is exactly the symptom that makes you doubt your own
patch instead of your server.

```bash
for pid in $(pgrep -f "next dev"); do echo "$pid $(readlink /proc/$pid/cwd)"; done
```

Run that BEFORE trusting any engine change you make during a cut, and start
your own server on a free port rather than adopting whatever is on :3218.
The skill's Step 0 now says so.

### "Pure dynamic" is a property of the modes ARRAY, not the --mode flag

`render-cut.mjs` already defaults to `--mode dynamic`, and `liveMode =
schedMode ?? mode` — so a `dynamicPlus.modes` window **outranks the flag**.
The previous pass alternated `dynamic`/`phrase` per act, so the hook kept
collapsing into a wrapped three-word wall. Warm Without Burning looked
"purely dynamic" because its three windows all SAID dynamic; they exist only
as punctuation (entering one fires the tape-warp and clears the residue).

Every window here is `dynamic`, asserted in the builder:

```python
MODES = [{"start": a["start"], "end": a["end"], "mode": "dynamic"} for a in ACTS]
assert {m["mode"] for m in MODES} == {"dynamic"}
```

### THREE text layers pile onto the frame, and `giant.pile` only reaches one

This is the finding that actually answered "the problem is mostly the text".
Killing the giant-word residue with `deck.giant.pile = 0` did nothing to the
wall of overlapping text, because the wall was never that layer:

| layer | z | driven by | knob |
| --- | --- | --- | --- |
| giant-word residue | — | outgoing dynamic words | `deck.giant.pile` |
| **stutter pileup** | `z-[7]` | a ≥3-repeat run within 1.4s | **`deck.giant.stutter`** (new) |
| **choir word** | `z-[2]` | backing-vocal loudness, 24vw, blurred | **`deck.choir`** (new) |
| backdrop word ghosts | GL | dying lyrics dissolving into the field | **`deck.ghosts`** (new) |

The stutter pileup is *wonderful* on "push-push-push" and ruinous on a chant
whose hook is a 13-letter word: three hits in a row emit nine chips at
`clamp(1.6rem, …, 9rem)` scattered across the whole frame, each clipped,
burying the plate. The choir layer draws the live word at 24vw — a long word
runs off both edges and reads as a grey smear. All three now have knobs and
all three default to their old behaviour, so no shipped cut changes.

A previous session had already guessed at this and written `"stutter": false`
inside `giant` — it was a silent no-op, because nothing read it. **If you
invent a deck key, grep the engine for it before believing it worked.**

### `backdropHue` is in TURNS, not degrees

`backdrop.hueShift` is registered `min -0.5, max 0.5` (turns). This cut
carried `backdropHue: 36`, which clamps to 0.5 — a **180° rotation** that
turned every golden-hour plate lilac. Warm Without Burning's `28` clamps the
same way; it survived because a black-lacquer plate has almost no hue to
rotate. Gold wants about `0.04`. *(Worth auditing every shipped row for a
`backdropHue` above 0.5.)*

Related, and the same shape: `dynamicPlus.scene` is silently ignored unless
it is one of `BACKDROP_SCENES = ["AURORA","EMBERS","INK","SYRUP"]`. WWB's
"LACQUER" and the first IM cut's "GATE" were both no-ops — which is *why*
they looked clean. The moment this cut pinned a REAL scene (`AURORA`), the GL
curtain painted behind plates that render at only 0.6 opacity and hazed every
frame. **Omit `scene` unless you actively want the generative world showing
through the photography.**

### The giant word was drawn at a THIRD of the frame, and the cause was a constant

`fitScale` estimated a word's width as `len × fontSize × advance` with
`advance` hard-coded to 0.88 in portrait — deliberately pessimistic, because
an average under-reads wide-letter words (ACCESS, OVERREACTION) and a word
that thinks it fits and then clips is the failure viewers notice. Measured
against a hidden span wearing the real `.kinetic-word` class, this face runs
**0.53 to 0.70**: INTERNATIONAL is 0.533, the narrowest in the song. So the
estimate over-read it by 65%, and a 0.56 target drew it at **0.34 of the
frame**. Short words never noticed — they hit `fitScale = 1` either way,
which is why WWB (WARM, FIRE, GONE, HERE, SCARS) looked enormous and this
song looked broken.

`measureAdvance(word)` now measures and caches per word — one layout the
first time a word is ever staged, nothing after. With a true width the target
finally means what it says, and it was set by measurement too: sampling every
word's real `getBoundingClientRect` every frame across the whole 62s cut,

| target | worst peak | overflow |
| --- | --- | --- |
| 0.76 | 103% vw | 95px — tore both ends off INTERNATIONAL |
| 0.66 | 94% vw | 30px |
| **0.58** | **91% vw** | **11px (one frame, one word)** |

0.58 it is — ~1.7× the old drawn size with essentially no clipping. The
entrance transform is what eats the headroom (`WordSlam` starts at
`scale: 1.45`), and no arithmetic predicted the real peak as well as
measuring it did. **Re-measure before raising it.**

### A pan with no zoom walks the plate off its own edge

Two frames came back with a hard black band across the bottom, looking like a
broken render. `WIDE_MOVES` deliberately rest at scale 1.00–1.04 so an
establishing shot stays wide (§17) — but they still translate up to 1.6% of
the frame, and one preset is literally *"pure track, no zoom"*: scale 1.00,
x ±1.6. At scale 1.00 a plate has **zero overhang** to pan into, so the pan
exposes the bare stage. `motionShot` now lifts the scale just enough to cover
the pan (±1.6% needs 1.032) rather than cancelling the pan.

Detecting this is cheap and worth doing on every cut — sample the edges and
look for dark runs, then classify each by eye, because a legitimately dark
plate (the night-globe here) reads the same to the detector:

```bash
ffmpeg -i cut.mp4 -vf "fps=8,crop=1000:420:40:1400,scale=50:21" -f rawvideo -pix_fmt gray -
```

### Timing: transcribe SECTION SLICES, not the whole stem

The previous pass ran Parakeet over the whole lead stem and mapped the
official sheet onto its onsets 1:1. Whole-file ASR **under-segments dense
chopped runs**, and every error was of that shape:

- a five-hit stutter at 29.74/30.19/30.59/31.01/31.42 (dead on the 143.55 BPM
  beat grid, 0.418s) came back as ONE token, so "Run it" sat alone at 29.76
  and four real hits had nothing on screen;
- "Gate closed" was heard as one token at 42.08, which is actually *closed* —
  "Gate" at 41.74 was missed entirely, so the pair landed ~0.35s late with
  its second word gone. Same for "Flight mode", "Still go", "Run it".

Re-running the SAME model on 6–9s section slices recovered all of them
("What What What What What" for the five-hit run — five tokens, right where
the RMS profile says). Then every stamp was confirmed against a 20ms dB
profile of the stem: all 50 words ≥ −36 dB over their first 300ms against a
−42 gate, with the 300ms before each phrase reading −55 to −101 dB, which is
what proves the gate measures onsets and not a constant floor.

**Follow the AUDIO, not the lyric sheet.** Suno's sheet says "International
×3" in two places where the take clearly sings two. The sheet is a prompt,
not a transcript.

Also: end the cut where the word ENDS. The previous pass ended at 61.277 — a
clean beat boundary that sliced the final "Large" in half at its onset. The
`cuts` array had already flagged the percussion gap at **[61.18, 62.46]**;
ending at 62.40 lets LARGE hang alone in that silence and stops before the
Break re-enters at 62.46.

### Smaller things worth keeping

- **All three synthesised banners can be designed out.** WIPE needs a sung-word
  gap ≥7s (longest here 5.67s), BLOW needs an intensity rise ≥0.25 (max 0.16),
  SHAKE needs a section ≥0.72 (max 0.70). Assert all three in the builder and
  the cut needs no decoy moment at all — WWB's §14 workaround becomes
  unnecessary rather than merely correct.
- **`particleModeFor` reads one joined string and takes the FIRST regex hit.**
  Genre "Dancehall / **Club**" was sending a golden-hour travel film to
  *bubbles*; "golden" in the themes reaches *pollen* only once nothing earlier
  matches. Beware `ice` and `rose` — they have no word boundaries, so
  "vo**ice**", "p**rose**" and friends silently pick the weather.
- **The section emotion covering the most time owns the ambient plate.**
  "arrival" covers ~28 of 62 seconds here; it was pointed at the globe, which
  is ALSO in the hook's rotation pool and mapped to "big"/"large", so the globe
  kept reappearing. Point the busiest emotion at a plate in no other pool.
- **`deck.glow` is a drop-shadow on top of `.kinetic-word`'s own beat-driven
  halo.** At 1.0 under a word that is now twice the size, the bloom bleaches
  the plate behind it. 0.45 here. Crispy is a hard edge, not a big halo.
- **`motion.swapMs` below the crossfade duration means permanent dissolve.**
  The first pass had `swapMs: 380` against a 0.42s fade — plates never landed.
  900 lets a landmark be looked at.
- **Owner art veto, 2026-09-15:** *"I don't like bare skin images like that."*
  A close crop of bare legs on a dance floor is out; its three words moved to
  plates carrying the same MOTION with people dressed — the Great Wall lantern
  run and the Bo-Kaap jump. Keep this in mind at art-direction time, not after.

### Publishing a finished cut to R2 (formalised 2026-09-15)

The bucket already had two cuts on it under `cuts/<12 hex>/<basename>.mp4`, put
there by hand. That shape is now a script:

```bash
node scripts/clip/publish-cut.mjs <file.mp4>            # fresh random id
node scripts/clip/publish-cut.mjs <file.mp4> --id <hex> # REPLACE a cut in place
node scripts/clip/publish-cut.mjs <file.mp4> --dry      # show the URL, upload nothing
```

The random id IS the access control — the public edge
(`pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev`) serves anything under the
bucket, so an unguessable prefix is the only thing keeping an unreleased cut
unlisted. Pass `--id` when you have re-rendered a video whose link is already
out; omit it for a new one.

Verify at the EDGE, never on the PUT response (§20's lesson, same trap): the
script HEADs the public URL and matches content-length before printing a link.
Worth one extra `md5sum` against a full download for anything you are handing
to the Sovereign — a length match is not a byte match.

**Superseded cuts are not cleaned up automatically.** `cuts/845f2cf00362/` still
holds the rejected first Golden Atlas pass. Deleting is the owner's call; a
stale link that still plays the version he rejected is worse than an orphan
object, so ASK rather than tidy.

### §23 addendum — the v2 pass (same day)

Four owner notes, and what each one cost.

**"It repeats a lot."** A hook word that fires 15 times needs MORE than 15
plates, not exactly 15. `pooledArt()` walks `[base, ...pool]` under a shot
grammar that refuses two same-size shots back to back, so it SKIPS entries —
and the section's ambient plate lands on top of the rotation whenever no
keyword wins. The pool went 14 → 24 countries. Measure the result instead of
eyeballing a contact sheet, which over-weights whatever plate is held longest:

```js
// in the page, over a full playthrough — every art CHANGE, not every Nth frame
window.__art.push([audioTime, url.match(/scene-([a-z0-9]+)\.webp/)[1]]);
```

32 art changes, **16 distinct plates**, worst repeat ×4 (the `arrival` section
plate, which owns ~28 of the 62 seconds). Also gave the other repeat-heavy
words (`worldwide`, `yard`, `foreign`) small pools of their own.

**"It's just 2 random girls on a road."** Generic stock-ish people are not
scenery — the eye asks who they are and gets no answer. The brief that
replaced it ("pick a famous road and put a flag on it") is the better rule
generally: a NAMED thing reads instantly where an anonymous one doesn't.
Route 66 under a full-size American flag, first seed, no re-roll. SDXL renders
the US flag cleanly because it is stripes and a canton — keep flags to simple
geometry and keep `readable letters` in the negative; the Amalfi alternate
came back with an Italian flag rendered red-and-white and was dropped.

**"Add a shake when the song gets hype."** Everything a shake does already
existed — a CSS quake on the stage, a particle scatter, the live word reacting
in the song's own tap language — and none of it was reachable in a render,
because the only thing that ever set `quake` was a `devicemotion` event.
`dynamicPlus.quakes: number[]` now fires the same payoff on the clock, guarded
by the same "fire once as the playhead crosses" ref that `hits` uses. Three of
them here (the Beat Drop, the chant wall, the closing chant) — verify they
actually landed rather than trusting the array:

```bash
ffmpeg -i cut.mp4 -vf "fps=30,scale=48:85" -f rawvideo -pix_fmt gray -   # then diff consecutive frames
```

27×, 44× and 42× the median frame-to-frame motion, and 43.30s is the single
biggest motion frame in the cut. A rattle you cannot measure is a rattle the
viewer will not feel.

**Republish over the SAME id when a link is already out.**
`publish-cut.mjs --id <hex>` replaces the object in place, so the URL the
Sovereign is holding upgrades itself instead of becoming the stale one. Only
mint a new id for a genuinely new cut.

## 24 · Hajimemashite v4 — why "too many selfies" was never an art-direction problem (2026-09-16)

Third cut of this song. v2 was rejected as "a powerpoint presentation of kizuna
selfies"; v3 fixed the geometry (§17 was born there) and was rejected for the
same thing in different words: *"don't make every picture kizuna... just
sprinkle her and Tyler in."* Window 97.60 -> 157.55 (59.95s), unchanged. PURE
DYNAMIC. VERIFY median 13.0ms / p95 20.0ms. 22 plates, 6 with a person — v3 had
12 of 17.

**The cause was the TOOL, not the prompts.** Every v3 plate went through Flux
Kontext seeded from Kizuna's photo, and Kontext is an instruction-EDITOR: it
preserves the subject of the source image by design. Ask it for an empty street
and you get a woman on an empty street. v3 had already tried writing wider
prompts and it could not work.

So split the set by whether a person is in the frame at all:

| | tool | cost | count |
| --- | --- | --- | --- |
| plates WITH a person | Flux Kontext (likeness) | paid API | 6 |
| plates with NO person | local SDXL, text-to-image | free, ~17s/pair | 16 |

"Sprinkle her in" therefore costs LESS than v3 did, not more. If a set is
coming back monotonous in its subject, check what is seeding it before
rewriting a single prompt.

**Structure the reveal and let the plate count enforce it.** v3's own header
said the face was "earned by fifteen shots of holding back" and then mapped her
to nearly every keyword anyway. Here she is a distant silhouette at her entrance
(139.35), a figure at her name (146.25), and the face lands exactly once, at
142.70 on "remember the face". Tyler owns both LevelReady calls as a PERSON —
v3 mapped a record-label CARD to "the house was already warm", so the warmest
line in the song played a logo.

**A lone silhouette plate does the work of three portraits.** `crowd-0` (one
anonymous figure walking away on a wet street) carries "watch how I'm walking",
"I didn't walk in alone" AND the ambient bed, with no likeness and no API call.

### Two colour traps, both of which made words illegible

**`palette[0]` is not decoration — it is the melody's base hue.**
`themeHue = hexHue(palette[0])`, and the sung note bends the word's colour off
it. This row led with `#0A0805`, a near-black whose hue is noise, so the entire
melody-colour system was bending off nothing. Lead the palette with the song's
actual colour.

**`pitchHue` swings +/-80 degrees, which is most of the wheel.** Lovely on
neutral art; on a MONOCHROME grade it is a legibility bug — gold-on-near-black
rendered some words cold blue-grey and they vanished into the plate. New knob
`deck.pitchSpread` (0..1, absent = 1 = the historic behaviour) scales the bend;
0.3 here keeps the melody nuance inside the song's own colour.

Related: `deck.glow` is not a constant across cuts. International Mode's bright
golden-hour plates needed 0.45 or the halo bleached them (§23); these near-black
plates needed **0.95** or the word had nothing to sit on. Judge it against the
art, not against the last cut.

### Housekeeping this cut paid for

- **`~/.bfl_key` is gone.** The Kontext credential lives at
  `~/.config/ossicle/aimlapi.env` as `AIMLAPI_KEY`, per the security law's
  `~/.config/<system>/env` pattern. The 2026-08 portrait scripts still point at
  the old path and will exit on it.
- **PIL is not in system python3** on this box any more (same disappearance as
  the librosa/whisper venvs). `~/whisper-venv/bin/python` has it now — run the
  Kontext scripts with that interpreter.
- **Kontext returns 752x1392, not 832x1472.** Every script must `cover()` the
  result to native portrait rather than trust the API; §17 is not negotiable.
- **Don't re-align a hand-aligned word list with a rise detector.** An attempt
  here flagged 77 of 134 words as "off", with the offsets piling up at the edge
  of the detector's own +/-0.30s search window — the giveaway that it was
  locking onto neighbouring syllables in continuous singing, not finding real
  errors. Hand alignment won. Parakeet cannot arbitrate either: the ad-libs are
  Japanese and it is English + European only.
- A new track id (`hajimemashite-v4`) rather than overwriting the row, so the
  v3 cut keeps playing off `planets/hajimemashite/`.

## 25 · Drink Drink — THE POUR, and effects that carry their own colour (2026-09-16)

Re-cut of the 2026-07-24 original (30s, both aspects, pre-dating the one-video
law). Seventeenth voice: **THE LAST POUR** — near-black room, one warm amber
source, the liquid the only bright thing and always backlit. 190.00 -> 250.00
(60.0s), pure dynamic, VERIFY median 13.0ms / p95 20.0ms. 16 plates, 8 of them
alcohol being poured.

### The stutter pileup is not a bug — it was just never art-directed

§23 added `deck.giant.stutter: false` to switch the z-[7] word pileup OFF,
because on International Mode it buried the frame. That was the right call
there and the wrong lesson to generalise: the owner asked for exactly this
feature here — *"the song repeats the word drink a lot, come up with a visually
pleasing technique... a way to stack the words"* — plus *"a word technique where
it looks like words are flowing from a bottle."* Those are one idea.

**THE POUR** (`deck.giant.stutterLayout: "pour"`, plus `stutterEmit: [x, y]`):

| | scatter (historic) | pour |
| --- | --- | --- |
| position | jittered 6x5 grid, shuffled | one column, filling bottom-up |
| rotation | random +/-17 deg | +/-1.4 deg |
| scale | random 0.85-2.0 | constant |
| entry | grows in place | flies in from `stutterEmit` |
| colour | alternates primary/secondary | single (theme primary) |

Point `stutterEmit` at the bottle's mouth in the plate and the repeats look
poured out of it and stacked like a rising level. The randomness was the whole
problem: the 2026-07 cut was 26 chips at random angles and sizes, which is
confetti, not a hook.

### Not every registry effect is colour-neutral. Check before you trust the name

`drip` ("glossy droplets swell off the letters") sounds perfect for a drink
song. It hardcodes a lilac/pink gradient — `#e9d8ff / #ffd9ec / #cfa8ff` with
purple text-shadows — built for a syrup-purple grade. On the hook word, which
is 39 of 68 words here, it turned an amber whiskey cut lavender. `liquid` is
the same trap with a hardcoded BLUE gradient.

`pulse` draws its glow from `var(--theme-accent)`, so it wears whatever colour
the song is. **Grep an effect's implementation for hex literals before wiring it
to a word that repeats.**

### deriveTheme's neighbours are further away than they look

`deriveTheme(seed)` returns `secondary = hue + 45` and `accent = hue - 35`. An
amber seed (hue 38) therefore produces a yellow-GREEN secondary and a vivid PINK
accent — and an unpitched giant word falls back to that accent. Two consequences
worth remembering:
  * the pour stacks single-colour deliberately, because alternating
    primary/secondary put a yellow-green chip between every amber one;
  * pushing the seed to hue ~58 keeps the accent in warm orange.

### `particleModeFor` reads the TITLE, which a cut cannot edit

"Drink Drink [Don't Save Me]" matches the champagne/bubbles rule *on its own
name*, so a whiskey insomnia song fizzed like prosecco. No amount of careful
mood/theme wording fixes that. New knob **`deck.weather`** pins the particle
mode outright; `"dust"` here. Any song whose title contains fire, ice, rain,
drink, party, rose… has the same problem.

### Timing a song whose hook ASR cannot hear

No Suno stems existed on disk and the stored alignment had collapsed — eleven
words on the identical stamp 243.73. The owner supplied stems mid-session (via
a Drive link, pulled with `curl` on the `uc?export=download&id=` form — the MCP
Drive connector returns base64 into context and cannot carry 20MB).

Even on the isolated vocal, **Parakeet hears none of the chant**: the hook is a
pitched, warped male chant and it transcribes as "Tem, trem, trem, trem". So the
cut is built from two sources — ASR section-slices for the sung lines, and
ONSET DETECTION for every "Drink". The song is 123.05 BPM and the chant sits on
the grid: 31 of 74 detected gaps in the window are exactly one beat, which is
what makes the detection trustworthy. Rule used: an onset becomes a "Drink"
unless a sung word already claims that moment (+/-0.34s).

**A first stems delivery arrived 1.03 seconds long** — all seven members
present, integrity clean, just empty. Decode a stem before trusting it; a valid
zip proves nothing about what is inside.

## 26 · Summer Drip v2 — the Hamptons re-cut, and two effects built for one song (2026-09-16)

Eighteenth voice: **THE HAMPTONS SESSIONS** — photoreal editorial, deep golden
hour with the sun on the water, weathered deck, white umbrellas, string lights,
a genuinely multiracial crowd in resort wear. 0.00 -> 60.00 from the very top,
pure dynamic, VERIFY median 11.0ms / p95 19.0ms.

The Sovereign replaced the album art and asked the cut to follow it: *"a more
realistic look... a place like the Hamptons with a diverse crowd of many races,"*
start at 0:00 because *"the intro is epic, HEAT TURNED UP"*, and *"feel free to
create any new effects specifically for this song."*

### Diversity has to be the FIRST clause, not a clause

The first 36 plates named "a diverse crowd of many ethnicities" at the END of a
long LOOK string and came back almost entirely white. SDXL's prior for "Hamptons
beach club" is affluent and coastal, and a trailing adjective does not move it.
Naming the groups concretely — *"Black, Latina, South Asian and East Asian people
together with white friends, several dark skin tones clearly visible in the
foreground"* — as the opening clause fixed it in one pass. **Where an
instruction sits in the prompt is part of the instruction.**

Same pass, same lesson about grade: "late golden hour" alone produces high-key
pale resort photography. The cover is a deep amber sunset with the sun ON the
water. Stating the sun's POSITION and the warmth outright ("deep golden hour
with the sun sitting low and orange right on the ocean horizon, rich warm
saturated colour, deep warm shadows") got there.

### Contrast is judged against the art, in BOTH directions

§24 raised glow to 0.95 because Hajimemashite's plates were near-black. Summer
Drip is the exact inverse: bright cream-and-gold plates, where gold text
disappears and MORE glow only makes mud. What worked:

  * a **saturated burnt orange** seed (#C2500F) instead of amber — `deriveTheme`
    clamps lightness to 0.5-0.62, so a genuinely dark seed cannot survive, but a
    saturated warm red-orange still reads on cream;
  * glow DOWN to 0.45, vignette UP to 0.6 to pull the frame edges down and give
    the type somewhere to sit.

**There is no house glow value.** Look at the plates first.

### Two new effects, and the rule they were built under

Both are colour-neutral — §25's finding that `drip` hardcodes lilac and
`liquid` hardcodes blue is now a design constraint for anything new:

  * **`heathaze`** — two blurred ghosts drift in opposite directions behind a
    CRISP original, so the glyph stays perfectly readable while its edges
    shimmer. Air over hot boards. Draws from currentColor and
    `var(--theme-accent)`.
  * **`screw`** — the word drags downward leaving a short smear above it: a
    tape slowing. For chopped-and-screwed material.

And a third pile layout, **`trail`**, joining `scatter` and `pour`: the repeats
smear diagonally, each smaller than the last, each entering from where the
previous one landed. One chip per repeat, not three — a drag is a line, not a
pile. Staged the nine "every"s at 1.68-5.68 and the five "mean"s at 13.28.

### ASR on the mix was enough here — but it cannot be trusted on TEXT

No stems exist for this song and none were needed: the lead sits forward and
Parakeet caught every ad-lib chop on the full mix. What it could not do is the
words. It mis-heard the two most important lines in the song —

    "He turned up"              ->  "HEAT turned up"
    "I feel the sun dress glow" ->  "I feel this SUNDRESS glow"

— plus "My mouth's so sweet" for "SMILE so sweet", "high class gain" for
"high-class GAME", "Every weapon's so proud" for "every WHISPER so proud", and
"Long lace off hands" for "Long LEGS, SOFT hands". **ASR supplies the clock;
official-lyrics.txt supplies the words.** Never ship ASR's spelling.

### The §12a guard earned its keep

`assert len(prompt + LOOK) < 900` stopped the batch on the `sundress` prompt at
913 characters. Without it that plate returns SOLID BLACK at the wrong
resolution with no error (§12a). Keep the assert in every art script.

### §26 addendum — repetition is a DISTRIBUTION problem, so measure it

The Sovereign on the first Summer Drip v2: *"I really don't like this picture
and you're reusing it a lot."* Both halves were true and the second was
measurable, in seconds, without rendering anything:

```python
# count word-OCCURRENCES per plate: walk the word list, resolve each through
# assets.keywords + the gallery pool exactly as pooledArt() does, and tally.
```

18 plates carrying 81 word-hits, and the top four carried 35 of them — `queen`
10, `sundress` 9, `lens` 8, `dancefloor` 8, the disliked `smile` 6. A contact
sheet hides this, because it samples time evenly and a plate held once for four
seconds looks the same as a plate that came back four times.

The fix was not a re-roll of one image. It was **fourteen more plates** (18 ->
30) and a re-spread of the keyword map: worst repeat 10 -> 6, every plate used,
and `smile` deleted from R2 rather than replaced — a rejected picture should
stop existing, not move.

Two things worth carrying:

* **Run the distribution count BEFORE rendering.** It is cheap, and it is the
  only way to see the difference between "a plate the eye keeps meeting" and "a
  plate that is simply on screen a while".
* **A close group portrait is the worst thing to repeat.** Faces are what the
  eye returns to, so the same four people smiling is noticed at 3 repeats where
  a deck or a horizon would pass at 6. The variety pass was therefore
  deliberately environmental — water, objects, distance, profiles — rather than
  more group shots.

## 27 · Hajimemashite v6 — the melody sense was dark in every cut we ever shipped (2026-09-23)

The ask was "can we generate sheet music from Suno stems." The answer turned
into a rendering change, because measuring the melody data exposed that the
feature built on it was barely running.

**Suno exports MIDI, one file per stem** (studio download, not the public
profile API — `suno-pull.mjs` only sees `audio_url` and `image_large_url`, so
MIDI is a manual per-song pull). 8 of our 21 stem downloads have it.

**The melody sense has been ~80% dark in every shipped cut.** `pitchColor()`
and `melodicMotion()` gate at `conf >= 0.35`. Measured across all 50 songs with
a `melody.json`, the share of words clearing that gate runs **4%–41%, typically
about 1 in 5** (mi-gente 4%, fast-enough 12%, one-tap-away 15%, void-into-gold
41% and best in class). pYIN is simply unsure of itself on a separated vocal.
Hajimemashite had no `melody.json` at all — its `planet.assets.stemAudio` is
undefined, so `melody-batch.mjs` never even considered it.

`scripts/stem-analysis/melody_from_midi.py` takes the notes from the MIDI
instead. Same `melody.json` v1 schema, so `melody.ts`, `KineticStage` and the
diatonic QA gate are unchanged. **No librosa** — it parses, in under a second,
which matters because `~/librosa-venv` is gone (§0) and the pYIN path cannot
currently run at all. `melody-batch.mjs --midi <dir>` drives it through the
same live-word fetch, QA gate and publish.

Results: hajimemashite **131/134 words pitched, diatonic 0.98**. On one-tap-away,
which has both, pYIN cleared 27 words past the gate and MIDI cleared **337** —
and where both are confident they agree on pitch class **81%** of the time and
derive the same key (A# major) independently.

**Three traps, all of which look like success:**

1. **"Most words got a note" cannot fail.** The first alignment check scored
   word coverage: 133/134. The control, with the MIDI shifted 1.7s off, scored
   129. Vocal notes are dense enough that every offset wins.
2. **Vocal MIDI is a CONTOUR, not a syllable track.** Suno merges runs and
   melismas: 111 vocal notes under 134 words. At the offset later proved
   correct, word onsets match note onsets only **29%** of the time.
3. **So take the clock from the DRUMS.** `stems.json` already carries kick
   times measured off the isolated drum stem, on the release clock, and drum
   onsets are sharp: hajimemashite locks at **+0.06s, 82% vs a 26% background
   (3.1x)**. The analyzer exits non-zero if that peak doesn't clear 55% and 2x.
   Then read vocal notes by OVERLAP with each word's window. Note the drum
   offset maps release→MIDI directly, so `align.lag` must NOT be applied again.

**Suno's MIDI key signatures are garbage — ignore them.** The 0x59 `sf` byte
must be −7..+7; Suno writes 15 and 12. Read as a pitch class, 15 → D# would
make this song D# minor, the *worst* of the twelve K-S fits (r=−0.318). Take
the key from the notes instead (K-S on the duration-weighted histogram); that
is what reproduced pYIN's key independently.

**`hexHue()` returns 190 for ANY grey — and palette[0] anchors the pitch wheel.**
§24 warned that a near-black palette[0] bends the pitch system off noise; the
real bug is wider. Pure white does it too: hajimemashite's palette leads with
`#FFFFFF`, so this gold song's theme hue was **cyan 190°**, and every sung note
would have been painted in a hue the grade does not contain. Harmless until the
day the melody sense actually has data. **6 of the 74 tracks with a planet lead
with a grey.** Fixed with `themeHueFrom()` (`melody.ts`): use the first palette
entry that actually carries a hue (chroma >= 8), falling back to `track.color`.
`backdrop.ts:486` has the same `hexHue(px[0])` pattern and was left alone —
worth an audit. Preflight passes "palette 4 colours, all legible" and does not
catch this; a hue-anchor check belongs there.

**What it cost on screen, honestly.** On dark plates the pitch colour is
excellent. On this cut's bright act (121.2–138.9, "THE DOORS SWUNG OPEN" — a
huge bright gold doorway with the phrase running straight across it), it is a
**regression**: with melody off the active word is pale cream and reads; with
melody on at `pitchSpread: 0.3` it is gold on gold and washes out. Verified by
rendering the identical window with `planet.assets.melody` pointed at a 404.

**The spread knob cannot solve this song**, and that is the general lesson:
§24 lowered spread because a wide swing turned words cold and lost them on the
DARK monochrome plates; a narrow spread loses them on the BRIGHT plates of the
same grade, because the words converge on exactly the plate's own hue. Hue is
the wrong lever — `pitchColor()` returns `hsl(H 82% 66%)`, a fixed lightness,
and lightness is what contrast needs. **`deck.glow` does not rescue it either:
0.6 (from 1.35) just dimmed every text layer without recovering contrast.**
A song whose art IS its theme hue at high brightness is a poor candidate for
pitch colour until the lightness question is solved.

Shipped: `hajimemashite-v6-vertical.mp4`, 1080×1920, 59.9s, A/V |error| median
16ms / p95 20ms.

## 28 · "They all feel like slideshows" — the camera drifts, it never arrives (2026-09-24)

### Correcting §27's session, and my own diagnosis

Two claims made earlier in this work were wrong and are worth killing before
someone builds on them.

**"Parallax is dead in every render" — true of the vars, false about the
effect.** `--par-x/--par-y` really are zero in headless capture (their only
writers are `deviceorientation` and `mousemove`). But they sit in the SAME
transform as `--cam-x/--cam-y`, and the **cinematic camera at `pass >= 5` is
very much alive** — renders run `pass=6`. A synthetic parallax driver was built,
measured against an A/B, and found to change nothing, because it was adding
±11px on top of the camera's ±46px. It was removed. Do not rebuild it.

**The real cause is the shape of the camera that IS running:**

```
camX = sin(t * 0.10) * (18 + push * 28)     // period 63 SECONDS
camY = cos(t * 0.074) * (12 + push * 18)
rot  = sin(t * 0.055) * 0.8
```

`sin(t * 0.10)` completes one cycle every 63s, so across a 60-second cut the
camera performs **a single slow sweep**, unrelated to the tempo. It never sits
still and it never lands. That is the definition of drift, and it is the default
on EVERY cut — this block needs only `pass >= 5`, not `deck.motion`, so it is
running on all 71 directed cuts whether or not they opted into camera work.

### The fix: hold, move, arrive

`deck.camSync` replaces the sines with BAR STEPS — hold on the downbeat,
accelerate to a new offset, arrive as the bar ends, hold again. Measured on
hajimemashite over an 11s window, sampling the engine's own `--cam-x`:

| | camX travel | step median | p90 | frames STILL | burst ratio |
|---|---|---|---|---|---|
| drift (sines) | 25px | 0.20px | 0.30px | **14%** | 1.5x |
| stepped (camSync) | 42px | 0.00px | 2.40px | **54%** | **2400x** |

Discrete is what editing is. Continuous motion, however pretty, reads as float.

Also added: `deck.motion.sync` snaps a shot's `dur` to a whole number of bars
(a move whose length is unrelated to the tempo ends wherever it happens to end),
and `deck.motion.ease: "arrive"` accelerates into the endpoint instead of
easeOut's decelerating settle. Both default off; every existing cut is untouched.

### barGrid, and why "strength" is the wrong gate

`stemSense.barGrid()` infers the downbeat by asking which phase's beats actually
carry a kick. It reports `strength` (the winner's hit rate) AND `margin`
(winner minus runner-up) — **and margin is the one that matters**:

| song | strength | margin | |
|---|---|---|---|
| hajimemashite | 0.71 | **0.37** | real downbeat |
| fast-enough | 0.91 | **0.09** | four-on-the-floor — every phase scores alike |
| one-tap-away | 0.84 | **0.01** | no downbeat information at all |

Gating on `strength` would have confidently mis-phased two of three. `camSync`
requires `margin >= 0.15` and silently keeps the old drift otherwise — stepping
on the wrong beat is worse than not stepping. **Bar LENGTH survives an ambiguous
phase**, so `motion.sync` works everywhere; only alignment needs the margin.

### The measurement trap (this one cost the most)

The first attempt measured motion by decoding frames to 96x171 greyscale and
taking the mean inter-frame delta. It reported **no difference at all** between
drift and stepped. The metric was the problem: a camera moving 30px over 1.4s at
1080 wide is ~0.35px/frame, which at 96px wide is 0.03px/frame — far under the
noise floor. A downscaled frame-difference **cannot see camera motion of the
magnitude this engine actually uses.**

**Measure the engine, not the pixels.** Drive the page with playwright, find the
element whose inline style carries `--cam-x` (it is the stage root div, NOT
`documentElement`), and sample the variable directly. That turned an
unfalsifiable "looks about the same" into 14% vs 54% frames-still. Note there is
no `<audio>`/`<video>` element on the studio page to read `currentTime` from —
sample against wall clock.


## 29 · Two pictures at once, and cutting on the song (2026-09-24)

§28 made the camera land on the bar. This makes the PICTURE do the same, and
puts a second image on screen for the first time in this engine's life.

**`deck.artSync`** — a plate swap waits for the next DOWNBEAT instead of landing
the instant the `swapMs` throttle expires. The throttle alone releases a swap at
an arbitrary point in the bar, so the image advances like a slide rather than
cutting like an edit. Capped at 1.5 bars of extra wait so a plate is never held
hostage to a drifted grid, and it needs a trustworthy downbeat (§28's
`barGrid` margin >= 0.15).

**A drum return cuts the picture immediately.** When `cuts[]` ends — drums back
after a silence — `artSync` clears `swapCtl.lastAt`, so the next request lands on
the hit instead of a beat or two after it. Arriving late to the song's own
biggest moment is the most slideshow thing a cut can do.

**`deck.inserts`** — a SECOND plate, hard cut into a band every `every` bars and
held for `hold`. `{ every, hold, at: "center"|"top"|"bottom", height, minPush }`.
It rides the same bar counter `camSync` steps on, so the two land together
rather than fighting. No crossfade anywhere in it: a crossfade is what a
slideshow does between slides, and the whole point of the layer is to read as
an edit.

Three things this cost, all worth knowing:

1. **Draw the insert from a real pool, not from history.** The first version
   used only plates already painted, reasoning they would be warm in cache.
   hajimemashite holds ONE plate (`scene-shine.webp`) for the entire bright act,
   so "anything but what's on screen" was an empty set and the insert never
   fired once. It now unions the shown-history with `assets.keywords` and the
   gallery, and warms the first few.
2. **`-z-[7]` was too high.** The band landed on top of the words and fought
   them for the middle of the frame. `-z-[9]` puts it directly above the
   backdrop (`-z-10`) and below every text layer, where it reads as a second
   picture behind the words instead of an overlay on them. A 40.625% centred
   band also competes with centred lyrics — `at: "bottom", height: 34` gives
   the two planes their own territory.
3. **A frozen probe looks exactly like a broken feature.** Debugging this in a
   bare playwright page showed the trigger reached but never firing. The tell
   was in the trace: `barNo` stuck at 41 forever while `push` never moved —
   playback was frozen, so song time never advanced past one bar. The studio
   page has no `<audio>`/`<video>` element to check `paused` on (§28), so
   **watch for a stalled clock in the data itself** — a bar counter that never
   increments is a stopped clock, not a dead branch. Verify in a real render,
   which does play.

Detecting an insert in stills without eyeballing every frame: compare mean luma
just inside each band edge against just outside, and require BOTH seams. One
seam alone fires constantly on ordinary art.

Shipped: `hajimemashite-v8-vertical.mp4`, 1080x1920, 60.0s, A/V |error| median
8ms / p95 13ms.

## 30 · The backdrop that was never there — artSync livelocked the plate (2026-09-25)

The complaint was "the background is just weird and broken", and it was worse
than that: on hajimemashite v5 **no plate ever reached the stage at all.** Every
frame the owner reviewed was veil, particles and text over empty space. The
photograph was fetched, decoded and cached, and then never shown.

**The mechanism.** `deck.artSync` makes an art swap wait for the next downbeat
instead of landing whenever the throttle expires. `barAt(grid, earliest)`
returns the downbeat *strictly after* `earliest`, and the scheduler below it
deliberately overshoots its timer by 20ms. So the swap woke 20ms PAST the beat
it had waited for, asked again, was told to wait for the NEXT beat, and
deferred forever. One bar at a time, for the length of the song.

The fix is three lines: treat "we are just past a downbeat" (within 150ms) as
being *on* it, and the swap lands instead of chasing the grid.

**Why it read as random.** The artSync branch only runs once `barsPhased` has
been computed. If a plate happened to land before the grid was ready it stuck
there, held, for the rest of the cut. So the SAME 10s window rendered bright on
one pass and flat on the next, with nothing random involved — it was a race
between the first art request and the bar grid. Four renders of one config went
1.92 / 1.95 / 1.94 / 5.86, which is exactly the shape that makes you distrust
your metric and start bisecting innocent code. I spent most of a session
bisecting `deck.abstract.layers`, which was never involved.

**The lesson that generalises: a missing asset is silent.** A plate that 404s
paints nothing, raises no error, and encodes a perfectly valid mp4. So does a
plate that is never requested. Two things now exist so this class of bug cannot
hide again — both in `scripts/perf/render-cut.mjs`:

- **failed-request reporting** — every 4xx/failed request during the cut is
  listed at the end. This immediately surfaced five plate URLs on this track
  pointing into `/planets/hajimemashite-v5/`, a directory that has never
  existed, including the ambient art for a whole section (93.6–105.4s painted
  nothing). Across the catalogue 64 of 74 tracks reference plates absent from
  `public/`, which looks alarming and is not: **188 of those URLs were probed
  on R2 and every one resolved.** Only this track had references dead in both
  places. So a local-disk audit alone proves nothing — probe R2 before
  concluding a cut is broken, and probe the RENDER before concluding either.
- **the backdrop watch** — samples the `/planets/` img in the render's own rAF
  and prints what the backdrop actually did: how many plates, how many
  transitions, how many sat below 0.15 opacity. `⚠ BACKDROP: no plate was ever
  on screen during this cut` is now a one-line answer to a question that cost a
  session. **Match the plate by its URL, not by "the biggest img on the page"**
  — the veil sits on top at full opacity and will happily report a healthy
  backdrop over a missing one. That wrong selector cost two renders.

**A second, real defect found on the way.** The art crossfade defaulted to 1.6s
while keyword art changes every ~2.3s, so each plate was replaced while still
mid-fade and the backdrop never once reached full strength — a genuine cause of
the "slideshow" feel independent of the bug above. The default is now 0.5s, with
`deck.artFade` (seconds) and `deck.artLift` (multiplier on the 0.6/0.85 target)
to override. **This changes every track that has no `deck.motion`**, which is a
deliberate break from the house rule that a new knob defaults to the old
behaviour: a plate that never finishes fading is a defect, not a style.

**Don't reason about the stage from outside it.** Every conclusion I drew from
edge-energy alone was wrong or misleading, and the bare playwright probe
disagreed with the renderer because it defaulted to `pass=4` while
`render-cut.mjs` uses `pass=6` — and `deck` (hence artSync) only activates at
pass ≥ 6. **A probe that doesn't match the renderer's pass is measuring a
different program.** When a render looks wrong, instrument the render.

## 31 · The curtain — a moment built to be reused (2026-09-25)

Forty-two hand-authored word→effect mappings are why hajimemashite's best
moments land, and also why the approach stops at one song. The curtain is the
counter-example: built for "the doors swung open, light…", and deliberately
knowing nothing about doors, gold, or that song.

`src/components/StageCurtain.tsx` takes a trigger count and a config. It fires
three ways, and a song can use any or all of them:

1. **Semantically** — `CURTAIN_WORDS` in `src/lib/effects/impact.ts` (door,
   gate, open, reveal, unveil, begin, enter, welcome…). Free for every song,
   forever. Gated at impact >= **0.7** rather than the usual 0.62 floor,
   because it covers the entire frame for about a second: two or three a cut,
   never twenty. `open`/`opens` also live in the `rise` family; the curtain
   wins, because a word meaning the world opening deserves the world opening.
2. **On the clock** — `dynamicPlus.curtains: [t, ...]`, same shape as
   `quakes`. For when the doors belong on a specific bar and you would rather
   not argue with the scorer. **Add the field to `PlanetDynamicPlus`** — an
   invented dynamicPlus key that isn't in the type is a silent no-op, which
   this repo has shipped before (§3f).
3. **Styled** — `deck.curtain: {dur, shut, hold, axis, color, edge, reveal}`.
   `axis: "updown"` parts top/bottom instead of sideways.

**It slams before it parts, and that is the whole effect.** Panels that are
already closed have to arrive somehow. Fading them in throws away the best
frame available — two halves meeting — so they sweep IN fast (0.13s), hold
shut (0.12s), then open slowly (0.78s). **The hold is what sells it:** without
it the eye reads one continuous wipe and the doors never existed. All three
phases are keyframes on ONE framer timeline with `times`, not three chained
animations — chaining through state leaves a frame of the old value at every
handoff, and on a 0.13s slam that frame IS the slam.

**It is also the only place the backdrop may hard-cut.** While the panels are
shut the frame is covered, so a plate change underneath lands as a REVEAL
instead of a crossfade. Every other art swap in the engine has to be gentle;
this one does not, and that contrast is most of why it reads as an event.
Keyed on the trigger count so a second curtain inside the first replaces it
rather than queueing — a dense passage cannot stack four sets of doors.

## 32 · The website was painting on every video (2026-09-25)

`src/app/layout.tsx` mounts `<ParticleField />` for every page on the site.
`/studio` is a page on the site. So a full-screen canvas at **z-[1], opacity
0.6** has been compositing over the song art — which lives at `-z-10` — in
**every cut this repo has ever rendered.** The stage already has its own
weather (`KineticParticles`, z-[2]); this was a second, unrelated particle
system, from the marketing chrome, drawing soft coloured blobs across every
photograph. It is the haze behind years of "the backgrounds look washed out /
weird / broken."

`render-cut.mjs` strips site furniture — the player bar, the beat pill, the
dev indicator — and this was never on the list, because nobody was looking for
site chrome UNDER the art instead of over it. It is on the list now.

**How it was finally found, after three wrong guesses.** I blamed the surface
layer, then the particle density, then the big-moment flares, and measured each
one wrong-headedly by changing a knob and re-rendering. What actually settled
it took one probe: enumerate every element covering >25% of the viewport at a
fixed moment and print its tag, z-index, opacity and blend mode. The answer was
one line of that dump — `CANVAS op=0.6 z=1` — and nothing in the stage's own
code could have explained it, because the element isn't in `KineticStage` at
all. **When a layer you cannot account for is on screen, enumerate the layers.
Do not bisect the config.**

### Two more substring false-positives in the same song

`surfaceFor()` and `particleModeFor()` match unanchored substrings against a
blob of mood + themes + keywords + title, and Red Flags hit both:

- **"green light"** → `/\b(moss|forest|damp|ancient|stone|green)\b/` → the
  engine overgrew a domestic-dispute song with **moss**.
- **"Financial Strain"** → `/rain|storm|.../` → **rain**. St-RAIN. This one is
  a happy accident that suits the song, and was kept.

Same family as Drink Drink matching champagne bubbles on its own title (§3f).
Override with `planet.effects.surface` (`"none"` disables) and `deck.weather`.
**Check both against a song's actual words before blaming the art.**

### And the thing to check before choosing a window

`lyrics_synced` can carry Suno's structural annotations as sung words —
`Intro`, `wChorus`, `beMale`, `timiMale`, `AlMaybe` — and, worse, **collapsed
timestamps**: 60+ words all stamped inside one second, plus a leaked prompt
("clean guitar fading into distorted low 808"). A window over that renders an
unreadable flash of text. Score candidate windows by the worst count of words
inside any 0.6s before picking one; on this song it ruled out the entire final
chorus, title line and all.
