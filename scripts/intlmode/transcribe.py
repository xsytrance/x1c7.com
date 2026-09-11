#!/usr/bin/env python3
"""International Mode — word-level timestamps off the lead vocal stem, via
NVIDIA Parakeet TDT 0.6B v3 (onnx-asr). Chosen over whisper specifically for
its near-zero hallucination-on-silence, since this song is almost entirely
repeated one-word chants on a chopped beat — the exact shape that breaks
whisper worst (see docs/VIDEO-RENDER-PLAYBOOK.md §16/§18/§19).

    ~/whisper-venv/bin/python scripts/intlmode/transcribe.py <in.mp3> <out.json>
"""
import sys, json, time

def main():
    src, dst = sys.argv[1], sys.argv[2]
    t0 = time.time()
    import onnx_asr
    print("loading model...", file=sys.stderr)
    model = onnx_asr.load_model(
        "nemo-parakeet-tdt-0.6b-v3",
        providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
    ).with_timestamps()
    print(f"loaded in {time.time() - t0:.1f}s", file=sys.stderr)

    t1 = time.time()
    result = model.recognize(src)
    print(f"transcribed in {time.time() - t1:.1f}s", file=sys.stderr)
    print(f"tokens: {result.tokens[:20]}", file=sys.stderr)
    print(f"timestamps: {result.timestamps[:20]}", file=sys.stderr)

    # Merge subword tokens into words: this tokenizer marks a word boundary
    # with a literal leading space on the token (not sentencepiece's usual
    # "▁") — anything else continues the previous word. Each word's end =
    # next word's start (or the last token's own timestamp + a short pad).
    words = []
    for tok, t in zip(result.tokens, result.timestamps):
        if tok.startswith(" ") or not words:
            words.append({"word": tok.strip(), "start": round(t, 3), "end": round(t, 3)})
        else:
            words[-1]["word"] += tok
            words[-1]["end"] = round(t, 3)
    for i in range(len(words) - 1):
        words[i]["end"] = words[i + 1]["start"]
    if words:
        words[-1]["end"] = round(words[-1]["end"] + 0.3, 3)

    out = {"text": result.text, "words": words}
    with open(dst, "w") as f:
        json.dump(out, f, indent=2)
    print(f"wrote {dst} ({len(words)} words)", file=sys.stderr)


if __name__ == "__main__":
    main()
