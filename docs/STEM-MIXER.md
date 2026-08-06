# The Stem Mixer — playing the separated song

_Suno hands over every instrument as its own audio file. For a long time the site
only **measured** them (`stems.json` — the stem senses) while playback stayed one
mp3. This system ships the audio itself: the listener can pull the song apart,
instrument by instrument, live._

> **`stems.json` gained a second consumer on 2026-08-06.** Planet Studio (the
> Android app at `~/planet-studio`, v0.12.0) reads it natively to drive the
> jukebox: the turntable turns at `bpm`, the LED analyzer rides `env`, and
> sparks come off the real `kicks` / `snares` / `hats`. It is a Kotlin port of
> `src/lib/stemSense.ts` — `envAt`, the scrub-safe onset walker, and the
> `v == 1 && beats.length` usability contract.
>
> That makes `stems.json` a **shared contract, not a site-internal file**.
> Renaming a field, or changing `envHz` or the 0–99 loudness scale, breaks the
> app silently — its parser ignores unknown keys by design. The app pins this
> at site commit `32e8aa8` and carries the drift check in its own
> `CONTRACT.md`. 52 of 56 visible tracks ship one; for the other four the app
> falls back to a plain BPM clock and labels itself `◈ ESTIMATED` rather than
> pretending to hear.

---

## What the listener gets

On any planet that ships stem audio, the takeover chrome grows a **🎚 Stems**
button next to the Reactor:

- **Presets** — the combinations with a soul: _Acapella_ (just the voices),
  _Karaoke_ (the song minus the singer), _The Basement_ (drums + bass),
  _The Dream_ (the melodic bed + ghost voices), _Skeleton_ (voice over bare
  drums). Only presets the track's stems can perform are offered.
- **Custom chips** — every shipped instrument, tap to mute/unmute.
- **🔍 The Lens** — x-ray listening. Arm it, then **hold anywhere on the
  stage**: the mix collapses to the layer under your finger — the lyrics are
  the voice, the floor is the rhythm section, the sky is the choir, everywhere
  else is the melodic bed. Release and the full picture snaps back.
- **Full mix** — one tap back to the mastered mp3.

**The coherence law:** the stage's stem-driven visuals follow the mix. Mute the
drums and the kick-thumps, snare rings, hat glints and beat-cut blackouts die
with them; mute the bed and no riser charges, no supernova detonates. Touch the
mix, the whole planet responds.

## How it works (the audio architecture)

`src/audio/StemEngine.ts`, wired into `MusicPlayerContext`:

- The **release mp3 stays the master clock** and the default sound (it's the
  mastered mix — the stem-sum is close but less "glued"). Its source now runs
  through a crossfade gain (`mixGain`) before the muffle filter.
- Each stem is a streaming `<audio>` element → `MediaElementSource` → per-stem
  gain → one **stem bus**, joining the existing graph at the muffle filter — so
  the analyser (visualizer) and wipe-muffle hear whatever the listener hears.
- **Engage** lazy-loads the stems (nothing downloads until the first touch) and
  crossfades mp3 → bus. The mp3 keeps playing at zero gain, so transport,
  timeline, seek and "ended" never change owners. **Disengage** fades back.
- Stems chase the master clock: hard-align on seek, ±3% varispeed nudges to
  absorb drift (checked every 650 ms). All times honor `assets.stemLag` —
  `analyze_stems.py`'s measured `align.lag` between Suno's stem zip and the
  release mp3.
- The mix itself lives in **`src/lib/stemMix.ts`** — a tiny observable store
  (uiStore-pattern) shared by three consumers that must never re-render each
  other: the engine (applies gains to the graph), the mixer/Lens UI (React),
  and KineticStage's rAF loop (`visualGain` per frame). The store syncs to
  Kinetica with the engine; the audio engine stays per-app.

## Shipping a song's stems

1. Unzip Suno's stems. Run the analyzer as always
   (`scripts/stem-analysis/analyze_stems.py` → `stems.json`).
2. Publish the audio:
   ```bash
   node scripts/stem-analysis/publish-stems.mjs \
     --stems ~/suno/<song>-stems --slug <track-id> --stems-json <stems.json>
   ```
   This transcodes each recognized stem to a lean m4a (~3-4 MB at 160k),
   uploads everything to R2 `planets/<slug>/stems/`, and prints the
   `planet.assets` JSON + the exact Supabase `UPDATE` to run.
3. Apply the SQL. The mixer lights up live — no redeploy.

Recognized stem names (same map as the analyzer): lead/backing vocals, drums,
percussion, bass, synth, guitar, keyboard, other. `assets.stemAudio` +
`assets.stemLag` are the new planet fields (`src/lib/planet.ts`).
