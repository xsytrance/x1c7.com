#!/usr/bin/env python3
"""SUMMER DRIP v2 — THE HAMPTONS SESSIONS. Eighteenth voice.

The 2026-07 cut was purple-gold comic noir — illustrated, stylised, and now
superseded: the Sovereign has replaced the album art with a photoreal
golden-hour beach club and asked for "a more realistic look... a place like the
Hamptons with a diverse crowd of many races" (2026-09-16).

So this set is shot to match that cover exactly: late golden hour on a weathered
wooden deck above the sand, white canvas umbrellas, warm string lights, the sun
sitting on the water with a sailboat in it, and a genuinely mixed crowd —
Black, white, Latina, East and South Asian — in elegant resort wear with drinks
in hand. Summer wealth, not a beach party.

Standing art law (2026-09-15): no bare-skin imagery. The register here is
FASHION EDITORIAL, like the cover — linen shirts, sundresses, sunglasses,
jewellery. Nobody is cropped to a body part.

Juggernaut-XL v9 photoreal @ 832x1472 NATIVE PORTRAIT (playbook §17).

    python3 scripts/sd2/art.py [name ...]
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
       "anime, cartoon, illustration, painting, comic, drawing, "
       "nudity, swimwear, bikini, lingerie, shirtless, bare chest, bare "
       "midriff, cleavage, skin close-up, cropped body parts, suggestive pose, "
       "night club, neon, winter, rain, overcast, grey sky")

# Two corrections after the first pass (2026-09-16), both against the brief:
#
#  1. DIVERSITY HAS TO LEAD. Buried at the end of a long prompt it was ignored —
#     SDXL's prior for "Hamptons beach club" is affluent and white, and the first
#     36 plates came back almost entirely light-skinned. The instruction is now
#     the FIRST clause of every prompt and it names the people concretely.
#  2. THE GRADE WAS TOO PALE. The first pass read as bright midday; the
#     Sovereign's cover art is a deep amber sunset with the sun ON the water and
#     real contrast. "Late golden hour" alone gets high-key resort photography,
#     so the sun position and the warmth are now stated outright.
LOOK = (", a genuinely multiracial group of friends — Black, Latina, South "
        "Asian and East Asian people together with white friends, several dark "
        "skin tones clearly visible in the foreground, all in elegant summer "
        "resort wear, linen and sundresses and sunglasses, relaxed and happy, "
        "photoreal editorial photograph, DEEP golden hour with the sun sitting "
        "low and orange right on the ocean horizon, rich warm saturated colour, "
        "strong amber light and deep warm shadows, sun flare across the lens, "
        "shot on 35mm film, fine grain, natural skin texture, shallow depth of "
        "field, Hamptons beach club, weathered wooden deck, white canvas "
        "umbrellas, warm string lights, vertical composition, cinematic")

SHOTS = {
 # ── the intro: HEAT TURNED UP ────────────────────────────────────────────
 "heat":   ("the sun sitting low and enormous directly on the ocean horizon seen "
            "from a beach club deck, the air above the boards visibly rippling "
            "with heat haze, everything flaring gold, wide view"),
 "deck":   ("a wide establishing view along a weathered wooden beach club deck at "
            "golden hour, white canvas umbrellas down one side, a bar under a "
            "timber canopy, the ocean and a low sun beyond, people gathered"),
 # ── the hook ─────────────────────────────────────────────────────────────
 "sundress": ("a woman in a long cream sundress walking away from camera down a "
              "boardwalk toward the sunset ocean, seen from behind, the low sun "
              "ahead of her, umbrellas and friends either side"),
 "daylight": ("the sun blazing just above a calm ocean at golden hour with a "
              "single white sailboat silhouetted on the water, seen past the "
              "corner of a wooden deck rail, lens flare across the frame"),
 "midnight": ("the same beach club deck after dark, strings of warm bulbs "
              "crossing overhead, candles on the tables, a group talking and "
              "laughing, deep blue ocean behind them, wide view"),
 "flame":  ("the last minute of sunset over the sea, the whole sky burning "
            "orange and pink, the water throwing a long molten path toward the "
            "camera, dark silhouettes of people at the deck rail watching"),
 "steps":  ("a set of weathered wooden steps leading down from a beach club deck "
            "onto pale sand, warm low sun raking across the boards, sandals left "
            "at the bottom, tall dune grass either side"),
 "smile":  ("a table of friends of several different ethnicities laughing "
            "together at a beach club at golden hour, wine and cocktail glasses, "
            "sunglasses pushed up, warm light on their faces, candid"),
 "streetlamp": ("a warm globe lamp glowing on a wooden post beside a boardwalk at "
                "dusk, the sky still faintly orange behind it, blurred figures "
                "walking past, shallow focus"),
 "perfume": ("an elegant glass perfume bottle standing on a linen tablecloth at a "
             "beach club table in golden light, a gold bracelet and sunglasses "
             "beside it, ocean bokeh behind, macro"),
 "eyes":   ("a close view of a pair of dark sunglasses on a table, the whole "
            "golden sunset and the deck reflected in both lenses, warm bokeh"),
 # ── verse one ────────────────────────────────────────────────────────────
 "spot":   ("the entrance to an upscale beach club at golden hour, a weathered "
            "timber gateway with greenery either side, warm light spilling "
            "through, people arriving"),
 "queen":  ("a woman seated at the head of a long outdoor table at a beach club, "
            "a mixed group of friends either side of her turning toward her, "
            "golden hour light, wine glasses, relaxed and regal, wide view"),
 "dancefloor": ("people dancing barefoot on a wooden beach club deck at dusk, a "
                "DJ silhouetted behind a booth, string lights overhead, warm "
                "motion blur, the ocean darkening behind them"),
 "lens":   ("several phones held up in the air filming at a beach club at golden "
            "hour, the screens glowing warm, blurred crowd behind, low angle "
            "toward the sky"),
 "crowd":  ("a packed beach club terrace at golden hour seen from above, a "
            "diverse crowd in summer whites and creams holding drinks, umbrellas "
            "and palms, the ocean beyond"),
 "gold":   ("a fine gold chain resting on a cream linen shirt collar, warm low "
            "sun catching the links, ocean bokeh behind, shallow macro"),
 "drip":   ("a tall cocktail glass on a wooden deck rail with condensation "
            "running down it in fat beads, the golden sunset ocean thrown out of "
            "focus behind, macro, the drops catching the light"),
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
      "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "sd2", "images": ["6", 0]}},
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
        for v, seed in enumerate((7300 + i * 31, 2600 + i * 43)):
            run(name, SHOTS[name], seed, f"-{v}")
