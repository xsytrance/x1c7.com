#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# THE ALIGNMENT BAKE-OFF — can forced alignment beat whisper's timings?
#
# For each specimen: official lyrics + the isolated lead stem →
# Qwen3-ForcedAligner word timings, compared against the whisper transcript
# the shows currently run on. Prints a scoreboard; writes full word timings
# to scratch for eyeballing. Run inside ~/qwen-asr-venv.
#
#   ~/qwen-asr-venv/bin/python scripts/alignment/bakeoff.py [slug ...]
# ═══════════════════════════════════════════════════════════════════════════
import json, re, sys, time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PROFILES = REPO / "scripts" / "song-analysis" / "profiles"
STEMS = REPO / "assets" / "suno" / "stems"
OUT = Path("/tmp/claude-1000/-home-xsyprime/028da38f-a028-402e-9a14-2135fe5059f6/scratchpad/bakeoff")
OUT.mkdir(parents=True, exist_ok=True)

SPECIMENS = {
    "different-this-summer": "English",
    "oro-de-la-presion": "Spanish",
    "i-won-t-be-your-fire-japanese-mix": "Japanese",
}
slugs = sys.argv[1:] or list(SPECIMENS)

def official_text(slug):
    p = json.loads((PROFILES / slug / "profile.json").read_text())
    text = p["lyrics"]["text"]
    # strip Suno structure tags like [Verse 1], [Chorus], (adlibs) stay
    lines = [l for l in text.splitlines() if not re.fullmatch(r"\s*\[[^\]]*\]\s*", l)]
    return "\n".join(lines).strip(), p

def whisper_words(slug):
    tp = PROFILES / slug / "transcript.json"
    if not tp.exists(): return []
    t = json.loads(tp.read_text())
    words = []
    for seg in t.get("segments", []):
        for w in seg.get("words", []):
            start = w.get("start", w.get("t"))
            words.append({"text": w.get("word", w.get("text", "")).strip(), "start": start})
    return words

def norm(s): return re.sub(r"[^\w]+", "", s.lower(), flags=re.UNICODE)

print("loading Qwen3-ForcedAligner-0.6B…", flush=True)
import torch
from qwen_asr import Qwen3ForcedAligner
aligner = Qwen3ForcedAligner.from_pretrained(
    "Qwen/Qwen3-ForcedAligner-0.6B", dtype=torch.bfloat16, device_map="cuda:0")

for slug in slugs:
    lang = SPECIMENS.get(slug, "English")
    stem = STEMS / slug / "0 Lead Vocals.mp3"
    if not stem.exists():
        print(f"✗ {slug}: no lead stem at {stem}"); continue
    text, profile = official_text(slug)
    dur = profile.get("measured", {}).get("duration")
    t0 = time.time()
    try:
        res = aligner.align(audio=str(stem), text=text, language=lang)
    except Exception as e:
        print(f"✗ {slug}: aligner error — {e}"); continue
    secs = time.time() - t0
    words = [{"text": w.text, "start": round(w.start_time, 3), "end": round(w.end_time, 3)} for w in res[0]]
    (OUT / f"{slug}.aligned.json").write_text(json.dumps(words, ensure_ascii=False, indent=1))

    wh = whisper_words(slug)
    # timing sanity: nearest-start delta for words whose text matches
    wh_by_text = {}
    for w in wh:
        wh_by_text.setdefault(norm(w["text"]), []).append(w["start"])
    deltas = []
    for w in words:
        k = norm(w["text"])
        starts = [s for s in wh_by_text.get(k, []) if s is not None]
        if starts:
            deltas.append(min(abs(w["start"] - s) for s in starts))
    deltas.sort()
    med = deltas[len(deltas)//2] if deltas else None
    n_text = len([w for w in text.split() if w.strip()])
    span = (words[-1]["end"] - words[0]["start"]) if words else 0
    print(f"\n━━ {slug} [{lang}] — aligned in {secs:.1f}s")
    print(f"   text words {n_text} → aligned {len(words)} ({100*len(words)/max(1,n_text):.0f}% coverage)")
    print(f"   whisper words {len(wh)} | matched-word median start-delta {f'{med:.2f}s' if med is not None else 'n/a'} ({len(deltas)} matches)")
    print(f"   span {words[0]['start'] if words else 0:.1f}s → {words[-1]['end'] if words else 0:.1f}s (song {dur or '?'}s)")
    print(f"   first: {[ (w['text'], w['start']) for w in words[:4] ]}")
    print(f"   last:  {[ (w['text'], w['start']) for w in words[-4:] ]}")
print("\n✦ full timings in", OUT)
