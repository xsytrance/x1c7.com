#!/usr/bin/env python3
"""INTERNATIONAL MODE — THE GOLDEN ATLAS, expansion set (2026-09-15).

The cut shipped with 14 country plates behind a hook word that fires 15 times,
and the Sovereign's note was that it "repeats a lot". This adds ten more
countries so the rotation has somewhere new to go, and replaces the one plate
he named: the old `road` was two anonymous women walking away down a desert
highway — "just 2 random girls on a road". His brief: "pick a famous road and
put a flag on it."

Voice, unchanged from the plates already on R2 (match these or the set stops
reading as one planet): golden-hour photoreal travel documentary, a REAL named
landmark, a real crowd celebrating in front of it, 35mm film, warm light.
Monuments identify the country; flags are incidental EXCEPT on the road plate,
where the flag is the whole point.

Juggernaut-XL v9 photoreal @ 832x1472 NATIVE PORTRAIT (playbook §17).

    python3 scripts/intlmode/art_atlas.py [name ...]
"""
import json, urllib.request, urllib.parse, os, sys, time, uuid

HOST = "http://127.0.0.1:8188"
OUT = "scripts/intlmode/atlas-plates"
CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors"
W, H = 832, 1472
os.makedirs(OUT, exist_ok=True)

NEG = ("text, watermark, logo, signature, readable letters, lettering, words, "
       "captions, street signs with legible text, deformed hands, extra fingers, "
       "extra limbs, mutated, disfigured, ugly, blurry, low quality, "
       "oversaturated, hdr, glossy, cgi, 3d render, anime, cartoon, illustration, "
       "painting, war, military, weapons, protest, riot, police, conflict, "
       "surveillance, checkpoint, barbed wire, border wall, sad, angry, "
       "nudity, swimwear, lingerie, bare midriff, bare legs close-up, "
       "cropped body parts, close-up of skin")

LOOK = (", golden-hour travel documentary photograph, shot on 35mm film, fine "
        "grain, warm low sun, rich natural colour, a real joyful crowd of many "
        "ethnicities celebrating in front of it, vertical composition, wide "
        "establishing view, people fully clothed in everyday travel clothes, "
        "candid, authentic, celebration and unity")

SHOTS = {
 # ── THE ROAD, re-shot: a FAMOUS road, and a flag on it ────────────────────
 # Route 66 is the most instantly readable "famous road" on earth. The flag is
 # simple geometry (stripes + a blue canton), which SDXL renders far better
 # than any crest or lettering — see NEG's ban on legible sigils.
 "route66": ("the famous Route 66 desert highway in Arizona stretching straight "
             "to the horizon between red rock mesas at golden hour, a very "
             "large American flag flying from a tall pole at the roadside in "
             "the foreground, the flag catching the low sun and rippling in "
             "the wind, empty open blacktop with faded white centre line, "
             "distant mountains, wide low view down the road"),
 "amalfi":  ("the famous Amalfi Coast cliffside road in Italy curving above a "
             "turquoise sea at golden hour, a large Italian green-white-red "
             "flag flying from a pole on the cliff edge in the foreground, "
             "pastel cliffside village below, wide sweeping view along the road"),
 # ── TEN MORE COUNTRIES ────────────────────────────────────────────────────
 "ph": ("Manila in the Philippines at golden hour, the historic Spanish stone "
        "gate and walls of Intramuros with a huge joyful Filipino street crowd "
        "celebrating in front of it, jeepneys and warm string lights, wide view"),
 "ng": ("Lagos Nigeria at golden hour, the great white cable-stayed Lekki-Ikoyi "
        "bridge sweeping across the lagoon with the city skyline behind it, a "
        "large joyful Nigerian street crowd dancing in colourful patterned "
        "fabric in the foreground, wide view"),
 "th": ("the Wat Arun temple of dawn in Bangkok Thailand at golden hour, its "
        "tall porcelain-encrusted spire glowing above the Chao Phraya river, "
        "longtail boats on the water, a joyful Thai crowd celebrating on the "
        "riverside terrace in front of it, wide view"),
 "tr": ("the Hagia Sophia in Istanbul Turkey at golden hour, its great dome and "
        "minarets against a warm orange sky, a huge joyful crowd filling the "
        "square in front of it, flocks of birds, wide establishing view"),
 "ma": ("the Jemaa el-Fnaa square in Marrakech Morocco at golden hour, the "
        "Koutoubia minaret rising behind the square, market lantern stalls and "
        "smoke from food carts catching the low sun, a huge joyful crowd "
        "filling the square, wide view"),
 "de": ("the Brandenburg Gate in Berlin Germany at golden hour, its great "
        "columns and bronze quadriga lit by the low sun, a huge joyful crowd "
        "celebrating across the plaza in front of it, wide establishing view"),
 "es": ("the Sagrada Familia basilica in Barcelona Spain at golden hour, its "
        "extraordinary honey-coloured spires against a warm sky, a joyful "
        "crowd celebrating in the park in front of it, wide view looking up"),
 "gb": ("Tower Bridge in London at golden hour, its blue-and-white towers and "
        "walkways over the Thames catching the low sun, a joyful crowd on the "
        "riverside walk in the foreground, wide establishing view"),
 "kr": ("the Gyeongbokgung palace in Seoul South Korea at golden hour, its "
        "sweeping tiled roofs and painted eaves with the mountain behind, a "
        "joyful crowd in colourful hanbok celebrating in the great courtyard, "
        "wide establishing view"),
 "sg": ("the Marina Bay waterfront in Singapore at golden hour, the three "
        "towers and the boat-shaped skypark above the bay with the city "
        "skyline glowing, a joyful crowd celebrating on the promenade in the "
        "foreground, wide establishing view"),
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
      "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "atlas", "images": ["6", 0]}},
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
    # §12a: prose over ~900 chars silently returns a black plate at the wrong
    # size, with no error. Check before spending a batch on it.
    full = prompt + LOOK
    assert len(full) < 900, f"{name}: prompt {len(full)} chars, over the §12a cliff"
    cid = str(uuid.uuid4())
    pid = post("/prompt", {"prompt": graph(prompt, seed), "client_id": cid})["prompt_id"]
    for _ in range(150):
        time.sleep(2)
        h = post(f"/history/{pid}")
        if pid in h:
            outs = h[pid]["outputs"]
            img = next(iter(outs.values()))["images"][0]
            q = urllib.parse.urlencode({"filename": img["filename"],
                                        "subfolder": img.get("subfolder", ""), "type": img["type"]})
            data = urllib.request.urlopen(f"{HOST}/view?{q}", timeout=180).read()
            open(dst, "wb").write(data)
            print(f"  {name}{tag:4s} OK  {len(data)//1024}KB", flush=True)
            return
    print(f"  {name}{tag:4s} TIMEOUT", flush=True)


if __name__ == "__main__":
    only = sys.argv[1:]
    todo = [k for k in SHOTS if not only or k in only]
    for i, name in enumerate(todo):
        for v, seed in enumerate((2200 + i * 17, 7700 + i * 29)):
            run(name, SHOTS[name], seed, f"-{v}")
