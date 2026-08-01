"""OSAKA GOLD-LEAF NIGHT — the native-portrait art pass for "Hajimemashite".

Kizuna Sato, LevelReady Records. Window 97.60 -> 157.55 (verse 2 -> bridge ->
final chorus + belt). Sixteen plates, 9:16 only.

WHY THIS FILE EXISTS
--------------------
The first pass generated 1184x880 LANDSCAPE art and the renderer drew it
object-cover into a 1080x1920 portrait frame. Covering 1920px of height scales a
880px-tall plate 2.18x, so the 1184px width becomes 2584px against a 1080px
frame and 58% OF EVERY IMAGE'S WIDTH IS THROWN AWAY. Every wide, environmental,
story-carrying shot survived only as a crop of her face. The owner's verdict:
"you kinda just made a powerpoint presentation of kizuna selfies".

So: every plate here is generated NATIVE PORTRAIT at 832x1472 (exact 9:16), the
prompts are written in stacked vertical depth (something at the bottom edge,
something in the middle band, something climbing to the top edge), and the
framing is deliberately WIDE most of the time. Exactly one true face portrait
exists in the whole cut ("face", t=142.70) and it is earned by fifteen shots of
holding back.

MECHANICS (playbook §12)
------------------------
  * Flux Kontext via aimlapi ONLY. Key at ~/.bfl_key. No ComfyUI, no local GPU.
  * Kontext is an instruction-editor: it KEEPS the subject of the source image,
    which is what makes sixteen frames read as one woman. Every prompt therefore
    carries an explicit IDENTITY clause and "DO NOT CHANGE HER IDENTITY" — and
    the B-roll frames (trap / Egi / xsytrance / doors) say just as explicitly
    that she is removed from the plate.
  * Kontext writes gibberish signage, and this song lives in Dotonbori, the most
    sign-covered street on earth. Every prompt bans text outright and demands
    blank glowing panels instead.
  * Sources: kizuna-black-suit.png is the ONLY one with no baked-in wordmark, so
    it is used full-frame. The others carry LevelReady / KIZUNA SATO type that
    Kontext would mangle, so their boxes crop the lettering away.

Usage:
    python3 scripts/song-art/kizuna-portrait.py --dry            # print prompts
    python3 scripts/song-art/kizuna-portrait.py --only face      # one plate
    python3 scripts/song-art/kizuna-portrait.py                  # the batch
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageFilter

REPO = Path("/home/xsyprime/Hermes/x1c7.com")
KEY_PATH = Path.home() / ".bfl_key"
BASE = "https://api.aimlapi.com/v1"
MODEL = "flux/kontext-pro/image-to-image"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")

ART = REPO / "assets/art/kizunasato"
OUT = REPO / "scripts/song-art/kizuna-out"
PLATES = OUT / "plates"
RAW = OUT / "raw"
MANIFEST = OUT / "manifest.json"

W, H = 832, 1472                      # native 9:16 — the whole point of this file

# Sources. box = crop in the ORIGINAL image (verified against real dimensions
# with PIL), chosen to dodge every baked-in wordmark so Kontext has no letters
# to imitate.
SRC = {
    # 1029x1528. Rooftop lounge, tailored black suit, city bokeh behind her.
    # The ONLY source with zero baked-in type — used full frame.
    "suit":   (ART / "kizuna-black-suit.png", (0, 0, 1029, 1528)),
    # 1023x1537. Dotonbori peace sign, school blazer. The top ~27% is a wall of
    # kanji signage, so the box starts below that band.
    "peace2": (ART / "kizuna-peace2.png", (0, 420, 1023, 1537)),
    # 1254x1254. Album-cover treatment: KIZUNA SATO wordmark across the top,
    # LevelReady lockup bottom-left, vertical katakana bars down both edges.
    # Box keeps only the clean centre. (Not used by this cut — kept as backup.)
    "peace":  (ART / "kizuna-peace.png", (150, 300, 1145, 975)),
    # 572x1024. Cassette-sleeve treatment, type on literally every edge plus a
    # printed contract in her hands. Only her head and shoulders are clean.
    # (Not used by this cut — kept as backup.)
    "deal":   (ART / "kizuna-record-deal.jpg", (215, 380, 440, 680)),
}

# The look every plate shares. Each scene prompt below already carries its own
# tailored GRADE paragraph (interiors say "interior", the street says "after
# rain"), so this is the fallback that gets appended only if one is missing —
# one source of truth, never doubled up.
GRADE = (
    "GRADE (identical across all sixteen plates): Osaka gold-leaf night — "
    "photoreal Dotonbori after 2am and after rain, everything crushed to "
    "near-black except molten gold; every light source a warm gold-leaf glow, "
    "ink-black shadows with no lift and only a whisper of cold blue in the "
    "deepest of them, wet asphalt, glass and canal water doubling every light "
    "into long vertical reflections, fine drifting mist, real 35mm film grain, "
    "gentle bloom on the hottest highlights only. Cinematic photorealism, "
    "shallow depth of field, 8k. "
    "ABSOLUTELY NO text, no letters, no numbers, no words, no kanji, no kana, "
    "no romaji, no signage copy, no shop signs, no banners, no plaques, no "
    "logos, no wordmarks, no watermarks, no captions anywhere in the image — "
    "every sign, screen, lantern and panel must be a blank glowing rectangle "
    "of pure coloured light with no characters on it."
)

# Appended only if a prompt forgot to say it. Same reasoning as GRADE.
FRAME = (
    "COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in "
    "stacked vertical depth; fill the entire tall frame edge to edge, no "
    "letterboxing, no borders, no black bars; keep everything that matters "
    "inside the middle 80% of the frame, as the plate is pushed in slightly "
    "on playback."
)

# The cut, in order. shotSize is the director's framing call; roll A = she is in
# the plate, roll B = she is deliberately absent and the city carries the line.
SCENES = [
    {
        "word": "They",
        "t": 97.98,
        "shotSize": "WIDE",
        "src": "peace2",
        "roll": "A",
        "prompt": "IDENTITY: keep the exact same woman from the source image and DO NOT CHANGE HER IDENTITY — a young Japanese-Latina woman with warm tan skin, long poker-straight jet-black hair falling past her waist with two bright platinum-gold face-framing streaks, sharp winged black eyeliner, gold hoop earrings, stacked gold bangles and long gold-tipped nails, wearing a cropped black school blazer over a white shirt with a black-and-gold striped tie, a short pleated black skirt, a heavy gold chain belt and black heels. Same face, same bone structure, same skin tone, same hair, same clothes. SCENE: WIDE, HIGH ANGLE — the camera is three storeys up at the top of a pedestrian overpass staircase, looking steeply DOWN into a packed wet Dotonbori crossing just after rain at two in the morning. She is tiny, under one fifth of the frame height, dead centre and LOW in the bottom fifth — the one motionless figure in a river of blurred strangers streaming past her. The three or four nearest heads have turned toward her, looking her over, appraising. She has not looked up. Above and behind her the canal-side buildings stack eight storeys of blank glowing coloured panels and lantern tiers straight up into black sky, and the wet stone throws every one of them back down toward the lens. She is being sized up by an entire city and the camera is on top of her: nobody has been crowned yet. COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in stacked vertical depth — wet reflective ground and blurred foreground bodies across the bottom edge, her small figure low in the frame, the city stacking up through the middle and the black sky closing the top; fill the entire tall frame edge to edge, no letterboxing, no borders, no black bars; keep everything that matters inside the middle 80% of the frame, as the plate is pushed in slightly on playback. GRADE (identical across all sixteen plates): Osaka gold-leaf night — photoreal Dotonbori after 2am and after rain, everything crushed to near-black except molten gold; every light source a warm gold-leaf glow, ink-black shadows with no lift and only a whisper of cold blue in the deepest of them, wet asphalt, glass and canal water doubling every light into long vertical reflections, fine drifting mist, real 35mm film grain, gentle bloom on the hottest highlights only. Cinematic photorealism, shallow depth of field, 8k. ABSOLUTELY NO text, letters, numbers, kanji, kana, romaji, signage, shop signs, banners, plaques, logos, wordmarks, watermarks or captions anywhere. CRITICAL — do not place any sign boards, billboards, screens, display panels or lettered surfaces in this scene AT ALL. There is nothing in frame that could carry writing. Every light comes only from bare warm bulbs, plain unmarked paper lanterns, strings of small filament lights, open doorways and reflections on wet ground. Any distant building face is a smooth dark surface with soft glowing windows and no panels on it.",
    },
    {
        "word": "trap",
        "t": 101.6,
        "shotSize": "MACRO",
        "src": "suit",
        "roll": "B",
        "prompt": "IDENTITY: the source image shows Kizuna Sato — a young Japanese-Latina woman with warm tan skin, long jet-black hair with platinum-gold face-framing streaks, winged black eyeliner and gold hoops — and across this series you must NOT CHANGE HER IDENTITY. In THIS frame she does not appear at all: remove the woman completely — no people anywhere in frame, no hands, no silhouettes, no reflections of people. SCENE: EXTREME MACRO, camera at water level, inches above the black canal water of Dotonbori at night; the water fills the whole tall frame like poured lacquer. A single hand-tied gold fishing lure hangs on an invisible line a finger's width above the surface — a barbed hook bound in gold silk thread with one small pearl at its eye, turning slowly, throwing a hot gold flare, one fat bead of water clinging to its point and about to fall. Directly beneath it, rising up out of the ink, the gold-and-white flank and open mouth of a big koi, close enough that its lips are already breaking the meniscus, the ring of its rise spreading outward. The trap has already worked. The most beautiful object in the picture is the hook. Razor-shallow focus on the lure, everything above and below it dissolving into black and gold bokeh. COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in stacked vertical depth — the lure hanging in the upper third, the surface-tension line across the middle, the rising koi and broken discs of reflected gold lantern light in the lower third; fill the entire tall frame edge to edge, no letterboxing, no borders, no black bars; keep everything that matters inside the middle 80% of the frame, as the plate is pushed in slightly on playback. GRADE (identical across all sixteen plates): Osaka gold-leaf night — photoreal Dotonbori after 2am and after rain, everything crushed to near-black except molten gold; every light source a warm gold-leaf glow, ink-black shadows with no lift and only a whisper of cold blue in the deepest of them, wet asphalt, glass and canal water doubling every light into long vertical reflections, fine drifting mist, real 35mm film grain, gentle bloom on the hottest highlights only. Cinematic photorealism, shallow depth of field, 8k. ABSOLUTELY NO text, no letters, no numbers, no words, no kanji, no kana, no romaji, no signage copy, no shop signs, no banners, no plaques, no logos, no wordmarks, no watermarks, no captions anywhere in the image — every reflected sign must be a blank smear of pure coloured light with no characters in it.",
    },
    {
        "word": "walking",
        "t": 103.52,
        "shotSize": "WIDE",
        "src": "peace2",
        "roll": "A",
        "prompt": "Keep the same woman from the source image and do not change her identity: Japanese-Latina, warm tan skin, long straight jet-black hair with two platinum-gold face-framing streaks, winged eyeliner, gold hoops, black tailored blazer over a white shirt with a black-and-gold striped tie. She walks away from the camera down the centre of a narrow wet alley at night, seen from behind, small in the middle of the tall frame, lanterns climbing both walls to a gold vanishing point high above her, her reflection trailing to the bottom edge. Nobody else. Osaka night after rain: everything near-black except molten gold, wet ground doubling every light, drifting mist, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, kanji, signage, logos or watermarks anywhere.",
    },
    {
        "word": "never",
        "t": 107.82,
        "shotSize": "MED",
        "src": "peace2",
        "roll": "A",
        "prompt": "IDENTITY: keep the exact same woman from the source image and DO NOT CHANGE HER IDENTITY — a young Japanese-Latina woman with warm tan skin, long poker-straight jet-black hair falling past her waist with two bright platinum-gold face-framing streaks, sharp winged black eyeliner, gold hoop earrings, stacked gold bangles and long gold-tipped nails, wearing a cropped black school blazer over a white shirt with a black-and-gold striped tie, a short pleated black skirt and a heavy gold chain belt. Same face, same bone structure, same skin tone, same hair, same clothes. SCENE: MEDIUM SHOT at her own eye level, she fills roughly half the frame height and stands centre-left. A ramen alley's floor vent is blasting an enormous column of white steam straight up past the shop fronts, lit hot gold from below by the grate. Two or three strangers on the far side of the column are swallowed by it — smeared, squinting, hunching away, one wiping his face, shirts sticking to them. She walks straight through the middle of exactly the same steam completely dry and entirely unbothered: not one hair lifted, not one bead of sweat, hands in her blazer pockets, chin level, faintly bored, and the vapour parts a clean hand's width around her body as though it will not touch her. Effortless. COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in stacked vertical depth — wet black stone and the glowing grate across the bottom edge with the strangers' legs, her body through the middle band, and the boiling gold-lit steam column plus the alley's stacked blank glowing panels filling the entire upper half to the top edge; fill the entire tall frame edge to edge, no letterboxing, no borders, no black bars; keep everything that matters inside the middle 80% of the frame, as the plate is pushed in slightly on playback. GRADE (identical across all sixteen plates): Osaka gold-leaf night — photoreal Dotonbori after 2am and after rain, everything crushed to near-black except molten gold; every light source a warm gold-leaf glow, ink-black shadows with no lift and only a whisper of cold blue in the deepest of them, wet asphalt, glass and canal water doubling every light into long vertical reflections, fine drifting mist, real 35mm film grain, gentle bloom on the hottest highlights only. Cinematic photorealism, shallow depth of field, 8k. ABSOLUTELY NO text, letters, numbers, kanji, kana, romaji, signage, shop signs, banners, plaques, logos, wordmarks, watermarks or captions anywhere. CRITICAL — do not place any sign boards, billboards, screens, display panels or lettered surfaces in this scene AT ALL. There is nothing in frame that could carry writing. Every light comes only from bare warm bulbs, plain unmarked paper lanterns, strings of small filament lights, open doorways and reflections on wet ground. Any distant building face is a smooth dark surface with soft glowing windows and no panels on it.",
    },
    {
        "word": "reverl—",
        "t": 111.02,
        "shotSize": "CLOSE",
        "src": "peace2",
        "roll": "A",
        "prompt": "IDENTITY: keep the exact same woman from the source image and DO NOT CHANGE HER IDENTITY — a young Japanese-Latina woman with warm tan skin, long poker-straight jet-black hair with two bright platinum-gold face-framing streaks, gold hoop earrings, stacked gold bangles and long gold-tipped nails, wearing a cropped black school blazer over a white shirt with a black-and-gold striped tie and a heavy gold chain belt. Same skin tone, same hands, same hair, same clothes, same jewellery. SCENE: CLOSE and low-lit, caught in the doorway of a basement club: her hand flying up to cover her mouth in the middle of a laugh — gold-tipped nails spread across her lips, stacked gold bangles sliding down her wrist, a fine gold chain slipping over the back of her hand. This is a close-up ON THE HAND AND THE LAUGH, NOT a face portrait: crop the frame across her face just above the bridge of her nose so her eyes are entirely out of shot — only the hand, the mouth, the jaw and the falling gold-streaked hair are visible. Behind the hand the club doorway's warm gold glare blows out to pure white-gold and the black street sits either side. She has just fumbled her own label's name and she thinks it is the funniest thing in Osaka. COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in stacked vertical depth — her blazer shoulder and the black street anchoring the bottom, the hand and mouth filling the middle band, the blown-out doorway light burning through the upper third above the crop of her face; fill the entire tall frame edge to edge, no letterboxing, no borders, no black bars; keep everything that matters inside the middle 80% of the frame, as the plate is pushed in slightly on playback. GRADE (identical across all sixteen plates): Osaka gold-leaf night — photoreal Dotonbori after 2am and after rain, everything crushed to near-black except molten gold; every light source a warm gold-leaf glow, ink-black shadows with no lift and only a whisper of cold blue in the deepest of them, wet asphalt, glass and canal water doubling every light into long vertical reflections, fine drifting mist, real 35mm film grain, gentle bloom on the hottest highlights only. Cinematic photorealism, shallow depth of field, 8k. ABSOLUTELY NO text, no letters, no numbers, no words, no kanji, no kana, no romaji, no signage copy, no shop signs, no banners, no plaques, no logos, no wordmarks, no watermarks, no captions anywhere in the image — every sign, screen, lantern and panel must be a blank glowing rectangle of pure coloured light with no characters on it.",
    },
    {
        "word": "Egi",
        "t": 115.6,
        "shotSize": "WIDE",
        "src": "suit",
        "roll": "B",
        "prompt": "IDENTITY: the source image shows Kizuna Sato — a young Japanese-Latina woman with warm tan skin, long jet-black hair with platinum-gold face-framing streaks, winged black eyeliner, gold hoops and a tailored black suit — and across this series you must NOT CHANGE HER IDENTITY. In THIS frame she does not appear at all, and that absence is the entire point: remove the woman completely. ABSOLUTELY NO PEOPLE ANYWHERE IN FRAME — nobody in the chair, nobody in the room, no figures, no silhouettes, no reflections of people. SCENE: WIDE, EXTREME LOW ANGLE from floor level, one hard stab of an image: the back room of a dark Osaka club. Three shallow black lacquer steps climb from the bottom edge of the frame, and at the top of them, raised above the camera, stands a single empty high-backed armchair upholstered in cracked gold leaf, lit by one narrow hard shaft falling from far above. The seat cushion carries a deep permanent dent, the shape of a man who sat there for years. A cut-glass tumbler of whisky sweats on the wide arm, the ice not yet melted, and one thin thread of cigarette smoke is still turning slowly through the beam, so he left seconds ago. Running across the black lacquer floor from the very bottom edge of the frame straight to the chair's front feet is one unbroken seam of molten liquid gold poured into the black — kintsugi repair scaled up to the size of a building. Above the chair the room falls to pure blackness, the dead crystal of unlit chandeliers just catching a rim of gold near the top edge. This is the throne of the man who came first, and its emptiness is the shot. COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in stacked vertical depth — the gold seam entering at the bottom edge and leading the eye up the frame, the empty chair on its steps at the middle-low third seen from below so it towers, the light shaft and smoke climbing the entire upper half into blackness; fill the entire tall frame edge to edge, no letterboxing, no borders, no black bars; keep everything that matters inside the middle 80% of the frame, as the plate is pushed in slightly on playback. GRADE (identical across all sixteen plates): Osaka gold-leaf night — photoreal interior after 2am, everything crushed to near-black except molten gold; every light source a warm gold-leaf glow, ink-black shadows with no lift and only a whisper of cold blue in the deepest of them, polished lacquer doubling every light into long vertical reflections, fine drifting mist, real 35mm film grain, gentle bloom on the hottest highlights only. Cinematic photorealism, shallow depth of field, 8k. ABSOLUTELY NO text, no letters, no numbers, no words, no kanji, no kana, no romaji, no signage copy, no engraved names, no plaques, no bottle labels, no logos, no wordmarks, no watermarks, no captions anywhere in the image.",
    },
    {
        "word": "xsytrance",
        "t": 116.62,
        "shotSize": "MED",
        "src": "suit",
        "roll": "B",
        "prompt": "IDENTITY: the source image shows Kizuna Sato — a young Japanese-Latina woman with warm tan skin, long jet-black hair with platinum-gold face-framing streaks, winged black eyeliner and gold hoops — and across this series you must NOT CHANGE HER IDENTITY. In THIS frame she does not appear at all: remove the woman completely. NO PEOPLE PHYSICALLY IN FRAME — the only human presence permitted is reflection, and no face may ever be readable. SCENE: MEDIUM SHOT with the camera almost on the ground, lens a few inches above the wet black asphalt of an empty Dotonbori alley. The same unbroken seam of molten liquid gold from the club floor continues out here in the street: it comes out of the far darkness at the top of the frame, runs down the centre of the alley toward the lens glowing from inside like a vein under skin, its heat haze warping the air just above it — and a metre from camera it FORKS INTO THREE fine gold branches that fan toward the bottom edge before the outer two curve back and merge into the brightest single line at the very bottom. Standing water lies in each of the three branches, and each of the three pools holds a reflection of the SAME broad-shouldered man in a hood — the same body three times, seen from three different angles, all faceless, all cast by a man who is not standing anywhere in the shot. Above, the alley narrows to a slot of black sky. One inheritance, one man, three names, and only one line reaching the lens. COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in stacked vertical depth — the three gold branches and their three reflections filling the bottom half as the strongest graphic element, the single seam running away up the centre into the far dark, the alley walls compressing inward toward the top edge; fill the entire tall frame edge to edge, no letterboxing, no borders, no black bars; keep everything that matters inside the middle 80% of the frame, as the plate is pushed in slightly on playback. GRADE (identical across all sixteen plates): Osaka gold-leaf night — photoreal Dotonbori after 2am and after rain, everything crushed to near-black except molten gold; every light source a warm gold-leaf glow, ink-black shadows with no lift and only a whisper of cold blue in the deepest of them, wet asphalt, glass and canal water doubling every light into long vertical reflections, fine drifting mist, real 35mm film grain, gentle bloom on the hottest highlights only. Cinematic photorealism, shallow depth of field, 8k. ABSOLUTELY NO text, no letters, no numbers, no words, no kanji, no kana, no romaji, no signage copy, no shop signs, no banners, no plaques, no logos, no wordmarks, no watermarks, no captions anywhere in the image — every sign and lantern must be a blank glowing rectangle of pure coloured light with no characters on it, and the gold seam itself must never form a letter, a number or a symbol.",
    },
    {
        "word": "shine",
        "t": 119.94,
        "shotSize": "WIDE",
        "src": "peace2",
        "roll": "A",
        "prompt": "IDENTITY: keep the exact same woman from the source image and DO NOT CHANGE HER IDENTITY — a young Japanese-Latina woman with warm tan skin, long poker-straight jet-black hair falling past her waist with two bright platinum-gold face-framing streaks, sharp winged black eyeliner, gold hoop earrings, stacked gold bangles, wearing a cropped black school blazer over a white shirt with a black-and-gold striped tie, a short pleated black skirt, a heavy gold chain belt and black heels. Same face, same bone structure, same skin tone, same hair, same clothes. SCENE: WIDE, LOW ANGLE, in the same narrow black-stone alley — and the single molten gold kintsugi seam in the paving runs up the frame from the bottom edge and ENDS exactly at her feet. Facing the alley are three enormous floor-to-ceiling rain-beaded glass panes standing side by side, each taller than a bus, water crawling down all of them. The left pane and the right pane have just gone dark — dead black glass. Only the centre pane is still burning, filling with hard white-gold light, and she steps into that one lit pane: full body, small, no more than a third of the frame height, standing in the lower third, chin up, hands loose. The gold rims her entire silhouette, fires off the chain at her waist, blows through the loose ends of her hair and throws her shadow forward down the seam toward camera. Behind the glass the Osaka skyline stacks upward in blank glowing panels to the very top edge. Two lights die, one stays, and she takes it. COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in stacked vertical depth — the gold seam and wet pavement spill across the bottom third, her small full-length figure in the lower-middle inside the lit pane, the three panes and the skyline behind them rising the full remaining height; fill the entire tall frame edge to edge, no letterboxing, no borders, no black bars; keep everything that matters inside the middle 80% of the frame, as the plate is pushed in slightly on playback. GRADE (identical across all sixteen plates): Osaka gold-leaf night — photoreal Dotonbori after 2am and after rain, everything crushed to near-black except molten gold; every light source a warm gold-leaf glow, ink-black shadows with no lift and only a whisper of cold blue in the deepest of them, wet asphalt, glass and canal water doubling every light into long vertical reflections, fine drifting mist, real 35mm film grain, gentle bloom on the hottest highlights only. Cinematic photorealism, shallow depth of field, 8k. ABSOLUTELY NO text, letters, numbers, kanji, kana, romaji, signage, shop signs, banners, plaques, logos, wordmarks, watermarks or captions anywhere. CRITICAL — do not place any sign boards, billboards, screens, display panels or lettered surfaces in this scene AT ALL. There is nothing in frame that could carry writing. Every light comes only from bare warm bulbs, plain unmarked paper lanterns, strings of small filament lights, open doorways and reflections on wet ground. Any distant building face is a smooth dark surface with soft glowing windows and no panels on it.",
    },
    {
        "word": "secret",
        "t": 123.14,
        "shotSize": "CLOSE",
        "src": "peace2",
        "roll": "A",
        "prompt": "IDENTITY: keep the exact same woman from the source image and DO NOT CHANGE HER IDENTITY — a young Japanese-Latina woman with warm tan skin, long poker-straight jet-black hair with two bright platinum-gold face-framing streaks, sharp winged black eyeliner, gold hoop earrings, and a cropped black school blazer over a white shirt with a black-and-gold striped tie. Same face, same bone structure, same skin tone, same hair, same clothes. SCENE: The camera is lying at the kerb, lens almost touching a black puddle in the gutter. She is not in the shot as a body at all — she arrives ONLY as her reflection in that water, upside down and close, filling the frame: her face mid-whisper, lips parted and pushed forward, eyebrows up, one platinum-gold streak of hair hanging down into the water's surface, a single lantern burning gold in the reflection beside her cheek. One raindrop has just landed at the edge of the reflection and a ring is travelling across her mouth, tearing it into gold ripples. Everything outside the puddle — the hard-focus kerbstone, the grain of the wet tarmac — is a dark blurred frame around it. Conspiratorial, hushed, the last quiet second before the lights come up. COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in stacked vertical depth — hard-focus wet kerbstone across the very bottom edge, the reflected whispering face filling the middle two-thirds, the puddle's far edge and blurred black tarmac closing the top; fill the entire tall frame edge to edge, no letterboxing, no borders, no black bars; keep everything that matters inside the middle 80% of the frame, as the plate is pushed in slightly on playback. GRADE (identical across all sixteen plates): Osaka gold-leaf night — photoreal Dotonbori after 2am and after rain, everything crushed to near-black except molten gold; every light source a warm gold-leaf glow, ink-black shadows with no lift and only a whisper of cold blue in the deepest of them, wet asphalt, glass and canal water doubling every light into long vertical reflections, fine drifting mist, real 35mm film grain, gentle bloom on the hottest highlights only. Cinematic photorealism, shallow depth of field, 8k. ABSOLUTELY NO text, no letters, no numbers, no words, no kanji, no kana, no romaji, no signage copy, no shop signs, no road markings that form characters, no plaques, no logos, no wordmarks, no watermarks, no captions anywhere in the image — every reflected sign and lantern must be a blank glowing shape of pure coloured light with no characters on it.",
    },
    {
        "word": "doors",
        "t": 125.46,
        "shotSize": "WIDE",
        "src": "suit",
        "roll": "B",
        "prompt": "No people anywhere in frame. A pair of huge black double doors at the top of wet stone steps, thrown open toward the camera, brilliant white-gold light pouring through the opening and flooding down the steps to the bottom edge, dust and sparks in the beam. Osaka night after rain: everything near-black except molten gold, wet ground doubling every light, drifting mist, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, kanji, signage, logos or watermarks anywhere.",
    },
    {
        "word": "alone",
        "t": 132.25,
        "shotSize": "MED",
        "src": "peace2",
        "roll": "A",
        "prompt": "IDENTITY: keep the exact same woman from the source image and DO NOT CHANGE HER IDENTITY — a young Japanese-Latina woman with warm tan skin, long poker-straight jet-black hair falling past her waist with two bright platinum-gold face-framing streaks, sharp winged black eyeliner, gold hoop earrings, stacked gold bangles, wearing a cropped black school blazer over a white shirt with a black-and-gold striped tie, a short pleated black skirt and a heavy gold chain belt. Same face, same bone structure, same skin tone, same hair, same clothes. SCENE: MEDIUM full-body shot on a completely empty wet Dotonbori street at four in the morning. Every shutter is down, every sign frame is dead and dark, and she is the only person left in the world — standing still on the wet stone, hands pushed into her blazer pockets, head tipped down and turned slightly away from the lens. A single gold streetlamp burns behind her and throws TWO long shadows out across the wet ground toward camera: one is hers — the skirt, the long hair, the loose stance, unmistakable — and the second, falling right alongside it and reaching further, belongs to a taller, broader-shouldered man in a hood who is NOWHERE in the frame. There is exactly ONE person visible in this image and there are TWO shadows. She is not looking at it. She knows it is there. Quiet, grateful, not lonely. COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in stacked vertical depth — the two long shadows stretching from her feet down into the bottom edge as the strongest graphic element, her figure standing in the middle band, the dead shuttered shopfronts, the streetlamp and the empty canyon of unlit sign frames rising behind her to the top edge; fill the entire tall frame edge to edge, no letterboxing, no borders, no black bars; keep everything that matters inside the middle 80% of the frame, as the plate is pushed in slightly on playback. GRADE (identical across all sixteen plates): Osaka gold-leaf night — photoreal Dotonbori after 2am and after rain, everything crushed to near-black except molten gold; every light source a warm gold-leaf glow, ink-black shadows with no lift and only a whisper of cold blue in the deepest of them, wet asphalt, glass and canal water doubling every light into long vertical reflections, fine drifting mist, real 35mm film grain, gentle bloom on the hottest highlights only. Cinematic photorealism, shallow depth of field, 8k. ABSOLUTELY NO text, no letters, no numbers, no words, no kanji, no kana, no romaji, no signage copy, no shop signs, no banners, no plaques, no road markings that form characters, no logos, no wordmarks, no watermarks, no captions anywhere in the image — every sign frame and panel must be blank with no characters on it.",
    },
    {
        "word": "warm",
        "t": 136.2,
        "shotSize": "WIDE",
        "src": "peace2",
        "roll": "A",
        "prompt": "IDENTITY: keep the exact same woman from the source image and DO NOT CHANGE HER IDENTITY — a young Japanese-Latina woman with warm tan skin, long poker-straight jet-black hair with two bright platinum-gold face-framing streaks, sharp winged black eyeliner, gold hoop earrings, wearing a cropped black school blazer over a white shirt with a black-and-gold striped tie, a short pleated black skirt and a heavy gold chain belt. Same face, same bone structure, same skin tone, same hair, same clothes. SCENE: VERY WIDE, EXTREME LONG SHOT — she must occupy LESS THAN ONE SIXTH of the frame height, a small distant figure; if she fills more than a sixth of the frame the shot is wrong interior of a low, warm, gold-lit Osaka izakaya, shot from the very back of the room looking toward its entrance. The room is already full and already glowing: every table occupied, the backs of dozens of heads and shoulders in soft focus mid-conversation, whisky glasses catching fire on the bar, a wall of blank glowing bottle-lit shelving climbing the right side, wooden beams and hanging paper lanterns stacking down from the ceiling. At the far end, small and framed dead centre in the doorway with the freezing black street behind her, she has just come in through the hanging noren curtain — blazer still on, hair and shoulders still wet with rain, one hand still holding the curtain aside. She is the smallest thing in the picture. Half the nearest faces have already turned toward her without the slightest surprise, glasses half-raised, as though a place had been kept. The room was warm before she got here. COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in stacked vertical depth — the near tables and silhouetted heads and shoulders in near-black across the bottom third, the warm gold air and occupied room receding through the middle, her tiny figure in the doorway at the upper-middle, beams and hanging lanterns closing the top edge; fill the entire tall frame edge to edge, no letterboxing, no borders, no black bars; keep everything that matters inside the middle 80% of the frame, as the plate is pushed in slightly on playback. GRADE (identical across all sixteen plates): Osaka gold-leaf night — photoreal interior after 2am, everything crushed to near-black except molten gold; every light source a warm gold-leaf glow, ink-black shadows with no lift and only a whisper of cold blue in the deepest of them, polished wood and glass doubling every light, fine drifting mist, real 35mm film grain, gentle bloom on the hottest highlights only. Cinematic photorealism, shallow depth of field, 8k. ABSOLUTELY NO text, letters, numbers, kanji, kana, romaji, signage, shop signs, banners, plaques, logos, wordmarks, watermarks or captions anywhere. CRITICAL — do not place any sign boards, billboards, screens, display panels or lettered surfaces in this scene AT ALL. There is nothing in frame that could carry writing. Every light comes only from bare warm bulbs, plain unmarked paper lanterns, strings of small filament lights, open doorways and reflections on wet ground. Any distant building face is a smooth dark surface with soft glowing windows and no panels on it.",
    },
    {
        "word": "Hajimemashite",
        "t": 139.35,
        "shotSize": "MED",
        "src": "suit",
        "roll": "A",
        "prompt": "IDENTITY: keep the exact same woman from the source image and DO NOT CHANGE HER IDENTITY — a young Japanese-Latina woman with warm tan skin, long poker-straight jet-black hair falling past her waist with bright platinum-gold face-framing streaks, sharp winged black eyeliner, gold hoop earrings and a fine gold chain at her throat, wearing a sharply tailored oversized black blazer worn open over a black crop top, a wide black leather obi-style waist belt with gold trim, wide black tailored trousers and black pointed patent heels. Same face, same bone structure, same skin tone, same hair, same wardrobe. SCENE: MEDIUM SHOT from a low three-quarter angle on a bare stage in a black room. She is folded into a deep, correct, formal Japanese bow from the waist — spine straight, hands flat on her thighs, head down, all of that long hair swung forward and hanging free, catching one hard gold key light from directly above; her face is mostly hidden by the fall of her hair. Along the very bottom edge of the frame the crowd is a black silhouetted frieze of heads and raised phones, out of focus, every phone screen a blank rectangle of pure white light. Above and around her is a colossal empty black void with two hard gold beams crossing high in the haze. Ceremonial, exact, respectful — the introduction performed properly before the boast, and the vertical space above her head is the size of what she is about to take. COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in stacked vertical depth — the black crowd frieze and phone lights anchoring the bottom edge, her bowing body filling the middle band with the gold pool on the stage deck under her, the empty black stage, haze and crossing gold beams climbing the entire upper half to the top edge; fill the entire tall frame edge to edge, no letterboxing, no borders, no black bars; keep everything that matters inside the middle 80% of the frame, as the plate is pushed in slightly on playback. GRADE (identical across all sixteen plates): Osaka gold-leaf night — photoreal, everything crushed to near-black except molten gold; every light source a warm gold-leaf glow, ink-black shadows with no lift and only a whisper of cold blue in the deepest of them, the polished stage deck doubling every light into long vertical reflections, fine drifting mist, real 35mm film grain, gentle bloom on the hottest highlights only. Cinematic photorealism, shallow depth of field, 8k. ABSOLUTELY NO text, no letters, no numbers, no words, no kanji, no kana, no romaji, no signage copy, no screens with writing, no banners, no plaques, no logos, no wordmarks, no watermarks, no captions anywhere in the image — every screen and panel behind the stage must be blank glowing coloured light with no characters on it.",
    },
    {
        "word": "face",
        "t": 142.7,
        "shotSize": "MED",
        "src": "suit",
        "roll": "A",
        "prompt": "Keep the same woman from the source image and do not change her identity: Japanese-Latina, warm tan skin, long straight jet-black hair with two platinum-gold face-framing streaks, winged eyeliner, gold hoops, black tailored blazer over a white shirt with a black-and-gold striped tie. She stands in the middle of a wet Osaka street at night having just straightened out of a bow, chin level, calm and unsmiling, looking straight down the lens while the blurred crowd streams past her on both sides. Waist up, she fills the middle of the tall frame, warm lantern glow behind her going soft and out of focus, wet ground throwing gold back up at her. Osaka night, molten gold on black, drifting mist, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, kanji, signage, logos or watermarks anywhere.",
    },
    {
        "word": "Kizuna",
        "t": 146.25,
        "shotSize": "MED",
        "src": "suit",
        "roll": "A",
        "prompt": "IDENTITY: keep the exact same woman from the source image and DO NOT CHANGE HER IDENTITY — a young Japanese-Latina woman with warm tan skin, long poker-straight jet-black hair falling past her waist with bright platinum-gold face-framing streaks, sharp winged black eyeliner, gold hoop earrings, wearing a sharply tailored oversized black blazer over a black crop top, a wide black leather obi-style waist belt with gold trim, wide black tailored trousers and black pointed patent heels. Same face, same bone structure, same skin tone, same hair, same wardrobe. SCENE: Her name-moment. MEDIUM SHOT, LOW ANGLE from just below her waist, camera tilted up so she leans back against the sky. She is absolutely still and planted in the LOWER THIRD of the frame — feet apart, one hand hooked in the lapel and pulling the blazer open just far enough that a heavy gold curb chain at her throat swings free and takes one hard specular hit of light, the single hottest point in the picture. She is not moving and not smiling; the crowd streams around her as pure coloured blur. Above her, filling the whole upper two-thirds of the frame, the Osaka night city stacks straight up — tower after tower, tangles of black cable, gantries, banks of blank glowing coloured panels, a helicopter light crawling at the very top — all softly out of focus and leaning inward over her head like a canopy. The city is above her and behind her, not in front of her: it belongs to her now. This is what her name looks like standing still. COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in stacked vertical depth — blurred crowd and wet ground at the bottom edge, her body occupying only the lower third with the chain flare near the lower-third line, and the city climbing the remaining two-thirds in receding gold haze; deliberately leave the upper half open and uncluttered; fill the entire tall frame edge to edge, no letterboxing, no borders, no black bars; keep everything that matters inside the middle 80% of the frame, as the plate is pushed in slightly on playback. GRADE (identical across all sixteen plates): Osaka gold-leaf night — photoreal Dotonbori after 2am and after rain, everything crushed to near-black except molten gold; every light source a warm gold-leaf glow, ink-black shadows with no lift and only a whisper of cold blue in the deepest of them, wet asphalt, glass and canal water doubling every light into long vertical reflections, fine drifting mist, real 35mm film grain, gentle bloom on the hottest highlights only. Cinematic photorealism, shallow depth of field, 8k. ABSOLUTELY NO text, no letters, no numbers, no words, no kanji, no kana, no romaji, no signage copy, no shop signs, no banners, no plaques, no logos, no wordmarks, no watermarks, no captions anywhere in the image — every sign, screen and panel must be a blank glowing rectangle of pure coloured light with no characters on it.",
    },
    {
        "word": "And",
        "t": 150.98,
        "shotSize": "WIDE",
        "src": "suit",
        "roll": "A",
        "prompt": "IDENTITY: keep the exact same woman from the source image and DO NOT CHANGE HER IDENTITY — a young Japanese-Latina woman with warm tan skin, long poker-straight jet-black hair falling past her waist with bright platinum-gold face-framing streaks, sharp winged black eyeliner, gold hoop earrings and a fine gold chain at her throat, wearing a sharply tailored oversized black blazer over a black crop top, a wide black leather obi-style waist belt with gold trim, wide black tailored trousers and black pointed patent heels. Same face, same bone structure, same skin tone, same hair, same wardrobe. SCENE: The belt, and the last frame of the cut — the exact inverse of the first frame, because the camera is finally BELOW her. She stands at the very lip of a high rooftop above Osaka in the hour before dawn, seen from slightly beneath and three-quarters behind so we get her shoulder, her jaw in profile and the whole world she is facing. She is SMALL, no more than a third of the frame height, down in the bottom third, arms hanging completely loose and open at her sides — no pose, no effort — chin lifted, head tipped a few degrees back, mouth open on one long held note. The wind is coming up the face of the building so her blazer and her whole length of hair are blown straight UPWARD, carrying a rising storm of gold sparks and embers with them. Beneath and beyond her the entire Osaka night grid burns quietly away to a black horizon — expressway ribbons, canal reflections, a million windows and thousands of blank glowing panels, the whole city she was standing at the bottom of an hour ago, now underneath her feet. Nothing is strained: she is standing still and the city is doing all of the shouting. COMPOSITION: native tall vertical 9:16 portrait at 832x1472, composed in stacked vertical depth — rooftop gravel and the parapet edge across the bottom, her small figure in the bottom third slightly off-centre, the burning city receding through the middle, and black sky with rising gold embers filling the top third; deliberately leave the upper half open and airy; fill the entire tall frame edge to edge, no letterboxing, no borders, no black bars; keep everything that matters inside the middle 80% of the frame, as the plate is pushed in slightly on playback. GRADE (identical across all sixteen plates): Osaka gold-leaf night — photoreal Dotonbori after 2am and after rain, everything crushed to near-black except molten gold; every light source a warm gold-leaf glow, ink-black shadows with no lift and only a whisper of cold blue in the deepest of them, wet surfaces doubling every light into long vertical reflections, fine drifting mist, real 35mm film grain, gentle bloom on the hottest highlights only. Cinematic photorealism, shallow depth of field, 8k. ABSOLUTELY NO text, no letters, no numbers, no words, no kanji, no kana, no romaji, no signage copy, no rooftop signs, no banners, no plaques, no logos, no wordmarks, no watermarks, no captions anywhere in the image — every sign, window and panel must be a blank glowing rectangle of pure coloured light with no characters on it.",
    },
]


def slug(word: str) -> str:
    """Filesystem-safe name. 'reverl—' -> 'reverl', 'Hajimemashite' -> lower."""
    s = re.sub(r"[^a-z0-9]+", "-", word.lower()).strip("-")
    return s or "scene"


def out_path(word: str) -> Path:
    return OUT / f"scene-{slug(word)}.webp"


def full_prompt(scene: dict) -> str:
    """The prompt as sent. Each scene already carries its COMPOSITION and GRADE
    paragraphs; these appends are a safety net so no plate can ever ship without
    the frame law or the no-text ban."""
    p = scene["prompt"].strip()
    if "COMPOSITION" not in p:
        p += " " + FRAME
    if "GRADE" not in p:
        p += " " + GRADE
    return p


def plate(src_key: str, dst: Path) -> Path:
    """Build a native-9:16 bed from a source photo.

    Playbook §12's outpainting trick, turned portrait: the cropped source is
    scaled to the frame's full width and the leftover height is packed with a
    blurred blow-up of the same picture, so Kontext has plausible material to
    extend into instead of inventing letterbox bars.
    """
    path, box = SRC[src_key]
    im = Image.open(path).convert("RGB").crop(box)
    bed = im.resize((W, max(1, round(W * im.height / im.width))), Image.LANCZOS)
    if bed.height >= H:
        top = (bed.height - H) // 2
        out = bed.crop((0, top, W, top + H))
    else:
        out = im.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(28))
        out.paste(bed, (0, (H - bed.height) // 2))
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst)
    return dst


def cover(im: Image.Image) -> Image.Image:
    """Force exactly 832x1472. Whatever Kontext hands back, the plate that
    reaches the renderer is native portrait — this is the bug this file exists
    to kill, so it is enforced here and not trusted to the API."""
    if im.size == (W, H):
        return im
    scale = max(W / im.width, H / im.height)
    im = im.resize((max(W, round(im.width * scale)), max(H, round(im.height * scale))),
                   Image.LANCZOS)
    left, top = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((left, top, left + W, top + H))


def key() -> str:
    if not KEY_PATH.exists():
        sys.exit(f"missing API key at {KEY_PATH}")
    return KEY_PATH.read_text().strip()


def post(payload: dict, api_key: str) -> dict:
    req = urllib.request.Request(
        BASE + "/images/generations", data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer " + api_key,
                 "Content-Type": "application/json",
                 "User-Agent": UA, "Accept": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=240))


def generate(scene: dict, api_key: str, force: bool = False) -> str:
    word = scene["word"]
    dst = out_path(word)
    if dst.exists() and not force:
        return f"  {word}: cached -> {dst.name}"
    src = plate(scene["src"], PLATES / f"{slug(word)}.png")
    prompt = full_prompt(scene)
    uri = "data:image/png;base64," + base64.b64encode(src.read_bytes()).decode()
    try:
        # safety_tolerance: BFL scales 0 (strictest) .. 6 (loosest). At "2" the
        # API silently returned SOLID BLACK plates for walking / doors / face —
        # a fully-clothed woman in a blazer on a street, and `doors` has no
        # person in it at all, so these are false positives. "5" is moderate,
        # not off. Black plates are still caught and quarantined below.
        r = post({"model": MODEL, "prompt": prompt, "image_url": uri,
                  "num_images": 1, "output_format": "png",
                  "safety_tolerance": "5"}, api_key)
    except urllib.error.HTTPError as e:
        return f"  {word}: HTTP {e.code} {e.read().decode()[:200]}"
    url = None
    if isinstance(r.get("images"), list) and r["images"]:
        url = r["images"][0].get("url")
    elif r.get("data"):
        url = r["data"][0].get("url")
    gid = r.get("id") or r.get("generation_id")
    for _ in range(60):
        if url:
            break
        time.sleep(5)
        q = urllib.request.Request(
            f"{BASE}/images/generations?generation_id={gid}",
            headers={"Authorization": "Bearer " + api_key, "User-Agent": UA})
        try:
            s = json.load(urllib.request.urlopen(q, timeout=60))
        except Exception:
            continue
        imgs = s.get("images") or s.get("data") or []
        if imgs:
            url = imgs[0].get("url")
        elif s.get("status") in ("failed", "error"):
            return f"  {word}: FAILED {json.dumps(s)[:200]}"
    if not url:
        return f"  {word}: no url {json.dumps(r)[:200]}"
    RAW.mkdir(parents=True, exist_ok=True)
    raw = RAW / f"{slug(word)}.png"
    subprocess.run(["curl", "-sSL", "-A", UA, "-o", str(raw), url],
                   check=True, timeout=240)
    im = Image.open(raw).convert("RGB")
    got = im.size
    cover(im).save(dst, "WEBP", quality=93, method=6)
    note = "" if got == (W, H) else f" (api gave {got[0]}x{got[1]}, cover-fixed)"
    return f"  {word}: {W}x{H} -> {dst.name}{note}"


def write_manifest() -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    shots = []
    for s in SCENES:
        path, box = SRC[s["src"]]
        shots.append({
            "word": s["word"],
            "t": s["t"],
            "shotSize": s["shotSize"],
            "roll": s["roll"],
            "prompt": full_prompt(s),
            "file": out_path(s["word"]).name,
            "source": path.name,
            "box": list(box),
        })
    MANIFEST.write_text(json.dumps({
        "song": "Hajimemashite",
        "artist": "Kizuna Sato",
        "voice": "OSAKA GOLD-LEAF NIGHT",
        "aspect": "9:16",
        "width": W,
        "height": H,
        "model": MODEL,
        "window": [97.60, 157.55],
        "shots": shots,
    }, indent=2, ensure_ascii=False) + "\n")
    return MANIFEST


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="OSAKA GOLD-LEAF NIGHT portrait plates")
    ap.add_argument("--only", help="generate a single scene by keyword (word or slug)")
    ap.add_argument("--dry", action="store_true",
                    help="print prompts and build plates, never call the API")
    ap.add_argument("--force", action="store_true", help="regenerate cached scenes")
    ap.add_argument("--jobs", type=int, default=4)
    a = ap.parse_args()

    todo = [s for s in SCENES
            if not a.only or a.only in (s["word"], slug(s["word"]))]
    if not todo:
        sys.exit(f"no scene named {a.only} "
                 f"(have: {', '.join(slug(s['word']) for s in SCENES)})")

    OUT.mkdir(parents=True, exist_ok=True)
    PLATES.mkdir(parents=True, exist_ok=True)
    man = write_manifest()

    if a.dry:
        print(f"DRY RUN — OSAKA GOLD-LEAF NIGHT, {len(todo)} scene(s) "
              f"at {W}x{H} via {MODEL}\n")
        for i, s in enumerate(todo, 1):
            p = full_prompt(s)
            bed = plate(s["src"], PLATES / f"{slug(s['word'])}.png")
            src_name = SRC[s["src"]][0].name
            print(f"[{i:02d}/{len(todo)}] {s['word']}  t={s['t']}  "
                  f"{s['shotSize']}  roll {s['roll']}")
            print(f"       src   {src_name} box={SRC[s['src']][1]} "
                  f"-> plate {Image.open(bed).size[0]}x{Image.open(bed).size[1]} "
                  f"{bed.name}")
            print(f"       out   {out_path(s['word']).name}")
            print(f"       chars {len(p)}   "
                  f"identity={'yes' if 'IDENTITY' in p else 'NO'}  "
                  f"comp={'yes' if 'COMPOSITION' in p else 'NO'}  "
                  f"grade={'yes' if 'GRADE' in p else 'NO'}  "
                  f"no-text={'yes' if 'ABSOLUTELY NO text' in p else 'NO'}")
            print(f"       {p}\n")
        print(f"manifest: {man}")
        sys.exit(0)

    api_key = key()
    print(f"OSAKA GOLD-LEAF NIGHT — {len(todo)} scene(s) via {MODEL} at {W}x{H}")
    with ThreadPoolExecutor(max_workers=a.jobs) as ex:
        for line in ex.map(lambda s: generate(s, api_key, a.force), todo):
            print(line, flush=True)
    print(f"manifest: {man}")
