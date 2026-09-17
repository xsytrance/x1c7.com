#!/usr/bin/env python3
"""INTERNATIONAL MODE — THE GOLDEN ATLAS, re-cut 2026-09-15.

Rebuilds the `international-mode-atlas` tracks row for a PURE DYNAMIC cut.
Three things changed from the 2026-09-15 first pass, all of them owner notes:

  1. TEXT — the first pass alternated dynamic/phrase every act, so the hook
     kept collapsing into a wrapped three-word wall ("INTERNATIONAL
     INTERNATIONAL INTERNATIONAL" on one line, colliding). Every mode window
     is `dynamic` now, so the schedule can never hand the stage back to
     phrase; the windows survive only as act punctuation (entering one fires
     the tape-warp + clears the giant-word residue, KineticStage ~L400).

  2. TIMING — every word stamp was re-measured off the isolated lead vocal
     stem. Whole-file Parakeet under-segments this song's chopped runs (it
     collapsed a five-hit stutter at 29.7-31.4 into one token, and mislabelled
     "Gate"/"closed" so the pair landed ~0.35s late with the second word
     missing entirely). Transcribing SECTION SLICES separately recovers them,
     and every stamp below is confirmed by a 20ms RMS profile of the stem.

  3. NO BACKDROP SCENE — the first pass pinned `scene: "AURORA"`, which IS a
     real BACKDROP_SCENES entry, so the GL aurora painted behind plates that
     only render at 0.6 opacity: every landmark came back hazed with white
     curtain light. Warm Without Burning looked clean because its "LACQUER"
     was NOT a valid scene name and the engine silently ignored it. Omitting
     the key is the honest version of the same thing.

    python3 scripts/intlmode/build_atlas_row.py   -> scripts/intlmode/atlas-row.json
    node scripts/_kiz-db.mjs upsert scripts/intlmode/atlas-row.json
"""
import json
from pathlib import Path

SLUG = "international-mode-atlas"
R2 = f"/planets/{SLUG}"
CDN = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev"
OUT = Path(__file__).resolve().parent / "atlas-row.json"

FROM, TO = 0.00, 62.40

def s(n): return f"{R2}/scene-{n}.webp"

# ── THE WORDS ──────────────────────────────────────────────────────────────
# (t, word). Onsets measured on "0 Lead Vocals.mp3" decoded with ffmpeg — the
# stem's mp3 header claims 254s for a 207s song, so never trust ffprobe here.
# Every one verified >= -36 dB mean over its first 300ms (gate -42); the 300ms
# before the first word of each phrase reads -55 to -101 dB, which is what
# proves the gate is measuring onsets and not a constant floor.
WORDS = [
    (1.63,  "International"), (5.00,  "International"), (8.56,  "International"),
    (10.70, "Yeah"),
    (11.95, "Worldwide"),
    (14.98, "Touch"), (15.40, "road"), (16.29, "road"),
    (18.22, "Passport"),
    (21.68, "Stamp"), (22.08, "that"),
    (24.88, "International"), (28.22, "International"),
    # the five-hit chop the whole-file pass heard as ONE word, on the beat
    # grid (143.55 BPM -> 0.418s): 29.74 / 30.19 / 30.59 / 31.01 / 31.42.
    (29.74, "Run"), (30.19, "it"), (30.59, "Run"), (31.01, "it"), (31.42, "Run"),
    (31.66, "International"), (33.79, "International"), (34.82, "International"),
    (39.16, "Big"), (39.62, "sound"),
    (39.98, "Border"),
    (40.64, "Flight"), (41.22, "mode"),
    (41.74, "Gate"), (42.05, "closed"),
    (42.59, "Still"), (42.96, "go"),
    (43.30, "International"), (44.20, "International"), (45.01, "International"),
    (46.06, "Move"), (46.40, "fast"),
    (52.07, "Yo"),
    (52.50, "From"), (52.68, "yard"), (53.08, "to"), (53.35, "foreign"),
    (54.11, "Foreign"), (54.62, "to"), (54.94, "yard"),
    (55.33, "Tell"), (55.70, "dem"),
    (56.60, "International"), (57.56, "International"),
    (58.48, "International"), (59.97, "International"),
    (61.18, "Large"),
]

# ── THE LRC ────────────────────────────────────────────────────────────────
# Every line stamp is EXACTLY a word stamp, so phraseStartIdx matches on the
# nose instead of falling back to breath-gap guessing. In dynamic mode these
# only decide which word is line-FINAL (extra stage presence + ghost echo).
LINES = [
    (1.63, "International"), (5.00, "International"), (8.56, "International"),
    (10.70, "Yeah"), (11.95, "Worldwide"),
    (14.98, "Touch road road"), (18.22, "Passport"), (21.68, "Stamp that"),
    (24.88, "International"), (28.22, "International"),
    (29.74, "Run it Run it Run"),
    (31.66, "International"), (33.79, "International"), (34.82, "International"),
    (39.16, "Big sound"), (39.98, "Border"), (40.64, "Flight mode"),
    (41.74, "Gate closed"), (42.59, "Still go"),
    (43.30, "International"), (44.20, "International"), (45.01, "International"),
    (46.06, "Move fast"),
    (52.07, "Yo"), (52.50, "From yard to foreign"), (54.11, "Foreign to yard"),
    (55.33, "Tell dem"),
    (56.60, "International"), (57.56, "International"),
    (58.48, "International"), (59.97, "International"),
    (61.18, "Large"),
]
def lrc(t):
    m = int(t // 60)
    return f"[{m:02d}:{t - m * 60:05.2f}]"
lyrics = "\n".join(f"{lrc(t)}{txt}" for t, txt in LINES)

# ── SECTIONS ───────────────────────────────────────────────────────────────
# §14 guards, checked below: every intensity <= 0.71 (0.72+ synthesises a
# SHAKE banner) and every consecutive delta < 0.25 (>= 0.25 synthesises a
# BLOW). "the long haul" exists to put a section boundary INSIDE the 5.7s
# instrumental gap, so the ambient plate changes instead of freezing (§3e).
SECTIONS = [
    {"start": 0.00,  "name": "the chop",       "emotion": "arrival",  "intensity": 0.58, "colorHint": "#F2B33D"},
    {"start": 10.70, "name": "worldwide",      "emotion": "transit",  "intensity": 0.50, "colorHint": "#4FA8D8"},
    {"start": 24.88, "name": "drop cue",       "emotion": "arrival",  "intensity": 0.62, "colorHint": "#F2B33D"},
    {"start": 31.66, "name": "beat drop",      "emotion": "engine",   "intensity": 0.68, "colorHint": "#E2703A"},
    {"start": 39.16, "name": "border run",     "emotion": "transit",  "intensity": 0.56, "colorHint": "#4FA8D8"},
    {"start": 43.30, "name": "the chant wall", "emotion": "engine",   "intensity": 0.70, "colorHint": "#E2703A"},
    # amber, not the violet this cut first carried: the plate renders at 0.6
    # alpha, so the section's colour leans the backdrop THROUGH it — a violet
    # lean turned the golden-hour plane plates lilac.
    {"start": 47.20, "name": "the long haul",  "emotion": "flight",   "intensity": 0.54, "colorHint": "#E2A23A"},
    {"start": 52.07, "name": "the dj shout",   "emotion": "homeland", "intensity": 0.64, "colorHint": "#43C46B"},
    {"start": 56.60, "name": "closing chant",  "emotion": "arrival",  "intensity": 0.70, "colorHint": "#F2B33D"},
]
for i in range(1, len(SECTIONS)):
    d = abs(SECTIONS[i]["intensity"] - SECTIONS[i - 1]["intensity"])
    assert d < 0.25, f"BLOW banner risk: delta {d:.2f} at {SECTIONS[i]['name']}"
    assert SECTIONS[i]["intensity"] <= 0.71, f"SHAKE banner risk at {SECTIONS[i]['name']}"
# The third synthesis path (WIPE) needs a sung-word gap >= 7s; the longest here
# is 46.40 -> 52.07 = 5.67s, so all three are refused and the cut needs no
# decoy moment to block them (which is what Warm Without Burning had to do).
_gaps = [(WORDS[i + 1][0] - WORDS[i][0]) for i in range(len(WORDS) - 1)]
assert max(_gaps) < 7.0, f"WIPE banner risk: {max(_gaps):.2f}s gap"

# ── ART ────────────────────────────────────────────────────────────────────
# Lowercase keys — KineticStage lowercases the sung word before indexing (§3d).
# The hook word IS mapped, and has a 14-plate gallery pool behind it, because a
# word that is 12 of 50 words freezes the screen for its whole run otherwise.
KEYWORDS = {
    "international": s("jp"),
    "worldwide": s("world"),
    # The old scene-road was two anonymous women walking away down a desert
    # highway — the Sovereign: "it's just 2 random girls on a road." Replaced
    # at his brief ("pick a famous road and put a flag on it") with Route 66
    # under a full-size American flag. scene-road is now referenced by nothing.
    "touch": s("route66"), "road": s("route66"), "go": s("route66"),
    # a passport being stamped carries "Passport" (18.22) straight into
    # "Stamp that" (21.68) on one plate, and the airport gate later.
    "passport": s("passport"), "stamp": s("passport"),
    "gate": s("passport"), "closed": s("passport"),
    # scene-stomp — a close crop of bare legs on a dance floor — is OUT at the
    # Sovereign's word (2026-09-15): "I don't like bare skin images like that."
    # Its three words go to plates that carry the same MOTION with people
    # dressed for the weather: the Great Wall lantern run, and the Bo-Kaap jump.
    "run": s("cn"), "move": s("za"),
    "border": s("fly"), "flight": s("fly"), "mode": s("fly"), "fast": s("fly"),
    "foreign": s("in"),
    "big": s("globe"), "large": s("globe"),
    "yo": s("jm"), "yard": s("jm"), "tell": s("jm"), "dem": s("jm"),
}
# "arrival" covers 0-10.7, 24.9-31.7 and 56.6-62.4 — most of the cut — so its
# ambient plate is the one the eye sees most. It was the globe, which is ALSO
# in the hook's rotation pool and as "big"/"large", so the globe kept coming
# back. scene-world is in neither.
SECTION_ART = {
    "arrival": s("world"), "transit": s("route66"),
    "engine": s("us"), "flight": s("fly"), "homeland": s("jm"),
}
COUNTRIES = ["eg", "in", "br", "gr", "pe", "it", "cn", "fr", "mx", "jo", "us", "au", "za",
             "ph", "ng", "th", "tr", "ma", "de", "es", "gb", "kr", "sg"]
SHOTS = {s(n): sz for n, sz in [
    ("au", "WIDE"), ("br", "MED"), ("cn", "MED"), ("eg", "MED"), ("fr", "WIDE"),
    ("gr", "WIDE"), ("in", "WIDE"), ("it", "WIDE"), ("jm", "WIDE"), ("jo", "WIDE"),
    ("jp", "WIDE"), ("mx", "MED"), ("pe", "MED"), ("us", "MED"), ("za", "MED"),
    # the 2026-09-15 expansion — ten more countries so a hook word that fires
    # fifteen times has somewhere new to land every time
    ("ph", "WIDE"), ("ng", "WIDE"), ("th", "WIDE"), ("tr", "WIDE"), ("ma", "WIDE"),
    ("de", "MED"), ("es", "MED"), ("gb", "MED"), ("kr", "WIDE"), ("sg", "WIDE"),
    ("fly", "MED"), ("route66", "WIDE"), ("globe", "WIDE"),
    ("world", "WIDE"), ("passport", "CLOSE"),
]}

# ── TEXT EFFECTS ───────────────────────────────────────────────────────────
# Registry ids (src/lib/effects/registry.ts), chosen for what the word MEANS.
WORD_FX = {
    "international": "slam",      # the hook drops like a kick
    "yeah": "flashbulb",          # crowd cameras go off
    "worldwide": "rise",
    "touch": "press",
    "road": "echo",               # it repeats twice — let it repeat
    "passport": "placard",        # types itself out like a specimen label
    "stamp": "quake",
    "that": "chop",
    "run": "chop",                # the five-hit stutter, in the engine's own word
    "it": "chop",
    "big": "quake",
    "sound": "pulse",
    "border": "bars",             # cage-bar shadows slide across it
    "flight": "rise",
    "mode": "type",
    "gate": "bars",
    "closed": "redact",           # shown, then struck out
    "still": "freeze",
    "go": "slam",
    "move": "tilt",
    "fast": "chromatic",          # RGB ghosts tear apart and lock back in
    "yo": "flashbulb",
    "from": "echo",
    "yard": "carve",              # struck into stone — home
    "foreign": "refract",         # arrives split through glass, converges
    "tell": "echo",
    "dem": "echo",
    "large": "bloom",             # the closing tag blossoms open
}

# ── ACTS / MODES ───────────────────────────────────────────────────────────
ACTS = [
    {"start": 0.00,  "end": 10.70, "label": "INTERNATIONAL", "why": "the chopped cold open, three hook hits"},
    {"start": 10.70, "end": 24.88, "label": "TOUCH ROAD",    "why": "worldwide, passport, stamp that"},
    {"start": 24.88, "end": 31.66, "label": "RUN IT",        "why": "the drop cue and its five-hit stutter"},
    {"start": 31.66, "end": 43.30, "label": "GATE CLOSED",   "why": "border, flight mode, still go"},
    {"start": 43.30, "end": 52.07, "label": "MOVE FAST",     "why": "the chant wall into the long haul"},
    {"start": 52.07, "end": 56.60, "label": "YARD TO FOREIGN","why": "the DJ shout, and Jamaica"},
    {"start": 56.60, "end": TO,    "label": "LARGE",         "why": "the closing chant and the tag line"},
]
# EVERY window is dynamic. Entering one fires the tape-warp and clears the
# giant-word residue; leaving it falls back to the URL's own --mode dynamic.
# There is no path here that can put phrase mode on the stage.
MODES = [{"start": a["start"], "end": a["end"], "mode": "dynamic"} for a in ACTS]
assert {m["mode"] for m in MODES} == {"dynamic"}

planet = {
    "generatedAt": "2026-09-15T00:00:00.000Z",
    "styleHint": (
        "THE GOLDEN ATLAS — golden-hour photoreal travel documentary. Every frame is a REAL "
        "named landmark with a real crowd celebrating in front of it. The country changes on "
        "the hook word. Monuments identify the country; flags are incidental."
    ),
    "analysis": {
        # particleModeFor() reads overallMood + themes + keywords + mood + genre
        # + title as ONE string and returns the FIRST regex that hits. "golden"
        # lands on pollen (golden motes in warm light), which is the only
        # weather that belongs over golden-hour landmarks. Keep every earlier
        # trigger out of these strings — "club" in the genre was sending it to
        # bubbles, and any word containing "ice" sends it to snow.
        "overallMood": "golden worldwide jubilation",
        "themes": ["golden", "sunlit", "monuments", "passport", "worldwide"],
        "keywords": [],
        "palette": ["#F2B33D", "#E2703A", "#4FA8D8", "#43C46B", "#FBEBD2"],
        "summary": "A global hype anthem — the whole world raising its monuments together.",
        "sections": SECTIONS,
    },
    "assets": {
        "broll": [],
        "keywords": KEYWORDS,
        "sections": SECTION_ART,
        "shots": SHOTS,
        "stems": f"{CDN}{R2}/stems/stems.json",
        "stemLag": 0,
    },
    "interactions": {"tapEffect": "bloom", "moments": []},
    "dynamicPlus": {
        "v": 2,
        "directed": (
            f"INTERNATIONAL MODE — THE GOLDEN ATLAS, re-cut. One continuous window "
            f"{FROM:.2f}-{TO:.2f} ({TO - FROM:.2f}s). PURE DYNAMIC throughout — one giant word "
            "at a time, no pile, no phrase wall. 15 hook hits rotate 14 countries and a globe. "
            "Ends on LARGE hanging alone in the percussion break at 61.18-62.40."
        ),
        # NO "scene" KEY. Pinning a real BACKDROP_SCENES name (the first pass
        # pinned AURORA) paints the GL scene behind plates that only render at
        # 0.6 opacity, and every landmark comes back hazed.
        "acts": ACTS,
        "modes": MODES,
        "words": WORD_FX,
        "deck": {
            "art": True,
            "density": 2.1,      # pollen population
            # 0.45, not 1.0. glow is a drop-shadow of 0.6em x glow on the words
            # layer, ON TOP of .kinetic-word's own beat-driven halo. At 1.0,
            # under a word that is now twice the size it was, the bloom spread
            # far enough to bleach the plate behind it. "Crispy" is a hard edge,
            # not a big halo.
            "glow": 0.45,
            "grain": 0.26,
            "vignette": 0.44,
            # TURNS, not degrees: backdrop.hueShift is registered min -0.5 max
            # 0.5, so the 36 this cut first carried clamped to 0.5 — a 180°
            # rotation that turned every golden-hour plate lilac/pink. A small
            # positive lean holds the whole show in gold instead of letting
            # each section hash its own.
            "backdropHue": 0.04,
            # 0, not the engine's 0.5. "Dying lyrics dissolve into the field"
            # assumes the lyric CHANGES; this hook says one 13-letter word 15
            # times, so the ghost buffer stacked them faster than ghostFade
            # cleared and the last 20s rendered as a wall of overlapping giant
            # text. This was the "weird distortion on the images" — it is drawn
            # INTO the backdrop, behind a plate that only renders at 0.6 alpha.
            "ghosts": 0,
            # pile 0 = SOLO: one giant word, no residue of the last one.
            # stutter False = kill the OTHER pile, the one that stacks a
            # repeated word across the whole frame on a 3-in-a-row run. With a
            # 13-letter hook that is nine clipped copies over the landmark —
            # it was the single ugliest thing in the first pass.
            "giant": {"life": 1200, "pile": 0, "clearOnSwitch": True, "stutter": False},
            # the blurred 24vw word under the stage: "INTERNATIONAL" at that
            # size runs off both edges and reads as a grey smear.
            "choir": False,
            # swapMs 380 (the first pass) is shorter than the 0.42s crossfade,
            # so plates were permanently dissolving into each other. 900 lets a
            # landmark actually land and be looked at.
            "motion": {"dur": 2.2, "amp": 0.85, "swapMs": 900, "fade": 0.36},
        },
        # THE STAGE RATTLES where the song gets hype. Same payoff a real phone
        # shake gives (CSS quake on the stage + a particle scatter + the live
        # word reacting in the song's own tap language), which a rendered cut
        # could never reach before — only a devicemotion event set it.
        # Three, not thirty: the Beat Drop landing, the chant wall, and the
        # closing chant. A rattle on every bar is a broken player, not a drop.
        "quakes": [31.66, 43.30, 56.60],
        "hits": [], "holds": [], "rolls": [],
    },
}

row = {
    "id": SLUG,
    "title": "International Mode",
    "artist": "AGENOR",
    # "Club" in the old genre string was matching particleModeFor's bubbles
    # rule before "golden" could reach pollen. Same music, different word.
    "genre": "Dancehall / Hype",
    "mood": "golden euphoric",
    "color": "#F2B33D",
    "cover": f"{CDN}{R2}/scene-globe.webp",
    "audio_url": f"/private/{SLUG}.mp3",
    "sort_order": 9005,
    "featured": False,
    "hidden": True,
    "lyrics": lyrics,
    "lyrics_synced": {
        "source": "parakeet-tdt-0.6b-v3 per-section slices on the isolated lead stem, "
                  "every onset RMS-verified against a 20ms profile",
        "refinedAt": "2026-09-15T00:00:00.000Z",
        "words": [{"t": t, "w": w} for t, w in WORDS],
    },
    "planet": planet,
}

OUT.write_text(json.dumps(row, indent=2, ensure_ascii=False))
print(f"wrote {OUT}")
print(f"  window {FROM:.2f} -> {TO:.2f}  ({TO - FROM:.2f}s)")
print(f"  {len(WORDS)} words, {len(LINES)} LRC lines, {len(SECTIONS)} sections")
print(f"  {len(KEYWORDS)} keywords, {len(SHOTS)} plates, {len(WORD_FX)} word effects")
print(f"  longest word gap {max(_gaps):.2f}s (wipe needs >=7)")
hook = sum(1 for _, w in WORDS if w.lower() == "international")
print(f"  hook word {hook}/{len(WORDS)} = {hook / len(WORDS) * 100:.0f}% — pooled over {len(COUNTRIES) + 1} plates")
