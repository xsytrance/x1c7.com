# THE WALL — the /music redesign

Owner brief (2026-07-31): *"too much of a burden to scroll through, click a song,
click view show, click full show. I want them immediately immersed. A wall of mini
kinetica videos where it's super easy to click one and jump right into the full
show."*

Decisions locked with the owner before writing this:

1. **`/music` becomes the Wall.** The hub root (`x1c7.com`) stays the creative hub
   but gains a live wall strip above the fold.
2. **All copy moves below the Wall.** AGENOR band, Suno gratitude, and the
   Studio / Listening Room / Splice doors survive intact — after the music, not
   before it.
3. **CSS mini-shows ship first**; real rendered Kinetica loops land in P2 as a
   per-song progressive upgrade.

---

## 0 · Why the current page feels like work

The path from landing to a show today:

| step | cost |
|---|---|
| `x1c7.com` → find the music portal | 1 click, music is one portal among many |
| `/music` first paint | TextScramble hero, stats row, 3 tool CTAs, `AgenorBand`, Suno gratitude card — ~2 screens before a single song |
| hover/tap a 52px spine → case pulls | discovery requires hover; the art is edge-on and unreadable |
| click **🪐 START THE SHOW** | takeover finally opens |

**3 clicks + 2 read-gates.** The diagnosis that shapes this plan: the shelf is not
the problem — it is good craft and it stays. The problem is (a) the hub→music hop,
(b) three walls of copy above the collection, and (c) a spine metaphor that hides
every cover.

## 1 · What we already have (this is not a rewrite)

The engine for "one click = full show" is **already built**. The redesign mostly
rewires existing parts.

| asset | where | what it gives the Wall |
|---|---|---|
| **55 / 56 visible songs are show-capable** | `canPerform()` — synced words in Supabase | the Wall is the whole catalogue, not a curated few |
| **54 songs have generated planet art** | `planet.assets.keywords` — median 7 images, max 44 | the CSS motion layer, free |
| per-song palettes | `planet.analysis.palette` | tile glow / tint, per song |
| collector card art, every song | `cardUrl(id)` → R2 `covers/web/<id>-card.webp` | the tile poster |
| **auto-takeover on play** | `CinematicLyrics` — opens the show whenever a synced track starts | click → show, with no new plumbing |
| **hot-bar hover preview** | `usePreview()` — drops in at the best moment, lowpass sweep-in | tile hover audio, already sound-designed |
| **hottest-window finder** | `hotMoment(stems)` — 12s peak window from measured envelopes | P2 loop renders need zero manual direction |
| lite-device detection | `detectLite()`, `PerformanceGate` | the phone-melting guard |
| the show renderer, embeddable | `/studio?embed=1` + `render-cut.mjs` | P2 loop batch rendering |
| a working one-tap front door | `/galaxy` | proof the interaction works; the Wall is its wall-shaped sibling |

## 2 · The Wall

Full-bleed, edge to edge, **first paint is album art**. No hero, no scramble text,
no copy above it.

### Tile anatomy

```
┌─────────────────────────┐
│  poster: cardUrl(id)    │  ← always painted first, instant
│  ┌───────────────────┐  │
│  │ motion layer      │  │  ← P1: song's own planet art, Ken-Burns
│  │  + igniting word  │  │     crossfade, tinted by its own palette
│  └───────────────────┘  │     P2: <video> loop, same slot
│  TITLE          ▮▮▮▮▯   │  ← genre accent bar (GENRE_PALETTES)
└─────────────────────────┘
      ↑ whole tile is one target
```

- **Click anywhere → `playTrack(t, tracks)` → `CinematicLyrics` takes over.** One
  click. The queue seeds with the full library so next/prev traverse everything.
- **Hover / focus →** `usePreview.start(t)` drops the song in at its hot bar; the
  tile lifts, the rest of the wall dims. No click needed to hear something.
- **Mosaic, not a uniform grid.** The 9 directed cuts and `featured` get 2×2 hero
  tiles; the rest tile around them. A wall of *work*, not a spreadsheet.
- **Keyboard:** arrows move, Enter launches, `/` focuses search.

### The autoplay seed

The largest tile starts a **muted** mini-show the moment you land — you are
immersed before you click anything. Sound arrives on first interaction (browser
autoplay policy: muted + `playsinline` or nothing plays at all).

### Performance discipline — non-negotiable

55 animating tiles will kill a phone. All four of these ship with P1, not after:

1. `IntersectionObserver` — only tiles in/near the viewport animate; everything
   else is a static poster.
2. Hard cap of **~6 concurrent motion layers**, LRU eviction as you scroll.
3. `detectLite()` **or** `prefers-reduced-motion` → posters only, no motion, ever.
4. One preview audio at a time (`usePreview` already enforces this).

## 3 · Phases

### P0 — the Wall, static ✅ SHIPPED 2026-07-31

Files: `src/lib/wall.ts`, `src/components/wall/Wall.tsx`,
`src/components/wall/WallTile.tsx`, the `THE WALL` block in
`src/app/globals.css`, and a restructured `src/app/music/page.tsx`.

- `/music` renders `<Wall>` as the first element. Full-bleed, no hero.
- Tile poster = `cardUrl`, fallback `t.cover` → `t.art` gradient.
- Click → `playTrack` → existing takeover. **The core win landed here.**
- Copy moved below: `AgenorBand`, Suno gratitude, Studio/Listen/Splice doors,
  Kinetica credit, SoundCloud, `TylerPromo`, `ZeroChallenger` — all intact, all
  after the music. `BackToHub` moved to the foot, where an exit belongs.
- Shelf / Deck / Jukebox survive behind the view toggle, now with `wall` as the
  default; the persisted `x1c7-collection-view` key respects it. Nothing deleted.
- Hover cue (`usePreview`) came forward from P1 — the shelf already had it, so
  shipping the wall without it would have been a regression.
- **SHUFFLE THE SHOW** came forward from P3: random show-capable song straight
  into the takeover. It is one control and it is the whole "don't make me work"
  brief in a button.

**Things learned building it — do not undo these:**

1. **The resting wall is PURE ART, no overlay.** The collector card is a
   720×720 render of the whole case with the title, artist and genre already
   printed into the artwork. A name plate on top of that prints every title
   twice. Title / vibe / CTA now reveal on hover only. Tiles that fall back off
   the collector card have no baked title, so those keep a permanent plate —
   that is what `titleInArt` in `WallTile` is deciding.
2. **Dim with `brightness()`, never `opacity`.** Dimming ~60 tiles with opacity
   lets the page's own background gradient bleed through every one of them and
   the entire wall turns maroon.
3. **`<main>` on /music must NOT have `overflow-hidden`.** It makes main a
   scroll container and silently kills the wall's sticky control bar. The wall
   measures its own width, so nothing overflows horizontally anyway.
4. **Hover state is pure CSS**, never React. At ~60 tiles, driving hover through
   state re-renders the whole wall on every pointer move.
5. Phone density is 3 columns (`columnsFor` targets 128px under 640px wide).
   Two columns looked fine but read as a list; three reads as a wall.

Verified in a real browser at 1600×1000 and 390×844: 61 tiles, no horizontal
overflow, sticky bar sticks, one click on a tile opens the full Kinetic show,
all three legacy views still render, and the view choice survives a reload.

### P1 — the mini show ✅ SHIPPED 2026-08-01

Files: `src/components/wall/TileMotion.tsx`, `src/lib/useWallMotion.ts`,
`motionFramesFor`/`paletteFor` in `src/lib/wall.ts`, the mini-show block in
`globals.css`, and `WallTile` (now `memo`'d, taking stable callbacks).

- `TileMotion` cross-fades up to 5 of the song's OWN `planet.assets.keywords`
  paintings with a slow Ken-Burns drift, graded by its OWN
  `planet.analysis.palette`, with the lyric word each painting was generated
  FOR igniting over it. No render pipeline — 54 of 56 songs already had this
  art in R2.
- `useWallMotion` is the scheduler: an IntersectionObserver tracks what's on
  screen (into a **ref**, so scrolling costs zero React renders), and a few
  motion slots rotate through the visible tiles every 7s.
- Hover yields the mini show (`.wall-tile:hover .wall-motion` → opacity 0) so
  pointing at a tile brings its cover back.

**Things learned building it — do not undo these:**

1. **Rotate by STRIDE, not a marching cursor.** The first cut advanced a window
   of 6 consecutive tiles through the pool; within ~3 rotations every slot had
   marched below the fold and the visible wall was dead while six tiles danced
   offscreen. Now it takes every (pool/slots)-th tile, so the ones breathing
   are scattered across the screen, and the offset creeps by 1 per tick.
2. **`rootMargin` must be 0.** A 120px margin put just-offscreen tiles in the
   pool and the scheduler happily spent slots on them.
3. **Do NOT gate the mini show on `detectLite()`.** It is true for *every*
   viewport under 900px, so that gate left the wall dead on every phone — most
   of the audience, and where the tiles are biggest. `detectLite` exists to
   stop per-frame RE-RASTERIZATION; drift and cross-fade are composited
   transform/opacity. Lite now means **fewer slots (3 vs 6)** plus dropping the
   blur from the word ignite. Only `prefers-reduced-motion` stops it outright.
4. **Frames are `animation-play-state: paused` unless active.** All frames in a
   tile are stacked; letting them all drift ticks 4 layers per tile when one is
   visible. Pausing (rather than removing the animation) also lets the outgoing
   frame freeze and fade instead of snapping back to scale 1.
5. **`WallTile` is `memo`'d and takes stable callbacks.** Inline closures per
   tile would defeat it and re-render all ~60 tiles on every 7s rotation.

Measured: exactly 6 settled motion layers on desktop and 3 on phone, sustained
over 24s, zero page errors.

### P1 remainder — still open

- Tile waveform tick from `envBars` during a cue (nice-to-have, not built).
- The 2 songs with no planet art currently just sit as static posters; a
  palette-drift fallback would keep them consistent with the rest.

### P2 — real Kinetica loops

- `scripts/clip/wall-loops.mjs`: for each show-capable song, read stems →
  `hotMoment()` picks the window → `render-cut.mjs --from t --to t+8`, square
  (or 4:5) frame, **silent**, → webm (VP9) + mp4 (h264) fallback → R2
  `covers/loops/<slug>.webm`.
- Estimated cost: ~55 renders, roughly an hour of machine time, ~60 MB storage.
- `TileMotion` prefers a loop when one exists, falls back to P1 CSS otherwise.
  **The Wall is never blocked on the render queue** — it upgrades song by song.
- Eyes-on-output law: QA stills from every loop before it goes live.

### P3 — the channel + the doors

- **SHUFFLE THE SHOW** — one control, random show-capable song straight into the
  takeover, auto-rolls to the next on end. A lean-back TV channel of the
  catalogue. Likely the single biggest "I don't want to work" win.
- `/show/<slug>` — a URL that lands directly inside the takeover. Makes tiles
  real links (right-click, new tab, SEO) and every share link one tap to a show.
- Hub root: a live wall strip above the fold — one horizontally scrolling row of
  moving tiles, click → straight to the show. Music dominates the hub without
  burying projects / guides / agents.

## 4 · Success metric

**Time-to-show.** Today: 3 clicks + 2 read-gates. After P0: 1 click. After P1:
something is already moving before the first click. After P3: zero clicks if you
hit shuffle.

## 5 · Risks

| risk | mitigation |
|---|---|
| 55 animating tiles melt phones | the four perf gates, shipped with P1 not after |
| autoplay blocked | muted + `playsinline`; `usePreview` already handles the blocked-until-gesture path |
| R2 cover/loop 404s | every tile already has a two-step fallback to the gradient art |
| the Suno gratitude note loses prominence | it keeps a full-width card, immediately below the Wall — first thing after the music |
| losing the shelf's craft | shelf/deck/jukebox stay, behind the toggle |

---

## 6 · The Wall on Android — Planet Studio ✅ SHIPPED 2026-08-06

The companion app (`~/planet-studio`, v0.10.0) had the **same four steps** the
web brief killed: galaxy grid → planet page → PLAY → 🪐 FULL SHOW. Its front
door is now the Wall, read from this document at site commit `32e8aa8`.

Ported files, app side:

| app file | mirrors |
|---|---|
| `ui/wall/WallLayout.kt` | `src/lib/wall.ts` — `DIRECTED_CUTS`, `showRichness`, hero cap, `columnsFor`, `cellSize`, `motionFramesFor`, `paletteFor` |
| `ui/theme/GenrePalettes.kt` | `src/lib/collection.ts` — `GENRE_PALETTES` + `classifyGenre` (branch order included) |
| `ui/wall/WallMotion.kt` | `src/lib/useWallMotion.ts` — stride rotation, visible-only pool, slot counts |
| `ui/wall/TileMotion.kt` | `src/components/wall/TileMotion.tsx` |
| `ui/wall/WallScreen.kt` | `src/components/wall/Wall.tsx` + `WallTile.tsx` |
| `cardUrl()` in `WallScreen.kt` | `cardUrl` in `src/lib/collection.ts` |

**If you change any of those site files, the app is now downstream of you.**
The app's `CONTRACT.md` carries a design pin at `32e8aa8` and a drift check
covering them.

### Where the app deliberately differs

1. **Band packing, not `grid-auto-flow: dense`.** Compose has no lazy grid with
   row-spanning, and composing ~60 collector cards eagerly is tens of MB of
   bitmap. `packWall()` dense-packs into two-row *bands*, each one LazyColumn
   item. Same result — heroes are exactly 2× in both axes and later small tiles
   backfill the holes — with laziness kept. Order drift is bounded to one band
   and unit-tested.
2. **No hover, so no reveal.** The tile's whole job on a phone is the tap. Tap →
   the show; **long-press → the planet page** (drafts, studio, the detail the
   owner still needs). The "TAP ANY COVER, THE SHOW TAKES OVER" hint lives once
   in the bar, not on 60 tiles.
3. **The ignited word carries a glow, not a blur.** RenderEffect blur is a
   per-frame re-rasterisation, which is precisely what the motion budget can't
   afford; at tile size the glow reads the same.
4. **No hover-cue audio.** `usePreview`'s drop-in at the hot bar has no
   touch analogue — the tap is the commitment. `hotMoment()` stays unported.
5. **Reduced motion** is Android's `ANIMATOR_DURATION_SCALE == 0`. A small
   screen still means *fewer slots* (3 vs 6), never no motion — the same
   lesson P1 learned here.

### What the app gained that the web hasn't

- **SHUFFLE THE SHOW** is in the app's wall bar (the web's P3 item, which
  shipped early into P0 here as a control).
- The **AGENOR gold + xsytrance ✕** identity (docs/BRANDING.md) now leads the
  app's front door too, where the app previously had no artist identity at all.

### Still open on the app side

- P2 rendered Kinetica loops: when `covers/loops/<slug>.webm` exists, the app's
  `TileMotion` should prefer it exactly as `TileMotion.tsx` will.
- The 2 songs with no planet art sit as static posters in both places.
