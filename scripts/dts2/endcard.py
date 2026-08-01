"""The end card — "Same sun / New me".

This is the one frame that must carry Rod's actual marks, so it is COMPOSITED
from the real logo file, never generated: §12 says Kontext turns lettering into
gibberish, and a debut post cannot ship a mangled label name.

The layering, bottom to top:
  1. the `future` scene as the bed — deliberately the SAME sunrise the cut
     already showed, because the line is "same sun"
  2. a darkening grade + vignette so gold has something to sit on
  3. the AGENOR crest, SCREEN-blended. The crest is gold on pure black with no
     alpha channel, and screen drops black to nothing — so the emblem lifts off
     its square cleanly without a hand-cut mask
  4. one last breath of blueprint grid, almost gone, closing the voice's arc
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

OUT = Path("/home/xsyprime/Hermes/x1c7.com/scripts/dts2/art-out")
CREST = Path("/home/xsyprime/Hermes/x1c7.com/assets/art/xsytrance/agenor-logo2a.png")
W, H = 752, 1392

bed = Image.open(OUT / "future.png").convert("RGB").resize((W, H), Image.LANCZOS)
bed = bed.filter(ImageFilter.GaussianBlur(3.5))
bed = ImageEnhance.Brightness(bed).enhance(0.52)
bed = ImageEnhance.Color(bed).enhance(1.15)

# vignette: darken toward the edges so the crest reads as the only subject
vig = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(vig)
d.ellipse((-W * 0.42, H * 0.10, W * 1.42, H * 0.92), fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(190))
bed = Image.composite(bed, ImageEnhance.Brightness(bed).enhance(0.34), vig)

# A last whisper of the drafting grid — the voice signing off. Faded radially
# from the edges so it never crosses the crest: a full-bleed regular grid reads
# as a screen artifact rather than a drawing.
grid = Image.new("RGB", (W, H), (0, 0, 0))
g = ImageDraw.Draw(grid)
for x in range(0, W, 64):
    g.line([(x, 0), (x, H)], fill=(0, 17, 20), width=1)
for y in range(0, H, 64):
    g.line([(0, y), (W, y)], fill=(0, 17, 20), width=1)
edge = Image.new("L", (W, H), 255)
ImageDraw.Draw(edge).ellipse((-W * 0.30, H * 0.14, W * 1.30, H * 0.88), fill=0)
grid = ImageChops.multiply(grid, Image.merge("RGB", (edge, edge, edge)))
bed = ImageChops.add(bed, grid.filter(ImageFilter.GaussianBlur(0.4)))

# the crest, screen-blended so its black square vanishes
size = int(W * 0.80)
crest = Image.open(CREST).convert("RGB").resize((size, size), Image.LANCZOS)
layer = Image.new("RGB", (W, H), (0, 0, 0))
layer.paste(crest, ((W - size) // 2, int(H * 0.30)))
glow = layer.filter(ImageFilter.GaussianBlur(26))
card = ImageChops.screen(bed, ImageChops.add(layer, ImageEnhance.Brightness(glow).enhance(0.55)))

card.save(OUT / "me.png")
print(f"end card -> {OUT / 'me.png'}  {card.size[0]}x{card.size[1]}")
