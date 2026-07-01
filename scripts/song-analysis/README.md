# Song Analysis (the "Planet" brain)

Feeds a song's lyrics to a **local (or any OpenAI-ish) LLM** and gets structured
meaning back — the song's **planet**: summary, mood, themes, palette, **per-section
emotion + intensity + color**, and **keyword imagery prompts** (for future art gen).
Section emotions are attached to real **start times** parsed from the LRC lyrics, so
the engine can shift with the song's emotional arc.

## Run (uses your local Ollama by default)
```bash
node analyze.mjs --in tracks.json --out planets.json \
  --model qwen2.5:14b --host http://localhost:11434
```
- Input: `[{ id, title, artist, genre, mood, lyrics }]` (lyrics = LRC preferred, so
  section start-times can be parsed).
- Output: `[{ id, planet: { analysis, generatedAt }, ok, error }]` + a `.raw.json` dump.
- Apply `planet` to `tracks.planet` via the Supabase MCP/dashboard (writes are
  RLS-gated; no service-role key in the repo).

## Model notes
- **`qwen2.5:14b`** works well (clean JSON, no "thinking" channel). ~15–30s/song on GPU.
- Avoid "thinking" models (e.g. gemma-thinking) with JSON mode — the grammar makes them
  loop and return empty content (`done_reason: length`).
- Colors are normalized to `#RRGGBB`; sections/keywords are coerced from object-keyed
  shapes some models emit.

## Where it plugs in
`tracks.planet` → `Track.planet` (`src/lib/planet.ts`) → `/studio` reads it: shows mood +
themes, and the live per-section **emotion** whose **intensity** drives the Kinetic glow
(`--emo`). Next: emotion → palette/effect selection, and `imageryPrompt` → generated art.

This is the LLM brain of the larger lyric-video engine (provider-swappable: local Ollama
today, cloud/BYOK later).
