# Effects & the Lexicon

_The "lego" system for the lyric engine, and the shared word-database that will power it._

> **TL;DR** — Visual effects are now reusable **legos** organized by _physics class_,
> catalogued in one registry. Separately, every **word** from every song becomes a
> **sub-planet** in a growing **Lexicon** — a shelf of vibes, palettes, imagery, and
> effects, pre-generated so that one day a lyric video can be built without calling an
> LLM at all. This doc explains both systems, how they fit together, and how to grow them.

---

## Table of contents

1. [The big picture](#1-the-big-picture)
2. [Phase 0 — the two fixes](#2-phase-0--the-two-fixes)
3. [Effects as legos: the physics classes](#3-effects-as-legos-the-physics-classes)
4. [The effect registry](#4-the-effect-registry)
5. [Airborne — the particle engine](#5-airborne--the-particle-engine)
6. [Surface — the new renderer](#6-surface--the-new-renderer)
7. [Volumetric — wipe veils](#7-volumetric--wipe-veils)
8. [The Lexicon](#8-the-lexicon)
9. [harvest.mjs — seed the shelf](#9-harvestmjs--seed-the-shelf)
10. [dream.mjs — the dream loop](#10-dreammjs--the-dream-loop)
11. [The `/lexicon` browser](#11-the-lexicon-browser)
12. [Runtime lookup — the show reads the shelf](#12-runtime-lookup--the-show-reads-the-shelf)
13. [Runbooks](#13-runbooks)
14. [Roadmap](#14-roadmap)
15. [File map](#15-file-map)

---

## 1. The big picture

The lyric engine (`KineticStage`) paints a song as a living world: generated-art
backdrops, karaoke word blow-ups, beat reactivity, and **atmosphere** — weather,
veils you wipe away, blow-into-the-mic moments. Historically each atmospheric
effect was hard-wired: a regex ladder picked one of six particle modes, a `switch`
mapped it to one of five veils. Adding "mud" meant editing three files.

Two shifts fix that and set up something much bigger:

- **Effects become legos.** A declarative **registry** is the single manifest of
  every effect, grouped by **physics class** (they don't all move the same way).
  Adding a lego = adding a row.
  - **Phase 2.0 update:** the `TextEffect` union in `registry.ts` is now the
    _complete_ manifest of rendered word treatments — it gained
    `slam/wave/neon/pulse/whisper/fizz/type` alongside
    `burn/shatter/dissolve/bloom/glitch/freeze/melt/carve`. In `KineticStage`, a
    single **`WORD_FX` map** (id → component) is the one place word effects render,
    so a per-word override or a vibe/preset can swap any effect by its id.
    (`freeze/melt/carve` are named but land as components in Phase 2.1 — the map
    types them via `Exclude<TextEffect, "freeze"|"melt"|"carve">` until then.)
- **Words become a database.** Every word a song uses is harvested into a shared
  **Lexicon**, where it accumulates senses, palettes, imagery prompts, and — via the
  **dream loop** — a full set of effect legos. Grown far enough, creators pick from
  the shelf instead of paying an LLM per render. One person's Lexicon is a **galaxy**;
  galaxies are meant to be shared (the gift to the Suno community).

```
          song vocabulary                     the shelf (grows offline)
        ┌────────────────┐   harvest.mjs   ┌────────────────────────────┐
songs ─▶│ planet keywords│ ───────────────▶│  Lexicon (lexicon.json)    │
        └────────────────┘                 │  word → senses → legos     │
                │                dream.mjs  │  (weather/surface/veil/…)  │
                │              ◀────────────│                            │
                ▼                           └────────────┬───────────────┘
        ┌────────────────┐                               │ lazy load (lookup.ts)
        │ effect registry│◀──────────────────────────────┘
        │ (resolvers)    │        runtime, lexicon-first + fallback
        └───────┬────────┘
                ▼
   KineticParticles · SurfaceEffects · WipeLayer   →  the show
```

---

## 2. Phase 0 — the two fixes

**Fog seam.** The wipe veil (`WipeLayer` in `KineticStage.tsx`) was anchored
`fixed inset-x-0 top-0 bottom-[118px]`, deliberately holding it ~118px above the
bottom so the timeline stayed visible — but it read as an untouched strip along the
bottom of the screen. It's now `fixed inset-0`: the veil covers the **whole** screen.
(The timeline sits at `z-10`, well below the veil's `z-30`, so nothing is lost.)

**Flashing warnings.** The "blow into the mic" (`BlowMoment`) and "wipe the screen"
(`WipeLayer`) prompts were quiet `text-xs` mono. They're now large (`text-5xl`),
center-stage, in a glowing pill that pulses via two decoupled CSS animations in
`globals.css`:

- `.stage-warn` — the headline: scales + glows (`stage-warn-flash`).
- `.stage-warn-pill` — the container: pulsing halo + border (`stage-warn-pulse`).

Two separate elements so the Framer Motion enter/exit transform never fights the CSS
flash. Both are disabled under `prefers-reduced-motion`.

---

## 3. Effects as legos: the physics classes

The core insight: **effects are not one kind of thing.** Trying to render mud (which
creeps _up a wall_) with the same primitive as snow (which _falls through air_) is
what made the old system rigid. So effects are grouped by how they behave:

| Class | What it does | Renderer | Examples |
|---|---|---|---|
| **airborne** | particles travelling through air | `KineticParticles.tsx` | embers, ash, rain, snow, dust, bubbles, sparks, petals, pollen |
| **volumetric** | a veil that fills space, wiped away | `WipeLayer` (in `KineticStage.tsx`) | fog, ash, frost, steam, static, mud, dust, smoke |
| **surface** | clings to the glass, creeps from edges | `SurfaceEffects.tsx` | mud, rust, cracks, condensation, vines, moss, blood, sand |
| **light** | grades the whole frame | _(planned)_ | godrays, flare, flicker, blackout |
| **textbound** | attaches to individual words | _(ids only; render planned)_ | burn, shatter, dissolve, bloom, glitch, freeze, melt, carve |

Each class has one renderer that reads parameters. A "lego" is just a row describing
one effect within a class.

---

## 4. The effect registry

**`src/lib/effects/registry.ts`** is the single source of truth.

### The catalog

`EFFECT_CATALOG: EffectLego[]` — every lego, each with:

```ts
interface EffectLego {
  id: string;          // "air.ash", "surf.mud", "veil.fog", "text.burn"…
  class: EffectClass;  // airborne | volumetric | surface | light | textbound
  mode: string;        // the primitive within its class ("ash", "mud", …)
  tags: string[];      // words that summon it (matched against vocabulary)
  palette?: string[];
  blurb: string;       // one-liner for the Lexicon browser
}
```

`EFFECTS_BY_ID` indexes it for lookup.

### The specs

- `VEIL_SPECS: Record<VeilKind, { colors: [c0, c1]; grain }>` — the volumetric veils.
- `SURFACE_SPECS: Record<SurfaceMode, { colors[]; form; from[] }>` — the surface materials.

### The resolvers (what the runtime calls)

| Function | Returns | Used by |
|---|---|---|
| `weatherFor(text)` | `ParticleMode` | KineticStage → KineticParticles |
| `veilForWeather(mode)` | `VeilKind` | KineticStage (which veil a weather wipes into) |
| `surfaceFor(text)` | `SurfaceMode \| null` | KineticStage → SurfaceEffects |
| `textEffectFor(text)` | `TextEffect \| null` | (for per-word treatments, when rendered) |

> **Note:** `weatherFor` delegates to `particleModeFor` in `KineticParticles.tsx`
> (the particle engine owns its own matcher for now). The dream loop mirrors these
> tag tables in `scripts/lexicon/dream.mjs` — keep them roughly in step.

---

## 5. Airborne — the particle engine

**`src/components/KineticParticles.tsx`** — a full-screen 2D canvas of song-matched
particles between the backdrop and the words. One `requestAnimationFrame`, zero React
re-renders while running. It breathes with section intensity, pulses on the beat, and
reacts to gestures (`burst`, `trail`, `gust`, `quake`, `glint`, `implode`, `freeze`).

Modes: `embers · rain · snow · dust · bubbles · sparks · ash · petals · pollen`.

- **`ash`** — spent grey flakes drifting _down_ (checked _before_ embers so "ashes of
  regret" reads cold, not on-fire).
- **`petals`** — big soft tumbling petals with wide sway.
- **`pollen`** — golden motes suspended in warm air, near-still.

### Adding a new airborne mode

1. Add it to the `ParticleMode` union.
2. Add a matcher line in `particleModeFor` (order = priority; first match wins).
3. Add a `DENSITY` entry.
4. Add a `baseVy` case (fall/rise speed) and, if it enters from the top, add it to `edgeY`.
5. Add a `spawn` case (size, alpha, colour, velocity).
6. If it should sway, add it to the `sway` expression in the tick loop.
7. Add a matching row in `registry.ts` (`AIRBORNE`) and a veil mapping in `WEATHER_VEIL`.
8. Add its glyph to `GLYPH` in `src/app/lexicon/page.tsx` and the tag table in `dream.mjs`.

---

## 6. Surface — the new renderer

**`src/components/SurfaceEffects.tsx`** — a physics class the weather engine couldn't
express. Material clings to the glass and **creeps in from the edges**, growing over
time and scaled by intensity. Plain canvas + one rAF; patches live in a ref.

Forms (from `SURFACE_SPECS[mode].form`):

- **splotch** (mud, rust, moss, sand) — soft irregular domes rising from an edge.
- **droplet** (condensation, blood) — beads that sometimes leave a downward slide-trail.
- **crack** — jagged branching polylines spidering inward.
- **tendril** (vines) — curving lines with little leaf dots.

Only songs whose vocabulary calls for a surface get one (`surfaceFor` returns `null`
for most songs → clean glass).

### Adding a new surface material

Add a `SURFACE_SPECS` entry (`colors`, `form`, `from` edges), a `SurfaceMode` union
member, a `SURFACE_MATCHERS` line in `registry.ts`, a `SURFACE_TAGS` entry in
`dream.mjs`, and a glyph in the browser. If it needs a brand-new _form_, add a draw
branch in `SurfaceEffects.tsx`.

---

## 7. Volumetric — wipe veils

The choreographed "wipe it away" moment. `WipeLayer` paints a full-screen veil
(gradient + grain) and the listener erases it with a finger (`destination-out`
compositing); clearing it un-muffles the audio. Colours and grain come from
`VEIL_SPECS` in the registry, so adding a veil is a one-row change. Which veil a
song uses is decided by `veilForWeather(particleMode)`.

---

## 8. The Lexicon

**The dream:** so many pre-generated legos per word that a creator never needs an LLM
at render time — they pick from a curated shelf. One person's Lexicon is a **galaxy**;
galaxies can be shared, merged, and gifted.

### Data model — `src/lib/lexicon/types.ts`

```
Lexicon
 ├─ version, galaxy ("xsytrance-canon"), generatedAt, stats
 └─ entries: Record<word, WordEntry>
      WordEntry
       ├─ word (normalized lemma), forms[], freq, sources[] (provenance), updatedAt
       └─ senses: WordSense[]
            WordSense
             ├─ gloss, pos, emotion          ← disambiguation
             ├─ imageryPrompts[], images[]   ← imagery legos (prompts now, pixels later)
             ├─ palette[]
             ├─ score                        ← curation weight (community votes later)
             └─ legos: { weather[], surface[], veils[], text[], light[] }
```

**Senses are the key idea.** `heart` carries three: _Intense_, _Devotion_, _Intimate_
— each with its own vibe and legos. `spring` (season vs coil vs leap) is the canonical
example. This is what keeps it magic instead of mush: the wrong world never shows up.
Senses are currently grouped by **emotion**; the dream loop can refine the glosses.

Current seed: **87 words · 95 senses · 443 legos** from 14 analyzed songs.

---

## 9. `harvest.mjs` — seed the shelf

**`scripts/lexicon/harvest.mjs`** pours the `keywords` your pipeline already produces
(`scripts/song-art/*-planet-full.json` → `word` + `emotion` + `imageryPrompt`) into one
global `src/data/lexicon.json`. It's **idempotent** and merges: a word accumulates
senses, prompts, palettes, and provenance across every song it appears in. Function
words (the/and/of/…) are dropped.

```bash
node scripts/lexicon/harvest.mjs            # merge all song-art planets
node scripts/lexicon/harvest.mjs --fresh    # rebuild from scratch
node scripts/lexicon/harvest.mjs --galaxy my-galaxy
```

Run it after onboarding songs (see the song-onboarding pipeline).

---

## 10. `dream.mjs` — the dream loop

**`scripts/lexicon/dream.mjs`** grows the legos **while you sleep.** It walks the
**frontier** — words without effects yet — in priority order (`freq × salience`) and
fills each sense's code-tier legos: which weather, surface, veil, text, and light
effects it can wear, plus a couple of extra imagery-prompt variants.

**Why code-tier first:** effects are params (near-free), so generate them
exhaustively; images are the expensive tier and are left as prompts for a later pass.

Key properties:

- **A queue, not a firehose** — `--limit N` words per run (default 40), resumable.
- **Honest** — it **logs what it skipped**, so "covered everything" never lies.
- **Token/stem matching, not substring** — so `"crashing"` never matches the `ash`
  tag and `"voice"` never matches `ice`. (This was a real bug; it's fixed.)
- **Emotion guarantees** — `EMOTION_RULES` ensure even an abstract word gets a fitting
  treatment (e.g. _regret_ → ash + dissolve + blackout), never an empty sense.

```bash
node scripts/lexicon/dream.mjs              # fill the next 40 unfilled words
node scripts/lexicon/dream.mjs --limit 999  # do the whole frontier
node scripts/lexicon/dream.mjs --force      # re-dream already-filled words
```

**Grow it on autopilot:** put `dream.mjs` on a cron or a `/loop` and the shelf keeps
filling with zero attention. That is the "build legos while I sleep" vision, literally.

---

## 11. The `/lexicon` browser

**`src/app/lexicon/page.tsx`** — the Lexicon as a place you can wander. Every word is
an orb glowing in its own palette; tap it and its senses bloom open: emotion, palette
swatches, the legos (with emoji), the imagery prompt, and which songs it came from.
There's a search box (by word or feeling) and header stats. Linked from the lyric-show
drawer (📖 Lexicon, next to 🌌 Galaxy). Reads `src/data/lexicon.json` directly;
prerenders as static.

---

## 12. Runtime lookup — the show reads the shelf

**`src/lib/lexicon/lookup.ts`** is the seam toward "no LLM at render time":

- `loadLexicon()` — lazy dynamic import (its **own chunk**, kept out of the main bundle).
- `resolveWord(lex, word)` — exact/normalized hit, then a **nearest-word fallback**
  (longest shared prefix ≥4). That fallback is the placeholder for the eventual
  **embedding** match — the "unseen word still finds legos" path, dependency-free.
- `aggregateLegos(lex, words)` — the union of every lego across a set of words: the
  palette of options a director can pick from.

`KineticStage` loads it lazily and uses it **lexicon-first** for the surface layer:
if the song's own regex finds no surface, the Lexicon's aggregated legos still might.
Everything degrades gracefully — no lexicon or no match → `null` → the caller's own
heuristic wins.

---

## 13. Runbooks

### Grow the Lexicon after adding songs

```bash
node scripts/lexicon/harvest.mjs     # pull new songs' keywords into the shelf
node scripts/lexicon/dream.mjs       # fill legos for the new frontier (repeat to finish)
npm run build                        # bundle the updated lexicon.json
```

### Add a new effect lego (checklist)

1. `src/lib/effects/registry.ts` — add the catalog row (+ `VEIL_SPECS`/`SURFACE_SPECS` if needed).
2. The renderer for its class (`KineticParticles` / `SurfaceEffects` / `WipeLayer`).
3. `scripts/lexicon/dream.mjs` — add its tag table entry so words can summon it.
4. `src/app/lexicon/page.tsx` — add its `GLYPH`.
5. `node scripts/lexicon/dream.mjs --force` to re-dream with the new lego available.

### Verify

```bash
npx tsc --noEmit     # types
npm run build        # full build (the real gate; /lexicon prerenders)
```

> `npm run lint` currently fails **repo-wide** on pre-existing `react-hooks` rules
> (`ref.current = prop` in render, `setState` in effects) — a known "lint-on-main"
> condition, not a regression from this work. `next build` does not gate on it.

---

## 14. Roadmap

Shipped: Phase 0 fixes · effect registry · new airborne modes · surface renderer ·
Lexicon (types, harvest, dream loop, browser) · runtime lexicon-first lookup.

Next, roughly in order:

- **Image-tier legos** — generate actual images from the imagery prompts (ComfyUI, à la
  the art pipeline) and store URLs in `WordSense.images` / on R2.
- **Embeddings** — replace the prefix fallback in `lookup.ts` with a real vector match,
  and use it for sense disambiguation of brand-new lyrics.
- **Per-word text-effect rendering** — the registry has `burn/shatter/dissolve/…` ids;
  the stage doesn't yet render distinct per-word treatments. Wire them into `WordAssemble`.
- **Supabase-backed Lexicon** — move from a flat `lexicon.json` to Postgres + pgvector so
  it's queryable, multi-user, and shareable.
- **Galaxies & sharing** — a public canonical galaxy (the Suno gift, ideally CC0) plus
  personal overlays that override/extend it; import/subscribe/merge semantics
  (npm-for-lyric-legos). Community voting bumps `WordSense.score` to surface the best legos.

---

## 15. File map

```
src/
  lib/
    effects/
      registry.ts            ← the effect manifest + resolvers + specs
    lexicon/
      types.ts               ← Lexicon / WordEntry / WordSense / WordLegos
      lookup.ts              ← lazy runtime lookup (exact + nearest-word fallback)
  components/
    KineticParticles.tsx     ← airborne renderer (+ ash/petals/pollen)
    SurfaceEffects.tsx       ← NEW surface renderer (mud/rust/cracks/vines/…)
    KineticStage.tsx         ← the show; wires weather + surface + veils + lexicon
    CinematicLyrics.tsx      ← lyric-show takeover (adds 📖 Lexicon link)
  app/
    lexicon/page.tsx         ← the /lexicon browser
    globals.css              ← .stage-warn / .stage-warn-pill flashing warnings
  data/
    lexicon.json             ← GENERATED shelf (harvest + dream write this)

scripts/lexicon/
  harvest.mjs                ← seed the Lexicon from song planets
  dream.mjs                  ← the dream loop (grow legos on a priority queue)

docs/
  EFFECTS-AND-LEXICON.md     ← you are here
```
