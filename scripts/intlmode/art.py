#!/usr/bin/env python3
"""International Mode — the plates, generated locally on ComfyUI.

Sixteenth voice: ONE WORLD GATE. Revised mid-direction from an earlier
customs/noir concept — the owner's brief: "use lots of flags and lots of
imagery from different countries. i want this song to unite people." So the
visual register is a global-unity festival/opening-ceremony, not a surveillance
hall: warm dusk-to-gold light, dozens of real national flags raised together,
diverse crowds, world landmarks (the song names NYC, Manila, Tokyo, Lagos,
Brooklyn) joined by strings of flags/lanterns rather than a border or a wall.

The percussive device carries over from the customs concept because it still
fits the chant rhythm: every "International" hit gets a passport-stamp shape,
but the ink is a nation's flag colours/pattern instead of black-and-red — a
literal stamp of belonging, not a checkpoint.

Juggernaut-XL v9 photoreal @ 832x1472 NATIVE PORTRAIT (playbook §17).

    python3 scripts/intlmode/art.py [name ...]
"""
import json, urllib.request, urllib.parse, os, sys, time, uuid

HOST = "http://127.0.0.1:8188"
OUT = "scripts/intlmode/plates"
CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors"
W, H = 832, 1472
os.makedirs(OUT, exist_ok=True)

NEG = ("fantasy, medieval, sword, crown, war, military, weapons, protest, "
       "riot, conflict, dark, ominous, surveillance, checkpoint, barbed wire, "
       "border wall, uniform police, sad, angry, oversaturated, hdr, glossy, "
       "cgi, 3d render, anime, cartoon, text, watermark, logo, signature, "
       "readable letters, deformed hands, extra fingers, extra limbs, "
       "single flag close-up with visible text or seal (avoid legible sigils)")

LOOK = (", warm golden-hour to blue dusk light, documentary photograph, shot "
        "on 35mm film, fine grain, joyful festival energy, dozens of real "
        "national flags of different countries visible and raised together, "
        "a diverse crowd of many ethnicities, warm string lights, vertical "
        "composition, unity and celebration, not conflict")

SHOTS = {
 # proof shot — the core "unite people" concept: flags raised together
 "flags": ("a huge joyful crowd at dusk raising dozens of different national "
           "flags together over their heads — American, Japanese, Nigerian, "
           "Filipino, Brazilian, and many more flags mixed together and "
           "waving side by side, seen from a low angle looking up so the "
           "flags fill the sky against a warm orange-blue dusk, warm string "
           "lights strung overhead, wide view"),
 # --- Part A / the chant hit: stamped in flag colours, not black ink --------
 "stamp":   ("extreme macro close-up of a rubber stamp hitting blank white "
             "paper, the moment of impact throwing a splash of colourful ink "
             "droplets in mixed red, green, blue and gold, the stamp face "
             "itself a plain solid shape with no letters or symbols on it, "
             "warm desk lamp light, shallow depth of field, high speed "
             "photography, motion-frozen ink splash, completely blank paper, "
             "no text anywhere in frame"),
 # --- Part B / Build: the riser chant ---------------------------------------
 "move":    ("a wide silhouette of a huge crowd at dusk with hands raised, "
             "moving together as one, warm golden rim light behind them, "
             "small flags waving in raised hands throughout the crowd, low "
             "angle, wide view"),
 # --- Part B / Final Drop: the literal lines --------------------------------
 "world":   ("a wide low-angle view of a joyful crowd holding dozens of "
             "different national flags at dusk, festival string lights "
             "overhead, warm orange-blue sky, seen from among the crowd"),
 "road":    ("an airport runway at golden hour, small flags of different "
             "nations lining the tarmac edge, a jet silhouette taxiing in "
             "the distance, warm low sun, wide view"),
 "bass":    ("a huge concert crowd from a low angle at night, hands up, "
             "several different national flags waving above the crowd, "
             "warm stage light glowing from the front, wide view"),
 "airplane":("a jet airliner silhouette flying low over a dense city skyline "
             "at golden hour, contrail catching warm light, small distant "
             "flags visible on rooftops below, wide view"),
 "whiplash":("a long exposure night photograph of a city street from a "
             "moving car, light trails streaking past, glowing shopfronts "
             "with small flags hanging above them blurred by motion, wide "
             "view"),
 "bk":      ("the Brooklyn Bridge and lower Manhattan skyline at dusk, an "
             "American flag among a few other small national flags visible "
             "on a rooftop in the foreground, warm city lights coming on, "
             "wide view"),
 "stars":   ("a night street festival packed with people under strings of "
             "warm lights that look like stars, dozens of small flags of "
             "different nations strung overhead between buildings, wide "
             "view looking up"),
 "street":  ("a bustling night street market blending many cultures — "
             "lanterns, food stalls, and flags of different nations hanging "
             "side by side above the crowd, warm mixed light, wide view"),
 "charts":  ("a glowing world map at night seen from above a city rooftop "
             "party, warm light trails connecting distant city lights across "
             "the dark ocean, small flags planted at a few glowing cities, "
             "wide view"),
 # --- extra pool variants for "international" (fires 30+ times) ------------
 "globe":   ("a spinning illuminated glass globe held up by a crowd's hands "
             "at a night festival, warm string lights behind it, small "
             "national flag pins glowing on its surface, wide low angle"),
 "stadium": ("a packed stadium crowd at night waving dozens of different "
             "national flags together, floodlights and confetti in the air, "
             "wide aerial view from high in the stands"),
 "hands":   ("close-up of many different hands of different skin tones "
             "stacked together in a circle at golden hour, each wrist tied "
             "with a different national flag ribbon, warm light, shallow "
             "depth of field"),
 "fireworks": ("fireworks bursting in many colours over a night skyline, "
               "small national flags silhouetted on rooftops in the "
               "foreground, warm smoke, wide view"),
 "kids":    ("a line of children of different ethnicities each holding a "
             "different small national flag, running together across a "
             "sunlit field, warm backlight, wide view"),
 "summit":  ("a small group on a mountain summit at golden hour planting "
             "a cluster of different national flags together into the "
             "snow, wide view, warm alpenglow light"),
}

SIZES = {
 "flags": "WIDE", "stamp": "MACRO", "move": "WIDE", "world": "WIDE",
 "road": "WIDE", "bass": "WIDE", "airplane": "WIDE", "whiplash": "WIDE",
 "bk": "WIDE", "stars": "WIDE", "street": "WIDE", "charts": "WIDE",
}


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
      "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "intlmode", "images": ["6", 0]}},
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
    for _ in range(150):
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
    print(f"  {name}{tag:4s} TIMEOUT", flush=True)


if __name__ == "__main__":
    only = sys.argv[1:]
    todo = [k for k in SHOTS if not only or k in only]
    for i, name in enumerate(todo):
        for v, seed in enumerate((1000 + i * 7, 5000 + i * 13)):
            run(name, SHOTS[name], seed, f"-{v}")
