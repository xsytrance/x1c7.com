#!/usr/bin/env python3
"""
RE-ALIGN ONE — Qwen3-ForcedAligner against a cached web lead stem.

The v1 aligner (align-lyrics.py) reads local Suno stem WAVs that died in
the OS reinstall; this runner aligns against the web-transcoded lead.m4a
the melody batch already caches — same windowed committed-prefix core,
same QA gate — then hands off to refine-alignment.py's clock (add --lag to
land on the release clock).

  ~/whisper-venv/bin/python scripts/alignment/realign-one.py \
    --lead out/<slug>/lead.m4a --text lyrics.txt --lang English \
    --lag 0.0 --out aligned.json

Output: { v, language, qa, words: [{t, w}] }  (release clock)
"""
import argparse, json, re, subprocess, sys
from collections import Counter

WINDOW, MARGIN, SR = 160.0, 20.0, 16000
CLUMP_MIN = 7
CLUMP_RATIO_MAX = 0.12

CJK = re.compile(r"[぀-ヿ㐀-鿿가-힯]")


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def join_tokens(toks):
    out = ""
    for t in toks:
        if out and not (CJK.search(t[:1]) or CJK.search(out[-1:])):
            out += " "
        out += t
    return out


def load_audio(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "pipe:1"],
        capture_output=True, check=True).stdout
    import numpy as np
    return np.frombuffer(raw, dtype=np.float32)


def align_windowed(aligner, path, text, lang):
    audio = load_audio(path)
    dur = len(audio) / SR
    committed, cursor, remaining, passes = [], 0.0, text, 0
    while remaining.strip() and passes < 10:
        passes += 1
        end = min(cursor + WINDOW, dur)
        chunk = audio[int(cursor * SR):int(end * SR)]
        res = aligner.align(audio=(chunk, SR), text=remaining, language=lang)
        words = [(w.text, w.start_time + cursor, w.end_time + cursor) for w in res[0]]
        last = end >= dur - 0.5
        limit = end if last else end - MARGIN
        take = 0
        for _, s, e in words:
            if e < limit:
                take += 1
            else:
                break
        if take == 0:
            if last:
                committed.extend(words)
                break
            cursor = end - MARGIN
            continue
        committed.extend(words[:take])
        if last and take == len(words):
            break
        remaining = join_tokens([w[0] for w in words[take:]])
        cursor = committed[-1][2]
        if last:
            committed.extend((t, dur, dur) for t in remaining.split())
            break
    return committed, dur, passes


def qa_score(words, dur):
    starts = Counter(round(s, 2) for _, s, _ in words)
    clumps = [{"t": t, "n": n} for t, n in starts.items() if n >= CLUMP_MIN]
    clumped = sum(c["n"] for c in clumps)
    ratio = clumped / max(1, len(words))
    span = words[-1][2] - words[0][1] if words else 0
    return {
        "words": len(words), "clumpRatio": round(ratio, 3),
        "span": round(span, 1), "duration": round(dur, 1),
        "pass": ratio <= CLUMP_RATIO_MAX and len(words) > 20,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lead", required=True)
    ap.add_argument("--text", required=True, help="plain lyrics text file")
    ap.add_argument("--lang", default="English")
    ap.add_argument("--lag", type=float, default=0.0, help="stem clock + lag = release clock")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    raw = open(args.text, encoding="utf-8").read()
    # strip section headers like [Chorus] and blank lines; keep the sung words
    lines = [l.strip() for l in raw.splitlines()]
    lines = [l for l in lines if l and not re.fullmatch(r"\[[^\]]+\]", l)]
    text = join_tokens(" ".join(lines).split())
    if not text:
        log("✗ no lyric text")
        sys.exit(1)

    log("▶ loading Qwen3-ForcedAligner (cuda)…")
    import torch
    from qwen_asr import Qwen3ForcedAligner
    aligner = Qwen3ForcedAligner.from_pretrained(
        "Qwen/Qwen3-ForcedAligner-0.6B", dtype=torch.bfloat16, device_map="cuda:0")

    log(f"▶ aligning {len(text.split())} tokens…")
    words, dur, passes = align_windowed(aligner, args.lead, text, args.lang)
    qa = qa_score(words, dur)
    out_words = [{"t": round(s + args.lag, 3), "w": w} for (w, s, _e) in words]
    json.dump({"v": 2, "language": args.lang, "qa": qa, "words": out_words}, open(args.out, "w"))
    log(f"✓ {qa['words']} words in {passes} pass(es) · clump {qa['clumpRatio']} · span {qa['span']}/{qa['duration']}s · QA {'PASS' if qa['pass'] else 'FLAG'}")


if __name__ == "__main__":
    main()
