#!/usr/bin/env python3
"""DRINK DRINK [Don't Save Me] v2 — THE LAST POUR.

Re-cut of the 2026-07-24 original, which was 30s and buried under the stutter
word-pileup: "DRINK" scattered ten deep at random tilts and sizes across every
frame. Owner brief 2026-09-16: dynamic only; a visually pleasing technique for
the repeated word ("a way to stack the words"); lots of alcohol being poured; a
man in a dark room holding his head for "Pain keeps pounding in my head"; and a
technique where words look like they flow from a bottle.

The last two are ONE idea, so they are built as one: THE POUR
(deck.giant.stutterLayout). Chips fly in from `stutterEmit` — set to the mouth
of the bottle in the hero pour plate — and stack bottom-up at constant size with
no rotation. The repeated word becomes a LEVEL RISING instead of confetti.

Window 190.00 -> 250.00 (60.0s): the Build chant, the whole Final Hook, and the
fading outro chant. "Pain keeps pounding in my head" lands at 232.59.

    ~/whisper-venv/bin/python scripts/dd2cut/build_row.py
    node scripts/_kiz-db.mjs upsert scripts/dd2cut/row.json
"""
import json
from pathlib import Path

SLUG = "drink-drink-v2"
R2 = f"/planets/{SLUG}"
CDN = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev"
HERE = Path(__file__).resolve().parent
FROM, TO = 190.00, 250.00

def s(n): return f"{R2}/scene-{n}.webp"

words = json.loads((HERE / "words.json").read_text())["words"]
win = [w for w in words if FROM <= w["t"] <= TO]

# ── LRC: one line per sung phrase, and one per chant RUN. The line stamp must
# land on a real word or phraseStartIdx falls back to breath-gap guessing.
LINES = [
    (190.755, "Drink drink drink drink"),
    (198.780, "Drink drink drink drink"),
    (206.410, "Drink drink drink"),
    (210.470, "I don't wanna feel tonight"),
    (218.240, "Put my sorrow in the light"),
    (221.670, "Drink drink drink drink"),
    (225.010, "Bottle glowing by my bed"),
    (232.590, "Pain keeps pounding in my head"),
    (236.025, "Drink drink drink drink"),
    (244.080, "Don't save me"),
    (246.000, "Don't save me now"),
    (248.400, "Drink drink drink"),
]
def lrc(t):
    m = int(t // 60)
    return f"[{m:02d}:{t - m*60:05.2f}]"
lyrics = "\n".join(f"{lrc(t)}{txt}" for t, txt in LINES)

# ── ART ────────────────────────────────────────────────────────────────────
# Eight of sixteen plates are a pour, as asked. `drink` itself is pooled (§3e):
# it is 39 of 68 words, so without a rotation pool the frame would freeze on one
# image for whole chant runs.
KEYWORDS = {
    "drink": s("pour7"),
    "i": s("manhead"), "wanna": s("manhead"), "feel": s("manhead"),
    "tonight": s("barneon"),
    "put": s("pour2"), "sorrow": s("spill"), "light": s("pour5"),
    "bottle": s("bottlebed"), "glowing": s("bottlebed"), "bed": s("bottlebed"),
    # the plate the Sovereign asked for, on the line he asked for it
    "pain": s("manhead"), "keeps": s("manhead"), "pounding": s("manhead"),
    "head": s("manhead"),
    "don't": s("window"), "save": s("window"), "me": s("emptyglass"),
    "now": s("emptyglass"),
}
SECTION_ART = {
    "chant": s("pour1"), "numb": s("smoke"),
    "ache": s("manhead"), "fading": s("emptyglass"),
}
SHOTS = {s(n): sz for n, sz in [
    ("pour1", "MED"), ("pour2", "MACRO"), ("pour3", "MED"), ("pour4", "CLOSE"),
    ("pour5", "WIDE"), ("pour6", "MED"), ("pour7", "WIDE"), ("pour8", "MED"),
    ("manhead", "WIDE"), ("bottlebed", "MED"), ("barneon", "WIDE"),
    ("window", "WIDE"), ("smoke", "CLOSE"), ("fan", "WIDE"),
    ("emptyglass", "MED"), ("spill", "MED"),
]}

SECTIONS = [
    {"start": 190.00, "name": "the build",   "emotion": "chant",  "intensity": 0.60, "colorHint": "#E8CE45"},
    {"start": 210.40, "name": "final hook",  "emotion": "numb",   "intensity": 0.70, "colorHint": "#F0D84E"},
    {"start": 232.50, "name": "the ache",    "emotion": "ache",   "intensity": 0.52, "colorHint": "#D9B23C"},
    {"start": 244.00, "name": "fading out",  "emotion": "fading", "intensity": 0.34, "colorHint": "#B8922F"},
]
for i in range(1, len(SECTIONS)):
    d = abs(SECTIONS[i]["intensity"] - SECTIONS[i-1]["intensity"])
    assert d < 0.25, f"BLOW risk {d:.2f} at {SECTIONS[i]['name']}"
    assert SECTIONS[i]["intensity"] <= 0.71, f"SHAKE risk at {SECTIONS[i]['name']}"
gaps = [win[i+1]["t"] - win[i]["t"] for i in range(len(win)-1)]
assert max(gaps) < 7.0, f"WIPE risk {max(gaps):.2f}s"

# NOT every registry effect is colour-neutral. `drip` hardcodes a lilac/pink
# gradient (#e9d8ff / #ffd9ec / #cfa8ff) and `liquid` a blue one — both built
# for other songs' grades, and both fight amber badly: on the hook word, which
# is 39 of 68 words here, `drip` turned the whole cut lavender. `pulse` draws
# its glow from var(--theme-accent), so it wears whatever colour the song is.
# Check an effect's implementation before trusting its NAME to suit the art.
WORD_FX = {
    "drink": "pulse",          # theme-aware, and a hypnotic chant should pulse
    "i": "whisper", "don't": "redact", "wanna": "whisper",
    "feel": "fogbreath", "tonight": "neon",
    "put": "press", "my": "whisper", "sorrow": "bleed", "in": "drip",
    "the": "whisper", "light": "flashbulb",
    "bottle": "shimmer", "glowing": "neon", "by": "drip", "bed": "fall",
    "pain": "tremor", "keeps": "echo", "pounding": "quake", "head": "fracture",
    "save": "cling", "me": "dissolve", "now": "tvoff",
}

ACTS = [
    {"start": 190.00, "end": 210.40, "label": "THE BUILD",      "why": "the chant layering — the word stacks before a single line is sung"},
    {"start": 210.40, "end": 232.50, "label": "I DON'T WANNA FEEL", "why": "the final hook, full energy"},
    {"start": 232.50, "end": 244.00, "label": "PAIN KEEPS POUNDING", "why": "the line the whole song has been circling"},
    {"start": 244.00, "end": TO,     "label": "DON'T SAVE ME",  "why": "the fading chant, and the last word"},
]
MODES = [{"start": a["start"], "end": a["end"], "mode": "dynamic"} for a in ACTS]
assert {m["mode"] for m in MODES} == {"dynamic"}

planet = {
    "generatedAt": "2026-09-16T00:00:00.000Z",
    "styleHint": (
        "THE LAST POUR — near-black room lit by one warm amber source, the liquid the only "
        "bright thing in frame and backlit so it glows. Eight of sixteen plates are alcohol "
        "being poured. Insomnia, not a party."
    ),
    "analysis": {
        # particleModeFor: "drink" hits the bubbles rule before anything else,
        # which is champagne-fizz and wrong for this song. Keep the word out of
        # these strings so "smoke"/"amber"/"golden" can reach pollen — slow warm
        # motes hanging in a dark room (§23 documents the ordering trap).
        "overallMood": "golden amber insomnia",
        "themes": ["golden", "amber", "lanterns", "midnight"],
        "keywords": [],
        # palette[0] is the melody's base hue. deriveTheme also derives the ACCENT at
        # seed-hue minus 35, and an unpitched giant word falls back to that accent —
        # at amber (hue 38) it came out vivid pink over the whiskey. A golden seed
        # (hue ~58) keeps the accent in warm orange instead.
        "palette": ["#E8CE45", "#F0D84E", "#D9B23C", "#FBE3B0", "#0A0705"],
        "summary": "A man counting pours in the dark, asking not to be saved.",
        "sections": SECTIONS,
    },
    "assets": {
        "broll": [], "keywords": KEYWORDS, "sections": SECTION_ART, "shots": SHOTS,
        "stems": f"{CDN}{R2}/stems/stems.json", "stemLag": 0,
    },
    "interactions": {"tapEffect": "drip", "moments": []},
    "dynamicPlus": {
        "v": 2,
        "directed": (
            f"DRINK DRINK v2 — THE LAST POUR. {FROM}-{TO} ({TO-FROM:.1f}s). Pure dynamic. The "
            "repeated hook word is staged with THE POUR: chips fly from the bottle's mouth at "
            "the top of the frame and stack bottom-up like a rising level."
        ),
        "acts": ACTS,
        "modes": MODES,
        "words": WORD_FX,
        "hits": [], "holds": [], "rolls": [],
        # the 808 drops
        "quakes": [210.47, 232.59, 244.08],
        "deck": {
            # PINNED. Left to infer, particleModeFor matches "drink" in the
            # TITLE against its champagne/bubbles rule and fizzes a whiskey
            # insomnia song. Dust is the right weather for this room.
            "weather": "dust",
            "art": True, "density": 2.0, "glow": 0.9, "grain": 0.32,
            "vignette": 0.6, "backdropHue": 0.05, "pitchSpread": 0.3,
            "giant": {
                "life": 1200, "pile": 0, "clearOnSwitch": True,
                # THE POUR. stutter stays ON here — it is the whole technique —
                # but laid out as a stack instead of the scatter that wrecked
                # the 2026-07 cut. The emit point is the mouth of scene-pour7,
                # where the amber arc enters the top of the frame.
                "stutter": True,
                "stutterLayout": "pour",
                "stutterEmit": [46, 4],
            },
            "choir": False, "ghosts": 0,
            "motion": {"dur": 2.2, "amp": 0.8, "swapMs": 850, "fade": 0.34},
        },
    },
}

row = {
    "id": SLUG, "title": "Drink Drink [Don't Save Me]", "artist": "AGENOR",
    "genre": "Dark Hip-Hop / R&B", "mood": "golden amber insomnia", "color": "#E2A23A",
    "cover": f"{CDN}{R2}/scene-pour7.webp",
    "audio_url": f"/private/{SLUG}.mp3",
    "sort_order": 9012, "featured": False, "hidden": True,
    "lyrics": lyrics,
    "lyrics_synced": {
        "source": json.loads((HERE / "words.json").read_text())["source"],
        "refinedAt": "2026-09-16T00:00:00.000Z",
        "words": words,
    },
    "planet": planet,
}
(HERE / "row.json").write_text(json.dumps(row, indent=2, ensure_ascii=False))
drinks = sum(1 for w in win if w["w"].lower() == "drink")
print(f"wrote {HERE/'row.json'}")
print(f"  window {FROM}-{TO} ({TO-FROM:.1f}s), {len(win)} words ({drinks} Drink)")
print(f"  {len(SHOTS)} plates, 8 of them pours; THE POUR emit {planet['dynamicPlus']['deck']['giant']['stutterEmit']}")
import collections
c = collections.Counter(SHOTS.values()); t = sum(c.values())
print(f"  shots {dict(c)} — WIDE {c['WIDE']/t*100:.0f}%, CLOSE+MACRO {(c['CLOSE']+c['MACRO'])/t*100:.0f}%")
