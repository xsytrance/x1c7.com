# THE ALIGNMENT — grand plan

Lyric timing stops being an AI guess and becomes a measurement. Whisper
transcribes singing it was never trained on and hallucinates on fade-outs;
meanwhile 46/54 tracks have **official lyrics** — for them the problem was
never transcription, it's **forced alignment**: given this exact text, when
is each word sung. Aligners cannot hallucinate; they can only place the
words we give them.

Origin: HN dictation thread (Parakeet — fast but speech-trained, wrong tool)
→ led to **Qwen3-ASR** (open, 2026-01): trained ON singing (<6% WER solo,
<15% with accompaniment, ~2× better than GPT-4o on songs), 52 languages,
local via `pip install qwen-asr`, 0.6B/1.7B. Ships with
**Qwen3-ForcedAligner** (non-autoregressive text↔audio alignment, 11
languages). Same family as the qwen3.5 that already runs the dossiers.

## The tiers

**Tier A — official lyrics (46 tracks): align, don't transcribe.**
official text + isolated lead stem → Qwen3-ForcedAligner → word timings →
`lyrics_synced` + LRC. Fallback chain when a language/track misbehaves:
ctc-forced-aligner (MMS wav2vec2, 1000+ languages — covers Hiligaynon) →
whisperX wav2vec2 pass (<100 ms words, the standard karaoke pipeline).

**Tier B — no official lyrics (8 tracks): transcribe once, align always.**
Qwen3-ASR-1.7B on the lead stem → qwen3.5 cleanup pass (strip fade-out
artifacts, structure into lines) → the text feeds back through Tier A.

## Guardrails

- **Alignment QA score** per track: word coverage %, mean per-word
  confidence, gap outliers. Below threshold → flagged, never auto-published.
- **Instrumental gate**: vocal-energy + aligned-word-count threshold →
  instrumental mode instead of a 2-word show (AI Interlude, Feverbreak).
- **apply-shows rule change**: official-ALIGNED timings may replace whisper
  timings (today whisper only fills empty rows — correct then, blocking now).
  Everything stays journaled + reversible via R2 show.json.

## Rollout

1. **Bake-off** (first task): 3 tracks — different-this-summer (EN),
   oro-de-la-presion (ES), i-won-t-be-your-fire-japanese-mix (JA) — align
   official lyrics on the lead stem, compare word timings vs the whisper
   `transcript.json`. Judge: coverage, timing sanity at section boundaries,
   eyeball the show.
2. `scripts/alignment/align-lyrics.py` (whisper-venv sibling env) + a
   `realign.mjs` wrapper that emits guarded SQL like publish-shows.
3. Batch Tier A (46), spot-check 5, apply.
4. Tier B for the 8; owner pastes lyrics for any Qwen3-ASR still gets wrong
   (the unlisted birthday song may yield to the per-clip API by raw UUID).
5. Retire the whisper-cleanup caveat; dossiers/booklets keep their official
   text — only timings change.

## Why this wins

- Every performing word is the real lyric on the real beat — the shows and
  Kinetica get strictly better, zero LLM risk in the hot path.
- Fits the dossier law: facts are measured, and timing becomes a fact.
- The same pipeline is the engine for "drop an mp3 → your song's papers +
  show" (Qwen3-ASR for strangers' songs; aligner when they paste lyrics).
