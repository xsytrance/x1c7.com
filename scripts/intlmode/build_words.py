#!/usr/bin/env python3
"""Build lyrics_synced.words for the two spliced windows of International
Mode. Official lyrics supply the TEXT; the Parakeet transcript supplies real
onset TIMES for whatever it confidently caught; anything it garbled or merged
(repeated "International" chants collapse into fewer/longer ASR tokens — see
skill notes) is filled by even interpolation between confirmed anchors, then
every word is snapped to the nearest measured beat so the chant lands on the
grid rather than at an arbitrary offset.
"""
import json, difflib

senses = json.load(open("scripts/song-analysis/profiles/international-mode/senses.json"))
BEATS = senses["beats"]
asr = json.load(open("/tmp/claude-1000/-home-xsyprime-Hermes-x1c7-com/a2f17fe6-cac1-4715-9f15-703859f06d27/scratchpad/intl-lead-words.json"))["words"]

def nearest_beat(t):
    return min(BEATS, key=lambda b: abs(b - t))

def official_tokens(text):
    out = []
    for line in text.strip().split("\n"):
        for w in line.split():
            out.append(w)
    return out

def build(official_text, t_from, t_to, asr_slice):
    words = official_tokens(official_text)
    n = len(words)
    # confident anchors: ASR tokens whose lowercase form appears in the
    # official word list, matched in order, one-to-one, skipping ahead.
    anchors = {}  # index in `words` -> time
    wi = 0
    for tok in asr_slice:
        w = tok["word"].strip(".,!?").lower()
        # search forward for a matching official word (loose ratio match)
        best_j, best_score = None, 0.55
        for j in range(wi, min(wi + 6, n)):
            score = difflib.SequenceMatcher(None, w, words[j].lower()).ratio()
            if score > best_score:
                best_score, best_j = score, j
        if best_j is not None:
            anchors[best_j] = tok["start"]
            wi = best_j + 1
    # always anchor first/last word to the window edges if nothing matched
    anchors.setdefault(0, t_from)
    anchors[n - 1] = anchors.get(n - 1, t_to - 0.3)
    # interpolate unanchored indices between the nearest anchors on either side
    idxs = sorted(anchors)
    out_t = [None] * n
    for k in range(len(idxs) - 1):
        i0, i1 = idxs[k], idxs[k + 1]
        t0, t1 = anchors[i0], anchors[i1]
        span = i1 - i0
        for i in range(i0, i1 + 1):
            out_t[i] = t0 if span == 0 else t0 + (t1 - t0) * (i - i0) / span
    for i in range(n):
        if out_t[i] is None:
            out_t[i] = t_from
    result = [{"t": round(nearest_beat(out_t[i]), 3), "w": words[i]} for i in range(n)]
    # The chant ad-libs more "International" repeats than the written lyric
    # sheet in long stretches (this song's own "Maximum Energy" section) —
    # fuzzy-matching every identical repeat to a fixed text count is fragile
    # and mis-anchors under pressure. Simpler and robust: after placing the
    # UNIQUE anchor words, backfill any gap wider than 4s with evenly spaced
    # "International" filler at the same ~1.8s cadence seen elsewhere, beat-
    # snapped, so the engine always has a word to paint.
    filled = [result[0]]
    for w in result[1:]:
        gap = w["t"] - filled[-1]["t"]
        if gap > 4.0:
            n_fill = max(1, round(gap / 1.8) - 1)
            for k in range(1, n_fill + 1):
                t = filled[-1]["t"] + gap * k / (n_fill + 1)
                filled.append({"t": round(nearest_beat(t), 3), "w": "International"})
        filled.append(w)
    return filled

PART_A_TEXT = """
International
International
International
Run it
International
International
International
"""
PART_A = build(PART_A_TEXT, 25.04, 39.2, [w for w in asr if 24 <= w["start"] <= 40])

PART_B_TEXT = """
Stamp it
Stamp it
Stamp it
Stamp it
Move it
Move it
Move it
Move it
International
International
International
World class
Touch road
Big bass
Airplane
Whiplash
International
International
International
Go far
From BK
To di stars
From di street
To di charts
International
International
International
Again
"""
PART_B = build(PART_B_TEXT, 120.14, 166.0, [w for w in asr if 119 <= w["start"] <= 167])

out = {"part_a": PART_A, "part_b": PART_B}
json.dump(out, open("scripts/intlmode/words.json", "w"), indent=2)
print(f"part_a: {len(PART_A)} words, {PART_A[0]['t']} -> {PART_A[-1]['t']}")
print(f"part_b: {len(PART_B)} words, {PART_B[0]['t']} -> {PART_B[-1]['t']}")
for w in PART_A: print(" A", w)
print()
for w in PART_B: print(" B", w)
