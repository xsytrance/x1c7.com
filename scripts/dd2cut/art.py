#!/usr/bin/env python3
"""DRINK DRINK v2 — THE LAST POUR. Seventeenth voice.

Near-black room, one warm amber light source, and the liquid is the only bright
thing in the frame. Every pour is backlit so the whiskey glows like the bottle
in the lyric ("bottle glowing by my bed"). Deep shadow everywhere else — this is
an insomnia song, not a party.

Owner brief 2026-09-16: "lots of pictures of alcohol being poured", plus one
specific plate — "for 'pain keeps going through my head', a male figure sitting
in a dark room with a drink and his head down holding his head."

Standing art law, 2026-09-15: no bare-skin imagery. The man is fully dressed and
mostly silhouette; that is also the better picture.

Juggernaut-XL v9 photoreal @ 832x1472 NATIVE PORTRAIT (playbook §17).

    python3 scripts/dd2cut/art.py [name ...]
"""
import json, urllib.request, urllib.parse, os, sys, time, uuid

HOST = "http://127.0.0.1:8188"
OUT = "scripts/dd2cut/plates"
CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors"
W, H = 832, 1472
os.makedirs(OUT, exist_ok=True)

NEG = ("text, watermark, logo, signature, readable letters, lettering, label "
       "text, brand name, deformed hands, extra fingers, mutated, disfigured, "
       "ugly, blurry, low quality, oversaturated, hdr, cgi, 3d render, anime, "
       "cartoon, illustration, painting, daylight, bright, flat lighting, "
       "cheerful, party crowd, nudity, swimwear, shirtless, bare chest, bare "
       "legs, skin close-up, cropped body parts")

GRADE = (", THE LAST POUR: near-black room lit by one warm amber source, the "
         "liquid the brightest thing in frame and backlit so it glows, deep "
         "crushed shadows everywhere else, wet glass, condensation, shot on "
         "35mm at night, fine grain, shallow depth of field, vertical "
         "composition, cinematic, moody, insomnia, no text anywhere")

SHOTS = {
 # ── the pours — the Sovereign asked for lots, so this is most of the set ──
 "pour1": ("amber whiskey pouring from a tilted bottle into a heavy cut-crystal "
           "glass on a dark bar top, the falling stream backlit and glowing gold, "
           "splash droplets frozen in the air, pitch black background"),
 "pour2": ("extreme macro of whiskey hitting the bottom of an empty glass, the "
           "amber liquid bursting upward in a crown of droplets, one hard warm "
           "backlight behind the glass, everything else black"),
 "pour3": ("a thin ribbon of amber spirit falling in slow motion into a glass "
           "already half full, surface rippling, the liquid glowing from a warm "
           "light behind it, deep black surround"),
 "pour4": ("whiskey pouring over a single large clear ice cube in a tumbler, the "
           "ice refracting warm amber light, condensation on the glass, dark "
           "wooden bar, black background"),
 "pour5": ("a glass overfilling with amber spirit, the liquid spilling over the "
           "rim and running down the outside onto a black lacquered surface, "
           "backlit so the overflow glows, everything else in shadow"),
 "pour6": ("a bottle upended high above a glass, a long unbroken amber stream "
           "connecting them through the middle of a tall dark frame, one warm "
           "rim light, pure black top and bottom"),
 "pour7": ("silhouette of a hand tilting a bottle, only the pouring liquid lit, "
           "a glowing amber arc falling through blackness into a waiting glass "
           "at the bottom of the frame"),
 "pour8": ("a row of shot glasses being filled, amber liquid at different levels "
           "catching a single warm light from behind, dark bar, black shadows, "
           "shallow focus down the row"),
 # ── the room ──────────────────────────────────────────────────────────────
 "manhead": ("a fully clothed man in a dark jacket sitting hunched on the edge of "
             "a bed in a pitch black room, head down, both hands gripping his "
             "head, a half-empty glass of amber spirit on the floor beside his "
             "shoe, one dim warm lamp behind him throwing a long shadow, his "
             "face hidden, wide view with black space above him"),
 "bottlebed": ("a single bottle of amber spirit standing on a bedside table in a "
               "dark bedroom at night, lit from within so it glows like a lamp, "
               "an unmade bed dissolving into blackness behind it"),
 "barneon": ("an empty dark bar at 3am, rows of bottles backlit in warm amber "
             "along the back wall, one stool, wet counter reflecting the glow, "
             "nobody there"),
 "window": ("a rain-streaked window at night seen from inside a dark room, city "
            "lights bleeding through the water on the glass into soft amber "
            "bokeh, the room itself in total blackness"),
 "smoke": ("a slow curl of cigarette smoke rising through a single warm amber "
           "beam of light in a pitch black room, the smoke the only thing "
           "visible, everything else void"),
 "fan": ("a ceiling fan turning slowly in a dark room seen from directly below, "
         "one dim warm bulb behind it, long shadows sweeping the ceiling, "
         "everything else black"),
 "emptyglass": ("a single empty whiskey glass with one last amber drop in the "
                "bottom, standing on a black surface under one warm light, "
                "long reflection, total darkness around it"),
 "spill": ("a knocked-over glass on a dark floor with amber spirit spreading in "
           "a pool, the spill catching one warm light and glowing, deep shadow, "
           "low angle"),
}


def graph(prompt, seed):
    return {
      "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
      "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt + GRADE, "clip": ["1", 1]}},
      "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG, "clip": ["1", 1]}},
      "4": {"class_type": "EmptyLatentImage", "inputs": {"width": W, "height": H, "batch_size": 1}},
      "5": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": 32, "cfg": 5.5,
            "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0,
            "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0]}},
      "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
      "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "dd2", "images": ["6", 0]}},
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
    full = prompt + GRADE
    assert len(full) < 900, f"{name}: {len(full)} chars, over the §12a cliff"
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
        for v, seed in enumerate((4400 + i * 23, 9900 + i * 37)):
            run(name, SHOTS[name], seed, f"-{v}")
