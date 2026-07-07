# One engine, two homes — x1c7 ↔ Kinetica

_How the lyric engine is developed in x1c7 and released to Kinetica, and why the two stay in sync without duplicating work._

> **TL;DR** — x1c7 and Kinetica are the **same product**. x1c7 is the **workshop**
> (where the engine is built); Kinetica is the **gift box** (the same engine wrapped
> in a distribution shell, given to the Suno/AI/music community). The engine is a
> shared core with a **one-file adapter seam**. You build in x1c7, then run
> `node scripts/engine/sync-to-kinetica.mjs --apply` to release it into Kinetica.

---

## Why two repos

| | **x1c7.com** | **Kinetica** |
|---|---|---|
| Role | The workshop — where the engine is built | The gift box — the engine, distributed |
| Framework | Next.js (Vercel) | Vite + Tauri (GH Pages + desktop installers) |
| Shell (not shared) | Website: galaxy, music player, VR, tracks | App: stem-zip ingest, Whisper transcription, 3-level AI (BYO-key/local), ComfyUI art, video export, desktop packaging |
| Shares | **The lyric engine** ← | **The lyric engine** |

They were the same idea in two terminals; Kinetica was extracted from x1c7's engine.
Rather than merge into one repo (which would entangle two very different deploy
targets), they stay separate and **share the engine by sync**. That matches the
mental model: _build here, ship there when ready._

---

## The engine = a shared core + a one-file seam

Measured reality: the two engines were **~95% identical**. Five files byte-identical,
the rest differing only by today's features and **two imports**. So the boundary is
clean:

### Engine core (source of truth: x1c7)

```
src/components/KineticStage.tsx      → kinetica src/engine/KineticStage.tsx
src/components/KineticParticles.tsx  → kinetica src/engine/KineticParticles.tsx
src/components/SurfaceEffects.tsx    → kinetica src/engine/SurfaceEffects.tsx
src/components/PerfHUD.tsx            → kinetica src/engine/PerfHUD.tsx
src/lib/effects/registry.ts          (same path)
src/lib/perf.ts                      (same path — perf-lite profile)
src/lib/palette.ts                   (same path — cover-art → palette)
src/lib/planet.ts  lyrics.ts  shapes.ts  theme.ts  stemSense.ts  beatClock.ts
src/lib/lexicon/types.ts  lookup.ts
src/data/lexicon.json                (the pre-grown shelf, until it's hosted)
```

### The adapter seam — `src/lib/engineHost.ts`

The **only** file the engine imports that differs per app. Exactly three exports:

```ts
export { useMusicPlayer } from "…";   // the app's playback hook
export type { Track } from "…";       // the app's track shape
export const HAS_SHARED_ART = …;      // does this app ship the cross-song art library?
```

- **x1c7**: re-exports from `@/components/MusicPlayerContext` + `@/data/tracks`, `HAS_SHARED_ART = true`.
- **Kinetica**: re-exports from `@/audio/player` + `@/lib/types`, `HAS_SHARED_ART = false`.

The engine's `sharedArtFor()` is gated on `HAS_SHARED_ART`, so the same code path
serves x1c7 (has a `/planets/_shared` library) and Kinetica (song art only). No fork.

### App shells (never shared)

x1c7 keeps its website; Kinetica keeps `src/ingest`, `src/transcribe`, `src/ai`,
`src/comfy`, `src/export`, `src/ui`, Tauri, and CI. The sync never touches them.

---

## The release pipeline — `scripts/engine/sync-to-kinetica.mjs`

```bash
node scripts/engine/sync-to-kinetica.mjs            # dry-run (default) — shows what would change
node scripts/engine/sync-to-kinetica.mjs --apply    # write it into Kinetica
node scripts/engine/sync-to-kinetica.mjs --target /path/to/kinetica --apply
```

What it does:

1. Copies the engine-core file set x1c7 → Kinetica, applying the path map
   (`src/components/*` → `src/engine/*`) and the one import rewrite that follows from
   it (`@/components/KineticParticles` → `@/engine/KineticParticles`). Relative `./`
   and `@/lib/*` imports already resolve the same in both repos.
2. **Scaffolds Kinetica's `engineHost.ts` once** (with Kinetica's values) and then
   **never overwrites it** — the seam is app-owned.
3. **Lints every synced file** for app-coupling that would break Kinetica
   (`next/…`, `@/data/tracks`, `./MusicPlayerContext`, unrewritten `@/components/`)
   and warns loudly. Add an app-coupled import to an engine file and the sync tells you.
4. Refuses to write outside a git repo (unless `--force`), and is dry-run unless `--apply`.

Output classifies each file `NEW` / `CHANGED` / `SAME`, so a release is auditable
before and after.

### Release runbook

```bash
# in x1c7 — build the feature, verify
npx tsc --noEmit && npm run build

# release into Kinetica (on a branch there, so it's reviewable)
git -C /home/xsyprime/kinetica switch -c engine-sync
node scripts/engine/sync-to-kinetica.mjs --apply

# verify Kinetica compiles, then review + ship
cd /home/xsyprime/kinetica && npm run build
git add -A && git commit          # squash-release to public when ready
```

---

## The Lexicon as a shared, live asset

The word-database (`src/data/lexicon.json`) is grown in x1c7 by
`scripts/lexicon/{harvest,dream}.mjs` (the workshop tools — **not** synced). Today the
built shelf travels to Kinetica as a bundled file via the sync.

**It's now hosted (live).** `src/lib/lexicon/lookup.ts`'s `HOSTED_LEXICON_URL` points at
the shelf on Cloudflare R2, so **every app — x1c7 and Kinetica — fetches the latest at
runtime**, with the bundled copy as an automatic offline fallback. Grow it once in
x1c7, publish, and every install gets it **without a redeploy**.

The publish step is one command (S3 creds live in a gitignored `.env`):

```bash
node scripts/lexicon/dream.mjs --limit 999 && node scripts/lexicon/publish.mjs
```

`publish.mjs` uploads `src/data/lexicon.json` to R2 via rclone. Put it on a cron next
to the dream loop and the shelf grows and republishes itself — the "grows while you
sleep, for everyone" vision, done. (The R2 `pub-*.r2.dev` URL already serves open CORS,
so cross-origin fetch from both apps just works.)

---

## What Kinetica gained in the first sync

- Effect registry + new airborne modes (ash / petals / pollen)
- `SurfaceEffects` (mud / rust / cracks / vines creeping from the edges)
- Fog-seam fix + big flashing blow/wipe warnings; veils from the registry
- The Lexicon (types + lazy runtime lookup + seeded `lexicon.json`, code-split chunk)

And x1c7 gained Kinetica's engine features it was missing (the reconciliation that
made x1c7 the true superset before the first release):

- **Stutter-run word pileup** — repeated words ("push-push-push") stack up and fill
  the screen, swipe to clear
- **Weather preset override** (`forceParticle`) — pin a song's particle mode
- the `PlanetAssets.stems` field

Verified: both repos pass typecheck + build after the sync.

---

## See also

- [`EFFECTS-AND-LEXICON.md`](EFFECTS-AND-LEXICON.md) — the effect registry and the Lexicon in depth.
