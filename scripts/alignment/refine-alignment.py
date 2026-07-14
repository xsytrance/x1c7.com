#!/usr/bin/env python3
"""
ALIGNMENT REFINER — make measured timings perfect with math, no ML.

The forced aligner gets words CLOSE; this pass makes them EXACT, using the
isolated lead vocal as ground truth. Four measurements, three corrections:

  MEASURE  vocal onsets     spectral-flux peaks on the lead stem (the moments
                            a sung word can actually begin)
           silence mask     lead-stem RMS envelope (where no one is singing,
                            no word should start)
           global lag       median signed distance word-start → nearest onset:
                            a consistent offset = the whole track is shifted
                            (the "Music Is My Drug" failure class)
           clumps           runs of words sharing one timestamp = text the
                            audio sings differently (written echo-doubling)

  CORRECT  1. shift         subtract the global lag when |lag| > 60 ms
           2. snap          each word start moves to the nearest vocal onset
                            within ±150 ms — monotonicity enforced, so words
                            never reorder
           3. spread        a clump's words are spread across the sung onsets
                            measured inside its window (as many as exist)

Scores BEFORE and AFTER (silence-rate, mean onset distance, clump ratio) so
every change is a measured improvement, never a vibe.

Usage:
  refine-alignment.py --lead lead.m4a --words words.json --out refined.json
                      [--lag 0.0]      # stems.json align.lag (stem → release clock)
                      [--report-only]
Output: { score: {before, after}, shifted, words: [{t, w}] }
"""
import argparse, json, subprocess, sys, tempfile

import numpy as np
import librosa

SR = 22050
HOP = 256
SNAP_WIN = 0.15      # s — max distance a word may move to meet an onset
LAG_FIX_MIN = 0.06   # s — apply a global shift only beyond this
CLUMP_MIN = 4        # words sharing one start = a clump worth arbitrating
SIL_DB = -38.0       # lead-stem level below this (rel. max) = silence


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def load_audio(path):
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), tmp.name], check=True)
        y, _ = librosa.load(tmp.name, sr=SR, mono=True)
    return y


def vocal_onsets(y):
    """Spectral-flux onset times on the lead stem — where words can begin."""
    o_env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)
    frames = librosa.onset.onset_detect(onset_envelope=o_env, sr=SR, hop_length=HOP,
                                        backtrack=True, delta=0.04, wait=2)
    return librosa.frames_to_time(frames, sr=SR, hop_length=HOP)


def silence_mask(y):
    """(times, silent?) at envelope rate — where nobody is singing."""
    rms = librosa.feature.rms(y=y, hop_length=HOP)[0]
    db = librosa.amplitude_to_db(rms, ref=np.max(rms) + 1e-9)
    times = librosa.times_like(rms, sr=SR, hop_length=HOP)
    return times, db < SIL_DB


def is_silent(t, times, silent, span=0.18):
    """True when the lead stem is silent for the whole [t, t+span)."""
    i0 = np.searchsorted(times, t)
    i1 = np.searchsorted(times, t + span)
    if i1 <= i0:
        return False
    return bool(np.all(silent[i0:i1]))


def nearest(onsets, t):
    if len(onsets) == 0:
        return None
    i = np.searchsorted(onsets, t)
    best = None
    for j in (i - 1, i):
        if 0 <= j < len(onsets):
            if best is None or abs(onsets[j] - t) < abs(best - t):
                best = onsets[j]
    return best


def score(words, onsets, sil_times, sil_mask):
    starts = np.array([w["t"] for w in words], dtype=float)
    dists = np.array([abs((nearest(onsets, t) or t) - t) for t in starts])
    silent_n = sum(1 for t in starts if is_silent(t, sil_times, sil_mask))
    # clumps: runs sharing one timestamp
    clumped = 0
    i = 0
    while i < len(starts):
        j = i
        while j + 1 < len(starts) and abs(starts[j + 1] - starts[i]) < 0.02:
            j += 1
        if j - i + 1 >= CLUMP_MIN:
            clumped += j - i + 1
        i = j + 1
    lag = float(np.median([(nearest(onsets, t) or t) - t for t in starts]))
    return {
        "words": len(words),
        "silenceRate": round(silent_n / max(1, len(words)), 3),
        "meanOnsetDist": round(float(np.mean(dists)), 3),
        "clumpRatio": round(clumped / max(1, len(words)), 3),
        "globalLag": round(lag, 3),
    }


def refine(words, onsets, sil_times, sil_mask):
    out = [dict(w) for w in words]
    # 1. global shift — the whole take is offset
    lag = float(np.median([(nearest(onsets, w["t"]) or w["t"]) - w["t"] for w in out]))
    shifted = 0.0
    if abs(lag) > LAG_FIX_MIN:
        shifted = lag
        for w in out:
            w["t"] = round(w["t"] + lag, 3)

    # 2. clump spread — the sung onsets inside the window arbitrate the text
    i = 0
    while i < len(out):
        j = i
        while j + 1 < len(out) and abs(out[j + 1]["t"] - out[i]["t"]) < 0.02:
            j += 1
        n = j - i + 1
        if n >= CLUMP_MIN:
            t0 = out[i]["t"] - 0.05
            t1 = out[j + 1]["t"] if j + 1 < len(out) else out[j]["t"] + n * 0.35
            local = [t for t in onsets if t0 <= t < t1]
            if len(local) >= 2:
                # spread the words across the onsets that actually exist;
                # extra words ride the last onset (they're echo-text anyway)
                for k in range(n):
                    out[i + k]["t"] = round(float(local[min(k, len(local) - 1)]), 3)
        i = j + 1

    # 3. per-word snap — meet the vocal onset, never reorder
    prev = -1e9
    for k, w in enumerate(out):
        tgt = nearest(onsets, w["t"])
        t = w["t"]
        if tgt is not None and abs(tgt - t) <= SNAP_WIN:
            t = float(tgt)
        t = max(t, prev + 0.01)  # monotonic
        out[k]["t"] = round(t, 3)
        prev = t
    return out, shifted


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lead", required=True)
    ap.add_argument("--words", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--lag", type=float, default=0.0, help="stems.json align.lag (word clock − stem clock)")
    ap.add_argument("--report-only", action="store_true")
    args = ap.parse_args()

    data = json.load(open(args.words))
    words = data["words"] if isinstance(data, dict) else data
    if not words:
        log("✗ no words")
        sys.exit(1)

    y = load_audio(args.lead)
    onsets = vocal_onsets(y) + args.lag  # everything in the release clock
    sil_times, sil = silence_mask(y)
    sil_times = sil_times + args.lag

    before = score(words, onsets, sil_times, sil)
    refined, shifted = refine(words, onsets, sil_times, sil)
    after = score(refined, onsets, sil_times, sil)

    json.dump({
        "v": 1,
        "score": {"before": before, "after": after},
        "shifted": round(shifted, 3),
        "words": refined if not args.report_only else words,
    }, open(args.out, "w"))
    log(f"✓ {len(words)} words · silence {before['silenceRate']}→{after['silenceRate']}"
        f" · onset-dist {before['meanOnsetDist']}→{after['meanOnsetDist']}s"
        f" · clump {before['clumpRatio']}→{after['clumpRatio']}"
        f" · lag {before['globalLag']}s{f' (shifted {shifted:+.3f}s)' if shifted else ''}")


if __name__ == "__main__":
    main()
