# Kinetica — Free Version Roadmap (Phase 2+)

> **Status:** Phase 2.2 ✅ **functionally complete** (2026-07-07) — effect-bias seam
> (`PlanetEffects` + pure `resolveWordEffect`, override > `allow` > natural), preset
> **surface** biasing, **15 vibes** (6→15), a **custom vibe builder** (localStorage +
> export/import), and **cover-art auto-theme** (`extractPalette`). Grain/vignette rides
> the `fx-*` grade classes. Contract verified 12/12; both repos build; 0 engine drift.
> **Deferred stretch:** motion-intensity biasing + heuristic "describe your vibe".
>
> **Phase 2.3 in progress** — done: **per-word FX override** panel, the **⚙ Director's
> deck** (vibe/cover + live weather + Density/Glow/Grain/Vignette via a gated engine `deck`
> prop), **interaction legend**, **backdrop curation** (candidate strip per keyword:
> pick/drop/edit-query/re-search), and **keyboard shortcuts**. **Remaining 2.3:** a **section
> editor** (live emotional-arc authoring — needs an engine `sections` override prop to avoid
> re-cloning the planet + a browser to shape the UX). **Beat fine-tune skipped** — the
> beatClock is live-detected from bass onsets, so a manual BPM/offset would fight the design.
>
> **Phase 2.4 (vertical + export) — flagged decision:** the engine renders fullscreen via
> `fixed inset-0` layers, so a 9:16/1:1 frame needs those layers containerized. Cleanest path
> = wrap the show in a transform-contained aspect box (makes `fixed` descendants relative to
> the wrapper, **no engine change**) — but it's a visual/layout change to validate live in a
> browser before shipping. Phases 2.0/2.1/2.2 done. See [`BUILD-LOG.md`](./BUILD-LOG.md).

## Context

Kinetica is the free, standalone product (Vite + Tauri) for Suno / AI musicians:
drop a stem zip → measure the beat (DSP, no AI) → time the lyrics → search free
photos per keyword → watch a cinematic, interactive lyric show → export a video.
It already works end-to-end. **x1c7.com is the workshop** where the shared lyric
engine is authored; **kinetica is the gift box** that receives the engine via
`node scripts/engine/sync-to-kinetica.mjs --apply`. Both repos must always run the
same, latest engine.

This round is a **capability push**, not a single change: more text effects, more
free photo sources, more ways to theme/vibe, more control — plus new ideas. This
file is a living roadmap; we keep adding before we build.

---

## Working model (the rule that stops the thrashing)

The dividing line is the **sync manifest**. There is exactly one source of truth per file.

| Layer | Edit in | Ships to kinetica by |
|---|---|---|
| **Engine core** — `KineticStage`, `KineticParticles`, `SurfaceEffects`, `lib/effects/registry`, `lib/planet`, `lib/theme`, `lib/shapes`, `lib/stemSense`, `lib/beatClock`, `lib/lexicon/*`, `data/lexicon.json` | **x1c7.com** | `scripts/engine/sync-to-kinetica.mjs --apply` |
| **Free-product shell** — `images/sources`, `lib/presets`, `lib/keywords`, `ingest/*`, `ui/*`, `export/*`, `ai/*`, `audio/*` | **kinetica** (does not exist in x1c7) | n/a — lives only here |

Editing an engine file directly in kinetica gets **overwritten** on the next sync.
So: engine work → x1c7 → sync; product-shell work → kinetica.

Constraint carried into every effect: respect **perf-lite** (x1c7 `lib/perf.ts`) —
never animate blur radius per-frame on mobile; gate heavy effects behind the lite flag.

---

## Phase 2.0 — Foundation (do first; unblocks everything else)

1. **Sync the engine into kinetica.** kinetica was cloned from an OLDER snapshot and
   is missing real capability. Dry-run confirms it lacks `SurfaceEffects.tsx`,
   `lib/effects/registry.ts`, and the whole `lexicon` system, and its
   `KineticStage`/`KineticParticles` lag x1c7. Run `--apply`, then confirm kinetica
   still builds (`npm run build`) and the demo runs (`npm run dev` → "Try a demo").
   Instantly gives the free product surface effects + registry + lexicon-driven
   effect selection.

2. **Reconcile the effect registry into one source of truth** (x1c7 engine).
   Today two vocabularies have drifted: `registry.ts` `TextEffect` union
   (burn/shatter/dissolve/bloom/glitch/freeze/melt/carve) vs. the rendered `Word*`
   components in `KineticStage` (adds fizz/type/slam/wave/neon/pulse/whisper/assemble/
   cascade/morph; lacks freeze/melt/carve). Make the registry the single manifest:
   every rendered effect has a `TextEffect` id + tag matchers + a `Word*` component,
   and `KineticStage`'s selector reads a single `TextEffect → Component` map instead
   of the ad-hoc boolean chain (`KineticStage.tsx` ~981–988, 1424–1478). This is the
   prerequisite for "a vibe/preset biases which effects fire" and "per-word override."

3. **Add `lib/palette.ts` (cover-art → palette) to the sync manifest** so both repos
   can auto-theme from a dropped cover image (see Pillar 3).

---

## Pillar 1 — More text effects  *(engine → x1c7 → sync)*

Each = a `Word*` component in `KineticStage.tsx` + a `TextEffect` row + tag matchers
in `registry.ts` + optional lexicon glyph. First close the drift, then add new ones.

**Close the drift (already named, no component yet):**
- **Freeze** — glyphs ice over, frost creeps, then hold. Tags: cold/freeze/frost/ice/numb/winter.
- **Melt** — glyphs drip and run downward. Tags: melt/heat/summer/sweat/wax/drip.
- **Carve** — struck into stone, chisel flash + dust puff. Tags: stone/carve/forever/name/monument/eternal.

**New effects:**
- **Echo / Ghost** — trailing fading copies (delay/reverb feel). Tags: echo/memory/haunt/again/repeat.
- **Shake / Rattle** — continuous violent jitter (distinct from Slam's single impact). Tags: shake/tremble/quake/panic/anxious.
- **Redact** — letters type in, then a black bar slams over "secret" words. Tags: secret/classified/lie/hidden/censored.
- **Chromatic split** — RGB aberration / VHS tear. Tags: dream/vhs/analog/nostalgia/static.
- **Liquid fill** — water rises inside the letterforms. Tags: drown/flood/ocean/tears (distinct from Wave's horizontal distortion).
- **Gravity fall** — letters detach and drop. Tags: fall/collapse/gravity/down/sink.
- **Gold-leaf shimmer** — luxe sweep across glyphs. Tags: gold/crown/rich/shine/luxury (pairs with Inferno/gold vibe).
- **Bleed** — red ink weeps from the word. Tags: blood/bleed/wound/hurt/scar.
- **Handwrite** — script stroke draws on (SVG stroke-dashoffset). Tags: write/letter/vow/promise/sign.
- **TV-off** — collapses to a white line then a dot. Tags: end/gone/dead/silence/off.

Ship 3–4 per tranche; all respect perf-lite (CSS transforms/opacity, no per-frame blur on mobile).

---

## Pillar 2 — More free photo sources  *(kinetica `src/images/sources.ts`)*

Already present: **Openverse, Wikimedia, Pexels, Unsplash, Pixabay, Art Institute of Chicago.**

**Add providers (no key preferred):**
- **The Met — Open Access** (no key) — huge public-domain fine art; cinematic/painterly.
- **NASA Image Library** (no key) — cosmic/space; fits synthwave/ambient and the galaxy motif.
- **Smithsonian Open Access** (free key) — archival breadth.
- **Europeana** (free key) — historical/vintage imagery.
- **Rijksmuseum** (free token) — classical art.

**System upgrades (bigger wins than any single provider):**
- **Fallback chain / "All free" meta-source** — query Openverse + Wikimedia + Met + NASA,
  merge + dedupe, so no keyword ever comes back imageless. Today it's one source per run
  and a miss leaves a word blank.
- **Vibe-aware queries** — feed the selected preset's mood into `photoQueries`' vibe suffix
  (e.g. "neon night", "film grain, 35mm") so photos match the look (`lib/keywords.ts` already
  appends a suffix — wire the preset in).
- **Bundled fallback pack** — ship a tiny set of abstract gradient/texture backdrops
  (mirror x1c7's `gradientArt` / `_shared`) so a song ALWAYS has visuals offline / rate-limited.
- **Bring-your-own images** — a "local folder" source (Tauri fs): user drops photos, matched
  by filename/keyword. Big for creators who want their own look.
- **Disk cache** (Tauri) — cache searched photos so re-runs are instant + offline.
- Ranking: resolution floor, aspect scoring, safe-search, per-keyword orientation (portrait for
  vertical mode — see Pillar 5).

---

## Pillar 3 — More vibe / theming  *(kinetica `src/lib/presets.ts` + engine `lib/theme.ts`)*

Today: 6 presets (auto/neon/film/minimal/inferno/vapor); a preset overrides palette + font +
stage color-grade class + forced particle.

**Grow the preset set:** Noir (B&W high-contrast), Golden Hour, Frostbite, Synthwave (magenta/cyan
grid), Forest/Cottagecore, Blood Moon, Cyberpunk (neon + rain), Dreamcore pastel, Mono+1.

**Make a preset control more than color** — extend the `Preset` interface + `Show.tsx` application to bias:
- allowed/forced **text-effect set** (Noir→carve/dissolve; Neon→glitch/neon; Inferno→burn) — needs Phase 2.0 #2,
- **surface effect** (Forest→vines/moss; Inferno→rust; Noir→cracks),
- **veil/mood grade** + **grain/vignette/scanline** amount,
- **font pairing** + weight + letter-spacing, **motion intensity** (calm ↔ frantic).

**New theming capabilities:**
- **Custom vibe builder** — color pickers + particle + font + grain → save as a custom preset
  (localStorage + export JSON). Core of "more control."
- **Cover-art auto-theme** — if the user drops a cover, run `extractPalette` (add `palette.ts` to
  sync, Phase 2.0 #3) to seed the whole theme. Today kinetica has no cover→palette path.
- **"Describe your vibe" (heuristic, free)** — map a typed phrase ("late night drive",
  "heartbreak ballad") to the nearest preset + query suffix with a keyword matcher (LLM version = Pro).
- **Bundled open-licensed display fonts** (Tauri) for reliable cross-platform looks instead of
  system-font guesses in `presets.ts`.

---

## Pillar 4 — More control  *(kinetica `src/ui/*`)*

Today `Show.tsx` has: preset dropdown, mode switch, record. Build a **director's deck**:
- **Intensity sliders** — particle density, motion, glow/bloom, grain, vignette (all perf-lite aware).
- **Particle picker** — override the preset's forced weather.
- **Per-word effect override** — in Lyrics/Art step, click a word → assign a text effect (needs 2.0 #2).
- **Section editor** — mark intro/verse/chorus/drop → assign mood/intensity/palette shifts;
  the engine already consumes `PlanetSection`, this is a free no-AI authoring UI.
- **Backdrop curation** — in `ArtStep`, show searched photos per keyword; swap / reject / re-search /
  lock a favorite (port the idea from x1c7's owner `studio/feed`).
- **Beat fine-tune** — nudge beat offset / BPM if the DSP is slightly off.
- **Export options** — resolution, fps, format, **aspect (9:16 / 1:1 / 16:9)**, watermark toggle.
- **Project save/load/share** — export a `.kinetica` JSON (track config + curation + preset) to reopen/share.
- **Keyboard shortcuts + help overlay** (mirror x1c7's `KeyboardHelp`).
- **Interaction legend** — the engine already supports tap-burst, drag words, blow/scream/wipe
  moments; surface a toggle + legend.

---

## Pillar 5 — New capabilities (my ideas)

- **★ Vertical / social mode (9:16)** — biggest single win: Suno creators post to TikTok/Reels/Shorts.
  Add a framed vertical canvas + portrait photo search + vertical export. (Also 1:1.)
- **★ DSP auto-sections (no AI)** — derive intro/build/drop/outro + palette shifts from the stem
  **energy envelope** (`stemAnalysis.ts` already finds cuts/risers/env). Gives even Level-0 songs a
  dynamic emotional arc without an LLM. High value, pure DSP.
- **Beat-reactive backdrops** — pulse/zoom the Ken-Burns image on kicks (stemSense gives `kicks`).
- **Moving backdrops** — optional short looping free video (Coverr/Pexels Video) or deeper multi-layer parallax.
- **Music-video templates** — one-click combos of preset + effect set + photo source ("Neon City",
  "Film Noir", "Cosmic Ambient"). Onboarding for non-tinkerers.
- **Publish-to-web export** — besides video, emit a self-contained HTML the creator can host
  (Tauri writes the folder). Their show, playable in a browser link.
- **Genre-aware preset suggestion** — infer tempo/energy from DSP → suggest a preset (fast+bright→Neon,
  slow+warm→Film).
- **End-card + attribution** — auto "Made with Kinetica" + photo credits card (toggle); good for virality.
- **Reduced-motion / calm mode** — accessibility + a gentler aesthetic option.
- **Broader multi-language lexicon** — engine already handles some Spanish; widen for global Suno users.
- **Community preset packs** — import/export a JSON of shared presets.

---

## Deep-dive designs (expanded)

Grounded in the real idioms: `Word*` components take `{ word, airtime }`, split to
letters, animate per-letter `motion.span` (transform/opacity/color/textShadow/filter)
with a stable pseudo-random `r(i,m)`; some spawn specks. Export uses `getDisplayMedia`
(whole-tab) + a Web-Audio `MediaStream` → `MediaRecorder` webm. Presets apply an
`fx-*` filter class on the stage + CSS vars.

### A. Text effects — concrete builds  *(engine → x1c7)*
Same pattern as `WordBurn`/`WordShatter`/`WordDissolve`; transforms + opacity only
(no per-frame blur on mobile; gate glow behind perf-lite). Per effect: component +
`TextEffect` id + `TEXT_MATCHERS` tags.
- **Freeze** — letters tint icy `#cfe6f5`, textShadow frost glow, scale 1→1.02, then **hold** (no exit — it *stills*); a few slow white specks. Tags: cold/freeze/frost/ice/numb.
- **Melt** — per-letter `y` down + `scaleY` stretch + `skewY`, color drips to theme; lower indices melt first. Tags: melt/heat/sweat/wax/drip.
- **Carve** — held word, a moving specular "chisel" highlight sweeps across, scale 1.05→1, stone-dust specks fall. Tags: stone/carve/forever/name/monument.
- **Echo/Ghost** — 3–4 absolute ghost copies at growing offset + fading opacity, staggered delay. Tags: echo/memory/haunt/again.
- **Shake** — per-letter rapid x/y jitter via long keyframe arrays for `airtime`. Tags: shake/tremble/quake/panic.
- **Redact** — letters type in (staggered opacity), then a black bar `scaleX` 0→1 slams over. Tags: secret/classified/lie/censored.
- **Chromatic split** — 3 stacked R/G/B copies, oscillating ±x offset, `mix-blend:screen`. Tags: dream/vhs/analog/nostalgia.
- **Liquid fill** — word as `-webkit-text-stroke` outline; a colored fill rises via `clip-path` inset bottom→top with a wobbling top edge. Tags: drown/flood/ocean/tears.
- **Gravity fall** — letters hold, then detach falling (`y`↑, rotate, opacity) staggered with a heavy ease (distinct from Shatter's outward burst). Tags: fall/collapse/gravity/sink.
- **Gold shimmer** — animated `background-clip:text` specular gradient in warm gold + sparkle glints. Tags: gold/crown/rich/shine/luxury.
- **Bleed** — red droplets elongate downward from letter bottoms; word tints blood-red. Tags: blood/bleed/wound/scar.
- **TV-off** — `scaleY`→0.02 (line) then `scaleX`→0 (dot) + white flash, fast. Tags: end/gone/dead/silence/off.
- **Handwrite** *(stretch)* — SVG per-glyph stroke draw (`stroke-dashoffset`); needs a stroke font. Lower priority.
Selector: replace the boolean chain (`KineticStage.tsx` ~1424–1478) with one
`TextEffect → Component` map so presets/overrides can pick from it.

### B. Vertical / social + export  *(engine hook in x1c7 + UI in kinetica)*
- **Aspect frame** — new `aspect` state (`16:9` | `9:16` | `1:1`) in `Show.tsx`; stage rendered into a centered frame at that ratio, letterboxed. **Engine blocker:** the backdrop + weather layers use `fixed inset-0` (`KineticStage.tsx` ~1093), which escapes any frame. Add a **"framed" mode** to the engine that makes those layers `absolute` within the stage root. This is the one required engine change for vertical.
- **Portrait photos** — when `aspect==="9:16"`, pass `orientation:"portrait"` through `populatePhotos` → `sources` (both already accept it) and bias `photoQueries` ranking to tall images.
- **True-aspect export** — `getDisplayMedia` grabs the whole tab, so cropping needs a pipe: draw the captured video track into a `<canvas>` sized to the frame (offset to the frame's on-screen rect), record `canvas.captureStream()` + the audio stream. Yields an exact 9:16/1:1 file on desktop. MVP fallback: letterbox + full-tab webm labelled "crop in post."
- **End-card** — optional ~3s attribution + "Made with Kinetica" card appended to the capture (toggle).
- **Export options UI** — aspect, fps (24/30/60), bitrate, watermark + end-card toggles. (Tauri can later do faster-than-realtime offline render; MVP stays real-time.)

### C. DSP auto-sections (no AI)  *(engine → x1c7)*
New shared fn `arcFromStems(stem: StemData, palette: string[]): PlanetSection[]`
(`lib/planet.ts`), called by kinetica `buildTrack` whenever there's no LLM planet.
1. Smoothed **overall-energy** curve = weighted sum of `env` stems (drums+bass for drops, lead for choruses), normalized 0..1 @ `envHz`.
2. **Segment** at hysteresis change-points, forced at `cuts` ends + `risers` (structural boundaries); merge segments < ~6s.
3. **Classify** by mean-energy percentile + song position + preceding riser/cut: low+start→*intro (calm)*, rising-mid→*build (longing)*, high after riser→*drop (intense)* / *chorus (euphoric)*, mid steady→*verse (reflective)*, low+end→*outro (dreamy)*.
4. `intensity` = normalized segment energy → drives existing `sectionMotion()`.
5. `emotion` from a small class→emotion map; `colorHint` rotates through `palette` so `gradeTo()` shifts the grade per section.
Instantly gives Level-0 songs a moving emotional arc + palette shifts + motion changes.
**Bonus:** beat-reactive backdrop — pulse/brighten `bgArt` on kick onsets (engine already has `OnsetTracker` over `stem.kicks`).

### D. Director's deck  *(engine knobs in x1c7 + UI in kinetica)*
- **Engine knobs** — `KineticStage`/`KineticParticles` honor user-override CSS vars: `--user-density` (particle ×), `--user-motion`, `--user-glow`, `--user-grain`, `--user-vignette` — a thin override layer over auto values, still clamped by perf-lite.
- **Deck UI** (`Show.tsx`) — collapsible panel: those sliders + particle-override `<select>` + interaction toggles + aspect + export options.
- **Per-word effect override** — add `interactions.wordFx?: Record<string, TextEffect>`; selector checks it *before* matchers. UI in `LyricsStep`: unique content words each with an effect dropdown.
- **Section editor** — table over `arcFromStems` output: edit name/emotion/intensity/color, add/remove, drag start times → writes `analysis.sections`, live-updates the show.
- **Backdrop curation** (`ArtStep`) — per keyword show top-N thumbnails; choose/lock/re-search (edited query)/upload-your-own → writes `assets.keywords`.
- **Project save/load** — serialize `{meta, lyricsSynced, planet, preset, aspect, overrides}` to `.kinetica.json`. **Gotcha:** object URLs (stems/audio) don't persist — store the `stems.json` data inline and re-mixdown or re-embed the master on load.

---

## Suggested sequencing

- **Phase 2.0** — Foundation: sync engine → kinetica; reconcile registry; add `palette.ts` to sync.
- **Phase 2.1** — Text-effect tranche #1 (close drift: freeze/melt/carve) + first new photo providers
  (Met, NASA) + fallback chain.
- **Phase 2.2** — Preset expansion + "preset biases effects/surface/grain" + custom vibe builder.
- **Phase 2.3** — Director's deck controls + per-word override + backdrop curation.
- **Phase 2.4** — Vertical/social mode + export options (the social-reach push).
- **Phase 2.5** — DSP auto-sections + beat-reactive backdrops + templates.
- Later tranches: remaining text effects, moving backdrops, publish-to-web, community packs.

Each phase ends with: build both repos, run kinetica's demo + a real stem zip, and re-sync so
x1c7 and kinetica stay identical on the engine.

---

## Verification (per area)

- **Engine changes (x1c7):** `npm run lint` + drive `/dev/perf` and `/studio?track=…`; then
  `node scripts/engine/sync-to-kinetica.mjs --apply` and confirm kinetica `npm run build` + demo.
- **Photo sources (kinetica):** unit-drive `populatePhotos` against each provider (no-key ones in CI);
  confirm attribution + fallback when a source returns nothing.
- **Presets/theming:** load each preset on the demo; confirm palette/font/particle/grade apply and revert.
- **Controls:** exercise each slider/override on the demo show; confirm perf-lite path on a throttled profile.
- **Export/vertical:** record a clip in each aspect; confirm dimensions + audio sync.

---

## Open decisions (for you)

- Which pillars/phases to prioritize first (my default sequencing above).
- Vertical/social mode — how important vs. more effects? (I rank it #1 for reach.)
- Pro boundary: keep all of the above **free/no-AI**; the LLM enrich (`ai/*`) stays the Pro upsell. OK?
- Anything to add to this roadmap before we start building.
</content>
</invoke>
