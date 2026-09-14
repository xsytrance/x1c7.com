#!/usr/bin/env python3
"""Days Drift By — the cut's tracks row.

Writes a SEPARATE hidden row (`days-drift-by-cut`), not a patch of the live
`days-drift-by` row: that one is public (hidden=false) and serves
/listen/days-drift-by, and this window-specific wiring — acts, per-window
sections, a 60s-tuned deck — would degrade the catalogue page. Per playbook
§13 the hidden row must point `audio_url` at /private/<slug>.mp3 or `useTracks`
silently renders a DIFFERENT song.

Schema traps this file is written to avoid (all silent, all produce a render
that completes and passes VERIFY with a pure-black backdrop — playbook §22):
  * assets.keywords / dynamicPlus.words keys are LOWERCASE; KineticStage
    lowercases the sung word before the lookup.
  * analysis.sections[] entries are {start, name, emotion, intensity,
    colorHint} — NOT {at, label}. activeSection() reads s.start.
  * the opening section of each window starts BEFORE that window, so it is
    already active on frame one (§19's 4.3s of black).
"""
import json

SLUG = "days-drift-by-cut"
EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev"
R2 = f"/planets/{SLUG}"
W = json.load(open("scripts/ddb/words.json"))
(A_FROM, A_TO) = W["windows"]["a"]
(B_FROM, B_TO) = W["windows"]["b"]
(C_FROM, C_TO) = W["windows"]["c"]
all_words = W["part_a"] + W["part_b"] + W["part_c"]


def lrc(t):
    m = int(t // 60)
    return f"[{m:02d}:{t - m * 60:05.2f}]"


# LRC lines drive phrase-mode line breaks (§10): <=7 words, each stamp within
# 0.6s of a real word onset. These stamps ARE word onsets, taken from words.json.
LINES = [
    (111.60, "Clouds roll in"),
    (112.88, "Then fade away"),
    (114.48, "Every color melts into gray"),
    (116.88, "Then the sun"),
    (117.84, "Finds his way"),
    (120.24, "Just like it always does"),
    (123.28, "Closer"),
    (124.64, "Closer"),
    (125.92, "Into the light"),
    (128.80, "Higher"),
    (130.16, "Higher"),
    (131.44, "Through the leaves"),
    (155.44, "Days drift by"),
    (157.60, "We don't have to know why"),
    (160.96, "Breathe tonight"),
    (163.04, "Everything feels alive"),
    (166.48, "Days drift by"),
    (168.40, "Floating into the sky"),
    (170.72, "Stay with me"),
    (173.44, "Stay with me"),
    (183.70, "Days drift by"),
    (188.24, "Days drift by"),
]
lyrics = "\n".join(f"{lrc(t)}{txt}" for t, txt in LINES)

SIZES = {
    "clouds": "WIDE", "fade": "WIDE", "gray": "WIDE", "sun": "WIDE", "way": "MED",
    "closer": "MED", "light": "WIDE", "higher": "WIDE", "leaves": "CLOSE",
    "days": "WIDE", "drift": "MED", "by": "WIDE", "breathe": "WIDE",
    "alive": "MED", "floating": "WIDE", "sky": "WIDE", "stay": "WIDE",
    "tonight": "WIDE", "rain": "WIDE", "heron": "MED", "pine": "WIDE",
    "gold": "WIDE",
}
url = lambda n: f"{R2}/scene-{n}.webp"
shots = {url(n): s for n, s in SIZES.items()}

# Keyword anchors must sit >=1s apart (§4) or the backdrop strobes. "Days drift
# by" fires three words inside 1.36s, so only `days` is an anchor — `drift`,
# `by`, `sky` and `tonight` are demoted into the gallery pool below, where they
# still reach the screen. Same reason `stay` is kept over `sky` (0.72s apart):
# the two tiny distant figures are this planet's one human beat.
keywords = {
    # Part A — Verse 2 into the Bridge
    "clouds": url("clouds"), "fade": url("fade"), "gray": url("gray"),
    "sun": url("sun"), "way": url("way"), "closer": url("closer"),
    "light": url("light"), "higher": url("higher"), "leaves": url("leaves"),
    # Part B — the final chorus
    "days": url("days"), "breathe": url("breathe"), "alive": url("alive"),
    "floating": url("floating"), "stay": url("stay"),
}

# §3e — the dominant-word freeze. "days"/"drift"/"by" are 12 of part B's 33
# words and `days` alone fires 4 times; without a pool the screen locks to one
# plate for every repeat. gallery.json (uploaded to R2) lets pooledArt() rotate
# a different plate on each occurrence, and the shot-grammar rule in pooledArt
# keeps it from playing two same-size plates back to back.
#
# `stay` deliberately has NO pool. It did, and the first render proved why that
# was wrong: pooledArt's shot-grammar rule ("never play two same-size shots back
# to back") walks past any pool entry matching the plate already on stage.
# scene-stay is WIDE and scene-floating (the plate it follows) is WIDE, so turn
# 0 skipped it to heron, and turn 1 skipped heron to tonight — the lone figure
# at dusk, the only human image on this whole planet, never reached the screen
# on the one line it was painted for. With no pool, pooledArt returns the base
# url outright and the figure plays on both "Stay with me" lines; §15's
# "same-url hits never cut" then holds it across the pair, which is the beat.
gallery = {
    "art": {
        "days": [url("drift"), url("by"), url("sky"), url("gold"),
                 url("rain"), url("pine"), url("heron"), url("tonight")],
        "closer": [url("light"), url("way")],
        "higher": [url("pine"), url("sky")],
    }
}

# Ambient coverage between keyword hits (emotion -> plate, lowercase).
sections_art = {
    "drifting": url("by"), "warming": url("gold"), "rising": url("pine"),
    "floating": url("sky"), "tender": url("heron"), "breaking": url("rain"),
    "fading": url("tonight"),
}

# Every intensity <=0.71 (0.72+ synthesises a "shake" banner) and every
# CONSECUTIVE delta <0.25 (>=0.25 synthesises a "blow" banner) — §14.
# The 175.5/179.5 pair exists to give the 9.14s instrumental break two art
# changes instead of one 8-second freeze.
analysis_sections = [
    {"start": 105.00, "name": "the weather turns", "emotion": "drifting",
     "intensity": 0.38, "colorHint": "#7FA8B8"},
    {"start": 116.80, "name": "the sun finds its way", "emotion": "warming",
     "intensity": 0.52, "colorHint": "#E8C25A"},
    {"start": 123.20, "name": "the ascent", "emotion": "rising",
     "intensity": 0.66, "colorHint": "#9FD8C8"},
    {"start": 150.00, "name": "days drift by", "emotion": "floating",
     "intensity": 0.58, "colorHint": "#A8D4E8"},
    {"start": 168.00, "name": "stay with me", "emotion": "tender",
     "intensity": 0.68, "colorHint": "#E8A88C"},
    {"start": 175.50, "name": "the liquid break", "emotion": "breaking",
     "intensity": 0.60, "colorHint": "#8FC4D8"},
    {"start": 179.50, "name": "the break widens", "emotion": "drifting",
     "intensity": 0.55, "colorHint": "#8FC4D8"},
    {"start": 183.50, "name": "drift away", "emotion": "fading",
     "intensity": 0.48, "colorHint": "#C8D8E0"},
    # Window C's last word lands at 190.80 with 4.8s of wordless vocal texture
    # still to run. Without a boundary here the final image would hold for 7.3s;
    # this lands the cut on the golden-hour valley instead of freezing.
    {"start": 191.00, "name": "the last light", "emotion": "warming",
     "intensity": 0.42, "colorHint": "#E8C25A"},
]

word_fx = {
    "clouds": "dissolve", "fade": "dissolve", "away": "dissolve",
    "gray": "melt", "sun": "shimmer", "way": "rise", "closer": "whisper",
    "light": "bloom", "higher": "rise", "leaves": "wave",
    "days": "echo", "drift": "wave", "by": "echo", "breathe": "fogbreath",
    "tonight": "whisper", "everything": "bloom", "alive": "bloom",
    "floating": "rise", "sky": "rise", "stay": "cling", "me": "whisper",
}

# §14 — the synthesised wipe. The LONGEST sung-word gap in the array is not the
# 9.14s break inside part B; it is the 23.20s hole BETWEEN the two windows
# (132.24 -> 155.44). The engine would place a "wipe the fog away" banner at
# 133.64-143.64, whose first 0.2s falls inside part A's tail. free() only
# refuses when a choreographed moment sits within +-8s, so the blocker has to be
# adjacent — parked at 134.5 it is inside neither render window and is therefore
# never drawn, while still suppressing the banner.
moments = [{"t": 134.50, "end": 135.50, "type": "wipe", "layer": "fog", "prompt": ""}]

planet = {
    "generatedAt": "2026-09-14T00:00:00.000Z",
    "styleHint": (
        "PAPER RIVER — ukiyo-e woodblock illustration, one forested river valley "
        "across one day. Flat layered colour, bokashi gradient skies, Prussian "
        "blue water, banded mist, visible woodgrain. Full bleed, never signed: "
        "a cartouche renders as garbage letters on screen."
    ),
    "analysis": {
        "themes": ["drifting", "weather", "light through leaves", "letting time pass",
                   "staying"],
        # THE WORD COLOUR ARRAY, not a mood board (§19): every entry has to stay
        # legible on the darkest plate in the cut (the blue-hour valley), so the
        # whole array is light/warm. A near-black entry renders invisible words.
        "palette": ["#F4EAD6", "#F5C86B", "#9FD8C8", "#F0A88C", "#D9E8F2"],
        "summary": ("Liquid drum and bass that refuses to hurry. Clouds roll in, the "
                    "colour drains, the sun finds its way back, and the song climbs "
                    "through the leaves into its own last repeat."),
        "keywords": [],
        "sections": analysis_sections,
        "overallMood": "weightless calm",
    },
    "assets": {
        "broll": [],
        "stems": f"{EDGE}/planets/days-drift-by/stems/stems.json",
        "stemLag": -0.023,
        "shots": shots,
        "keywords": keywords,
        "sections": sections_art,
    },
    "interactions": {"moments": moments, "tapEffect": "bloom"},
    "dynamicPlus": {
        "v": 2,
        "directed": (
            "DAYS DRIFT BY 59.2s spliced cut — PAPER RIVER voice, 22 plates. "
            f"A {A_FROM}-{A_TO} (Verse 2 into the Bridge ascent), "
            f"B {B_FROM}-{B_TO} (the final chorus), "
            f"C {C_FROM}-{C_TO} (the drift-away repeats), joined with two 0.6s "
            "crossfades. The B/C join splices INSIDE the 9.14s liquid break "
            "rather than around it, which keeps every lyric while cutting the "
            "dead air under preflight's 6s threshold. Every edge is on a beat "
            "and both joins are bar-aligned (10 bars, then 2), so the "
            "crossfades blend drum patterns that are in phase."
        ),
        "scene": "RIVER",
        "acts": [
            {"start": A_FROM, "end": 123.20, "label": "CLOUDS ROLL IN",
             "why": "the weather turns and the colour drains"},
            {"start": 123.20, "end": A_TO, "label": "THE ASCENT",
             "why": "closer, into the light, higher, through the leaves"},
            {"start": B_FROM, "end": 175.50, "label": "DAYS DRIFT BY",
             "why": "the final chorus"},
            {"start": 175.50, "end": 183.50, "label": "THE LIQUID BREAK",
             "why": "the instrumental the song was always drifting toward"},
            {"start": 183.50, "end": C_TO, "label": "DRIFT AWAY",
             "why": "the last two repeats"},
        ],
        # phrase throughout (§11): dynamic's HUGE-single-word treatment clips at
        # loud moments and this is a 9:16 lyric cut, where correct LRC lines read
        # better than a clipped spectacle.
        "modes": [{"start": A_FROM, "end": A_TO, "mode": "phrase"},
                  {"start": B_FROM, "end": B_TO, "mode": "phrase"},
                  {"start": C_FROM, "end": C_TO, "mode": "phrase"}],
        "words": word_fx,
        "deck": {
            "glow": 0.9, "grain": 0.35, "density": 1.6, "vignette": 0.45,
            "giant": {"life": 2200, "pile": 0, "clearOnSwitch": True},
            # 900ms cross-dissolves consecutive plates into a double exposure (§19)
            "motion": {"swapMs": 650},
        },
        "hits": [], "holds": [], "rolls": [],
    },
}

row = {
    "id": SLUG,
    "title": "Days Drift By",
    "artist": "AGENOR",
    "genre": "Liquid Drum & Bass",
    "mood": "weightless calm",
    "color": "#7FB7A8",
    "cover": f"{EDGE}{R2}/scene-days.webp",
    "audio_url": f"/private/{SLUG}.mp3",   # §13 — a hidden row needs /private/
    "sort_order": 9002,
    "featured": False,
    "hidden": True,
    "lyrics": lyrics,
    "lyrics_synced": {
        "source": "parakeet-tdt-0.6b-v3 on the isolated lead stem, RMS-verified",
        "refinedAt": "2026-09-14T00:00:00.000Z",
        "words": [{"t": w["t"], "w": w["w"]} for w in all_words],
    },
    "planet": planet,
}

json.dump(row, open("scripts/ddb/row.json", "w"), indent=2)
json.dump(gallery, open("scripts/ddb/gallery.json", "w"), indent=2)

# ── self-checks for the traps that do not raise ──────────────────────────────
bad = []
for k in list(keywords) + list(word_fx) + list(sections_art) + list(gallery["art"]):
    if k != k.lower():
        bad.append(f"non-lowercase key {k!r}")
for s in analysis_sections:
    if not {"start", "name", "emotion", "intensity", "colorHint"} <= set(s):
        bad.append(f"section {s.get('name')} missing a required field")
    if s["intensity"] >= 0.72:
        bad.append(f"section {s['name']} intensity {s['intensity']} >= 0.72 (shake)")
for a, b in zip(analysis_sections, analysis_sections[1:]):
    if b["intensity"] - a["intensity"] >= 0.25:
        bad.append(f"intensity jump {a['name']}->{b['name']} >= 0.25 (blow)")
for e in set(s["emotion"] for s in analysis_sections):
    if e not in sections_art:
        bad.append(f"emotion {e!r} has no plate in assets.sections")
if analysis_sections[0]["start"] >= A_FROM:
    bad.append("opening section does not start before part A")
# keyword anchors >=1s apart, per window
for part, lo, hi in (("part_a", A_FROM, A_TO), ("part_b", B_FROM, B_TO),
                     ("part_c", C_FROM, C_TO)):
    hits = [(w["t"], w["w"].lower().strip(".,!?")) for w in W[part]
            if w["w"].lower().strip(".,!?") in keywords]
    for (t0, w0), (t1, w1) in zip(hits, hits[1:]):
        if t1 - t0 < 1.0 and keywords[w0] != keywords[w1]:
            bad.append(f"{part}: {w0}@{t0} -> {w1}@{t1} only {t1-t0:.2f}s apart")
    print(f"{part}: {len(hits)} keyword anchors")
wide = sum(1 for v in SIZES.values() if v == "WIDE")
close = sum(1 for v in SIZES.values() if v in ("CLOSE", "MACRO"))
print(f"shot histogram: WIDE {wide}/{len(SIZES)} = {wide/len(SIZES):.0%} (want >=33%), "
      f"CLOSE+MACRO {close}/{len(SIZES)} = {close/len(SIZES):.0%} (want <=25%)")
for m in bad:
    print("  ERROR", m)
print(f"\nwrote scripts/ddb/row.json ({len(all_words)} words, {len(LINES)} LRC lines) "
      f"and scripts/ddb/gallery.json")
raise SystemExit(1 if bad else 0)
