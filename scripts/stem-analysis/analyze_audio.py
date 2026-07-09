#!/usr/bin/env python3
"""
Single-file audio DSP — the no-stems half of the ultimate analyzer.

analyze_stems.py measures a song when Suno's separated stems exist; THIS
measures straight off a release mp3/wav. Same StemData dialect (v:1, bpm,
beats, kicks/snares/hats, cuts, risers, env @12.5 Hz) so stem senses and
Kinetica can consume it, plus a `mix` block of features stems can't give
alone: key/mode, brightness, dynamics, structural boundaries.

With --demucs (default) the mix is split htdemucs-4 (vocals/drums/bass/other
-> lead/drums/bass/other) so env/onsets are measured per approximate stem;
--no-demucs falls back to an HPSS split (percussive drives the drum senses).

Usage: analyze_audio.py --audio song.mp3 --out senses.json [--no-demucs]
       [--features-only]   # skip senses, just the mix block (key/boundaries)
"""
import argparse, json, os, subprocess, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from analyze_stems import (SR, ENV_HZ, log, load, envelope, onsets,
                           silence_windows, find_risers)

import librosa
import numpy as np

# Krumhansl-Schmuckler key profiles
MAJ = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])
MIN = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]


def estimate_key(y, sr=SR):
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr).mean(axis=1)
    best = (-2.0, "C", "major")
    for shift in range(12):
        rolled = np.roll(chroma, -shift)
        for prof, mode in ((MAJ, "major"), (MIN, "minor")):
            r = np.corrcoef(rolled, prof)[0, 1]
            if r > best[0]:
                best = (r, NOTES[shift], mode)
    return {"key": best[1], "mode": best[2], "confidence": round(float(best[0]), 3)}


def boundaries(y, sr=SR, k=9):
    """Structural section-start candidates (agglomerative on chroma+mfcc)."""
    hop = 2048
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=13)
    X = np.vstack([librosa.util.normalize(chroma, axis=0),
                   librosa.util.normalize(mfcc, axis=0)])
    k = min(k, max(2, X.shape[1] // 40))
    idx = librosa.segment.agglomerative(X, k)
    t = librosa.frames_to_time(idx, sr=sr, hop_length=hop)
    return [round(float(x), 2) for x in t if x > 1.0]


def demucs_split(audio, wd):
    """htdemucs 4-stem -> {lead,drums,bass,other} wav paths, or None."""
    try:
        subprocess.run([sys.executable, "-m", "demucs", "-n", "htdemucs",
                        "-o", wd, audio], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        stem = os.path.splitext(os.path.basename(audio))[0]
        base = os.path.join(wd, "htdemucs", stem)
        mapping = {"lead": "vocals", "drums": "drums", "bass": "bass", "other": "other"}
        out = {k: os.path.join(base, f"{v}.wav") for k, v in mapping.items()}
        return out if all(os.path.exists(p) for p in out.values()) else None
    except Exception as e:
        log("  demucs failed, HPSS fallback:", e)
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--no-demucs", action="store_true")
    ap.add_argument("--features-only", action="store_true")
    args = ap.parse_args()

    log("load …")
    y = load(args.audio)
    duration = round(len(y) / SR, 2)

    log("key + structure …")
    mix = {
        "keyEstimate": estimate_key(y),
        "boundaries": boundaries(y),
        "brightness": round(float(librosa.feature.spectral_centroid(y=y, sr=SR).mean()), 1),
        "dynamicsDb": None,
    }
    rms = librosa.feature.rms(y=y)[0]
    db = librosa.amplitude_to_db(rms + 1e-9)
    mix["dynamicsDb"] = round(float(np.percentile(db, 95) - np.percentile(db, 10)), 1)

    out = {"v": 1, "envHz": ENV_HZ, "duration": duration,
           "align": {"lag": 0.0, "score": 1.0}, "mix": mix}

    if not args.features_only:
        stems = None
        if not args.no_demucs:
            log("demucs 4-stem split …")
            with tempfile.TemporaryDirectory() as wd:
                paths = demucs_split(args.audio, wd)
                if paths:
                    stems = {k: load(p) for k, p in paths.items()}
        if stems is None:
            log("HPSS split …")
            harm, perc = librosa.effects.hpss(y)
            stems = {"lead": harm, "drums": perc, "other": harm}

        drums = stems.get("drums", y)
        log("onsets …")
        kicks = onsets(drums, fmax=120, delta=0.10)
        snares = onsets(drums, fmin=1400, fmax=5000, delta=0.10)
        hats = onsets(drums, fmin=6000, delta=0.05, wait=1)
        tempo, beat_f = librosa.beat.beat_track(y=drums, sr=SR)
        beats = [round(float(t), 3) for t in librosa.frames_to_time(beat_f, sr=SR)]
        log(f"  kicks {len(kicks)}, snares {len(snares)}, bpm {float(tempo):.1f}")

        log("envelopes + cuts + risers …")
        env = {k: envelope(v) for k, v in stems.items()}
        cuts = [c for c in silence_windows(drums) if c[1] - c[0] >= 0.8]
        melodic = [env[k] for k in ("other", "lead") if k in env]
        drum_returns = [c[1] for c in cuts]
        risers = []
        if melodic:
            n = min(len(e) for e in melodic)
            combined = np.max([e[:n] for e in melodic], axis=0).tolist()
            risers = find_risers(combined, drum_returns)

        out.update({"bpm": round(float(tempo), 2), "beats": beats,
                    "kicks": kicks, "snares": snares, "hats": hats,
                    "cuts": [[round(a, 2), round(b, 2)] for a, b in cuts],
                    "risers": risers, "env": env, "approx": True})

    with open(args.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    log(f"done -> {args.out} ({os.path.getsize(args.out)//1024} KB)")


if __name__ == "__main__":
    main()
