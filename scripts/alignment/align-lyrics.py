#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# ALIGN LYRICS (Tier A) — official text + lead stem → measured word timings.
#
# For every profile with OFFICIAL lyrics and a local lead stem: windowed
# committed-prefix alignment with Qwen3-ForcedAligner (the model sees ~200s
# per pass), ffmpeg decoding (libsndfile silently truncates Suno MP3s), and
# a QA gate — clumps (>6 words sharing one timestamp) mark text the audio
# never sings; too much clump = flagged, never auto-applied.
#
#   ~/whisper-venv/bin/python scripts/alignment/align-lyrics.py \
#     [--only slug,slug] [--force]
#
# Output: profiles/<slug>/aligned.json {v, language, qa, words:[{t,w}], lrc}
# Apply with scripts/alignment/apply-aligned.mjs (guarded, journaled).
# ═══════════════════════════════════════════════════════════════════════════
import json, re, subprocess, sys, time
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PROFILES = REPO / "scripts" / "song-analysis" / "profiles"
STEMS = REPO / "assets" / "suno" / "stems"

WINDOW, MARGIN, SR = 160.0, 20.0, 16000
CLUMP_MIN = 7          # words sharing one start = a clump
CLUMP_RATIO_MAX = 0.12 # above this, the track is flagged, not applied

LANG = {"english": "English", "spanish": "Spanish", "japanese": "Japanese",
        "korean": "Korean", "french": "French", "german": "German",
        "italian": "Italian", "portuguese": "Portuguese", "russian": "Russian",
        "chinese": "Chinese", "cantonese": "Cantonese"}

args = sys.argv[1:]
FORCE = "--force" in args
only = None
if "--only" in args:
    only = set(args[args.index("--only") + 1].split(","))

CJK = re.compile(r"[぀-ヿ㐀-鿿가-힯]")
def join_tokens(toks):
    out = ""
    for t in toks:
        if out and not (CJK.search(t[:1]) or CJK.search(out[-1:])):
            out += " "
        out += t
    return out

def load_audio(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "pipe:1"],
        capture_output=True, check=True).stdout
    import numpy as np
    return np.frombuffer(raw, dtype=np.float32)

def align_windowed(aligner, path, text, lang):
    audio = load_audio(path)
    dur = len(audio) / SR
    committed, cursor, remaining, passes = [], 0.0, text, 0
    while remaining.strip() and passes < 10:
        passes += 1
        end = min(cursor + WINDOW, dur)
        chunk = audio[int(cursor * SR):int(end * SR)]
        res = aligner.align(audio=(chunk, SR), text=remaining, language=lang)
        words = [(w.text, w.start_time + cursor, w.end_time + cursor) for w in res[0]]
        last = end >= dur - 0.5
        limit = end if last else end - MARGIN
        take = 0
        for _, s, e in words:
            if e < limit: take += 1
            else: break
        if take == 0:
            if last: committed.extend(words); break
            cursor = end - MARGIN
            continue
        committed.extend(words[:take])
        if last and take == len(words): break
        remaining = join_tokens([w[0] for w in words[take:]])
        cursor = committed[-1][2]
        if last:
            committed.extend((t, dur, dur) for t in remaining.split())
            break
    return committed, dur, passes

def build_lrc(lines, words):
    # walk aligned tokens through the original lines by normalized prefix match
    norm = lambda s: re.sub(r"[^\w]+", "", s.lower(), flags=re.UNICODE)
    lrc, wi = [], 0
    for line in lines:
        target = norm(line)
        if not target: continue
        start = None
        acc = ""
        while wi < len(words) and len(acc) < len(target):
            tok = norm(words[wi][0])
            if start is None and tok: start = words[wi][1]
            acc += tok
            wi += 1
        if start is None: continue
        m, s = divmod(start, 60)
        lrc.append(f"[{int(m):02d}:{s:05.2f}]{line.strip()}")
    return "\n".join(lrc) + "\n"

def qa_score(words, dur):
    starts = Counter(round(s, 2) for _, s, _ in words)
    clumps = [{"t": t, "n": n} for t, n in starts.items() if n >= CLUMP_MIN]
    clumped = sum(c["n"] for c in clumps)
    ratio = clumped / max(1, len(words))
    span = words[-1][2] - words[0][1] if words else 0
    return {
        "words": len(words), "clumps": sorted(clumps, key=lambda c: -c["n"])[:8],
        "clumpedWords": clumped, "clumpRatio": round(ratio, 3),
        "span": round(span, 1), "duration": round(dur, 1),
        "pass": ratio <= CLUMP_RATIO_MAX and len(words) > 20,
    }

candidates = []
for d in sorted(PROFILES.iterdir()):
    pf = d / "profile.json"
    if not pf.is_file(): continue
    if only and d.name not in only: continue
    p = json.loads(pf.read_text())
    if not p.get("lyrics", {}).get("official"): continue
    stem = STEMS / d.name / "0 Lead Vocals.mp3"
    if not stem.exists():
        print(f"— {d.name}: official lyrics but no lead stem (skipped)"); continue
    if (d / "aligned.json").exists() and not FORCE:
        print(f"· {d.name}: aligned.json exists (skip, --force to redo)"); continue
    lang = LANG.get(str(p["lyrics"].get("language") or p.get("identity", {}).get("language") or "english").lower())
    if not lang:
        print(f"— {d.name}: language {p['lyrics'].get('language')!r} unsupported by aligner (flag for MMS fallback)"); continue
    candidates.append((d.name, stem, p, lang))

if not candidates:
    print("nothing to align"); sys.exit(0)

print(f"aligning {len(candidates)} tracks…", flush=True)
import torch
from qwen_asr import Qwen3ForcedAligner
aligner = Qwen3ForcedAligner.from_pretrained(
    "Qwen/Qwen3-ForcedAligner-0.6B", dtype=torch.bfloat16, device_map="cuda:0")

ok = flagged = failed = 0
for slug, stem, p, lang in candidates:
    lines = [l for l in p["lyrics"]["text"].splitlines() if not re.fullmatch(r"\s*\[[^\]]*\]\s*", l)]
    text = "\n".join(lines).strip()
    t0 = time.time()
    try:
        words, dur, passes = align_windowed(aligner, stem, text, lang)
    except Exception as e:
        failed += 1; print(f"✘ {slug}: {e}"); continue
    qa = qa_score(words, dur)
    out = {
        "v": 1, "language": lang, "qa": qa,
        "words": [{"t": round(s, 2), "w": t} for t, s, _ in words],
        "lrc": build_lrc(lines, words),
    }
    (PROFILES / slug / "aligned.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    tag = "✔" if qa["pass"] else "⚠ FLAGGED"
    if qa["pass"]: ok += 1
    else: flagged += 1
    print(f"{tag} {slug} [{lang}] — {qa['words']}w, clump {qa['clumpRatio']:.0%}, span {qa['span']}/{qa['duration']}s, {passes} passes, {time.time()-t0:.1f}s", flush=True)

print(f"\nDONE — {ok} pass, {flagged} flagged, {failed} failed")
