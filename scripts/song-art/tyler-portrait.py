"""VITRINE NOIR — the native-portrait art pass for "Hajimemashite".

Tyler Haze, LevelReady Records. Window 97.60 -> 157.55 (verse 2 -> bridge ->
final chorus + belt). Sixteen plates, 9:16 only.

WHY THIS FILE EXISTS
--------------------
The first pass generated 1184x880 LANDSCAPE art and the renderer drew it
object-cover into a 1080x1920 portrait frame. Covering 1920px of height scales a
880px-tall plate 2.18x, so the 1184px width becomes 2584px against a 1080px
frame and 58% OF EVERY IMAGE'S WIDTH IS THROWN AWAY. Every wide, environmental,
story-carrying shot survived only as a crop of her face. The owner's verdict:
"you kinda just made a powerpoint presentation of tyler selfies".

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
    carries an explicit IDENTITY clause and "do not change his identity" — and
    the B-roll frames (trap / Egi / xsytrance / doors) say just as explicitly
    that she is removed from the plate.
  * Kontext writes gibberish signage, and this song lives in Dotonbori, the most
    sign-covered street on earth. Every prompt bans text outright and demands
    blank glowing panels instead.
  * Sources: tyler-black-suit.png is the ONLY one with no baked-in wordmark, so
    it is used full-frame. The others carry LevelReady / KIZUNA SATO type that
    Kontext would mangle, so their boxes crop the lettering away.

Usage:
    python3 scripts/song-art/tyler-portrait.py --dry            # print prompts
    python3 scripts/song-art/tyler-portrait.py --only face      # one plate
    python3 scripts/song-art/tyler-portrait.py                  # the batch
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

ART = REPO / "assets/art/tylerhaze"
OUT = REPO / "scripts/song-art/tyler-out"
PLATES = OUT / "plates"
RAW = OUT / "raw"
MANIFEST = OUT / "manifest.json"

W, H = 832, 1472                      # native 9:16 — the whole point of this file

# Sources. box = crop in the ORIGINAL image (verified against real dimensions
# with PIL), chosen to dodge every baked-in wordmark so Kontext has no letters
# to imitate.
SRC = {
    "port": (ART / "02.webp", (0, 0, 1024, 1024)),
    # 10.webp (Mall Rats) is the perfect COMPOSITION for this song — him walking
    # while a crowd stares — but it carries a "Tyler" script top-left AND the red
    # "Mall Rats" wordmark, and no crop box keeps his full figure while excluding
    # both. Kontext reproduced them faithfully (playbook §12: it mangles baked-in
    # type). 02.webp is the only genuinely text-free source, and Kontext builds a
    # full wide scene from it regardless — so both keys point at it.
    "mall": (ART / "02.webp", (0, 0, 1024, 1024)),
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
        "word": "keeping",
        "t": 150.72,
        "shotSize": "WIDE",
        "src": "mall",
        "roll": "A",
        "prompt": "Keep the same man from the source image and do not change his identity: pale skin, messy dark hair, small stick-and-poke face tattoos, silver chains, black clothes. He stands alone inside a vast lit glass display case in a dark museum hall, tiny in the frame, seen from far across the room; one lone visitor silhouette stands outside the glass looking in. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "palms",
        "t": 153.7,
        "shotSize": "MACRO",
        "src": "mall",
        "roll": "B",
        "prompt": "No people visible, only hands. Seen from INSIDE the case: many bare palms pressed flat against fogged glass from the far side, fingers splayed, condensation blooming around each one. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "framed",
        "t": 156.3,
        "shotSize": "WIDE",
        "src": "port",
        "roll": "A",
        "prompt": "Keep the same man from the source image and do not change his identity: pale skin, messy dark hair, small stick-and-poke face tattoos, silver chains, black clothes. He sits on a low plinth inside a roped-off gallery alcove in an enormous empty white room, very small in the frame, lit from directly above like an exhibit. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "cracks",
        "t": 158.86,
        "shotSize": "MED",
        "src": "mall",
        "roll": "B",
        "prompt": "No people. A spiderweb fracture spreading across a huge pane of glass, bright cold light burning through from behind it, tiny fragments already falling. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "cage",
        "t": 161.7,
        "shotSize": "WIDE",
        "src": "mall",
        "roll": "B",
        "prompt": "No people. A large empty steel cage standing open in a single hard spotlight on a black floor, door swung wide, nothing inside, dust in the beam. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "exhibit",
        "t": 164.18,
        "shotSize": "WIDE",
        "src": "mall",
        "roll": "A",
        "prompt": "Keep the same man from the source image and do not change his identity: pale skin, messy dark hair, small stick-and-poke face tattoos, silver chains, black clothes. A long museum hall lined with lit empty glass cases; he stands inside the furthest one, small and distant, while blurred crowd silhouettes drift past in the foreground. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "collapses",
        "t": 167.04,
        "shotSize": "MED",
        "src": "mall",
        "roll": "B",
        "prompt": "No people. A tall glass wall buckling and sheeting off its frame in slabs, cold light behind, shards hanging in mid-air. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "overreaction",
        "t": 169.82,
        "shotSize": "WIDE",
        "src": "mall",
        "roll": "B",
        "prompt": "A crowd of blurred backlit silhouettes recoiling backwards all at once, arms up, red emergency light washing over them, seen from low and behind. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "glass",
        "t": 177.8,
        "shotSize": "MACRO",
        "src": "mall",
        "roll": "B",
        "prompt": "No faces. One fingertip a hair breadth from touching a pane of fogged glass, condensation beading, razor-shallow focus, everything else black. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "admission",
        "t": 188.08,
        "shotSize": "MED",
        "src": "mall",
        "roll": "B",
        "prompt": "No people. A torn paper ticket stub lying on a wet black floor under a cold overhead light, a turnstile out of focus behind it. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "stares",
        "t": 190.64,
        "shotSize": "CLOSE",
        "src": "port",
        "roll": "A",
        "prompt": "Keep the same man from the source image and do not change his identity: pale skin, messy dark hair, small stick-and-poke face tattoos, silver chains, black clothes. Close on his face pressed near the glass, looking dead into the lens, unblinking, cold case-light raking across him, his breath fogging the pane. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "monster",
        "t": 193.72,
        "shotSize": "WIDE",
        "src": "port",
        "roll": "A",
        "prompt": "Keep the same man from the source image and do not change his identity: pale skin, messy dark hair, small stick-and-poke face tattoos, silver chains, black clothes. He stands small against a huge pale wall while his own shadow is thrown across it enormous and distorted, many times his size, looming over him. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "hands",
        "t": 196.32,
        "shotSize": "MED",
        "src": "mall",
        "roll": "B",
        "prompt": "Dozens of greasy handprints and smears covering a pane of glass in the foreground, sharply lit; far behind them a single dark human figure stands out of focus. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "possess",
        "t": 198.88,
        "shotSize": "WIDE",
        "src": "mall",
        "roll": "A",
        "prompt": "Keep the same man from the source image and do not change his identity: pale skin, messy dark hair, small stick-and-poke face tattoos, silver chains, black clothes. He walks away from camera down the centre of a long dark museum corridor lined with lit empty cases, small in frame, wet floor throwing the case lights back up. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "reaction",
        "t": 201.46,
        "shotSize": "WIDE",
        "src": "mall",
        "roll": "A",
        "prompt": "Keep the same man from the source image and do not change his identity: pale skin, messy dark hair, small stick-and-poke face tattoos, silver chains, black clothes. He steps out through a shattered pane onto broken glass on the floor, hands loose at his sides, cold light behind him, blurred figures scattering at the edges. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
    },
    {
        "word": "answer",
        "t": 204.42,
        "shotSize": "WIDE",
        "src": "mall",
        "roll": "B",
        "prompt": "No people at all. An empty museum exhibit case standing open with the lights still on and broken glass on the floor around it, the hall completely deserted. VITRINE NOIR: a cold institutional glass-case light \u2014 hard cyan-white from above \u2014 against deep black surround and warm skin; thick glass with reflections and dust hanging in the beam, faint red emergency light bleeding in at the edges, 35mm film grain, cinematic photoreal, shallow depth of field. Native vertical 9:16, fills the tall frame. No text, letters, numbers, signage, logos, wordmarks or watermarks anywhere.",
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
        "artist": "Tyler Haze",
        "voice": "VITRINE NOIR",
        "aspect": "9:16",
        "width": W,
        "height": H,
        "model": MODEL,
        "window": [97.60, 157.55],
        "shots": shots,
    }, indent=2, ensure_ascii=False) + "\n")
    return MANIFEST


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="VITRINE NOIR portrait plates")
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
        print(f"DRY RUN — VITRINE NOIR, {len(todo)} scene(s) "
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
    print(f"VITRINE NOIR — {len(todo)} scene(s) via {MODEL} at {W}x{H}")
    with ThreadPoolExecutor(max_workers=a.jobs) as ex:
        for line in ex.map(lambda s: generate(s, api_key, a.force), todo):
            print(line, flush=True)
    print(f"manifest: {man}")
