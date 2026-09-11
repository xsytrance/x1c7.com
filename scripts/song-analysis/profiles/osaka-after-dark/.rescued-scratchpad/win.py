import numpy as np, subprocess, os
P="scripts/song-analysis/profiles/osaka-after-dark"; SR=16000
def load(f):
    return np.frombuffer(subprocess.run(["ffmpeg","-v","error","-i",f,"-f","f32le","-ac","1","-ar",str(SR),"-"],capture_output=True).stdout,dtype=np.float32)
m=load(f"{P}/master.wav"); L=load(f"{P}/stems-src/0 Lead Vocals.mp3"); B=load(f"{P}/stems-src/1 Backing Vocals.mp3")
D=load(f"{P}/stems-src/2 Drums.mp3"); Ba=load(f"{P}/stems-src/3 Bass.mp3")
def sm(x,win=1.0):
    h=int(SR*0.1); n=len(x)//h
    e=np.array([np.sqrt(np.mean(x[i*h:(i+1)*h]**2)) for i in range(n)])
    k=int(win/0.1); e=np.convolve(e,np.ones(k)/k,'same')
    return 20*np.log10(e+1e-9)
Em,EL,EB,ED,EBa=sm(m),sm(L),sm(B),sm(D),sm(Ba)
print("  t     MSTR   LEAD   BACK   DRUM   BASS")
for t in np.arange(0,220,1.0):
    i=int(t/0.1)
    def g(e): return e[i] if i<len(e) else -180
    print(f"{t:6.0f} {g(Em):6.1f} {g(EL):6.1f} {g(EB):6.1f} {g(ED):6.1f} {g(EBa):6.1f}")
