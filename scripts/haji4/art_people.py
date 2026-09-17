#!/usr/bin/env python3
# run with ~/whisper-venv/bin/python — Pillow lives there, not in system python3
"""HAJIMEMASHITE v4 — the PEOPLE plates. Six of them, and only six.

v3 put Kizuna in twelve of seventeen plates and the Sovereign's verdict was the
same as v2's: too much of her. The fix is not "prompt for wider shots" — v3
already did that and it did not work, because every plate went through Flux
Kontext seeded from her photo and Kontext PRESERVES THE SUBJECT by design. Ask
it for an empty street from a picture of a woman and you get a woman on an
empty street.

So the people plates are now a short list with a job each, and everything else
in the cut is a world plate generated locally with no person in the prompt at
all (scripts/haji4/art_world.py). Four Kizuna, two Tyler, sixteen world.

Her four are placed so the face is EARNED: she is a silhouette at her entrance,
a figure at her name, and only at 141.80 — "remember the face" — does the cut
finally give you the face. Tyler owns the two LevelReady calls, as a person
rather than as the record-label card v3 mapped to "the house was already warm".

  * Flux Kontext via aimlapi, model flux/kontext-pro/image-to-image.
  * Key at ~/.config/ossicle/aimlapi.env (AIMLAPI_KEY). The 2026-08 scripts
    still point at ~/.bfl_key, which no longer exists — the secret moved to the
    ~/.config/<system>/env pattern the security law asks for.
  * safety_tolerance "5": at "2" the API silently returned SOLID BLACK plates
    for fully-clothed street scenes (playbook §12). Black plates are caught and
    quarantined below rather than trusted.

    python3 scripts/haji4/art_people.py [--only word] [--force]
"""
import argparse, base64, json, subprocess, sys, time, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageFilter

REPO = Path("/home/xsyprime/Hermes/x1c7.com")
KEY_PATH = Path.home() / ".config/ossicle/aimlapi.env"
BASE = "https://api.aimlapi.com/v1"
MODEL = "flux/kontext-pro/image-to-image"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")
OUT = REPO / "scripts/haji4/people"
BEDS = OUT / "beds"
RAW = OUT / "raw"
W, H = 832, 1472

SRC = {
    # Kizuna, rooftop lounge, tailored black suit. The only source of hers with
    # zero baked-in wordmark, so Kontext has no letters to imitate.
    "kizuna": (REPO / "assets/art/kizunasato/kizuna-black-suit.png", (0, 0, 1029, 1528)),
    # Tyler. 02.webp is the only genuinely text-free source in his set.
    "tyler":  (REPO / "assets/art/tylerhaze/02.webp", (0, 0, 1024, 1024)),
}

GRADE = (" GRADE: Osaka gold-leaf night — photoreal Dotonbori after 2am and "
         "after rain, everything crushed to near-black except molten gold, "
         "every light a warm gold-leaf glow, deep wet reflections, shot on "
         "35mm at night, fine grain, vertical 9:16 composition with depth "
         "stacked from the bottom edge to the top. No text, no lettering, no "
         "logos, no readable signage anywhere in frame.")

KEEP_HER = (" IDENTITY: keep the exact same woman from the source image — same "
            "face, same features, same hair, same build. DO NOT CHANGE HER "
            "IDENTITY. She stays fully clothed in tailored black.")
KEEP_HIM = (" IDENTITY: keep the exact same man from the source image — same "
            "face, same features, same hair, same build. Do not change his "
            "identity. He stays fully clothed.")

SCENES = [
 # ── Kizuna ────────────────────────────────────────────────────────────────
 {"word": "hajimemashite", "src": "kizuna", "shot": "WIDE",
  "prompt": ("Recompose as a WIDE full-length shot from behind and far away: "
             "she stands small and alone at the far end of a rain-slicked "
             "Dotonbori alley at 2am, her back to us, gold neon stacked up "
             "both walls above her and doubled in the wet ground below. She "
             "occupies a small part of the frame; the street is the subject."
             + KEEP_HER + GRADE)},
 {"word": "kizuna", "src": "kizuna", "shot": "MED",
  "prompt": ("Recompose as a MEDIUM full-length shot: she stands three-quarters "
             "turned on a wet neon street at night, hands in the pockets of a "
             "tailored black suit, chin level, the gold signage behind her "
             "thrown far out of focus. Confident, still, unbothered."
             + KEEP_HER + GRADE)},
 {"word": "face", "src": "kizuna", "shot": "CLOSE",
  "prompt": ("Recompose as a CLOSE portrait — the one true face shot of the "
             "whole film. Her face fills the upper middle of the frame, lit "
             "from one side by warm gold neon, half of her in shadow, looking "
             "straight down the lens without smiling. Rain on her skin."
             + KEEP_HER + GRADE)},
 {"word": "name", "src": "kizuna", "shot": "MED",
  "prompt": ("Recompose as a MEDIUM shot: she walks toward the camera out of "
             "deep blackness into one pool of warm gold light on a wet street, "
             "the darkness closing behind her, her figure centred and the top "
             "third of the frame pure black." + KEEP_HER + GRADE)},
 # ── Tyler ─────────────────────────────────────────────────────────────────
 {"word": "levelready", "src": "tyler", "shot": "MED",
  "prompt": ("Recompose as a MEDIUM shot of the man leaning back against a "
             "wet alley wall under a single warm gold light at night, arms "
             "folded, head slightly tilted, gold neon reflections on the "
             "ground in the foreground and darkness above him."
             + KEEP_HIM + GRADE)},
 {"word": "wheelsman", "src": "tyler", "shot": "WIDE",
  "prompt": ("Recompose as a WIDE full-length shot of the man walking away "
             "from the camera down the middle of an empty rain-soaked neon "
             "street at night, seen from behind, small in a tall frame, gold "
             "signage climbing both sides above him." + KEEP_HIM + GRADE)},
]


def key() -> str:
    if not KEY_PATH.exists():
        sys.exit(f"missing API key at {KEY_PATH}")
    for line in KEY_PATH.read_text().splitlines():
        if line.startswith("AIMLAPI_KEY="):
            return line.split("=", 1)[1].strip().strip('"\'')
    sys.exit(f"no AIMLAPI_KEY in {KEY_PATH}")


def bed(src_key: str, dst: Path) -> Path:
    """A native-9:16 bed from the source photo — §12's outpainting trick, turned
    portrait, so Kontext extends into plausible material instead of inventing
    letterbox bars."""
    path, box = SRC[src_key]
    im = Image.open(path).convert("RGB").crop(box)
    scaled = im.resize((W, max(1, round(W * im.height / im.width))), Image.LANCZOS)
    if scaled.height >= H:
        top = (scaled.height - H) // 2
        out = scaled.crop((0, top, W, top + H))
    else:
        out = im.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(28))
        out.paste(scaled, (0, (H - scaled.height) // 2))
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst)
    return dst


def cover(im: Image.Image) -> Image.Image:
    """Force exactly 832x1472 whatever the API returns — §17 is not negotiable."""
    if im.size == (W, H):
        return im
    s = max(W / im.width, H / im.height)
    im = im.resize((max(W, round(im.width * s)), max(H, round(im.height * s))), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((l, t, l + W, t + H))


def is_black(im: Image.Image) -> bool:
    g = im.convert("L").resize((32, 32))
    px = list(g.getdata())
    return sum(px) / len(px) < 6


def generate(scene: dict, api_key: str, force: bool) -> str:
    word = scene["word"]
    dst = OUT / f"{word}.webp"
    if dst.exists() and not force:
        return f"  {word}: cached"
    src = bed(scene["src"], BEDS / f"{word}.png")
    uri = "data:image/png;base64," + base64.b64encode(src.read_bytes()).decode()
    try:
        req = urllib.request.Request(
            BASE + "/images/generations",
            data=json.dumps({"model": MODEL, "prompt": scene["prompt"], "image_url": uri,
                             "num_images": 1, "output_format": "png",
                             "safety_tolerance": "5"}).encode(),
            headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json",
                     "User-Agent": UA, "Accept": "application/json"})
        r = json.load(urllib.request.urlopen(req, timeout=240))
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
                                   headers={"Authorization": "Bearer " + api_key, "User-Agent": UA})
        try:
            s = json.load(urllib.request.urlopen(q, timeout=60))
        except Exception:
            continue
        imgs = s.get("images") or s.get("data") or []
        if imgs:
            url = imgs[0].get("url")
        elif s.get("status") in ("failed", "error"):
            return f"  {word}: FAILED {json.dumps(s)[:160]}"
    if not url:
        return f"  {word}: no url {json.dumps(r)[:160]}"
    RAW.mkdir(parents=True, exist_ok=True)
    raw = RAW / f"{word}.png"
    subprocess.run(["curl", "-sSL", "-A", UA, "-o", str(raw), url], check=True, timeout=240)
    im = Image.open(raw).convert("RGB")
    if is_black(im):
        return f"  {word}: BLACK PLATE returned (safety false-positive) — re-roll"
    got = im.size
    OUT.mkdir(parents=True, exist_ok=True)
    cover(im).save(dst, "WEBP", quality=93, method=6)
    return f"  {word}: {W}x{H} -> {dst.name}" + ("" if got == (W, H) else f" (api gave {got[0]}x{got[1]}, cover-fixed)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    todo = [s for s in SCENES if not a.only or s["word"] == a.only]
    k = key()
    print(f"{len(todo)} Kontext plates")
    for s in todo:
        print(generate(s, k, a.force), flush=True)
