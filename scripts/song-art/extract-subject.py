#!/usr/bin/env python3
"""EXTRACT SUBJECT — matte a person out of a photo with u2net, no regeneration.

Written for DON'T TAP THE GLASS. The owner rejected a Kontext-generated set of
Tyler because the likeness had drifted: img2img rebuilds the face. The fix is to
never regenerate him at all — cut him out of his OWN photographs and composite
him into a new world, so the pixels of his face are literally his.

Needs onnxruntime (present in ~/whisper-venv) and ~/.u2net/u2net.onnx.

    ~/whisper-venv/bin/python scripts/song-art/extract-subject.py 02 10 12

KNOWN LIMIT: u2net treats large graphic TYPE as foreground. On album art with a
big wordmark (e.g. "THE NIGHT SHIFT") the lettering comes out attached to the
subject. Check every matte before use; prefer sources with no baked-in type.
"""
import sys, numpy as np, onnxruntime as ort
from PIL import Image, ImageFilter
sess = ort.InferenceSession("/home/xsyprime/.u2net/u2net.onnx", providers=["CPUExecutionProvider"])
inp = sess.get_inputs()[0].name
MEAN=np.array([0.485,0.456,0.406],dtype=np.float32); STD=np.array([0.229,0.224,0.225],dtype=np.float32)
def cutout(path, out):
    im = Image.open(path).convert("RGB"); W,H = im.size
    x = np.asarray(im.resize((320,320), Image.BILINEAR), dtype=np.float32)/255.0
    x = ((x-MEAN)/STD).transpose(2,0,1)[None]
    d = sess.run(None, {inp: x})[0][0,0]
    d = (d-d.min())/(d.max()-d.min()+1e-8)
    m = Image.fromarray((d*255).astype(np.uint8)).resize((W,H), Image.BILINEAR)
    m = m.filter(ImageFilter.GaussianBlur(1.6))          # feather the edge
    a = np.asarray(m, dtype=np.float32)
    a = np.clip((a-92)*2.6, 0, 255).astype(np.uint8)      # firm up the matte
    rgba = im.convert("RGBA"); rgba.putalpha(Image.fromarray(a))
    rgba.save(out)
    cov = (a>16).mean()
    print(f"  {path.split('/')[-1]:<10} -> {out.split('/')[-1]:<18} subject covers {cov*100:5.1f}%")
for n in sys.argv[1:]:
    cutout(f"assets/art/tylerhaze/{n}.webp", f"scripts/song-art/tyler-cut/cut-{n}.png")
