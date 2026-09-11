import numpy as np, subprocess, sys, os
P="scripts/song-analysis/profiles/osaka-after-dark"
SR=16000
def load(f):
    raw=subprocess.run(["ffmpeg","-v","error","-i",f,"-f","f32le","-ac","1","-ar",str(SR),"-"],
                       capture_output=True).stdout
    return np.frombuffer(raw,dtype=np.float32)
stems={n:load(f"{P}/stems-src/{n}") for n in sorted(os.listdir(f"{P}/stems-src"))}
master=load(f"{P}/master.wav")
print("master samples",len(master),len(master)/SR)
HOP=int(SR*0.05)  # 50ms
def env(x):
    n=len(x)//HOP
    e=np.array([np.sqrt(np.mean(x[i*HOP:(i+1)*HOP]**2)) for i in range(n)])
    return 20*np.log10(e+1e-9)
E={k:env(v) for k,v in stems.items()}
Em=env(master)
# cross-correlate master vs sum-of-stems envelope for drift
mix=np.zeros(max(len(v) for v in stems.values()),dtype=np.float64)
for v in stems.values(): mix[:len(v)]+=v
Emix=env(mix.astype(np.float32))
n=min(len(Em),len(Emix))
a=Em[:n]-Em[:n].mean(); b=Emix[:n]-Emix[:n].mean()
# global lag
c=np.correlate(a,b,"full"); lag=(c.argmax()-(n-1))*0.05
print(f"global stem->master lag {lag:+.3f}s  score {c.max()/np.sqrt((a**2).sum()*(b**2).sum()):.3f}")
# windowed drift
print("windowed lag (s):", end=" ")
for s in range(0,int(n*0.05)-30,30):
    i0,i1=int(s/0.05),int((s+30)/0.05)
    aa=a[i0:i1]-a[i0:i1].mean(); bb=b[i0:i1]-b[i0:i1].mean()
    cc=np.correlate(aa,bb,"full"); print(f"{s}s:{(cc.argmax()-(len(aa)-1))*0.05:+.2f}",end=" ")
print()
np.save("/tmp/claude-1000/-home-xsyprime-Hermes-x1c7-com/62cfc091-be3c-44d4-9ef9-525967187a22/scratchpad/env.npy",
        np.array([np.pad(E[k],(0,max(0,len(Em)-len(E[k]))))[:len(Em)] for k in E]+[Em]))
print("stem order:", list(E.keys()))
# print a coarse map every 2s of key stems
names=list(E.keys())
print("\n  t   " + "".join(f"{n.split()[1][:5]:>7s}" for n in names) + "  MASTER")
for t in range(0,int(len(Em)*0.05),2):
    i=int(t/0.05)
    row="".join(f"{E[n][i]:7.0f}" for n in names)
    print(f"{t:5d} {row} {Em[i]:7.0f}")
