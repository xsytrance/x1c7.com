#!/usr/bin/env python3
"""OSAKA AFTER DARK re-cut — the new plates for the 1:13 chorus window.

Same voice as the shipped 56s cut: THE WET NEON (scripts/osaka/art.py in the
osaka-after-dark-cut worktree). Everything here — LOOK, NEG, checkpoint,
sampler — is copied from it deliberately so the new plates cut against the five
reused ones (wine, osaka, dripping, yamenaide, closer) without a seam.

This window is the FIRST chorus through the end of the Female Lead section, so
it needs its own scenes: the sound system, the verse-2 boasts, the male
response. Thirteen new plates; five reused; eighteen total.

NO PEOPLE AND NO FACES, same as the original — the film is the city.

Uses the systemd ComfyUI on :8188. The original had to run a PRIVATE instance on
:8190 to dodge an "AutoencoderKL hangs forever" bug and blamed the bfloat16 VAE.
That was really the OOM guard: MemoryHigh=8G throttled the service cgroup into
permanent reclaim, which looks exactly like a hang. A private instance escaped
the cgroup, which is why the workaround appeared to work. Raised to 16G/22G on
2026-09-04, so the service instance is fine now and --fp32-vae is not needed.

    ~/librosa-venv/bin/python scripts/osaka2/art.py [name ...]
"""
import json, urllib.request, os, sys, time

HOST = "http://127.0.0.1:8188"
OUT = "scripts/osaka2/plates"
CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors"
W, H = 832, 1472
os.makedirs(OUT, exist_ok=True)

NEG = ("person, people, man, woman, girl, boy, face, portrait, figure, crowd, "
       "pedestrian, silhouette of a person, hands, body, model, "
       "anime, manga, cartoon, illustration, painting, drawing, concept art, "
       "3d render, cgi, digital art, vaporwave, synthwave, cyberpunk, "
       "blade runner, futuristic, sci-fi, hologram, flying car, "
       "daylight, blue sky, sunset, sunrise, overcast, snow, "
       "clean, pristine, empty white, minimalist, studio lighting, "
       "oversaturated, hdr, orange and teal grade, lens flare, god rays, "
       "text overlay, watermark, logo, signature, caption, subtitle, "
       "deformed, extra fingers, blurry mess, low quality")

LOOK = (", documentary night photograph of Dotonbori Osaka after midnight, "
        "shot on 35mm film at high ISO, fine grain, available light only, the "
        "only light sources are neon signs, paper lanterns and tail lights, "
        "deep black shadows, wet reflective ground, saturated gold and hot "
        "magenta neon with cyan behind it, shallow depth of field, "
        "vertical composition, nobody in frame")

SHOTS = {
 # --- the chorus body: the sound system, the room ----------------------------
 "body":      "close on a stack of black speaker cabinets standing in a dark Osaka club doorway, the grille cloth catching a single magenta neon strip above them, dust in the air, everything behind black",
 "dancehall": "wide view of a tall tower of stacked speaker boxes at the closed end of a narrow alley at night, gold neon washing down the front of the stack, wet ground in front holding the whole reflection",
 "kimi":      "close on a narrow gap between two buildings in Osaka at night, one bare bulb hanging deep inside it, magenta neon on the wet wall at the mouth of the gap, the far end pure black",
 "konya":     "close on an illuminated hotel key panel in a dark corridor, rows of small gold lights in the black, magenta neon leaking from an open doorway at the far end, nobody there",
 "sawatte":   "wet chrome handrail running down a dark exterior staircase at night, one long gold neon reflection travelling the length of the metal, water beads on the rail, black stairwell behind",

 # --- verse 2: the boasts ----------------------------------------------------
 "grammar":   "wide view straight up a wall of stacked illuminated kanji signage in Osaka at night, layer on layer of gold magenta and cyan characters going up out of frame, black sky behind them",
 "plum":      "macro of a row of dark plum wine bottles on a black bar shelf, magenta and gold neon refracting through the glass and the liquid inside, the room behind out of focus and black",
 "bass":      "wide view of a wall of large speaker cones in a dark room, the paper cones raked from one side by gold neon, deep black between them, dust in the beam",
 "tokyo":     "wide long exposure of an elevated expressway curving through Osaka at night, red tail light trails smeared along the curve, neon buildings stacked behind it, wet road below doubling the colour",
 # Both first-pass kansai candidates grew blurred figures at the stall front —
 # SDXL puts people at food stalls no matter what the negative says (§18). Fixed
 # by cropping the brief down to the griddle itself so there is no room for them.
 "kansai":    "extreme close on a cast iron takoyaki griddle filling the whole frame, rows of round batter wells steaming, bare gold bulbs reflected in the hot oil, magenta neon glow on the metal, deep black around the edges, no stall front, no street, nobody",
 "midnight":  "close on an illuminated clock face on a dark Osaka street reading just past midnight, gold neon ringing it, the wall behind black and wet",

 # --- the male response and the turn -----------------------------------------
 "chain":     "macro of a fine gold chain lying on wet black asphalt at night, a single magenta neon reflection curving along the links, extremely shallow focus, everything else black",
 "insane":    "wide view down a dark Osaka street with all the neon signage smeared into long streaks by camera motion, gold and magenta light trails, the wet ground doubling every streak",
}

SIZES = {  # >=1/3 WIDE, <=1/4 CLOSE+MACRO across the WHOLE planet (incl. reused)
 "body":"MED","dancehall":"WIDE","kimi":"MED","konya":"MED","sawatte":"MED",
 "grammar":"WIDE","plum":"MACRO","bass":"WIDE","tokyo":"WIDE","kansai":"MED",
 "midnight":"CLOSE","chain":"MACRO","insane":"WIDE",
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
      "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "osaka2", "images": ["6", 0]}},
    }


def post(path, payload=None):
    req = urllib.request.Request(HOST + path,
        data=json.dumps(payload).encode() if payload else None,
        headers={"content-type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def run(name, prompt, seed, dest):
    pid = post("/prompt", {"prompt": graph(prompt, seed)})["prompt_id"]
    while True:
        time.sleep(2)
        try:
            h = json.load(urllib.request.urlopen(f"{HOST}/history/{pid}", timeout=20))
        except Exception:
            continue
        if pid in h:
            st = h[pid].get("status") or {}
            if st.get("status_str") == "error":
                raise SystemExit(f"comfy error on {name}: {json.dumps(st)[:300]}")
            imgs = [i for o in h[pid]["outputs"].values() for i in o.get("images", [])]
            if imgs:
                q = urllib.parse.urlencode({"filename": imgs[0]["filename"],
                                            "subfolder": imgs[0].get("subfolder", ""),
                                            "type": imgs[0]["type"]})
                open(dest, "wb").write(urllib.request.urlopen(f"{HOST}/view?{q}", timeout=60).read())
                return


import urllib.parse
wanted = sys.argv[1:] or list(SHOTS)
json.dump(SIZES, open("scripts/osaka2/sizes.json", "w"), indent=1)
for name in wanted:
    for seed in (7, 8):
        dest = os.path.join(OUT, f"{name}-{seed}.png")
        if os.path.exists(dest):
            print(f"· {name}-{seed} exists"); continue
        t0 = time.time()
        run(name, SHOTS[name], seed, dest)
        print(f"✓ {name}-{seed} [{SIZES[name]}] {time.time()-t0:.0f}s", flush=True)
print("done")
