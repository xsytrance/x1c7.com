#!/usr/bin/env python3
"""FORGED ABOVE GOLD — the two artists, graded into the voice, never generated.

    ~/whisper-venv/bin/python scripts/fag/people.py

WHAT DIDN'T WORK, in order, because the next cut will be tempted by all three:

1. **Generating them.** Never attempted here — SDXL cannot hold a likeness and
   Kontext rebuilds the face. The owner has rejected both before.

2. **Matting them with u2net and compositing rim-lit silhouettes.** This is what
   this file used to do, and it failed twice.
   - u2net treats large graphic TYPE as foreground (extract-subject.py warns
     about this in its own docstring). Every Tyler cover except one carries a
     wordmark, so the matte came back as the LETTERS: the first composite pass
     put a floating orange "ME" from `#MADETOBREAK` into two plates.
   - Cropping the title block off fixed the letters and exposed the real
     problem: on a wet-street cover the matte takes the reflection with him, and
     on a bust the hair matte fringes. He arrived as a dark blob with a jagged
     rim — an artifact, not a person.
   - Kizuna matted cleanly (her sources are full-body with no type over her),
     which is what made the failure look survivable for longer than it was.

3. What actually works: **use their real photographs as frames.** One graded
   portrait each, full-bleed, on their own line. It is unmistakably them, it has
   zero compositing artifacts, and one portrait among twenty forge plates is a
   deliberate beat rather than "a powerpoint of selfies" (playbook §17).

The grade is the same one the plates already have — crushed blacks, desaturated,
warm for the forge / cold for the quench, vignette, grain — so the portraits sit
in the same room as the rest of the film.
"""
import numpy as np
from PIL import Image

W, H = 832, 1472
OUT = "scripts/fag/plates"

FIRE = np.array([1.06, 0.93, 0.80])    # his side — the forge
COLD = np.array([0.86, 0.88, 1.12])    # her side — the quench, the cover's violet

# (out name, source, crop left-fraction, tint)
JOBS = [
    # "I can stand in the quiet" — the one Tyler cover with no wordmark over him
    ("tyler", "assets/art/tylerhaze/02.webp", 0.06, FIRE),
    # "Más fuerte que ayer" — rooftop at night, full body, no type
    ("kizuna", "assets/art/kizunasato/kizuna-black-suit.png", 0.50, COLD),
]


def grade(src, left_frac, tint):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    cw = int(h * W / H)
    if cw <= w:                                     # crop a portrait column
        left = int((w - cw) * left_frac)
        im = im.crop((left, 0, left + cw, h))
    else:                                           # already narrower than 832:1472
        ch = int(w * H / W)
        top = int((h - ch) * 0.06)
        im = im.crop((0, top, w, top + ch))
    im = im.resize((W, H), Image.LANCZOS)

    a = np.asarray(im, dtype=np.float32) / 255.0
    lum = a.mean(2, keepdims=True)
    a = a * 0.72 + lum * 0.28                       # pull saturation toward neutral
    a = np.clip((a - 0.045) / 0.955, 0, 1) ** 1.28  # crush the blacks
    a *= tint
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    a *= np.clip(1.0 - 0.62 * np.clip(r - 0.40, 0, None) ** 1.5, 0, 1)[:, :, None]
    out = np.clip(a * 255, 0, 255) + np.random.normal(0, 4.5, (H, W, 3))
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


if __name__ == "__main__":
    for name, src, lf, tint in JOBS:
        grade(src, lf, tint).save(f"{OUT}/{name}.png")
        print(f"  {name:8s} graded from {src.split('/')[-1]}", flush=True)
