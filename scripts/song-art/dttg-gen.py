#!/usr/bin/env python3
"""DON'T TAP THE GLASS — the art, generated cloud-side.

The song is not a museum. "Don't tap the glass" is a PHONE SCREEN: "always
within arm's reach", "the exhibit never closes", "give a tap, I react", and
"till the cracks started spreading / when the surface cracks" is a cracked
display. He is talking to women — exes, maybes, the ones watching him through it.

Two models, both on the existing aimlapi key:
  google/nano-banana-pro   image_url (SINGULAR)  — Tyler, likeness held.
      image_urlS (plural) silently returns a DIFFERENT MAN. Verified.
  bytedance/seedream-5-0-pro  aspect_ratio "9:16" — everything else, photoreal.
      (image_size is rejected; imagen-4-ultra is down for maintenance.)

Owner rules: never reuse a Tyler source photo; every image photoreal, none
illustrated; ~85% not-him.
"""
import json, urllib.request, base64, io, subprocess, os, sys, time
from PIL import Image

KEY = open("/home/xsyprime/.bfl_key").read().strip()
OUT = "scripts/song-art/dttg-cloud"; os.makedirs(OUT, exist_ok=True)
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/140.0 Safari/537.36")
# Seedream invented a bearded stranger wherever a prompt said "a man". Any frame that
# needs HIM is a nano-banana-pro edit off a real photo; every other frame bans men outright.
NOMEN = (" ABSOLUTELY NO MEN in this image — no male figure, no man's face, no man's body,"
         " no man in any photograph, screen, reflection or background. The only person who may"
         " appear is the woman described. If no woman is described there are NO PEOPLE AT ALL,"
         " only objects. ")
LOOK = (" Photoreal, shot on 35mm, fine film grain, shallow depth of field, cold blue-white "
        "screen light as the only source against near-black, cinematic, vertical 9:16. "
        "No text, letters, numbers, logos, watermarks or user-interface labels anywhere.")
HER = ("a Latina woman in her late twenties, athletic build with a curvy figure, natural "
       "makeup, long dark hair, believable and unglamorised")

# (name, t, kind, source photo | None, prompt)
SHOTS = [
 ("hook1",     124.14,"T","02","sitting low against a bedroom wall in the dark, phone held up in front of his face so the screen lights only his eyes, seen from a few feet away, full body"),
 ("tap",       125.60,"S",None,f"Extreme macro of a woman's thumb a hair above a black smartphone screen, old fingerprint smears catching the light, about to touch"),
 ("paid",      126.52,"S",None,"A smartphone lying on a dark bedsheet, its lock screen glowing, one notification banner blurred beyond reading"),
 ("access",    127.90,"S",None,"A phone screen glowing red in a dark room after a failed unlock, held in a woman's hand, her face out of focus behind it"),
 ("love",      129.06,f"S",None,f"Close on {HER} lying in the dark looking down into her phone, the screen lighting her face from below"),
 ("stares",    130.40,"S",None,f"A black switched-off phone screen filling the frame, {HER} reflected in it looking back at herself"),
 ("scream",    131.58,"S",None,"A smartphone dropped face-up on a hardwood floor in the dark, screen still lit, a shoe blurred behind it"),
 ("surface",   132.90,"S",None,"Macro of a spiderweb-cracked phone screen still glowing, the fracture radiating from one impact point, light leaking through the splits"),
 ("hook2",     134.38,"T","10","standing alone in a dark kitchen at night, phone in one hand at his side, screen throwing light up his body, seen wide from across the room"),
 ("hands",     135.80,"S",None,"Many hands reaching in from the edges of the frame toward one glowing phone lying screen-up in the dark"),
 ("possess",   137.34,"S",None,f"{HER} sitting on the floor in the dark holding a lit phone against her chest, screen glow bleeding around her hands"),
 ("reaction",  138.90,"S",None,"A phone screen in the dark completely covered by a stack of blurred notification banners, too many to read"),
 ("wanted",    139.92,"S",None,f"Close on {HER} hands typing on a phone in the dark, thumbs mid-motion, screen light on her fingers"),
 ("fast",      141.46,"S",None,"A long-exposure blur of a thumb swiping fast across a bright phone screen in a dark room, motion smearing the light"),
 ("answer",    142.90,"S",None,"A phone screen in the dark showing a single blurred read-receipt line at the bottom of an empty conversation, no reply"),
 ("live",      144.30,"S",None,"A phone lying face-down on rumpled bedsheets in a dark bedroom, a faint glow escaping around its edges"),
 ("whisper",   148.66,"S",None,"One smartphone screen glowing alone in a completely black room, nothing else visible"),
 ("keeping",   150.72,"T","12","seen through a smudged pane of glass at night, standing still and looking straight back at the lens, wide, whole body visible"),
 ("safe",      152.40,"S",None,f"{HER} alone in a large bed at night, turned away, phone screen glowing on the pillow beside her"),
 ("palms",     153.70,"S",None,"A woman's open palm pressed flat against a bright phone screen in the dark, light spilling between her fingers"),
 ("save",       155.20,"T","01","repeated as dozens of small dark thumbnail photographs filling a phone gallery grid, a woman's thumb resting on one of them"),
 ("framed",    156.30,"T","07","shown as a single photograph open full-screen on a phone held in the dark, two fingers pinch-zooming the image of him"),
 ("contained", 158.00,"S",None,"A switched-off phone in a hard case lying on a nightstand in a dark bedroom, screen dead black"),
 ("cracks",    158.86,"S",None,"A cracked phone screen in the dark, the fracture visibly spreading further across the glass, light bleeding out of it"),
 ("ran",       160.90,"S",None,"A phone screen in the dark mid-way through deleting a contact, the name blurred out beyond reading"),
 ("cage",      161.70,"T","03","walking away from the camera down a dark hallway at night, phone light behind him throwing his shadow forward, wide, small in frame"),
 ("trap",      163.40,"S",None,"An empty unmade bed at night with two phones on opposite nightstands, both screens dark"),
 ("exhibit",   164.18,"T","09","repeated across a dark wall of many phone screens all showing him at once, seen slightly from the side"),
 ("blamed",    166.00,"S",None,f"Close on {HER} face in the dark reading her phone, jaw set, screen light hard across her"),
 ("collapse",  167.04,"S",None,"A phone screen shattering completely, glass fragments lifting off the display, light blowing out through the break"),
 ("crowd",     169.82,"S",None,"Dozens of small glowing phone screens held up in a dark crowd, faces behind them lost in shadow"),
 ("riser",     172.40,"S",None,"Hard white light blazing through the cracks of a shattered phone screen filling the frame"),
 ("dark",      177.80,"T","04","sitting alone on the floor of a dark room with his back against a bed, phone dark in his hand, barely lit, wide"),
]

def post(payload, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(
                "https://api.aimlapi.com/v1/images/generations",
                data=json.dumps(payload).encode(),
                headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
                         "User-Agent": UA})
            return json.loads(urllib.request.urlopen(req, timeout=420).read())
        except Exception as e:
            if i == tries - 1: raise
            time.sleep(4 * (i + 1))

def grab(r, dst):
    url = None
    for k in ("images", "data"):
        v = r.get(k)
        if isinstance(v, list) and v:
            url = v[0].get("url") or v[0].get("image_url"); break
    if not url: return False
    subprocess.run(["curl", "-sL", "-m", "180", "-o", dst, url], check=False)
    try:
        im = Image.open(dst); im.verify(); return os.path.getsize(dst) > 12000
    except Exception: return False

only = sys.argv[1] if len(sys.argv) > 1 else None
for name, t, kind, src, scene in SHOTS:
    if only and only != name: continue
    dst = f"{OUT}/scene-{name}.png"
    if os.path.exists(dst) and os.path.getsize(dst) > 12000:
        print(f"  {name:10s} cached", flush=True); continue
    try:
        if kind == "T":
            im = Image.open(f"assets/art/tylerhaze/{src}.webp").convert("RGB")
            b = io.BytesIO(); im.save(b, format="PNG")
            uri = "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()
            p = ("Keep this exact man — his exact face, tattoos, hair and chains. Do not change "
                 f"his identity. Place him {scene}." + LOOK)
            r = post({"model": "google/nano-banana-pro", "prompt": p,
                      "num_images": 1, "image_url": uri})
        else:
            r = post({"model": "bytedance/seedream-5-0-pro", "prompt": scene + "." + NOMEN + LOOK,
                      "num_images": 1, "aspect_ratio": "9:16"})
        ok = grab(r, dst)
        print(f"  {name:10s} {'OK ' if ok else 'FAIL'} {kind}{' src='+src if src else ''}", flush=True)
    except Exception as e:
        print(f"  {name:10s} ERR {str(e)[:90]}", flush=True)
