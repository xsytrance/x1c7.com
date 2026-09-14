#!/usr/bin/env python3
"""Days Drift By v2 — CURATED words for the three windows, and the mode schedule.

Two things make v2 different from v1, both owner-directed:

1. It opens on the FIRST chorus ("Days drift by..."), not on Verse 2.
2. ~70% of the running time is DYNAMIC (one giant word owning the frame, with a
   word FX on it) and ~30% is PHRASE (the whole line, plain and readable).
   Phrase mode renders words with no FX at all — that contrast IS the design:
   the animated words are the statements, the phrase lines are the sentences.

And the third thing, which is the reason this file exists at all: **not every
lyric is drawn.** A word that is not in this array is never rendered, and in
dynamic mode the previous word simply holds the frame longer — which is exactly
how you emphasise. 13 words are deliberately dropped ("tonight", "floating into
the", the second "Through the", the connectives in "Then the sun / Finds his").
52 words survive of the 65 v1 drew.

Window edges all sit on beats from senses.json, and both joins are bar-aligned:
  W1 end beat 174 -> W2 start beat 210 = 36 beats =  9 bars
  W2 end beat 259 -> W3 start beat 351 = 92 beats = 23 bars
"""
import json

# W1 runs to beat 174, not 170: the final "Stay" (89.28) carries `linger`, whose
# arc is "tries to leave, is pulled back, twice, then settles" and needs ~1.6s
# minimum. At beat 170 it had 1.09s and the settle was cut off mid-pull. Beat 174
# gives it 3.14s. W3 gives the 2.05s back (its own end needs no bar alignment)
# so the cut still lands at 59.5s.
W1_FROM, W1_TO = 67.524, 92.415    # beats 125 -> 174   first chorus
W2_FROM, W2_TO = 110.829, 135.883  # beats 210 -> 259   verse 2 + the bridge
W3_FROM, W3_TO = 182.741, 193.492  # beats 351 -> 372   the drift-away repeats

# (time, word) — onsets from the Parakeet pass over the isolated lead stem.
# The first chorus was re-transcribed as its own 26s slice for v2; the full-song
# pass had merged "Days drift by" into the line after it.
W1 = [
    (68.16, "Days"), (68.96, "drift"), (69.52, "by"),
    (70.32, "We"), (70.64, "don't"), (71.04, "have"),
    (71.36, "to"), (71.68, "know"), (71.98, "why"),
    (73.60, "Breathe"),                       # "tonight" dropped — BREATHE holds
    (75.76, "Everything"), (76.80, "feels"), (77.44, "alive"),
    (79.12, "Days"), (79.92, "drift"), (80.48, "by"),
    (82.80, "sky"),                           # "floating into the" dropped
    (83.60, "Stay"), (84.16, "with"), (84.48, "me"),
    (86.24, "Stay"), (86.88, "with"), (87.20, "me"),
    (89.28, "Stay"),                          # the last one, alone and giant
]

W2 = [
    (111.60, "Clouds"), (112.24, "roll"), (112.64, "in"),
    (112.88, "Then"), (113.12, "fade"), (113.60, "away"),
    (114.88, "color"), (115.28, "melts"), (116.40, "gray"),   # "Every/into" dropped
    (117.44, "sun"), (118.72, "way"),                         # "Then the/Finds his" dropped
    (120.24, "Just"), (120.80, "like"), (121.12, "it"),
    (121.44, "always"), (122.24, "does"),
    (123.28, "Closer"), (124.64, "Closer"),
    (126.80, "light"),                                        # "Into the" dropped
    (128.80, "Higher"), (130.16, "Higher"),
    (132.24, "leaves"),                                       # "Through the" dropped
]

W3 = [
    (183.70, "Days"), (184.72, "drift"), (185.52, "by"),
    (188.24, "Days"), (190.16, "drift"), (190.80, "by"),
]

# ── the mode schedule ────────────────────────────────────────────────────────
# Declared CONTIGUOUSLY across every render window: outside a declared window
# the viewer's own mode stands (the render URL's `mode=dynamic`), and leaving
# that to a default is how a stray phrase line shows up in a dynamic stretch.
# Boundaries sit BETWEEN words, never inside a line (playbook §11 — a window
# that swallows part of a line draws the giant word on top of the phrase).
MODES = [
    (W1_FROM, 70.10, "dynamic"),   # DAYS / drift / by      — the title, three hits
    (70.10, 73.20, "phrase"),      # "We don't have to know why"
    (73.20, 75.50, "dynamic"),     # BREATHE                — one word, one breath
    # "Everything feels" reads as a line, then ALIVE takes the frame alone.
    # This is §6's mode-conductor micro-window: a dynamic punch holding EXACTLY
    # one word, so it can't draw a giant word on top of a live phrase line.
    (75.50, 77.30, "phrase"),      # "Everything feels alive" (all three, plain)
    (77.30, 78.60, "dynamic"),     # ALIVE                  — sunwake, alone
    (78.60, 83.30, "dynamic"),     # DAYS / drift / by / SKY
    (83.30, 88.20, "phrase"),      # "Stay with me" ×2
    # 88.20, not 87.60: preflight flagged the earlier boundary landing 0.40s
    # INTO "me" (87.20), which re-renders that word mid-entrance. 88.20 sits in
    # the clear gap — 1.00s after "me" lands, 1.08s before "Stay" (89.28).
    (88.20, W1_TO, "dynamic"),     # STAY                   — alone, lingering

    (W2_FROM, 114.20, "phrase"),   # "Clouds roll in" / "Then fade away"
    (114.20, 119.80, "dynamic"),   # color / melts / GRAY / SUN / way
    (119.80, 123.00, "phrase"),    # "Just like it always does"
    (123.00, W2_TO, "dynamic"),    # CLOSER / CLOSER / LIGHT / HIGHER / HIGHER / LEAVES

    (W3_FROM, W3_TO, "dynamic"),   # the whole drift-away tail
]

HOLE = 6.0   # cut-preflight's dead-air threshold


def check(part, lo, hi, name):
    bad, prev = [], None
    for t, w in part:
        if not (lo <= t <= hi):
            bad.append(f"{w}@{t} outside {lo}-{hi}")
        if prev is not None and t <= prev:
            bad.append(f"{w}@{t} not after {prev}")
        prev = t
    lead, tail = part[0][0] - lo, hi - part[-1][0]
    gap, at = 0.0, None
    for i in range(len(part) - 1):
        g = part[i + 1][0] - part[i][0]
        if g > gap:
            gap, at = g, part[i][1]
    print(f"{name}: {len(part)}w over {hi-lo:.3f}s · lead {lead:.2f} · tail {tail:.2f} · "
          f"widest gap {gap:.2f}{f' after {at!r}' if at else ''}")
    for label, v in (("lead-in", lead), ("tail", tail), ("mid-window gap", gap)):
        if v > HOLE:
            bad.append(f"{name}: {label} {v:.2f}s > {HOLE}s — preflight will FAIL")
    for b in bad:
        print("  ERROR", b)
    return not bad


ok = (check(W1, W1_FROM, W1_TO, "w1") & check(W2, W2_FROM, W2_TO, "w2")
      & check(W3, W3_FROM, W3_TO, "w3"))

# ── mode schedule sanity: contiguous, and never splitting a line ──────────────
allw = W1 + W2 + W3
for (a0, a1, _), (b0, b1, _) in zip(MODES, MODES[1:]):
    if b0 < a1 - 1e-6:
        print(f"  ERROR modes overlap at {a1}/{b0}"); ok = False
dyn = sum(e - s for s, e, m in MODES if m == "dynamic")
tot = (W1_TO - W1_FROM) + (W2_TO - W2_FROM) + (W3_TO - W3_FROM)
print(f"\nmode mix: {dyn:.2f}s dynamic of {tot:.2f}s = {dyn/tot:.1%} (target ~70%)")
if not 0.62 <= dyn / tot <= 0.80:
    print("  ERROR dynamic share outside 62-80%"); ok = False

out = {
    "w1": [{"t": t, "w": w} for t, w in W1],
    "w2": [{"t": t, "w": w} for t, w in W2],
    "w3": [{"t": t, "w": w} for t, w in W3],
    "windows": {"w1": [W1_FROM, W1_TO], "w2": [W2_FROM, W2_TO], "w3": [W3_FROM, W3_TO]},
    "modes": [{"start": s, "end": e, "mode": m} for s, e, m in MODES],
}
json.dump(out, open("scripts/ddb/v2_words.json", "w"), indent=2)
print(f"wrote scripts/ddb/v2_words.json — {len(allw)} words "
      f"({tot:.2f}s raw, {tot-1.2:.2f}s after two 0.6s crossfades)")
raise SystemExit(0 if ok else 1)
