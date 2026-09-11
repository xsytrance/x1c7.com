import numpy as np, librosa, subprocess
P="scripts/song-analysis/profiles/osaka-after-dark"; SR=22050
raw=subprocess.run(["ffmpeg","-v","error","-i",f"{P}/stems-src/0 Lead Vocals.mp3","-f","f32le","-ac","1","-ar",str(SR),"-"],capture_output=True).stdout
L=np.frombuffer(raw,dtype=np.float32).copy()
a,b=159.5,168.0
seg=L[int(a*SR):int(b*SR)]
env=librosa.onset.onset_strength(y=seg,sr=SR)
for delta,wait in ((0.05,3),(0.08,4)):
    on=librosa.onset.onset_detect(onset_envelope=env,sr=SR,units='time',backtrack=True,delta=delta,wait=wait)
    print(f"delta={delta} wait={wait}:")
    print("  "+" ".join(f"{t+a:.2f}" for t in on))
# fine RMS to show the syllable pulse
print("\nRMS 163.5-167.5 @25ms:")
S=16000
raw2=subprocess.run(["ffmpeg","-v","error","-i",f"{P}/stems-src/0 Lead Vocals.mp3","-f","f32le","-ac","1","-ar",str(S),"-"],capture_output=True).stdout
L2=np.frombuffer(raw2,dtype=np.float32)
prev=None
for t in np.arange(163.5,167.5,0.025):
    s=L2[int(t*S):int((t+0.025)*S)]
    d=20*np.log10(np.sqrt(np.mean(s**2))+1e-9)
    bar="#"*max(0,int((d+60)/2))
    print(f"  {t:7.3f} {d:6.1f} {bar}")
