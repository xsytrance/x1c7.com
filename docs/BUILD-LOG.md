# Build Log — the Kinetica engine (x1c7 workshop)

Reverse-chronological record of engine/product work. Newest first. Each entry:
what changed, why, how it was verified. The full forward plan lives in
[`KINETICA-ROADMAP.md`](./KINETICA-ROADMAP.md); the two-repo model in
[`ENGINE-SYNC.md`](./ENGINE-SYNC.md).

---

## 2026-07-13 — The great recovery · phrase-mode alignment fix · Kinetica goes demo-first

Prime was OS-reinstalled (~07-12); this session rebuilt everything the wipe
took, then shipped a real engine fix and the Kinetica demo push.

**Recovery (ops — see OPERATIONS.md for the serving layout):**
- Prime re-registered on the tailnet: `100.110.224.126` → **`100.96.211.44`**.
  Planet Studio app v0.5.1 repointed (+ flush galaxy grid rows), OTA server
  and `x1c7.service` (:7272) revived as systemd user units, `~/x1c7.com`
  symlinked to the repo's new home at `~/Hermes/x1c7.com`.
- Secrets: Supabase service-role key restored (rotated — the old one leaked
  into recovery dumps); the R2 token was dead and was re-minted, backed up to
  x1c7-dev. Lesson: a tailscale IP and API tokens survive reboots, not
  reinstalls.
- **Collector manifest rebuilt from live data**: `manifest.json`/`tracks.json`
  (gitignored) died with the old disk, no backup existed. Reconstructed from
  DB rows + R2 listing + the covers artifact's curated lang/geo: 67/69
  coverFiles matched (the 2 misses are the /private/ covers-of-covers),
  bpm/runtime/peaks re-measured from audio. Hand-curated palette pins/
  series/explicit flags were unrecoverable — engine defaults apply on future
  re-renders; re-pin via Cover Lab. Covers API verified: 69 covers, 64
  printed, 18 palettes.
- Takedowns: `music-is-my-drug` + `one-more-breath-back-to-myself` hidden
  (broken timings, 20/36 words — awaiting stems re-alignment) in DB + the
  static first-paint list. Rooklyn Mix stays.

**Engine fix (synced to kinetica):**
- **Phrase mode survives The Alignment.** Line grouping matched LRC stamps to
  word times exactly; Tier A measured timings drift a few hundred ms, so
  aligned songs lost every line break → the whole song rendered as ONE
  "phrase" (mi-gente matched 1/81 lines). `phraseStartIdx` now lands each
  stamp on the nearest word onset (±0.6s); songs with no usable stamps
  segment on breath gaps (>1.05s / 12 words). Line-final emphasis rides the
  same set. Verified live on both sites, both fallback paths.

**Kinetica demo push (see kinetica's own BUILD-LOG for detail):**
- The no-install demo now performs a **random x1c7 catalog song** (Supabase
  anon REST + public R2; 40+ timed words required — near-instrumentals
  excluded) and is the landing hero. DYNAMIC default, bottom transport
  (⏭ = another song), hover tooltips + auto-opening coach, landing rebuilt
  with the Suno gratitude letter / Pro-stems CTA / only-the-beginning teaser.

---

## 2026-07-10 — DYNAMIC+ v2 (reactor/stem-free) · deck default · the art backfill

Owner's call: "I don't like dynamic+ — back to phase 5, new phase 6 pass without
reactor or stem effects."

**DYNAMIC+ v2:**
- Catalog reverted to Phase 5 with the new `revert-dynamic-plus.mjs` (per-row
  backup → `dynamic-plus-backup-2026-07-10.jsonl`, gitignored; strips
  `planet.dynamicPlus`). Verified 0 rows left, planets otherwise intact.
- Contract rewritten (`src/lib/planet.ts`, synced to kinetica): acts are pure
  visual moments `{start, end, label, why}` — `reactor`/`stemSpot` deleted from
  the type, the choreographer prompt, and the data. `v: 2`.
- `dynamic-plus.mjs` reworked: no Reactor catalog, no stems line; the LLM bills
  each act with a ≤22-char marquee label in the song's own language ("THE DROP
  HITS", "EL ÚLTIMO CORO"); validation requires the label. Fresh qwen3.5 pass
  authored all 54 songs, zero failures. `apply-dynamic-plus.mjs` now refuses any
  non-v2 cache; live on 54 tracks.
- Conductor (`CinematicLyrics.tsx`) chips from `act.label` now.

**/music mobile:** the deck is the default view again (`page.tsx` one-liner);
the SHELF/DECK switch stays, saved preference still wins.

**The art backfill (the real "missing art"):** 30 of 54 planets had ZERO
backdrops on R2 — bare-stage shows. topup never saw them (it skips planets with
no base art). Fixes: 4 songs' local `public/planets` art uploaded (post-reorg
stragglers); new `scripts/song-art/backfill-planet-art.mjs` rendered keyword +
section art for the other 28 from their DB analysis (onboard step-7 recipe,
Rooklyn/Riverboat slugs forced to the B&W+gold voice) and wired
`planet.assets` in Supabase, preserving stem keys. Then
`topup.mjs --target 100 --pass BLITZ1` grows the whole catalog to 100/song.

**Verified:** tsc + eslint + prod build green (x1c7 and kinetica); DB checks:
54× `v:2`, no `reactor|stemSpot` anywhere, 0 dynamicPlus after revert (before
re-apply); covers audit clean (51/51 spine+card+OG live, 0 broken track URLs).

## 2026-07-09 — THE BOOKLET: 54/54 inserts published

CD liner notes × game manual, one per collector edition (plan:
[`BOOKLET.md`](./BOOKLET.md)). Shipped in one evening session:

**Changes:**
1. `scripts/booklet/build-booklet.mjs` — per-song insert builder: facts from
   `profile.json`, world art curated from the planet gallery (keyword buckets
   first), qwen3.5 writes tagline/liner/band-bios/level-names only. Copy is
   coverage-scored across two attempts, gaps filled from house bios, cached at
   `profiles/<id>/booklet-copy.json` (dynamic-plus no-clobber law). Publishes
   `booklet.json` → R2 `planets/<id>/` via the analyzer's rclone path.
2. `scripts/booklet/batch-booklets.mjs` — resume-safe catalog runner
   (mirror of batch-dossiers): R2 HEAD skip, serial, journaled.
3. `src/lib/booklet.ts` + `src/components/Booklet.tsx` — the flipbook:
   📖 button on `/t` pages (renders only where booklet.json exists — zero
   deploys per booklet), page-turn spring, swipe/arrow-keys, lyrics
   auto-paginated, instrumentals get a second world spread instead.
   Types deliberately outside `planet.ts` (not in the engine-sync surface).
4. Also this session: /music got the Suno gratitude box moved above the fold
   (non-affiliation bolded) + a Kinetica explainer section with links.

**Batch**: 49 clean on the first pass (~9s/song, qwen3.5 warm); 4 crashes
were unnamed sections hitting the copy validator — normalized
(`Section N` fallback) and rebuilt; final 54/54 published.

**Verified:** `tsc` + `next build` green; specimen + 4 fixed tracks + one
instrumental + one Spanish track fetched from R2 and content-checked;
54/54 HEAD 200; live bundle on x1c7.com serves the button.

**Follow-ups same session:** tapping the collector cover on `/t` opens the
booklet (`BookletHandle.open()` via forwardRef); the insert reached `/music`
— pulled case art + 📖 INSERT chip on the shelf, chip on the deck's centered
card, spine/card taps untouched (trigger takes `sizing`/`label`, ShareButton
convention; booklet.json fetched only for the focused song). Both deploys
verified live in the served bundle. Ops docs updated: booklet in the R2
bucket map (OPERATIONS.md) + the new-song onboard runbook (catalog rollout
doc) + BOOKLET.md marked shipped.

---

## 2026-07-07 — Phase 2.4 SHIPPED: vertical/social frames (kinetica) + engine fix

**Goal:** the roadmap's ★ "biggest single win" — a 9:16/1:1 canvas so Suno
creators can post to TikTok/Reels/Shorts — plus the flagged live-browser
validation of the aspect-box approach.

**Changes (kinetica `Show.tsx` + `useRecorder.ts`; engine fix here):**
1. **Frame control** in the Director's deck (Wide / 9:16 / 1:1), "V" key
   cycles, choice remembered in localStorage. Implementation is the roadmap's
   own sketch, confirmed working: wrap the stage in a **transformed box** — a
   transform makes the ancestor the containing block for `fixed` descendants,
   so every engine layer (words, weather, veils, meters, grade) letterboxes to
   the frame with **zero engine changes**. Chrome stays outside the frame.
2. **Cropped recording** — Region Capture (`CropTarget`/`cropTo`, Chromium):
   recording a framed show exports a **real 9:16/1:1 video**, not a
   letterboxed tab. Falls back silently to full capture elsewhere; the deck
   hints "pick This Tab".
3. **Engine bug caught during live validation** (fixed HERE, synced over):
   `SurfaceEffects` now clamps `intensity` to 0..1 and `dt` to ≥ 0. A
   section's live intensity dipping negative made `reach`/`maxR`/`grow`
   negative → a negative `createRadialGradient` radius → `IndexSizeError`
   thrown inside the rAF (reproduced + traced on the kinetica demo with an
   instrumented canvas).

**Verified:** Playwright + Chromium on the demo song — wide unchanged, 9:16
and 1:1 letterbox with clean clipping at the frame edge, deck controls work,
zero page errors after the clamp. Both repos `tsc` + build green; engine
byte-identical after sync. **Follow-up:** portrait-orientation photo search
for vertical shows (Pillar 2), export fps/resolution options.

---

## 2026-07-07 — Pillar 1 COMPLETE (handwrite + tvoff) · lint green again

**Goal:** finish the roadmap's effects pillar and make `npm run lint`
(`--max-warnings=0`) enforceable again — it had been red since before Phase 2.0.

**Changes:**
1. **✍️ Handwrite** (engine) — vow words write themselves on in script: a
   cursive-stack span revealed left-to-right by a clip-path, with a glowing
   pen-point riding the ink edge. Duration scales with word length. Vocab:
   write/letter/vow/promise/sign/ink/pen/poem/diary/journal.
2. **📺 TV-off** (engine) — final words switch off like an old CRT: flash on
   from a scanline, hold, collapse to a bright line, then a phosphor dot that
   dies. Vocab: end/goodbye/farewell/dead/death/die/dying + adiós ("gone" stays
   dissolve's, "silence" stays whisper's). **That closes Pillar 1** — every
   effect the roadmap named is shipped; only the stretch SVG stroke-font
   handwrite variant remains an idea.
   The registry-driven dream loop picked BOTH up with **zero script edits** —
   the de-drift work paying for itself one commit later.
3. **Lint green** (`eslint.config.mjs` + 4 real fixes):
   - react-hooks v7's four **React-Compiler-preview rules** (set-state-in-
     effect, refs, purity, immutability) are now off, with reasoning in the
     config: they flag the engine's intentional "playhead → append to trail"
     idiom 50+ times. rules-of-hooks + exhaustive-deps stay enforced.
   - Real fixes: `pooledArt` added to the stage rAF effect deps (stable
     useCallback), `performs` added to the karaoke-fallback effect deps (was a
     genuine staleness bug — the rAF loop wouldn't stop if `performs` flipped
     while open), `PRELOAD_RANGE` hoisted to module scope in Lightbox, and
     `useTypedText`'s `onComplete` moved to a latest-ref (inline lambdas in
     deps would restart the typing animation every parent render).
   - `--fix` swept the unused eslint-disable directives.

**Verified:** `npm run lint` exits 0 (first time in the Phase 2 era) · `tsc`
clean · `next build` green · collision script still reports no dead vocabulary.

---

## 2026-07-07 — Lexicon dream loop: registry-driven tables + shelf re-dream

**Goal:** the dream loop's hand-copied tag tables had drifted **16 text effects
behind** `registry.ts` (they only knew the original 8) — every word it filled
could never wear the signature treatments or tranches 2–3. Kill that bug class
and refresh the shelf.

**Changes (`scripts/lexicon/dream.mjs` + data + docs):**
1. **Registry-driven tables** — the lego vocabularies are now **extracted from
   `registry.ts`'s literal effect rows at run time** (regex over the uniform row
   shape), so adding an effect row is enough for the dream loop to pick it up.
   A drift guard exits loudly if extraction ever goes blind. `EXTRA_*` tables
   preserve the loop's shelf-only enrichments (e.g. richer SURFACE vocab — the
   registry's surface rows only carry their own name as a tag).
2. **Bug found by the new coverage histogram, fixed:** with signature effects
   dreamable, full-prompt matching put `neon` on **all 95 senses** — the
   generated imagery suffix "…volumetric light, film grain" hits neon's `light`
   tag. TEXT now matches the sense **core** (word + gloss + emotion) like
   SURFACE always did: scene dressing must not pick word treatments. neon 95→1.
3. **Coverage histogram** every run — senses-per-text-effect, zeros included,
   so under-use is visible instead of silently absent.
4. **Emotion rules for the new effects** — nostalgia/wistful/longing →
   chromatic; hurt/pain/betrayal → bleed.
5. **Shelf re-dreamed** (`--force`, all 87 words / 95 senses): +211 legos.
   Spot-checks read right: "dreams"→chromatic, "code"→glitch/type,
   "silence"→dissolve/whisper, "lie"→redact+bleed, and the Spanish words
   sangre/herida wear bleed. carve/slam/wave/pulse/fall/echo/liquid have no
   wearers yet — correctly reported, they fill as songs bring vocabulary.
6. **npm scripts** — `lexicon:harvest/dream/redream/publish/grow` so the
   pipeline is discoverable from package.json.

**Verified:** `next build` green (lexicon.json is a bundled chunk); dream run
output + spot-checks above. Publish to R2 not run from here (creds live on the
owner box); the nightly `grow-and-publish.sh` cron ships the refreshed shelf on
its next run — and with registry-driven tables it inherits every future effect
tranche automatically.

---

## 2026-07-07 — Pillar 1 tranche 3: redact / chromatic / liquid / bleed

**Goal:** keep widening the engine's text-effect palette (roadmap Pillar 1,
"ship 3–4 per tranche") — secrecy, analog memory, water, and blood.

**Changes (engine — registry + KineticStage, same shape as tranche 2):**
1. **🕶 Redact** — the word lands readable, then a black bar slams across it
   left-to-right and it stays struck out. Vocab: lie/liar/hidden/classified/
   censored/forbidden/undercover… ("secret" stays whisper's — no stealing).
2. **📼 Chromatic** — red/cyan ghosts pull apart and jitter like worn tape,
   then lock back into register (`mix-blend-mode: screen`, transforms only).
   Vocab: dream/nostalgia/analog/vhs/rewind/retro/polaroid/flashback/haze…
3. **💧 Liquid** — the word stands as a 30%-opacity vessel and fills bottom-up
   with a sea gradient via `clip-path inset` keyframes that overshoot and slosh.
   Vocab: tears/cry/weep/flood/spill/pour/overflow/lágrimas…
4. **🩸 Bleed** — a deep-red copy soaks through (base word keeps the theme
   color) while three thin drips run down from under the letters. Vocab:
   blood/bleed/wound/scar/vein/bruise/hurt/pain/ache/sangre…

Wiring: `TextEffect` union + `ALL_TEXT_EFFECTS` + `TEXTBOUND` rows +
`TEXT_MATCHERS` (appended, so first-match priority holds) in the registry;
`WORD_FX` entries + four word-sets + the `extraFx` chain (appended after
tremor) in KineticStage. Auto-trigger stays gated `pass >= 4`; per-word
overrides still trump via `resolveWordEffect`. All perf-lite-safe: transforms,
opacity, clip-path — no per-frame blur.

**Verified:** `tsc --noEmit` clean; `next build` green; eslint back to the
HEAD baseline (a copied stale `eslint-disable` was dropped — React types
already cover `WebkitBackgroundClip`). A collision script confirmed **no dead
vocabulary** — no word in the new sets is claimed by a higher-priority set.
Live-lyric trigger-rate measurement wasn't possible in this container (lyrics
live in Supabase; no creds here) — worth a spot-check on real songs next
session. Kinetica sync not run from here (separate repo); the engine files are
manifest-covered, so the next `sync-to-kinetica.mjs --apply` carries them over.

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
