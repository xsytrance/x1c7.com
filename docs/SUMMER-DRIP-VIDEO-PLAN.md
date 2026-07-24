# SUMMER DRIP — the directed cut

**Mission:** a 60-second Kinetica video for *Summer Drip* (Her Cut) — the first video
where the machine doesn't just react to the song, it **directs** it: timed
phrase↔dynamic mode switching, hand-picked lexicon imagery, and new
chopped-&-screwed effects built for this track.

**The vibe contract:** Southern hip-hop / R&B, chopped & screwed, summer.
117 BPM, D# major, "slow syrupy tempo, trunk-rattling kick, rattling hi-hats,
slowed hook." Golden-hour heat melting into purple midnight. Sundress glow,
streetlamp shine, perfume thick, gold chain, hips swing slow. The visual
language: **syrup, shimmer, purple dusk, tape-warp, stutter-chop.**

---

## Phase 0 — Truth first: re-run the ultimate analyzer ✅ (running)

Summer Drip is one of the 50 songs damaged by the stem-truncation bug: the old
7-stem senses go blind at ~2:45 of a 4:52 song (last beat detected at 165s,
"Bridge/Drop/Outro" intensities 0.16/0.21/0.18 — that's the zero-padding lie,
not the song). The full lyrics prove the tail holds **"Hook - Bigger, Slower"**,
Verse 4, the Breakdown, and the fade outro — prime chopped & screwed real estate
we've never actually measured.

- Re-run `ultimate.mjs` fully **offline**: local `release.mp3` (headers fine,
  decodes 100%), local cover, official lyrics + style from the local Suno
  catalog. No third-party fetching.
- Senses via demucs 4-stem approximation — coarser than the 7-stem originals,
  but **covers the whole song honestly**. Old senses kept at
  `pre-refix-backup/` + `senses.stem-truncated.bak.json` for comparison.
- Transcript survives (Whisper decodes via ffmpeg — it was never truncated;
  words run to 4:49).

**Gate:** new senses show beats/energy to the true end; section map re-drawn
with real tail structure.

## Phase 1 — Direction: pick the best 60 seconds

Score candidate windows against the fresh data — hook presence, energy arc
shape (want: build → peak → breath), lyric density, and *identity* (it must
contain the words that ARE this song: sundress, glow, hips, drip).

Candidates going in:
- **A. Cold open** 0:00–1:00 — Intro ("Heat turned up… Slow it down") →
  chopped Ad-Libs ("Summer. Drip. Hips. Flip.") → the full Hook (old measured
  intensity 0.85, the song's peak) → first bars of Verse 1.
- **B. The chopped identity** ~2:05–3:05 — Hook-Chopped → Verse 2's gravelly
  flow.
- **C. The unmeasured tail** ~3:15–4:15 — "Hook - Bigger, Slower" → Verse 4
  "Deep Slow Flex" → Breakdown. If the data shows the biggest hook lives here,
  this wins: bigger + slower is literally the genre.

**Output:** a beat-mapped **shot list** — every mode switch, act, word effect,
and image placed on a timestamp.

## Phase 2 — New engine machinery (the "things we haven't seen")

All engine work obeys the perf laws (CSS keyframes over per-letter framer
animation, compositor-friendly props, scoped var writes).

1. **The Mode Conductor** — the headline. Today `mode` is one value per song;
   I extend DYNAMIC+ with a timed schedule:
   ```json
   "dynamicPlus": { "modes": [ { "start": 195, "end": 224, "mode": "phrase" }, … ] }
   ```
   consumed by the same 400ms conductor loop that drives acts — so the stage
   can play verses in **dynamic** (full stagecraft) and snap the hook into
   **phrase** (whole line igniting word by word — the singalong shot), with a
   **tape-warp transition** at every switch: a beat-length vertical smear +
   blur + purple hue drag, the visual of a pitch wheel bending down.
2. **`chop` word effect** — DJ stutter: the word slices into horizontal strips
   that offset and double with `steps()` timing, like the chopped vocal it
   sits on. For: "Chopped", ad-libs, "flip", "game".
3. **`drip` word effect** — glossy droplets swell off the letterforms and
   fall, wet sheen sweeping the word. For: "drip", "perfume", "gloss", "wet".
4. **SYRUP backdrop scene** — a new shader scene beside AURORA/EMBERS/INK:
   slow viscous flow, amber→violet heat gradient, heat-shimmer refraction,
   lazy VBR-tape line drift. The whole video breathes at half-time.

## Phase 3 — Lexicon: hand-curated reel

The nightly Curator already matched 32 images for this song. But a directed
video deserves a directed reel:

- Every sung word in the window gets its **one best** image, hand-pinned in
  `lexicon-reel.json` (`featured: true`, first-per-word — the runtime honors it
  verbatim).
- Target words (window-dependent): **sundress, glow, hips, midnight, flame,
  smile, skin, streetlamp, perfume, drip, summer, heat, gold/chain, sway**.
- Where the shelf is weak, **generate new art** in the Atelier with
  vibe-matched recipes — `photo`, `neon-night`, `word-portrait`, `film-still`,
  `oil-light` — briefed for golden-hour + purple-dusk summer palette; then
  vision-index → re-match → pin.

## Phase 4 — Author + apply the direction

Hand-write `dynamic-plus.json` v2 for the window: 2–3 **acts** with marquee
labels (candidates: "SLOW IT DOWN", "SUMMER DRIP", "HOLD THAT CROWN"), the
**words→effects** map (chop/drip/shimmer/liquid/neon/slam…), and the new
**modes** schedule. Apply to the track's planet (draft column if available —
keeps the live site untouched until the owner blesses it).

## Phase 5 — Render + QA

- Headful Chromium on the real GPU (RTX 5060 Ti, display :0), 1920×1080,
  `/studio?track=summer-drip&embed=1&autoplay=1&pass=6`, seeked to the window.
- Capture via CDP screencast → ffmpeg: frames + the exact audio window from
  `release.mp3`, 0.5s audio fades, H.264/AAC mp4.
- **QA loop:** keyframe screenshots at every mode switch and act start —
  verify switches land on the beat, pinned images fire, new effects render.
  Iterate until it slaps.
- Deliver: `summer-drip-60.mp4` + phone whisper when it's done.

## What this does NOT touch

- No pushes to origin, no Vercel deploy, no Suno fetching (everything local).
- Old analysis artifacts backed up, git recoverable.
- Live-site planet only touched via the standard apply script — and reverted
  on request (`revert-dynamic-plus.mjs` exists).
