import numpy as np, subprocess, json, sys
P="scripts/song-analysis/profiles/osaka-after-dark"; SR=16000
def load(f): return np.frombuffer(subprocess.run(["ffmpeg","-v","error","-i",f,"-f","f32le","-ac","1","-ar",str(SR),"-"],capture_output=True).stdout,dtype=np.float32)
L=load(f"{P}/stems-src/0 Lead Vocals.mp3"); B=load(f"{P}/stems-src/1 Backing Vocals.mp3")
def db(x,t,w=0.18):
    s=x[int(t*SR):int((t+w)*SR)]
    return 20*np.log10(np.sqrt(np.mean(s**2))+1e-9) if len(s) else -180
j=json.load(open(f"{P}/whisper-lead.json"))
print(f"{'t':>8} {'word':<12} {'p':>5} {'LEAD':>7} {'BACK':>7}")
for s in j["segments"]:
    if s["end"]<158 or s["start"]>210: continue
    for w in s.get("words",[]):
        t=w["start"]
        dl,dbk=db(L,t),db(B,t)
        flag="  <-- PARKED" if dl<-42 and dbk<-42 else ""
        print(f"{t:8.2f} {w['word'].strip():<12} {w.get('probability',0):5.2f} {dl:7.1f} {dbk:7.1f}{flag}")
