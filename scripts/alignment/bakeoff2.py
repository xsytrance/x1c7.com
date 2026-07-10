#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# BAKE-OFF ROUND 2 — windowed forced alignment (the model sees ~200s max).
#
# Strategy: slide a window over the lead stem; align the REMAINING text
# against each window; commit only words that end safely inside it; feed the
# uncommitted tail to the next window. Converges in 2-4 passes per song.
#
#   ~/whisper-venv/bin/python scripts/alignment/bakeoff2.py [slug ...]
# ═══════════════════════════════════════════════════════════════════════════
import json, re, sys, time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PROFILES = REPO / "scripts" / "song-analysis" / "profiles"
STEMS = REPO / "assets" / "suno" / "stems"
OUT = Path("/tmp/claude-1000/-home-xsyprime/028da38f-a028-402e-9a14-2135fe5059f6/scratchpad/bakeoff")
OUT.mkdir(parents=True, exist_ok=True)

WINDOW = 160.0   # seconds of audio per pass (safe under the ~200s ceiling)
MARGIN = 20.0    # words ending in the last MARGIN s are NOT committed
SR = 16000

SPECIMENS = {
    "different-this-summer": "English",
    "oro-de-la-presion": "Spanish",
    "i-won-t-be-your-fire-japanese-mix": "Japanese",
}
slugs = sys.argv[1:] or list(SPECIMENS)

def official_text(slug):
    p = json.loads((PROFILES / slug / "profile.json").read_text())
    lines = [l for l in p["lyrics"]["text"].splitlines() if not re.fullmatch(r"\s*\[[^\]]*\]\s*", l)]
    return "\n".join(lines).strip(), p

CJK = re.compile(r"[぀-ヿ㐀-鿿가-힯]")
def join_tokens(toks):
    out = ""
    for t in toks:
        if out and not (CJK.search(t[:1]) or CJK.search(out[-1:])):
            out += " "
        out += t
    return out

print("loading model…", flush=True)
import subprocess
import numpy as np, torch
from qwen_asr import Qwen3ForcedAligner
aligner = Qwen3ForcedAligner.from_pretrained(
    "Qwen/Qwen3-ForcedAligner-0.6B", dtype=torch.bfloat16, device_map="cuda:0")

def load_audio(path):
    # ffmpeg, not libsndfile — Suno stem MP3s have broken VBR headers that
    # make libsndfile silently truncate at ~195s (found the hard way).
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "pipe:1"],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

def align_windowed(path, text, lang):
    audio = load_audio(path)
    dur = len(audio) / SR
    committed, cursor, remaining, passes = [], 0.0, text, 0
    while remaining.strip() and passes < 8:
        passes += 1
        end = min(cursor + WINDOW, dur)
        chunk = audio[int(cursor * SR):int(end * SR)]
        res = aligner.align(audio=(chunk, SR), text=remaining, language=lang)
        words = [(w.text, w.start_time + cursor, w.end_time + cursor) for w in res[0]]
        last_window = end >= dur - 0.5
        limit = end if last_window else end - MARGIN
        take = 0
        for _, s, e in words:
            if e < limit: take += 1
            else: break
        if take == 0:
            if last_window: committed.extend(words); break
            cursor = end - MARGIN  # no progress — slide anyway
            continue
        committed.extend(words[:take])
        if last_window and take == len(words): break
        remaining = join_tokens([w[0] for w in words[take:]])
        cursor = committed[-1][2]
        if last_window:
            if remaining.strip():  # leftovers past the song end — clamp
                committed.extend((t, dur, dur) for t in remaining.split())
            break
    return committed, dur, passes

for slug in slugs:
    lang = SPECIMENS.get(slug, "English")
    stem = STEMS / slug / "0 Lead Vocals.mp3"
    text, profile = official_text(slug)
    t0 = time.time()
    words, dur, passes = align_windowed(stem, text, lang)
    secs = time.time() - t0
    starts = [s for _, s, _ in words]
    mono = all(b >= a - 0.01 for a, b in zip(starts, starts[1:]))
    from collections import Counter
    clump = Counter(round(s, 2) for s in starts).most_common(1)
    (OUT / f"{slug}.aligned2.json").write_text(json.dumps(
        [{"text": t, "start": round(s, 3), "end": round(e, 3)} for t, s, e in words],
        ensure_ascii=False, indent=1))
    print(f"\n━━ {slug} [{lang}] — {passes} passes in {secs:.1f}s")
    print(f"   {len(words)} words | span {starts[0]:.1f}→{words[-1][2]:.1f}s of {dur:.1f}s | monotonic={mono}")
    print(f"   worst clump: {clump[0][1]} words @ {clump[0][0]}s")
    print(f"   first: {[(t, round(s,2)) for t, s, _ in words[:4]]}")
    print(f"   last:  {[(t, round(s,2)) for t, s, _ in words[-4:]]}")
print("\n✦ round-2 timings in", OUT)
