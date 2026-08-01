# Directed-cut playbook — everything we learned, cut by cut

The complete workflow for shipping a directed Kinetica video (16:9 + native
9:16 pair) for a song. Ten cuts deep as of 2026-07-31: summer-drip,
different-this-summer, fast-enough, cocktails-and-code, drink-drink,
say-it-with-your-body (×6 revisions — the richest lesson mine),
maybe-was-the-answer, hajimemashite (the first cut for a song that was not
already in the catalogue), different-this-summer-debut (the AGENOR Facebook
debut — first PORTRAIT-ONLY cut, see §15). Every rule below was paid for.

Standing owner laws:
- **Both aspects, always** — 16:9 master + NATIVE 9:16 re-record (never crop).
- **Illustrate the scene** — art depicts the lyric's literal narrative, not
  word-matched decoration. Re-read the lyrics before art direction.
- **Own planet per song** — every song gets a DISTINCT art voice; resemblance
  only for songs in "similar orbit". Voices used so far: purple-gold comic
  noir, coral sunrise comic, 16-bit pixel + cars, '80s airbrush chrome,
  chiaroscuro oil, urban LED nightclub silhouettes, ultraviolet-noir photoreal,
  risograph duotone, Osaka gold-leaf night (photoreal, Kontext — see §12),
  blueprint dawn (photoreal + cyan drafting linework, Kontext — see §15).
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
- **wipe** — the longest sung-word gap ≥7s.
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
