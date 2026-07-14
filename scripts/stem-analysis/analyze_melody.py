#!/usr/bin/env python3
"""
Melody analysis — the singer's actual notes, one per timed word.

The third leg of the measured-hearing stack (analyze_stems.py = rhythm,
analyze_audio.py = mix features): pYIN pitch-tracks the LEAD VOCAL stem,
then, for every aligned word window, takes the median voiced f0 — so each
lyric knows the note it was sung on. Plus the song's key (Krumhansl-
Schmuckler on the tonal content), so the engine can map notes to color
HARMONICALLY (tonic = home hue, circle-of-fifths distance = hue distance)
instead of chromatically.

Nothing is guessed: words come from the forced aligner, pitch from the
isolated vocal, key from the actual harmony. A live visualizer cannot have
any of this.

Usage:
  ~/librosa-venv/bin/python scripts/stem-analysis/analyze_melody.py \
    --lead lead.m4a --words aligned.json --out melody.json \
    [--lag 0.0]          # seconds to ADD to stem time → release clock
                         # (stems.json align.lag; word times are release-clock)
    [--key-audio x.m4a]  # audio for key detection (default: the lead stem)

Output melody.json (v1):
  { v:1, key:{root,mode,conf}, words:[{i,t,midi,pc,conf}] }
  i     word index into lyricsSynced.words   (only voiced words are listed)
  midi  median MIDI note (float, octave kept — future: octave→weight)
  pc    pitch class 0-11 (C=0)
  conf  0..1 — fraction of the window that was confidently voiced
"""
import argparse, json, subprocess, sys, tempfile

import numpy as np
import librosa

SR = 22050
FMIN, FMAX = 65.0, 1047.0  # C2..C6 — sung-vocal range
NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# Krumhansl-Schmuckler probe-tone profiles (same numbers as analyze_audio.py)
MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def load_audio(path, sr=SR):
    """Decode via ffmpeg — libsndfile silently truncates Suno MP3s/M4As."""
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), tmp.name],
            check=True,
        )
        y, _ = librosa.load(tmp.name, sr=sr, mono=True)
    return y


def estimate_key(y, sr=SR):
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr).mean(axis=1)
    best = (-2.0, "C", "major")
    for shift in range(12):
        rolled = np.roll(chroma, -shift)
        for prof, mode in ((MAJ, "major"), (MIN, "minor")):
            r = np.corrcoef(rolled, prof)[0, 1]
            if r > best[0]:
                best = (r, NOTES[shift], mode)
    return {"root": best[1], "mode": best[2], "conf": round(float(best[0]), 3)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lead", required=True, help="lead-vocal stem audio")
    ap.add_argument("--words", required=True, help="aligned.json ({words:[{t,w}]}) or a raw [{t,w}] list")
    ap.add_argument("--out", required=True)
    ap.add_argument("--lag", type=float, default=0.0, help="stems.json align.lag (stem time + lag = release clock)")
    ap.add_argument("--key-audio", default=None)
    args = ap.parse_args()

    data = json.load(open(args.words))
    words = data["words"] if isinstance(data, dict) else data
    if not words:
        log("✗ no words")
        sys.exit(1)

    log(f"▶ decoding {args.lead} …")
    y = load_audio(args.lead)
    dur = len(y) / SR
    log(f"  {dur:.1f}s @ {SR}Hz")

    log("▶ pYIN pitch track …")
    hop = 256  # ~11.6ms — short words still get a handful of frames
    f0, voiced, vprob = librosa.pyin(
        y, fmin=FMIN, fmax=FMAX, sr=SR, hop_length=hop, frame_length=2048,
    )
    times = librosa.times_like(f0, sr=SR, hop_length=hop)
    log(f"  {int(np.sum(voiced))}/{len(f0)} voiced frames")

    log("▶ key …")
    key = estimate_key(load_audio(args.key_audio) if args.key_audio else y)
    log(f"  {key['root']} {key['mode']} (r={key['conf']})")

    # Per word: median voiced f0 inside [t, next.t) on the STEM clock.
    out_words = []
    for i, w in enumerate(words):
        t0 = float(w["t"]) - args.lag
        t1 = (float(words[i + 1]["t"]) - args.lag) if i + 1 < len(words) else t0 + 0.6
        t1 = min(t1, t0 + 2.5)  # a held word's tail shouldn't swallow a rest
        if t1 - t0 < 0.05 or t1 < 0 or t0 > dur:
            continue
        sel = (times >= t0) & (times < t1) & voiced & (vprob > 0.5)
        n_sel = int(np.sum(sel))
        n_win = max(1, int(np.sum((times >= t0) & (times < t1))))
        if n_sel < 3:
            continue
        midi = float(librosa.hz_to_midi(np.median(f0[sel])))
        conf = round(min(1.0, (n_sel / n_win) * float(np.mean(vprob[sel]))), 3)
        out_words.append({
            "i": i,
            "t": round(float(w["t"]), 3),
            "midi": round(midi, 2),
            "pc": int(round(midi)) % 12,
            "conf": conf,
        })

    result = {"v": 1, "key": key, "words": out_words}
    json.dump(result, open(args.out, "w"))
    pcs = [w["pc"] for w in out_words]
    hist = {NOTES[p]: pcs.count(p) for p in sorted(set(pcs))}
    log(f"✓ {len(out_words)}/{len(words)} words pitched → {args.out}")
    log(f"  pitch-class histogram: {hist}")


if __name__ == "__main__":
    main()
