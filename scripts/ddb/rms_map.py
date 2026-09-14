#!/usr/bin/env python3
"""RMS energy map of a decoded stem, in fixed hops — the honest source for
"is anyone actually singing here?" when ASR returns nothing (playbook §18/§19,
skill Step 2). Decoded with ffmpeg, never libsndfile (Suno headers lie).

    python3 scripts/ddb/rms_map.py <stem.wav> <t_from> <t_to> [hop]
"""
import subprocess, sys, wave, array, math

src = sys.argv[1]
t0, t1 = float(sys.argv[2]), float(sys.argv[3])
hop = float(sys.argv[4]) if len(sys.argv) > 4 else 0.25

w = wave.open(src, "rb")
sr, n = w.getframerate(), w.getnframes()
w.setpos(max(0, int(t0 * sr)))
raw = w.readframes(min(n - int(t0 * sr), int((t1 - t0) * sr)))
pcm = array.array("h"); pcm.frombytes(raw)

step = int(hop * sr)
print(f"{src}  sr={sr}  window {t0}-{t1}s  hop={hop}s")
run_start = None
for i in range(0, len(pcm) - step, step):
    chunk = pcm[i:i + step]
    rms = math.sqrt(sum(float(s) * s for s in chunk) / len(chunk)) or 1e-9
    db = 20 * math.log10(rms / 32768.0)
    t = t0 + i / sr
    bar = "#" * max(0, int((db + 80) / 3))
    flag = "  <== VOICE" if db > -42 else ("  <- quiet" if db > -52 else "")
    print(f"{t:8.2f}  {db:7.1f} dB  {bar}{flag}")
