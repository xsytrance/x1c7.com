import numpy as np, subprocess, sys
P="scripts/song-analysis/profiles/osaka-after-dark"; SR=16000
L=np.frombuffer(subprocess.run(["ffmpeg","-v","error","-i",f"{P}/stems-src/0 Lead Vocals.mp3","-f","f32le","-ac","1","-ar",str(SR),"-"],capture_output=True).stdout,dtype=np.float32)
a,b,thr=float(sys.argv[1]),float(sys.argv[2]),float(sys.argv[3]) if len(sys.argv)>3 else -42
def db(t,w=0.05):
    s=L[int(t*SR):int((t+w)*SR)]
    return 20*np.log10(np.sqrt(np.mean(s**2))+1e-9) if len(s) else -180
spans=[];cur=None
for t in np.arange(a,b,0.01):
    on=db(t)>thr
    if on and cur is None: cur=t
    if not on and cur is not None:
        if t-cur>=0.10: spans.append((cur,t))
        cur=None
if cur: spans.append((cur,b))
prev=None
for s,e in spans:
    gap=f" gap {s-prev:.2f}" if prev else ""
    print(f"  {s:7.2f} -> {e:7.2f}  ({e-s:.2f}s){gap}")
    prev=e
