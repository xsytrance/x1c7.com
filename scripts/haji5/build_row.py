#!/usr/bin/env python3
"""HAJIMEMASHITE v5 — v3's pictures, v4's text. The compromise cut.

Sovereign, 2026-09-16, on v4: "Who are those strange shadowy figures? Put Kizuna
back especially when it says she's so cute. The previous video had all the right
pictures I just wanted you to change the text to dynamic like you did in this
video. Can you find a happy compromise of the 2."

So v4's art direction is reverted wholesale and v4's ENGINE work is kept. The
"shadowy figures" were v4's anonymous-silhouette plates (crowd-0/crowd-1, mapped
to `they` / `walking` / `alone`) — a deliberate attempt to carry three lines
without a portrait, and exactly the wrong call for this song. None of v4's
twenty-two plates are used here.

  ART   = v3's seventeen plates, in place at planets/hajimemashite/ — untouched,
          so the v3 cut keeps working off the same files.
  TEXT  = pure dynamic, plus everything the last three cuts paid for: no pinned
          backdrop scene, no giant-word pile, no stutter pileup, no choir word,
          no backdrop ghosts, measured word width, tuned glow and pitch spread.

Two repairs on the way through. scene-cute and scene-levelready were still
1184x880 LANDSCAPE — v1/v2 leftovers the v3 pass missed, losing 58% of their
width to the object-cover crop (§17). Both were EXTENDED to native portrait
rather than re-shot, so the pictures are the ones already approved. They live at
planets/hajimemashite-v5/ and are the only new files this cut adds.

`cute` is now wired to the word "cute" at 98.88 — the explicit ask, and it was
never a keyword before, only ambient section art.

    ~/whisper-venv/bin/python scripts/haji5/build_row.py
    node scripts/_kiz-db.mjs upsert scripts/haji5/row.json
"""
import json
from pathlib import Path

SLUG = "hajimemashite-v5"
V3 = "/planets/hajimemashite"        # the approved art, referenced in place
V5 = "/planets/hajimemashite-v5"     # only the two repaired plates
CDN = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev"
HERE = Path(__file__).resolve().parent
OUT = HERE / "row.json"
FROM, TO = 97.60, 157.55

def a(n): return f"{V3}/scene-{n}.webp"     # v3 plate
def b(n): return f"{V5}/scene-{n}.webp"     # repaired plate

words = json.loads((HERE / "words-v3.json").read_text())["words"]
lrc = (HERE / "lrc-v3.txt").read_text()
if lrc.lstrip().startswith('"'):
    lrc = json.loads(lrc)

# ── ART — v3's map, restored verbatim, plus the two repairs ────────────────
KEYWORDS = {
    "egi": a("egi"), "face": a("face"), "here": a("house"), "they": a("they"),
    "trap": a("trap"), "warm": a("house"), "alone": a("alone"), "doors": a("doors"),
    "house": a("house"), "never": a("never"), "shine": a("shine"),
    "kizuna": a("kizuna"), "reverl": a("reverl"), "secret": a("secret"),
    "walking": a("walking"), "xsytrance": a("xsytrance"),
    "hajimemashite": a("hajimemashite"),
    # NEW: she was only ever ambient art here. "They said she's so cute" now
    # actually shows her, which is the whole point of this pass.
    "cute": b("cute"), "she's": b("cute"),
    "levelready": b("levelready"),
}
SECTION_ART = {
    "proud": b("levelready"), "playful": b("cute"), "intimate": a("alone"),
    "magnetic": a("face"), "confident": a("shine"), "seductive": a("trap"),
    "mysterious": a("secret"), "triumphant": a("hajimemashite"),
}
SHOTS = {
    a("and"): "WIDE", a("egi"): "WIDE", a("face"): "MED", a("they"): "WIDE",
    a("trap"): "MACRO", a("warm"): "WIDE", a("alone"): "MED", a("doors"): "WIDE",
    a("house"): "WIDE", a("never"): "MED", a("shine"): "WIDE", a("kizuna"): "MED",
    a("reverl"): "CLOSE", a("secret"): "CLOSE", a("walking"): "WIDE",
    a("xsytrance"): "MED", a("hajimemashite"): "MED",
    b("cute"): "MED", b("levelready"): "MED",
}

SECTIONS = [
    {"start": 93.60,  "name": "LevelReady",   "emotion": "proud",      "intensity": 0.66, "colorHint": "#E8A33D"},
    {"start": 105.40, "name": "Bridge",       "emotion": "intimate",   "intensity": 0.48, "colorHint": "#E8A33D"},
    {"start": 118.30, "name": "Final Chorus", "emotion": "triumphant", "intensity": 0.70, "colorHint": "#F6D66B"},
    {"start": 135.20, "name": "Outro",        "emotion": "magnetic",   "intensity": 0.50, "colorHint": "#F6D66B"},
]
for i in range(1, len(SECTIONS)):
    d = abs(SECTIONS[i]["intensity"] - SECTIONS[i - 1]["intensity"])
    assert d < 0.25, f"BLOW risk at {SECTIONS[i]['name']}"
    assert SECTIONS[i]["intensity"] <= 0.71, f"SHAKE risk at {SECTIONS[i]['name']}"
win = [w for w in words if FROM <= w["t"] <= TO]
gaps = [win[i + 1]["t"] - win[i]["t"] for i in range(len(win) - 1)]
assert max(gaps) < 7.0, f"WIPE risk: {max(gaps):.2f}s"

WORD_FX = {
    "they": "echo", "cute": "bloom", "trap": "cling", "bait": "cling",
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

ACTS = [
    {"start": 97.60,  "end": 115.50, "label": "THE TRAP AND THE BAIT", "why": "verse two — she repeats the insult back and keeps walking"},
    {"start": 115.50, "end": 121.20, "label": "SAME MAN, THREE NAMES", "why": "the lineage, and the one name he kept"},
    {"start": 121.20, "end": 139.00, "label": "THE DOORS SWUNG OPEN",  "why": "the bridge drops to a whisper — the room was already hers"},
    {"start": 139.00, "end": TO,     "label": "HAJIMEMASHITE",          "why": "final chorus into the belt — the name lands"},
]
MODES = [{"start": x["start"], "end": x["end"], "mode": "dynamic"} for x in ACTS]
assert {m["mode"] for m in MODES} == {"dynamic"}

planet = {
    "generatedAt": "2026-09-16T00:00:00.000Z",
    "styleHint": (
        "OSAKA GOLD-LEAF NIGHT — photoreal Dotonbori after 2am and after rain, everything "
        "crushed to near-black except molten gold. v3's approved art set, unchanged, driven "
        "by v4's pure-dynamic text engine."
    ),
    "analysis": {
        # "rain" wins before "golden" reaches pollen, and that is correct here:
        # the grade is Dotonbori AFTER RAIN (§23 explains the ordering trap).
        "overallMood": "golden sultry midnight swagger",
        "themes": ["golden", "lanterns", "rain", "arrival"],
        "keywords": [],
        # palette[0] IS the melody's base hue (themeHue = hexHue(palette[0])),
        # not decoration — lead with the song's gold, never a near-black (§24).
        "palette": ["#E8A33D", "#F6D66B", "#FFE9A8", "#D96A3A", "#0A0805"],
        "summary": "She never introduced herself — the room was already hers.",
        "sections": SECTIONS,
    },
    "assets": {
        "broll": [], "keywords": KEYWORDS, "sections": SECTION_ART, "shots": SHOTS,
        "stems": f"{CDN}{V3}/stems/stems.json", "stemLag": 0,
    },
    "interactions": {"tapEffect": "shimmer", "moments": []},
    "dynamicPlus": {
        "v": 2,
        "directed": (
            f"HAJIMEMASHITE v5 — {FROM}-{TO} ({TO-FROM:.2f}s). v3's art set with v4's PURE "
            "DYNAMIC text: one giant word at a time, no pile, no phrase wall. Kizuna is back "
            "where v3 had her, including on 'she's so cute'. No silhouette plates."
        ),
        # No "scene": v3 pinned EMBERS, a real BACKDROP_SCENES entry, so the GL
        # ember field painted behind plates that render at 0.6 opacity (§23).
        "acts": ACTS,
        "modes": MODES,
        "words": WORD_FX,
        "oneShots": [{
            "id": "three-names", "kind": "nameCards", "solo": True,
            "start": 115.50, "end": 120.60,
            "cards": [
                {"text": "EGI",       "at": 115.60, "art": a("egi")},
                {"text": "XSYTRANCE", "at": 116.62, "art": a("xsytrance")},
                {"text": "AGENOR",    "at": 117.82, "art": a("shine")},
            ],
            "collapseAt": 118.40, "collapseTo": "AGENOR", "collapseDur": 0.7,
        }],
        "hits": [{"t": 127.48, "dur": 1.35}],
        "quakes": [126.66, 139.35, 147.55],
        "holds": [{"start": 150.98, "end": TO, "art": a("and")}],
        "rolls": [],
        "deck": {
            "art": True, "density": 2.0, "glow": 0.95, "grain": 0.3,
            "vignette": 0.55, "backdropHue": 0.06, "pitchSpread": 0.3,
            "giant": {"life": 1300, "pile": 0, "clearOnSwitch": True, "stutter": False},
            "choir": False, "ghosts": 0,
            "motion": {"dur": 2.2, "amp": 0.85, "swapMs": 900, "fade": 0.36},
        },
    },
}

row = {
    "id": SLUG, "title": "Hajimemashite", "artist": "Kizuna Sato",
    "genre": "R&B / Trap", "mood": "golden sultry", "color": "#E8A33D",
    "cover": f"{CDN}{V3}/scene-face.webp",
    "audio_url": f"/private/{SLUG}.mp3",
    "sort_order": 9011, "featured": False, "hidden": True,
    "lyrics": lrc,
    "lyrics_synced": {
        "source": "v3 hand-aligned window 97.60-157.55, verified on the lead stem",
        "refinedAt": "2026-09-16T00:00:00.000Z",
        "words": [{"t": w["t"], "w": w["w"]} for w in words],
    },
    "planet": planet,
}
OUT.write_text(json.dumps(row, indent=2, ensure_ascii=False))
kiz = {k for k, v in KEYWORDS.items() if any(s in v for s in
       ("cute", "face", "kizuna", "they", "walking", "alone", "never", "reverl",
        "secret", "shine", "warm", "hajimemashite", "levelready"))}
print(f"wrote {OUT}")
print(f"  window {FROM}->{TO} ({TO-FROM:.2f}s), {len(win)} words")
print(f"  {len(SHOTS)} plates — all v3's, plus 2 repaired to native portrait")
print(f"  'cute' -> {KEYWORDS['cute']}")
print(f"  modes all dynamic; no silhouette/crowd plates referenced")
