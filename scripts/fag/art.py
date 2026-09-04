#!/usr/bin/env python3
"""FORGED ABOVE GOLD — the plates, generated locally on ComfyUI.

Twelfth voice: THE ANVIL LIGHT. Not a fantasy forge. A real, working, filthy
blacksmith shop shot like documentary photography — the only light in any frame
is hot metal, the coal fire, or the cold violet of the quench. Deep black,
muted, unglamorous.

The owner's brief: "just make the images make sense and not be cheesy." So the
banned list is as important as the prompt — no glowing swords, no spark
showers, no crowns, no phoenixes, no chosen-one lighting. Metal that looks like
work.

Juggernaut-XL v9 photoreal @ 832x1472 NATIVE PORTRAIT (playbook 17 — landscape
plates lose 58% of their width to object-cover in a 1080x1920 frame).

The two artists are NOT generated here; SDXL cannot hold a likeness and the
owner has rejected that twice. They are matted out of their own photographs by
people.py and composited into these plates.

    ~/librosa-venv/bin/python scripts/fag/art.py [name ...]
"""
import json, urllib.request, os, sys, time, uuid

HOST = "http://127.0.0.1:8190"   # private instance: the service instance hangs
# forever in AutoencoderKL with a bfloat16 VAE. Launch with --fp32-vae
# --disable-smart-memory (see scripts/fag/README.md).
OUT = "scripts/fag/plates"
CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors"
W, H = 832, 1472
os.makedirs(OUT, exist_ok=True)

# Everything that would make this cheesy, banned at the sampler.
NEG = ("fantasy, medieval, sword, blade, crown, armour, knight, phoenix, dragon, "
       "magic, glowing runes, sparks shower, firework, explosion, lens flare, "
       "god rays, epic, heroic, cinematic poster, movie poster, illustration, "
       "painting, drawing, concept art, 3d render, cgi, digital art, anime, "
       "cartoon, oversaturated, orange and teal grade, hdr, glossy, clean, "
       "polished, new, pristine, studio lighting, daylight, sunlight, window "
       "light, blue sky, text, watermark, logo, signature, letters, numbers, "
       "deformed hands, extra fingers, face, portrait")

# One grade clause on every plate so 22 frames read as one room.
LOOK = (", documentary photograph of a real working blacksmith shop at night, "
        "shot on 35mm film, fine grain, available light only, the only light "
        "source is hot metal and the coal fire, deep black shadows, muted "
        "desaturated colour, dirty, worn, unglamorous, shallow depth of field, "
        "vertical composition")

# Kizuna's four lines are lit cold; his are lit by the fire. Read off the cover.
VIOLET = (", lit only by a cold violet-blue light source, deep indigo shadows, "
          "no orange, no fire visible")

SHOTS = {
 # --- the chorus: raw iron, the fire, the first work -------------------------
 "flame":      "the open mouth of a coal forge in a black workshop, coke burning orange-white deep inside the fire pot, ash and clinker around the edge, wide view of the hearth",
 "untouched":  "extreme macro of the surface of a rough steel billet, black mill scale, pitting, old hammer marks, cold and dull, no glow",
 "unchanged":  "a cold black steel billet gripped in a pair of worn blacksmith tongs, half of it lost in shadow, dim ember light from off frame",
 # --- the trade: two people, two lights --------------------------------------
 "fuerte":     "an empty blacksmith's anvil on its stump seen from the far side of a dark shop" + VIOLET,
 "burn":       "a long thick steel bar glowing bright orange and yellow-white with heat, lying across the scarred face of an anvil in a pitch dark workshop, visible heat shimmer above it, the glowing metal is the only light source in the frame and throws its light across the anvil",
 "somebodys":  "very wide view of a dark blacksmith workshop, a low orange forge fire at the far end, the anvil small in the middle of the empty floor",
 "stand":      "a wide empty blacksmith workshop at night, the forge fire banked down to a dim red bed, tools hanging still, nobody there",
 "quiet":      "a rack of worn blacksmith tools hanging on a dark wall, tongs and hammers, one faint red ember glow from the left",
 "puedo":      "close on a pair of hands in scarred leather gloves closing a pair of tongs" + VIOLET,
 # --- carrying the light -----------------------------------------------------
 "carry":      "wide dark workshop, a single small piece of steel glowing orange being carried across the floor, its light thrown on the ground and walls, the carrier out of focus",
 "light":      "a single bar of steel at orange heat lying alone on a stone floor in a completely black room, it is the only light source, its glow falling off fast",
 "salvar":     "a piece of hot steel resting alone on an anvil face, no hands, no tools, the shop black around it",
 # --- letting the fire go ----------------------------------------------------
 "fire":       "very wide view of the whole interior of a dark blacksmith workshop with the forge fire burnt right down, only a faint dull red glow left in the hearth at the far end, the rest of the long room in deep shadow, tools and benches receding into the dark",
 "nothing":    "wide empty concrete workshop floor covered in black scale flakes and ash, a dim red glow spilling in from the left, nothing else",
 "prove":      "macro of a finished steel bar cooling, the outside gone dark grey-blue, a faint orange core glow still showing at one end",
 "made":       "the scarred worn face of an old anvil filling the frame, decades of hammer marks and chips, dim warm light raking across it",
 "forever":    "wide view of a dark blacksmith shop, the forge burnt low, long shadows, the whole room visible and still",
 "were":       "wide view of an anvil in a dark shop with a hammer caught mid-swing above it in motion blur, the steel on the anvil glowing dull orange",
 # --- the quench -------------------------------------------------------------
 "quench":     "a bar of orange-hot steel plunging into a black quench tank, violent steam erupting off the water surface, close, harsh",
 "worth":      "wide view of the surface of a black quench tank as the last steam clears off the still water, faint reflected red light",
}

SIZES = {  # for the shot-size histogram + the camera-move choice at wire time
 "flame":"WIDE","untouched":"MACRO","unchanged":"MED","fuerte":"MED",
 "burn":"CLOSE","somebodys":"WIDE","stand":"WIDE","quiet":"MED","puedo":"CLOSE",
 "carry":"WIDE","light":"MED","salvar":"MED","fire":"MED","nothing":"WIDE",
 "prove":"MACRO","made":"MED","forever":"WIDE","were":"WIDE","quench":"CLOSE","worth":"WIDE",
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
      "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "fag", "images": ["6", 0]}},
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
    for _ in range(300):
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
    import urllib.parse
    only = sys.argv[1:]
    todo = [k for k in SHOTS if not only or k in only]
    # Three candidates per shot; SDXL sneaks people and fantasy props into empty
    # rooms (playbook 18) so every plate gets picked by eye from a contact sheet.
    for i, name in enumerate(todo):
        for v, seed in enumerate((1000 + i * 7, 5000 + i * 13)):
            run(name, SHOTS[name], seed, f"-{v}")
