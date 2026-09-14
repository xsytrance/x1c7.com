#!/usr/bin/env python3
"""Days Drift By — lead-vocal transcript via NVIDIA Parakeet TDT 0.6b-v3.

Per the kinetica-video-cut skill §3b: load_model(...).with_timestamps(), then
.recognize(path). The result's .tokens/.timestamps are PARALLEL TOKEN-level
lists, not words — this tokenizer marks a word boundary with a literal leading
space on the token. Merge here. Input must be a real wav (stdlib `wave`).

    python3 scripts/ddb/transcribe.py <lead.wav> <out.json>
"""
import json, sys
import onnx_asr

src, dst = sys.argv[1], sys.argv[2]
model = onnx_asr.load_model("nemo-parakeet-tdt-0.6b-v3").with_timestamps()
res = model.recognize(src)

words, cur, cur_t = [], "", None
for tok, t in zip(res.tokens, res.timestamps):
    if tok.startswith(" ") or cur == "":
        if cur.strip():
            words.append({"w": cur.strip(), "start": round(cur_t, 3)})
        cur, cur_t = tok, t
    else:
        cur += tok
if cur.strip():
    words.append({"w": cur.strip(), "start": round(cur_t, 3)})
# a word's end = the next word's start
for i, w in enumerate(words):
    w["end"] = words[i + 1]["start"] if i + 1 < len(words) else round(w["start"] + 0.4, 3)

json.dump({"text": res.text, "words": words}, open(dst, "w"), indent=1)
print(f"{len(words)} words -> {dst}")
print(res.text[:500])
