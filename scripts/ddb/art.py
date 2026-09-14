#!/usr/bin/env python3
"""Days Drift By — the plates. Seventeenth voice: PAPER RIVER.

Traditional Japanese woodblock (ukiyo-e / mokuhanga): flat layered colour
fields, soft bokashi gradient skies, visible woodgrain, hand-carved key lines,
Prussian blue water, banded mist. Nothing in the sixteen prior voices owns
woodblock, and playbook §20's hard lesson — "in this style SDXL paints
landscapes and cannot paint objects" — is free here, because this song IS
landscape end to end: leaves, river, clouds, sun, sky.

ONE PLACE, ONE DAY. Every lyric is restaged in the same forested river valley
at a different hour, which is what makes twenty-two plates read as one planet
(§20's corollary) and lets the colour arc carry the lyric literally: clouds
roll in -> every colour melts into gray -> then the sun finds its way ->
closer, into the light -> higher, through the leaves.

Text is banned hard in the negative: real woodblock prints carry signature
cartouches and kanji, which arrive on screen as garbage letters.

832x1472 NATIVE PORTRAIT (playbook §17, the 58% crop).
Honors the shared GPU Watchbill lease (scripts/lexicon/GPU_LEASE_ADOPTION.md)
so this batch cannot race the Lexsycon night run.

    python3 scripts/ddb/art.py [--ckpt dream|jugg] [name ...]
"""
import json, urllib.request, urllib.parse, os, sys, time, uuid

HOST = "http://127.0.0.1:8188"
OUT = "scripts/ddb/plates"
CKPTS = {
    "dream": ("DreamShaperXL_Turbo_v2_1.safetensors", 8, 2.0, "dpmpp_sde"),
    "jugg": ("Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors", 30, 5.5, "dpmpp_2m"),
}
W, H = 832, 1472
os.makedirs(OUT, exist_ok=True)

# Woodblock prints are SIGNED, and an unweighted ban does not stop it: the
# first proof pair came back with a kanji cartouche top-right and top-left
# respectively, plus corner seals, against a negative that already said kanji /
# calligraphy / signature / seal / cartouche. Two changes fixed it — weight the
# glyph terms up, and stop calling the thing a "print" in the positive (the
# model renders a print as a complete OBJECT, paper margin and signature
# included) — ask for a full-bleed illustration instead.
# Round two: even weighted, the ban leaked on 6 of 22 shots — a vertical kanji
# column or a red seal tucked in ONE corner, invisible on a 340px contact sheet
# and legible garbage at 1080px. The terms that were missing are the ones that
# name the THING rather than the writing: an artist's signature block, a seal,
# an inscription, a vertical column of characters.
NEG = ("(text:1.7), (kanji:1.7), (japanese writing:1.7), (chinese "
       "characters:1.7), (vertical text column:1.7), (calligraphy:1.6), "
       "(artist signature:1.8), (signature block:1.7), (red seal:1.8), "
       "(seal stamp:1.7), (inscription:1.6), (cartouche:1.7), "
       "(watermark:1.5), (border:1.4), (paper margin:1.4), letters, numbers, "
       "caption, logo, photograph, photorealistic, 3d render, cgi, anime, "
       "manga, cartoon, oil painting, impasto, people, person, face, "
       "portrait, figures, crowd, buildings, city, houses, neon, muddy, "
       "oversaturated, harsh contrast, blurry, deformed")

LOOK = (", ukiyo-e woodblock style illustration, flat layered colour fields, "
        "soft bokashi gradient sky, visible woodgrain texture, delicate "
        "hand-carved key lines, Prussian blue water, layered bands of mist, "
        "matte washi paper texture, serene, vertical composition, full bleed "
        "artwork filling the entire frame, unsigned, unmarked corners, no "
        "paper margin, no seal, no inscription, no text anywhere")

# Two tiny distant figures are the ONE place a human is load-bearing ("stay
# with me"). Thumbnail scale in a vast landscape is the only figure framing
# SDXL respects (§20).
FIG_NEG = NEG.replace("people, person, face, portrait, figures, crowd, ", "close-up face, portrait, crowd, ")

SHOTS = {
 # ── Part A · Verse 2 — the weather turns ─────────────────────────────────
 "clouds":  ("heavy blue-grey storm clouds rolling in low over a wide "
             "forested river valley, the river winding pale below, banded "
             "cloud shadow moving across the treetops, wide establishing "
             "view from a high ridge"),
 "fade":    ("a forested river valley dissolving into three flat layers of "
             "pale mist, the far ridges almost gone, only the nearest trees "
             "still carved in dark line, wide view"),
 "gray":    ("the same river valley drained of all colour, rendered in flat "
             "grey and pale slate washes only, a single soft grey sky, rain "
             "haze over still water, wide view"),
 "sun":     ("a pale gold sun disc breaking through a bank of grey cloud "
             "above a forested valley, flat radiating bands of gold light "
             "spreading across the sky, wide view"),
 "way":     ("one broad shaft of warm gold light landing on the surface of a "
             "wide calm river, the water carved in fine pale ripple lines, "
             "dark pines flanking both banks, medium view"),
 # ── Part A · Bridge — the ascent ─────────────────────────────────────────
 "closer":  ("a narrow riverbank path of pale stones leading forward toward a "
             "bright glowing gap in dense dark trees, the light warm and "
             "widening ahead, medium view"),
 "light":   ("a forest clearing flooded with white-gold light, tall slender "
             "trunks in flat silhouette against it, pale gold ground mist, "
             "wide view"),
 "higher":  ("looking steeply up the length of tall straight tree trunks "
             "toward a bright open sky far above, flat green canopy layers "
             "receding upward, wide low angle"),
 "leaves":  ("looking straight up through overlapping translucent green "
             "leaves at a bright pale sky, veins carved as fine key lines, "
             "sunlight glowing through the leaf edges, close view"),
 # ── Part B · Final chorus ────────────────────────────────────────────────
 "days":    ("a wide forested river valley at full midday, the pale river "
             "curving from foreground to far mountains, flat jade and teal "
             "canopy, huge soft blue bokashi sky, wide establishing view"),
 "drift":   ("a single red maple leaf resting on the surface of slow green "
             "river water, fine carved current lines curling around it, "
             "reflected trees in flat dark bands, medium overhead view"),
 "by":      ("a wide pale river bending away around a wooded headland toward "
             "distant blue mountain ranges, flat receding layers growing "
             "paler with depth, wide view"),
 "breathe": ("dawn mist lifting in soft flat bands off the surface of a still "
             "river, cream and pale rose sky, dark pine silhouettes on both "
             "banks, wide view"),
 "alive":   ("a riverbank thick with wildflowers and ferns, flat vivid green "
             "fronds and small coral and white blossoms, pale water behind, "
             "medium view"),
 "floating":("looking up from the surface of a river at tall white clouds "
             "drifting across a deep blue bokashi sky, treetops framing the "
             "edges of the frame, wide upward view"),
 "sky":     ("an enormous soft bokashi gradient sky of blue melting to cream "
             "above a thin dark treeline and a sliver of pale river, the sky "
             "filling almost the whole frame, wide view"),
 "stay":    ("two very small distant figures in simple robes sitting together "
             "on a flat rock at the edge of a wide river at dusk, seen far "
             "away and tiny in a vast valley, warm rose and gold sky, wide "
             "view"),
 "tonight": ("a forested river valley at blue hour, deep indigo and teal flat "
             "layers, a pale moon and a scatter of stars in a bokashi night "
             "sky, still reflecting water, wide view"),
 # ── pool variants so days / drift / by rotate (§3e) ─────────────────────
 # First pass returned a dry valley twice: "fine diagonal rain" reads as
 # weather MOOD and the model paints the valley, not the rain. Naming the rain
 # as the dense graphic thing that covers the frame is what makes it appear.
 "rain":    ("a downpour seen head on, dense straight white diagonal rain "
             "lines carved edge to edge across the entire frame, a wide green "
             "river below pocked with ring ripples, soft grey-green layered "
             "hills dissolving behind the rain, wide view"),
 "heron":   ("a single white heron lifting off the surface of a still river, "
             "wings spread in flat carved white, dark reeds below, pale "
             "cream sky, medium view"),
 "pine":    ("mist-wrapped dark pines along a high ridge, flat bands of white "
             "cloud passing between the trunks, pale gold sky beyond, wide "
             "view"),
 "gold":    ("a wide river valley at golden hour, the water a flat sheet of "
             "beaten gold, treelines in deep green silhouette, warm amber "
             "bokashi sky, wide view"),
}

FIG_SHOTS = {"stay"}

SIZES = {
 "clouds": "WIDE", "fade": "WIDE", "gray": "WIDE", "sun": "WIDE", "way": "MED",
 "closer": "MED", "light": "WIDE", "higher": "WIDE", "leaves": "CLOSE",
 "days": "WIDE", "drift": "MED", "by": "WIDE", "breathe": "WIDE",
 "alive": "MED", "floating": "WIDE", "sky": "WIDE", "stay": "WIDE",
 "tonight": "WIDE", "rain": "WIDE", "heron": "MED", "pine": "WIDE",
 "gold": "WIDE",
}


def graph(prompt, seed, ckpt, steps, cfg, sampler, neg):
    return {
      "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ckpt}},
      "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt + LOOK, "clip": ["1", 1]}},
      "3": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["1", 1]}},
      "4": {"class_type": "EmptyLatentImage", "inputs": {"width": W, "height": H, "batch_size": 1}},
      "5": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": steps, "cfg": cfg,
            "sampler_name": sampler, "scheduler": "karras", "denoise": 1.0,
            "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0]}},
      "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
      "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "ddb", "images": ["6", 0]}},
    }


def post(path, payload=None):
    req = urllib.request.Request(HOST + path,
                                 data=json.dumps(payload).encode() if payload else None,
                                 headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=600).read())


def run(name, prompt, seed, ck, tag=""):
    dst = f"{OUT}/{name}{tag}.png"
    if os.path.exists(dst) and os.path.getsize(dst) > 20000:
        print(f"  {name}{tag:4s} cached", flush=True); return
    ckpt, steps, cfg, sampler = CKPTS[ck]
    neg = FIG_NEG if name in FIG_SHOTS else NEG
    body = graph(prompt, seed, ckpt, steps, cfg, sampler, neg)
    # §12a: >~900 chars of elaborated prose silently returns a black plate.
    plen = len(prompt + LOOK)
    if plen > 900:
        print(f"  {name}{tag:4s} SKIP prompt {plen} chars > 900"); return
    pid = post("/prompt", {"prompt": body, "client_id": str(uuid.uuid4())})["prompt_id"]
    for _ in range(180):
        time.sleep(2)
        h = post(f"/history/{pid}")
        if pid in h:
            outs = h[pid]["outputs"]
            img = next(iter(outs.values()))["images"][0]
            q = urllib.parse.urlencode({"filename": img["filename"],
                                        "subfolder": img.get("subfolder", ""), "type": img["type"]})
            data = urllib.request.urlopen(f"{HOST}/view?{q}", timeout=180).read()
            open(dst, "wb").write(data)
            print(f"  {name}{tag:4s} OK  {len(data)//1024}KB  ({plen} chars)", flush=True)
            return
    print(f"  {name}{tag:4s} TIMEOUT", flush=True)


def main():
    argv = sys.argv[1:]
    ck = "dream"
    if "--ckpt" in argv:
        i = argv.index("--ckpt"); ck = argv[i + 1]; del argv[i:i + 2]
    nvar = 2
    if "--variants" in argv:
        i = argv.index("--variants"); nvar = int(argv[i + 1]); del argv[i:i + 2]
    # --seedbase moves a re-roll onto fresh seeds; without it a re-roll of a
    # rejected shot reproduces the exact plate that was rejected.
    sb = 1000
    if "--seedbase" in argv:
        i = argv.index("--seedbase"); sb = int(argv[i + 1]); del argv[i:i + 2]
    only = argv
    todo = [k for k in SHOTS if not only or k in only]
    print(f"{len(todo)} shots x {nvar} variants on {ck} (seedbase {sb})")
    for i, name in enumerate(todo):
        for v in range(nvar):
            run(name, SHOTS[name], sb + i * 37 + v * 9151, ck, f"-{v}")


if __name__ == "__main__":
    # Shared GPU Watchbill lease — art workers admit before Comfy submissions
    # and release on exit, so this batch cannot race the Lexsycon night run.
    lease = None
    try:
        sys.path.insert(0, "/home/xsyprime/Projects/singularity/scripts")
        from estate_gpu_lexsycon_shim import admit, release
        lease = admit(task_id="ddb-cut-art")
        print(f"GPU lease admitted: {lease.get('task_id')}")
    except ImportError:
        print("GPU lease shim unavailable — proceeding (shim is x1c7-side optional)")
        release = None
    except Exception as e:
        print(f"GPU lease DEFERRED — refusing to race the night run: {e}")
        sys.exit(3)
    try:
        main()
    finally:
        if lease and release:
            release(lease, {"note": "days drift by cut art"})
            print("GPU lease released")
