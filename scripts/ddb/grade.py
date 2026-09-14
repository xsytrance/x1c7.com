#!/usr/bin/env python3
"""Measure, and optionally apply, the PAPER RIVER grade.

Playbook §21: "the grade is load-bearing, not cosmetic — phrase mode draws an
un-sung word at 0.26 opacity, and the base checkpoint returns brighter frames
than this voice wants." Osaka solved that with gain 0.46, which is right for a
wet-neon night film and completely wrong here: this voice is daylight, mist and
cream paper, and crushing it would betray the song.

So the grade is chosen from measurement, not taste. The problem plates are the
PALE ones (light, sky, breathe, gold) where a light word sits on a light ground;
the dark plates (tonight, closer) are already fine and must not be crushed
further. A flat gain would darken both. What is wanted is a shoulder: pull the
bright end down, leave the shadows where they are.

    python3 scripts/ddb/grade.py            # measure only
    python3 scripts/ddb/grade.py --apply    # write graded webp in place
"""
import subprocess, sys, os, json, re

SRC = "scripts/ddb/webp"
plates = sorted(f for f in os.listdir(SRC) if f.endswith(".webp"))


def luma(path):
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", "signalstats,metadata=mode=print:file=-",
         "-f", "null", "-"], capture_output=True, text=True).stdout
    avg = re.search(r"YAVG=([\d.]+)", out)
    hi = re.search(r"YHIGH=([\d.]+)", out)
    return (float(avg.group(1)) if avg else 0.0, float(hi.group(1)) if hi else 0.0)


# A highlight shoulder, not a flat gain: gamma 1.0 keeps the black point, the
# curve pulls the top end down so pale skies stop competing with the lyric.
VF = "curves=all='0/0 0.25/0.23 0.55/0.47 0.8/0.68 1/0.87',eq=saturation=1.08:contrast=1.06"

print(f"{'plate':12s} {'YAVG':>7s} {'YHIGH':>7s}")
rows = []
for p in plates:
    a, h = luma(os.path.join(SRC, p))
    rows.append((p, a, h))
    print(f"{p[:-5]:12s} {a:7.1f} {h:7.1f}")
pale = [r for r in rows if r[1] > 140]
print(f"\n{len(pale)} of {len(rows)} plates average above Y=140 (a light word "
      f"competes with the ground on these): {', '.join(r[0][:-5] for r in pale)}")

if "--apply" not in sys.argv:
    print("\nmeasure only — pass --apply to grade in place")
    raise SystemExit(0)

for p in plates:
    src = os.path.join(SRC, p)
    tmp = src + ".tmp.webp"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-vf", VF,
                    "-quality", "90", tmp], check=True)
    os.replace(tmp, src)
print(f"\ngraded {len(plates)} plates in place")
for p in plates:
    a, h = luma(os.path.join(SRC, p))
    print(f"  {p[:-5]:12s} YAVG {a:7.1f}  YHIGH {h:7.1f}")
