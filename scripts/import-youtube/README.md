# YouTube → Private Planet

Turn any YouTube song into a full interactive planet — **for personal, local
listening only**. Nothing here is uploaded, published, or redistributed:

- Audio + cover are ripped to `public/private/` which is **gitignored** — they
  never reach the repo, Vercel, or R2. The files exist only on this machine.
- The DB row is `hidden = true`, so the public site never lists it.
- The app only *shows* private planets when running on **localhost**
  (`useTracks` widens its filter for `/private/` rows on local hostnames).
  On x1c7.com the row is invisible and the audio path wouldn't resolve anyway.

## Pipeline

```
yt-dlp rip ─→ demucs + Whisper large-v3 ─→ qwen research ─→ analyze.mjs ─→ choreography ─→ package
  (audio,      (transcribed lyrics with     (artist, genre,   (planet:        (tap effect,     (mp3 + jpg +
  thumbnail,    word timestamps — no         mood, style,      palette,        wipe/blow/       row.json +
  metadata)     lyric-site scraping)         section map)      keywords…)      shake moments)   row.sql)
```

No known lyrics needed — Whisper transcribes the vocals straight off the audio
and the timestamps come free. (If you *have* the official lyrics, forced
alignment gives cleaner text — paste them and use the align pipeline instead.)

## Run

```bash
node scripts/import-youtube/import.mjs \
  --url "https://www.youtube.com/watch?v=…" \
  --venv ~/path/to/whisper-venv        # needs: yt-dlp, stable-ts, faster-whisper, demucs
# optional: --id my-slug --lang es --no-demucs --workdir ./wd --model qwen2.5:14b
```

Then apply `wd/row.sql` (Supabase MCP or dashboard SQL editor), run
`npm run dev`, and the planet is in your local galaxy with the full show:
synced words, palette morph, tap effects, choreographed moments, beat game.

Requires locally: ffmpeg, Ollama with the model pulled, ~4 GB GPU (or CPU
fallback, slower).
