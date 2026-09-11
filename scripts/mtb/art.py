#!/usr/bin/env python3
"""MADETOBREAK — the plates, generated locally on ComfyUI.

Fifteenth voice: KINTSUGI RIOT. Dusk house-party wreckage — broken bottles,
cracked pavement, a torn banner, string lights — but every crack and break
runs with molten gold instead of being hidden, the way kintsugi repairs a
bowl by filling the fracture with lacquer and gold rather than disguising it.
Illustrates the lyric literally: "I don't carry my damage, I make damage
behave" / "damage holds me up... I'm reinforced" / "made to break, not bend."

Distinct from THE ANVIL LIGHT (same artist, Tyler Haze, FAG's voice) which is
warm documentary blacksmith photoreal, low-key, no graphic/illustrative gold
cracks. This voice is urban wreckage at blue-hour dusk, comic-inked linework
over photoreal, cracks as the only warm light source.

Juggernaut-XL v9 photoreal @ 832x1472 NATIVE PORTRAIT (playbook §17 —
landscape plates lose 58% of their width to object-cover in a 1080x1920
frame).

    python3 scripts/mtb/art.py [name ...]
"""
import json, urllib.request, urllib.parse, os, sys, time, uuid

HOST = "http://127.0.0.1:8188"   # standard service, socket-activated (Conjury)
OUT = "scripts/mtb/plates"
CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors"
W, H = 832, 1472
os.makedirs(OUT, exist_ok=True)

NEG = ("fantasy, medieval, sword, crown, phoenix, dragon, magic, sparks "
       "shower, firework, lens flare, god rays, epic, heroic, movie poster, "
       "painting, illustration, concept art, 3d render, cgi, anime, cartoon, "
       "oversaturated, orange and teal grade, hdr, glossy, clean, polished, "
       "pristine, daylight, sunlight, blue sky, text, watermark, logo, "
       "signature, letters, numbers, deformed hands, extra fingers, "
       "cheesy, corny, cheerful, sunny")

LOOK = (", documentary photograph of a real house party's aftermath at blue "
        "dusk, shot on 35mm film, fine grain, deep indigo-black shadows, "
        "muted desaturated colour except for warm molten-gold light bleeding "
        "out of every crack, break and fracture in the scene like kintsugi "
        "lacquer, shallow depth of field, vertical composition, gritty, real")

SHOTS = {
 # proof shot — the title hook, run first alone to confirm style + pipeline
 "break": ("a shattered glass bottle lying on black asphalt at night, one "
           "deep crack running away from it across the pavement, the crack "
           "itself is glowing bright molten gold like liquid fire trapped "
           "just under the surface, the glow is the only light source in "
           "the frame and throws warm gold light across the surrounding "
           "cracked ground, everything past its reach falls into deep black "
           "shadow, unlit string party lights hang out of focus far behind, "
           "wide low-angle view"),
}

SIZES = {"break": "WIDE"}


def graph(prompt, seed):
    return {
      "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
      "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt + LOOK, "clip": ["1", 1]}},
      "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG, "clip": ["1", 1]}},
      "4": {"class_type": "EmptyLatentImage", "inputs": {"width": W, "height": H, "batch_size": 1}},
      "5": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": 32, "cfg": 5.5,
            "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0,
            "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0]}},
      "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
      "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "mtb", "images": ["6", 0]}},
    }


def post(path, payload=None):
    req = urllib.request.Request(HOST + path,
                                 data=json.dumps(payload).encode() if payload else None,
                                 headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=600).read())


def run(name, prompt, seed, tag=""):
    dst = f"{OUT}/{name}{tag}.png"
    if os.path.exists(dst) and os.path.getsize(dst) > 20000:
        print(f"  {name}{tag:4s} cached", flush=True); return
    cid = str(uuid.uuid4())
    pid = post("/prompt", {"prompt": graph(prompt, seed), "client_id": cid})["prompt_id"]
    for _ in range(150):   # 300s cap — bail fast if the VAE-hang bug is back
        time.sleep(2)
        h = post(f"/history/{pid}")
        if pid in h:
            outs = h[pid]["outputs"]
            img = next(iter(outs.values()))["images"][0]
            q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img["type"]})
            data = urllib.request.urlopen(f"{HOST}/view?{q}", timeout=180).read()
            open(dst, "wb").write(data)
            print(f"  {name}{tag:4s} OK  {len(data)//1024}KB", flush=True)
            return
    print(f"  {name}{tag:4s} TIMEOUT after 300s — check for the §19 VAE hang "
          f"(GPU util 0%% + no new journal line = hung, not busy)", flush=True)


if __name__ == "__main__":
    only = sys.argv[1:]
    todo = [k for k in SHOTS if not only or k in only]
    for i, name in enumerate(todo):
        for v, seed in enumerate((1000 + i * 7, 5000 + i * 13)):
            run(name, SHOTS[name], seed, f"-{v}")
