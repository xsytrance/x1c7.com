#!/usr/bin/env python3
"""Bed the new plates down to match the shipped WET NEON set.

Same grade as scripts/osaka/darken.py in the osaka-after-dark-cut worktree, and
for the same reason: KineticStage's phrase mode draws an un-sung word at opacity
0.26 and fills it as it is sung, which is invisible over an evenly-lit street.
Juggernaut returns brighter frames than the voice asks for, so every plate gets
knocked down to a real night with the neon kept hot.

The five REUSED plates already on R2 were graded by that script, so the new ones
must get the identical treatment or they will not cut against them.
"""
import json, os
from PIL import Image, ImageEnhance

SRC = "scripts/osaka2/plates"
OUT = "scripts/osaka2/graded"
GAIN, CONTRAST, SAT = 0.46, 1.18, 1.10
os.makedirs(OUT, exist_ok=True)
picks = json.load(open("scripts/osaka2/picks.json"))
for key, cand in picks.items():
    im = Image.open(os.path.join(SRC, f"{cand}.png")).convert("RGB")
    im = ImageEnhance.Brightness(im).enhance(GAIN)
    im = ImageEnhance.Contrast(im).enhance(CONTRAST)
    im = ImageEnhance.Color(im).enhance(SAT)
    im.save(os.path.join(OUT, f"{key}.png"))
    print(f"  {key:10s} <- {cand}")
print(f"{len(picks)} plates graded to gain={GAIN} contrast={CONTRAST} sat={SAT}")
