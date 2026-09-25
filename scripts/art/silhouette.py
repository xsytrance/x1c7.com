#!/usr/bin/env python3
"""
SILHOUETTE — a real subject cut-out for each plate, for parallax.

The sharpness-and-centre proxy in abstract.mjs could not isolate a subject: it
returns a soft blob roughly where the subject is, and parallax needs an actual
edge. Measured, every version of it made the frame SOFTER than no layers at all
(edge energy 4.81 flat against 1.37–1.59 layered) because a near-global mask
puts an offset copy of a sharp image over the same sharp image, and that ghosts.

ComfyUI has no depth preprocessor installed here, but depth was never quite the
right tool either — for a portrait plate what parallax wants is the SILHOUETTE,
and background removal gives exactly that. rembg lives in its own venv on
purpose: the playbook (§3b) records that onnxruntime and onnxruntime-gpu
installed together break each other, and the ASR setup depends on the gpu one.

  ~/rembg-venv/bin/python scripts/art/silhouette.py <plate.webp> [more...] --out <dir>

Writes <name>.mask.png (white subject on black) beside the sources.
"""
import argparse, io, os, sys
from PIL import Image, ImageFilter
import numpy as np
from rembg import remove, new_session


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("plates", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="u2net")
    ap.add_argument("--feather", type=int, default=6)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    sess = new_session(a.model)

    for p in a.plates:
        name = os.path.splitext(os.path.basename(p))[0]
        src = Image.open(p).convert("RGB")
        cut = remove(src, session=sess, only_mask=True)       # 8-bit subject mask
        m = Image.fromarray(np.array(cut)).convert("L")
        cov = float(np.array(m).mean()) / 255.0
        # A mask covering almost everything or almost nothing is not a subject —
        # it is the model failing on an abstract plate, and using it would just
        # reintroduce the ghosting. Say so instead of writing it.
        if cov < 0.04 or cov > 0.86:
            print(f"  – {name}: coverage {cov:.0%} — no usable subject, skipped")
            continue
        m = m.filter(ImageFilter.GaussianBlur(a.feather))
        m.save(os.path.join(a.out, f"{name}.mask.png"))
        print(f"  ✓ {name}.mask.png   subject covers {cov:.0%}")


if __name__ == "__main__":
    main()
