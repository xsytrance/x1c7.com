# The Guide — roadmap

A per-song object that travels word to word, **played by the song** rather than
animated over it. Plus the two things that turn that into a journey: computed
Pillar words, and mode changes that alter the grammar rather than the picture.

Named for the Lexicon as **the Wisp** (a light that leads travellers) or
**the Herald** (it goes before and announces) — both `status: "proposed"`; only
the Sovereign blesses. Per the Iron Rule the code says `guide`.

> **The bound.** Five milestones. Each is ONE working session and ends at a tag
> you can roll back to. **If any milestone takes more than two sessions, we stop
> and reassess rather than push on.** M5 is explicitly optional and only starts
> if M1–M4 land.

---

## Non-goals (so this cannot sprawl)

- **No diffusion video generation** in this arc. Separate idea, separate budget.
- **No re-cutting the back catalogue.** One song proves it; rollout is a later
  decision.
- **No chord detection / affect space.** Those are the other roadmap; the Guide
  must stand on data that exists today.
- **No wasm port of Aurex.** If 3D happens it is an offline frame render.
- **No new art generation.** Every milestone up to M5 uses plates we already have.

---

## M0 · Plan  ·  tag `guide-m0-plan`

This document. Agreed scope, agreed bound, agreed kill criteria.

---

## M1 · The Guide moves  ·  tag `guide-m1-moves`

The mechanic alone, 2D, one song (hajimemashite), no new art.

- [ ] one-word **lookahead** for dynamic placement (the only structural change)
- [ ] flight lands **exactly on the word onset** (`lyrics_synced.words[i].t`)
- [ ] **arc apex from the sung note** — `melody.json` MIDI vs the singer's median
- [ ] **skate vs bounce by gap** — under ~0.25s stay low and slide; long gaps arc and hang
- [ ] **squash on landing** from the lead-stem envelope
- [ ] `deck.guide` knob; absent = no guide, every existing cut untouched

**Done when:** a rendered cut where the guide's landing is within ±40 ms of
every word onset, and apex height correlates with the word's MIDI note at
r > 0.6. Both measured by instrumenting the stage, not by watching.

**Kill criterion:** if the guide reads as a gimmick on a real cut, stop here.
Do not build Pillars on top of a mechanic that does not carry.

---

## M2 · The Guide performs  ·  tag `guide-m2-performs`

Same object, now expressing the music rather than only indexing the words.

- [ ] **freezes mid-air** during `stems.cuts[]` (the stage already freezes particles)
- [ ] **climbs a riser, slams on the drop** (`stems.risers[]`)
- [ ] **misses on purpose** on a dissonant word — overshoot or land late and
      off-centre, correct on the resolution (circle-of-fifths distance, which
      `pitchHue` already computes)
- [ ] **trail draws the melody contour**, held across the phrase

**Done when:** guide state provably differs between a resolved word and a
dissonant one of equal energy, and freezes align with `cuts[]` within a frame.
(Two sections of equal intensity that render identically is the exact failure
this repo keeps finding — the check must be able to fail.)

---

## M3 · Pillars  ·  tag `guide-m3-pillars`

Key words computed, not authored.

- [ ] score every word: melodic peak of its phrase + longest held note +
      lands on a downbeat + already carries keyword art
- [ ] top N per song surfaced as a list for review
- [ ] a Pillar **erupts and stays**; the rest of the lyric streams around it
- [ ] the guide can **land on** a Pillar, or **bounce off** it

**Done when:** the computed top-5 for five songs are judged right by the
Sovereign. This gate is taste, deliberately — a metric here would be fake.

---

## M4 · The journey  ·  tag `guide-m4-journey`

Mode changes that alter the grammar, landing on act boundaries the planet
already knows.

- [ ] a third mode alongside `phrase` / `dynamic`
- [ ] an **imageless act** (`deck.art: false` exists today) where the guide is
      the only light source and words ignite as it approaches
- [ ] **continuity across cuts** — exits frame right, enters frame left
- [ ] the guide **transforms** at act boundaries (spark → moth → lantern)
- [ ] `camSync` **follows the guide** instead of hashed offsets, so the camera
      has a subject

**Done when:** one 60 s cut contains at least three distinct grammars, with mode
changes landing on act boundaries rather than arbitrary times.

---

## M5 · The world  ·  tag `guide-m5-world`  ·  OPTIONAL

Only if M1–M4 land. The largest and least certain piece.

- [ ] offscreen/headless frame export from `aurex_render` (does not exist today —
      the engine is window-based)
- [ ] feed a song's Suno per-stem MIDI through `MidiToPulseGenerator`
      (`aurex_pulse_generation`) to generate an SDF scene from the song itself
- [ ] render one act's frames offline; composite the lyric layer over them
- [ ] the guide flies **through** words placed in depth

**Done when:** one 60 s cut contains a 3D act generated from that song's own MIDI.

**Note:** no diffusion needed here. The 3-second ceiling is a diffusion limit;
Aurex is a renderer we own — any length, deterministic, free per second. The
real cost is the offscreen path.

---

## Checkpoints

- Branch: `engine/the-guide`, cut from `pre-video-gen`.
- One tag per milestone, listed above. Each is a clean revert target.
- Every knob defaults to **off**. At any tag, a cut that sets nothing renders
  byte-identically to `pre-video-gen`.
- Docs updated in the same commit as the code, never after.

## Risks, named up front

| risk | mitigation |
|---|---|
| the guide is charming for 10s and tiring for 60 | M1's kill criterion; judge on a full cut, not a clip |
| dynamic placement can't be looked ahead cleanly | first task in M1; if it fights, fall back to phrase mode only |
| word timings are wrong on some tracks | the guide makes bad alignment *visible* — treat that as a feature and a QA tool |
| Aurex offscreen export is deep | M5 is optional and gated; nothing before it depends on it |
