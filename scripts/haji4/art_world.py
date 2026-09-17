#!/usr/bin/env python3
"""HAJIMEMASHITE v4 — the WORLD plates (no people), generated locally.

The v2 cut was rejected as "a powerpoint presentation of kizuna selfies"; v3
fixed the geometry but still mapped her to nearly every keyword, and the
Sovereign's note on it (2026-09-16) was the same in substance: "don't make
every picture kizuna... just sprinkle her and Tyler in."

The root cause is mechanical, not artistic. The whole v3 set went through Flux
Kontext seeded from Kizuna's photo, and Kontext is an instruction-EDITOR: it
preserves the subject of the source image by design. Feed it her portrait
sixteen times and you get sixteen of her, however wide the prompt asks for.

So the set splits. Plates with a person in them still go through Kontext (paid,
likeness-preserving, scripts/haji4/art_people.py). Plates with NO person never
needed it — they are ordinary text-to-image and run here, locally, for free, in
about 17 seconds a pair. That is why "sprinkle her in" costs less than v3 did
rather than more.

Voice: the song keeps the OSAKA GOLD-LEAF NIGHT it already owns (playbook §12);
what changes is the subject matter — the world of the song instead of the face
in front of it. The lyric is full of concrete nouns that v3 resolved to a
portrait: a trap and a bait, any key any tongue any tempo, doors swinging open,
lights hitting, a house already warm, wheels falling off.

Juggernaut-XL v9 photoreal @ 832x1472 NATIVE PORTRAIT (playbook §17).

    python3 scripts/haji4/art_world.py [name ...]
"""
import json, urllib.request, urllib.parse, os, sys, time, uuid

HOST = "http://127.0.0.1:8188"
OUT = "scripts/haji4/plates"
CKPT = "Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors"
W, H = 832, 1472
os.makedirs(OUT, exist_ok=True)

NEG = ("people, person, man, woman, face, portrait, crowd of faces, hands, "
       "text, watermark, logo, signature, readable letters, lettering, words, "
       "kanji text that is legible, deformed, mutated, ugly, blurry, low "
       "quality, oversaturated, hdr, cgi, 3d render, anime, cartoon, "
       "illustration, painting, daylight, bright daylight, washed out, flat "
       "lighting, nudity, swimwear, bare skin")

# The grade every plate shares — lifted from the v3 pass so the new world
# plates sit beside the surviving portrait ones as ONE planet.
GRADE = (", OSAKA GOLD-LEAF NIGHT: photoreal Dotonbori after 2am and after "
         "rain, everything crushed to near-black except molten gold, every "
         "light source a warm gold-leaf glow, deep wet reflections, shot on "
         "35mm film at night, fine grain, shallow depth, vertical composition "
         "with depth stacked bottom to top, cinematic, no people in frame")

SHOTS = {
 # ── verse two: the boast ─────────────────────────────────────────────────
 "trap":  ("a single ornate gold fishing lure on a fine line hanging above "
           "black still water, the lure catching one hard highlight, its "
           "reflection stretching down into the dark water below, the top of "
           "the frame lost in blackness"),
 "street": ("an empty narrow Dotonbori alley at 2am after rain, gold neon "
            "signage stacked up both walls into the top of the frame, the wet "
            "asphalt below mirroring every light into a long gold smear, "
            "nobody in the street"),
 "keys":  ("a close low view along the keys of a grand piano in a dark room, "
           "a single warm gold lamp raking across the ivory, the rest of the "
           "instrument falling away into black"),
 "tempo": ("an antique brass metronome on a dark lacquered table, its pendulum "
           "caught mid-swing and motion-blurred, one warm gold light behind it "
           "throwing a long shadow up the frame"),
 # ── the lineage ──────────────────────────────────────────────────────────
 "throne": ("a single ornate gilded throne alone at the far end of a vast dark "
            "empty hall, one shaft of warm gold light falling on it from high "
            "above, the polished floor reflecting it, deep blackness all around"),
 "glyph": ("a long ribbon of molten gold light painted in the air by a "
           "long-exposure camera, coiling and looping up through a pitch black "
           "frame like a signature written in light, wet pavement below "
           "catching the glow"),
 # ── the bridge: the room ─────────────────────────────────────────────────
 "doors": ("a pair of tall heavy doors standing open at the end of a dark "
           "corridor, blinding warm gold light pouring through the gap and "
           "spilling across the floor toward the camera, everything else in "
           "silhouette"),
 "lights": ("a row of old theatre stage lights high on a rig seen from below, "
            "filaments glowing warm gold against total blackness, lens flare, "
            "haze in the beams"),
 "house": ("the warm interior of a tiny Osaka izakaya at night seen from the "
           "street through its doorway, paper lanterns and a gold-lit counter "
           "inside, the cold wet street in the dark foreground, empty stools"),
 "secret": ("a single folded paper note resting on a dark lacquered bar top, "
            "lit by one small warm gold lamp, the rest of the room swallowed "
            "in black, shallow depth of field"),
 # ── the final chorus ─────────────────────────────────────────────────────
 "sound": ("a vintage ribbon microphone on a stand in a pitch black studio, "
           "one warm gold light catching its grille and the chrome ring, the "
           "background falling to pure black"),
 "wheels": ("a low shot of the rear wheel of a black car standing on wet "
            "asphalt at night, gold neon reflected in the paint and in the "
            "water around the tyre, the street lights receding into the dark "
            "at the top of the frame"),
 "sign":  ("a tall blank illuminated signboard on a dark Osaka street at "
           "night, its face glowing plain warm gold with nothing written on "
           "it, wet road below reflecting the glow, black sky above"),
 "rain":  ("a wide view down a Dotonbori canal at night after rain, gold neon "
           "on both banks doubled in the black water, a footbridge crossing "
           "the middle distance, the sky above pitch black, no people"),
 "crowd": ("a dense crowd of anonymous dark silhouettes from behind on a wet "
           "neon street at night, only their backs and shoulders visible as "
           "black shapes against the gold signage ahead, no faces, no detail"),
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
      "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "haji4", "images": ["6", 0]}},
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
    assert len(full) < 900, f"{name}: prompt {len(full)} chars, over the §12a cliff"
    pid = post("/prompt", {"prompt": graph(prompt, seed), "client_id": str(uuid.uuid4())})["prompt_id"]
    for _ in range(150):
        time.sleep(2)
        h = post(f"/history/{pid}")
        if pid in h:
            img = next(iter(h[pid]["outputs"].values()))["images"][0]
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
        for v, seed in enumerate((3300 + i * 19, 8800 + i * 31)):
            run(name, SHOTS[name], seed, f"-{v}")
