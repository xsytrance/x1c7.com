#!/usr/bin/env python3
# run with ~/whisper-venv/bin/python
"""DRINK DRINK v2 — the word list, rebuilt from the real vocal stem.

The 2026-07 cut ran on a forced alignment that had collapsed: eleven words on
the identical stamp 243.73, ten more on 244.05. Unusable for dynamic mode.

Two sources, because no single one can do this song:
  * SUNG LINES  — Parakeet TDT on the isolated lead stem, in section slices
                  (§23: whole-file ASR under-segments, slices recover it).
  * THE CHANT   — Parakeet hears NONE of it. The hook is a pitched, warped male
                  chant and ASR skips it entirely, on the mix and on the stem
                  alike ("Tem, trem, trem, trem"). So every "Drink" comes from
                  ONSET DETECTION on the stem instead: a prominence-peak picker
                  over a 5ms dB envelope. The song is 123.05 BPM (beat 0.4876s)
                  and the chant sits dead on that grid, which is what makes the
                  detection trustworthy — 31 of 74 detected gaps in the window
                  are exactly one beat.

Rule: a detected onset becomes a "Drink" unless a sung word already claims that
moment (within 0.34s) — sung words win, the chant fills everything else.

    ~/whisper-venv/bin/python scripts/dd2cut/build_words.py
"""
import json, math, wave
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
LEAD = Path("/tmp/claude-1000/-home-xsyprime-Hermes-x1c7-com/a86a8cc1-a531-4b14-bad4-1855c836e433/scratchpad/dd-lead.wav")
FROM, TO = 190.0, 250.0
BEAT = 60 / 123.05

# Sung words: official-lyrics text, onset times measured on the stem. Where a
# detected onset sat within a few frames of the ASR token, the ONSET is used —
# ASR marks where a token was recognised, the envelope marks where it was sung.
SUNG = [
    (210.47, "I"), (210.71, "don't"), (211.19, "wanna"), (211.70, "feel"), (212.38, "tonight"),
    (218.24, "Put"), (218.56, "my"), (218.85, "sorrow"), (219.33, "in"), (220.03, "the"), (220.27, "light"),
    (225.01, "Bottle"), (225.89, "glowing"), (226.42, "by"), (226.93, "my"), (227.91, "bed"),
    (232.59, "Pain"), (233.06, "keeps"), (233.54, "pounding"), (234.12, "in"), (234.56, "my"), (235.27, "head"),
    (244.08, "Don't"), (244.57, "save"), (245.10, "me"),
    (246.00, "Don't"), (246.98, "save"), (247.45, "me"), (247.92, "now"),
]
CLAIM = 0.34          # a sung word owns this much either side
CHANT_MIN_GAP = 0.40  # never two Drinks closer than this


def envelope(path):
    w = wave.open(str(path), "rb"); sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    hop, win = int(sr * 0.005), int(sr * 0.02)
    nf = (len(x) - win) // hop
    db = np.empty(nf, dtype=np.float32)
    for i in range(nf):
        s = x[i * hop:i * hop + win]
        db[i] = 20 * math.log10(math.sqrt(float(np.dot(s, s)) / len(s)) + 1e-9)
    return np.convolve(db, np.ones(5) / 5, mode="same"), np.arange(nf) * hop / sr


def onsets(sm, t, floor=-40.0, prom=7.0):
    out, last, back = [], -9.0, int(0.20 / 0.005)
    for i in range(2, len(sm) - 2):
        if sm[i] < floor or not (sm[i] >= sm[i - 1] and sm[i] > sm[i + 1]):
            continue
        foot = float(sm[max(0, i - back):i + 1].min())
        if sm[i] - foot < prom:
            continue
        thr = foot + 0.40 * (sm[i] - foot)
        j = i
        while j > 0 and sm[j] > thr and i - j < back:
            j -= 1
        ot = float(t[j + 1])
        if ot - last < 0.17:
            continue
        out.append(round(ot, 3)); last = ot
    return out


sm, t = envelope(LEAD)
hits = [h for h in onsets(sm, t) if FROM <= h <= TO]
sung = [(ts, w) for ts, w in SUNG if FROM <= ts <= TO]

words, lastchant = [], -9.0
for h in hits:
    if any(abs(h - ts) < CLAIM for ts, _ in sung):
        continue
    if h - lastchant < CHANT_MIN_GAP:
        continue
    words.append((h, "Drink")); lastchant = h
words += sung
words.sort(key=lambda r: r[0])

drinks = sum(1 for _, w in words if w == "Drink")
runs, cur = [], []
for ts, w in words:
    if w == "Drink":
        cur.append(ts)
    else:
        if len(cur) >= 3: runs.append((cur[0], cur[-1], len(cur)))
        cur = []
if len(cur) >= 3: runs.append((cur[0], cur[-1], len(cur)))

(HERE / "words.json").write_text(json.dumps(
    {"source": "parakeet on the isolated lead stem for sung lines; onset detection on the same "
               "stem for the chant, which ASR cannot hear; 123.05 BPM grid",
     "words": [{"t": ts, "w": w} for ts, w in words]}, indent=2))
print(f"wrote {HERE/'words.json'}")
print(f"  {len(words)} words in {FROM}-{TO}: {drinks} Drink, {len(words)-drinks} sung")
print(f"  {len(runs)} chant RUNS of 3+ (what THE POUR stacks on):")
for s, e, n in runs:
    print(f"    {s:7.2f} -> {e:7.2f}  {n:2d} hits, {(e-s)/max(1,n-1)/BEAT:.2f} beats apart")
