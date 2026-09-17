#!/usr/bin/env python3
"""SUMMER DRIP v2 — THE HAMPTONS SESSIONS. 0.00 -> 60.00.

Brief, 2026-09-16: a realistic look matching the new album art — a Hamptons
beach club with a diverse crowd — starting from 0:00 because "the intro is epic,
HEAT TURNED UP", dynamic text only, and new effects invented for this song.

Two were, both colour-neutral by design (§25 caught `drip` and `liquid`
hardcoding their own palettes):
  * `heathaze` — the word sits still and the light coming off it will not. Two
    blurred ghosts drift in opposite directions behind a crisp original, so the
    glyph stays readable while its edges shimmer. This is what "Heat turned up"
    looks like.
  * `screw`    — the word drags downward leaving a smear above it: a tape
    slowing. The song is chopped and screwed; so is its text now.
  * plus a third pile layout, `trail`, for the stutter runs — the repeats smear
    diagonally, each smaller than the last and each entering from where the
    previous one landed. Nine "every"s at 1.68-5.68, five "mean"s at 13.28.

    ~/whisper-venv/bin/python scripts/sd2/build_row.py
"""
import json, collections
from pathlib import Path

SLUG = "summer-drip-v2"
R2 = f"/planets/{SLUG}"
CDN = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev"
HERE = Path(__file__).resolve().parent
FROM, TO = 0.00, 60.00
def s(n): return f"{R2}/scene-{n}.webp"

words = json.loads((HERE / "words.json").read_text())["words"]
win = [w for w in words if FROM <= w["t"] <= TO]

LINES = [
    (0.24,"Heat turned up"),(1.68,"every every every every"),(6.08,"stare feel loud"),
    (8.08,"Slow it down"),(9.20,"Summer drip"),(10.16,"Summer drip"),
    (11.20,"Hips flip flip"),(12.72,"walk mean"),(13.28,"mean mean mean mean"),
    (16.96,"I feel this sundress glow under the daylight"),
    (20.72,"Hips swing slow moving smooth in the midnight"),
    (24.80,"Heart stay cold but my stride got flame"),
    (28.88,"Every little step got a high class game"),
    (32.56,"Smile so sweet with the timing just right"),
    (36.88,"Brown skin shine with the streetlamp light"),
    (40.40,"Perfume thick got em stuck in a bind"),
    (44.24,"all all all these hungry eyes"),
    (46.32,"got em losing they mind"),
    (49.60,"Walked in the spot had to savor my tone"),
    (51.68,"Whole room staring like a queen on a throne"),
    (53.68,"Dance floor quiet but the glances loud"),
    (55.52,"Every lens locked in every whisper so proud"),
    (57.52,"Long legs soft hands curves on the rise"),
]
def lrc(t):
    m = int(t // 60); return f"[{m:02d}:{t-m*60:05.2f}]"
lyrics = "\n".join(f"{lrc(t)}{x}" for t, x in LINES)

# Re-spread 2026-09-16 after the Sovereign's note. scene-smile is deleted, and
# the remaining words are distributed across THIRTY plates instead of eighteen:
# the first map put 81 word-hits on 18 plates and the top four carried 35 of
# them. Repetition is a distribution problem, not a taste problem — measure it
# (count word-occurrences per plate) rather than eyeballing a contact sheet.
KEYWORDS = {
    "heat": s("heat"), "turned": s("flame"), "up": s("dunes"),
    "every": s("crowd"), "stare": s("lens"), "loud": s("djbooth"),
    "slow": s("curtain"), "down": s("boards" if False else "dunes"),
    "summer": s("daylight"), "drip": s("drip"),
    "hips": s("sundress"), "flip": s("waves"), "walk": s("walkaway"), "mean": s("sundress"),
    "sundress": s("sundress"), "glow": s("flame"), "daylight": s("daylight"),
    "swing": s("dancefloor"), "smooth": s("waves"), "midnight": s("midnight"),
    "heart": s("firepit"), "cold": s("champagne"), "stride": s("steps"), "flame": s("firepit"),
    "step": s("steps"), "game": s("queen"),
    "smile": s("profile"), "sweet": s("champagne"), "timing": s("table"),
    "brown": s("profile"), "skin": s("profile"), "shine": s("gold"),
    "streetlamp": s("streetlamp"), "light": s("curtain"),
    "perfume": s("perfume"), "thick": s("champagne"), "bind": s("perfume"),
    "all": s("crowd"), "hungry": s("lens"), "eyes": s("eyes"), "mind": s("waves"),
    "walked": s("spot"), "spot": s("spot"), "savor": s("sunhat"),
    "room": s("table"), "staring": s("lens"), "queen": s("queen"), "throne": s("queen"),
    "dance": s("dancefloor"), "floor": s("deck"), "glances": s("eyes"),
    "lens": s("lens"), "whisper": s("curtain"), "proud": s("marina"),
    "legs": s("steps"), "hands": s("gold"), "curves": s("convertible"), "rise": s("pool"),
}
SECTION_ART = {"arrival": s("deck"), "glow": s("pool"),
               "flex": s("marina"), "crowd": s("table")}
SHOTS = {s(n): sz for n, sz in [
    ("heat","WIDE"),("deck","WIDE"),("sundress","WIDE"),("daylight","WIDE"),
    ("midnight","WIDE"),("flame","WIDE"),("steps","MED"),
    ("streetlamp","MED"),("perfume","MACRO"),("eyes","CLOSE"),("spot","WIDE"),
    ("queen","MED"),("dancefloor","WIDE"),("lens","MED"),("crowd","WIDE"),
    ("gold","MACRO"),("drip","CLOSE"),
    # the variety pass
    ("pool","WIDE"),("marina","WIDE"),("convertible","MED"),("champagne","MACRO"),
    ("dunes","WIDE"),("djbooth","MED"),("firepit","WIDE"),("curtain","MED"),
    ("waves","WIDE"),("walkaway","WIDE"),("sunhat","MACRO"),("table","MED"),
    ("profile","CLOSE"),
]}

SECTIONS = [
    {"start": 0.00,  "name": "heat turned up", "emotion": "arrival", "intensity": 0.66, "colorHint": "#C2500F"},
    {"start": 16.90, "name": "the hook",       "emotion": "glow",    "intensity": 0.70, "colorHint": "#B8440C"},
    {"start": 40.40, "name": "hungry eyes",    "emotion": "crowd",   "intensity": 0.58, "colorHint": "#A83A14"},
    {"start": 49.60, "name": "walked in",      "emotion": "flex",    "intensity": 0.68, "colorHint": "#C2500F"},
]
for i in range(1, len(SECTIONS)):
    d = abs(SECTIONS[i]["intensity"] - SECTIONS[i-1]["intensity"])
    assert d < 0.25 and SECTIONS[i]["intensity"] <= 0.71, f"banner risk at {SECTIONS[i]['name']}"
gaps = [win[i+1]["t"] - win[i]["t"] for i in range(len(win)-1)]
assert max(gaps) < 7.0, f"WIPE risk {max(gaps):.2f}s"

WORD_FX = {
    # the two built for this song
    "heat": "heathaze", "flame": "heathaze", "shine": "heathaze", "glow": "heathaze",
    "every": "screw", "mean": "screw", "slow": "screw", "down": "screw", "all": "screw",
    # the rest
    "turned": "slam", "up": "rise", "stare": "mirror", "loud": "flashbulb",
    "summer": "shimmer", "drip": "shimmer",
    "hips": "tilt", "flip": "tilt", "walk": "rise",
    "sundress": "bloom", "daylight": "neon", "midnight": "whisper",
    "swing": "wave", "smooth": "wave", "heart": "pulse", "cold": "freeze",
    "stride": "press", "step": "press", "game": "carve",
    "smile": "bloom", "sweet": "bloom", "timing": "type",
    "brown": "shimmer", "skin": "shimmer", "streetlamp": "neon", "light": "flashbulb",
    "perfume": "fizz", "thick": "cling", "bind": "cling",
    "hungry": "tremor", "eyes": "mirror", "mind": "dissolve",
    "walked": "press", "spot": "placard", "savor": "whisper",
    "room": "echo", "staring": "mirror", "queen": "carve", "throne": "carve",
    "dance": "quake", "floor": "quake", "glances": "flashbulb",
    "lens": "flashbulb", "whisper": "fogbreath", "proud": "rise",
    "legs": "rise", "hands": "press", "curves": "wave", "rise": "rise",
}

ACTS = [
    {"start": 0.00,  "end": 16.90, "label": "HEAT TURNED UP", "why": "the intro chop — the word drags before a line is sung"},
    {"start": 16.90, "end": 40.40, "label": "SUMMER DRIP",    "why": "the hook, front to back"},
    {"start": 40.40, "end": 49.60, "label": "HUNGRY EYES",    "why": "perfume, the bind, the whole room looking"},
    {"start": 49.60, "end": TO,    "label": "QUEEN ON A THRONE", "why": "verse one — she walks in and the room turns"},
]
MODES = [{"start": a["start"], "end": a["end"], "mode": "dynamic"} for a in ACTS]
assert {m["mode"] for m in MODES} == {"dynamic"}

planet = {
    "generatedAt": "2026-09-16T00:00:00.000Z",
    "styleHint": (
        "THE HAMPTONS SESSIONS — photoreal editorial, deep golden hour with the sun on the "
        "water, weathered wooden deck, white umbrellas, warm string lights, and a genuinely "
        "multiracial crowd in summer resort wear. Shot to match the album art."
    ),
    "analysis": {
        "overallMood": "golden sunlit summer flex",
        "themes": ["golden", "sunlit", "summer", "hazy"],
        "keywords": [],
        "palette": ["#C2500F", "#B8440C", "#E8A23C", "#FBE3B0", "#2A1A0C"],
        "summary": "Golden hour on the deck, and the whole room turning to watch her walk.",
        "sections": SECTIONS,
    },
    "assets": {"broll": [], "keywords": KEYWORDS, "sections": SECTION_ART, "shots": SHOTS,
               "stems": f"{CDN}{R2}/stems/stems.json", "stemLag": 0},
    "interactions": {"tapEffect": "shimmer", "moments": []},
    "dynamicPlus": {
        "v": 2,
        "directed": (f"SUMMER DRIP v2 — THE HAMPTONS SESSIONS. {FROM}-{TO} ({TO-FROM:.0f}s) from the "
                     "top. Pure dynamic. New for this song: `heathaze` on the heat words, `screw` on "
                     "the chops, and the `trail` pile layout dragging the stutter runs across frame."),
        "acts": ACTS, "modes": MODES, "words": WORD_FX,
        "hits": [], "holds": [], "rolls": [],
        "quakes": [0.24, 16.96, 49.60],
        "deck": {
            "weather": "pollen",          # warm motes in the low sun; "summer" would reach it anyway
            "art": True, "density": 1.9, "glow": 0.45, "grain": 0.3,
            "vignette": 0.6, "backdropHue": 0.03, "pitchSpread": 0.22,
            "giant": {"life": 1200, "pile": 0, "clearOnSwitch": True,
                      "stutter": True, "stutterLayout": "trail"},
            "choir": False, "ghosts": 0,
            "motion": {"dur": 2.2, "amp": 0.85, "swapMs": 850, "fade": 0.34},
        },
    },
}
row = {"id": SLUG, "title": "Summer Drip", "artist": "AGENOR",
       "genre": "Chopped & Screwed / Southern Rap", "mood": "golden sunlit summer",
       "color": "#E8A23C", "cover": f"{CDN}{R2}/scene-sundress.webp",
       "audio_url": f"/private/{SLUG}.mp3", "sort_order": 9013,
       "featured": False, "hidden": True, "lyrics": lyrics,
       "lyrics_synced": {"source": json.loads((HERE/"words.json").read_text())["source"],
                         "refinedAt": "2026-09-16T00:00:00.000Z", "words": words},
       "planet": planet}
(HERE / "row.json").write_text(json.dumps(row, indent=2, ensure_ascii=False))
c = collections.Counter(SHOTS.values()); t = sum(c.values())
print(f"wrote {HERE/'row.json'}")
print(f"  {FROM}-{TO} ({TO-FROM:.0f}s), {len(win)} words, {len(SHOTS)} plates")
print(f"  shots {dict(c)} — WIDE {c['WIDE']/t*100:.0f}%, CLOSE+MACRO {(c['CLOSE']+c['MACRO'])/t*100:.0f}%")
print(f"  new fx in use: heathaze, screw; layout trail; longest gap {max(gaps):.2f}s")
