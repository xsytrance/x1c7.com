# Session handoff — the Kinetica cut run, 2026-09-15 → 17

Written so the next session can pick this up cold. The *lessons* live in
`docs/VIDEO-RENDER-PLAYBOOK.md` §23–§26 and in
`.claude/skills/kinetica-video-cut/SKILL.md` (Steps 0, 3f–3l). This file is
only the STATE: what shipped, what is live, and what is next.

## Shipped and live on R2

All 9:16 master quality, published with `scripts/clip/publish-cut.mjs`.
Base: `https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev/cuts/<id>/<name>.mp4`

| cut | id | track row | window |
| --- | --- | --- | --- |
| International Mode — THE GOLDEN ATLAS | `2045210b7181` | `international-mode-atlas` | 0.00–62.40 |
| Hajimemashite v4 (world-led) | `3577e975406b` | `hajimemashite-v4` | 97.60–157.55 |
| **Hajimemashite v5 — the one he kept** | `bb90c9262b86` | `hajimemashite-v5` | 97.60–157.55 |
| Drink Drink v2 — THE LAST POUR | `bf3c9102d321` | `drink-drink-v2` | 190.00–250.00 |
| Summer Drip v2 — THE HAMPTONS SESSIONS | `d9c2cc489314` | `summer-drip-v2` | 0.00–60.00 |

Deleted deliberately: the rejected first Golden Atlas cut (`845f2cf00362`) and
`planets/summer-drip-v2/scene-smile.webp`. A rejected picture stops existing.

## Next up: Honey & Venom — blocked on stems only

**Ask which song.** Two share the name and neither has ever been cut:

* `honey-n-venom-rude-wine-riddim` — "Honey N Venom (Rude Wine Riddim)", 3:21, 495 stamps
* `heaven-hell-honey-venom-remix` — "Heaven & Hell (Honey & Venom Remix)", 3:42, 428 stamps

Both alignments look sane (no collapsed timestamps, unlike drink-drink). Neither
has stems in `assets/stems/`. **Before asking for stems, test ASR on the full
mix** — Summer Drip needed none because the lead sits forward; drink-drink did,
because its pitched chant is inaudible to ASR. Thirty seconds of testing decides.

Drop point when he sends them: `assets/stems/<Exact Suno Title> Stems.zip`.
He is often away from the machine — a Google Drive share link works, pulled with
`curl -sL "https://drive.google.com/uc?export=download&id=<ID>"`. The MCP Drive
connector CANNOT do this (it returns base64 into context).

## Engine changes this run (all backwards-compatible)

`src/components/KineticStage.tsx`, `KineticBackdrop.tsx`, `src/lib/planet.ts`,
`src/lib/engine/melody.ts`, `src/lib/effects/registry.ts`.

New deck knobs — every one defaults to the old behaviour, so no shipped cut
moved: `giant.stutter`, `giant.stutterLayout` (scatter/pour/trail),
`giant.stutterEmit`, `choir`, `ghosts`, `pitchSpread`, `weather`, and
`dynamicPlus.quakes`. Two new text effects, `heathaze` and `screw`.

Three real bug fixes: `measureAdvance()` (a 13-letter word was drawing at a
third of the frame off a hard-coded glyph advance), a cover guard in
`motionShot` (a scale-1.00 pan walked plates off their own edge), and the
`deriveTheme`/`palette[0]` colour traps documented in §24.

## Still a generation behind

`say-it-with-your-body` (6 revisions), `cocktails-and-code`, `fast-enough` all
still run the old phrase-mode text wall. Their art exists, so re-cuts would be
text-and-timing only. Most finished videos on disk are NOT on R2 — only the five
above plus days-drift-by, forged-above-gold and different-this-summer-debut.

## Box state worth knowing

`~/.bfl_key` is gone — the Flux Kontext key is `AIMLAPI_KEY` in
`~/.config/ossicle/aimlapi.env`. PIL and torch are not in system python; use
`~/whisper-venv/bin/python` (has Pillow, onnx-asr, faster-whisper). The 2026-08
portrait scripts still point at the old key path and will exit on it.
