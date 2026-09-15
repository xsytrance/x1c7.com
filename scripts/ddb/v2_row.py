#!/usr/bin/env python3
"""Days Drift By v2 — the tracks row.

Separate slug (`days-drift-by-cut-v2`) so v1 stays intact and the two can be
compared. The PLATES are reused from v1's R2 prefix verbatim — the imagery was
approved, only the typography changed — so `assets.*` point at
/planets/days-drift-by-cut/... while `gallery.json` has to be uploaded under
THIS slug, because KineticStage fetches it from `planets/<track.id>/gallery.json`
and nowhere else.
"""
import json

SLUG = "days-drift-by-cut-v2"
ART = "/planets/days-drift-by-cut"          # v1's plates, reused
EDGE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev"
W = json.load(open("scripts/ddb/v2_words.json"))
(W1_FROM, W1_TO) = W["windows"]["w1"]
(W2_FROM, W2_TO) = W["windows"]["w2"]
(W3_FROM, W3_TO) = W["windows"]["w3"]
all_words = W["w1"] + W["w2"] + W["w3"]
url = lambda n: f"{ART}/scene-{n}.webp"


def lrc(t):
    m = int(t // 60)
    return f"[{m:02d}:{t - m*60:05.2f}]"


# LRC lines matter ONLY for the phrase windows — dynamic stretches draw one word
# at a time and ignore line breaks. Stamped anyway across the whole cut so the
# engine never falls back to breath-gap segmentation (§10).
LINES = [
    (68.16, "Days drift by"),
    (70.32, "We don't have to know why"),
    (73.60, "Breathe"),
    (75.76, "Everything feels alive"),
    (79.12, "Days drift by"),
    (82.80, "sky"),
    (83.60, "Stay with me"),
    (86.24, "Stay with me"),
    (89.28, "Stay"),
    (111.60, "Clouds roll in"),
    (112.88, "Then fade away"),
    (114.88, "color melts gray"),
    (117.44, "sun way"),
    (120.24, "Just like it always does"),
    (123.28, "Closer"),
    (124.64, "Closer"),
    (126.80, "light"),
    (128.80, "Higher"),
    (130.16, "Higher"),
    (132.24, "leaves"),
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
shots = {url(n): s for n, s in SIZES.items()}

# Anchors >=1s apart inside every window (§4). Two demotions v2 forced:
#   * `drift`/`by` again lose to `days` — "Days drift by" is 1.36s end to end.
#   * `sky` (82.80) is 0.80s before `stay` (83.60), so `sky` loses its plate and
#     keeps only its FX. `stay` wins because the lone figure at dusk is this
#     planet's one human image and it belongs on that line.
keywords = {
    "days": url("days"), "breathe": url("breathe"), "alive": url("alive"),
    "stay": url("stay"),
    "clouds": url("clouds"), "fade": url("fade"), "gray": url("gray"),
    "sun": url("sun"), "way": url("way"), "closer": url("closer"),
    "light": url("light"), "higher": url("higher"), "leaves": url("leaves"),
}

# `days` fires 4x; pool it so the backdrop rotates (§3e). `stay` stays UNPOOLED
# on purpose — v1 proved the shot-grammar walk skips the base plate when it
# matches the size already on stage, and the figure never reached the screen.
gallery = {
    "art": {
        "days": [url("drift"), url("by"), url("sky"), url("gold"),
                 url("rain"), url("pine"), url("heron"), url("tonight")],
        "closer": [url("light"), url("way")],
        "higher": [url("pine"), url("sky")],
    }
}

sections_art = {
    "drifting": url("by"), "warming": url("gold"), "rising": url("pine"),
    "floating": url("sky"), "tender": url("heron"), "breaking": url("rain"),
    "fading": url("tonight"),
}

# Every intensity <=0.71 and every consecutive RISE <0.25 (§14). The opening
# section of each window starts BEFORE that window so art is up on frame one.
analysis_sections = [
    {"start": 62.00, "name": "days drift by", "emotion": "floating",
     "intensity": 0.56, "colorHint": "#A8D4E8"},
    {"start": 73.40, "name": "breathe tonight", "emotion": "tender",
     "intensity": 0.62, "colorHint": "#E8A88C"},
    {"start": 79.00, "name": "into the sky", "emotion": "rising",
     "intensity": 0.66, "colorHint": "#9FD8C8"},
    {"start": 83.40, "name": "stay with me", "emotion": "warming",
     "intensity": 0.58, "colorHint": "#E8C25A"},
    {"start": 105.00, "name": "the weather turns", "emotion": "drifting",
     "intensity": 0.38, "colorHint": "#7FA8B8"},
    {"start": 116.80, "name": "the sun finds its way", "emotion": "warming",
     "intensity": 0.52, "colorHint": "#E8C25A"},
    {"start": 123.20, "name": "the ascent", "emotion": "rising",
     "intensity": 0.66, "colorHint": "#9FD8C8"},
    {"start": 179.50, "name": "the break widens", "emotion": "drifting",
     "intensity": 0.55, "colorHint": "#8FC4D8"},
    {"start": 183.50, "name": "drift away", "emotion": "fading",
     "intensity": 0.48, "colorHint": "#C8D8E0"},
    {"start": 191.00, "name": "the last light", "emotion": "warming",
     "intensity": 0.42, "colorHint": "#E8C25A"},
]

# Tranche 9 is the point of v2. These only render on the giant dynamic word —
# phrase mode draws its words plain — so every mapping below is placed inside a
# dynamic window on purpose.
word_fx = {
    "days": "drift",        # the headline: the word crosses the frame like a leaf
    "drift": "drift",
    "by": "echo",
    "breathe": "inhale",
    "sky": "updraft",
    "stay": "linger",       # tries to leave twice, is pulled back, stays
    "gray": "greyout",
    "sun": "sunwake",
    "light": "sunwake",
    "higher": "updraft",
    "leaves": "updraft",
    "closer": "press",
    "color": "chromatic",
    "melts": "melt",
    "way": "rise",
    "alive": "sunwake",
    # `clouds` and `fade` carried a `dissolve` mapping in the first draft and the
    # self-check below rejected it: both words only ever occur inside W2's
    # opening PHRASE window, where FX are never rendered. Dropped rather than
    # faked — W2 opening plain is the calm the dynamic stretch cuts against.
}

# §14 — the synthesised wipe. The longest sung-word gap in the joined array is
# now W2->W3 (132.24 -> 183.70 = 51.46s), which would park a banner at
# 133.64-143.64 — and W2 runs to 135.883, so 2.24s of it would be ON SCREEN.
# free() only refuses within +-8s, so the blocker sits at 137.0: past W2's end,
# long before W3 starts, therefore never drawn, and still adjacent enough.
moments = [{"t": 137.00, "end": 138.00, "type": "wipe", "layer": "fog", "prompt": ""}]

planet = {
    "generatedAt": "2026-09-14T00:00:00.000Z",
    "styleHint": (
        "PAPER RIVER — ukiyo-e woodblock illustration, one forested river valley "
        "across one day. v2 typography: ~70% giant single words carrying Tranche 9 "
        "weather FX, ~30% plain phrase lines."
    ),
    "analysis": {
        "themes": ["drifting", "weather", "light through leaves", "letting time pass", "staying"],
        # The WORD colour array (§19). v2 draws words at up to 14rem, so an
        # illegible entry is far more costly than in v1 — all light/warm, all
        # readable on the darkest plate in the cut.
        "palette": ["#F4EAD6", "#F5C86B", "#9FD8C8", "#F0A88C", "#D9E8F2"],
        "summary": ("Liquid drum and bass that refuses to hurry. Opens on the hook, "
                    "climbs through the leaves, and drifts out on its own title."),
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
            "DAYS DRIFT BY v2 — 59.5s, PAPER RIVER plates reused from v1. Opens on "
            f"the FIRST chorus. W1 {W1_FROM}-{W1_TO}, W2 {W2_FROM}-{W2_TO}, "
            f"W3 {W3_FROM}-{W3_TO}; two 0.6s crossfades, both joins bar-aligned "
            "(10 bars, then 23). 71.9% dynamic / 28.1% phrase. 52 of 65 words "
            "drawn — the rest are dropped so the ones that matter hold the frame."
        ),
        # NOT "RIVER". KineticStage:445 silently ignores a scene that is not in
        # BACKDROP_SCENES (AURORA | EMBERS | INK | SYRUP), so "RIVER" left the
        # backdrop on AUTO — which hashes into the pool and landed this song on
        # EMBERS. The generative field is only visible in the moment before a
        # plate paints, but that moment is the FIRST SECOND of every window, so
        # v1 opens on orange fire under a woodblock river. INK is the one that
        # belongs to this voice.
        "scene": "INK",
        "acts": [
            {"start": W1_FROM, "end": 79.00, "label": "DAYS DRIFT BY",
             "why": "the hook, stated"},
            {"start": 79.00, "end": W1_TO, "label": "STAY WITH ME",
             "why": "the chorus turns to asking"},
            {"start": W2_FROM, "end": 123.00, "label": "COLOUR INTO GREY",
             "why": "the weather turns and the sun comes back"},
            {"start": 123.00, "end": W2_TO, "label": "THE ASCENT",
             "why": "closer, into the light, higher, through the leaves"},
            {"start": W3_FROM, "end": W3_TO, "label": "DRIFT AWAY",
             "why": "the title, twice, and gone"},
        ],
        "modes": W["modes"],
        "words": word_fx,
        "deck": {
            "glow": 1.1, "grain": 0.35, "density": 1.8, "vignette": 0.50,
            # pile 0 + clearOnSwitch: a dynamic window is a self-contained
            # statement, so the previous burst never sits under the next one.
            "giant": {"life": 2000, "pile": 0, "clearOnSwitch": True},
            # quantize: hold every backdrop swap until the next beat from
            # senses.json. Art used to change on the LYRIC clock, which is why
            # the cuts drifted instead of cutting.
            "motion": {"swapMs": 650, "quantize": "beat"},
            # PAPER RIVER is illustrated/painterly — a serif, mixed case, set a
            # little open. The house face (Space Grotesk, all-caps) shipped in
            # all 18 previous cuts.
            "type": {"family": "serif", "case": "none", "tracking": "0.02em"},
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
    "cover": f"{EDGE}{ART}/scene-days.webp",
    "audio_url": f"/private/{SLUG}.mp3",      # §13 — hidden rows need /private/
    "sort_order": 9003,
    "featured": False,
    "hidden": True,
    "lyrics": lyrics,
    "lyrics_synced": {
        "source": "parakeet-tdt-0.6b-v3 on the isolated lead stem, curated for v2",
        "refinedAt": "2026-09-14T00:00:00.000Z",
        "words": [{"t": w["t"], "w": w["w"]} for w in all_words],
    },
    "planet": planet,
}

json.dump(row, open("scripts/ddb/v2_row.json", "w"), indent=2)
json.dump(gallery, open("scripts/ddb/v2_gallery.json", "w"), indent=2)

# ── self-checks ──────────────────────────────────────────────────────────────
from collections import defaultdict
bad = []
for k in list(keywords) + list(word_fx) + list(sections_art) + list(gallery["art"]):
    if k != k.lower():
        bad.append(f"non-lowercase key {k!r}")
for s in analysis_sections:
    if not {"start", "name", "emotion", "intensity", "colorHint"} <= set(s):
        bad.append(f"section {s.get('name')} missing a field")
    if s["intensity"] >= 0.72:
        bad.append(f"section {s['name']} intensity >= 0.72 (shake)")
for a, b in zip(analysis_sections, analysis_sections[1:]):
    if b["intensity"] - a["intensity"] >= 0.25:
        bad.append(f"intensity jump {a['name']}->{b['name']} >= 0.25 (blow)")
for e in {s["emotion"] for s in analysis_sections}:
    if e not in sections_art:
        bad.append(f"emotion {e!r} has no plate")

# the pinned backdrop scene must actually exist, or it is silently ignored
SCENES = {"AURORA", "EMBERS", "INK", "SYRUP"}
_sc = planet["dynamicPlus"].get("scene")
if _sc and _sc not in SCENES:
    bad.append(f"dynamicPlus.scene {_sc!r} is not one of {sorted(SCENES)} — silently ignored")

# every FX id must exist in the registry's union
reg = open("src/lib/effects/registry.ts").read()
for fx in set(word_fx.values()):
    if f'"{fx}"' not in reg:
        bad.append(f"word FX {fx!r} is not a registered TextEffect")

# keyword anchors >=1s apart, per window; and every FX word must sit in a
# DYNAMIC window or its animation will never be seen (phrase renders plain).
modes = [(m["start"], m["end"], m["mode"]) for m in W["modes"]]
def mode_at(t):
    for s, e, mo in modes:
        if s <= t < e:
            return mo
    return "dynamic"
for part, lo, hi in (("w1", W1_FROM, W1_TO), ("w2", W2_FROM, W2_TO), ("w3", W3_FROM, W3_TO)):
    hits = [(w["t"], w["w"].lower().strip(".,!?")) for w in W[part]
            if w["w"].lower().strip(".,!?") in keywords]
    for (t0, w0), (t1, w1) in zip(hits, hits[1:]):
        if t1 - t0 < 1.0 and keywords[w0] != keywords[w1]:
            bad.append(f"{part}: {w0}@{t0} -> {w1}@{t1} only {t1-t0:.2f}s apart")
    print(f"{part}: {len(hits)} keyword anchors")
seen_phrase = defaultdict(list)
for w in all_words:
    lw = w["w"].lower().strip(".,!?")
    if lw in word_fx and mode_at(w["t"]) != "dynamic":
        seen_phrase[lw].append(w["t"])
for lw, ts in seen_phrase.items():
    if not any(mode_at(x["t"]) == "dynamic" for x in all_words
               if x["w"].lower().strip(".,!?") == lw):
        bad.append(f"FX {lw!r} only ever occurs in phrase windows — never rendered")

dynshare = sum(e - s for s, e, m in modes if m == "dynamic") / (
    (W1_TO - W1_FROM) + (W2_TO - W2_FROM) + (W3_TO - W3_FROM))
print(f"dynamic share {dynshare:.1%} · {len(all_words)} words · {len(word_fx)} FX mappings")
for b in bad:
    print("  ERROR", b)
print("\nwrote scripts/ddb/v2_row.json and scripts/ddb/v2_gallery.json")
raise SystemExit(1 if bad else 0)
