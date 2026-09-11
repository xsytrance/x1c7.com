import numpy as np, librosa, subprocess
P="scripts/song-analysis/profiles/osaka-after-dark"; SR=22050
y,_=librosa.load(f"{P}/master.wav",sr=SR)
tempo,beats=librosa.beat.beat_track(y=y,sr=SR,units='time',start_bpm=98)
print("tempo",float(np.atleast_1d(tempo)[0]))
b=[t for t in beats if 155<=t<=172]
print("beats 155-172:", " ".join(f"{t:.2f}" for t in b))
print("beat spacing:", np.median(np.diff(beats)))
# vocal onsets on the lead stem in the litany
raw=subprocess.run(["ffmpeg","-v","error","-i",f"{P}/stems-src/0 Lead Vocals.mp3","-f","f32le","-ac","1","-ar",str(SR),"-"],capture_output=True).stdout
L=np.frombuffer(raw,dtype=np.float32).copy()
for a,bb in ((154.8,167.0),(198.0,221.0)):
    seg=L[int(a*SR):int(bb*SR)]
    on=librosa.onset.onset_detect(y=seg,sr=SR,units='time',backtrack=True,delta=0.12,wait=6)
    print(f"\nlead onsets {a}-{bb}:")
    print("  "+" ".join(f"{t+a:.2f}" for t in on))
