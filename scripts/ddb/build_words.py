#!/usr/bin/env python3
"""Days Drift By — lyrics_synced.words for the two spliced windows.

TEXT comes from the official lyric sheet (playbook §2/§9); TIMES come from the
Parakeet TDT pass over the isolated lead-vocal stem, RMS-verified against that
same stem. Where the full-song ASR pass merged or dropped a line, the 39s
Part-B slice pass resolved it — short slices recover lines the full pass loses.

Two measured facts this file encodes, both of which cost a probe to learn:

* The repo's own lyrics.lrc claims a final "Days drift by" at 210.92. The lead
  stem is DIGITALLY SILENT (-98 dB) from 203.5 to the end, so that line does not
  exist. The last real lyric is "by" at 190.80.
* 191-202 is not silence either — it is ~-25 dB of WORDLESS sustained vocal
  texture (the sheet's "distant vocal echoes"). Parakeet renders it as
  "Breath of the city" spread over 13 seconds with a word landing at 203.84,
  inside the silence: a textbook hallucination, discarded here.
"""
import json

# ── the windows ──────────────────────────────────────────────────────────
# THREE windows, not two. The obvious two-window cut (A + one 154.111-192.470
# block) runs 60.8s and cut-preflight FAILS it: the liquid break between "Stay
# with me" and the final repeats is 9.14s of dead air, 24% of that window, over
# the 6s a viewer reads as "it's broken". Splicing INSIDE the break instead of
# around it removes 4.09s of it and leaves 3.10s on one side and 1.96s on the
# other — both comfortably under the threshold — while keeping every lyric and
# the drift-away ending. This song has no 60 contiguous dense seconds anywhere;
# it is a liquid DnB record built out of long instrumentals.
#
# Every edge sits on a beat from senses.json, and each JOIN is bar-aligned, so
# the 0.6s acrossfade in merge-cuts.mjs blends drum patterns that are in phase:
#   A_end beat 255 -> B_from beat 295 = 40 beats = 10 bars
#   B_end beat 341 -> C_from beat 349 =  8 beats =  2 bars
A_FROM, A_TO = 110.829, 133.840   # beats 210 -> 255
B_FROM, B_TO = 154.111, 177.656   # beats 295 -> 341
C_FROM, C_TO = 181.743, 195.558   # beats 349 -> 376

# (time, word) — time is the word's true ONSET; held notes keep their start
# and are carried by the `cling` FX, never pushed late (playbook §6 MAX_HOLD).
PART_A = [
    # Verse 2
    (111.60, "Clouds"), (112.24, "roll"), (112.64, "in"),
    (112.88, "Then"), (113.12, "fade"), (113.60, "away"),
    (114.48, "Every"), (114.88, "color"), (115.28, "melts"),
    (116.08, "into"), (116.40, "gray"),
    (116.88, "Then"), (117.20, "the"), (117.44, "sun"),
    (117.84, "Finds"), (118.40, "his"), (118.72, "way"),
    (120.24, "Just"), (120.80, "like"), (121.12, "it"),
    (121.44, "always"), (122.24, "does"),
    # Bridge — the ascent
    (123.28, "Closer"), (124.64, "Closer"),
    (125.92, "Into"), (126.48, "the"), (126.80, "light"),
    (128.80, "Higher"), (130.16, "Higher"),
    (131.44, "Through"), (131.92, "the"), (132.24, "leaves"),
]

PART_B = [
    # Final chorus
    (155.44, "Days"), (156.24, "drift"), (156.80, "by"),
    (157.60, "We"), (157.92, "don't"), (158.32, "have"),
    (158.64, "to"), (158.96, "know"), (159.52, "why"),
    (160.96, "Breathe"), (161.84, "tonight"),
    (163.04, "Everything"), (164.00, "feels"), (164.80, "alive"),
    (166.48, "Days"), (167.20, "drift"), (167.76, "by"),
    (168.40, "Floating"), (169.28, "into"), (169.84, "the"), (170.00, "sky"),
    (170.72, "Stay"), (171.36, "with"), (171.76, "me"),
    (173.44, "Stay"), (174.08, "with"), (174.56, "me"),
]

# The drift-away tail, on the far side of the break. 183.70 is not an ASR word:
# Parakeet caught "drift" at 184.72 but not the "Days" in front of it, because
# the outro sits on continuous ~-25 dB vocal texture that no energy gate can cut
# into syllables. 183.70 is the onset boundary from a 0.1s RMS probe — a dip to
# -43.9 dB at 183.60 followed by a rise to -31.0 dB at 183.70 — and the 1.02s
# "Days"->"drift" spacing it implies matches the other repeats (0.80s, 0.72s).
PART_C = [
    (183.70, "Days"), (184.72, "drift"), (185.52, "by"),
    (188.24, "Days"), (190.16, "drift"), (190.80, "by"),
]


HOLE = 6.0   # cut-preflight's threshold: dead air a viewer reads as "broken"


def check(part, lo, hi, name):
    bad = []
    prev = None
    for t, w in part:
        if not (lo <= t <= hi):
            bad.append(f"{w}@{t} outside {lo}-{hi}")
        if prev is not None and t <= prev:
            bad.append(f"{w}@{t} not after {prev}")
        prev = t
    lead, tail = part[0][0] - lo, hi - part[-1][0]
    gap, gap_at = 0.0, None
    for i in range(len(part) - 1):
        g = part[i + 1][0] - part[i][0]
        if g > gap:
            gap, gap_at = g, part[i][1]
    print(f"{name}: {len(part)} words over {hi - lo:.3f}s ({lo}-{hi}) · "
          f"lead {lead:.2f}s · tail {tail:.2f}s · widest gap {gap:.2f}s"
          f"{f' after {gap_at!r}' if gap_at else ''}")
    for label, v in (("lead-in", lead), ("tail", tail), ("mid-window gap", gap)):
        if v > HOLE:
            bad.append(f"{name}: {label} {v:.2f}s > {HOLE}s — preflight will FAIL")
    for b in bad:
        print(f"  ERROR {b}")
    return not bad


ok = (check(PART_A, A_FROM, A_TO, "part_a")
      & check(PART_B, B_FROM, B_TO, "part_b")
      & check(PART_C, C_FROM, C_TO, "part_c"))

out = {
    "part_a": [{"t": t, "w": w} for t, w in PART_A],
    "part_b": [{"t": t, "w": w} for t, w in PART_B],
    "part_c": [{"t": t, "w": w} for t, w in PART_C],
    "windows": {"a": [A_FROM, A_TO], "b": [B_FROM, B_TO], "c": [C_FROM, C_TO]},
}
json.dump(out, open("scripts/ddb/words.json", "w"), indent=2)
n = len(PART_A) + len(PART_B) + len(PART_C)
total = (A_TO - A_FROM) + (B_TO - B_FROM) + (C_TO - C_FROM)
print(f"\nwrote scripts/ddb/words.json — {n} words, {total:.2f}s raw, "
      f"{total - 1.2:.2f}s after two 0.6s crossfades")
raise SystemExit(0 if ok else 1)
