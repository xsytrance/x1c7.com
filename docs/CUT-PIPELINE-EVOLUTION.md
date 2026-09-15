# The cut pipeline, rebuilt for variety and volume

*Written 2026-09-14, after shipping Days Drift By v1 and v2. Every number below
was measured on this box, not estimated.*

The brief: the videos are starting to look the same; make the pipeline cheaper
and more parallel; use local models where they're good enough; eventually add
many more effects and locally generated short video clips.

---

## 0 · What is actually wrong (measured, not guessed)

**The sameness is not an art-style problem. It is a MOTION problem, and a
recipe problem.** Three measurements:

| finding | measurement |
|---|---|
| Every cut ever made used **one of three SDXL checkpoints**, prompt-only | `sdxl_turbo` ×30, `Juggernaut-XL` ×8, `DreamShaperXL` ×3 across all cut art scripts |
| **Zero cuts have ever loaded a style LoRA** | 12 style LoRAs installed in `models/loras/`; `grep` finds no `LoraLoader` in any `scripts/<cut>/art.py` |
| **Every cut shares one camera grammar** | `ART_MOVES` is 8 presets, *all* scale 1.10–1.29, chosen by hashing the image URL |

The third is the big one. A viewer watches 60 seconds of *motion*. Eight
Ken-Burns pushes at 1.1–1.3×, picked by a hash, is the same film language every
time — regardless of whether the stills are woodblock, blacksmith documentary or
Vietnamese lacquer. Seventeen "distinct voices" have been seventeen subject
changes wearing one identical camera.

**And the style database already exists.** `scripts/lexicon/art.mjs` holds a
**26-entry style registry** — `{id, engine, moods, ckpt, loras, dress()}` —
spanning six engines (sdxl · zimage · flux2 · qwen · chroma) and wiring up all
twelve LoRAs: `pixel`, `watercolor`, `storybook`, `papercut`, `3d-toy`,
`stickers`, `chalkboard`, `neon-sign`, `stained-glass`, `graphic-novel`,
`anime`, `manga-line`, `noir`, `cinema`, `film-still`, `analog`, `concept-art`,
`poster`, `dream-collage`, `oil-light`, `dark-surreal`, `photo`, `neon-night`,
`word-portrait`, `word-neon`, `osaka-gold`.

The Lexsycon night job paints with all of it. **The song-cut pipeline has never
touched any of it.** That is the single highest-leverage fact in this document:
the variety was already built and was never plugged in.

**The engine restriction that caused it is also stale.** Playbook §18 says "the
DiT engines wedge ComfyUI — cut art is SDXL-only until that is fixed". §21
already corrected the diagnosis (it was `MemoryHigh=8G` throttling the cgroup,
not the models). Measured now: `MemoryHigh=16G`, `MemoryMax=22G`. The Lexsycon
job uses flux2/chroma/qwen/zimage nightly. **Cuts can use all six engines today.**

---

## 1 · How much vision do we actually need?

Measured over the two Days Drift By cuts: **~25 frontier-vision image reads for
2 videos, ≈12 per video.** They fall into three buckets:

| bucket | per video | mechanical? | example |
|---|---|---|---|
| **Defect screening** | ~5 | **yes** | "does this plate contain text / a seal / a stray human?" |
| **Metadata tagging** | ~2 | **yes** | shot size WIDE/MED/CLOSE — today hand-authored in a `SIZES` dict |
| **Taste + composition** | ~3 | **no** | "is this the right plate for this lyric; does the cut read?" |
| Render QA frames | ~2 | partly | sync/black-frame checks are already ffmpeg, not vision |

So **roughly 7 of 12 reads per video are mechanical** and can move to a local
VLM. The taste calls should stay on the best available vision model — they are
the ones that decide whether the video is good.

This also kills a chore: `SIZES` is hand-written per cut today (22 entries for
Days Drift By) and it drives both the camera (`artMoveFor`) and the
no-two-same-sizes-in-a-row rule. A local VLM can tag it, which makes shot-size
data *free* and therefore reliable enough to drive a richer camera.

---

## 2 · The plan

### Phase 1 — Stop repeating yourself (the variety unlock)

**1.1 Promote the style registry to a shared module.**
Move the 26-entry table out of `scripts/lexicon/art.mjs` into
`src/lib/art/styles.mjs`, consumed by both the Lexsycon job and the cut
pipeline. Add to each entry:

- `categories: []` — the taxonomy asked for: `photoreal · painterly · illustrated ·
  animated · graphic · texture · type`, plus era/mood tags.
- `motion: "<profile id>"` — which camera family suits it (see 1.3).
- `deck: {}` — sane particle/glow/grain defaults for that medium.

**1.2 Track usage so the system can refuse to repeat.**
A tiny `docs/codex/style-usage.json`: `{styleId: [song slugs]}`. A
`pick-style.mjs` that, given a song's mood, **excludes every style used in the
last N cuts** and prints the candidates. "Pick something none of those already
own" becomes enforced instead of remembered.

**1.3 Break the camera monoculture — the highest-value change in this doc.**
`ART_MOVES` becomes **motion families**, not one pool:

- `drift` — near-static, 1.00–1.06, long slow lateral (for painterly/woodblock)
- `push` — the current 1.10–1.29 family (for photoreal)
- `snap` — hard cuts, no move, on the beat (for graphic/pixel/type)
- `handheld` — small random jitter (for analog/documentary)
- `parallax` — foreground/background split at different rates
- `hold` — dead still. Deliberate stillness is a style choice we have never used.

Selected by the plate's **style + shot size**, not by hashing the URL. Note
`WIDE_MOVES` already exists (line 294) — the split is half-built.

### Phase 2 — Cheap eyes (efficiency)

**2.1 `qwen3-vl:8b` local screener** (~6 GB, pulled). Three jobs, all mechanical:

- `screen-text` — reject any plate containing letters/characters/seals. This
  cost the most manual effort of anything in the last session: 6 of 22 plates
  leaked kanji cartouches, invisible at contact-sheet scale.
- `screen-subject` — count people; enforce "no humans" briefs.
- `tag-shots` — emit WIDE/MED/CLOSE/MACRO, replacing the hand-written `SIZES`.

Runs **after** generation so it never contends with ComfyUI for VRAM, and takes
the GPU Watchbill lease like any other GPU worker.

**2.2 Contact sheets become exception reports.** Today: generate 44, look at all
44. Then: generate 44, screen locally, and put only the *survivors* (and a short
list of the rejects with reasons) in front of a frontier eye. Expected frontier
vision drop: **~12 reads/video → ~3.**

### Phase 3 — Motion that isn't Ken Burns (the real fix for sameness)

ComfyUI here is **v0.34.6 with native `nodes_wan.py`, `nodes_wanmove.py`,
`nodes_cosmos.py`, `nodes_mochi.py`, `nodes_hunyuan.py`, `nodes_video_model.py`
— no custom nodes required.** A MiniMax H3 video model (21 GB int8) and its
video VAE are already on disk.

Recommended: **WAN 2.2 I2V at 480p, 2-3 s clips, image-to-video from plates we
already generated.** Rationale: I2V keeps the art direction we approved (the
plate IS the first frame), fits 16 GB comfortably at 480p, and native support
means no custom-node maintenance. 2 s at 16 fps = 32 frames, which is a
tractable render on a 5060 Ti.

The engine change is small: `assets.keywords` values can already be any URL —
teaching `KineticStage` to accept `.mp4`/`.webm` alongside `.webp` and render a
looping muted `<video>` in place of the `<img>` is a contained change to the
backdrop layer. **Not every plate should move** — a few moving plates among
stills is a beat; all-moving is a screensaver. Same lesson as §19's portraits.

### Phase 4 — More effects, sanely

Tranche 9 added six effects in ~20 minutes each once the pattern was clear. The
bottleneck is not authoring, it is **discovery** — 52 effects exist and a cut
uses maybe 8. Wanted:

- A contact sheet for EFFECTS: render every effect on one word, as a grid, so
  choosing is visual instead of archaeological.
- Effect *families* in the registry (`weather`, `damage`, `light`, `type`,
  `glass`) so a cut can be told "use the weather family" and get coherence.

---

## 3 · Sequencing, and what each phase buys

| phase | effort | buys |
|---|---|---|
| 1.1 + 1.2 style registry | small — the table exists, it moves | 26 styles instead of 3 checkpoints, enforced non-repetition |
| 1.3 motion families | medium — engine change | **the biggest perceived-variety win** |
| 2.1 + 2.2 local screening | small | ~75% fewer frontier vision calls, free shot tags |
| 3 video plates | large — spike first | motion that isn't a zoom |
| 4 effect discovery | small | the 52 effects already built get used |

**Do 1.1/1.2 and 2.1 first** — they are cheap, they unblock everything, and 1.3
is where the sameness actually dies.

---

## 4 · Open questions for the Sovereign

1. **Style per song, or style per section?** A cut could change medium at the
   bridge. Powerful, and easy to make ugly.
2. **How hard is the no-repeat rule?** Refuse a style used in the last 5 cuts,
   or just warn?
3. **Video plates: how many per cut?** Recommend a cap (2–4) rather than all.


---

## 5 · Built so far (2026-09-14)

**`scripts/art/recipes.mjs`** — the 26-recipe table, extracted from
`scripts/lexicon/art.mjs` so both pipelines share one source of truth.

> **Trap worth knowing: `scripts/lexicon/art.mjs` RUNS ITS NIGHT-SHIFT ROUTINE
> AT IMPORT TIME.** Importing it merely to read the recipe table kicked off a
> real lexicon publish (harmless that time — 0 jobs queued — but it wrote and
> uploaded). That is why the table now lives in a module containing nothing but
> data and pure functions. `art.mjs` imports it back and was verified to still
> run identically afterwards (`1608 words · 0 jobs queued`, exit 0).

**`scripts/art/styles.mjs`** — the category + motion layer, and the
"don't repeat yourself" query.

- 7 categories (photoreal · painterly · illustrated · animated · graphic ·
  texture · synthetic)
- 6 motion profiles (hold · drift · push · parallax · handheld · snap), where
  today there is only one: `push`
- `--pick <mood>` suggests styles whose medium has NOT been on screen in the
  last 5 cuts; `--unused` lists what has never shipped at all

First real answer out of it, across all 18 shipped cuts:
**`animated` has never been used once.** `anime` and `manga-line` are sitting
there wired to LoRAs. Nine of eighteen cuts were `photoreal`.

**`docs/codex/style-usage.json`** — the ledger, seeded with all 18 cuts by
category. Append a row per cut.

**`scripts/art/screen_plates.py`** — the local text/seal screener on
`qwen3-vl:8b`. **Validated against 16 hand-labelled plates (10 dirty, 6 clean)
from the Days Drift By audit: 10/10 caught, 0 missed, 1 false alarm.** It
transcribes what it finds — `heron-0: 龍光水`, `stay-2: 月の夜`, `by-1: "O. W. R"` —
which makes a rejection checkable rather than a vibe. The single false alarm is
a reed reflection in `heron-2` read as a squiggle; that costs one re-roll.

Four findings that generalise to any local-VLM gate:

1. **Resolution per query is the whole ballgame.** Four corners stacked into one
   strip and asked once caught 6 of 10 known-dirty plates; the strip was itself
   being downsampled — the very failure the crop exists to prevent. One corner
   at a time, upscaled 2×, catches far more.
2. **A thinking model can return an EMPTY answer.** `qwen3-vl` writes reasoning
   to `message.thinking` and the answer to `message.content`. At
   `num_predict: 80` the reasoning ate the budget, `content` came back `""` with
   `done_reason: "length"`, and the parser read empty as "no text found" —
   scoring **0/10 on plates known to be dirty while looking like it worked.**
   `"think": false` is NOT honoured by ollama 0.32.15; budget for the reasoning
   instead, and never let empty mean clean.
3. **A gate must fail SAFE.** Retry once with a bigger budget, then REJECT.
   A false alarm costs one re-roll; a miss ships a signed plate.
4. **A long, careful prompt made it WORSE.** The first working version scored
   10/10 — but 7 of those 10 catches were fail-safe rejections, i.e. the model
   reasoned past its budget and the gate rejected out of ignorance. Replacing
   the carefully-caveated prompt with two blunt lines kept the same 10/10 and
   turned 9 of the 10 into real transcriptions, at roughly half the runtime.
   With a thinking model, prompt length is a latency AND an accuracy cost.

### Ollama could not pull anything at all

`OLLAMA_MODELS` pointed at `/var/lib/ollama`, owned by the `ollama` system user,
while the daemon runs as `xsyprime` under the user unit `oracle-ollama.service`.
Every pull died on `permission denied ... blobs/…-partial-0`. Fixed with no sudo
by a drop-in at
`~/.config/systemd/user/oracle-ollama.service.d/10-user-models.conf` pointing at
`~/.ollama/models`, which mirrors the old store (manifests copied, blobs
symlinked — nothing duplicated). gemma3 / qwen2.5 / llama3.1 still resolve.
