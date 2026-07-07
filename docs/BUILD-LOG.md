# Build Log — the Kinetica engine (x1c7 workshop)

Reverse-chronological record of engine/product work. Newest first. Each entry:
what changed, why, how it was verified. The full forward plan lives in
[`KINETICA-ROADMAP.md`](./KINETICA-ROADMAP.md); the two-repo model in
[`ENGINE-SYNC.md`](./ENGINE-SYNC.md).

---

## 2026-07-07 — THE REACTOR: experimental lyric cores (17 and counting)

**Goal:** a Labs wing on the now-playing stage — a place to try wild lyric
renderers with **zero risk to the main show**, and a nursery for modes that
should graduate to `/vr` later (orbit, constellation, kaleidoscope…).

**Architecture (`src/components/LabStage.tsx`):**
- Each mode is a **self-contained "core"**: one component taking the synced
  word list + live playhead, sharing only a `useWordIndex` rAF hook, a `clean`
  word scrubber, a seeded `hash`, and a neon `HUES` palette. No engine imports —
  KineticStage is untouched, so a broken experiment can't hurt the real stage.
- A labeled, glowing **⚛ Reactor** pill (spinning atom + tooltip) in the player
  opens the picker; picking a core takes over the stage; "◐ Normal show"
  returns to KineticStage. Adding a core = one renderer + one `LAB_MODES` row
  (the picker renders from the list, so it can't drift from the union).

**The 17 cores, by wing:**
- *Playful/physical:* 🎨 Graffiti (spray tags, splatter + drips), 🎆 Fireworks
  (words burst into letter-sparks), 🔨 Whack-a-Word (tap to score, +1 bursts +
  haptics), 🌧️ Downpour (rain that stacks into a drift), 🫧 Bubbles (tap to
  pop), 🍳 Sizzle (words squash into a pan over live flames, brown in a
  sepia/brightness ramp, steam, get flipped out).
- *Atmospheric:* ✍️ Handwriting (drying-ink journal), 🪐 Orbit (words circle a
  star), 🐠 Aquarium (words swim, ambient bubbles), ✨ Constellation (letters
  drawn as connected stars), 🪞 Kaleidoscope (8 mirrored segments on a
  slow-turning lens).
- *Theatrical/occult:* 🔮 Spellcast (counter-rotating rune rings), 🎭 Marionette
  (words dangle on strings, swing, fall), 🃏 Tarot (every word a card flipped
  into a spread), 🕯️ Séance (a glowing planchette glides a full ouija board —
  letter arcs, YES/NO, GOOD BYE — spelling each word, flaring letters it passes).
- *Machine:* 🛫 Split-Flap (departure board; letters clack through the alphabet
  and settle left-to-right, prior words dim into rows above), 🖥️ Terminal
  (green-phosphor CRT tailing `song.lrc`: typed cursor, scanlines, flicker).

**Fixes from live feedback:** Downpour originally dropped words at random x —
now lands in the **shortest column**, stacks in rows, and washes the drift away
when full. Handwriting erased each word as the next landed — now previous words
stay as fading ink (a journal trail).

**Verified:** `tsc --noEmit` clean; `next build` green. eslint's
`set-state-in-effect` hits in this file predate the Reactor (same accumulate-
on-word pattern all cores use; candidate cleanup alongside MicPrimer/ScreamMoment).

---

## 2026-07-07 — Live stage push: Phase 4/5 gating, cinematic camera, Focus modes

**Goal (live session with the owner):** make this round's engine work a visible,
preserved *phase* of the show, then fix what real eyes caught.

**Changes:**
1. **Pass 4 fence** (`KineticStage`): the effect-bias seam + the new auto-trigger
   effects engage only at `pass >= 4`; passes 1–3 render exactly as before.
   `CinematicLyrics` MAX_PASS 3→4, 🌙 switcher cycles + labels "Phase N".
2. **Auto-trigger vocabulary** for the newer effects: COLD/HEAT/STONE/GOLD/RISE/
   FALL/ECHO/TREMOR word-sets behind an `extraFx` selector at **lowest** priority
   (signature effects and per-word overrides still win). ~6% trigger rate measured
   on a real English lyric; Spanish falls back cleanly.
3. **Phase 5: cinematic camera** — a per-frame virtual dolly (`--cam-scale/x/y/rot`
   CSS vars composed into the words layer + backdrop): pushes in with section
   energy, breathes on the kick, drifts on two out-of-phase sines. Gated `pass >= 5`;
   earlier passes snap `--cam` to identity. After live review it was imperceptible —
   values cranked to a real dolly (~1.16 push-in, 18–46px drift), and perf-lite's
   `transform: none` was replaced with a translate-only camera so phones dolly too.
4. **Focus & Focus+ modes**: Focus is now ONE clean centered word (residue layers
   only fire in Dynamic); Focus+ exits each word with a seeded effect (ash, dust,
   blow, fly, burn). New `focus+` StageMode in the cycle.
5. **Polish + regressions** from the same session: wipe veil reads as real fog
   (luminous rim + pale underlay, auto-clears at 25% or 5s); MicPrimer is a proper
   opening card (blow + scream, Enable-mic/skip, z-45); player chrome lifted to a
   z-60 glassy title bar so stage layers can't cover the controls; moment-card
   mobile centering fixed via `transformTemplate` (framer's inline transform was
   clobbering the Tailwind centering); 🌙 pass switcher no longer hidden on phones.

**Verified:** `tsc` clean per commit; owner-validated live on desktop + mobile
(the camera and fog fixes came directly from that review).

---

## 2026-07-07 — Variety push: more effects/weather + per-song "look" generator

**Goal (owner: "blow people's minds — enough variety that not everyone's results
look the same"):** widen the palette and make each song open distinct.

**Changes:**
1. **5 new text effects** (engine): shimmer (gold-leaf sweep), rise, fall, echo,
   tremor — Word* components + `TextEffect` union + `TEXTBOUND` + `WORD_FX`.
   Override-summonable only (no auto trigger → x1c7 auto-behavior unchanged).
   New `ALL_TEXT_EFFECTS` export = the one ordered list the FX panel / vibe
   builder render (20 effects; pickers can't drift from the union).
2. **4 new weather modes** (engine): fireflies, confetti, leaves, stars — each a
   `DENSITY`/`baseVy`/`spawn`/palette/sway case; `WEATHER_VEIL` extended;
   `ALL_PARTICLE_MODES` export (13 modes). **Pick-only** — no `particleModeFor`
   matcher, so x1c7's auto weather is unchanged.
3. **Per-song "look" generator** (kinetica `lib/songLook.ts`, shell-only): a
   deterministic FNV-1a hash of title+lyrics → a distinctive opening vibe +
   weather + cinematic deck intensity, and `seedWordEffects` pins effects to
   ~1-in-3 of the song's distinctive words from the vibe's palette. Strong mood
   words steer (fire→inferno, cold→frostbite, love→dreamcore, sea→vapor); else the
   seed rotates all 14 vibes. **🎲 Surprise** re-rolls the current song. Applied as
   the Show's opening state; fully overridable in the Director.

**Verified:** x1c7 `tsc` clean; engine sync applied, **0 drift**; kinetica `build`
green. Variety test: **60 generic songs → all 14 vibes + 10 weather picks**,
deterministic, mood-steering correct. **Bug caught by a 500-song stress test:** the
FNV seed is unsigned 32-bit, so bit-slicing needs `>>>` not `>>` — a signed shift on
a seed > 2³¹ went negative → negative modulo → undefined preset/particle/effect.
Fixed; re-verified all-clean. Owner browser-validated the earlier deck/effects work
("amazing"). See [[kinetica-live-test-2026-07-07]].

---

## 2026-07-07 — Phase 2.3: per-word override UI + director's deck

**Goal:** turn the engine seams into hands-on control — pin effects to individual
words, and give a single deck for vibe + weather + intensity (declutter the show bar).

**Changes:**
1. **Per-word effect override UI** (kinetica `ui/WordFxPanel.tsx` + `Show.tsx`): a "✦ FX"
   panel lists the song's unique words; pin any of the 15 text effects to a word and it
   fires every time the word appears, over the vibe's pick. Overrides are keyed by
   `clean(word).toLowerCase()` — the exact `lower` key `resolveWordEffect` checks (so no
   drift); assigned words float to the top of a filterable list; clear-all included.
   Local state seeded from `planet.effects.overrides`, merged into the `effects` prop.
2. **Director's-deck intensity knobs** (engine: `KineticParticles.tsx` + `KineticStage.tsx`):
   a new **optional, fully-gated** `deck` prop — `{ density, glow, grain, vignette }`.
   Absent = the x1c7 show is byte-for-byte unchanged. `density` multiplies the particle
   population (via a ref so slider drags don't rebuild the rAF loop); `glow` is a static
   accent drop-shadow on the words (skipped on lite); `grain`/`vignette` are static
   full-frame overlays mounted only when non-zero. Perf-lite aware throughout.
3. **Director's deck panel** (kinetica `Show.tsx`): the crowded top bar (preset · +Vibe ·
   Cover · FX) collapses into one **⚙ Director** panel holding the vibe dropdown +
   New/Edit, cover-theme, a **live weather picker** (particle override on top of the
   preset), the four intensity sliders, and a Per-word-FX launcher.
4. **Interaction legend** (kinetica `Show.tsx`): a "?" overlay surfaces the engine's
   already-supported gestures (tap word · drag word · swipe comet · blow/shout moments).
5. **Backdrop curation** (kinetica `images/populate.ts` + `ui/BackdropCurator.tsx` +
   `ArtStep.tsx`): free-photo backdrops are curated, not auto-picked. `searchCandidates`
   returns several landscape-first candidates per keyword (keyless-net fallback only when a
   source is empty); the curator shows a per-keyword strip — click to choose, ✕ to drop
   (clean stage), editable query + ⟳ to re-search; `curationResult` builds the keyword→url
   map + credits from the chosen photos. AI-art path unchanged.

**Verified:** x1c7 `tsc` clean; engine sync (KineticStage + KineticParticles) applied,
**0 drift**; kinetica `npm run build` green at every step; `resolveWordEffect` contract still
12/12; live-checked a source returns 8 candidates/keyword for the strip. The per-word key
matching is covered by the "override checks 2nd key" contract case. *(Live browser pass of
the deck/curator UIs not run here — recommended manual check.)*

**Still open in 2.3:** section editor, beat fine-tune, keyboard shortcuts. Then **2.4**
(vertical + export).

---

## 2026-07-07 — Phase 2.2 (part 2): preset expansion, custom vibes, cover-theme, surface

**Goal:** cash in the effect-bias seam — grow the vibe set, let users author their
own, seed a theme from cover art, and extend preset control past color to surface.

**Changes (kinetica shell, except the surface seam which is engine):**
1. **Preset expansion** (`presets.ts` + `index.css`): 6 → 15 vibes — Noir, Golden Hour,
   Frostbite, Synthwave, Forest, Blood Moon, Cyberpunk, Dreamcore, Mono +1. Each carries
   palette + font + particle + allowed effect palette + surface + a matching `fx-*`
   color-grade (some with vignette/scanline `::after` overlays = the "grain" knob).
2. **Custom vibe builder** (`customPresets.ts` + `VibeBuilder.tsx` + `Show.tsx`): author a
   vibe — palette (4 color pickers + live swatch), font, particle, grade, surface, and an
   effect-palette toggle grid — saved to localStorage (upsert by id; export/import
   helpers). Custom vibes share the exact `Preset` shape, so they flow through every seam
   identically to built-ins; the Show dropdown lists them under "Your vibes" with ＋/✎.
3. **Cover-art auto-theme** (`Show.tsx`): a 🎨 Cover upload runs the engine's
   `extractPalette` on the dropped image (blob URL, revoked after) → seeds the auto
   palette (per-channel fallback; clearable).
4. **Preset surface biasing** (engine: `planet.ts` + `KineticStage.tsx`): `PlanetEffects.
   surface` (`SurfaceMode | "none"`) forces a surface growth or clean glass; undefined
   keeps the lyric-derived pick. Presets set it (Inferno→rust, Forest→vines, Blood
   Moon→blood, Noir→cracks, Golden→sand, …); the builder exposes a Surface picker.

**Verified:** kinetica `npm run build` green at every step; x1c7 `tsc` clean; engine sync
(planet.ts + KineticStage) applied, **0 drift** (16 files identical); the pure
`resolveWordEffect` contract test still 12/12. *(Visual pass across the 15 presets in a
browser not run here — recommended manual check.)*

**Phase 2.2 = functionally complete.** Deferred stretch: **motion-intensity** biasing
(needs restructuring the `MOTION` config — higher risk) and the heuristic **"describe your
vibe"** phrase→preset matcher.

---

## 2026-07-07 — Phase 2.2 (part 1): the effect-bias seam + preset effect palettes

**Goal:** make text-effect selection *biasable* by a vibe/preset and *overridable*
per word — the shared prerequisite for both preset effect-biasing (2.2) and the
per-word override UI (2.3). Phase 2.1's clean `WORD_FX` id→component map unblocked it.

**Changes:**
1. **`PlanetEffects` config + pure resolver** (engine, x1c7 `src/lib/planet.ts`):
   - New `PlanetEffects { overrides?: Record<word, TextEffect>; allow?: TextEffect[] }`
     on `Planet.effects` (optional; absent = the engine's own picks, unchanged).
   - `resolveWordEffect(natural, cfg, keys)` — one pure, dependency-free function
     encoding the precedence contract: **a per-word override wins** (the only way to
     summon `freeze/melt/carve`, which have no automatic word trigger), **else** the
     natural pick **unless** a preset `allow` list rules it out (word renders plain).
2. **Stage consumes the seam** (engine, x1c7 `KineticStage.tsx`): the inline
   signature-effect resolution now calls `resolveWordEffect(naturalSig, effectsCfg,
   [ek, lower])`. `effectsCfg = effects ?? track.planet?.effects` — a new optional
   `effects` **prop** takes precedence over the planet's persisted config, so live
   preset switching biases effects **without cloning the track** (avoids re-firing the
   `[track.planet]` stems loader on every preset change). Burn keeps its early-return
   path; all other effects route through `WORD_FX` as `inner`.
3. **Presets bias effects** (product shell, kinetica `src/lib/presets.ts` + `Show.tsx`):
   `Preset.effects?: TextEffect[]` is the vibe's allowed palette — Neon→neon/glitch/
   pulse/slam, Inferno→burn/slam/melt/shatter, Film→dissolve/whisper/carve/bloom,
   Minimal→whisper/dissolve, Vapor→wave/neon/whisper/dissolve; Auto = no filter.
   `Show.tsx` passes `effects={{ allow: preset.effects, overrides: <planet's> }}`.

**Verified:**
- **Real contract test** (`resolveWordEffect`, 12 assertions via `node
  --experimental-strip-types` against the actual `planet.ts`): override>allow>natural,
  override summons freeze/melt/carve on plain words, empty `allow` suppresses all,
  override beats allow, Inferno keeps burn / drops neon. **12/12 pass.**
- x1c7 `tsc --noEmit` clean; engine sync `--apply` (planet.ts + KineticStage) → kinetica
  `tsc -b` + `npm run build` pass.

**Still open in Phase 2.2:** preset **expansion** (Noir/Golden Hour/Frostbite/Synthwave/
Forest/Blood Moon/Cyberpunk/Dreamcore/Mono+1), **custom vibe builder** (color/particle/
font/grain → saved preset), cover-art auto-theme, and heuristic "describe your vibe".
Per-word override **UI** is Phase 2.3 (the engine hook is now in place).

---

## 2026-07-07 — Phase 2.1: close the effect drift + never-blank photo net

**Goal:** finish what Phase 2.0 set up — build the three text effects the registry
named but never rendered, and widen the free photo net so a planet is never blank.

**Changes:**
1. **`freeze` / `melt` / `carve` `Word*` components built** (engine, x1c7
   `src/components/KineticStage.tsx`) in the house idiom (motion.span, `em` units,
   stable per-index pseudo-random, `--theme-accent`):
   - `WordFreeze` — frost-blue tint sweeps in, a small shiver, then locks under a
     crystalline rime; frost specks bloom at the edges. Blur is one-shot on entry
     (never held — perf-lite).
   - `WordMelt` — each letter sags on its own delay, stretches (`scaleY`) and bleeds
     warm, then drips off the baseline; a few drops fall clear.
   - `WordCarve` — chisel-hit jolt on arrival, a grey dust puff, then the letters
     settle engraved (inset/emboss shadow). Slow, heavy, final.
   - `WORD_FX` is now `Record<TextEffect, …>` (the `Exclude<…,"freeze"|"melt"|"carve">`
     is gone) — **every** registry `TextEffect` id renders through exactly one
     component. The `RenderableFx` alias was dropped; its one use site (`sigFx`) now
     types as `TextEffect | null`. Drift between registry and stage is fully closed.
2. **Two keyless photo sources added** (product shell, kinetica `src/images/sources.ts`):
   - **The Met** — Open Access (CC0) fine art, no key. Two-step API (search →
     objectIDs → per-object fetch, capped to 8), filtered to `isPublicDomain &&
     primaryImageSmall`. Verified: 6–8 PD hits in the first 8 across ocean/love/fire/night.
   - **NASA Image Library** — public-domain space imagery, no key (images-api.nasa.gov
     needs none). Search href (any `~thumb|small|medium|large` rendition) is upgraded
     to `~orig` for the backdrop — verified 10/10 `~orig` HEAD 200.
   - New `KEYLESS_SOURCES` export (openverse, wikimedia, artic, met, nasa).
3. **"Never blank" fallback chain** (kinetica `src/images/populate.ts`): each keyword's
   search now tries the chosen source, then falls through `KEYLESS_SOURCES` until one
   returns a landscape pick — only the chosen source uses the user's key. A dead
   primary key still surfaces on word 1 if even the net can't cover it; otherwise the
   run completes and `PopulateResult.warning` notes the fallback (shown in `ArtStep`).

**Verified:**
- x1c7: `tsc --noEmit` clean; engine sync `--apply` (1 file: KineticStage) → kinetica
  `npm run build` passes.
- kinetica: `tsc -b` + `npm run build` pass. Met/NASA endpoints live-smoke-tested
  (URLs, field mappings, `~orig` existence, PD yield) before committing.

**Next (Phase 2.2):** vibe/preset effect-biasing (now that WORD_FX is a clean id→component
map) and per-word overrides; then 2.3 director's deck, 2.4 vertical/export, 2.5 DSP sections.

---

## 2026-07-07 — Phase 2.0: Foundation (sync + registry reconciliation)

**Goal:** kick off the Kinetica free-version capability push by getting both repos
onto one current engine and giving text effects a single source of truth.

**Context discovered:**
- The free product **Kinetica** is a separate repo (`/home/xsyprime/kinetica`,
  Vite + Tauri). `x1c7.com` is the workshop; the engine is authored here and
  released via `node scripts/engine/sync-to-kinetica.mjs --apply`. See ENGINE-SYNC.md.
- Kinetica already shipped the full self-serve flow (stem-zip ingest → DSP beat
  analysis → lyric timing/Whisper → free-photo search → interactive show → video
  export), 6 photo sources (Openverse, Wikimedia, Pexels, Unsplash, Pixabay, Art
  Institute), 6 vibe presets, and non-LLM keyword extraction.
- But its cloned engine was **stale** — missing `SurfaceEffects`, the effect
  `registry`, and the whole `lexicon` system; `KineticStage`/`KineticParticles` lagged.

**Changes:**
1. **Sync manifest gaps closed** (`scripts/engine/sync-to-kinetica.mjs`): added
   `src/lib/palette.ts` (cover-art → palette), and two latent engine deps the newer
   `KineticStage` imports but that were never in the manifest —
   `src/lib/perf.ts` and `src/components/PerfHUD.tsx` (perf-lite).
2. **Engine synced → kinetica** (`--apply`): brought over SurfaceEffects, registry,
   lexicon (types/lookup + `lexicon.json`), perf, palette, and the current
   `KineticStage`/`KineticParticles`. `engineHost.ts` scaffolded on kinetica
   (`useMusicPlayer` ← `@/audio/player`, `Track` ← `@/lib/types`, `HAS_SHARED_ART=false`).
3. **Effect registry reconciled into one source of truth** (`src/lib/effects/registry.ts`
   + `src/components/KineticStage.tsx`):
   - `TextEffect` union extended to name every rendered treatment: added
     `slam/wave/neon/pulse/whisper/fizz/type`.
   - Matching `TEXTBOUND` catalog rows + `TEXT_MATCHERS` entries (appended so existing
     first-match priority is preserved).
   - New `WORD_FX: Record<Exclude<TextEffect,"freeze"|"melt"|"carve">, (word, airtime) => ReactNode>`
     map in KineticStage. The selector's ad-hoc boolean chain now resolves to a single
     `TextEffect` id and renders via `WORD_FX[id]`; tap-reactions and burns route
     through it too. Behavior preserved exactly. This unblocks per-word overrides and
     vibe/preset effect-biasing (Phase 2.2–2.3).

**Verified:**
- x1c7: `tsc --noEmit` clean on engine files; no new eslint problems (13 pre-existing
  react-hooks errors remain in `MicPrimer`/`ScreamMoment`, unrelated — see below).
- kinetica: `npm run typecheck` + `npm run build` pass; headless (Playwright) demo
  smoke test renders the stage + particle canvas, all presets/modes/record present,
  lyrics performing, **0 console/page errors**.
- Both repos byte-identical on the engine (sync dry-run: 0 changed).

**Known issue (pre-existing, not this change):** `npm run lint` in x1c7 has 13
react-hooks errors in `MicPrimer`/`ScreamMoment` (set-state-in-effect, refs during
render). `lint --max-warnings=0` was already red before this session. Candidate cleanup.

**Next (Phase 2.1):** build `freeze/melt/carve` components (close the drift), add Met +
NASA photo sources, add the "never blank" photo fallback chain.
</content>
