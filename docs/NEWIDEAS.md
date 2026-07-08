# NEW IDEAS — using every instrument in the stems

_The origin note behind the stem mixer. Suno hands over every instrument as its
own file; for a long time ~90% of that information went to waste while playback
stayed one mp3. These are the ideas for spending it. Recreated from the
2026-07 web session (the original newideas.md never got committed)._

**The design law:** the visuals are already stem-driven, so the moment the
audio becomes stem-driven too, the world honestly reforms when you change the
mix. Mute the drums and the kick-pulses, beat-cut blackouts, and riser
choreography vanish with them. Touch the mix, the whole planet responds.

---

## Shipped (see docs/STEM-MIXER.md)

- **Named presets over combinatorics** — _Acapella_, _Karaoke_, _The Basement_,
  _The Dream_, _Skeleton_. Only presets the track's stems can perform are
  offered. Custom chips (per-instrument mute) as the tinkerer's escape hatch.
- **The Lens (x-ray listening)** — arm it, hold anywhere on the stage, and the
  mix collapses to the layer under your finger: lyrics = voice, floor = rhythm
  section, sky = choir, everywhere else = melodic bed. Release to snap back.
- **The coherence law** — stem-driven visuals follow the mix
  (`stemMix.visualGain` consumed per-frame by KineticStage).
- **The engine** — mp3 stays master clock; lazy-loaded stems crossfade in on a
  stem bus; varispeed drift-chasing; `assets.stemLag` alignment.

## Open — the creative layer still to chase

- **Districts, not checkboxes.** Each stem is a *place* on the planet — drums
  live underground (strobing, impact-lit), bass is the foundation in the walls,
  vocals are the open sky, synths the neon weather. Jumping to a district =
  soloing that stem inside a visual room built from only its events. Standing
  between districts crossfades them. Navigation *is* the mixer.
- **The Rebuild (guided deconstruction).** The song reassembles itself as it
  plays: verse one is bass alone in the dark, drums crash in at the first
  `riser.end`, vocals arrive with the chorus, full mix by the drop. The section
  map + risers/cuts in stems.json mean the choreography is already written.
  The "show a friend the concept in 60 seconds" mode.
- **Constellation mixer.** Each stem is an orb orbiting the stage. Drag toward
  center = louder; fling off-screen = mute; angle = stereo pan (one
  StereoPannerNode per stem). Distance-as-volume reads as play, not settings.
- **Performable stems.** Keys 1–6 / a mobile tap row toggle stems live,
  launchpad-style, mutes quantized to the next beat from the `beats[]` grid so
  careless mashing sounds intentional. Bonus tier: mute the drums and let taps
  fire the actual kick/snare quantized against the onset times — play-along.
- **The Séance (ghost mix).** Idle mode where the engine breathes stems in and
  out on its own — 40s of bass + back-vocals, hats shimmer in, the lead
  surfaces for one chorus line and sinks. Infinite generative self-remix; the
  "left the tab open" behavior.
- **Ears in the room (spatial).** Panner per stem, band placed around the
  listener; mouse position / device tilt turns your head — face the drummer
  and the kit sharpens while the synths drift behind you. Headphone easter egg.
- **Secret stems.** At least one stem (back vocals, or the "other" bucket where
  Suno hides weird artifacts) lives in no preset — hold the right word during
  the right cut window and it bleeds through. The mix deserves an easter egg.

## Sequencing call (from the session)

Presets + the Lens first (done) → **the Rebuild** next (smallest build, the
data already exists) → constellation / performable / séance as the playground
grows. Spatial and secret stems are cheap garnish once panning exists.
