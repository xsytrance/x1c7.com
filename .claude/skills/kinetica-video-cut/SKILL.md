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
  of the playbook (17 as of 2026-09-14: purple-gold comic noir, coral sunrise
  comic, 16-bit pixel+cars, '80s airbrush chrome, chiaroscuro oil, urban LED
  nightclub silhouettes, ultraviolet-noir photoreal, risograph duotone, Osaka
  gold-leaf night, blueprint dawn, THE AUDIBLE DESERT (no humans), THE ANVIL
  LIGHT (blacksmith documentary), SƠN MÀI LACQUER (Warm Without Burning),
  Osaka WET NEON recut, ONE WORLD GATE (flags/festival photoreal),
  PAPER RIVER (ukiyo-e woodblock, one river valley across one day)) —
  pick something none of those already own.
- **Dynamic mode is safe in 9:16 again** (2026-09-14). Playbook §11's "ship
  phrase throughout in portrait" predates the measured `fitScale` pre-scale that
  fixed the clipping; a 73%-dynamic vertical cut renders clean. See Step 3g.
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
  `npx next dev -p 3218` if it's down.
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
don't need R2/rclone (rclone is **not installed** on this box as of
2026-09-07 — if a profile needs `release.mp3` fetched from R2 and there's no
local copy, that step needs a different tool or the owner's help).

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

**When the song offers NO silence, use phase instead** (Days Drift By, §23):
its `cuts` held only the head and tail of the record and its drums run
straight through every transition. Take every window edge from `senses.json`'s
`beats`, then choose the next window's start so the beat-index delta is a
multiple of 4 — the crossfade then blends drum patterns that are in phase.
Costs one line of arithmetic and is as good as silence.

**THREE windows are allowed, and sometimes required.** A splice is not only
"first N + last N"; it is also the repair for a song with no dense 60s. If
`cut-preflight` fails a window on DEAD AIR mid-window, splicing a second time
*inside* that instrumental — rather than moving the window — cuts the gap under
the 6s threshold while keeping every lyric. Days Drift By needed exactly this:
two joins, 59.2s, all three windows green.

**`merge-cuts.mjs`'s success-path crash is FIXED** (the dead duplicate
decode-check line is gone as of the Days Drift By cut, 2026-09-14). Don't go
looking for it. The real check — a try/catch around an ffmpeg decode that
deletes the merged file if it isn't clean — is the one that remains.

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

## Step 3f — three worktree traps beyond §20's `node_modules` (2026-09-14)

`render-cut.mjs` needs `sharp`/`@img` symlinked in (playbook §20). Three more,
each of which reads as a crash rather than a missing file:

1. **`cut-preflight.mjs` resolves `.env` relative to ITSELF**, so it dies with
   ENOENT in a worktree while `_kiz-db.mjs` (which hardcodes the main checkout)
   works fine right next to it. Symlink `.env` and `.env.local` in;
   `.gitignore`'s `.env*` already covers them, so nothing can be committed.
2. **Preflight also wants a profile directory for the CUT's own slug** with
   `release.mp3` and `senses.json` in it. `--audio` satisfies the renderer but
   not the check; copy the master in and copy the senses from the source song.
3. **`pkill -f "next dev -p 3218"` matches the shell running the pkill**, so it
   kills your own command (exit 144) and looks like a crash. Same family as
   §19's self-matching `pgrep`. Start the replacement in a separate call.

## Step 3g — a MIXED phrase/dynamic cut, and writing new word FX (2026-09-14)

§11 of the playbook says "when in doubt ship phrase throughout". **That is now
stale** — the measured `fitScale` pre-scale in KineticStage (~line 1781) targets
56% of frame width in portrait with a pessimistic glyph advance, and its own
comment names §11 as the bug it fixes. A 73%-dynamic 1080x1920 cut renders with
no clipped word. Mix freely.

Facts you need before authoring a mixed cut:

- **Phrase mode renders words PLAIN — WORD_FX is unreachable from it.** Every
  animation lives in the dynamic stretches. A word FX mapped to a word that only
  ever occurs inside a phrase window is DEAD DATA and nothing warns you; check
  for it in the row builder (`scripts/ddb/v2_row.py` does).
- **`dynamicPlus.modes` only rules INSIDE a declared window**; outside it the
  render URL's `mode=` stands. Declare windows contiguously across the whole cut.
- Put mode boundaries BETWEEN words. `cut-preflight` warns when one lands inside
  a word ("re-renders mid-entrance") — move it into the gap.
- A dynamic window holding **exactly one word** is the punch (§6's micro-window).
  More than one word inside a window that overlaps a live phrase line draws the
  giant word on top of it.
- **Omit words to emphasise.** A word absent from `lyrics_synced.words` is never
  drawn and the previous word holds the frame longer. v2 drew 52 of 65.

Writing a new effect (three files, ~20 minutes):

1. `src/lib/effects/registry.ts` — add the id to the `TextEffect` union, to
   `ALL_TEXT_EFFECTS`, and a `TEXTBOUND` spec with a blurb + trigger tags.
2. `src/components/KineticStage.tsx` — the component (framer-motion `m.span`,
   per-letter, a stable `r(i, m)` pseudo-random, duration driven by `airtime`),
   plus its entry in the `WORD_FX` map.
3. `npx tsc --noEmit` then `npx eslint` — both are fast and both catch real
   mistakes here.

Two rules that cost a render to learn:

- **Travel in `vw`, not `em`.** The dynamic word is already frame-fitted; an
  em-based shove on a 14rem word leaves the frame entirely at 1080 wide.
- **If the effect's last keyframe is INVISIBLE, bind its duration to `airtime`**
  (`Math.max(floor, airtime * 0.98)`), not to a comfort floor. A hook word gets
  0.56-0.80s; a 1.6s duration means it is still animating in when the next word
  replaces it and it never reaches centre. Effects that end at rest are exempt.
- **Check the closing word's airtime against its effect's minimum duration.**
  Extending the last window a few beats (still bar-aligned) is the fix; the final
  window's END needs no bar alignment, so take the time back there.

**`dynamicPlus.scene` is silently ignored unless it is one of AURORA | EMBERS |
INK | SYRUP** (`lib/engine/backdrop.ts`). A themed name like "RIVER" leaves the
backdrop on AUTO, which hashes into the pool — a woodblock river song landed on
EMBERS, visible as orange fire in the ~1s before the first plate decodes at the
start of every window. Validate the name in the builder.

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
