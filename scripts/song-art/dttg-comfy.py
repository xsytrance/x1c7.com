#!/usr/bin/env python3
"""DON'T TAP THE GLASS — the remaining frames, generated LOCALLY on ComfyUI.

The aimlapi balance ran out mid-batch (err_insufficent_credits), so the rest is
made on the box for free. Juggernaut-XL v9 RunDiffusionPhoto is the photoreal
checkpoint; SDXL at 832x1472 native portrait.

Tyler frames are NOT generated here — SDXL cannot hold his likeness and that is
the exact failure the owner rejected twice. Those are composited from his real
photographs instead (extract-subject.py).
"""
import json, urllib.request, time, os, sys, uuid

HOST = "http://localhost:8188"
OUT = "scripts/song-art/dttg-cloud"
CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors"
W, H = 832, 1472

NEG = ("cartoon, anime, illustration, painting, drawing, render, 3d, cgi, plastic skin, "
       "airbrushed, doll, deformed hands, extra fingers, text, watermark, logo, signature, "
       "caption, letters, ui, interface labels, man, male, beard")
LOOK = (", photoreal photograph, shot on 35mm film, fine grain, shallow depth of field, "
        "cold blue-white screen light as the only light source against near-black, cinematic, "
        "muted colour, natural skin texture")
HER = ("a Latina woman in her late twenties, athletic build with a curvy figure, long dark hair, "
       "natural makeup, believable and unglamorised")

SHOTS = {
 "tap":       "extreme macro of a woman's thumb hovering a hair above a black smartphone screen, old greasy fingerprint smears catching the light",
 "possess":   f"{HER} sitting on the floor in a dark room clutching a lit phone against her chest, screen glow bleeding around her hands",
 "reaction":  "a smartphone screen in the dark completely buried under a stack of blurred notification banners, far too many to read",
 "live":      "a smartphone lying face-down on rumpled bedsheets in a dark bedroom, faint glow escaping around its edges",
 "whisper":   "a single smartphone screen glowing alone in a completely black empty room, nothing else visible",
 "safe":      f"{HER} alone in a large bed at night turned away from camera, a phone screen glowing on the pillow beside her",
 "palms":     "a woman's open palm pressed flat against a bright smartphone screen in the dark, light spilling between her fingers",
 "contained": "a switched-off smartphone in a hard case on a nightstand in a dark bedroom, screen dead black",
 "ran":       "a smartphone screen in the dark part-way through deleting a contact, the name blurred beyond reading",
 "trap":      "an empty unmade bed at night with two smartphones on opposite nightstands, both screens dark",
 "blamed":    f"close on {HER} face in the dark reading her phone, jaw set, hard screen light across her",
 "collapse":  "a smartphone screen shattering completely, glass fragments lifting off the display, light blowing out through the break",
 "crowd":     "dozens of small glowing phone screens held up in a dark crowd, the faces behind them lost in shadow",
 "riser":     "hard white light blazing through the cracks of a shattered smartphone screen filling the frame",
 "dark":      "a black switched-off smartphone screen filling the frame with one single crack running across it",
}

def graph(prompt, seed):
    return {
      "1": {"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":CKPT}},
      "2": {"class_type":"CLIPTextEncode","inputs":{"text":prompt+LOOK,"clip":["1",1]}},
      "3": {"class_type":"CLIPTextEncode","inputs":{"text":NEG,"clip":["1",1]}},
      "4": {"class_type":"EmptyLatentImage","inputs":{"width":W,"height":H,"batch_size":1}},
      "5": {"class_type":"KSampler","inputs":{"seed":seed,"steps":32,"cfg":5.5,
            "sampler_name":"dpmpp_2m","scheduler":"karras","denoise":1.0,
            "model":["1",0],"positive":["2",0],"negative":["3",0],"latent_image":["4",0]}},
      "6": {"class_type":"VAEDecode","inputs":{"samples":["5",0],"vae":["1",2]}},
      "7": {"class_type":"SaveImage","inputs":{"filename_prefix":"dttg","images":["6",0]}},
    }

def run(name, prompt, seed):
    cid = str(uuid.uuid4())
    body = json.dumps({"prompt": graph(prompt, seed), "client_id": cid}).encode()
    r = json.loads(urllib.request.urlopen(
        urllib.request.Request(f"{HOST}/prompt", data=body,
        headers={"Content-Type":"application/json"}), timeout=60).read())
    pid = r["prompt_id"]
    for _ in range(600):
        time.sleep(1)
        h = json.loads(urllib.request.urlopen(f"{HOST}/history/{pid}", timeout=30).read())
        e = h.get(pid)
        if not e: continue
        if e.get("status", {}).get("status_str") == "error":
            return f"  {name:10s} comfy error"
        imgs = e.get("outputs", {}).get("7", {}).get("images")
        if imgs:
            im = imgs[0]
            u = (f"{HOST}/view?filename={urllib.parse.quote(im['filename'])}"
                 f"&subfolder={urllib.parse.quote(im.get('subfolder',''))}&type={im['type']}")
            data = urllib.request.urlopen(u, timeout=120).read()
            open(f"{OUT}/scene-{name}.png","wb").write(data)
            return f"  {name:10s} OK {len(data)//1024}KB"
    return f"  {name:10s} timeout"

import urllib.parse
only = sys.argv[1] if len(sys.argv) > 1 else None
for i,(name,p) in enumerate(SHOTS.items()):
    if only and only != name: continue
    dst = f"{OUT}/scene-{name}.png"
    if os.path.exists(dst) and os.path.getsize(dst) > 12000:
        print(f"  {name:10s} cached", flush=True); continue
    try: print(run(name, p, 1000+i*7), flush=True)
    except Exception as e: print(f"  {name:10s} ERR {str(e)[:70]}", flush=True)
