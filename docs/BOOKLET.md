# THE BOOKLET — grand plan

CD singles came with a little booklet; game cases came with a manual. Every
collector edition here gets both in one: **THE BOOKLET** — liner notes ×
instruction manual, tucked inside the case on every `/t/<slug>` page. Flip
through it like paper.

Sibling of the [Sonic Dossier](SONIC-DOSSIER.md): the dossier is the
*certificate of analysis*; the booklet is the *insert* — story, lyrics, art,
the band, and how to play the show.

## Design rules (inherited + new)

- **Facts are measured, vibes are labeled as reads** — same law as the dossier.
- **No deploy per booklet.** `booklet.json` lives at R2
  `planets/<slug>/booklet.json` (v:1); the page fetches it client-side and the
  OPEN THE BOOKLET button only appears when it exists (SonicDossier pattern).
- **Square pages, CD proportions.** Desktop: two-page spread with a 3D page
  turn. Mobile: single page, swipe-snap. Print typography, paper grain,
  palette from `profile.cover.palette`.
- **Reuse art before generating art.** The nightly topup is already growing
  every planet gallery toward 100 pieces — the booklet curates from
  `planets/<slug>/gallery.json` first; ComfyUI renders only fill gaps.

## The pages

| # | Page | Source | Manual vibe |
|---|---|---|---|
| 1 | **Front cover** — case art, title, "OFFICIAL TRANSMISSION MANUAL", booklet № | collector cover + slug hash | the cartridge label |
| 2 | **The Read** — liner notes, ~150 words + the style sentence | LLM over `analysis` + `identity` (labeled as a read) | the story page |
| 3–4 | **Lyrics** — typeset, auto-paginated; OFFICIAL badge or "transcribed on device" label | `lyrics.text` + `official` flag | the libretto |
| 5 | **THE WORLD** — art spread + themes as captions | `gallery.json` picks + `analysis.themes` | the world/setting page |
| 6 | **THE BAND** — one character card per stem: glyph portrait, name, LLM bio one-liner | `senses.json` stems + StemGlyphs + LLM | the character roster |
| 7 | **HOW TO PLAY** — the show's controls: phases (incl. ⚡ Dynamic+ when choreographed), tap/drag/fling word effects, mixer chips = mute the band | mostly static template + per-song flags (`canPerform`, `dynamicPlus` acts count) | THE manual page |
| 8 | **THE MAP** — sections as levels sized by real duration, energy = terrain height, drops/risers = boss markers; LLM names each level | `analysis.sections` + `show.dropMap` + `sectionEnergy` | the level map |
| 9 | **SPECS + certificate** — ID plate (BPM, key + Camelot, runtime, energy, dynamics dB, tone), credits, Suno gratitude line, booklet № | `measured` + `mixFeatures` (pure code) | the tech-specs back page |
| 10 | **Back cover** — waveform barcode strip, catalog line, x1c7.com/t link | stems envelope + template | the case back |

Instrumentals / near-instrumentals (AI Interlude, Feverbreak): lyrics pages
are replaced by a second WORLD spread — the booklet must never ship a 2-word
libretto (this dovetails with the whisper-cleanup loose end).

## Pipeline — `scripts/booklet/`

```bash
# 0. pre-flight (same as dossiers): warm qwen3.5, keep_alive 2h

# 1. per song
node scripts/booklet/build-booklet.mjs --id <slug> [--publish] [--force]
#   reads  profiles/<slug>/{profile.json,senses.json} (R2 fallback) + gallery.json
#   LLM    one structured call → liner notes, band bios, level names, art captions
#          hard-validated in code, retried once, CACHED at profiles/<slug>/booklet-copy.json
#          (--force re-asks; an --only rerun can never clobber the catalog — dynamic-plus law)
#   emits  profiles/<slug>/booklet.json  → --publish ships to R2 planets/<slug>/booklet.json

# 2. the catalog
node scripts/booklet/batch-booklets.mjs   # mirror of batch-dossiers.mjs:
#   walks targets.json, skips published (resume-safe), serial, continue-on-error,
#   journal batch-log.jsonl, full skip/failure summary
```

- **LLM**: qwen3.5:latest via Ollama (`OLLAMA_HOST`, model flag like
  dynamic-plus.mjs). Budget ≈ 1 min/song → full catalog ≈ 1 hour, no GPU art
  needed where galleries exist.
- **Art fill (optional, Phase 2)**: `booklet-art.mjs` — when a gallery has
  < 6 usable pieces, render booklet-specific interiors via ComfyUI (submit
  pattern from `scripts/lexicon/art.mjs`, sdxl_turbo), upload to the same
  `planets/<slug>/gallery/` so the nightly topup and the booklet share one pool.
- **R2 publish**: S3 creds from `.env` (aws4fetch pattern from
  `scripts/lexicon/publish.mjs`).
- **Booklet №** = the dossier's deterministic slug hash — the case and its
  papers match.

## Frontend

- `src/lib/booklet.ts` — v:1 types: `pages[]` as a discriminated union
  (`cover | read | lyrics | world | band | howto | map | specs | back`).
  Deliberately NOT in `planet.ts` — keeps it out of the Kinetica engine-sync
  surface until we decide to gift it.
- `src/components/Booklet.tsx` — the flipbook overlay. Lazy: mounts from a
  **📖 OPEN THE BOOKLET** button on `TrackShare.tsx` (between the action row
  and the dossier), rendered only after `booklet.json` 200s. Reuses
  `StemGlyphs` for band portraits and the dossier's Camelot/tone label logic
  (import from `SonicDossier.tsx` — keep exports in sync).
- Phase 2 mounts: the shelf case panel on `/music`; a print/PDF export
  (`booklet-print.mjs`, sharp compositor — pattern proven by `make-og.mjs`)
  which is also the press-kit one-sheet from the dossier doc's ideas list.

## Rollout

1. **Specimen**: Different This Summer (the dossier's first specimen too).
   Build → publish → eyeball `/t/different-this-summer` on desktop + phone.
2. **Ship the shell**: `Booklet.tsx` + `booklet.ts` + TrackShare button —
   `tsc` + `next build` green, deploy once. Pages render defensively: any
   missing block renders as nothing (partial booklet still opens).
3. **The batch**: overnight `batch-booklets.mjs` → 54/54 on R2, zero deploys.
4. **Spot-check** 3 random `/t` pages + one instrumental.

## Open calls for the owner (when home)

1. Booklet-specific ComfyUI art style (a "print illustration" look?) vs pure
   gallery reuse for v1.
2. Print/PDF export priority — Phase 2 or later.
3. ~~Should the booklet open from the shelf case on /music too?~~ **Decided
   (2026-07-09): yes** — the pulled case's art + a 📖 INSERT chip open it on
   the shelf; the deck's centered card gets the chip (card tap stays
   preview/play).
4. Level-name flavor: earnest (section moods) or full retro-manual cheese
   ("STAGE 3: THE RISER GAUNTLET"). The LLM can do either; pick a voice.
