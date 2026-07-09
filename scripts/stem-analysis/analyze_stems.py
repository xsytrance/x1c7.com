#!/usr/bin/env python3
"""
Stem analysis — turn a folder of Suno stems into the compact JSON the lyric
engine performs from. Everything is measured, nothing guessed:

  kicks/snares/hats  onset times from the Drums + Percussion stems (band-split)
  beats/bpm          beat grid tracked on the drums
  env.*              perceptual loudness envelopes per stem (12.5 Hz, 0-99)
  cuts               drum-silence windows (the dramatic beat-cuts)
  risers             energy ramps in Synth/Other that end at a drum return (drops)
  align              global offset stems -> release audio (cross-correlated),
                     so every time is in the RELEASE mp3's clock

Usage: analyze_stems.py --stems <dir> --release <audio.mp3> --out stems.json
"""
import argparse, json, os, sys
import numpy as np
import librosa

SR = 22050
HOP = 512
ENV_HZ = 12.5

def log(*a): print(*a, file=sys.stderr, flush=True)

def load(path, sr=SR):
    y, _ = librosa.load(path, sr=sr, mono=True)
    return y

def envelope(y, sr=SR, hz=ENV_HZ):
    """Perceptual-ish loudness envelope, quantized 0-99 at `hz` frames/sec."""
    hop = int(sr / hz)
    rms = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop)[0]
    db = librosa.amplitude_to_db(rms + 1e-9, ref=np.max)
    lo, hi = -50.0, 0.0
    v = np.clip((db - lo) / (hi - lo), 0, 1)
    return np.round(v * 99).astype(int).tolist()

def onsets(y, sr=SR, fmin=None, fmax=None, delta=0.07, wait=2):
    """Onset times, optionally band-limited first."""
    if fmin or fmax:
        import scipy.signal as ss
        nyq = sr / 2
        if fmin and fmax:
            b, a = ss.butter(4, [fmin / nyq, fmax / nyq], btype="band")
        elif fmax:
            b, a = ss.butter(4, fmax / nyq, btype="low")
        else:
            b, a = ss.butter(4, fmin / nyq, btype="high")
        y = ss.filtfilt(b, a, y)
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    peaks = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=HOP,
                                       backtrack=False, delta=delta, wait=wait, units="time")
    # keep only onsets with real local energy (kill filter-ring ghosts)
    rms = librosa.feature.rms(y=y, hop_length=HOP)[0]
    keep = []
    thr = np.percentile(rms, 75) * 0.25
    for t in peaks:
        i = min(len(rms) - 1, int(t * sr / HOP))
        if rms[i] > thr:
            keep.append(round(float(t), 3))
    return keep

def align_offset(stem_mix, release, sr=SR):
    """Lag (seconds) to ADD to stem times to land on the release clock."""
    a = librosa.onset.onset_strength(y=release, sr=sr, hop_length=HOP)
    b = librosa.onset.onset_strength(y=stem_mix, sr=sr, hop_length=HOP)
    n = max(len(a), len(b))
    a = np.pad(a, (0, n - len(a))); b = np.pad(b, (0, n - len(b)))
    corr = np.correlate(a - a.mean(), b - b.mean(), mode="full")
    lag_frames = int(np.argmax(corr)) - (n - 1)
    lag = lag_frames * HOP / sr
    score = float(np.max(corr) / (np.std(a) * np.std(b) * n + 1e-9))
    return lag, score

def silence_windows(y, sr=SR, min_len=0.8, thr_db=-38):
    """[start,end] windows where a stem is essentially silent."""
    hop = int(sr / ENV_HZ)
    rms = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop)[0]
    db = librosa.amplitude_to_db(rms + 1e-9, ref=np.max)
    quiet = db < thr_db
    wins, start = [], None
    for i, q in enumerate(quiet):
        t = i / ENV_HZ
        if q and start is None: start = t
        if not q and start is not None:
            if t - start >= min_len: wins.append([round(start, 2), round(t, 2)])
            start = None
    if start is not None and len(quiet) / ENV_HZ - start >= min_len:
        wins.append([round(start, 2), round(len(quiet) / ENV_HZ, 2)])
    return wins

def find_risers(env_list, drum_returns, min_ramp=2.5):
    """Sustained energy ramps that terminate within 1.2s of a drum return."""
    e = np.array(env_list, dtype=float)
    risers = []
    for dr in drum_returns:
        end = int(dr * ENV_HZ)
        if end < ENV_HZ * 2 or end >= len(e): continue
        # walk backwards while energy is mostly non-increasing (i.e. ramping up toward the drop)
        i = end
        while i > 0 and (e[i - 1] <= e[i] + 4):
            i -= 1
            if (end - i) / ENV_HZ > 14: break
        ramp = (end - i) / ENV_HZ
        if ramp >= min_ramp and e[end] - e[i] >= 18:
            risers.append({"t": round(i / ENV_HZ, 2), "end": round(dr, 2)})
    # dedupe overlaps
    out = []
    for r in sorted(risers, key=lambda r: r["t"]):
        if not out or r["t"] > out[-1]["end"]:
            out.append(r)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stems", required=True)
    ap.add_argument("--release", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    names = {}
    for f in sorted(os.listdir(args.stems)):
        low = f.lower()
        if not low.endswith((".mp3", ".wav", ".flac")): continue
        for key, pat in [("lead", "lead voc"), ("back", "backing voc"), ("drums", "drum"),
                         ("bass", "bass"), ("perc", "perc"), ("synth", "synth"), ("other", "other"),
                         ("guitar", "guitar"), ("keys", "keyboard"),
                         ("strings", "strings"), ("woodwinds", "woodwind")]:
            if pat in low: names[key] = os.path.join(args.stems, f)
    log("stems:", {k: os.path.basename(v) for k, v in names.items()})

    y = {k: load(p) for k, p in names.items()}
    release = load(args.release)
    dur = len(release) / SR

    mix = np.zeros(max(len(v) for v in y.values()))
    for v in y.values(): mix[:len(v)] += v
    lag, score = align_offset(mix, release)
    log(f"alignment: stems {lag:+.3f}s -> release (score {score:.2f})")

    def to_release(times):
        return [round(t + lag, 3) for t in times if 0 <= t + lag <= dur + 0.5]

    drums = y.get("drums", np.zeros(1))
    perc = y.get("perc", np.zeros(1))
    dp = drums.copy()
    if len(perc) > 1:
        n = max(len(dp), len(perc)); dp = np.pad(dp, (0, n - len(dp))) + np.pad(perc, (0, n - len(perc)))

    log("onsets …")
    kicks = to_release(onsets(drums, fmax=120, delta=0.09, wait=3))
    snares = to_release(onsets(drums, fmin=1400, fmax=5000, delta=0.09, wait=3))
    hats = to_release(onsets(dp, fmin=6000, delta=0.05, wait=1))
    log(f"  kicks {len(kicks)}, snares {len(snares)}, hats {len(hats)}")

    tempo, beats = librosa.beat.beat_track(y=dp, sr=SR, hop_length=HOP, units="time")
    beats = to_release([float(b) for b in beats])
    bpm = float(np.atleast_1d(tempo)[0])
    log(f"  bpm {bpm:.1f}, {len(beats)} beats")

    log("envelopes …")
    # envelopes computed on stem clock, shifted by slicing to release clock
    def env_release(sig):
        e = envelope(sig)
        shift = int(round(-lag * ENV_HZ))  # positive shift drops leading frames
        if shift > 0: e = e[shift:]
        elif shift < 0: e = [0] * (-shift) + e
        need = int(dur * ENV_HZ) + 1
        return (e + [0] * need)[:need]
    env = {k: env_release(v) for k, v in y.items()}

    log("cuts + risers …")
    cuts = [[max(0, round(a + lag, 2)), round(b + lag, 2)]
            for a, b in silence_windows(dp) if b + lag > 1 and a + lag < dur - 1]
    # drum returns = each cut's end + the very first drum entrance
    returns = [c[1] for c in cuts]
    melodic = [env[k] for k in ("synth", "other", "guitar", "keys") if k in env]
    synth_env = np.max([np.array(e) for e in melodic], axis=0).tolist() if melodic else [0]
    risers = find_risers(synth_env, returns)
    log(f"  cuts {cuts}")
    log(f"  risers {risers}")

    out = {
        "v": 1, "bpm": round(bpm, 2), "envHz": ENV_HZ, "duration": round(dur, 2),
        "align": {"lag": round(lag, 3), "score": round(score, 2)},
        "beats": beats, "kicks": kicks, "snares": snares, "hats": hats,
        "cuts": cuts, "risers": risers,
        "env": {k: env[k] for k in ("lead", "back", "drums", "perc", "bass", "synth", "other", "guitar", "keys") if k in env},
    }
    with open(args.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    log(f"done -> {args.out} ({os.path.getsize(args.out)//1024} KB)")

if __name__ == "__main__":
    main()
