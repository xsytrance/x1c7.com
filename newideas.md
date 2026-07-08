# New Ideas — the Suno stems, fully spent

_The founding realization: Suno hands over every instrument as its own audio file,
and for a long time ~90% of that was wasted — the stems were analyzed offline into
`stems.json` and discarded, while playback stayed one mp3. These are all the ideas
for spending the other 90%, from the brainstorm that produced the stem mixer._

Status legend: ✅ built · 🔜 next up · 💡 future

---

## The design law behind everything (✅ built)

**The world honestly reforms when you change the mix.** The visuals were already
stem-driven (`stems.json` → kicks thump, cuts blackout, risers charge supernovae).
The moment the *audio* became stem-driven too, the two had to stay married: mute
the drums and the kick-pulses, snare rings, hat glints and beat-cut blackouts die
*with* them; mute the melodic bed and no riser charges, no supernova detonates.
Touch the mix, the whole planet responds. This is the coherence law — every idea
below must obey it. (Implemented via `stemMixStore.visualGain()` read per-frame
in KineticStage.)

---

## Foundation (✅ shipped in PR #70)

What everything else stacks on:

- **StemEngine** (`src/audio/StemEngine.ts`) — the separated stems play live.
  Streaming element per stem → per-stem gain → one bus into the player's graph
  (so the analyser + wipe-muffle hear the real mix). The release mp3 stays the
  master clock and default sound (it's the mastered mix — stem-sum is close but
  less "glued"); engaging crossfades to stems while the mp3 runs silently, so
  transport/seek/"ended" never change owners. Drift is absorbed with hard aligns
  on seek + ±3% varispeed nudges, honoring `align.lag` (stem-zip ↔ release
  offset, measured by `analyze_stems.py`). Lazy: nothing downloads until the
  first touch.
- **Named presets over combinatorics** — 9 stems = 511 combinations, almost all
  noise. Curate the ones with a soul: **Acapella** (the voices), **Karaoke**
  (minus the singer), **The Basement** (drums+perc+bass), **The Dream** (bed +
  ghost voices), **Skeleton** (voice over bare drums). Only offered when the
  track ships the stems that give them meaning (`presetsFor`). Custom chips are
  the tinkerer's escape hatch.
- **The Lens** (`StemLens.tsx`) — x-ray listening. Hold anywhere on the stage
  and the mix collapses to the layer under your finger: `.kinetic-word` hit =
  **the voice**, bottom of the stage = **the floor** (drums/perc/bass), the sky
  = **the choir** (backing vocals), everywhere else = **the bed**
  (synth/guitar/keys/other). Release → full picture snaps back. Zero UI to
  learn; the stage itself is the mixer.
- **Pipeline** — `scripts/stem-analysis/publish-stems.mjs`: Suno stem folder →
  m4a transcode → R2 `planets/<slug>/stems/` → printed `planet.assets` JSON +
  Supabase SQL. Mixer lights up live, no redeploy.

---

## 🔜 The Rebuild — guided deconstruction

The song reassembles itself as it plays: verse one is bass alone in the dark,
drums crash in at the first riser's end, the voice arrives with the chorus,
full mix by the drop. **The choreography is already written** — the planet
analysis provides the section map (emotion/intensity/start), and `stems.json`
provides the risers and drum-return moments to hang entrances on.

- This is the "show a friend the concept in 60 seconds" mode.
- Implementation sketch: a scripted sequence of `stemMixStore.setGains()` calls
  keyed to section starts + `riser.end` timestamps; a "▶ Rebuild" preset in the
  mixer panel that engages the bus and hands gain control to the timeline until
  the drop, then releases to full mix.
- Visual tie-in for free (the coherence law): the world literally *builds
  itself* — layers of the stage fade in as their instruments arrive.

## 🔜 Districts — navigation IS the mixer

Each stem is a *place* on the planet, not a checkbox: the drums live
underground (subterranean, strobing, impact-lit), the bass is the foundation
you feel in the walls, the voice is the open sky where the lyrics fly, the
synths are neon weather. "Traveling to the drum district" = soloing drums AND
entering a visual room built from only that stem's events (its onsets, its
envelope). Standing between two districts crossfades them.

- Biggest visual lift of all the ideas; a natural LabStage/Reactor core first
  ("⚛ Districts") before it earns a top-level mode.
- Position-based mixing: the listener's x/y in the district map is just a set
  of distance-weighted gains — the StemEngine already takes arbitrary 0..1
  gains, so the audio side is done.

## 💡 Constellation mixer — orbs instead of sliders

Every stem is an orb orbiting the stage. Drag one toward center = louder;
fling it off-screen = muted; its angle = stereo pan. Distance-as-volume is
instantly intuitive and reads as *play*, not settings — and it fits the
planet/orbital language exactly.

- Audio needs one addition: a `StereoPannerNode` per stem between gain and bus
  (one line in `StemEngine.build()`), plus a `setPan(stem, v)`.
- Could BE the mixer panel's "expanded" view rather than a separate mode.

## 💡 Performable stems — the launchpad

Keys 1–9 (or a tap row on mobile) toggle stems live, launchpad-style, with
mutes **quantized to the next beat** from the `beats[]` grid so even careless
mashing sounds intentional. Visitors don't listen to the song; they perform it.

- Quantization: on keypress, look up the next beat time and schedule the gain
  ramp for it (`setTargetAtTime` at `ctx.currentTime + (nextBeat - t)`).
- Bonus tier: mute the drums and let taps fire the actual kick/snare as
  one-shots, quantized against the onset grid — play-along mode. (Needs small
  decoded buffers of a kick/snare hit sliced from the drum stem, or synthesized.)

## 💡 The Séance — the ghost mix

An idle/ambient mode where the engine slowly breathes stems in and out on its
own: 40 seconds of bass and backing vocals, then hats shimmer in, then the
lead surfaces for one chorus line and sinks again. An infinite generative
remix of the song — perfect "left the tab open" behavior, and it fits the
séance/reactor vocabulary the site already speaks.

- Implementation: a lightweight director loop (setInterval or rAF) doing slow
  random-walk gain automation, biased by the section map (quiet sections →
  fewer stems, choruses → near-full). Section-aware so it never fights the song.
- Entry points: a mixer preset ("🕯 Séance"), or auto-arm after N minutes idle.

## 💡 Ears in the room — spatial audio

Route each stem through a panner and place the band *around* the listener;
mouse position (or device tilt on mobile — the stage already reads device
orientation for parallax) turns your head. Face left toward the drummer and
the kit sharpens while the synths drift behind you.

- Full 3D version: `PannerNode` + HRTF per stem, listener orientation from
  pointer/tilt. Cheap version: `StereoPannerNode` + gain shading.
- Headphone easter egg with huge payoff for zero visual work. Natural pairing
  with the VR stage (`/vr`), which already runs per-track.

## 💡 Secret stems — the buried layer

At least one stem (backing vocals, or the "other" bucket — where Suno's weird
artifacts hide) is in no preset and no chip row. It only exists if you find
it: hold the right word during the right beat-cut window and it bleeds
through. The site already speaks Konami-code; the mix deserves an easter egg.

- Implementation: a hidden solo trigger in the Lens/stage pointer path, gated
  on `activeCut()` windows + a specific word index; the "secret" stem simply
  ships in `stemAudio` but is filtered out of the mixer UI.

## 💡 Stem-follow focus (the original x-ray seed)

The idea the Lens grew from, kept for the record: clicking/focusing any
stem-driven visual system solos its stem — click the pulsing floor, hear the
808. The Lens generalized this to hold-anywhere; a click-to-lock variant
("keep hearing the voice until I click again") is still worth trying as a
low-effort addition to the Lens (double-tap to lock the current zone).

---

## Practical notes that shaped everything (for future reference)

- **Sync:** never N independent `<audio>` tags free-running — one clock owner
  (the mp3), everyone else chases it. Solved in StemEngine; reuse it.
- **Bandwidth:** the single mp3 stays the default experience; stems are
  ~3-4 MB each as 160k m4a and lazy-load on first touch of the mixer. Six to
  nine stems ≈ one video's worth of data.
- **Mutes are fades:** 30–80 ms gain ramps (`setTargetAtTime`) or beat-quantized
  toggles — hard mutes click.
- **Stem-sum ≠ master:** Suno masters/limits the release, so the stem bus
  sounds slightly less glued. Default to the mastered mp3; crossfade to stems
  only when the listener touches the mix. Nobody notices the seam mid-song.
- **The lag is load-bearing:** Suno's stem zip and the release mp3 don't start
  at the same instant. `analyze_stems.py` measures it (`align.lag`); the
  engine applies it (`assets.stemLag`); the transcriber re-clocks with it
  (`--stem-lag`). Any new stem feature must live on the release clock.
- **All 9 buckets:** lead / back / drums / perc / bass / synth / guitar /
  keys / other. More stems shipped = more districts, orbs, and rebuild layers.

## Suggested build order

1. ✅ Engine + presets + the Lens (shipped)
2. 🔜 The Rebuild (choreography is already written; big demo value)
3. 🔜 Districts as a Reactor core, promote if it sings
4. 💡 Constellation mixer (as the mixer's expanded view) + pan support
5. 💡 Performable stems → Séance → spatial → secret stems, in whatever order
   the songs ask for
