import whisper, numpy as np, subprocess
S="/tmp/claude-1000/-home-xsyprime-Hermes-x1c7-com/62cfc091-be3c-44d4-9ef9-525967187a22/scratchpad"
m=whisper.load_model("large-v3")
for lang in ("ja","en"):
    r=m.transcribe(f"{S}/t3.wav",language=lang,word_timestamps=True,temperature=0.0,
                   condition_on_previous_text=False,no_speech_threshold=0.99,logprob_threshold=-3.0)
    print(f"--- {lang}")
    for s in r["segments"]: print(f'  {s["start"]+208:7.2f} {s["end"]+208:7.2f} {s["text"].strip()} (ns {s["no_speech_prob"]:.2f})')
# spectral: voice-like? f0 + centroid
import librosa
y,sr=librosa.load(f"{S}/t3.wav",sr=16000)
f0,vf,vp=librosa.pyin(y,fmin=80,fmax=600,sr=sr,frame_length=1024)
print("\nvoiced frames:",int(np.nansum(vf)),"/",len(vf),
      " median f0:",np.nanmedian(f0),"Hz")
cen=librosa.feature.spectral_centroid(y=y,sr=sr)[0]
print("spectral centroid median:",int(np.median(cen)),"Hz")
