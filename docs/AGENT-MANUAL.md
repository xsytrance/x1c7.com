# AGENT MANUAL — making directed music clips in this repo

You are an agent asked to produce a **directed Kinetica clip** for one of
AGENOR's songs: a 16:9 + native 9:16 pair, machine-verified A/V sync, per-song
art voice, delivered as share-ready mp4s. Seven-plus cuts have shipped through
this exact pipeline. **Do not improvise a new workflow — follow this one.**
Deep rationale for every rule lives in `docs/VIDEO-RENDER-PLAYBOOK.md`
(read it once before your first cut). This manual is the operating procedure.

## The owner's standing laws (violating these = redo)

1. **Both aspects, always.** 16:9 master + NATIVE 9:16 re-record. Never crop.
2. **Illustrate the scene.** Art depicts each lyric line's literal narrative.
   Re-read the lyrics before art-directing. Not word-matched decoration.
3. **Own planet per song.** Every song gets a DISTINCT art voice. Voices used
   so far are logged in the memory file `summer-drip-directed-cut.md` and in
   each song's `scripts/song-art/*` script. Songs in the same "orbit" (e.g.
   the NYC Nebula) may share family vibes — still distinct.
4. **Eyes on output.** Before delivering, extract frames from the ACTUAL share
   files and look at them: count the people, read the letters, check every
   constraint the owner stated. Sync VERIFY numbers never prove looks.
5. **People in art**: unless directed otherwise — exactly the people the
   scene needs (usually one man + one woman for romance songs, never a
   surprise third), silhouette/fully-clothed, no lit skin, warm not creepy.
6. **Suno hooks**: scan the window's lyrics AND art for suggestive content
   first (Suno rejected one hook already). Loyalty/clean sections win.

## Environment (what must be running)

| thing | where | check |
|---|---|---|
| x1c7 dev server (current code) | `npx next dev -p 3218` | `curl -s localhost:3218/studio -o /dev/null -w "%{http_code}"` → 200 |
| ComfyUI (SDXL Turbo) | `localhost:8188` | used by scene-gen |
| Supabase MCP | `mcp__claude_ai_Supabase__execute_sql`, project `kxbrjmbovjiwwcnepsfh` | the documented write path for `tracks` |
| R2 creds | repo `.env` (ACCESS_KEY_ID / SECRET_ACCESS_KEY / ENDPOINT / BUCKET) | used by publish tools |
| GPU | RTX 5060 Ti via headless Vulkan | render-cut handles it |

**Never render against `:7272`** (stale prod build). **Always run repo tools
from the repo root** — cwd drift breaks relative paths (a background render
died to this).

## The pipeline, in order

### 0 · Understand the ask
Window length (30s/45s/60s), which section (find the lyric the owner quoted),
art direction keywords, destination (Suno hook? IG?). If the owner named a
vibe, that IS the voice brief.

### 1 · Pre-flight the profile (`scripts/song-analysis/profiles/<slug>/`)
- `release.mp3` missing? List R2 (`rclone lsf R2:$BUCKET/music/` — filenames
  have smart quotes; NEVER guess) and `rclone copyto` it in.
- Stem-truncation check: `senses.json` → is `beats[-1]` ≪ `duration`? If yes,
  re-analyze: `node scripts/song-analysis/ultimate.mjs --audio <profile>/release.mp3
  --id <slug> --out scripts/song-analysis/profiles/<slug> --model qwen3:14b
  --skip-vision` (it IGNORES --track; without --id/--out it writes to
  `profiles/release/`). Then upload new senses to R2
  `planets/<slug>/stems/stems.json` (back up the old one first).

### 2 · Verify the window's lyrics (do this BEFORE art)
Query the window ±5s from Supabase:
```sql
select string_agg(format('%s:%s', w->>'t', w->>'w'), ' ' order by (w->>'t')::float)
from jsonb_array_elements((select lyrics_synced->'words' from tracks where id='<slug>')) w
where (w->>'t')::float between <from-5> and <to+5>;
```
Read it aloud against the official lyrics. Broken patterns you WILL find:
- **Repeated-line collapse**: identical chorus lines stacked on one timestamp
  (the LCS aligner's known failure). Rebuild the section by hand from
  `transcript.json` segment boundaries (words spread evenly inside each line).
- **Stage labels as words**: `(Female)`, `(Together)`, `(whisper)` etc. Purge
  song-wide.
- **Mistranscriptions**: whisper mishears ("Full send"→"Full sin", "Hold that
  crown"→"Or that clown"). Fix by word swap keeping times.
- **Held notes**: give the word its sung START time (the engine keeps it —
  see MAX_HOLD in the playbook).
Apply fixes via one `jsonb_set` UPDATE (pattern in playbook §2), mirror into
the profile's `aligned.json` (backup to `pre-refix-backup/` first).

### 3 · Art pass
1. Write a **spec** (style voice + per-line scenes; ~9-13 scenes: one per
   lyric line/beat in-window on sung anchor words ≥1s apart, plus 3-4 ambient
   scenes for `assets.sections` emotions).
2. Generate: `node scripts/clip/scene-gen.mjs --spec spec.json` (3 variants
   per scene; idempotent, retry-guarded).
3. **Audit with your eyes**: contact-sheet or read each candidate. Count
   people. Reject-and-re-roll or crop-a-clean-pair (tactics: playbook §3).
4. Publish picks:
   `node scripts/clip/publish-scenes.mjs --slug <slug> --map picks.json`
   — converts to webp, uploads to R2 `planets/<slug>/scene-<key>.webp`,
   **byte-verifies the edge**, prints the URLs for SQL.

### 4 · Wire the planet (Supabase `tracks.planet`, via MCP execute_sql)
One or two `jsonb_set` UPDATEs (exact patterns in playbook §4):
- `analysis.sections` — hand-crafted, intensities **≤0.71**.
- `analysis.palette` — 3 hex colors in the song's voice.
- `assets.keywords` — word → `/planets/<slug>/scene-<key>.webp`. REPLACE
  wholesale if old machine art exists (it's off-voice and will photobomb).
- `assets.sections` — emotion → ambient scene URL.
- `dynamicPlus` — `acts` (billing pills, honest labels), `modes` (the
  conductor: `dynamic` windows make words HUGE — use for hooks/responses/
  shoutouts; `phrase` for verse lines), `words` (word → FX id; full FX list
  in `src/lib/effects/registry.ts` — incl. quake/tilt/squeeze/cling),
  `deck` (`{"density":2.0,"glow":0.35}` = particle/glow boost).
- Kill traps: R2 `planets/<slug>/gallery.json` → upload
  `{"slug":"<slug>","model":"","art":{}}` (backup first);
  no `interactions.moments` overlapping the window.

### 5 · Render
```bash
node scripts/perf/render-cut.mjs --both --track <slug> --from <s> --to <s> \
  --base http://localhost:3218 \
  --out scripts/song-analysis/profiles/<slug>/<slug>-<name>.mp4
```
Runs headless on the GPU, supersampled 2×, pixel-clock stamped. Each aspect
ends with `VERIFY … ✓`. **If VERIFY flags above tolerance (>40ms p95),
re-run that aspect — trust the instrument.** Data changes need no server
restart; engine-code changes recompile on request.

### 6 · Share encodes + QA + deliver
```bash
node scripts/clip/share-encode.mjs \
  --in profiles/<slug>/<name>.mp4 --in profiles/<slug>/<name>-vertical.mp4 \
  --qa "1.5,8,15,22,28"
```
(native res, auto-fits under the 30 MiB upload cap, drops QA jpegs).
**Read every QA frame.** Check: right words at right moments, art firing per
keyword, act pills, letter crispness, people-count. Then deliver BOTH share
files — 9:16 first (the socials file), 16:9 second — with a caption saying
what's in the cut.

### 7 · Two clips → one video
```bash
node scripts/clip/merge-cuts.mjs --a first.mp4 --b second.mp4 \
  --out merged.mp4 --transition fadeblack --dur 0.9
```
Timestamps fully normalized + decode-checked (the naive xfade merge crashed
phone players). Then share-encode the merged master.

### 8 · Log what you learned
Append the cut + any new gotcha to the memory file
(`summer-drip-directed-cut.md`) and, if it's a new class of problem, to
`docs/VIDEO-RENDER-PLAYBOOK.md`. The next agent starts where you finished.

## Tool reference (`scripts/clip/`)

| tool | does | key flags |
|---|---|---|
| `scene-gen.mjs` | ComfyUI art pass from a JSON spec, idempotent + retries | `--spec spec.json` |
| `publish-scenes.mjs` | picks → webp → R2 → edge byte-verify | `--slug`, `--map picks.json` / `--pick k=img` |
| `share-encode.mjs` | masters → ≤30 MiB share mp4s + QA frames | `--in master.mp4`, `--qa "t1,t2"` |
| `merge-cuts.mjs` | crash-safe transition merge + decode check | `--a --b --out --transition --dur` |
| `../perf/render-cut.mjs` | THE renderer (pixel-clock, supersampled, VERIFY) | `--both --track --from --to --base --out`, `--shots N`, `--ss`, `--headful` |
| `../song-analysis/ultimate.mjs` | full re-analysis | `--audio --id --out --skip-vision` |

## Known failure modes (check here first)

| symptom | cause | fix |
|---|---|---|
| words scrambled / piled up on screen | repeated-line aligner collapse | rebuild section from transcript (§2) |
| a word appears seconds late | held note + old data, or MAX_HOLD class | fix word start; engine heuristic is now gated |
| random label like FEMALE on screen | stage directions in lyrics_synced | purge song-wide |
| old/off-style art photobombs | `gallery.json` pooled art or stale keywords | empty gallery, replace keywords |
| "shake" banner appears | a section intensity ≥0.72 | cap ≤0.71 |
| jagged text | supersampling off / share downscaled | `--ss 2` is default; shares at native res |
| render exits instantly, MODULE_NOT_FOUND | cwd drift | run from repo root |
| VERIFY p95 > 40ms | capture hitch | re-run that aspect |
| merged video crashes players | un-normalized xfade timestamps | use `merge-cuts.mjs` |
| ComfyUI "completed" with no image | scheduler hiccup under load | tools retry automatically |
| art has 3+ people / lit faces | SDXL can't count | close-up two-shot framing, crop-a-pair, shadow-crush (playbook §3) |

## Delivery etiquette

- Lead with what changed/what's in the cut, in plain sentences.
- 9:16 file first, then 16:9.
- If the owner gave feedback ("2 people only", "silhouettes", "huge words"),
  verify it frame-by-frame before re-delivering — they WILL check.
- Never commit/push unless the owner says so. Data changes (Supabase/R2) are
  live immediately and must be backed up to `pre-refix-backup/` first.
