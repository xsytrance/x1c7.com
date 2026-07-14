# Prism × Kinetica — the integration

> **Status:** the spine is live (2026-07-13). Param registry, ground-truth
> feature bus, LFO + stem-follow modulators, the living WebGL2 backdrop,
> anticipation, quantized grades, chorus memory. All engine-side, synced to
> the Kinetica repo. This doc records the study, the architecture, the
> contracts, and the full idea backlog.

## What PRISM is

[rockinthiscity/prism](https://github.com/rockinthiscity/prism) — Charles's
browser WebGL2 VJ platform (~8k lines, zero dependencies, 19 versions).
Its real assets, in order of value to us:

1. **The param registry** (`params.js`) — every knob registers once and gets
   UI/MIDI/OSC/presets/morphing/locks for free. His own DESIGN.md calls it
   "the platform's superpower." Correct.
2. **A live music-intelligence stack** (`audio.js`) — PLL-agent beat tracker,
   key detection (Krumhansl-Schmuckler), Foote-style section detection with
   returning-section letters, HPSS stem *approximation* (drums/tonal/vox).
3. **A layered modulation model** — base value + LFO/automation offsets that
   never corrupt the stored value.
4. **A multi-pass GL pipeline** — per-deck FX → composite → overlays →
   feedback trails → mip bloom → post → bezel.
5. **The autopilot** — section labels keep their look across returns (the
   chorus always comes back with the chorus visuals).

## The strategic read

PRISM and Kinetica are complements with almost zero overlap:

| | PRISM | Kinetica |
|---|---|---|
| Knows | the *present* — live FFT, guessed beats, HPSS stem approximations | the *entire future* — real Suno stems, word timings, baked section analysis |
| Renders | shader scenes (mathematical) | DOM words + weather (generative, semantic) |
| Soul | the instrument | the meaning |

So the integration is **not** "copy PRISM's visuals." It is: *port PRISM's
instrument infrastructure, feed it ground truth PRISM can never have, and
point it at emotion instead of math.* Everything PRISM's analysis stack
guesses live, we compute offline from real stems — better, deterministic,
and including the future (`beatsToDrop`). Where Charles is headed next
(MilkDrop import, MIDI) we deliberately do not follow.

One architectural decision underneath everything: **words stay DOM**
(framer-motion is why the text feels alive); the generative layer is a
**WebGL2 canvas behind them** (`-z-20`, under the Ken-Burns art at `-z-10`
which glows over it at 0.6–0.85 opacity). Words and field talk through
uniforms (`uWord`) and the feature bus.

## The engine core (`src/lib/engine/`)

All files are engine-pure (no app imports) and ship through
`scripts/engine/sync-to-kinetica.mjs`. Import order matters once: modules
that register params must be imported before `ensureModEngine()` builds its
target list (KineticBackdrop does this correctly).

### `params.ts` — the registry

```ts
P.register({ id: "backdrop.flow", label: "Flow", group: "BACKDROP", min: 0, max: 3, value: 1 });
P.get(id)                  // base + summed modulation, clamped
P.set(id, v, source)       // cancels a running morph unless source === "morph"
P.setMod(id, off, channel) // additive layer ('lfo' | 'stem' | …), never serialized
P.morphTo(values, durSec, now) + P.tickMorphs(now)   // smoothstep glide
P.snapshot() / P.restore() / P.lookSnapshot-style filtering — future presets
```

### `features.ts` — the feature bus

Module store, zero React. `KineticStage`'s master rAF calls
`featureBus.update(t)` once per frame; everything else reads `featureBus.F`:

| field | meaning |
|---|---|
| `drums bass voice choir bed` | real per-stem envelopes 0..1 (`stems.json` env) |
| `level` | weighted composite |
| `kick` | stage's kick pulse (respects the live stem mixer's mutes) |
| `beat beatPhase totalBeats bpm gridLocked` | the transport, walked along the **measured** beat grid; extrapolated at edge tempo outside it (beats are *negative* in drum-less intros — by design) |
| `sectionIdx sectionIntensity sectionPulse` | the LLM emotion arc |
| `tier` | adaptive LOW/MID/PEAK from the song's own range |
| `charge` | riser progress 0..1 |
| `dropIn beatsToDrop` | **the future**: countdown to the next riser end |
| `wordX wordY wordPulse` | active word's measured screen position (0..1) |
| `cut` | measured drum blackout window |

`featureBus.nextBoundary(step)` → next quantize boundary in beats (4 = bar),
or `null` when the grid isn't trustworthy (act immediately).

Fallbacks: no stems → envelopes decay to 0, transport rides the live
`beatClock` (or 120). The show never lies, it just knows less.

### `lfo.ts` — modulators

3 beat-synced LFOs (sine/tri/saw/square/S&H at 1/4-beat…4-bar rates) +
3 **stem follows** (DRUMS/BASS/VOICE/CHOIR/BED/LEVEL/KICK/CHARGE riding any
float param). Both write `P.setMod` offsets — base values untouched. Config
lives in the registry (`lfoN.*`, `followN.*`) so future presets store
routings. LFO 1 defaults on: 4-bar sine → `backdrop.hueShift`, depth 0.22.

### `gl.ts` + `backdrop.ts` — the living backdrop

Pipeline: **scene → feedback trails → post** (soft bloom, hue drift, grain,
vignette, saturation/brightness, anticipation grade).

Scenes (fragment bodies compiled against a shared header — effectively our
Shader SDK v0): **AURORA** (voice-lit curtains; riser gathers them to
center), **EMBERS** (drum-ignited nebula; the word warms its spot),
**INK** (bass-deepened marbled tide; choir adds the silver sheen). Scene
choice: `AUTO` = FNV-1a(track id) — deterministic per song, like songLook.

Scene uniform contract: `uRes uTime uSeed / uDrums uBass uVoice uChoir uBed /
uLevel uKick uBeat uBeatPhase / uCharge uEmo / uWord uWordPulse /
uPal0..2 uIntensity` + helpers `hash21 hash22 vnoise fbm hsl2rgb`.

**Anticipation**: `drop = (1 − beatsToDrop/16) · backdrop.anticipation`;
vignette +0.30·drop, brightness −18%, saturation −35%, scene time −35%.
The release is the drop's own kick/nova.

**Chorus memory** (KineticBackdrop): per section emotion,
`fnv1a(seed::emotion)` derives hue lean / flow / trails / bloom / intensity;
`P.morphTo(…, oneBar)`. Same emotion returning ⇒ same look returning.

**Quantized grades** (KineticStage): section `gradeTo`/camera/shockwave wait
for `nextBoundary(4)`; section art starts decoding immediately (the swap
throttle absorbs the difference).

### Debug

`window.KINETICA = { P, featureBus }` in any show with the backdrop mounted.
`KINETICA.P.set("backdrop.trails", 0.9)`, read `KINETICA.featureBus.F`.

### Verify

```
npm run build && npx next start -p 3111
# /dev/perf?scene=fog&lite=0&stems=1  → real grid (86.13 BPM test stems)
# sample KINETICA.featureBus.F: gridLocked, totalBeats advancing, beatsToDrop
# counting down toward 22.06s; P.modOf("backdrop.hueShift") non-zero (LFO 1)
```

Playwright scripts from the build session live in the session scratchpad;
the pattern (drive /dev/perf, read `window.KINETICA`, screenshot with the
art layer hidden) is the regression recipe.

## Gotchas learned

- `canvas` is a **replaced element**: `fixed inset-0` does not stretch it
  (it keeps intrinsic size, and a resize-observer feedback loop then locks it
  small). `w-full h-full` explicitly. Cost an hour; won't again.
- The measured beat grid starts at the first *drum* beat. Songs with
  drum-less intros froze the transport at 0 for 20+ seconds (LFOs parked,
  quantized actions hung) until the grid learned to extrapolate at edge
  tempo. Beats before the first kick are negative; all phase/boundary math
  handles that.
- Look-vs-controller separation (PRISM v0.19's hard-won lesson): when we add
  presets, they must store *looks* (backdrop/FX/modulation) and never the
  *controllers* (transport, mixer, autopilot state). `params.ts` is ready.

## The backlog (from the 32-idea study, session 2026-07-13)

Shipped: registry · feature bus · backdrop · LFOs · stem-follows ·
anticipation · quantized grades · chorus memory v1 · `uWord` ·
**word ghosts** (dying words stamped into a dedicated decay/rise buffer —
`featureBus.pushGhost` → `backdrop.ghosts/ghostFade/ghostRise`; skipped in
phrase mode where nothing actually leaves the stage) ·
**melody sense** (per-word sung pitch → word color; see below).

### Melody sense (shipped 2026-07-13)

`scripts/stem-analysis/analyze_melody.py` (runs in `~/librosa-venv` —
recreated post-reinstall): pYIN pitch-tracks the isolated lead vocal, takes
the median voiced f0 per aligned word window (release clock − `align.lag`),
plus K-S key detection. Output `melody.json v1`:
`{ v, key:{root,mode,conf}, words:[{i,t,midi,pc,conf}] }` — `i` indexes
`lyricsSynced.words`. Validated on i-won-t-be-your-fire: key A# minor,
335/641 words pitched, histogram almost perfectly diatonic (A# 194, F# 53,
B 34, G# 30, C# 19).

Catalog rollout: `scripts/stem-analysis/melody-batch.mjs` (live Supabase
words → analyzer → diatonic-ratio QA gate → optional `--publish` to R2).
2026-07-13 run: 47 candidates, **43 pass / 4 flagged / 0 failed**; publish
pending the owner's eyeball.

Engine (`src/lib/engine/melody.ts` + stage): loads by explicit
`planet.assets.melody` URL or convention path `planets/<id>/melody.json`.
**Harmonic hue mapping**: tonic wears the theme hue; other notes sit at
their circle-of-fifths distance mapped onto ±80° (`pitchHue`) — close
harmony = close color, the tritone strains the palette hardest. Words are
confidence-gated (≥0.35); charged words keep their accent identity; ghosts
dissolve in their note's hue. Harness: `/dev/perf?melody=1`.

**Melody motion** also shipped (2026-07-13): `melodicMotion()` reads the
interval from the previous pitched word (entrance: rising line → the word
lifts into place from below, ~5.5px/semitone, capped ±64) and to the next
(exit leads the ear toward where the melody goes), and octave height above
the singer's home register (`medianMidi`) nudges dynamic word size ±8%.
Composes over the section-emotion motion; unpitched words are untouched.
Verified A/B on the harness: control = constant 12px focus entrance, melody
= interval-sized (23px on a 4-semitone leap).

Known issue (pre-existing, non-blocking): React #418 hydration warning on
`/dev/perf` in **focus mode** — fires with melody off too; dynamic mode is
clean. Investigate separately.

Next, roughly in order of jaw-drop per effort:

1. **Stem X-ray layers** — each stem gets its own visual layer + FX send,
   wired to the existing mixer (mute the drums, their layer dies).
2. **A/B section decks** — verse scene / chorus scene crossfaded on the bar
   (PRISM's deck architecture, driven by structure instead of a human).
3. **Offline PRISM-grade per-stem analysis** — chroma/tier baked into
   stems.json v2 (extend `scripts/stem-analysis`); key now comes free from
   melody.json.
4. **Key → palette harmony, backdrop-side** — feed `keyPc` as a scene
   uniform (`uKeyHue`) so the field itself sits in the song's key, not just
   the words.
5. **Presets/banks with morphing + look filtering**; `.kinetica` files get
   versioned migrations (PRISM's `migrate.js` pattern) from day one.
6. **Automation recording** — ride the deck live once, bake it into the
   song's choreography.
7. **Studio adoption of PRISM's craft** — modulation ribbons, ☆ pinning,
   `?` shortcut overlay, SHOW/CHOREOGRAPH/LIBRARY workspaces — in x1c7's
   own palette (#05030b void, #43f7ff plasma, #ff2440 signal).
8. **Shader SDK** — `.frag` scenes against our (richer) uniform contract,
    bundled into shareable packs.
9. **OSC bridge → the B2B set** — Kinetica broadcasts its ground-truth
    clock; PRISM follows. Two engines, one tempo, side by side.
10. **Recording via single-canvas compositing**, **Art-Net room lighting**
    that anticipates the drop, **collector-frame bezels**.

Deliberately not doing: MilkDrop import, MIDI, neural stem separation
(we *have* stems), porting his 17 scenes verbatim.
