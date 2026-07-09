# 2026-07-09 — The Night the Whole Catalog Learned to Perform

One day, one branch (`feat/live-owner-studio`, merged to main as `29907e4`).
Every public track went from "a song on a shelf" to a fully analyzed,
fully staged performer. This document is the complete record: what was
built, how it fits together, how to run every piece, and what's left.

## The scoreboard (verified against the live DB at ship time)

| System | Coverage |
|---|---|
| Sonic Dossiers (measured profiles on R2) | **54 / 54** |
| Full shows (`lyrics_synced` word timings) | **54 / 54** |
| Planet analyses (sections·moods·palettes·keywords) | **54 / 54** |
| ⚡ DYNAMIC+ choreographies (Phase 6) | **54 / 54** |
| Live stem mixers | **50 / 54** |
| Per-song share pages with OG collector cards | **54 / 54** |

## What was built, in ship order

### 1. Per-song share pages — `/t/<slug>`
- `src/app/t/[slug]/page.tsx` — Supabase-backed server page; the collector
  cover is the link preview (OG + Twitter cards).
- `src/components/TrackShare.tsx` — the share page body: animated case,
  "HEAR THE DROP" preview at the hottest bar, PLAY THE SHOW, Suno link.
- `src/components/ShareButton.tsx` — copy/native-share of `/t` links.
  Sizing is a prop; lives on the desktop shelf, the mobile deck, and the
  share page itself.
- `scripts/song-art/collector/make-og.mjs` — 1200×630 OG cards (case art +
  true waveform + collector metadata) → R2 `covers/og/<slug>.png`
  (+ `_music.png` for /music). `--only <slug>` supported.

### 2. THE SONIC DOSSIER — every song's certificate of analysis
- **Engine**: `scripts/song-analysis/ultimate.mjs` — one command, full
  measurement: stems DSP (bpm, onsets, cuts, risers, envelopes), key +
  structure, Whisper large-v3 on the isolated lead, LLM identity/section
  map/planet analysis, cover palette. `--suno <slug>` self-serves inputs
  from the public Suno API; `--publish` ships `profile.json` to R2
  `planets/<id>/profile.json`; `--skip-vision` skips only the vision LLM
  (palette is pure code) and avoids the model-swap scheduler wedge.
- **LLM**: qwen3.5:latest (required the Ollama ≥0.31 upstream tarball —
  Fedora's 0.12.11 doesn't know the qwen35 arch; installed to /usr/local
  with a systemd drop-in, RPM untouched). Full LLM pass: ~3 min/song vs
  20+ on qwen2.5:14b. Hardening for qwen3.5's habits: identity retries
  once when styleSentence/energy/vocalStyle come back missing; analyze.mjs
  coerces object-shaped overallMood.
- **Display**: `src/components/SonicDossier.tsx` on every `/t` page — ID
  plate (BPM, key + **Camelot code**, runtime in beats, energy, dynamics
  dB, tone from spectral centroid), the anatomy strip (sections sized by
  real duration, bar height = measured energy, dots = vocals), the energy
  journey, the analyst's read + themes/keywords, the stem loadout, case
  palette, certificate №. Facts are measured; vibes are labeled as reads.
- **Docs**: `docs/SONIC-DOSSIER.md` (pipeline, rollout, product ideas).

### 3. The batch — 54 songs in ~80 minutes
- `scripts/song-analysis/batch-dossiers.mjs` — walks `targets.json` (a
  live-DB snapshot), skips already-published profiles (resume-safe),
  resolves stems dir/zip by slug, runs the analyzer per track, ships stems
  for mixerless tracks (SQL collected in `batch-stems.sql`). Serial,
  continue-on-error, full skip/failure accounting.
- 45 clean; 7 Suno-lookup misses (title-slug mismatches, unlisted clips)
  rescued with the no-Suno fallback: local release mp3 (collector/audio) +
  local cover + stems. 5 new mixers lit up.
- Whisper caveat on quiet/instrumental tracks: AI Interlude's "show" is 2
  words, Feverbreak's is 10, and fade-outs sometimes hallucinate "Thanks
  for watching!" — cleanup pass pending (see Loose Ends).

### 4. Every song gets a full show
`canPerform()` gates on `lyrics_synced.words[]` alone — and the analyzer
produces word-level timings for everything. So:
- `scripts/song-analysis/publish-shows.mjs` → guarded SQL (review path)
- `scripts/song-analysis/apply-shows.mjs` → direct guarded apply (service
  role). **Guards are sacred**: official synced lyrics are never
  overwritten; whisper timings only fill empty rows; `planet.analysis`
  only lands where the planet has none. Idempotent — rerun freely.
- Show bundles also live at R2 `planets/<id>/show.json` (words + LRC +
  analysis) for any future backfill without re-running anything.

### 5. ⚡ DYNAMIC+ — Phase 6, the showcase pass
- **Contract**: `planet.dynamicPlus` (`src/lib/planet.ts`, synced to
  Kinetica): `acts[]` — each window is EITHER a `reactor` takeover (one of
  16 Lab modes) OR a `stemSpot` (solo 1-3 stems under a stage label) —
  plus `words` (lyric word → one of the 26 text effects).
- **The Conductor** (`CinematicLyrics.tsx`): walks acts against the
  playhead at pass 6. Reactor modes enter/exit automatically but NEVER
  stomp a manual pick (it only moves what it set). Stem spotlights
  snapshot the listener's mix and restore it after; a billing chip shows
  who's on stage ("⚡ THE WAR DRUMS"). `MAX_PASS` is 6 when choreography
  exists; the phase button reads "⚡ Dynamic+".
- **The word seam** (`KineticStage.tsx`): `dynamicPlus.words` merges under
  `effects.overrides` at pass ≥ 6 — under explicit overrides, above the
  natural lexicon.
- **The choreographer**: `scripts/song-analysis/dynamic-plus.mjs` — feeds
  qwen3.5 the measured profile (sections, drum-cut windows, stems,
  keywords) + a Reactor vibe catalog; validates hard in code (window
  clamps, overlap drops, unknown ids filtered); **caches each plan** to
  `profiles/<id>/dynamic-plus.json` (an `--only` rerun can never clobber
  the catalog — learned the hard way); assembles `dynamic-plus.sql` from
  all caches. Apply with `apply-dynamic-plus.mjs`.

### 6. 🎸 THE BAND — instrument mini-visualizers
`src/components/StemGlyphs.tsx` — 12 animated SVG musicians (mic shedding
notes, dual choir mics, drum kit with striking sticks, shaker, upright
bass with vibrating string, synth wave, strumming guitar, pressing piano
keys, violin with sawing bow, flute with air puffs, trumpet blasting
arcs, sparkling textures). Each is driven by its stem's real loudness
envelope via one per-frame CSS var (`--lv`) — zero React re-renders in
the hot path, perf-lite throttled. `StemOrchestra` is the self-driving
strip; the mixer's toggle chips ARE the band now (tap a musician to mute
them).

### 7. /music on mobile
- The **spine shelf is the default view** on phones; a SHELF/DECK
  segmented switch (persisted) keeps the deck one tap away.
- The shelf is touch-native: tap a spine to pull the case + preview, tap
  the same spine again to play; `pointerleave` ignores touch so the case
  stays pulled. Desktop hover/click and keyboard behavior unchanged.
- Layout stacks under 900px (case panel full-width below the spines).

### 8. Odds and ends
- Boot splash (`BootSequence`) plays **once ever** (localStorage), not
  once per session; replays only after clearing site data.
- Cover corrections: Different This Summer gained its verified 123 BPM on
  the case (cover BPM comes only from R2 stems.json — "verified only");
  runtime + genre cross-checked by the analyzer.
- Repo hygiene: analyzer audio proxies (release.mp3, cover.jpeg) and
  extracted stems-src are gitignored.

## Runbooks

**New song onboard (complete):**
```bash
node scripts/song-analysis/ultimate.mjs --stems "assets/suno/stems/<slug>" \
  --suno <slug> --id <slug> --skip-vision --publish
node scripts/stem-analysis/publish-stems.mjs --stems "assets/suno/stems/<slug>" \
  --slug <slug> --stems-json scripts/song-analysis/profiles/<slug>/senses.json
# apply its emitted UPDATE, then:
node scripts/song-analysis/apply-shows.mjs --only <slug>
node scripts/song-analysis/dynamic-plus.mjs --only <slug>
node scripts/song-analysis/apply-dynamic-plus.mjs --only <slug>
# cover: engine.mjs / make-web-assets.mjs / make-og.mjs, all --only <slug>
```

**Whole-catalog sweep:** `batch-dossiers.mjs` (resume-safe) → the two
appliers. Pre-flight: free ComfyUI if RAM is tight, warm qwen3.5 with
`keep_alive: "2h"`.

**Credentials:** `.env` now holds `SUPABASE_SERVICE_ROLE_KEY` — the
appliers use it directly. Never grind bulk data through the MCP SQL tool
again; that path is for queries and small statements.

## Loose ends

1. **4 mixers** wait on Suno stem zips: rum-pon-gold, still-got-5-on-it,
   music-is-my-drug-rooklyn-mix (+ hidden tracks). Their dossiers are
   demucs-approximate; re-run the analyzer when zips land.
2. **Phase-3 cover sweep**: tracks that just gained stems.json can now get
   verified BPM on their cases (manifest bpm refresh → engine → web → og).
3. **Whisper cleanup**: prune hallucinated tails ("Thanks for watching!")
   and decide what a 2-word "show" should do (AI Interlude, Feverbreak) —
   maybe a minimum-words gate or a hand-authored instrumental mode.
4. **Genre flags for the owner**: I Won't Be Your Fire measured as
   "Emo-Rap Pop-Punk" vs catalog "Electronic" — the analyzer's case is
   good; owner's call.
5. **LRC backfill**: rows that got whisper lyrics have LRC in place; rows
   that only got `lyrics_synced` from `apply-shows` also got LRC. R2
   `show.json` retains everything if anything needs re-applying.
6. **Kinetica sync**: `planet.ts` / `KineticStage.tsx` / `stemSense.ts`
   changed — run `scripts/engine/sync-to-kinetica.mjs --apply` when ready
   to gift Phase 6 types to the free engine.
