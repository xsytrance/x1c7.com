# Lyrics Auto-Sync (forced alignment)

Turn **song audio + plain lyrics** into **timed LRC** automatically — no manual tapping.
Output is written to Supabase `tracks.lyrics`, which the site's cinematic view plays as
synced karaoke. This is the alignment backbone for the larger lyric-video engine.

## How it works
Per track: download the MP3 → (optional) isolate the vocal with **Demucs** →
**forced-align** the known lyric lines to the audio with **stable-ts** (Whisper) →
line start-times become `[mm:ss.xx]` LRC prefixes; word times are captured too
(for future word-level karaoke). Your lyrics are ground truth — the model only
supplies *timing*, so wording is never altered.

## Setup (one-time)
```bash
python3 -m venv venv && source venv/bin/activate
pip install --upgrade pip wheel
# GPU (RTX 50xx / Blackwell): cu128. CPU-only: skip the --index-url line.
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
pip install -r requirements.txt
```

## Run
Input JSON — one object per track:
```json
[{ "id": "my-track-id", "audio_url": "https://.../song.mp3", "lyrics": "line one\nline two\n...", "language": "en" }]
```
```bash
python align_lyrics.py --in tracks.json --out results.json
# flags: --model large-v3 | --device cpu | --compute-type int8 | --no-demucs
```
Output `results.json` — per track: `lrc`, `words[{t,text}]`, `language`, `n_lines`,
`n_timed`, `ok`, `error`. It checkpoints after every track (safe to resume).

## Notes
- **Section markers** (`[Chorus]`, `[Male]`, blank lines) are passed through untimed —
  the site renders them as dim labels.
- **GPU vs CPU:** uses CUDA if free, else falls back to CPU automatically. If a local
  LLM (e.g. Ollama/llama-server) is holding VRAM you'll see a CUDA OOM → it drops to
  CPU (~35 s per 5-min song, still fine). Pause the LLM to run on GPU.
- **Demucs** improves accuracy on dense mixes but is optional; on failure it aligns the
  full mix (already quite good for line-level). `--no-demucs` to skip.
- **Write-back:** this tool only produces `results.json`. Apply `lrc` to
  `tracks.lyrics` via the Supabase dashboard / MCP / an authenticated client (writes are
  RLS-gated to admins, so no service-role key lives in the repo).
- `venv/`, model caches, and audio are not committed.
