import numpy as np, subprocess
P="scripts/song-analysis/profiles/osaka-after-dark"; SR=16000
def load(f):
    return np.frombuffer(subprocess.run(["ffmpeg","-v","error","-i",f,"-f","f32le","-ac","1","-ar",str(SR),"-"],capture_output=True).stdout,dtype=np.float32)
L=load(f"{P}/stems-src/0 Lead Vocals.mp3"); m=load(f"{P}/master.wav")
def db(x,t,w=0.10):
    a=int(t*SR); b=int((t+w)*SR); s=x[a:b]
    return 20*np.log10(np.sqrt(np.mean(s**2))+1e-9) if len(s) else -180
print("voiced spans on LEAD (>= -45 dB, 100ms) from 195s:")
spans=[];cur=None
for t in np.arange(195,220.6,0.05):
    on = db(L,t) > -45
    if on and cur is None: cur=t
    if not on and cur is not None:
        if t-cur>0.15: spans.append((cur,t))
        cur=None
if cur: spans.append((cur,220.6))
for a,b in spans: print(f"  {a:7.2f} -> {b:7.2f}  ({b-a:.2f}s)  peak {max(db(L,x) for x in np.arange(a,b,0.05)):.0f} dB")
print("\nMASTER level, 0.5s steps, 200-220.7:")
for t in np.arange(200,220.7,0.5): print(f"  {t:6.1f}  {db(m,t,0.5):6.1f}")
