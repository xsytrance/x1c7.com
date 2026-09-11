#!/usr/bin/env python3
import json

SLUG = "international-mode"
R2 = f"/planets/{SLUG}"
words = json.load(open("scripts/intlmode/words.json"))
all_words = words["part_a"] + words["part_b"]

def lrc(t):
    m = int(t // 60); s = t - m * 60
    return f"[{m:02d}:{s:05.2f}]"

# LRC lines, <=7 words each, grouped by natural phrase breaks.
lines = [
    (25.04, "International International International"),
    (29.76, "Run it"),
    (31.76, "International International International"),
    (122.24, "Stamp it Stamp it Stamp it Stamp it"),
    (124.00, "Move it Move it Move it Move it"),
    (124.88, "Move it Move it Move it"),
    (128.48, "International International International"),
    (133.44, "International International"),
    (141.68, "International International"),
    (146.64, "International International"),
    (152.56, "World class"),
    (154.32, "Touch road"),
    (155.44, "Big bass"),
    (157.20, "Airplane"),
    (158.36, "Whiplash"),
    (159.12, "International International International"),
    (162.24, "Go far"),
    (162.88, "From BK to di stars"),
    (164.48, "From di street to di charts"),
]
lyrics = "\n".join(f"{lrc(t)}{text}" for t, text in lines)

shots = {
    f"{R2}/scene-flags.webp": "WIDE",
    f"{R2}/scene-stamp.webp": "MACRO",
    f"{R2}/scene-move.webp": "WIDE",
    f"{R2}/scene-world.webp": "WIDE",
    f"{R2}/scene-road.webp": "WIDE",
    f"{R2}/scene-bass.webp": "WIDE",
    f"{R2}/scene-airplane.webp": "WIDE",
    f"{R2}/scene-whiplash.webp": "WIDE",
    f"{R2}/scene-bk.webp": "WIDE",
    f"{R2}/scene-stars.webp": "WIDE",
    f"{R2}/scene-street.webp": "WIDE",
    f"{R2}/scene-charts.webp": "WIDE",
    f"{R2}/scene-globe.webp": "MED",
    f"{R2}/scene-stadium.webp": "WIDE",
    f"{R2}/scene-hands.webp": "CLOSE",
    f"{R2}/scene-fireworks.webp": "WIDE",
    f"{R2}/scene-kids.webp": "WIDE",
    f"{R2}/scene-summit.webp": "WIDE",
}

keywords = {
    "international": f"{R2}/scene-flags.webp",
    "run": f"{R2}/scene-flags.webp",
    "stamp": f"{R2}/scene-stamp.webp",
    "move": f"{R2}/scene-move.webp",
    "world": f"{R2}/scene-world.webp",
    "class": f"{R2}/scene-world.webp",
    "touch": f"{R2}/scene-road.webp",
    "road": f"{R2}/scene-road.webp",
    "big": f"{R2}/scene-bass.webp",
    "bass": f"{R2}/scene-bass.webp",
    "airplane": f"{R2}/scene-airplane.webp",
    "whiplash": f"{R2}/scene-whiplash.webp",
    "go": f"{R2}/scene-bk.webp",
    "far": f"{R2}/scene-bk.webp",
    "bk": f"{R2}/scene-bk.webp",
    "stars": f"{R2}/scene-stars.webp",
    "street": f"{R2}/scene-street.webp",
    "charts": f"{R2}/scene-charts.webp",
}

sections = {
    "chant": f"{R2}/scene-flags.webp",
    "build": f"{R2}/scene-move.webp",
    "unity": f"{R2}/scene-world.webp",
    "payoff": f"{R2}/scene-charts.webp",
}

analysis_sections = [
    {"start": 0.0, "name": "the hook", "emotion": "chant", "intensity": 0.60, "colorHint": "#2B6CB0"},
    {"start": 120.14, "name": "the build", "emotion": "build", "intensity": 0.55, "colorHint": "#C53030"},
    {"start": 128.48, "name": "the chant wall", "emotion": "unity", "intensity": 0.68, "colorHint": "#2F855A"},
    {"start": 152.56, "name": "world class", "emotion": "payoff", "intensity": 0.70, "colorHint": "#E8A33D"},
    {"start": 162.24, "name": "go far", "emotion": "payoff", "intensity": 0.68, "colorHint": "#E8A33D"},
]

word_fx = {
    "international": "pulse", "stamp": "chop", "move": "rise", "world": "bloom",
    "class": "bloom", "touch": "drip", "road": "drip", "big": "quake",
    "bass": "quake", "airplane": "rise", "whiplash": "tremor", "go": "cling",
    "far": "cling", "bk": "shimmer", "stars": "shimmer", "street": "bloom",
    "charts": "shimmer", "run": "slam",
}

planet = {
    "generatedAt": "2026-09-08T00:00:00.000Z",
    "styleHint": ("ONE WORLD GATE — warm dusk-to-gold festival light, dozens of real "
                  "national flags raised together, diverse crowds, world landmarks. "
                  "Unity, not surveillance. Percussive hit: a stamp throwing multicolor "
                  "ink, not black-and-red."),
    "analysis": {
        "themes": ["unity", "travel", "flags", "celebration", "the world"],
        "palette": ["#E8A33D", "#2B6CB0", "#2F855A", "#C53030", "#F2E4CE"],
        "summary": ("A global hype anthem — the whole world raising its flags "
                    "together. Built to unite, not to gatekeep."),
        "keywords": [],
        "sections": analysis_sections,
        "overallMood": "joyful unity",
    },
    "assets": {
        "broll": [],
        "stems": f"https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev{R2}/stems/stems.json",
        "stemLag": 0,
        "shots": shots,
        "keywords": keywords,
        "sections": sections,
    },
    "dynamicPlus": {
        "v": 2,
        "directed": ("INTERNATIONAL MODE 60s spliced cut — ONE WORLD GATE voice, 12 "
                     "plates. Part A 25.04-39.2 (the first hook), Part B 120.14-166.0 "
                     "(Build into Final Drop), merged with a 0.6s crossfade landing in "
                     "the song's own pre-Build silence."),
        "scene": "GATE",
        "acts": [
            {"start": 25.04, "end": 39.2, "label": "INTERNATIONAL", "why": "the first hook"},
            {"start": 120.14, "end": 128.48, "label": "STAMP IT / MOVE IT", "why": "the build"},
            {"start": 128.48, "end": 152.56, "label": "THE CHANT WALL", "why": "wall of the hook"},
            {"start": 152.56, "end": 166.0, "label": "WORLD CLASS", "why": "the payoff lines"},
        ],
        "modes": [{"start": 25.04, "end": 39.2, "mode": "phrase"},
                  {"start": 120.14, "end": 166.0, "mode": "phrase"}],
        "words": word_fx,
        "deck": {
            "glow": 1.2, "grain": 0.5, "density": 2.0, "vignette": 0.55,
            "giant": {"life": 2000, "pile": 0, "clearOnSwitch": True},
            "motion": {"swapMs": 650},
        },
        "hits": [],
        "holds": [],
        "rolls": [],
    },
}

row = {
    "id": SLUG,
    "title": "International Mode",
    "artist": "AGENOR",
    "genre": "Hip-Hop / Hype",
    "mood": "joyful unity",
    "color": "#2B6CB0",
    "cover": f"https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev{R2}/scene-flags.webp",
    "audio_url": f"/private/{SLUG}.mp3",
    "sort_order": 9001,
    "featured": False,
    "hidden": True,
    "lyrics": lyrics,
    "lyrics_synced": {
        "source": "parakeet-tdt-0.6b-v3+beat-snap",
        "refinedAt": "2026-09-08T00:00:00.000Z",
        "words": [{"t": w["t"], "w": w["w"]} for w in all_words],
    },
    "planet": planet,
}

json.dump(row, open("scripts/intlmode/row.json", "w"), indent=2)
print("wrote scripts/intlmode/row.json")
print(f"{len(all_words)} words, lyrics {len(lines)} LRC lines")
