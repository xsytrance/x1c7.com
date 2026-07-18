# Cover Studio 2 — the plan (reconstructed + agreed 2026-07-18)

The original spec died with the pre-reinstall transcripts; the owner
confirmed the remembered plan spans all four next-phase directions. The
Cover Lab v1 (planet-studio v0.5.0 + `/api/studio/covers`, built
2026-07-10) is the foundation — inventory, palette pinning, spine editing,
save-&-print already work end to end. Cover Studio 2 adds:

## The four pillars (owner-confirmed)

1. **AI-generated cover art** — generate NEW originals in the lab, not just
   re-frame existing ones. ComfyUI recipes tuned for album covers (square,
   text-free, genre/mood-routed like the Atelier), N candidates per run,
   pick-one → it becomes `originals/<slug>.png` → collector engine reprints
   the case. Prompt seeded from the track's planet analysis (summary, mood,
   themes, styleHint) with a freeform override box.
2. **Web Cover Studio on x1c7.com** — `/studio/covers` (owner-gated like the
   API): wall + spines + issues views, the Cover Lab editor, plus the new
   GENERATE deck. Browser-first iteration, no APK ship loop.
3. **SoundCloud auto-sync** — `scripts/song-art/soundcloud-covers.mjs`
   (exists, checkpointed) becomes a studio job: per-track "push to
   SoundCloud" + a sync-all button with drift report.
4. **Onboard from the studio** — a track with no collector record gets its
   manifest entry + first print created from the studio instead of a
   manual prime-side script run.

## Architecture (the cheap path)

- **One UI, two surfaces**: build the web studio; planet-studio already
  embeds site pages (`/studio?embed=1` contract). Cover Studio 2 honors the
  same embed contract → the app gets pillars 1/3/4 without new Kotlin
  (native Cover Lab stays for offline/quick edits).
- **Generation server-side on prime**: the site API runs on Vercel and
  can't reach ComfyUI — generation must run prime-side. Reuse the existing
  jobs pattern (`/api/studio/jobs` + prime worker): the studio enqueues
  `cover-gen` jobs; the prime worker (art-worker.mjs pattern) renders via
  ComfyUI :8188, uploads candidates to R2 `covers/candidates/<slug>/`,
  studio polls and shows the picks. Same pattern for `soundcloud-sync`
  jobs (Playwright needs prime anyway).
- **Recipes**: start with 4 cover lanes reusing Atelier checkpoints —
  photoreal (Juggernaut), painterly (Chroma/DreamShaper), graphic/poster
  (SDXL turbo + poster dressing), anime (Animagine). 1024×1024, no-text
  negative, mood-bucket routing from planet analysis.

## Two editions, one codebase (owner directive 2026-07-18)

Levels per docs/THREE-LEVELS.md (FREE/KEYED/LOCAL):

- **VIP edition — the priority.** For the owner + jayodeed (Juan): the
  owner-gated `/studio/covers` with everything open. Built FOR Juan's
  album-art workflow: dead-simple flow (pick song → get concepts → pick →
  variations → print), **lots of variations** (lane × concept fan-out,
  variation-of-this buttons), an **LLM art director** (local qwen3:14b
  writes N diverse cover concepts from the song's profile), and the
  **lexicon tie-in**: the song's heavy words' sense imageryPrompts +
  vision readings become prompt seeds ("ideas from the lexicon" deck) —
  everything interconnected. Access for Juan: recommend a Tailscale
  invite to prime (zero code); alternative is a signed guest link
  (decide before sharing).
- **Public edition — later, follows the levels.** FREE: upload/pick art,
  palette + spine typography, print the collector case (no AI, genuinely
  complete). KEYED: cloud image-gen candidates via BYO OpenRouter.
  LOCAL: the full lane roster against the user's own ComfyUI. Same
  components, capability-gated; no fork.

## Phases

- **P1 — generation backbone**: `cover-gen` job kind in the jobs API +
  prime worker handler; R2 candidate layout; `apply` endpoint that promotes
  a candidate to `originals/` + reprints. Testable via curl before any UI.
- **P2 — web studio shell (VIP)**: owner-gated `/studio/covers` with wall
  view + editor parity (reuses `/api/studio/covers`), then the GENERATE
  deck on top of P1 — including the LLM art director (concept fan-out via
  local qwen3:14b) and the lexicon idea deck (heavy words → imageryPrompts
  → one-tap prompt seeds).
- **P3 — SoundCloud job** + drift report in the ISSUES view.
- **P4 — onboarding flow** (manifest record + first print from the studio).
- **P5 — app embed** of the web studio behind the existing contract.
- **P6 — public edition**: the same components released behind the
  FREE/KEYED/LOCAL gates (docs/THREE-LEVELS.md). FREE tier ships only
  when it's genuinely demo-proud.

## Status log
- [x] Plan reconstructed (Explore agent over repo + surviving transcripts),
  confirmed by owner (all four pillars), memory saved (cover-art-studio.md)
- [x] P1 generation backbone — VERIFIED end-to-end 2026-07-18: cover-gen
  kind (route + art_jobs constraint migration `art_jobs_allow_cover_gen`) →
  worker renders lane recipes (photo/paint/poster/anime, 1024², analysis-
  seeded prompts) → R2 covers/candidates/<slug>/ → covers route
  `applyCandidate` promotes to originals/ (with .prev/ undo backup) +
  reprints + publishes. Test print: amor-de-verdad paint-lane candidate
  through the full loop.
  ⚠ Discovered: `collector/originals/` did NOT survive the reinstall —
  no existing cover can reprint until sources are restored (most live in
  assets/art/ + R2 album-art/). Recovery is its own task.
- [x] `originals/` RESTORED 2026-07-18 from X10 drive backup
  `PRIME_FINAL_PRE_UBUNTU26_20260710_194034/archives/current-home-priority-preserve.tar`
  (gitignored dir → in no git bundle; the tar was the only copy). 68 source
  files synced back (65 png + 3 jpeg, all integrity-checked); Amor De Verdad
  kept as the 2026-07-18 regen (tar's 6.3MB original staged if ever wanted).
  Verified: all 67 manifest coverFiles present → reprints unblocked.
- [x] Corrections + bespoke covers PUBLISHED LIVE 2026-07-18. Owner dropped
  `assets/art/corrections/` (correct art for wrongly-covered songs) +
  `assets/art/xsytrance/` (brand kit). Applied:
  - 5 raw-art corrections (amor-de-verdad, veneno-y-miel, membrane-still-
    insane, who-s-that-snake…, push-it-on-me) → `originals/` → engine-framed.
  - 2 already-framed finished covers (summer-drip, still-got-5-on-it) + the
    NEW song `nights-drift-by` via a new engine feature: **`finished/<slug>.png`
    passthrough** — if present, engine copies it verbatim (auto-normalized to
    2048²) instead of framing, so bespoke covers are first-class and survive
    reprint-all. `finished/` committed (irreplaceable, unlike the lost originals/).
  - Nights Drift By (夜が流れて): new /music track, Liquid DnB, real 4:19
    (cover art's "3:00" is decorative). MP3 + cover → R2; static fallback in
    tracks.ts (MP3_FILES + COVER_OVERRIDES) AND — the piece that actually makes
    it live — a **Supabase `tracks` row** (project kxbrjmbovjiwwcnepsfh). 🔑 The
    live /music list + covers come from Supabase via useTracks.ts, NOT static
    tracks.ts (that's only SSR fallback). Live covers = the row's `cover` col,
    which for the collection points to `covers/collector/<slug>.png` (framed
    collector prints, refreshed by upload.mjs) — not covers/<Name>.png.
  - R2 published (verified public-reachable): 7 primary keys + collector shelf
    `covers/collector/` (68) + web assets `covers/web/` (69). Committed +
    pushed to main (8ebb240) → deployed. Source assets archived to X10
    `x1c7-source-assets/2026-07-18/` (gitignored on disk → wipe-safe now).
    Post-deploy: inserted the nights-drift-by Supabase row + fixed
    still-got-5-on-it's stale .jpeg cover → live & verified on x1c7.com/music.
- [x] P2 web studio shell + GENERATE deck — v1 SHIPPED 2026-07-18 (e09b16f).
  Owner-gated `/studio/covers` (src/app/studio/covers/page.tsx): wall of all 71
  covers (GET /api/studio/covers) → pick → GENERATE deck (photo/paint/poster/
  anime lanes, optional prompt, 1–8 count) → enqueues cover-gen via
  /api/studio/jobs → art-worker.mjs renders on ComfyUI :8188 → candidates poll
  in → pick → POST applyCandidate → promote + reprint. Reuses P1 wholesale, no
  new backend. Page gated in src/proxy.ts (owner → through, else redirect home).
  Worker fix: cover-gen tolerates a missing Supabase row (collector-only tracks
  work; seeds from prompt/slug). Verified end-to-end. Needs the site running
  LOCALLY + `node scripts/art-worker.mjs --watch` (Vercel can't reach ComfyUI).
  ✓ P2 stretch — LLM ART DIRECTOR shipped (a64590e): /api/studio/concepts →
  qwen3:14b reads the song's analysis and pitches N distinct cover concepts as
  one-tap prompt-seed chips in the deck. ✓ EDITOR PARITY shipped (ee295cd):
  "Adjust the case" panel — palette picker + spine label + explicit toggle →
  overrides + reprint (frame only, keeps the art). Both verified end-to-end.
  ⏳ Remaining P2 stretch: the lexicon idea deck (a song's heavy words → their
  sense imageryPrompts/vision readings → prompt seeds — a second idea source
  beside the LLM art director). Everything needs the site running LOCALLY +
  `node scripts/art-worker.mjs --watch` + Ollama (qwen3:14b) + ComfyUI (:8188).
- [ ] P3 soundcloud job
- [ ] P4 onboarding
- [ ] P5 app embed
