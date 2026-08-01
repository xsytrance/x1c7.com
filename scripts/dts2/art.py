"""BLUEPRINT DAWN — the tenth art voice, for the AGENOR debut cut.

The idea the lyrics hand you: this window is the moment the plan becomes the
life. "Little by little the vision gets official." So the art is literally a
drafting table resolving into a photograph — cyan architectural blueprint
linework over warm dawn photoreal, and the blueprint THINS as the cut runs.
Scene 1 is 90% drawing; the last scene has none left. The song's argument is
in the render, not just the words.

Two rules from the playbook shape the mechanics:

  §12  Kontext is an instruction-editor. Feed it Rod's OWN brand images and it
       keeps his hooded, headphoned protagonist and rebuilds the world around
       him — so seventeen scenes read as one person's story. It also writes
       gibberish signage, so every prompt bans text outright and the one card
       that MUST carry his marks (the end card) is composited from the real
       logo file, never generated.

  §objectFit  Scene art is drawn object-cover. In a 1080x1920 frame the old
       1152x832 landscape art loses ~60% of its width. This cut is 9:16 only,
       so the plates are built and generated NATIVE PORTRAIT.

Usage:
    python3 scripts/dts2/art.py --only sleepwalking     # one, to eyeball
    python3 scripts/dts2/art.py                          # the batch
"""
from __future__ import annotations

import argparse
import base64
import json
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageFilter

KEY = Path.home().joinpath(".bfl_key").read_text().strip()
BASE = "https://api.aimlapi.com/v1"
MODEL = "flux/kontext-pro/image-to-image"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")

ART = Path("/home/xsyprime/Hermes/x1c7.com/assets/art/xsytrance")
OUT = Path("/home/xsyprime/Hermes/x1c7.com/scripts/dts2/art-out")
PLATES = OUT / "plates"
W, H = 832, 1472                      # native 9:16 for a portrait-only cut

# Sources. box = crop in the ORIGINAL image, chosen to dodge the baked-in
# wordmarks so Kontext has no letters to mangle.
SRC = {
    # DJ from behind, hood + headphones, lasers, crowd. Our protagonist.
    "hero":  (ART / "xsytrance2.png", (0, 120, 941, 1500)),
    # Same figure, beach at night, palm trees, a wave. The fantasy.
    "beach": (ART / "xsytrance3.png", (0, 100, 941, 1500)),
    # Lone figure looking at a neon skyline (crop below the wordmark).
    "city":  (ART / "xsytrance.png",  (120, 430, 1130, 1254)),
}

# The clause every scene shares — this is what makes seventeen images one voice.
GRADE = (
    "Shoot the whole series as one look: a deep indigo-to-amber dawn sky, warm "
    "golden rim light raking from the left, cool teal shadows, gentle "
    "atmospheric haze, fine film grain and a soft bloom on the highlights. "
    "Cinematic, photorealistic, shallow depth of field, 8k. "
    "ABSOLUTELY NO text, no letters, no numbers, no words, no signage, no "
    "logos, no watermarks, no captions anywhere in the image."
)


def bp(level: float) -> str:
    """The blueprint overlay clause, at a given strength."""
    if level <= 0.05:
        return ("The world is now fully real and solid — no drawing, no "
                "linework, no grid remains anywhere. ")
    if level >= 0.7:
        return ("Most of this scene is not yet real: it is drawn as a glowing "
                "pale cyan architectural blueprint — precise drafting lines, a "
                "fine measurement grid, construction circles, dimension arrows "
                "and tick marks — floating in dark space. Only the light "
                "itself is photographic. The drawing is the world. ")
    if level >= 0.4:
        return ("The scene is half-built: warm photoreal surfaces are inking "
                "in over a glowing pale cyan blueprint understructure, with "
                "drafting grid lines, construction circles and dimension "
                "arrows still visible around the edges where reality has not "
                "finished resolving. ")
    return ("The scene is almost entirely real and photographic; only a few "
            "faint pale cyan drafting lines and tick marks still linger at "
            "the very edges of the frame, about to fade. ")


HERO_ID = ("Keep the same man from the source image as the subject and do not "
           "change his identity: seen from behind or in silhouette, dark hood "
           "up over broad shoulders, large over-ear headphones. ")

# word -> (t, source, blueprint level, scene). Order IS the narrative.
SCENES = [
    ("sleepwalking", 233.79, "hero", 0.90,
     HERO_ID + "He is sleepwalking with his eyes shut down the middle of a "
     "long glass-walled corporate office corridor at dawn, rows of empty desks "
     "and dead monitors on both sides, a hard shaft of sunrise cutting across "
     "the floor. He is drifting, unaware, half-dissolved."),

    ("here", 243.20, "hero", 0.72,
     HERO_ID + "He has stopped dead in the middle of that corridor and turned "
     "to face the enormous window, head lifting, wide awake for the first "
     "time. The sunrise floods over him and the drawn world behind him is "
     "just beginning to ink into real colour, starting at his shoulders."),

    ("gear", 247.07, "city", 0.62,
     "A home studio desk at dawn seen close and low: two wide monitors glowing "
     "warm, a midi keyboard, studio headphones resting on the wood, a cold "
     "drink beading with condensation beside the keys, a window of sunrise "
     "behind. Nobody in frame. Intimate, hopeful, the moment before work."),

    ("away", 251.92, "city", 0.58,
     "A grey cubicle office interior at dawn is peeling apart and blowing away "
     "in sheets, the partitions and ceiling tiles lifting off as flecks of ash "
     "and paper into a brightening sky, revealing open air and sunrise behind "
     "where the wall used to be."),

    ("shoulders", 254.26, "hero", 0.50,
     HERO_ID + "He stands on a city rooftop at sunrise, seen from behind, arms "
     "loose at his sides, the sun sitting directly on his shoulders and firing "
     "a huge golden rim around his whole silhouette. The skyline stretches out "
     "below him in warm haze."),

    ("play", 256.12, "city", 0.55,
     "A vast city seen from high above at dawn, its avenues and blocks laid "
     "out like the board of an enormous game — the street grid glowing, a few "
     "blocks standing up as bright polished playing pieces above the rest. "
     "Aerial, geometric, inviting."),

    ("someday", 259.79, "city", 0.52,
     "A wall calendar and an old alarm clock hanging in dark empty space, both "
     "coming apart into a stream of glowing particles that drift upward and "
     "burn out. Time itself dissolving. Nobody in frame."),

    ("learn", 261.03, "hero", 0.45,
     HERO_ID + "Extreme close profile of him in the dark, lit only by the "
     "screen in front of him, rivers of soft glowing code and diagrams "
     "reflected across his face and headphones. Absolute concentration."),

    ("build", 262.87, "hero", 0.40,
     "Close on a pair of hands in warm lamplight, assembling a miniature "
     "glowing city out of light — towers rising up out of a luminous cyan "
     "wireframe plan spread across the table beneath them, becoming solid warm "
     "stone and glass as the hands set each piece down. The single most "
     "important image of the series: a plan becoming a place."),

    ("breathe", 265.88, "beach", 0.28,
     "A tall glass on a wooden ledge at golden hour, dark rum and ice being "
     "poured into it, condensation running down, warm light burning through "
     "the liquid, sea haze and palm shadow behind. Slow, earned, exhaled."),

    ("fantasy", 267.10, "beach", 0.30,
     "A row of tall palm trees against a huge amber and indigo sunset over the "
     "ocean, seen from the sand looking up. Impossibly beautiful, dreamlike, "
     "the postcard in his head."),

    ("working", 268.50, "beach", 0.22,
     "An open laptop glowing warm on a low wooden table right on the sand at "
     "dusk, a drink beside it, palm trees leaning overhead and the ocean going "
     "gold and violet behind. Nobody in frame. The whole thesis of the song: "
     "the work and the paradise in one shot."),

    ("future", 270.56, "beach", 0.12,
     "A wide clean horizon at sunrise over calm water, the sun just clearing "
     "the line and throwing a long gold road across the sea toward the camera. "
     "Open, uncomplicated, everything ahead."),

    ("too", 279.60, "hero", 0.05,
     HERO_ID + "He stands facing us now in full warm daylight, hood back off "
     "his head, shoulders squared, completely solid and real — a portrait of a "
     "man who finished changing. Behind him the city is sunlit and sharp."),

    ("light", 283.74, "hero", 0.05,
     HERO_ID + "Seen from behind at his decks, arms lifted, facing an enormous "
     "crowd with hundreds of hands in the air, great beams of warm gold and "
     "magenta light firing overhead through the haze. Euphoric, packed, alive."),

    ("losing", 291.12, "city", 0.05,
     "A long empty road at dawn running straight out toward a glowing city on "
     "the horizon, wet asphalt throwing back the gold of the sky, everything "
     "ahead and nothing behind. Motion, arrival, no time left on the table."),
]


def plate(src_key: str, dst: Path) -> Path:
    """Build a native-9:16 bed from a source image.

    §12's outpainting trick, turned portrait: the subject is scaled to fill the
    frame's width and the remaining height is packed with a blurred blow-up of
    the same picture, so Kontext has plausible material to extend into instead
    of inventing letterboxes.
    """
    path, box = SRC[src_key]
    im = Image.open(path).convert("RGB").crop(box)
    bed = im.resize((W, int(W * im.height / im.width)), Image.LANCZOS)
    if bed.height >= H:
        top = (bed.height - H) // 2
        out = bed.crop((0, top, W, top + H))
    else:
        big = im.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(28))
        out = big
        out.paste(bed, (0, (H - bed.height) // 2))
    out.save(dst)
    return dst


def post(payload: dict) -> dict:
    req = urllib.request.Request(
        BASE + "/images/generations", data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json",
                 "User-Agent": UA, "Accept": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=240))


def generate(word: str, src_key: str, level: float, scene: str) -> str:
    src = plate(src_key, PLATES / f"{word}.png")
    dst = OUT / f"{word}.png"
    if dst.exists():
        return f"  {word}: cached"
    prompt = (f"{bp(level)}{scene} Fill the entire tall vertical frame edge to "
              f"edge with the scene. {GRADE}")
    uri = "data:image/png;base64," + base64.b64encode(src.read_bytes()).decode()
    try:
        r = post({"model": MODEL, "prompt": prompt, "image_url": uri,
                  "num_images": 1, "output_format": "png", "safety_tolerance": "2"})
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
        q = urllib.request.Request(f"{BASE}/images/generations?generation_id={gid}",
                                   headers={"Authorization": "Bearer " + KEY, "User-Agent": UA})
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
    subprocess.run(["curl", "-sSL", "-A", UA, "-o", str(dst), url], check=True, timeout=240)
    im = Image.open(dst)
    return f"  {word}: {im.size[0]}x{im.size[1]} -> {dst.name}"


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="generate a single scene by keyword")
    ap.add_argument("--jobs", type=int, default=4)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    PLATES.mkdir(parents=True, exist_ok=True)
    todo = [s for s in SCENES if not a.only or s[0] == a.only]
    if not todo:
        sys.exit(f"no scene named {a.only}")
    print(f"BLUEPRINT DAWN — {len(todo)} scene(s) via {MODEL} at {W}x{H}")
    with ThreadPoolExecutor(max_workers=a.jobs) as ex:
        for line in ex.map(lambda s: generate(s[0], s[2], s[3], s[4]), todo):
            print(line, flush=True)
