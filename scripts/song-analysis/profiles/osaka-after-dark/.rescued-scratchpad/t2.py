import whisper
S="/tmp/claude-1000/-home-xsyprime-Hermes-x1c7-com/62cfc091-be3c-44d4-9ef9-525967187a22/scratchpad"
m=whisper.load_model("large-v3")
for lang in ("en","ja",None):
    r=m.transcribe(f"{S}/t2.wav", language=lang, word_timestamps=True,
                   condition_on_previous_text=False, temperature=0.0, no_speech_threshold=0.95, logprob_threshold=-2.0)
    print(f"--- lang={lang} detected={r.get('language')}")
    for s in r["segments"]:
        print(f'  {s["start"]+206:7.2f} {s["end"]+206:7.2f}  {s["text"].strip()}  (nospeech {s["no_speech_prob"]:.2f})')
