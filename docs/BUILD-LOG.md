# Build Log — the Kinetica engine (x1c7 workshop)

Reverse-chronological record of engine/product work. Newest first. Each entry:
what changed, why, how it was verified. The full forward plan lives in
[`KINETICA-ROADMAP.md`](./KINETICA-ROADMAP.md); the two-repo model in
[`ENGINE-SYNC.md`](./ENGINE-SYNC.md).

---

## 2026-07-18 (VIII) — Cover Studio 2 P6: the Case Maker goes public

The last pillar. `/covers/make` (live on x1c7.com) lets anyone print their
song as a collector case — the FREE tier of docs/THREE-LEVELS.md, done by the
book: the whole engine runs **in the visitor's browser** (webEngine.ts, a
faithful client twin of engine.mjs with baked Bebas metrics), art + audio
never leave the tab (waveform/runtime via OfflineAudioContext), and the
output is a real 2048² PNG. The chrome is parameterized — visitor's label,
handle, monogram — so public prints carry THEIR imprint; AGENOR chrome stays
exclusive to the print engine. Owner approved design (a: parameterized chrome,
b: /covers/make + "Case Maker", c: FREE first). P6.2 backlog: KEYED
(browser-direct OpenRouter) + LOCAL (visitor's ComfyUI). Also fixed on the
way: who-s-that-snake's /music playback had been 404ing forever — the R2 key
has a curly apostrophe, the DB URL had a straight one; row fixed, waveform
backfilled, spine reprinted. **Cover Studio 2: P1–P6 all shipped in one day.**

## 2026-07-18 (VII) — Spine consistency sweep (#MADETOBREAK joins the shelf)

Owner spotted #MADETOBREAK rendering as a bare fallback strip in the app's
shelf. It had a /music row but no collector record — never printed. Fixes:
**adopt-onboarding** (`/api/studio/onboard` now accepts an existing tracks row
with no record instead of 409ing) → #MADETOBREAK onboarded with its real album
art + MP3 (3:52, 96-bucket waveform), **artist credit** in the engine footer is
fact-driven (`t.artist`, default xsytrance — the case reads AGENOR / Tyler
Haze), new **`backfill-facts.mjs`** repaired 12 records whose peaks/runtime
were lost in the post-reinstall manifest rebuild (bpm from stems.json where it
exists), and a `fmtTime` rounding bug that printed "4:60" was fixed in all
three copies. Reprinted + republished 69 cases. App v0.8.1: the SPINES shelf
shows **printed cases only** (unprinted/hidden tracks live in ISSUES, not as
gradient impostors). Honestly still open: 13 unreleased collector-only tracks
have no audio on file (no waveform until their MP3s appear — feed them to
`backfill-facts.mjs`), who-s-that-snake's audio_url 404s, and 13 spines have
no LANG/GEO because none was ever curated (facts-only law).

## 2026-07-18 (VI) — Spine typography: every title readable (fonts were silently gone)

Owner's screenshot showed some spine titles colliding with the genre block.
Root cause: the OS reinstall wiped the installed fonts and **librsvg falls
back silently** — every post-reinstall print rendered in a default sans ~65%
wider than Bebas Neue (measured: 903px vs 543px for the same string), blowing
past the layout math. Two fixes in `engine.mjs`: (1) **font self-heal** — the
repo's `./fonts` install themselves into `~/.local/share/fonts` + `fc-cache`
whenever fontconfig lost them, so this class of regression can't recur
silently; (2) **exact fit** — spine title/subtitle/genre sizes are now solved
with real TTF advance widths (minimal cmap+hmtx reader, verified within 4px
of rendered ink) instead of a flat per-char guess; genre letter-spacing (8)
modeled correctly for the first time. Every title now fills its zone fully —
even the 30-char birthday song — and can never overlap the genre block by
construction. Reprinted + republished all 68 (shelf, web assets, collector
PNGs). The 6 `finished/` bespoke covers keep their hand-made spines.

## 2026-07-18 (V) — Cover Studio 2 P5: the web studio in the app

The phone gets the whole web studio — generate deck, art director, Lexsycon
ideas, onboarding, SoundCloud panel — through the existing `?embed=1`
contract, zero feature reimplementation. Site half: `/studio/covers` hides
its header (and the WebView-hijacking exit link) under embed. App half
(planet-studio v0.7.0): new `EmbedScreen`, a plain WebView door for the
site's owner pages with the piece ShowScreen never needed — a file chooser
(`onShowFileChooser` → system picker) so the P4 onboard form can pick art +
MP3 from the phone — plus WebView-history back; "✦ COVER STUDIO 2" chip in
the galaxy header; native Cover Lab stays for offline. Rebuilt + restarted
`x1c7.service` so prime :7272 serves P3–P5; APK on the OTA channel (:7273).
Verified: compile + unit tests, and Playwright against :7272 confirms the
embed contract both ways. Detail: [`COVER-STUDIO-2.md`](./COVER-STUDIO-2.md).

## 2026-07-18 (IV) — Cover Studio 2 P4: onboard a track from the studio

A brand-new song becomes a collector citizen in one request instead of the
six-step manual ritual. `POST /api/studio/onboard` (owner-gated, multipart):
manifest record from the form facts, optional art → `originals/` + first print
through the shared print path, optional MP3 → runtime + true waveform peaks
(ffmpeg, the build-manifest recipe) + R2 `music/`, optional publish → the
Supabase `tracks` row (sort_order max+1, palette-accent color). Collisions
409. The engine/print plumbing was extracted to `src/lib/studio/
collectorPrint.ts` (covers route now imports it); `collector/upload-file.mjs`
is the generic plain-node R2 uploader (Next fetch drops Content-Length on
binary PUTs). UI: `+ Onboard` by the wall search — art-less onboarding is
first-class since the GENERATE deck + applyCandidate finish the job. Verified
with a throwaway track end-to-end (print + 4 R2 artifacts + wall + dup-409),
then removed without trace; /music untouched. Detail:
[`COVER-STUDIO-2.md`](./COVER-STUDIO-2.md).

## 2026-07-18 (III) — Cover Studio 2 P3: SoundCloud sync as a studio job

The Playwright cover-swapper (`soundcloud-covers.mjs`) is now a studio citizen.
The script became a library (CLI unchanged, plus `--drift`): `scan` records the
matched track's slug + `scannedAt` and keeps push history across rescans;
`pushTracks` takes explicit slugs / progress + cancel callbacks and records the
pushed art's etag; new `drift()` HEADs each matched cover on R2 and compares
etags → per-track state `never | stale | synced`. New `soundcloud-sync` job
kind (`art_jobs` constraint widened by migration `art_jobs_allow_soundcloud_sync`):
`{mode:"scan"}` rebuilds the map, `{mode:"push", slugs?|includeStale?|limit?|dry?}`
pushes explicit tracks or everything never-pushed + stale — handled by
`art-worker.mjs` (no GPU; headed when a DISPLAY exists, headless otherwise;
honors job cancel; per-track progress into the row). New owner-gated
`GET /api/studio/soundcloud` = the drift report (reads the map file — prime-
local). `/studio/covers` grew a **SoundCloud panel** (deck home: counts, stale/
never list, unmatched, rescan + sync-all) and a per-track **Push cover** row;
candidate logic now filters to cover-gen jobs. Verified end-to-end minus the
account itself: scan job errors cleanly ("not logged in" — the saved profile's
session expired with the reinstall; run `--login` once), drift states verified
against a synthetic map (stale/never/counts), dry push job through the full
queue → 1600px JPEG rendered, real 404 covers surface as item-level failures.
Detail: [`COVER-STUDIO-2.md`](./COVER-STUDIO-2.md).

## 2026-07-18 (II) — Cover Studio 2 P2: the web studio

Owner-gated `/studio/covers` — the VIP web cover studio, on top of the P1
backbone. Wall of every collector cover → pick one → GENERATE deck (photo/paint/
poster/anime lanes, optional prompt, 1–8 count) → enqueues a cover-gen job →
`art-worker.mjs` renders on the local ComfyUI (:8188) → candidates stream in →
pick one → it promotes to `originals/` and reprints the case. Reuses the P1
`/api/studio/covers` + `/api/studio/jobs` wholesale — no new backend. Gated in
`src/proxy.ts`; worker fix lets cover-gen run for collector-only tracks (no
Supabase row). Verified end-to-end (cold-sugar → 2 candidates ~15s). Detail +
stretch goals in [`COVER-STUDIO-2.md`](./COVER-STUDIO-2.md). Also this day: an
audit fixed 6 double-framed covers, added a DRUM & BASS bucket, corrected
i-said-no's genre (Pop→Hip-Hop), and generated correct serene art for Days
Drift By via `gen-cover.mjs` (SDXL Turbo).

## 2026-07-18 — Covers recovered, corrected, published; identity across the site

Two threads shipped end to end. Cover detail: [`COVER-STUDIO-2.md`](./COVER-STUDIO-2.md);
identity: [`BRANDING.md`](./BRANDING.md).

- **`collector/originals/` recovered.** The reinstall wiped the (gitignored)
  source covers — in no git bundle. Found the only copy inside the July-10
  working-tree tar on the X10 drive; extracted 68, integrity-checked, synced
  back. All 67 manifest coverFiles present → reprints unblocked; full shelf
  reprinted (68).
- **8 corrected covers.** Owner dropped correct art for wrongly-covered songs.
  5 raw arts → `originals/` → engine-framed. 2 pre-framed finished covers went
  through a new engine feature — **`finished/<slug>.png` passthrough**: bespoke
  covers copied verbatim (normalized to 2048²), never re-framed, so reprint-all
  is safe. `finished/` is committed so these irreplaceable sources can't be lost
  like `originals/` was.
- **New track: Nights Drift By (夜が流れて).** Liquid DnB, real 4:19 (the cover's
  "3:00" is decorative). MP3 + cover → R2; pinned in `tracks.ts`. Note: `/music`
  covers ARE the engine-framed collector prints at `covers/<Name>.png`.
- **Published live.** 7 primary R2 keys + collector shelf (68) + web assets (69),
  all verified public-reachable; committed + deployed.
- **xsytrance / AGENOR identity kit** across 5 surfaces: neon-✕ favicon,
  `/music` XsytranceBand, footer AGENOR watermark, homepage "XSY / VG God"
  band, and a concert backdrop on the Kinetica shows section. Source PNGs
  optimized 2–3 MB → 24–343 KB webp in `public/brand/`; source archived to X10.

## 2026-07-14 (XV) — The Curator: gravity, vision, and the reels

The lexicon stopped painting everything equally and started *knowing what
it painted*. Doctrine: [`CURATOR.md`](./CURATOR.md).

- **Word gravity**: every word weighed 0..1 (keyword membership, idf,
  freq, title words, seed guardrails; qwen3:14b grades the borderline,
  cached forever). 295 heavy · 541 mid · 715 light. Atelier budgets by
  tier (6/2/0) — the gallery target fell 21.7k → ~13k images, all heavy.
  Owner-approved prune took 374 featherweight images off R2 + the shelf
  (journaled). /lexicon + /atelier hide light words (?all=1).
- **The MEANING pass** (ultimate.mjs 7b): per song, one deep read —
  story, per-section interpretations, key lines, 12–20 heavy sung
  keywords merged into analysis. The four target songs re-ran with
  qwen3:14b + qwen3-vl cover reads and published; their vocabularies
  (fire/cage/knife/insomnia/sundress/…) harvested into the shelf and
  rendered first. International Heat's mixer wired live (stems were
  already on R2; only the DB assets were missing).
- **Vision index**: qwen3-vl:8b reads every painting (subjects, mood,
  symbols, text-in-image + quality/wordMatch self-QC) → vision-index.json
  (+ R2). qwen3-embedding:0.6b embeds readings (3× the discrimination of
  nomic on our probes).
- **The reels**: per song, cosine-prefilter → qwen3:14b judge (text-only —
  the hallucination firewall) → planets/<id>/lexicon-reel.json. Dossiers
  gained "WHAT IT'S REALLY ABOUT" + "THE REEL"; the show gets reel
  ghosting behind reel.enabled.
- **Nightly** now ends with a curator block (vision 400/night + reel
  refresh); gravity runs right after harvest. All Ollama steps unload
  (keep_alive 0) so ComfyUI keeps its VRAM.
- Fixed on the way: harvest finally scans song-analysis/profiles (56
  songs, was 2), non-string emotions coerced (the "0.85" sense), keyword
  contractions stopped, colorHintHex normalized, ultimate's llm() reads
  thinking-field JSON.

## 2026-07-14 (XIV) — The Atelier: five engines, twenty-five brushes

The lexicon's art pass grew from one hardcoded SDXL-Turbo graph into a
proper atelier. The owner's brief: equip ComfyUI so the lexicon can grow
"incredibly large and with a huge variety."

- **ComfyUI upgraded** to latest master (uv-managed venv — no pip binary;
  `VIRTUAL_ENV=… uv pip install` is the move).
- **The roster** (~91 GB, all verified against HF before download, all
  Apache-2.0 or equivalent for the new engines):
  *Z-Image Turbo* (photoreal at 8 steps), *FLUX.2 klein 4B* (composition/
  adherence, 4 steps), *Qwen-Image + Lightning 4-step* (typography — it
  paints THE WORD into the scene), *Chroma1-HD* (painterly wildcard,
  20 steps, used sparingly), plus an SDXL style stable: *Juggernaut XL v9*,
  *DreamShaperXL Turbo*, *Animagine XL 4.0*, Lightning 4/8-step LoRAs, and
  12 style LoRAs (pixel, watercolor, papercut, storybook, stickers, neon
  sign, stained glass, graphic novel, chalkboard, analog film, line manga,
  3d render). Two economies discovered: klein shares Z-Image's Qwen3-4B
  text encoder, and Z-Image's VAE *is* the FLUX.1 VAE Chroma needs.
- **art.mjs v2 (the Atelier)**: ~25 named style recipes = engine +
  checkpoint + LoRAs + prompt dressing + sampler math (wired exactly per
  ComfyUI's bundled templates). Mood-affinity buckets (dark/sad/warm/
  bright) route each word-sense to suitable recipes; a deterministic
  word-hash rotation guarantees the sense's N images use N different
  recipes and re-runs never reshuffle. Jobs sort by engine+checkpoint so
  the GPU never thrashes reloads; slot indices parse from existing URLs
  for full idempotency; shelf republish throttled to every 10 renders.
- **Verified**: one live render per engine and per finetune/LoRA recipe —
  11 first-contact renders, 0 failures. The Qwen word-portrait of "every"
  (hand-lettered over a noir alley) is the money shot.
- **Nightly**: grow-and-publish.sh now runs the Atelier at per-sense 4,
  1200 images/night (~21k-image shelf lands in ~2½ weeks, then keeps pace
  with harvest).

"What's up with the lexicon?" — it was healthy but orphaned. Fixed, then
supercharged:

- **Heartbeat restored**: the nightly grow cron died in the OS reinstall
  (hosted shelf frozen at 07-05). Replaced with `lexicon-grow.timer`
  (systemd user, 1 AM, Persistent=true — OPERATIONS' own advice). A
  catch-up ran and published immediately.
- **THE LYRICS PASS (harvest.mjs)**: keywords are the LLM's dozen picks
  per song; the catalog SINGS thousands. Harvest now also mines
  `lyrics_synced` from the live DB — every word sung ≥ --min-freq times
  (default 2) becomes a shelf entry sensed by its song's mood, with a
  LYRIC_NOISE stopword set (interjections/contractions) so "ooh" never
  gets a sub-planet. Result: **87 → 1,468 words / 5,434 senses** from
  13,096 sung-word instances (1,410 rare words "left for the songs to
  earn"). First bounded dream run: 120 words → **+6,217 legos**, and
  previously-unworn effects (carve, slam, pulse, fall…) finally have
  words. 1,330 on the frontier for the nightly timer. Shelf published —
  every x1c7 + Kinetica install picks it up with no redeploy.
- **ComfyUI revival (reinstall casualty #6)**: the venv survived (torch
  2.9.1+cu128, cuda ok) but the SDXL Turbo checkpoint died with the
  disk — and the owner's X10 backups hold code/configs/DBs, not weights
  (searched all three backup roots). Re-downloaded from HF; ComfyUI now
  runs as `comfyui.service` on :8188 (enabled), so the nightly art
  passes fire again.
- **Proof of life**: checkpoint landed (6.94 GB), ComfyUI indexed it
  without a restart, and `art.mjs --limit 2` rendered two images on the
  5060 Ti, wrote them into lexicon.json, and published — the R2 URL
  serves 200. Casualty #6 closed; the reinstall ledger is empty.
  (~10.7k images to reach 2/sense across the new 1,468-word shelf — the
  nightly art pass chips at that queue on its own.)

---

## 2026-07-14 (XII) — The Pocket Instrument: the Studio goes truly mobile

The owner's brief: "much much much more mobile friendly — not small
tweaks; take the lead." Phone-native architecture, not shrunk desktop:

- **Bottom sheets + a thumb tab bar** (✦ Looks · ◫ Scenes · ⚙ Params ·
  ▣ Deck) riding above the player. A tab slides up a glass sheet — looks
  pads, the scenes rail with the .frag loader, the param panel in a new
  TOUCH mode (taller rows, 20px thumbs), deck + automation stacked. Tap
  the scrim or the handle to dismiss. Desktop is untouched (`md:` split).
- **Phones get the full engine here — deliberately.** New
  `forceBackdrop` on KineticStage mounts the GL field even on perf-lite
  devices, paid for in resolution not features: `backdrop.renderScale`
  became a registry param and a coarse-pointer profile drops it to 0.35
  (+ shorter ghost tails). The perf-lite law still governs the ambient
  /music show; the studio is a user-opened instrument — the trade is the
  user's.
- **Mobile top bar**: STUDIO · compact telemetry (BPM + tier + beat
  light) · ♪ setup toggle · EXIT. The workspace seg is desktop-only now —
  on the phone, the sheet IS DIRECT.

**Verified on emulated Pixel 7** (real launch, autoplay Chromium): four
tabs render, KINETICA mounts on a lite device (forceBackdrop working),
renderScale reads 0.35, the GL canvas is live, sheets open/close, zero
page errors. Screenshots confirm the instrument reads one-handed.

---

## 2026-07-14 (XI) — Re-aligns, the lyrics audit, and the owner's inbox

**Worst-5 re-aligned on the fresh GPU env** (realign-one.py — the v1
aligner's windowed core pointed at the cached web lead stems, since the
local WAVs died in the reinstall). The gate separated timing disease from
LYRICS disease:
- one-more-breath: 36 broken words → **121 words @ 0.158s** (was 2.4s) —
  APPLIED; the pulled song may be ready to un-hide.
- say-it-with-your-eyes: 0.36s → **0.098s, silence 0.003** — APPLIED.
- say-it-with-your-body: re-align made it WORSE (22% of words in vocal
  silence) — the official text doesn't match the song. → lyrics audit.
- red-flags: no gain at 0.38s → text partly suspect. → lyrics audit.
- music-is-my-drug: its "lyrics" are whisper garbage ("Thank you." × 20).
  Nothing to align. → lyrics audit, top of the list.
Both applied songs' melody.json re-run + republished (word indices
changed): C major 0.97 / F minor 0.90 diatonic.

**The lyrics audit** (the owner suspected missing/wrong lyrics — the
profiles scan confirmed it): 8 tracks run on unofficial whisper-derived
text, 2 have provably wrong text. Human list: docs/LYRICS-AUDIT.md;
machine twin: scripts/alignment/lyrics-audit.json.

**The inbox — the easy way to send corrected lyrics**:
- `/api/studio/lyrics` (tailnet-only via the proxy, like all write APIs):
  GET = the audit + inbox state; POST {id, lyrics} → inbox/<slug>.txt.
- Studio SETUP grew a **Lyrics Inbox** card (private hosts only): pick a
  flagged song, see WHY it's flagged, paste, save.
- `realign-inbox.mjs` consumes it end to end: GPU align → refine → GATE
  (applies only if measurably better than live, journaled) → melody
  re-run + republish → inbox file moves to done/.
Verified: GET lists 10, POST lands, the consumer picks it up (dry),
public hosts get 404.

---

## 2026-07-14 (X) — Alignment v2 applied: the whole catalog snaps to the voice

The owner's goal: perfectly aligned lyrics, every time. Same day, shipped
and APPLIED:

- **The refiner ran the catalog**: 48 tracks, 47 improved, 0 failures.
  Median onset error **85 ms → 46 ms** (mean 111 → 68 ms, excluding the
  broken-clock pair), and the **clump ratio hit 0.00 on every track** —
  the flagged-11 arbitration, automated and done. All 47 applied to
  production (source `aligned-refined`, previous timings journaled to
  refine-backup.jsonl). The site reads timings live from Supabase, so
  the improvement was audience-visible the moment it landed.
- **The two pulled songs, finally diagnosed**: music-is-my-drug and
  one-more-breath sit at 2.1–2.5 s mean onset error — wrong clock
  entirely, beyond any snap. With the three ~0.4 s whisper-era stragglers
  they form the re-align list.
- **The aligner lives again**: ~/whisper-venv rebuilt (torch cu128 +
  qwen-asr, RTX 5060 Ti, cuda:true verified) — the OS reinstall had
  killed it. Re-aligning the worst-5 and Tier B are unblocked.

Next for "perfect, every time": re-align the worst-5 against the cached
lead stems, then wire refine+score+gate into song onboarding so no track
can ever ship unmeasured.

---

## 2026-07-14 (IX) — The studio opens to everyone

Second owner's call, minutes after the password door shipped: "hell yeah
lets open it." The velvet rope came off — /studio left the proxy gate
entirely (the password code lived for one commit; honest history). Safe
because everything on the page is client-side and per-visitor (looks and
shaders in the visitor's own localStorage; drafts host-gated inside the
page), while the WRITE APIs stay tailnet-only, same as always. The DIRECT
rails hide below md so phones get the clean SHOW view.

Signage: /music's hero grew "🎛 The Studio — direct the shows yourself";
the Kinetica demo landing grew a "want the full instrument?" card linking
x1c7.com/studio. Verified under VERCEL=1: /studio serves the real page
(no unlock form), /api/studio still 404s, the /music link renders.

---

## 2026-07-14 (VIII) — The studio gets a public door (owner's call)

The owner wants the studio ON the live site. The proxy grew a password
door for public hosts: `STUDIO_KEY` env → a house-styled unlock form
(no-JS, noindex) → correct key sets an HttpOnly/Secure cookie (SHA-256 of
the key, scoped to /studio, 30 days). Wrong key = 401 "that's not it".
No STUDIO_KEY configured = fail closed (redirect home, exactly as
before). The tailnet passes untouched, and the WRITE APIs (/api/studio,
/api/feed, /api/import) remain tailnet-only — the password opens the
instrument, never the pipelines.

Verified with VERCEL=1 simulation: form 200 → wrong 401 → right 303 +
cookie → studio 200 → APIs still 404. TO GO LIVE: set STUDIO_KEY in the
Vercel project env and redeploy. Also restarted prime's x1c7.service onto
today's build (it had been serving yesterday's — the tailnet studio at
http://100.96.211.44:7272/studio now carries the full instrument; the
tailscale-serve HTTPS root belongs to nexus on :8787, untouched).

---

## 2026-07-14 (VII) — The Shader SDK: Kinetica becomes a platform

PRISM's v0.10 move, made against OUR contract: drop a `.frag` fragment-
shader BODY into the studio's scenes rail (＋ .FRAG) and it becomes a live
backdrop scene — with uniforms his SDK can't offer: real stem envelopes
(uVoice IS the voice), the riser charge, the active word's position, the
song's key (`keyColor()`).

- `// @name` names the scene; `// @param key min max default` registers a
  float as `cscene.<slug>.<key>` — instantly a slider in the param panel,
  look-captured, modulation-targetable. Uniform declarations are prepended
  automatically (`warp` → `uWarp`).
- Compile errors surface with the line-numbered listing IN the rail, and a
  bad shader is rejected BEFORE persist. Scenes persist per browser
  (localStorage), hot-replace by @name, restore on every backdrop mount —
  and a scene that stops compiling after an engine change is dropped with
  a console warning, never a dead show.
- Custom scenes are pinnable and join the scenes rail (⌁ mark, right-click
  removes); the AUTO deck rotation stays over the built-ins so every
  song's deterministic world is stable no matter how many scenes load.
  Renderer refactored to dynamic sceneDefs (add/remove/hot-replace).

**Verified headless**: PULSE RINGS (a test scene using uBeatPhase, uVoice,
uKick, uCharge, keyColor + an @param) mounted, its param registered,
pinned and RENDERING (screenshot); the deliberately broken shader came
back with "ERROR: 0:37: 'oops_undefined' : undeclared identifier" and was
not persisted; a full page reload restored the scene from localStorage.
Zero page errors.

---

## 2026-07-14 (VI) — Automation: the third modulator remembers

PRISM's automation.js, ported whole (`src/lib/engine/automation.ts`,
synced): arm Record → the take starts ON THE NEXT BAR of the measured grid
(immediately when no grid) → ride any sliders → when the loop length
elapses (1/2/4/8 bars), recording stops and playback loops automatically
through the registry's 'auto' modulation channel — stacking with LFOs and
stem-follows, base values untouched, releasing cleanly on clear. On a
stems planet the loop is phase-locked to the real bars forever.

The trilogy is complete: LFOs oscillate, stem-follows listen, automation
REMEMBERS. The studio deck strip grew the transport — ● REC (shows
"on the bar" while waiting, pulses through the take), loop length,
▶ lanes counter, ✕ clear. The AUTOMATION group joined looks.ts's NON_LOOK
fence on day one (arm/play/length are transport, not aesthetics — PRISM
v0.19's exact bug class, pre-fenced).

**Verified headless on the real 86 BPM grid**: arm → `waiting` →
`recording` through a simulated slider ride → auto-play with 1 lane → the
'auto' offset breathed through the recorded curve (.069→.198→.113,
looping) while the base sat untouched at .05 → clear released to 0.
Zero page errors.

---

## 2026-07-14 (V) — UI overhaul phases 3–5: the public face joins the instrument

**Phase 3 — the Show HUD** (single revertible commit): the /music takeover
chrome became the instrument bar — identity, mode+phase as one segmented
control, LIVE MEASURED TELEMETRY on md+ (real BPM, section tier, a beat
light on the actual kick), STEMS on plasma / REACTOR on signal, transport
on instrument surfaces. Verified live: 112.3 BPM · PEAK on a real show.

**Phase 4 — channel strips**: the mixer's band row became an instrument —
per-stem LIVE MEASURED METERS (offline envelope × the listener's mix),
M mute / S solo (solo is NEW for this panel; only the Lens could before),
◉ X-RAY badge lighting when the backdrop surfaces the soloed instrument.
Presets and the Lens kept their soul.

**Phase 5 — the manners pass**: site-wide `:focus-visible` ring (plasma,
2px offset); M/S hit targets ≥20px; and the `?` help done the HOUSE way —
instead of a second card, the existing KeyboardHelp grew a "During the
show" section (gated on the cinematic-on body class) and FINALLY listens
to `x1c7-close-overlay`, so "Esc: close overlay" is true of the card
itself. One real bug fixed en route: Esc was closing the help card AND
the show beneath it — the site's bubble handler closes the card and React
flushes at the microtask checkpoint BETWEEN window listeners, so the
takeover's guard read help-open as already gone. The takeover's key
listener now runs in the CAPTURE phase and reads the state as it was when
the key was pressed. Verified: ? opens one unified card with the show
vocabulary, first Esc closes only the card, second Esc closes the show.

All five phases of the approved UI plan are now live. Phases 3–5 touch
app-side files only — no engine sync needed.

---

## 2026-07-14 (IV) — UI overhaul phases 1–2: the Studio becomes the instrument

The owner greenlit the full five-phase UI plan (PRISM's architecture,
x1c7's skin — proposal artifact with mockups reviewed first).

**Phase 1 — the foundation:** instrument tokens in globals (three-tier
surfaces, plasma=machine / signal=song semantic axis, micro/body/readout
scale) + `KineticParamPanel` (engine, synced) — PRISM's ui.js in React:
registry groups render themselves as sliders with live readouts, an amber
modulation ribbon when an LFO/follow rides the value, locks, ☆ pins
(persisted), bool chips, selects, collapsible groups. One P.register()
anywhere → a finished control. Verified: 29 rows self-built, two-way
binding (first probe confounded by chorus memory re-morphing the test
param), ribbon live on the LFO'd hue.

**Phase 2 — the flagship:** /studio rebuilt as the instrument. SHOW /
DIRECT / SETUP workspaces (persisted); top bar carries `KineticTelemetry`
(engine, synced): real BPM off the grid, detected key, section tier, DROP
IN countdown, a beat light on the actual kick. DIRECT: looks as a pad
grid (fire = one-bar morph, right-click deletes, ＋ captures), scenes rail
with AUTO + pin and LIVE A/B deck chips (via new `deckInfo()` accessor —
a pure peek that never advances the fade), the param panel down the right,
and the deck strip along the bottom (swatches, live mix bar, fade-beats
slider). SETUP holds song/pass/view. Embed/draft/autoplay flows unchanged.

**Verified end-to-end headless** (autoplay-enabled Chromium actually
LAUNCHED Light It Myself): telemetry read the real song — 112.3 BPM,
B MAJ, PEAK, drop in 91 beats — scene rail showed INK on deck A / EMBERS
on deck B, panel + pads + strip all live. The run also surfaced a latent
crash: a section WITHOUT a colorHint blew up deriveTheme's normalizeHex
(`undefined.trim()`) when the quantized grade fired — hardened at the
source in theme.ts (not-a-string → "" → clean fallback), zero errors on
re-run. Kinetica gets the fix via sync.

---

## 2026-07-14 (III) — /engine: the showroom

One public page organizing everything the Prism integration shipped —
"THE SHOW LEARNED TO HEAR ITSELF." Four movements (The Words / The Field /
The Instrument / The Foundation), a card per feature with a "see it"
pointer, hero links to a reference song, /music, and the Kinetica demo,
PRISM credited in the hero, a dedication to Charles in the footer. Static,
house style, single isolated commit for easy revert.

---

## 2026-07-14 (II) — The looks picker: the engine work becomes touchable

`KineticLooksPanel` (engine component, synced): a glass card in the house
language — fire a look with one click (it morphs in over ONE BAR of the
real grid), ＋ SAVE captures the current control surface under a typed
name, ⤓/⤒ export/import packs, right-click deletes a user look. Thin skin
over looks.ts; the controller fence and migrations live there.

Mounted in **/studio** (owner) — and the studio finally caught up with the
engine: PASSES now go to 6 (4 = living backdrop, 5 = cinematic — the new
default, 6 = dynamic+); it had been capped at 3 since before the backdrop
existed, which silently hid ALL the Prism-integration work from the studio.
Also mountable on the perf harness via `&looks=1`.

**Verified headless**: chips render (3 built-ins + controls), clicking
NOCTURNE morphed `backdrop.trails` 0.47 → 0.82 over the bar, the save flow
produced a MIDNIGHT TEST chip, screenshot confirms the house styling.

**#418 mystery closed**: it fired in dynamic mode with `&looks=1` — proof
the hydration warning is the harness page's param-driven markup vs its
static prerender (any non-default param), NOT the engine. Documented as
harness-only in PRISM-INTEGRATION.md.

---

## 2026-07-14 — Looks: the show's memory (presets with the controller fence)

`src/lib/engine/looks.ts` (synced): capture the current control surface as
a named look, fire it back morphed over a musical duration, export/import
packs. PRISM v0.19's hard-won law is enforced from day one, on BOTH sides:
a look stores the aesthetic (backdrop grade/FX, modulation routings) and is
filtered on capture AND on fire — so even a hand-edited or foreign pack
can't switch the backdrop off or touch a controller. Files are versioned
with a migrate chain (PRISM's migrate.js pattern), so today's packs survive
every future schema change; a file from a NEWER build fails honestly.
Built-ins: NOCTURNE (dim, long trails), FESTIVAL (bright, fast, bloomed),
NEWSPRINT (desaturated grain). `KINETICA.looks` drives it from the console;
the Studio picker UI is the natural next step.

**Verified** (single Playwright pass, zero errors): built-ins list; firing
NOCTURNE morphs trails 0.46→0.82 + vignette to 0.62; the fence strips
`backdrop.enabled=false` from a hostile look while applying its grain;
capture→tweak→refire round-trips hueShift exactly; export→remove→import
restores the look. Also: session pushed — x1c7 main → Vercel, and
kinetica's engine-sync-prism merged to main → GitHub Pages (the public
demo now carries the full Prism-integration engine).

---

## 2026-07-13 (VIII) — Key & mode awareness: the field sits in the song's key

The harmony story melody-sense started, completed backdrop-side:

- The feature bus carries `keyPc`/`keyMode` from melody.json. **Race found
  and fixed**: stems and melody load concurrently, and `setSong`'s reset
  (re-run when stems resolve) wiped the key the earlier melody fetch had
  declared — the key is now re-asserted in the same effect, keyed on both.
- Scenes gained `keyColor()` — the tonic's hue, byte-identical to the hue
  melody-sense words wear on the tonic — used where each scene *sings*:
  AURORA's lead curtain, EMBERS' pre-drop heart, INK's choir sheen. Field
  accents and word colors are now literally the same note.
- The finishing pass grades by MODE: major lifts the light ~3%, minor cools
  the shadows toward blue — a feeling, not a filter. Unknown key touches
  nothing.

**Verified A/B on the harness**: `melody=1` → bus reads keyPc 10 / keyMode 1
(the test song's A# minor exactly); `melody=0` → −1/−1 and the grade path
stays inert. Zero console errors. With 43 songs' melody.json live on R2,
this is live-audience-visible immediately.

---

## 2026-07-13 (VII) — A/B section decks: the world changes with the song's structure

PRISM's center of gravity — two decks and a crossfader — turned toward
meaning: the backdrop now runs **two live generative scenes**, and the
song's own sections drive the fader.

- Each section emotion owns a **scene** via the same `hash(song, emotion)`
  determinism as the chorus-memory look — so a returning chorus brings back
  its *world*, not just its grade. Verse in the INK tide, chorus in the
  EMBERS nebula, forever, per song.
- A section change arms deck B; the crossfade starts **on the next bar line
  of the measured grid** and rides `backdrop.fadeBeats` (default 8, ~2 bars)
  on a smoothstep — PRISM's quantized auto-fade with the song's structure
  for hands.
- Craft edges handled: a mid-fade redirect lands the old target first; the
  completed fade lands deck B as deck A **on the same frame** (the mix
  advances before the deck index is read — no one-frame flash of the old
  scene); a backward scrub re-arms the bar line at the listener's position
  instead of stalling (found by the harness's looping clock — its wrap IS a
  scrub); pinning `backdrop.scene` disables the decks.

**Verified** on the 86.13 BPM test grid: arm on a section emotion → fade
scheduled exactly at the next bar (startBeat 8 from totalBeats 6.1) → mixes
through mid-fade with deck A still authoritative → sceneIdx lands the
target and the fade retires. Zero console errors. `window.KINETICA` gained
`backdrop` (the renderer) for console driving.

---

## 2026-07-13 (VI) — Stem X-ray: the Lens gets a visual soul

Two halves, both engine-side (synced):

- **The feature bus honors the live mixer.** Every stem envelope is now
  multiplied by `stemMixStore.visualGain` (solo-aware, 1 while the mp3
  plays) — so muting an instrument takes its visuals with it EVERYWHERE:
  backdrop scenes stop reacting to it, stem-follow modulators go quiet,
  the X-ray reads honest numbers. Verified: soloing LEAD collapsed the
  bus's `bed` 0.81 → 0 while `voice` kept tracking the real vocal
  envelope through its phrases and breaths (0.75–0.8 ↔ 0).
- **The X-ray anatomy pass.** When the Lens solos a stem, a dedicated
  backdrop pass surfaces that family's anatomy — DRUMS strike expanding
  impact rings on the beat phase (kicks flash the core), BASS stands a
  slow heavy wave, VOICE breathes radiance around the active lyric, CHOIR
  raises twin halos, BED drifts chord curtains. One shader, five families,
  colored from the song's palette; `backdrop.xray` sets the strength and
  the amount eases in/out so engaging the Lens feels like focusing an
  instrument, not flipping a switch. The family holds through the fade-out
  so the anatomy never flips mid-dissolve.

No UI work needed — the existing mixer/Lens drives it through the store.
`window.KINETICA` now exposes `stemMixStore` for console play. (Melody
publish to R2 was attempted per the owner's go-ahead but held by the
permission gate — the owner runs
`node scripts/stem-analysis/melody-batch.mjs --publish` directly.)

---

## 2026-07-13 (V) — Melody batch: the whole catalog analyzed, rollout is one command

`melody-batch.mjs` ran the melody analyzer across every live track with
timed words + a published lead stem — **47 candidates, 43 pass, 4 flagged,
0 failures**. Design decisions that mattered:

- **Live words from Supabase**, never local aligned.json — the QA-flagged
  aligner tracks kept whisper timings in production, and melody indices
  must match what actually plays.
- **Diatonic-ratio QA gate** (share of pitched words in the detected key's
  scale, minor admits the raised 7th): real melodies score 0.76–1.0
  (summer-drip and push-it-on-me hit a perfect 1.0); the gate flagged
  exactly the right four — i-said-no (0.12 coverage, spoken delivery),
  membrane-still-insane (0.20), one-tap-away-riverboat-remix (0.21), and
  amor-de-verdad at 0.74, a hair under the 0.75 bar.
- Analysis-only by default; `--publish` rclones ONLY passing melody.json
  files to `planets/<slug>/melody.json` (the engine loads that convention
  path — zero DB changes). Full table:
  `scripts/stem-analysis/out/melody-report.json` (out/ is gitignored; it
  caches ~6 MB of lead-stem audio per song).

**Rollout: PUBLISHED (owner-run, same day).** All 43 passing melody.json
files live on R2 (`planets/<slug>/melody.json`, spot-verified: light-it-
myself B major/494 words, summer-drip, under-the-elevated) — pitch-colored
words, note-hued ghosts, and melody motion are now live on x1c7.com for
every passing song, no deploy needed (the engine loads the convention path
at runtime). The first attempt failed 43/43 with `spawnSync rclone ENOENT`:
**rclone died in the OS reinstall** — reinstalled as a static binary at
`~/.local/bin/rclone` (survives the next reinstall), the script now falls
back to that path, and a publish failure marks the row `publish-error`
instead of appending a duplicate.

---

## 2026-07-13 (IV) — Melody motion: the words move with the melodic line

melody.json already carried `midi` per word — now it drives motion, not just
color. `melodicMotion()` (engine, `melody.ts`) reads each word's interval
from the previous pitched word and to the next:

- **Entrances follow the line**: a rising interval lifts the word into place
  from below (~5.5px per semitone, capped ±64px), a falling one sinks it in
  from above. Composes OVER the section-emotion motion (spread-merge of the
  framer variant), so a "shatter" section still shatters — it just shatters
  from the melody's direction.
- **Exits lead the ear**: the word leaves toward where the melody goes NEXT
  (the interval to the next pitched word, inverted — rising next note pulls
  the outgoing word upward).
- **Octave nuance**: height above/below the singer's home register
  (`medianMidi`) scales dynamic word size ±8%.
- Unpitched/low-confidence words keep the stock motion exactly.

**Verified A/B on the harness** (focus mode isolates the outer motion):
control run = constant 12px entrance on every word (stock FOCUS_IN); melody
run = interval-sized entrances (23px on a ~4-semitone leap, baseline
elsewhere). The probe needed two fixes worth remembering: sample the LAST
`.kinetic-word` (AnimatePresence keeps the exiting word first in DOM order)
and poll at rAF speed (entrances are 300ms).

**Also:** hardened the active word's `style` prop to stay `undefined` when
empty (hydration hygiene), and logged a **pre-existing** React #418
hydration warning on `/dev/perf` focus mode (fires with melody off too;
dynamic mode clean) — parked as a known issue in PRISM-INTEGRATION.md.

---

## 2026-07-13 (III) — Melody sense: every word wears the note it was sung on

The feature nobody has: word timings (the forced aligner) × the isolated
lead vocal (Suno stems) = **per-word sung pitch**, computed offline, worn as
color at show time. PRISM can detect a key live; it can never know which
*word* carried which *note*.

**Analyzer (`scripts/stem-analysis/analyze_melody.py`, `~/librosa-venv` —
recreated, the old analysis env died in the OS reinstall):**
- pYIN pitch track on the lead stem (ffmpeg-decoded — the libsndfile
  truncation trap from ALIGNMENT.md applies here too), median voiced f0 per
  aligned word window on the stem clock (`align.lag` honored), K-S key
  detection, confidence = voiced fraction × mean voicing probability.
- Output `melody.json v1 { key, words:[{i,t,midi,pc,conf}] }` — third leg of
  the measured-hearing stack (rhythm = analyze_stems, mix = analyze_audio,
  **melody = this**).
- Validated on i-won-t-be-your-fire: **A# minor** (r=0.76), 335/641 words
  pitched, pitch-class histogram almost perfectly diatonic — A# (tonic) 194,
  F# 53, B 34, G# 30, C# 19, non-scale notes ≤2 each. That's the real melody.

**Engine (`src/lib/engine/melody.ts` + stage wiring, synced to Kinetica):**
- **Harmonic hue mapping**, not chromatic: the tonic wears the theme's own
  hue; every other note sits at its circle-of-fifths distance mapped onto
  ±80° — close harmony = close color, the tritone strains hardest. So the
  colors are always *of the song's palette family*, never random rainbow.
- Active words wear their note's color (confidence ≥0.35; charged words
  keep the accent; unpitched words unchanged). Phrase mode's active word
  rides the same color. **Word ghosts inherit the hue** — the field slowly
  becomes a painting of the melody as lines dissolve into it.
- Loads via `planet.assets.melody` (explicit) or `planets/<id>/melody.json`
  (convention). Absent → nothing changes. Harness: `/dev/perf?melody=1`
  (fixture: `public/planets/i-won-t-be-your-fire/melody.json`).

**Verified:** Playwright watched word colors across 20 word changes — three
distinct computed colors (two pitch hues + the accent fallback), and the
ghost-field screenshot shows the harmonic spread (red/violet/periwinkle/
peach per word) where the pre-melody build alternated two palette colors.
Zero console errors; both builds clean.

**Logged for later (new ideas from this work):** melody *motion* (rising
lines lift entrances, falls sink them — `midi` is already in the data),
octave → weight, `uKeyHue` so the backdrop itself sits in the song's key.

---

## 2026-07-13 (II) — The Prism integration: engine core · living backdrop · word ghosts

Charles opened his PRISM repo (rockinthiscity/prism — a browser WebGL2 VJ
platform, studied end to end this session) and gave the green light to adopt
its ideas. The strategic read that shaped everything: **PRISM guesses the
present live (FFT, beat tracker, HPSS stem approximation); Kinetica knows
the future offline (real Suno stems, word timings, baked sections).** So we
ported his *infrastructure*, fed it ground truth he can't have, and pointed
it at emotion instead of math. Full study, contracts, and the 32-idea
backlog: [`PRISM-INTEGRATION.md`](./PRISM-INTEGRATION.md).

**New engine core (`src/lib/engine/`, all synced to Kinetica, 0 coupling):**
- **Param registry** (PRISM's keystone): register once → morphable,
  preset-able, lockable, modulation-targetable. Base vs modulation layers.
- **Feature bus**: per-frame snapshot fed by measured stems — real per-stem
  envelopes, transport walked along the real beat grid, riser charge,
  LOW/MID/PEAK tier, active-word screen position, and `beatsToDrop` — a
  countdown to the next drop no live tool can have.
- **Modulators**: 3 beat-synced LFOs + 3 stem-follows (a real instrument
  riding any param — PRISM's roadmap item, trivial here). LFO 1 on by
  default: 4-bar sine drifting backdrop hue.
- **The living backdrop**: WebGL2 canvas at -z-20 under the Ken-Burns art —
  scene → feedback trails → finishing pass. Three generative scenes
  (AURORA / EMBERS / INK), seeded per song, painted in the song's palette,
  leaning toward the active lyric (`uWord`). Fails dark on any GL error.
  `window.KINETICA = { P, featureBus }` for console tinkering.

**The showpieces:**
- **Anticipation** — over the last 16 beats before a measured drop the
  vignette closes, color drains, and the field's time slows ~35%; the drop
  itself is the release. PRISM reacts to drops; Kinetica *dreads* them.
- **Quantized grades** — section color-grade/camera/shockwave land on the
  next bar line of the real grid, not the LLM's approximate stamp.
- **Chorus memory** — every section emotion owns a deterministic look
  (hash(song, emotion) → hue/flow/trails/bloom) morphing in over one bar;
  the chorus always comes back wearing its own colors.
- **Word ghosts** — a dying word is stamped once into a dedicated buffer
  that decays and drifts upward: lyrics dissolve into the atmosphere
  (skipped in phrase mode, where the line never leaves the stage).

**Bugs the verification caught (Playwright driving /dev/perf headless):**
- `canvas` is a replaced element — `fixed inset-0` didn't stretch it and a
  ResizeObserver feedback loop locked it at ~290×146. `w-full h-full`.
- The measured grid starts at the first drum beat, so drum-less intros froze
  the transport (LFOs parked, quantized actions hung ~20s). The grid now
  extrapolates at edge tempo — beats are negative before the first kick, and
  the fix showed immediately: the LFO's hue mod went from a frozen 0 to a
  live −0.072.

**Verified:** grid locks at 86.13 BPM on the restored test stems
(`public/planets/i-won-t-be-your-fire/stems.json` — the `/dev/perf?stems=1`
flag had been silently 404ing since the storage reorg), `beatsToDrop` counts
15.1 → 7.0 into the real drop at 22.06s, chorus-memory morph lands
(trails 0.5 → 0.65), and the ghost screenshot shows RISES/WATER/WHILE
dissolving in palette colors behind the live word. Both builds clean; sync
dry-run: 6 new engine files, 0 warnings (apply to Kinetica pending).

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
