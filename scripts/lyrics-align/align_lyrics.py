#!/usr/bin/env python3
"""
Forced-align known lyrics to a song's audio and emit LRC.

Input JSON:  [{ "id": str, "audio_url": str, "lyrics": str, "language": str|null }, ...]
Output JSON: [{ "id", "lrc", "words": [{"t","text"}], "language", "n_lines", "n_timed", "ok", "error" }, ...]

Pipeline per track:
  1. download audio_url -> mp3
  2. (optional) Demucs vocal isolation -> vocals.wav
  3. stable-ts forced alignment of the KNOWN lyric lines (original_split -> one segment per line)
  4. line start times -> LRC ; word times -> words[]

The caller (Claude) writes lrc back to Supabase tracks.lyrics via MCP.
"""
import argparse, json, os, re, subprocess, sys, tempfile, urllib.request, traceback

HEADER = re.compile(r"^\[.*\]$")

def log(*a): print(*a, file=sys.stderr, flush=True)

def syncable(line: str) -> bool:
    s = line.strip()
    return bool(s) and not HEADER.match(s)

def to_lrc(sec: float) -> str:
    if sec < 0: sec = 0.0
    mm = int(sec // 60); ss = int(sec % 60); cs = int(round((sec - int(sec)) * 100))
    if cs == 100: ss += 1; cs = 0
    return f"[{mm:02d}:{ss:02d}.{cs:02d}]"

def download(url: str, dst: str):
    req = urllib.request.Request(url, headers={"User-Agent": "x1c7-align/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dst, "wb") as f:
        f.write(r.read())

def isolate_vocals(mp3: str, workdir: str) -> str:
    """Demucs two-stem vocal isolation. Returns path to vocals.wav (or the mix on failure)."""
    try:
        out = os.path.join(workdir, "demucs")
        subprocess.run(
            [sys.executable, "-m", "demucs", "--two-stems=vocals", "-n", "htdemucs",
             "-o", out, mp3],
            check=True, capture_output=True, timeout=1200,
        )
        stem = os.path.splitext(os.path.basename(mp3))[0]
        voc = os.path.join(out, "htdemucs", stem, "vocals.wav")
        if os.path.exists(voc):
            return voc
    except Exception as e:
        log("  demucs failed, aligning on full mix:", e)
    return mp3

def align_track(model, t: dict, use_demucs: bool) -> dict:
    tid = t["id"]
    res = {"id": tid, "lrc": None, "words": [], "language": None,
           "n_lines": 0, "n_timed": 0, "ok": False, "error": None}
    try:
        lines = t["lyrics"].replace("\r\n", "\n").replace("\r", "\n").split("\n")
        sync_lines = [ln for ln in lines if syncable(ln)]
        res["n_lines"] = len(sync_lines)
        if not sync_lines:
            res["error"] = "no syncable lines"; return res

        with tempfile.TemporaryDirectory() as wd:
            mp3 = os.path.join(wd, "audio.mp3")
            log(f"  downloading {tid} …"); download(t["audio_url"], mp3)
            audio = isolate_vocals(mp3, wd) if use_demucs else mp3

            text = "\n".join(sync_lines)  # one line per segment via original_split
            log(f"  aligning {tid} ({len(sync_lines)} lines) …")
            r = model.align(audio, text, language=t.get("language"), original_split=True)

            res["language"] = getattr(r, "language", None) or t.get("language")
            segs = r.segments
            # Map aligned segments back to sync_lines in order.
            starts = [getattr(s, "start", None) for s in segs]
            # Build LRC over the ORIGINAL lines (headers/blanks passed through).
            out, si = [], 0
            for ln in lines:
                if syncable(ln) and si < len(starts) and starts[si] is not None:
                    out.append(to_lrc(float(starts[si])) + ln.strip()); si += 1
                elif syncable(ln):
                    out.append(ln.strip()); si += 1
                else:
                    out.append(ln.rstrip())
            res["lrc"] = "\n".join(out)
            res["n_timed"] = sum(1 for s in starts if s is not None)
            for w in r.all_words():
                res["words"].append({"t": round(float(w.start), 3), "text": w.word.strip()})
            res["ok"] = res["n_timed"] > 0
    except Exception as e:
        res["error"] = f"{e}"; log("  ERROR", tid, traceback.format_exc())
    return res

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", dest="out", required=True)
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--compute-type", default="float16")
    ap.add_argument("--no-demucs", action="store_true")
    args = ap.parse_args()

    import stable_whisper
    log(f"loading model {args.model} on {args.device} …")
    try:
        model = stable_whisper.load_faster_whisper(args.model, device=args.device, compute_type=args.compute_type)
    except Exception as e:
        log("cuda load failed, falling back to CPU:", e)
        model = stable_whisper.load_faster_whisper(args.model, device="cpu", compute_type="int8")

    tracks = json.load(open(args.inp))
    results = []
    for i, t in enumerate(tracks, 1):
        log(f"[{i}/{len(tracks)}] {t['id']}")
        results.append(align_track(model, t, use_demucs=not args.no_demucs))
        json.dump(results, open(args.out, "w"), ensure_ascii=False, indent=2)  # checkpoint each
    ok = sum(1 for r in results if r["ok"])
    log(f"done: {ok}/{len(results)} aligned -> {args.out}")

if __name__ == "__main__":
    main()
