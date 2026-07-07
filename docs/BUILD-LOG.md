# Build Log — the Kinetica engine (x1c7 workshop)

Reverse-chronological record of engine/product work. Newest first. Each entry:
what changed, why, how it was verified. The full forward plan lives in
[`KINETICA-ROADMAP.md`](./KINETICA-ROADMAP.md); the two-repo model in
[`ENGINE-SYNC.md`](./ENGINE-SYNC.md).

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
