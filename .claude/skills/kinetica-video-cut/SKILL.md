---
name: kinetica-video-cut
description: Ship a directed Kinetica lyric-video cut (30-70s, 9:16 vertical) for a Suno song in this repo. Use when asked to make/re-learn/continue a "Kinetica video", a "song video", a "lyric video", or to pick the next song to cut. Covers infra checks, picking a song+window, art direction, rendering, and the worktree trap that hides already-shipped work.
---

# Kinetica video cut — operator's front door

Full lore lives in `docs/VIDEO-RENDER-PLAYBOOK.md` (19 sections, ~900 lines,
one per cut, each paid for in real debugging time). **Read it before directing
art or wiring data** — this file is the fast path: infra checks, how to pick
a song without duplicating work, and the handful of facts that would otherwise
burn a whole session to re-discover. Don't re-derive what's below; it's already
paid for.

## Standing owner laws (2026-08-01+, do not relitigate)

- **ONE deliverable: 9:16 vertical only, master quality.** `--vertical`, never
  `--both`. No `-share` encodes, no 16:9, no four-file handoff.
- **Art is generated NATIVE PORTRAIT, 832×1472.** Never landscape — see
  playbook §17, "the 58% crop", the single biggest quality bug ever shipped.
  `object-cover` into a 1080×1920 frame keeps only the centre 42% of a
  landscape plate, before the Ken-Burns camera eats another 10-30%.
- **Own art voice per song.** Skim the "voices used so far" list at the top
  of the playbook (15 as of 2026-09-04: purple-gold comic noir, coral sunrise
  comic, 16-bit pixel+cars, '80s airbrush chrome, chiaroscuro oil, urban LED
  nightclub silhouettes, ultraviolet-noir photoreal, risograph duotone, Osaka
  gold-leaf night, blueprint dawn, THE AUDIBLE DESERT (no humans), THE ANVIL
  LIGHT (blacksmith documentary), SƠN MÀI LACQUER (Warm Without Burning),
  Osaka WET NEON recut) — pick something none of those already own.
- **Eyes on every deliverable before shipping.** Count figures, read letters,
  check the shot-size histogram (≥⅓ WIDE, ≤¼ CLOSE+MACRO). VERIFY numbers
  prove sync, never taste.

## Step 0 — infra check (30 seconds, do this first every session)

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3218        # dev server — must be 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8188/system_stats  # ComfyUI proxy — 200 wakes it
nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv
```

- Dev server on **:3218**. `:7272` is a stale prod build — never render against it.
  On 2026-09-23 the stale build was answering on **:4020** instead (a
  `next-server` bound to the tailnet IP), so don't match on the port number —
  match on whether the process is a `next dev` in YOUR checkout.
  `npx next dev -p 3218` if it's down.
- **CHECK WHICH CHECKOUT THAT SERVER IS SERVING BEFORE YOU EDIT ANY ENGINE CODE.**
  A dev server on :3218 is often another session's, running out of a WORKTREE —
  `.claude/worktrees/days-drift-by-cut` was answering on :3218 on 2026-09-15.
  Your `src/` edits then never reach the browser, three probe renders come back
  byte-identically wrong, and you will doubt your patch instead of your server.
  DB row changes DO land (Supabase is shared), which is what makes it so
  convincing. Run this, and if it is not your checkout start your own on a free
  port and pass `--base http://localhost:<port>`:
  ```bash
  for pid in $(pgrep -f "next dev"); do echo "$pid $(readlink /proc/$pid/cwd)"; done
  ```
- ComfyUI is a **user systemd unit**, not a bare process you start by hand
  anymore: `comfyui.socket` on **:8188** is the stable contract (Conjury's
  socket-activated front door — first connection raises `comfyui.service` on
  loopback **:8189**, and `comfyui-proxy.service` bridges them; it idles itself
  down after 5 quiet minutes and comes back on the next hit). Check with
  `systemctl --user status comfyui.service comfyui.socket comfyui-proxy.service`.
  **Do not hand-launch `main.py` on :8190 unless the playbook's §19 VAE-hang
  workaround is actually in play** (bfloat16 VAE freeze — `--fp32-vae` fixes
  it). The old `~/librosa-venv` / `~/whisper-venv` paths referenced in §0/§9 of
  the playbook **no longer exist** on this box — see the RMS-check workaround
  below instead of assuming those venvs are there.

## Step 1 — pick a song without duplicating work already shipped elsewhere

**The trap:** a finished, shipped cut can exist on an unmerged branch in a
worktree named after a DIFFERENT song. `git worktree list` showed a worktree
literally called `warm-without-burning` sitting on branch `osaka-recut-chorus`
— it had already shipped a full Warm Without Burning cut (voice: SƠN MÀI
LACQUER) *and then moved on* to an Osaka After Dark recut, all in commits
never merged to `main` or to whatever branch you're on. Checking only
`scripts/song-analysis/profiles/<slug>/*.mp4` on your current branch is not
enough — it will tell you a song has no video when one shipped somewhere else
three days ago.

Before picking, always run:

```bash
git worktree list                                   # any other checkouts?
for w in .claude/worktrees/*/; do
  echo "=== $w ==="; git -C "$w" log --oneline -8    # what actually happened there
done
git branch -a | grep -vE 'HEAD|main$'                # any song/cut branches never merged
```

Then rank candidates on your own branch:

```bash
for d in scripts/song-analysis/profiles/*/; do
  echo "$(find "$d" -maxdepth 1 -iname '*.mp4' 2>/dev/null | wc -l) $(basename "$d")"
done | sort -n   # 0 = no cut yet, on THIS branch at least
```

Prefer a candidate that already has `senses.json` + `transcript.json` +
`planet.json` in its profile (full analysis already done, just no cut) over a
bare `tracks.json`-only stub — it skips playbook §1/§9 entirely. Cross-check
`assets/stems/<Title>*.zip` and `assets/wav/<Title>.wav` exist locally so you
don't need R2/rclone. (**rclone IS installed again** — `/usr/bin/rclone`,
verified 2026-09-23 publishing a melody.json to R2. The 2026-09-07 note saying
it was missing is stale; `melody-batch.mjs` also falls back to
`~/.local/bin/rclone`.)

## Step 2 — pick the window, verify it against real audio, not the LRC's word

`analysis.sections[].start` boundaries are cheap and usually good scaffolding
(cold open → verse → chorus → bridge → drop → outro). The house formula that
has shipped every recent cut: **the final chorus/hook repeat + the spoken/
ad-lib moment before it + the closing tag line**, landing at 56-70s total —
see FAG (§19, 62.0s), Warm Without Burning (64s), this skill's own worked
example below.

**RMS-onset sanity check without librosa** (the venvs the playbook assumes
are gone — this is the replacement, plain ffmpeg, no python deps):

```bash
unzip -o -j "assets/stems/<Title> Stems.zip" "0 Lead Vocals.mp3" -d /tmp/stem/
ffmpeg -i "/tmp/stem/0 Lead Vocals.mp3" -ss <word_t> -t 0.6 -af volumedetect -f null - 2>&1 \
  | grep -E "mean_volume|max_volume"
```

Gate: **> -42 dB mean** for sung words, **> -52 dB** for whispered/spoken ones
(playbook §16/§19). Sanity-check the check itself once against a KNOWN silent
moment (e.g. `t=1-2s` before vocals start) — a healthy stem reads roughly
-70 to -80 dB there; if your "loud" checks also read that low, the seek is
broken, not the song. A heavily limited/compressed vocal can legitimately hit
the *same* max_volume ceiling (e.g. -5.6 dB) at every loud moment — that's the
limiter, not a bug, and it's a good sign the mix will read strong on screen.

Always decode the true duration (`ffmpeg -i x -f null -`), never trust the
container header — Suno mp3s lie by 2-3x on stem files (playbook §9/§16).

## Step 3 — art direction, render, ship

Follow playbook §8's quickstart in order (lyrics verify → art-direct a new
voice → wire planet data → render → QA → deliver via SendUserFile). Generate
**one proof plate first** before batching a whole scene set — confirms style,
ComfyUI health (§19's VAE-hang), and prompt length (§12a: >~900 characters of
elaborated prose silently returns a black plate at the wrong resolution, no
error) before you spend a batch on it.

## Step 3b — local ASR (2026-09-08): Parakeet TDT via onnx-asr, not whisper

`~/whisper-venv` is gone (see Step 0). Installed fresh at the same path with
`pip install faster-whisper "onnx-asr[gpu,hub]"` — **NVIDIA Parakeet TDT
0.6b-v3** is the better fit for this repo's chant/ad-lib-heavy hooks
(near-zero hallucination on silence, vs. whisper's well-documented pattern of
inventing words in gaps — see every §16/§18/§19 whisper war story in the
playbook). English + 25 European languages only — keep faster-whisper too for
Spanish/Vietnamese/Japanese cuts.

Three real gotchas, in the order you'll hit them:

1. **Both `onnxruntime` and `onnxruntime-gpu` installed together break each
   other** (`onnx-asr[gpu,hub]`'s `gpu` extra can end up pulling plain
   `onnxruntime` alongside it) — you get `AzureExecutionProvider` +
   `CPUExecutionProvider` only, no CUDA. Fix: `pip install --force-reinstall
   --no-deps onnxruntime-gpu`, never have both installed at once.
2. **cuDNN is not on this box system-wide.** CUDA EP init fails with `dlopen
   failed for libcudnn.so`. Fix: `pip install nvidia-cudnn-cu12` into the same
   venv, then export `LD_LIBRARY_PATH` to its `lib/` dir before running (see
   below) — no system package, no sudo.
3. **The API is not `model.recognize(path, timestamps=True)`.** Call
   `onnx_asr.load_model(...).with_timestamps()`, then plain `.recognize(path)`.
   The result's `.tokens`/`.timestamps` are PARALLEL TOKEN-level lists, not
   words — this tokenizer marks a word boundary with a **literal leading
   space** on the token (not sentencepiece's `▁`). Merge yourself: a token
   starting with `" "` begins a new word, anything else appends; a word's end
   = the next word's start. And **`onnx_asr`'s file reader is stdlib `wave`,
   mp3 not supported** — decode with ffmpeg to a real wav first, same as every
   other stem in this repo.

Working shape end to end:

```bash
ffmpeg -y -v error -i "0 Lead Vocals.mp3" -ar 16000 -ac 1 lead.wav
export LD_LIBRARY_PATH="$HOME/whisper-venv/lib/python3.14/site-packages/nvidia/cudnn/lib:$LD_LIBRARY_PATH"
~/whisper-venv/bin/python scripts/<song>/transcribe.py lead.wav out.json
```

Real numbers on a 207s song: model load ~1s, transcribe ~1-2s (GPU). It is
genuinely that fast — don't over-budget time for this step.

## Step 3c — a SPLICED cut (non-contiguous window, 2026-09-08)

Every prior cut in this repo rendered one continuous window. A "highlight
the first N and last N" ask needs two separate renders stitched together —
the tooling already supports this, it just hadn't been used yet:

```bash
node scripts/perf/render-cut.mjs --vertical --track <slug> --from <A0> --to <A1> --base http://localhost:3218 --out .../part-a.mp4
node scripts/perf/render-cut.mjs --vertical --track <slug> --from <B0> --to <B1> --base http://localhost:3218 --out .../part-b.mp4
node scripts/clip/merge-cuts.mjs --a part-a-vertical.mp4 --b part-b-vertical.mp4 --out final.mp4 --transition fadeblack --dur 0.6
```

**Pick the splice point where the SONG ITSELF already goes quiet**, not an
arbitrary timestamp — a drum-silence/riser gap from `analyze_stems.py`'s
`cuts` array. A crossfade landing inside real silence never fights two
unrelated drum patterns; a crossfade over live drums on both sides does.
0.6s duration left comfortable room either side of a ~2.3s natural gap here.

**`merge-cuts.mjs` had a real bug that crashes on the SUCCESS path**: an
unused decode-check line (`execFileSync(..., {stdio:["ignore","ignore","pipe"]}).toString?.()`)
returns `null` when stdout is ignored (execFileSync returns stdout, not
stderr), and `null.toString` doesn't exist even with `?.` because the crash
is on the property access chain resolving on `null` itself, not a method
call on undefined. It's dead code duplicating the real check two lines
below — just delete that line, don't route around it.

**A spliced cut leaves 1-3s of stale phrase text after the cut**, because
the engine has no concept of "we just jumped 80 seconds" — it keeps
showing whatever LRC line was last active before the splice until the new
window's own first stamped line arrives. Cosmetic, mostly hidden by the
fadeblack dip, but a fast real fix if it bothers you: add an LRC line
stamped at the SECOND window's exact start with blank/next text, so the
carry-over has nothing stale to show.

## Step 3d — two silent planet-data schema bugs that produce a black backdrop

Both burned a full render-and-inspect cycle each. Check both BEFORE
rendering the first time, not after:

1. **`assets.keywords` / `dynamicPlus.words` keys must be lowercase.**
   `KineticStage.tsx` does `clean(words[i].w).toLowerCase()` before indexing
   into `art?.[w]` — a dict keyed `"Stamp"` never matches the sung word
   `"stamp"`. FAG's own row.json (the reference example) already keys
   everything lowercase; copy that convention, don't "clean up" the casing
   to match the display text.
2. **`analysis.sections[]` needs `start`/`name`, not `at`/`label`.** The
   `PlanetSection` type (`src/lib/planet.ts`) is `{name, emotion, intensity,
   colorHint, start}`. Writing `{at, label}` (which is what an *existing
   shipped row*, FAG's, actually contains) silently no-ops `activeSection()`
   — the field it reads is `s.start`, so a section list keyed `at` matches
   nothing and NO ambient art ever paints, keywords or not. This means at
   least one shipped cut may be running on dead section data — worth an
   audit, not just a note. `colorHint` is also required by the type even
   though nothing appeared to break without it; set a real hex value anyway.

Symptom for both: the render completes, VERIFY passes, words render fine —
and the whole backdrop is just the particle starfield, pure black. Preflight
does not catch this today (nothing checks the DB row's actual field names
against the type). Pull ONE frame with ffmpeg and eyeball it before trusting
a render that "succeeded."

## Step 3e — a chant/hook track needs its DOMINANT word wired, or the screen freezes (2026-09-08)

Shipped International Mode with only the DISTINCT content words keyword-mapped
(Stamp/Move/World/Touch/road/...) and left the repeated hook word
("International", 30+ occurrences, the majority of the song's words)
unmapped — reasoning it would "clutter" the ambient section art. Verdict from
the owner: **"absolutely atrocious... you barely changed the image on
screen."** Correct call, and it was findable before shipping: `assets.sections`
only changes art on an EMOTION-bucket boundary (a handful of times across the
whole cut), so any stretch dominated by one repeated word with no keyword of
its own is one static image for as long as that word repeats — 14s straight
in this cut's first window, 24s in the second.

**The fix, not a full re-shoot:** map the dominant word itself as a keyword,
then give it a `gallery.json` pool (§3 in the main playbook — "extra
paintings per word... the engine cycles through") of MANY variants so
`pooledArt()` rotates a new plate on every single occurrence instead of
locking to one:

```js
// planet.assets.keywords (lowercase key, same rule as §3d):
{ "international": "/planets/<slug>/scene-flags.webp" }
// gallery.json uploaded to R2 at planets/<slug>/gallery.json:
{ "art": { "international": ["/planets/.../scene-world.webp", "...9 more"] } }
```

Reused most of the pool from art already generated for OTHER keywords
(flags/world/stars/street/bass all already existed) — pooling doesn't need
brand-new plates, it needs the dominant word to have somewhere to rotate TO.
Added 6 new plates anyway (globe/stadium/hands/fireworks/kids/summit) for
real additional variety, not just recycling.

**Diagnose this before shipping, not after a complaint:** count occurrences
of every word in the window. If one word is >20% of the total and it's NOT
in `assets.keywords`, the screen will freeze on section art for its every
run. FAG never hit this because it's a ballad with almost no word repeats —
this class of bug is specific to hook/chant-style songs, which is exactly
the shape of track most likely to get picked for a video next.

## Step 3f — "pure dynamic" and the THREE other text layers (2026-09-15, §23)

`render-cut.mjs` already defaults to `--mode dynamic`, but `dynamicPlus.modes`
OUTRANKS the flag (`liveMode = schedMode ?? mode`). A cut is only pure dynamic
if every window says `dynamic` — assert it in the builder. Windows that all say
dynamic still earn their keep: entering one fires the tape-warp and clears the
giant-word residue, which is exactly what Warm Without Burning was doing.

`deck.giant.pile = 0` gives ONE giant word with no residue — and reaches only
one of four text layers. The others each have their own knob (all added §23,
all defaulting to the old behaviour):

- `deck.giant.stutter: false` — the `z-[7]` PILEUP, nine scattered clipped
  chips emitted by any ≥3-repeat run within 1.4s. Great on "push-push-push",
  ruinous on a chant with a long hook word. **This is usually the wall you are
  actually looking at.**
- `deck.choir: false` — the `z-[2]` blurred 24vw word under the stage. A long
  word runs off both edges and reads as a smear.
- `deck.ghosts: 0` — dying lyrics dissolving into the GL backdrop. A hook word
  repeated 15 times stacks faster than `ghostFade` clears.

If you invent a deck key, **grep the engine for it before believing it worked** —
a previous session shipped `giant.stutter: false` as a silent no-op.

Two more silent clamps in the same family: `deck.backdropHue` is in **TURNS**
(−0.5..0.5), so `36` clamps to a 180° hue rotation that turns warm art lilac;
and `dynamicPlus.scene` is ignored unless it is one of
`AURORA / EMBERS / INK / SYRUP` — pinning a REAL one paints the GL scene behind
plates that render at 0.6 opacity and hazes every frame. Omit it.

## Step 3g — ASR under-segments chopped runs: transcribe SLICES (2026-09-15, §23)

Whole-file Parakeet collapses dense vocal chops. On International Mode it heard
ONE token where the stem has five beat-locked hits, and labelled "Gate closed"
as a single token at *closed*'s onset — so the pair landed 0.35s late with its
first word missing. Re-running the SAME model on 6–9s **section slices**
recovered every one of them. Slice first, then verify each stamp against a 20ms
dB profile of the lead stem (gate −42 dB; the 300ms before a phrase should read
−55 to −101 dB, which proves the gate measures onsets and not a floor).

**Follow the AUDIO, not the lyric sheet** — Suno's sheet is the prompt, not a
transcript, and will claim three hook repeats where the take sings two.

End the cut where the word ENDS, not on the nearest beat: 61.277 was a clean
beat that sliced the final "Large" in half. `senses.json`'s `cuts` array had
already flagged the percussion gap it lives in.

## Step 3h — variety, and the shake (2026-09-15, §23 addendum)

**A hook word needs MORE plates than it has hits.** `pooledArt()` skips entries
to satisfy its shot grammar (never two same-size shots back to back), and the
section's ambient plate lands on top of the rotation, so 15 hits over 15 plates
still visibly repeats. 24 in the pool gave 16 distinct plates on screen.
Measure it by logging every art CHANGE over a real playthrough — a contact
sheet lies, because it over-weights whichever plate is held longest.

**`dynamicPlus.quakes: [t, ...]`** rattles the stage on the clock (CSS quake +
particle scatter + the live word reacting in the song's own tap language). All
of it existed already and none of it was reachable in a render — only a real
phone `devicemotion` ever set it. Use it on the few genuine hype moments.
Verify by measuring frame-to-frame motion, not by trusting the array; a good
one reads 25-45x the median.

**Named things beat anonymous ones.** "Two random girls on a road" got vetoed;
a famous road with a flag on it did not. Keep generated flags to simple
geometry (stripes, blocks) and keep `readable letters` in the negative prompt —
an Italian tricolour came back red-and-white and had to be dropped.

## Step 3i — likeness art, and why a set comes back monotonous (2026-09-16, §24)

If every plate has the same person in it, look at the TOOL before the prompts.
Flux Kontext is an instruction-EDITOR and preserves the subject of its source
image by design — seed it from an artist photo sixteen times and you get
sixteen of that artist however wide the prompt asks for. Split the set: plates
WITH a person go through Kontext (paid, likeness); plates with NO person are
ordinary text-to-image and run locally on ComfyUI for free. Fewer portraits is
then CHEAPER, not a compromise.

Kontext specifics: key is `AIMLAPI_KEY` in `~/.config/ossicle/aimlapi.env`
(the old `~/.bfl_key` is gone); run with `~/whisper-venv/bin/python` (PIL is
not in system python3 any more); `safety_tolerance: "5"` or fully-clothed
street scenes come back as SOLID BLACK; and the API returns 752x1392, so
`cover()` every result to 832x1472 yourself.

**Two colour traps that make words illegible:**
- `palette[0]` is the melody's base hue (`themeHue = hexHue(palette[0])`), not
  decoration. Lead with the song's real colour — a near-black first entry means
  the whole pitch-colour system bends off noise.
- `deck.pitchSpread` (0..1, absent = 1) scales how far the sung note pulls a
  word's hue off the theme. Full spread is +/-80 degrees; on a MONOCHROME grade
  that turns some words cold and they vanish. 0.3 keeps them in the family.
- `deck.glow` is per-cut, not a constant: bright plates want ~0.45 (a halo
  bleaches them), near-black plates want ~0.95 (the word needs presence).

## Step 3j — the repeated word as a FEATURE (2026-09-16, §25)

§23 said to switch the stutter pileup off. That was right for a cut where it
buried the frame — it is NOT a general rule. Art-directed, it is the best thing
you can do with a chant hook:

  `deck.giant.stutterLayout: "pour"` + `stutterEmit: [x, y]` stacks the repeats
  bottom-up in one column at constant size, no rotation, single colour, each
  chip flying in from the emit point. Put the emit point on the bottle / mouth /
  source in the plate and the words look poured out of it.

**Grep an effect for hex literals before wiring it to a repeated word.** The
registry is NOT colour-neutral: `drip` hardcodes lilac/pink, `liquid` hardcodes
blue. `pulse` uses var(--theme-accent) and wears the song's colour.

**`deck.weather`** pins the particle mode. particleModeFor reads the TITLE,
which a cut cannot change — a song called "Drink Drink" fizzes like champagne
no matter how you word its mood.

**deriveTheme puts secondary at hue+45 and accent at hue-35.** On a monochrome
grade those are a different colour entirely; an unpitched giant word falls back
to the accent.

**A valid zip proves nothing about its contents** — a stems delivery arrived
with all seven members intact and 1.03 seconds of silence in each. Decode
before trusting. And when ASR cannot hear a pitched/warped chant (it will
transcribe "drink" as "trem"), detect onsets on the isolated vocal and check
them against the BPM grid instead.

## Step 3k — prompt ORDER, and contrast in both directions (2026-09-16, §26)

**Where an instruction sits in the prompt is part of the instruction.** "A
diverse crowd" at the END of a long LOOK string produced 36 almost entirely
white plates; the same idea as the FIRST clause, naming groups concretely, fixed
it in one pass. Same for grade — "late golden hour" gives high-key pale resort
photography, so state the sun's POSITION and the warmth outright.

**There is no house value for `glow`.** §24 needed 0.95 on near-black plates;
§26 needed 0.45 on bright cream ones, where more glow is mud. On bright art also
reach for a SATURATED warm seed (deriveTheme clamps lightness to 0.5-0.62, so a
dark seed cannot survive) and a heavier vignette.

**New effects must be colour-neutral** — draw from currentColor /
var(--theme-accent), never hex literals (§25). Two built this way: `heathaze`
(blurred ghosts drifting behind a crisp original — readable AND shimmering) and
`screw` (the word drags down leaving a smear). Third pile layout `trail` joins
scatter and pour, for chopped material.

**ASR supplies the clock; the official lyric sheet supplies the words.** Parakeet
on the mix timed this song perfectly and mis-heard "Heat turned up" as "He
turned up" and "this sundress glow" as "the sun dress glow". Never ship ASR
spelling.

## Step 3l — count the plate distribution BEFORE you render (§26 addendum)

"You're reusing it a lot" is measurable without rendering: walk the word list,
resolve each word through `assets.keywords` + the gallery pool the way
`pooledArt()` does, and tally hits per plate. Summer Drip's first map put 81
word-hits on 18 plates with the top four taking 35 — invisible on a contact
sheet, which samples time evenly and cannot tell "held once for four seconds"
from "came back four times".

Rule of thumb: aim for worst-repeat <= ~6 and every plate used at least once.
If you are over, ADD PLATES — re-mapping alone just moves the crowding.

**A repeated close group portrait is the worst offender.** Faces are what the
eye returns to; the same four people smiling is noticed at three repeats where a
horizon passes at six. Make variety passes environmental — water, objects,
distance, single profiles — not more group shots.

And when a picture is rejected, DELETE it from R2, do not just unreference it.

## Step 4 — log what you learned

Every cut has taught the playbook something new. Add a numbered section (§20,
§21, ...) to `docs/VIDEO-RENDER-PLAYBOOK.md` for anything that isn't already
there, the same way §19 (Forged Above Gold) did. Update the "voices used so
far" list at the top. If something about THIS skill file was wrong, stale, or
missing, fix the skill file too — that's what keeps the next session from
re-paying for the same discovery.

## Worked example: MADETOBREAK (2026-09-07, in progress)

Picked over `another-year-...` and `music-is-my-drug-rooklyn-mix` (same
0-mp4, fully-analyzed shortlist) because the title itself supplies the visual
concept and Tyler Haze already has a graded-portrait pipeline proven in FAG.
Window **168.00 → 232.37 (64.37s, true decoded duration — song ends inside
the final word)**: the "Drop" callback ("Everything but me"), the outro build,
a shouted "Tyler!" ad-lib at 192.42, the final title-hook repeat
("I was made to break" / "Not bend, not fall, not fade" / ...), closing tag
line "I came out built to last" landing at the literal last second of audio.
RMS-checked at 168.00, 192.42, 223.30 and 231.80s: all -25±0.3 dB mean /
-5.6 dB max (a hit-the-ceiling limiter, consistent across every hit — good
sign, not a bug); a control check at 2.0s (pre-vocal) read -76.5 dB, confirming
the method distinguishes silence from a real onset. Proposed 15th voice:
**KINTSUGI RIOT** — dusk house-party wreckage (broken bottles, cracked
pavement, a torn banner) with the cracks running molten gold instead of being
hidden, illustrating "I don't carry my damage, I make damage behave" /
"damage holds me up... reinforced" literally, distinct from ANVIL LIGHT
(warm documentary blacksmith photoreal — same artist, different song, must
not resemble).

**Proof-plate finding (scripts/mtb/art.py, standard :8188 service, no VAE
hang, Juggernaut-XL, ~20s/pair):** describing the gold as an object
("kintsugi lacquer", "gold leaf", "molten gold welling up") renders it as
decorative inlay or scattered debris sitting ON the crack — reads as jewelry,
not damage. Describing it as a LIGHT SOURCE — "the crack itself is glowing
bright molten gold like liquid fire trapped just under the surface, the glow
is the only light source in the frame, everything past its reach falls into
deep black shadow" (the exact clause shape that worked for ANVIL LIGHT's
forge-glow shots in FAG) — immediately reads as fire/damage, not decoration.
**The emissive-light-source clause pattern transfers across voices and
subjects; the object/material-description pattern does not, no matter how
evocative the material name sounds.** Confirm this before writing a whole
shot list for any voice whose concept is "X but glowing."
