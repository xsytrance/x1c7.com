import whisper, sys, json
S="/tmp/claude-1000/-home-xsyprime-Hermes-x1c7-com/62cfc091-be3c-44d4-9ef9-525967187a22/scratchpad"
OFF=195.0
m=whisper.load_model("large-v3")
for f,lang in (("tail-lead.wav","ja"),("tail-lead.wav","en"),("tail-back.wav","en")):
    r=m.transcribe(f"{S}/{f}", language=lang, word_timestamps=True,
                   condition_on_previous_text=False, temperature=0.0, no_speech_threshold=0.9)
    print(f"\n===== {f}  lang={lang} =====")
    for s in r["segments"]:
        print(f'{s["start"]+OFF:7.2f} {s["end"]+OFF:7.2f}  {s["text"].strip()}')
