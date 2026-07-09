# THE SONIC DOSSIER — grand plan

Every collector edition ships with its papers. The cover is the front of the
case; the **Sonic Dossier** is the certificate of analysis inside it — the
song's measured identity, rendered on the `/t/<slug>` share page for anyone
who follows a link.

First live specimen: **Different This Summer** (2026-07-09).

## What the dossier shows (and who it's for)

| Block | Contents | Who cares |
|---|---|---|
| **ID plate** | BPM, key + **Camelot code**, runtime (+ beat count), energy, dynamics (dB + label), tone (spectral centroid → DARK/WARM/BRIGHT/BRILLIANT) | DJs (Camelot + BPM = instant mix compatibility), producers, curious listeners |
| **Anatomy** | Proportional structure strip — every section sized by real duration, bar height = *measured* energy (70% measured / 30% LLM), dots = vocals on deck, beat-cut + riser counts | Anyone deciding where to drop in; video editors syncing cuts |
| **The Journey** | Energy arc: how the song opens / rides / closes (0–99, from summed stem envelopes) | Playlist builders, DJs planning a set position |
| **The Read** | LLM interpretation of what the song is about, the producer's style sentence, themes + emotionally-charged keywords | Listeners, press-kit material |
| **The Loadout** | Which isolated stems exist (the instrumentation), vocal style | Remixers — this doubles as the stem-mixer menu |
| **Case palette** | Dominant colors extracted from the cover + art-style read | Designers, merch, visualizers |
| **Certificate footer** | Engine credit, analysis date, official-lyrics badge, dossier № | The collector vibe |

Design rule: **facts are measured, vibes are labeled as reads.** Anything
unverifiable renders as nothing — a partial profile still gets a dossier.

## The pipeline (per song, one command each)

```bash
# 0. pre-flight (once per session): free RAM/VRAM, warm the LLM
curl -s localhost:11434/api/generate -d '{"model":"qwen2.5:14b","prompt":"ok","keep_alive":"2h","stream":false}'

# 1. THE ANALYZER — stems + Suno self-serve, publish dossier to R2
node scripts/song-analysis/ultimate.mjs \
  --stems "assets/suno/stems/<slug>" --suno <slug> --id <slug> --publish
#   → profiles/<slug>/{profile.json, senses.json, lyrics.lrc, transcript.json, <slug>-planet-full.json}
#   → R2 planets/<slug>/profile.json   (the /t page dossier goes live here)

# 2. STEMS LIVE — mixer on, verified BPM lands in R2 stems.json
node scripts/stem-analysis/publish-stems.mjs \
  --stems "assets/suno/stems/<slug>" --slug <slug> \
  --stems-json scripts/song-analysis/profiles/<slug>/senses.json
#   → run its emitted UPDATE on Supabase (or via MCP)

# 3. THE COVER — verified BPM onto the case, then ship all its formats
#    (update manifest bpm from R2 stems.json; NO_STEMS set in build-manifest.mjs must not list the slug)
node scripts/song-art/collector/engine.mjs --only <slug>
node scripts/song-art/collector/make-web-assets.mjs --only <slug>   # shelf spine + card
node scripts/song-art/collector/make-og.mjs --only <slug>           # /t link-preview card
#    + upload out/<slug>.png → R2 covers/collector/<slug>.png
```

Order matters only for the cover step (needs stems.json in R2 for BPM).
Steps 1 and 2 share `senses.json` — analyze once, use twice.

### Verification checklist per song (what "correct" means)

- **BPM**: measured from drum onsets (senses.bpm) — the only source the cover
  trusts ("verified only").
- **Runtime**: stems.json duration vs the cover's runtime cell.
- **Genre**: the LLM identity (from audio + lyrics, blind to our label) should
  agree with `tracks.json` genre; disagreement = flag for the owner, don't
  auto-flip (identity guessed "Deep House" for a track labeled "House" — that's
  agreement, not correction).
- **Explicit flag / language**: transcript language + lyrics text.

## Rollout — the big job

All stem zips are downloaded (96 files in `assets/suno/stems/`). Remaining
work per docs/SONGS.md: ~10 tracks without live stems + all 54 public tracks
without a published dossier.

Phase 1 — **stems catch-up** (the missing ~10): extract zip → pipeline steps
1+2. This also unlocks verified BPM for their covers (step 3).

Phase 2 — **dossiers for the whole catalog**: for the ~44 tracks whose stems
are already live, step 1 only (`--publish`). Their senses.json already exists
in R2 but the profile needs the LLM passes — run overnight, they're ~5-8 min
per song on the 14b model. GPU note: whisper + qwen contend with ComfyUI;
pre-flight per session.

Phase 3 — **BPM sweep of the covers**: after phase 1, rebuild manifest BPMs
from R2 stems.json for every track that gained one, re-render + re-ship those
covers (engine/web/og `--only` flags all exist now).

Tracking: tick boxes in docs/SONGS.md; a track is DONE when mixer + dossier +
BPM-on-cover are all live.

## Beyond the catalog — other people's songs

The analyzer already handles **mp3-only input** (demucs 4-stem fallback), so
the dossier works for any song anyone drops in. Ideas in rough order of reach:

1. **"Get your song's papers"** — a public tool: upload an mp3 (or paste a
   Suno link), get a shareable dossier page + OG card. The collector-
   certificate framing is the hook: your song, authenticated.
2. **DJ crate mode** — across a catalog, the ID plates form a mixing matrix:
   Camelot-compatible + tempo-adjacent suggestions ("mixes well with").
   We can prototype on our own 56 first.
3. **Kinetica tie-in** — the profile is exactly the input the free engine
   needs for a full show: energy arc, drop map, sections, palette. "Analyze
   your song → watch it perform" is one pipeline.
4. **Press-kit export** — the dossier as a PNG/PDF one-sheet (make-og already
   proves the compositor pattern).

## Conventions

- Profile lives at R2 `planets/<slug>/profile.json` (v:1). The `/t` page
  fetches it client-side; no deploy needed for new dossiers.
- Dossier № = deterministic hash of the slug (3 hex digits) — stable across
  re-analyses, unique enough for 56 tracks, pure collector flavor.
- BPM/duration in `profile.measured` (added 2026-07-09); older profiles fall
  back to the StemData the page already loads.
- Component: `src/components/SonicDossier.tsx`. Camelot + tone/dynamics
  label logic lives there — keep any future PDF/PNG export in sync with it.
