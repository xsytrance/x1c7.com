#!/usr/bin/env python3
"""Local plate screener — reject generated art that carries text, before a human
(or a frontier model) ever looks at it.

WHY THIS EXISTS. On the Days Drift By cut, 6 of 22 approved-looking plates
carried a kanji signature cartouche or a red seal in exactly one corner. None
were visible on a 340px contact sheet. Catching them cost a purpose-built
corner-audit tool and ~25 manual image reads. That work is mechanical and now
runs locally on qwen3-vl:8b.

THE TRICK: DO NOT SHOW THE VLM THE WHOLE PLATE. A signature is ~2% of a
832x1472 image; any VLM downsamples it into mush. Woodblock/oil/poster
signatures only ever live in the four corners, so we crop each corner at FULL
resolution, upscale 2x, and ask about ONE corner at a time.

Measured, on 16 hand-labelled plates: four corners stacked into a single strip
and asked once caught 6 of 10 dirty plates. The same model asked per-corner
catches far more — the strip was itself being downsampled, which is the very
failure the crop exists to avoid. Resolution per query is the whole ballgame.

    python3 scripts/art/screen_plates.py <dir-or-file> [...] [--json out.json]
    python3 scripts/art/screen_plates.py --eval            # score against labels

Exit 1 if any plate is rejected, so a batch script can stop and re-roll.
"""
import base64, json, os, subprocess, sys, tempfile, urllib.request

OLLAMA = "http://127.0.0.1:11434/api/chat"
MODEL = os.environ.get("SCREEN_MODEL", "qwen3-vl:8b")
CW, CH = 300, 230          # corner box, full-res pixels — same as corner_audit.sh

# Per-corner, not per-strip. The first version stacked four corners into one
# 1200x230 strip and asked once — the VLM downsamples its input, so a seal that
# is 40px tall arrived as mush and it missed 4 of 10 known-dirty plates. One
# corner at a time, upscaled 2x, puts the glyphs at a size the model can read.
# SHORT ON PURPOSE. The long, carefully-caveated version of this prompt made the
# model reason for longer than its token budget on 7 of 16 plates, so the gate
# got its zero-misses partly by rejecting whenever it was confused rather than
# by reading anything. A blunt question ends the reasoning sooner, which turns
# fail-safe rejections back into actual detections — and roughly halves runtime.
PROMPT = (
    "Is there any writing, lettering, Chinese/Japanese characters, a signature "
    "or a stamped seal in this image?\n"
    "Reply NONE, or FOUND plus what it says."
)


CORNERS = {
    "top-left":     "0:0",
    "top-right":    f"in_w-{CW}:0",
    "bottom-left":  f"0:in_h-{CH}",
    "bottom-right": f"in_w-{CW}:in_h-{CH}",
}


def corner_crops(png: str):
    """One full-res crop per corner, upscaled 2x with a point filter so the
    glyph edges stay hard. Yields (corner name, path)."""
    for name, xy in CORNERS.items():
        out = tempfile.mktemp(suffix=".png")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", png, "-vf",
                        f"crop={CW}:{CH}:{xy},scale={CW*2}:{CH*2}:flags=neighbor",
                        out], check=True)
        yield name, out


def ask_once(img_path: str, budget: int) -> tuple[bool, str] | None:
    """None means the model produced no verdict at this token budget."""
    b64 = base64.b64encode(open(img_path, "rb").read()).decode()
    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": PROMPT, "images": [b64]}],
        # qwen3-vl is a THINKING model: reasoning goes to message.thinking and
        # the answer to message.content. At num_predict=80 the reasoning ate the
        # whole budget, content came back EMPTY with done_reason "length", and an
        # unwary parser read that as a pass — it silently scored 0/10 on plates
        # known to be dirty. `"think": false` is NOT honoured by ollama 0.32.15
        # (verified: thinking still emitted), so the fix is to BUDGET for the
        # reasoning rather than suppress it. 600 leaves room for both.
        "stream": False,
        "options": {"temperature": 0, "num_predict": budget},
    }
    req = urllib.request.Request(OLLAMA, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    msg = json.loads(urllib.request.urlopen(req, timeout=300).read())["message"]
    txt = (msg.get("content") or "").strip()
    if not txt:
        return None          # reasoning ate the budget; caller decides what to do
    clean = " ".join(txt.split())
    up = clean.upper()
    # "NONE" is the only pass token. Anything else — FOUND, a transcription, a
    # hedge — is treated as a hit: a false alarm costs one re-roll, a miss ships.
    dirty = not up.startswith("NONE")
    return dirty, clean[:150]


def ask(img_path: str) -> tuple[bool, str]:
    """A GATE, so it fails SAFE. The reasoning length varies per image and
    sometimes overruns even a generous budget; when the model returns no verdict
    we retry once with far more room, and if it still has nothing to say we
    REJECT. An unreadable answer costs one re-roll; treating it as clean is how
    a signed plate ships."""
    for budget in (600, 1800):
        got = ask_once(img_path, budget)
        if got is not None:
            return got
    return True, "no verdict from the model after two budgets — rejected fail-safe"


def screen(paths):
    results = {}
    for p in paths:
        name = os.path.basename(p)[:-4]
        hits = []
        for corner, crop in corner_crops(p):
            try:
                dirty, why = ask(crop)
            finally:
                os.path.exists(crop) and os.unlink(crop)
            if dirty:
                hits.append(f"{corner}: {why[:70]}")
        results[name] = {"text": bool(hits), "why": " | ".join(hits)[:200]}
        print(f"{'REJECT' if hits else 'ok    '}  {name:14s} {results[name]['why'][:95]}", flush=True)
    return results


def collect(args):
    out = []
    for a in args:
        if os.path.isdir(a):
            out += [os.path.join(a, f) for f in sorted(os.listdir(a)) if f.endswith(".png")]
        elif a.endswith(".png"):
            out.append(a)
    return out


# Hand-labelled ground truth from the Days Drift By corner audit (2026-09-14).
# These 16 plates were read at full resolution by eye; 10 carried a glyph.
EVAL = {
    "by-0": False, "by-1": True, "by-2": True, "by-3": True,
    "stay-0": True, "stay-1": False, "stay-2": True, "stay-3": True,
    "rain-0": False, "rain-1": True, "rain-2": False, "rain-3": False,
    "heron-0": True, "heron-1": True, "heron-2": False, "heron-3": True,
}

if __name__ == "__main__":
    argv = sys.argv[1:]
    if "--eval" in argv:
        d = "scripts/ddb/plates"
        paths = [os.path.join(d, f"{k}.png") for k in EVAL if os.path.exists(os.path.join(d, f"{k}.png"))]
        res = screen(sorted(paths))
        tp = fp = tn = fn = 0
        for k, truth in EVAL.items():
            if k not in res:
                continue
            got = res[k]["text"]
            tp += truth and got; fn += truth and not got
            tn += (not truth) and (not got); fp += (not truth) and got
        n = tp + fp + tn + fn
        print(f"\nscored {n} labelled plates on {MODEL}")
        print(f"  caught {tp}/{tp+fn} dirty plates   (missed {fn})")
        print(f"  passed {tn}/{tn+fp} clean plates   (false alarms {fp})")
        print("\n  A MISS ships a glyph. A FALSE ALARM costs one re-roll.")
        print("  Tune for zero misses; false alarms are cheap.")
        raise SystemExit(0)

    jsonout = None
    if "--json" in argv:
        i = argv.index("--json"); jsonout = argv[i + 1]; del argv[i:i + 2]
    paths = collect(argv)
    if not paths:
        print("usage: screen_plates.py <dir-or-file.png> [...] [--json out.json]")
        raise SystemExit(2)
    res = screen(paths)
    if jsonout:
        json.dump(res, open(jsonout, "w"), indent=2)
    bad = sum(1 for v in res.values() if v["text"])
    print(f"\n{len(res)} screened · {bad} rejected for text")
    raise SystemExit(1 if bad else 0)
