#!/usr/bin/env python3
"""SUMMER DRIP v2 — the VARIETY pass (2026-09-16, second art round).

The Sovereign on the first cut: "I really don't like this picture and you're
reusing it a lot." The picture is scene-smile — a tight four-person group
portrait against a blown-out white sky — and the measurement backed him up: 18
plates carrying 81 word-hits, `smile` landing 6 times and the top plate 10.

So: `smile` is deleted, not re-rolled, and this pass adds FOURTEEN more plates
so the rotation has somewhere to go. Deliberately environmental — decks, water,
objects, distance — because the thing that grated was a close group portrait
repeating, and more close group portraits would grate the same way. Faces appear
here at a distance or in profile, never as a blown-out four-up.

Same voice and same corrected LOOK as art.py: diversity first, deep golden hour.

    python3 scripts/sd2/art2.py [name ...]
"""
import json, urllib.request, urllib.parse, os, sys, time, uuid

HOST = "http://127.0.0.1:8188"
OUT = "scripts/sd2/plates"
CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors"
W, H = 832, 1472
os.makedirs(OUT, exist_ok=True)

NEG = ("text, watermark, logo, signature, readable letters, lettering, "
       "deformed hands, extra fingers, extra limbs, mutated, disfigured, ugly, "
       "blurry, low quality, oversaturated, hdr, plastic skin, cgi, 3d render, "
       "anime, cartoon, illustration, painting, comic, "
       "blown out white background, washed out sky, flat white backdrop, "
       "tight group portrait, four people posing, nudity, swimwear, bikini, "
       "shirtless, bare chest, bare midriff, cleavage, skin close-up, "
       "cropped body parts, night club, neon, winter, rain, grey sky")

LOOK = (", a genuinely multiracial group of friends — Black, Latina, South "
        "Asian and East Asian people together with white friends, several dark "
        "skin tones clearly visible, all in elegant summer resort wear, linen "
        "and sundresses and sunglasses, photoreal editorial photograph, DEEP "
        "golden hour with the sun sitting low and orange right on the ocean "
        "horizon, rich warm saturated colour, strong amber light and deep warm "
        "shadows, shot on 35mm film, fine grain, natural skin texture, shallow "
        "depth of field, Hamptons beach club, weathered wooden deck, white "
        "canvas umbrellas, warm string lights, vertical composition, cinematic")

SHOTS = {
 "pool":     ("a long rectangular pool on a beach club terrace at deep golden "
              "hour, the low sun laying a molten stripe down the water, "
              "loungers and white umbrellas along one edge, a few people at the "
              "far end, wide view"),
 "marina":   ("a row of white sailboats moored at a wooden jetty at deep golden "
              "hour, masts against an orange sky, the water burning with "
              "reflected sun, wide view down the dock"),
 "convertible": ("a classic open-top convertible parked on a sandy lane beside "
                 "beach grass at deep golden hour, warm light raking down the "
                 "bodywork, a straw hat and a linen jacket on the back seat"),
 "champagne": ("a silver ice bucket with champagne bottles on a linen-covered "
               "table at a beach club, condensation on the glass, the low "
               "orange sun flaring behind it, coupes waiting, macro"),
 "dunes":     ("a narrow sandy path through tall beach grass leading toward the "
               "ocean at deep golden hour, the low sun straight down the path "
               "throwing long shadows, nobody in frame"),
 "djbooth":   ("a DJ silhouetted behind a booth on a wooden deck at deep golden "
               "hour, hands on the mixer, the burning orange ocean directly "
               "behind, string lights overhead, people dancing out of focus"),
 "firepit":   ("a round sunken fire pit on a beach club deck at dusk, flames "
               "catching, friends seated around it in linen with drinks, the "
               "last orange light on the horizon behind them, wide view"),
 "curtain":   ("a long white linen curtain lifting in the sea breeze on a beach "
               "club terrace, the deep orange sunset burning through the fabric, "
               "a wooden floor and an empty chair, nobody in frame"),
 "waves":     ("the shallow edge of the ocean at deep golden hour, a thin sheet "
               "of water sliding back over wet sand and mirroring the burning "
               "orange sky perfectly, low camera, no people"),
 "walkaway":  ("three friends of different ethnicities walking away from camera "
               "along the tideline at deep golden hour, seen from behind and "
               "far off, long shadows stretching toward the lens, the low sun "
               "ahead of them"),
 "sunhat":    ("a wide straw sun hat and a pair of sunglasses resting on a "
               "weathered wooden rail at deep golden hour, the burning ocean "
               "thrown far out of focus behind them, macro"),
 "table":     ("a long outdoor dinner table on a deck seen end-on at deep golden "
               "hour, linen, glassware and candles running away from camera, a "
               "mixed group seated down both sides in profile, the orange sea "
               "beyond"),
 "profile":   ("a close profile of a Black woman in sunglasses at a beach club, "
               "lit from the side by the low orange sun, gold hoop earring "
               "catching the light, the deck thrown out of focus behind her"),
 "boards":    ("a weathered wooden boardwalk photographed straight down from "
               "above at deep golden hour, sand and beach grass either side, a "
               "long shadow of an umbrella falling across the planks"),
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
      "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "sd2b", "images": ["6", 0]}},
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
    assert len(prompt + LOOK) < 900, f"{name}: {len(prompt+LOOK)} chars, over the §12a cliff"
    pid = post("/prompt", {"prompt": graph(prompt, seed), "client_id": str(uuid.uuid4())})["prompt_id"]
    for _ in range(150):
        time.sleep(2)
        h = post(f"/history/{pid}")
        if pid in h:
            img = next(iter(h[pid]["outputs"].values()))["images"][0]
            q = urllib.parse.urlencode({"filename": img["filename"],
                                        "subfolder": img.get("subfolder", ""), "type": img["type"]})
            open(dst, "wb").write(urllib.request.urlopen(f"{HOST}/view?{q}", timeout=180).read())
            print(f"  {name}{tag:4s} OK", flush=True); return
    print(f"  {name}{tag:4s} TIMEOUT", flush=True)


if __name__ == "__main__":
    only = sys.argv[1:]
    todo = [k for k in SHOTS if not only or k in only]
    for i, name in enumerate(todo):
        run(name, SHOTS[name], 8800 + i * 37, "-0")
