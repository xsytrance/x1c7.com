#!/usr/bin/env python3
"""HAJIMEMASHITE v4 — the row. Same window, pure dynamic, Kizuna sprinkled.

Owner brief 2026-09-16: "Use dynamic mode only like you did in warm without
burning and international mode. Don't make every picture kizuna like the
current version; just sprinkle her and Tyler in. Generate new images. Use the
same starting point for the song and keep it 60 seconds."

Window 97.60 -> 157.55 (59.95s), identical to v3. Words are v3's HAND-ALIGNED
set, unchanged: 134 stamps authored for exactly this window, all re-verified
above the voiced gate on the isolated lead stem. (An automated re-alignment was
attempted and thrown away — on continuous singing a rise-detector keeps locking
onto the neighbouring syllable, and its "corrections" piled up at the edge of
its own search window. Hand alignment is the better source here, and Parakeet
cannot help at all: the ad-libs are Japanese and it is English + European only.)

    ~/whisper-venv/bin/python scripts/haji4/build_row.py
    node scripts/_kiz-db.mjs upsert scripts/haji4/row.json
"""
import json
from pathlib import Path

SLUG = "hajimemashite-v4"
R2 = f"/planets/{SLUG}"
CDN = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev"
HERE = Path(__file__).resolve().parent
OUT = HERE / "row.json"
FROM, TO = 97.60, 157.55

def s(n): return f"{R2}/scene-{n}.webp"

words = json.loads((HERE / "words-v3.json").read_text())["words"]
lrc = (HERE / "lrc-v3.txt").read_text()
if lrc.lstrip().startswith('"'):
    lrc = json.loads(lrc)

# ── ART ────────────────────────────────────────────────────────────────────
# 22 plates, SIX of which have a person in them. v3 had 12 of 17. The people
# are placed so the face is EARNED: she is a distant silhouette at her entrance
# (139.35), a figure at her name (146.25), and only at "remember the face"
# (142.70) does the cut finally hand you the face. Tyler owns both LevelReady
# calls as a person — v3 mapped a record-label CARD to "the house was already
# warm", so the warmest line in the song played a logo.
# Lowercase keys: KineticStage lowercases the sung word before indexing (§3d).
KEYWORDS = {
    # verse two — the boast, all world
    "they": s("they"), "cute": s("they"),
    "trap": s("trap"), "bait": s("trap"),
    "walking": s("walking"), "walk": s("walking"),
    "key": s("keys"), "tongue": s("keys"), "tempo": s("tempo"),
    "speed": s("tempo"), "slow": s("tempo"),
    "sweat": s("street"), "never": s("street"),
    # the label
    "levelready": s("levelready"),        # Tyler, as a person
    "reverl—": s("lights"), "welcome": s("lights"),
    # the lineage — kept from v3, these are the Sovereign's own three names
    "egi": s("throne"), "throne": s("throne"),
    "xsytrance": s("glyph"), "bloodline": s("glyph"),
    "shine": s("lights"),
    # the bridge — the room
    "secret": s("secret"),
    "lights": s("lights"), "hit": s("lights"),
    "doors": s("doors"), "open": s("doors"), "swung": s("doors"),
    "alone": s("walking"),
    "house": s("house"), "warm": s("house"), "here": s("house"),
    # the final chorus
    "hajimemashite": s("hajimemashite"),  # Kizuna, distant, back to us
    "face": s("face"),                    # Kizuna, THE face, once
    "sound": s("sound"),
    "kizuna": s("kizuna"), "sato": s("kizuna"),
    "wheels": s("wheels"), "off": s("wheels"),
    "aishiteru": s("rain"),
    "name": s("name"),                    # Kizuna, walking out of the dark
}
SECTION_ART = {
    "playful": s("street"), "proud": s("wheelsman"),   # Tyler carries a section
    "intimate": s("secret"), "triumphant": s("sign"),
    "magnetic": s("rain"), "confident": s("street"),
    "seductive": s("trap"), "mysterious": s("secret"),
}
SHOTS = {s(n): sz for n, sz in [
    ("trap", "MACRO"), ("street", "WIDE"), ("keys", "MED"), ("tempo", "CLOSE"),
    ("throne", "MED"), ("glyph", "MED"), ("doors", "MED"), ("lights", "WIDE"),
    ("house", "WIDE"), ("secret", "MED"), ("sound", "CLOSE"), ("wheels", "MED"),
    ("sign", "WIDE"), ("rain", "WIDE"), ("they", "WIDE"), ("walking", "WIDE"),
    ("hajimemashite", "WIDE"), ("kizuna", "MED"), ("face", "CLOSE"),
    ("name", "MED"), ("levelready", "MED"), ("wheelsman", "WIDE"),
]}
PEOPLE = {"hajimemashite", "kizuna", "face", "name", "levelready", "wheelsman"}

# ── SECTIONS ───────────────────────────────────────────────────────────────
# §14 guards asserted below. Only the four the window actually crosses.
SECTIONS = [
    {"start": 93.60,  "name": "LevelReady",   "emotion": "proud",      "intensity": 0.66, "colorHint": "#E8A33D"},
    {"start": 105.40, "name": "Bridge",       "emotion": "intimate",   "intensity": 0.48, "colorHint": "#E8A33D"},
    {"start": 118.30, "name": "Final Chorus", "emotion": "triumphant", "intensity": 0.70, "colorHint": "#F6D66B"},
    {"start": 135.20, "name": "Outro",        "emotion": "magnetic",   "intensity": 0.50, "colorHint": "#F6D66B"},
]
for i in range(1, len(SECTIONS)):
    d = abs(SECTIONS[i]["intensity"] - SECTIONS[i - 1]["intensity"])
    assert d < 0.25, f"BLOW risk: delta {d:.2f} at {SECTIONS[i]['name']}"
    assert SECTIONS[i]["intensity"] <= 0.71, f"SHAKE risk at {SECTIONS[i]['name']}"
win = [w for w in words if FROM <= w["t"] <= TO]
gaps = [win[i + 1]["t"] - win[i]["t"] for i in range(len(win) - 1)]
assert max(gaps) < 7.0, f"WIPE risk: {max(gaps):.2f}s gap"

# ── TEXT EFFECTS ───────────────────────────────────────────────────────────
WORD_FX = {
    "they": "echo", "cute": "smudge", "trap": "cling", "bait": "cling",
    "walking": "rise", "walk": "rise", "watch": "mirror",
    "key": "press", "tongue": "liquid", "tempo": "pulse",
    "slow": "drip", "speed": "chromatic", "never": "freeze", "sweat": "drip",
    "welcome": "bloom", "levelready": "slam", "practiced": "type",
    "egi": "carve", "throne": "carve", "xsytrance": "shimmer",
    "bloodline": "bleed", "names": "redact", "shine": "shimmer",
    "secret": "whisper", "lights": "flashbulb", "hit": "slam",
    "doors": "fracture", "swung": "rise", "open": "bloom",
    "alone": "fogbreath", "house": "cling", "warm": "bloom", "here": "press",
    "hajimemashite": "neon", "face": "vitrine", "remember": "echo",
    "sound": "pulse", "kizuna": "shimmer", "sato": "shimmer",
    "wheels": "quake", "off": "fall", "aishiteru": "bloom", "name": "neon",
}

# ── ACTS / MODES ───────────────────────────────────────────────────────────
ACTS = [
    {"start": 97.60,  "end": 115.50, "label": "THE TRAP AND THE BAIT", "why": "verse two — she repeats the insult back and keeps walking"},
    {"start": 115.50, "end": 121.20, "label": "SAME MAN, THREE NAMES", "why": "the lineage, and the one name he kept"},
    {"start": 121.20, "end": 139.00, "label": "THE DOORS SWUNG OPEN",  "why": "the bridge drops to a whisper — the room was already hers"},
    {"start": 139.00, "end": TO,     "label": "HAJIMEMASHITE",          "why": "final chorus into the belt — the name lands"},
]
# EVERY window dynamic. v3 was `phrase` across the whole cut; the flag alone
# cannot fix that, because dynamicPlus.modes outranks --mode (§23).
MODES = [{"start": a["start"], "end": a["end"], "mode": "dynamic"} for a in ACTS]
assert {m["mode"] for m in MODES} == {"dynamic"}

planet = {
    "generatedAt": "2026-09-16T00:00:00.000Z",
    "styleHint": (
        "OSAKA GOLD-LEAF NIGHT — photoreal Dotonbori after 2am and after rain, everything "
        "crushed to near-black except molten gold. The song's own voice, kept; what changed "
        "is the subject. The world of the song carries the cut and the artists are sprinkled "
        "through it: four Kizuna plates and two Tyler out of twenty-two."
    ),
    "analysis": {
        # particleModeFor takes the FIRST regex that hits across mood+themes+
        # genre+title, and "rain" in the themes wins before "golden" can reach
        # pollen. That is the right answer here and it is deliberate: the whole
        # grade is Dotonbori AFTER RAIN, so falling rain over wet gold neon is
        # the honest weather. Keep the other triggers out — any word containing
        # "ice" silently routes to snow, "club" to bubbles (§23).
        "overallMood": "golden sultry midnight swagger",
        "themes": ["golden", "sunlit", "lanterns", "rain", "arrival"],
        "keywords": [],
        # palette[0] is NOT decoration: themeHue = hexHue(palette[0]), and the sung
        # note bends the word's colour off that hue. The near-black that used to
        # sit first has no meaningful hue, so the whole melody-colour system was
        # bending off noise. The song's gold leads now.
        "palette": ["#E8A33D", "#F6D66B", "#FFE9A8", "#D96A3A", "#0A0805"],
        "summary": "She never introduced herself — the room was already hers.",
        "sections": SECTIONS,
    },
    "assets": {
        "broll": [], "keywords": KEYWORDS, "sections": SECTION_ART, "shots": SHOTS,
        "stems": f"{CDN}/planets/hajimemashite/stems/stems.json", "stemLag": 0,
    },
    "interactions": {"tapEffect": "shimmer", "moments": []},
    "dynamicPlus": {
        "v": 2,
        "directed": (
            f"HAJIMEMASHITE v4 — OSAKA GOLD-LEAF NIGHT. {FROM}-{TO} ({TO-FROM:.2f}s), the same "
            "window v3 shipped. PURE DYNAMIC throughout: one giant word, no pile, no phrase wall. "
            "22 plates, 6 with a person in them (4 Kizuna, 2 Tyler) — the face lands once, at "
            "142.70, after two shots of holding her back."
        ),
        # NO "scene". v3 pinned EMBERS, which IS a real BACKDROP_SCENES entry, so
        # the GL ember field painted behind plates that render at 0.6 opacity and
        # hazed every frame (§23).
        "acts": ACTS,
        "modes": MODES,
        "words": WORD_FX,
        # kept from v3 — the Sovereign's own lineage, hard-cut and collapsed
        "oneShots": [{
            "id": "three-names", "kind": "nameCards", "solo": True,
            "start": 115.50, "end": 120.60,
            "cards": [
                {"text": "EGI",       "at": 115.60, "art": s("throne")},
                {"text": "XSYTRANCE", "at": 116.62, "art": s("glyph")},
                {"text": "AGENOR",    "at": 117.82, "art": s("lights")},
            ],
            "collapseAt": 118.40, "collapseTo": "AGENOR", "collapseDur": 0.7,
        }],
        "hits": [{"t": 127.48, "dur": 1.35}],          # "lights hit and we felt it"
        # the stage rattles where the song actually lands its punches
        "quakes": [126.66, 139.35, 147.55],
        "holds": [{"start": 150.98, "end": TO, "art": s("name")}],  # the closing belt breathes
        "rolls": [],
        "deck": {
            # glow 0.95, not International Mode's 0.45: that cut's plates were
            # bright golden-hour and a big halo bleached them. These are
            # near-black, so the word needs presence to sit on top of them.
            # pitchSpread 0.3 keeps the melody's colour nuance INSIDE the gold
            # family — at full spread some words came out cold blue-grey and
            # disappeared into a gold-on-black plate.
            "art": True, "density": 2.0, "glow": 0.95, "grain": 0.3,
            "pitchSpread": 0.3,
            "vignette": 0.55, "backdropHue": 0.06,   # TURNS, not degrees (§23)
            "giant": {"life": 1300, "pile": 0, "clearOnSwitch": True, "stutter": False},
            "choir": False, "ghosts": 0,
            "motion": {"dur": 2.2, "amp": 0.85, "swapMs": 900, "fade": 0.36},
        },
    },
}

row = {
    "id": SLUG,
    "title": "Hajimemashite",
    "artist": "Kizuna Sato",
    "genre": "R&B / Trap",
    "mood": "golden sultry",
    "color": "#E8A33D",
    "cover": f"{CDN}{R2}/scene-face.webp",
    "audio_url": f"/private/{SLUG}.mp3",
    "sort_order": 9010,
    "featured": False,
    "hidden": True,
    "lyrics": lrc,
    "lyrics_synced": {
        "source": "v3 hand-aligned window 97.60-157.55, re-verified on the lead stem 2026-09-16",
        "refinedAt": "2026-09-16T00:00:00.000Z",
        "words": [{"t": w["t"], "w": w["w"]} for w in words],
    },
    "planet": planet,
}
OUT.write_text(json.dumps(row, indent=2, ensure_ascii=False))
print(f"wrote {OUT}")
print(f"  window {FROM} -> {TO} ({TO-FROM:.2f}s), {len(win)} words in window")
print(f"  {len(SHOTS)} plates, {len(PEOPLE)} with people = {len(PEOPLE)/len(SHOTS)*100:.0f}% (v3 was 12/17 = 71%)")
import collections
c = collections.Counter(SHOTS.values()); t = sum(c.values())
print(f"  shots {dict(c)} — WIDE {c['WIDE']/t*100:.0f}%, CLOSE+MACRO {(c['CLOSE']+c['MACRO'])/t*100:.0f}%")
print(f"  longest word gap {max(gaps):.2f}s, modes all dynamic, quakes {planet['dynamicPlus']['quakes']}")
