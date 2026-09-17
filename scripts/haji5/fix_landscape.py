#!/usr/bin/env python3
# run with ~/whisper-venv/bin/python — Pillow lives there, not in system python3
"""HAJIMEMASHITE v5 — repair the two landscape stragglers.

The v3 art pass regenerated fifteen plates native portrait and MISSED two:
scene-cute and scene-levelready are still 1184x880, left over from v1/v2. They
are only reachable as SECTION art ("playful" and "proud"), which is probably why
nobody caught them — but section art is what paints whenever no keyword wins, so
they were on screen plenty, losing 58% of their width to the object-cover crop
that §17 exists to prevent.

`cute` is also the single most on-brief plate in the whole set — Kizuna, hand to
chin, smiling in Dotonbori — and the Sovereign has now asked for her back
"especially when it says she's so cute" (2026-09-16). So it needs to be right.

These are EXTENDED, not re-shot: the landscape plate goes in as the source and
Kontext fills the empty top and bottom of a 9:16 frame with more of the same
street. That keeps the picture he already approved and fixes only the geometry.

    ~/whisper-venv/bin/python scripts/haji5/fix_landscape.py
"""
import base64, json, subprocess, sys, time, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageFilter

REPO = Path("/home/xsyprime/Hermes/x1c7.com")
KEY_PATH = Path.home() / ".config/ossicle/aimlapi.env"
BASE = "https://api.aimlapi.com/v1"
MODEL = "flux/kontext-pro/image-to-image"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")
SRC = REPO / "scripts/haji5/src"
OUT = REPO / "scripts/haji5/plates"
W, H = 832, 1472

PROMPT = (
    "Extend this photograph vertically into a tall 9:16 portrait frame. Keep the "
    "woman and the existing scene EXACTLY as they are — same person, same face, "
    "same pose, same expression, same clothes, same composition and framing of "
    "her, do not change her identity and do not move her. Only fill in the new "
    "empty space above and below with more of the same Dotonbori street at "
    "night: gold neon signage climbing the walls above, wet reflective pavement "
    "below. Match the existing grain, colour and lighting exactly. "
    "No text, no lettering, no logos, no readable signage."
)
TARGETS = ["cute", "levelready"]


def key() -> str:
    for line in KEY_PATH.read_text().splitlines():
        if line.startswith("AIMLAPI_KEY="):
            return line.split("=", 1)[1].strip().strip("\"'")
    sys.exit(f"no AIMLAPI_KEY in {KEY_PATH}")


def bed(src: Path, dst: Path) -> Path:
    """Landscape plate centred in a 9:16 frame, the empty bands packed with a
    blurred blow-up of itself so Kontext extends into plausible material."""
    im = Image.open(src).convert("RGB")
    scaled = im.resize((W, max(1, round(W * im.height / im.width))), Image.LANCZOS)
    out = im.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(30))
    out.paste(scaled, (0, (H - scaled.height) // 2))
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst)
    return dst


def cover(im: Image.Image) -> Image.Image:
    if im.size == (W, H):
        return im
    s = max(W / im.width, H / im.height)
    im = im.resize((max(W, round(im.width * s)), max(H, round(im.height * s))), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((l, t, l + W, t + H))


def run(name: str, api_key: str) -> str:
    dst = OUT / f"{name}.webp"
    if dst.exists():
        return f"  {name}: cached"
    b = bed(SRC / f"{name}.webp", SRC / f"{name}-bed.png")
    uri = "data:image/png;base64," + base64.b64encode(b.read_bytes()).decode()
    req = urllib.request.Request(
        BASE + "/images/generations",
        data=json.dumps({"model": MODEL, "prompt": PROMPT, "image_url": uri,
                         "num_images": 1, "output_format": "png",
                         "safety_tolerance": "5"}).encode(),
        headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json",
                 "User-Agent": UA, "Accept": "application/json"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=240))
    except urllib.error.HTTPError as e:
        return f"  {name}: HTTP {e.code} {e.read().decode()[:200]}"
    url = (r.get("images") or r.get("data") or [{}])[0].get("url")
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
    if not url:
        return f"  {name}: no url"
    raw = SRC / f"{name}-raw.png"
    subprocess.run(["curl", "-sSL", "-A", UA, "-o", str(raw), url], check=True, timeout=240)
    im = Image.open(raw).convert("RGB")
    got = im.size
    OUT.mkdir(parents=True, exist_ok=True)
    cover(im).save(dst, "WEBP", quality=93, method=6)
    return f"  {name}: {W}x{H} -> {dst.name} (api gave {got[0]}x{got[1]})"


if __name__ == "__main__":
    k = key()
    for n in TARGETS:
        print(run(n, k), flush=True)
