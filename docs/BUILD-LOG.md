# Build Log — the Kinetica engine (x1c7 workshop)

Reverse-chronological record of engine/product work. Newest first. Each entry:
what changed, why, how it was verified. The full forward plan lives in
[`KINETICA-ROADMAP.md`](./KINETICA-ROADMAP.md); the two-repo model in
[`ENGINE-SYNC.md`](./ENGINE-SYNC.md).

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
