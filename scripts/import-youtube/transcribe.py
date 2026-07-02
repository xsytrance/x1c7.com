#!/usr/bin/env python3
"""
Transcribe a song's vocals with word-level timestamps — no known lyrics needed.
(For songs where you HAVE the lyrics, prefer forced alignment: align_lyrics.py.)

Usage: transcribe.py --audio song.mp3 --out transcript.json
         [--model large-v3] [--device cuda] [--language es] [--no-demucs]

Output JSON:
  { "language": str, "segments": [{ "start", "end", "text",
      "words": [{"t": sec, "text": str}] }] }
"""
import argparse, json, os, subprocess, sys, tempfile


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def isolate_vocals(mp3: str, workdir: str) -> str:
    """Demucs two-stem vocal isolation; falls back to the full mix."""
    try:
        out = os.path.join(workdir, "demucs")
        # --mp3 encodes via lameenc — torchaudio.save needs torchcodec + shared
        # ffmpeg libs that this box doesn't have.
        subprocess.run(
            [sys.executable, "-m", "demucs", "--two-stems=vocals", "-n", "htdemucs",
             "--mp3", "--mp3-bitrate", "192", "-o", out, mp3],
            check=True, capture_output=True, timeout=1800,
        )
        stem = os.path.splitext(os.path.basename(mp3))[0]
        voc = os.path.join(out, "htdemucs", stem, "vocals.mp3")
        if os.path.exists(voc):
            return voc
    except Exception as e:
        log("  demucs failed, transcribing full mix:", e)
    return mp3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--compute-type", default="float16")
    ap.add_argument("--language", default=None)
    ap.add_argument("--no-demucs", action="store_true")
    args = ap.parse_args()

    import stable_whisper
    log(f"loading {args.model} on {args.device} …")
    try:
        model = stable_whisper.load_faster_whisper(
            args.model, device=args.device, compute_type=args.compute_type)
    except Exception as e:
        log("cuda load failed, falling back to CPU:", e)
        model = stable_whisper.load_faster_whisper(args.model, device="cpu", compute_type="int8")

    with tempfile.TemporaryDirectory() as wd:
        audio = args.audio if args.no_demucs else isolate_vocals(args.audio, wd)
        log("transcribing …")
        r = model.transcribe(audio, language=args.language, vad=True, word_timestamps=True)

    segments = []
    for s in r.segments:
        text = s.text.strip()
        if not text:
            continue
        segments.append({
            "start": round(float(s.start), 3),
            "end": round(float(s.end), 3),
            "text": text,
            "words": [{"t": round(float(w.start), 3), "text": w.word.strip()}
                      for w in (s.words or []) if w.word.strip()],
        })

    out = {"language": getattr(r, "language", None) or args.language, "segments": segments}
    json.dump(out, open(args.out, "w"), ensure_ascii=False, indent=2)
    log(f"done: {len(segments)} segments -> {args.out}")


if __name__ == "__main__":
    main()
