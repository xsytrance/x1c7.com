# THE CURATOR — doctrine

The lexicon paints; the Curator decides **what deserves paint** and **which
paintings belong to which songs**. Three organs, all local (Ollama on
:11434 + ComfyUI on :8188 sharing one 16GB GPU via strict batch ordering
and `keep_alive: 0` unloads).

## 1. Word gravity — `scripts/curator/gravity.mjs`

Every lexicon word weighs 0..1. Facts first, model second:

```
score = 0.25·kw + 0.20·sent + 0.20·concrete + 0.15·idf + 0.10·freqNorm + 0.10·title
```

- `kw` — the word was picked as a keyword by any song's LLM analysis
  (the strongest signal: an analyst already chose it).
- `sent`/`concrete` — emotional charge and paintability; default 0.5 until
  a cached `qwen3:14b` grade replaces them (borderline 0.35–0.65 only,
  graded once, kept forever in `entry.gravity.llm`).
- `idf` — rarity across the catalog; `freqNorm` — log-scaled sung count;
  `title` — appears in a song title.
- **Seeds are law** (`gravity-seeds.mjs`): ~150 always-heavy words floor at
  0.75, ~120 always-light cap at 0.15. The LLM never overrides a human seed.

Tiers: **heavy ≥ 0.60** (6 images/sense) · **mid** (2) · **light < 0.35**
(0 — and pruned; see below). Consumers: `art.mjs` budgets + queue order,
`dream.mjs` priority, `/lexicon` + `/atelier` visibility (`?all=1` reveals).

**The prune** (`prune-light.mjs`, owner-gated `--apply`): light words' images
come off R2 + the shelf; every URL journaled first to `prune-journal.jsonl`.

## 2. Vision index — `scripts/curator/vision-worker.mjs`

`qwen3-vl:8b` reads every lexicon image once (webp → 672px JPEG → structured
JSON): caption, subjects, setting, mood, palette, style, symbols,
text-in-image, plus two self-QC scores — `quality` (render artifacts?) and
`wordMatch` (does it depict its word?). Cached forever in
`scripts/curator/vision-index.json`, published to R2 `lexicon-vision.json`.
Readings are embedded (`qwen3-embedding:0.6b`) into the gitignored
`.cache/embeddings.jsonl` for the matcher.

Quirk: some Ollama builds route a vision model's `format:"json"` output into
`message.thinking` with empty `content` — all curator readers accept both.

## 3. The matcher — `scripts/curator/match-reel.mjs --song <id> [--publish]`

Two stages, accuracy first:

- **Stage A (cosine)**: candidates = images owned by words the song actually
  sings (`lyrics_synced`) or its analysis keywords, gated on
  `quality ≥ 0.5 && wordMatch ≥ 0.5`. Per word, embed
  `word + its lyric line + song story/themes/mood` and keep the top 3 by
  cosine against the cached reading embeddings.
- **Stage B (the judge)**: `qwen3:14b` scores each survivor's READING —
  never pixels — against the song's story and the lyric line. A wrong
  reading that doesn't fit the song is *rejected*, not propagated: the
  text-only judge is the hallucination firewall. accept ≥ 0.55, featured
  ≥ 0.7, cap 32.

Output `planets/<id>/lexicon-reel.json`: ranked
`{img, word, line, t, score, cosine, reason, recipe, featured}` — `t` is the
word's first sung time, which is what lets the live show fire the right
picture at the right moment.

## Consumption

- **Dossier** (`/t/<slug>` → `SonicDossier.tsx`): "WHAT IT'S REALLY ABOUT"
  (the MEANING pass story + key lines) and "THE REEL" (top 12, featured ★).
- **Live show**: reel ghosting behind the `reel.enabled` param (NON_LOOK,
  default off) — a matched image breathes into the backdrop when its word
  is sung.
- **/atelier**: per-song filter via `entry.sources`.

## The MEANING pass (`ultimate.mjs`, step 7b)

One deep LLM read per song over the full lyrics: `analysis.meaning =
{story, sections[{name, interpretation, keyLine}], keyLines,
extendedKeywords}` — 12–20 heavy, sung, paintable words merged into
`analysis.keywords`. This is what harvest turns into lexicon senses, so a
song's true visual vocabulary reaches the shelf instead of six guesses.

## Nightly order (`grow-and-publish.sh`)

harvest → gravity (heuristic + 60 grades) → dream → publish → song-art
topup → Atelier (gravity budgets, 1200) → **vision-worker 400 → reel
refresh for every song with a reel** → feed worker. ComfyUI hogs first,
Ollama after, everything unloads.

## Thresholds (tune here, nowhere else)

| gate | value |
|---|---|
| heavy / light tier | ≥ 0.60 / < 0.35 |
| reading usable | quality ≥ 0.5, wordMatch ≥ 0.5 |
| reel accept / featured | ≥ 0.55 / ≥ 0.7 |
| low-quality cull flag | quality < 0.35 |
