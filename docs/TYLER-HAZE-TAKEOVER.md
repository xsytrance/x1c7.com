# TYLER HAZE — "The Party Left Without Me" · site takeover master plan

**2026-07-17.** Juan Gomez (jayodeed), the owner's best friend, launched his
first album today under his AI persona/agent **Tyler Haze**. Alternative rock,
built from his real experiences and emotions. The owner's directive: *promote
the shit out of it* — his own catalog steps back, Tyler takes the spotlight,
the site's colors honor the album, and **#MADETOBREAK** (owner's favorite
track) gets a full x1c7 show with 50+ images and perfect timing.

## Assets in hand

| asset | where | notes |
|---|---|---|
| Album art | `assets/art/jayodeed the party left without me.png` | scrawled white brush title over a dusk aftermath scene — trashed porch, "GOOD TIMES" banner, "DON'T TEXT ME / YOU WON'T ANYWAY" graffiti, passed-out partiers, **RATED TYLER** advisory stamp ("substance use, reckless romance, emotional damage, prolonged self-destruction"). Has screenshot borders → crop to clean square before use. |
| #MADETOBREAK stems | `assets/stems/madetobreak.zip` | full Suno 8-stem: lead vox, backing vox, drums, bass, guitar, percussion, synth, other |
| #MADETOBREAK lyrics | `assets/lyrics/madetobreak.txt` | official, with section headers — feeds alignment + section map |
| Streaming links | research agent running | DistroKid distribution: Spotify, Apple Music, YouTube Music, YouTube, Deezer, SoundCloud, Amazon, etc. Prefer the **hyperfollow** smart link as the single hero CTA if it exists; individual service buttons under it. **Never fabricate a link — only verified URLs ship.** |

## Visual identity (from the album art)

- **Midnight indigo** `#1b2340`-ish dusk sky → page background / primary theme
- **Red-cup crimson** `#c0392b`-ish → CTA / accent (also reads "record label sticker")
- **Porch-light amber** `#e0a458`-ish → secondary glow accent
- **Scrawl white** — handwritten brush strokes for headings (the title's energy)
- Texture language: graffiti scrawl, torn banner, advisory-sticker chrome

## Workstreams (in order)

### 0. Document everything — this file. ✅

### 1. #MADETOBREAK full show (ASAP, priority one)
1. Unzip stems → **mix to release.mp3** (ffmpeg amix, loudness-normalized)
   → upload audio + cropped cover to R2.
2. **Onboard** via `scripts/onboard-song.mjs` (id `madetobreak`, artist Tyler
   Haze): Whisper word-level transcription against the official lyrics,
   LLM section map (lyrics have explicit section headers — anchor to them),
   planet analysis, choreography. Apply row.sql → track goes live, public.
3. **Timing is sacred**: `aligned.json` must pass QA; verify reel cues with
   `show-audit --timing-only` before calling it done (lesson from the
   2026-07-17 night shift: bad alignment fakes bad reels).
4. **Lexicon growth targeted at the song's heavy emotional words** — the
   album's whole vocabulary is lexicon gold: break, pressure, chain, armor,
   scar, weight, barricade, damage, throne, wreckage, stone, boulder, knife,
   grave, stage, fate, collapse, weapon, impact, reinforced, battle…
   `harvest → gravity → art.mjs --song madetobreak` with the atelier, then
   vision-worker readings for everything new.
5. **The reel**: `match-reel.mjs --song madetobreak --cap 64` (default cap 32
   is too small — owner wants **≥50 images**). If accepted candidates < 50,
   paint more art for the under-covered words and re-run. Publish.
6. Image direction: base imagery on the **album art's world** (dusk aftermath,
   party wreckage, graffiti), the **lyrics**, and the **song titles** — the
   sense imagery prompts + atelier mood routing (dark/aggressive → noir,
   dark-surreal, graphic-novel, film-still recipes) already point that way.

### 2. /music page takeover
- **Hero section, front and center**: cropped album art, huge kinetic title
  ("THE PARTY LEFT WITHOUT ME" in the site's kinetic word engine — that's
  Kinetica's font-graphics DNA, already synced into this repo), OUT NOW badge,
  streaming-service buttons (verified links only), and the owner's message:
  *how proud he is of Juan for the work he put in, in such a short time.*
- **RATED TYLER** advisory stamp rendered as a UI badge (it's too good not to).
- The owner's collection (shelf/deck/jukebox) moves **below the hero**,
  untouched in function.
- **#MADETOBREAK show CTA** in the hero once the show is live.

### 3. Site colors honoring the album
- Temporary "Tyler Haze edition" accent: swap the site's CSS accent variables
  to the indigo/crimson/amber palette (scoped site-wide via globals, easy to
  revert — document the previous values here before changing).

### 4. Generated graphics (local GPU)
- **ComfyUI / the Atelier**: a set of album-art-inspired backdrops + motifs
  (dusk porch light, red cups, torn banner, scrawled walls) for the hero
  background and section dividers. Style: cinematic, no text (scrawl text is
  typographic, not painted).
- **Kinetic type**: the hero title + "#MADETOBREAK" via the kinetic engine
  components (ignite/shatter treatments fit "made to break").

### 5. Claude's own additions (approved scope: promote hard, tastefully)
- **OG/social card** for /music using the album art + OUT NOW copy, so shares
  look right.
- **Jukebox guest slot**: Tyler's album as a special entry linking out to
  streaming (guest album, not part of the owner's catalog data).
- **Ossicle whisper** to the owner when the takeover + show go live.
- Suggested (not doing without a nod): a dedicated `/tylerhaze` shrine page;
  a banner on the homepage pointing at /music.

## Revert notes
- Previous site accent values: recorded in workstream 3 before the swap.
- The takeover hero is one component — delete the import to restore /music.
- Track row for madetobreak is a normal public row; `hidden=true` retires it.

## Research results (verified 2026-07-17)
- Album: 13 tracks, Alternative, ℗ 2026 **LevelReady Music**, UPC 882638702859.
  Tracklist incl. #MADETOBREAK (track 7, 3:52). Songwriter credit on the
  single: Juan Gómez — confirmed it's jayodeed's Tyler Haze.
- **Live + verified**: HyperFollow (canonical smart link), Spotify, Apple
  Music/iTunes, YouTube playlist, YouTube Music, Tidal. **Deezer**: only the
  #MADETOBREAK advance single so far. **Not yet indexed**: Amazon Music,
  Pandora (propagation lag). **SoundCloud**: profile exists but unconfirmed —
  left off the page. All links live in `src/data/tylerhaze.ts`.

## Lyrics & narrative research (2026-07-17, second pass)
- **8/13 tracks**: exact full lyrics via Suno's public profile API
  (`metadata.prompt` on each clip of @jc_gomez0311). **5/13** (Beautiful
  Damage, Never My Fault, Distorted In Her Eyes, Sober In My Thoughts,
  House Lights) are absent from Suno — whisper-transcribed from the official
  YouTube Topic audio (real but with mishearings; never quote them).
  Local archive: `assets/lyrics/tyler/` (gitignored).
- **It's a concept album**: 6th FLR name-drops "Jay-O-Deed" and foreshadows
  House Lights; Distorted In Her Eyes quotes Pretty When I Lie; Storms In
  November carries the thesis — "Sometimes you lose the love of your life
  because you loved your damage more."
- Per-track stories + heavy words + Suno cover art now live in
  `TYLER_TRACK_DETAILS` (src/data/tylerhaze.ts) and render on the
  track cards. The #MADETOBREAK Suno single art leads the show's
  guided.json (now 13 images).
- Suno profile stats at launch: 27 clips, 1057 plays, 53 upvotes,
  12 followers. Album creation window on Suno: June 15–28, 2026.

## Status log
- [x] Plan documented; lyrics saved to `assets/lyrics/madetobreak.txt`
- [x] Streaming links researched + verified → `src/data/tylerhaze.ts`
- [x] Album art cropped 1024² → `assets/art/tyler-haze-the-party-left-without-me.png`; audio mixed from 8 stems (232.4s) → R2 `tyler-haze/MADETOBREAK.mp3`
- [x] /music hero (`TylerHazeHero.tsx`): scrawl title, OUT NOW, proud message, verified links, RATED TYLER badge, tracklist, show CTA (`/t/madetobreak?reel=1`); collection below
- [x] Palette swapped in globals.css (previous values in comment + this doc)
- [x] OG share card for /music (`src/app/music/opengraph-image.tsx`)
- [x] Show: ultimate profile (venvs rebuilt post-reinstall: stem-analysis uv venv, whisper stable-ts+faster-whisper+torchaudio-cu128) → align QA (549 words, 2% clump, PASS) → row live (sort 0) → ~285 images painted on the song's words → **reel: 64 images, 15 words, all featured** (match-reel gained `--per-word`; cut at --per-word 6 --cap 64) → **timing verified 64/64, zero flags** (show-audit --timing-only)
- [x] ComfyUI hero backdrops (4 painted → R2 tyler-haze/backdrops/, porch-dusk rides the hero)
- [x] Deployed + whispered. Owner short-circuited the 600-reading general pass (2026-07-17 morning) — "enough images, make more later"; the song-targeted reader finished in background. A future night-shift pass will deepen coverage naturally.
- Jukebox guest slot: skipped — the hero IS the guest slot (noted as optional)
