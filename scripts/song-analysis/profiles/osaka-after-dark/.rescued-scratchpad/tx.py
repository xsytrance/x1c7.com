import whisper, json, sys
P="scripts/song-analysis/profiles/osaka-after-dark"
model_name=sys.argv[1]; stem=sys.argv[2]; out=sys.argv[3]
m=whisper.load_model(model_name)
r=m.transcribe(f"{P}/stems-src/{stem}", language="en", word_timestamps=True,
               condition_on_previous_text=False, temperature=0.0)
json.dump(r, open(f"{P}/{out}", "w"), indent=1)
for s in r["segments"]:
    print(f'{s["start"]:7.2f} {s["end"]:7.2f}  {s["text"].strip()}')
