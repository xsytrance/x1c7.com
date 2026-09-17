#!/usr/bin/env python3
"""SUMMER DRIP v2 — the word list for 0.00 -> 60.00.

Timings are Parakeet TDT on the FULL MIX, which works unusually well here: the
lead vocal sits forward and the model caught every ad-lib chop. No stems needed,
unlike drink-drink (§25) where the pitched chant was inaudible to ASR.

What ASR could not do is the TEXT. It is a southern flow with heavy chops and
it mis-heard the two most important lines in the song:

    "He turned up"              ->  "HEAT turned up"     (the Sovereign's own note)
    "I feel the sun dress glow" ->  "I feel this SUNDRESS glow"
    "My mouth's so sweet"       ->  "SMILE so sweet"
    "high class gain"           ->  "high-class GAME"
    "Every weapon's so proud"   ->  "every WHISPER so proud"
    "Long lace off hands"       ->  "Long LEGS, SOFT hands"
    "hit a step on my tone"     ->  "had to SAVOR my tone"

So: ASR supplies the clock, official-lyrics.txt supplies the words. Every stamp
below is an ASR onset; every spelling is the official sheet.

    ~/whisper-venv/bin/python scripts/sd2/build_words.py
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FROM, TO = 0.00, 60.00

# (onset, official word). The eight "every" repeats at 1.68-5.68 and the
# "me/me/me" tail at 13.76-15.04 are real chopped ad-libs, not alignment noise —
# they are the screwed-tape stutter the song opens with, and they are what the
# TRAIL layout is built to stage.
W = [
    (0.24,"Heat"),(0.64,"turned"),(1.20,"up"),
    (1.68,"every"),(2.24,"every"),(2.72,"every"),(3.20,"every"),
    (3.76,"every"),(4.24,"every"),(4.72,"every"),(5.20,"every"),
    (5.68,"every"),(6.08,"stare"),(6.72,"feel"),(7.20,"loud"),
    (8.08,"Slow"),(8.48,"it"),(8.64,"down"),
    (9.20,"Summer"),(9.60,"drip"),(10.16,"Summer"),(10.72,"drip"),
    (11.20,"Hips"),(11.68,"flip"),(12.16,"flip"),(12.72,"walk"),(13.28,"mean"),
    (13.76,"mean"),(14.16,"mean"),(14.64,"mean"),(15.04,"mean"),
    (16.96,"I"),(17.20,"feel"),(17.52,"this"),(17.68,"sundress"),(18.72,"glow"),
    (19.20,"under"),(19.52,"the"),(19.76,"daylight"),
    (20.72,"Hips"),(21.20,"swing"),(21.68,"slow"),
    (22.24,"moving"),(22.72,"smooth"),(23.28,"in"),(23.52,"the"),(23.84,"midnight"),
    (24.80,"Heart"),(25.28,"stay"),(25.60,"cold"),
    (26.24,"but"),(26.48,"my"),(26.72,"stride"),(27.36,"got"),(27.60,"flame"),
    (28.88,"Every"),(29.28,"little"),(29.68,"step"),(30.24,"got"),(30.64,"a"),
    (30.80,"high"),(31.28,"class"),(31.68,"game"),
    (32.56,"Smile"),(33.36,"so"),(33.60,"sweet"),
    (34.24,"with"),(34.48,"the"),(34.72,"timing"),(35.28,"just"),(35.60,"right"),
    (36.88,"Brown"),(37.28,"skin"),(37.68,"shine"),
    (38.32,"with"),(38.56,"the"),(38.72,"streetlamp"),(39.68,"light"),
    (40.40,"Perfume"),(41.76,"thick"),(42.24,"got"),(42.48,"em"),(42.72,"stuck"),
    (43.12,"in"),(43.28,"a"),(43.44,"bind"),
    (44.24,"all"),(44.56,"all"),(44.88,"all"),(45.04,"these"),(45.28,"hungry"),(45.84,"eyes"),
    (46.32,"got"),(46.56,"em"),(46.80,"losing"),(47.28,"they"),(47.76,"mind"),
    (49.60,"Walked"),(49.92,"in"),(50.08,"the"),(50.16,"spot"),
    (50.48,"had"),(50.72,"to"),(50.80,"savor"),(51.04,"my"),(51.28,"tone"),
    (51.68,"Whole"),(52.00,"room"),(52.32,"staring"),(52.56,"like"),(52.72,"a"),
    (52.80,"queen"),(53.04,"on"),(53.20,"a"),(53.28,"throne"),
    (53.68,"Dance"),(54.00,"floor"),(54.32,"quiet"),(54.56,"but"),(54.72,"the"),
    (54.80,"glances"),(55.28,"loud"),
    (55.52,"Every"),(55.76,"lens"),(56.08,"locked"),(56.32,"in"),
    (56.48,"every"),(56.72,"whisper"),(57.12,"so"),(57.28,"proud"),
    (57.52,"Long"),(57.84,"legs"),(58.16,"soft"),(58.40,"hands"),
    (58.72,"curves"),(59.12,"on"),(59.20,"the"),(59.36,"rise"),
]
w = [(t, x) for t, x in W if FROM <= t <= TO]
(HERE / "words.json").write_text(json.dumps(
    {"source": "parakeet-tdt on the full mix for onsets; TEXT corrected against "
               "official-lyrics.txt (ASR mis-heard 'Heat turned up' as 'He turned up' "
               "and 'this sundress glow' as 'the sun dress glow')",
     "words": [{"t": t, "w": x} for t, x in w]}, indent=2))
runs, cur = [], []
for t, x in w:
    if cur and x.lower() == cur[-1][1].lower():
        cur.append((t, x))
    else:
        if len(cur) >= 3: runs.append(cur)
        cur = [(t, x)]
if len(cur) >= 3: runs.append(cur)
print(f"wrote {HERE/'words.json'}  —  {len(w)} words in {FROM}-{TO}")
print(f"  {len(runs)} stutter runs of 3+ (what TRAIL stages):")
for r in runs:
    print(f"    {r[0][0]:6.2f} -> {r[-1][0]:6.2f}  '{r[0][1]}' x{len(r)}")
gaps = [w[i+1][0]-w[i][0] for i in range(len(w)-1)]
print(f"  longest gap {max(gaps):.2f}s (wipe needs >=7)")
