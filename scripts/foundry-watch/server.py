#!/usr/bin/env python3
"""
THE FOUNDRY WATCH — one page for what the Dominion's two GPUs are doing.

Serves on Portal 8720, bound to the Ley Lines (tailnet) so the Sovereign can
open it from the phone. Read-only: it reports, it never commands.

  the CURATOR  — curator-watch.service, reading on exxo's card
  the PAINTER  — lexicon-night.service, painting on PRIME's card, 00:00–05:00
  the FORGE    — the Timepiece Forge; awaiting the Sovereign's four answers

Article XVI: lead with the verdict, give every number a scale, say what a fact
MEANS. The theme may decorate; it may never obscure.
"""
import json, os, re, subprocess, threading, time, html
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOME = os.path.expanduser("~")
STATE = os.path.join(HOME, ".local/state")
REPO = os.path.join(HOME, "x1c7.com")
PORT = 8720

_cache, _lock = {}, threading.Lock()


def cached(key, ttl, fn):
    """Probes cost real time (ssh to exxo ~1s). Never make the page wait twice."""
    with _lock:
        hit = _cache.get(key)
        if hit and time.time() - hit[0] < ttl:
            return hit[1]
    try:
        val = fn()
    except Exception as e:
        val = {"error": str(e)}
    with _lock:
        _cache[key] = (time.time(), val)
    return val


def sh(cmd, timeout=12):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True,
                          timeout=timeout).stdout.strip()


def read_state(name):
    try:
        with open(os.path.join(STATE, name, "state.json")) as f:
            return json.load(f)
    except Exception:
        return {}


def unit_live(unit):
    # Type=oneshot sits in "activating" for the whole run and never reaches
    # "active" — matching only "active" would report every running job as idle.
    s = sh(f"systemctl --user show {unit} -p ActiveState --value")
    return s in ("active", "activating"), s


def next_run(timer):
    v = sh(f"systemctl --user show {timer} -p NextElapseUSecRealtime --value")
    return v or "not scheduled"


def exxo():
    out = sh("timeout 10 ssh -o BatchMode=yes exxo-1 "
             "'nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu,"
             "temperature.gpu,power.draw --format=csv,noheader,nounits'")
    if not out:
        return {"up": False}
    a = [x.strip() for x in out.split(",")]
    return {"up": True, "vram": int(a[0]), "vram_total": int(a[1]),
            "util": int(a[2]), "temp": int(a[3]), "watts": float(a[4])}


def prime_gpu():
    out = sh("nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu,"
             "temperature.gpu --format=csv,noheader,nounits", timeout=8)
    if not out:
        return {"up": False}
    a = [x.strip() for x in out.split(",")]
    return {"up": True, "vram": int(a[0]), "vram_total": int(a[1]),
            "util": int(a[2]), "temp": int(a[3])}


def corpus():
    try:
        shelf = json.load(open(os.path.join(REPO, "src/data/lexicon.json")))["stats"]
        idx = json.load(open(os.path.join(REPO, "scripts/curator/vision-index.json")))["images"]
        scored = [v for v in idx.values()
                  if isinstance((v.get("reading") or {}).get("wordMatch"), (int, float))]
        rejects = sum(1 for v in scored
                      if (v["reading"].get("quality") or 1) < 0.45
                      or v["reading"]["wordMatch"] < 0.35)
        return {"images": shelf["images"], "words": shelf["words"],
                "senses": shelf["senses"], "read": len(idx),
                "unread": max(0, shelf["images"] - len(idx)),
                "rejects": rejects, "scored": len(scored)}
    except Exception as e:
        return {"error": str(e)}


def regen_queue():
    try:
        p = os.path.join(REPO, "scripts/curator/.audit-regen.txt")
        return sum(1 for l in open(p) if l.strip())
    except Exception:
        return 0


def snapshot():
    cur_live, cur_raw = unit_live("curator-watch.service")
    pai_live, pai_raw = unit_live("lexicon-night.service")
    return {
        "at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "curator": {"live": cur_live, "raw": cur_raw, **read_state("curator-watch"),
                    "next": next_run("curator-watch.timer")},
        "painter": {"live": pai_live, "raw": pai_raw, **read_state("lexicon-night"),
                    "next": next_run("lexicon-night.timer")},
        "exxo": cached("exxo", 12, exxo),
        "prime": cached("prime", 12, prime_gpu),
        "corpus": cached("corpus", 90, corpus),
        "regen": cached("regen", 90, regen_queue),
    }


PAGE = r"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Foundry Watch</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spectral:wght@400;600&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --ground:#14120E;--surface:#1E1B15;--raised:#2A2620;--edge:#3A342A;
  --ink:#EDE6D6;--muted:#9C9282;--faint:#6E6657;
  --brass:#C9A227;--mint:#7FBF9E;--vermilion:#C4553D;
  --display:"Spectral",Georgia,serif;--body:"IBM Plex Sans",system-ui,sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,monospace;
}
*{box-sizing:border-box}
body{background:var(--ground);color:var(--ink);font-family:var(--body);
     margin:0;padding:0 clamp(14px,3vw,34px) 60px;line-height:1.5}
.wrap{max-width:1080px;margin:0 auto}
header{padding:clamp(26px,5vw,46px) 0 20px;border-bottom:1px solid var(--edge)}
.eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.22em;
  text-transform:uppercase;color:var(--brass);margin:0 0 10px}
h1{font-family:var(--display);font-weight:600;font-size:clamp(28px,5vw,44px);
   margin:0 0 10px;line-height:1.05}
.verdict{font-size:clamp(15px,2vw,17px);color:var(--muted);margin:0;max-width:60ch}
.verdict b{color:var(--ink);font-weight:500}

.jobs{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));
      gap:14px;margin:24px 0 0}
.job{background:var(--surface);border:1px solid var(--edge);border-radius:3px;
     padding:17px 18px;display:flex;flex-direction:column;gap:11px}
.job.on{border-color:rgba(127,191,158,.5)}
.job h2{font-family:var(--display);font-size:21px;font-weight:600;margin:0;
        display:flex;align-items:center;gap:9px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--faint);flex:none}
.job.on .dot{background:var(--mint);box-shadow:0 0 0 3px rgba(127,191,158,.18)}
.job.warn .dot{background:var(--vermilion)}
.status{font-family:var(--mono);font-size:11px;letter-spacing:.13em;
        text-transform:uppercase;color:var(--muted)}
.job.on .status{color:var(--mint)}
.job.warn .status{color:var(--vermilion)}
.doing{font-size:14.5px;color:var(--ink);margin:0}
.sub{font-size:12.5px;color:var(--faint);margin:0}
.bar{height:6px;border-radius:3px;background:var(--raised);overflow:hidden}
.bar i{display:block;height:100%;background:var(--brass)}
.kv{display:flex;gap:16px;flex-wrap:wrap;font-family:var(--mono);font-size:11.5px;
    color:var(--muted);font-variant-numeric:tabular-nums}
.kv b{color:var(--ink);font-weight:500}

h3{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;
   color:var(--faint);margin:30px 0 11px;font-weight:400}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
.card{background:var(--surface);border:1px solid var(--edge);border-radius:3px;padding:15px 16px}
.card .lab{font-family:var(--mono);font-size:10px;letter-spacing:.15em;
           text-transform:uppercase;color:var(--faint);margin:0 0 7px}
.card .val{font-family:var(--mono);font-size:24px;font-weight:500;margin:0;
           font-variant-numeric:tabular-nums}
.card .val small{font-size:12px;color:var(--muted)}
.card .note{font-size:12px;color:var(--faint);margin:6px 0 0}
.gauge{height:5px;border-radius:3px;background:var(--raised);margin-top:9px;overflow:hidden}
.gauge i{display:block;height:100%;background:var(--mint)}
.gauge.hot i{background:var(--vermilion)}
footer{margin-top:34px;padding-top:16px;border-top:1px solid var(--edge);
       font-family:var(--mono);font-size:11px;color:var(--faint);
       display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body><div class="wrap">
<header>
  <p class="eyebrow">The Dominion · both cards · live</p>
  <h1 id="head">…</h1>
  <p class="verdict" id="verdict">reading the estate…</p>
</header>

<div class="jobs" id="jobs"></div>

<h3>The corpus</h3>
<div class="cards" id="corpus"></div>

<h3>The cards</h3>
<div class="cards" id="gpus"></div>

<footer><span id="stamp">…</span><span>Portal 8720 · read-only</span></footer>
</div>
<script>
const $=id=>document.getElementById(id);
const n=v=>(v==null?"—":Number(v).toLocaleString("en-US"));
const esc=s=>String(s??"").replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));

function when(iso){
  if(!iso) return "";
  const d=new Date(iso); if(isNaN(d)) return "";
  const m=Math.floor((Date.now()-d)/60000);
  if(m<1) return "just now"; if(m<60) return m+"m ago";
  const h=Math.floor(m/60); return h<24? h+"h ago" : Math.floor(h/24)+"d ago";
}

function jobCard(o){
  const cls = o.live ? "job on" : (o.state==="failed" ? "job warn" : "job");
  let prog="";
  if(o.live && o.pct!=null) prog=`<div class="bar"><i style="width:${o.pct}%"></i></div>`;
  return `<div class="${cls}">
    <h2><span class="dot"></span>${esc(o.name)}</h2>
    <p class="status">${esc(o.status)} · ${esc(o.where)}</p>
    <p class="doing">${esc(o.doing)}</p>
    ${prog}
    <div class="kv">${o.kv.map(k=>`<span>${esc(k[0])} <b>${esc(k[1])}</b></span>`).join("")}</div>
    <p class="sub">${esc(o.sub)}</p></div>`;
}

function card(lab,val,note,gauge,hotAbove){
  let g="";
  if(gauge!=null){
    const hot = hotAbove!=null && gauge>hotAbove;   // only load/heat runs hot
    g=`<div class="gauge${hot?" hot":""}"><i style="width:${Math.min(100,gauge)}%"></i></div>`;
  }
  return `<div class="card"><p class="lab">${esc(lab)}</p><p class="val">${val}</p>${g}
    ${note?`<p class="note">${esc(note)}</p>`:""}</div>`;
}

async function tick(){
  let d; try{ d=await (await fetch("/api",{cache:"no-store"})).json(); }
  catch(e){ $("verdict").textContent="Cannot reach the Foundry Watch."; return; }

  const c=d.curator, p=d.painter, co=d.corpus||{}, working=[];
  if(c.live) working.push("the Curator");
  if(p.live) working.push("the Painter");

  $("head").textContent = working.length ? "The estate is working." : "All quiet.";
  $("verdict").innerHTML = working.length
    ? `<b>${working.join(" and ")}</b> ${working.length>1?"are":"is"} at work right now. Nothing needs you.`
    : `Neither card is busy. The Painter wakes at midnight; the Curator re-arms every 30 minutes. Nothing needs you.`;

  const readPct = co.read && (co.read+co.unread) ? 100*co.read/(co.read+co.unread) : null;
  $("jobs").innerHTML =
    jobCard({
      name:"The Curator", live:c.live, state:c.state,
      status: c.live ? (c.state==="standing-down"?"standing down":"reading") : (c.state==="failed"?"last pass failed":"idle"),
      where:"exxo · the Foundry",
      doing: c.live ? (c.detail||"reading the paintings")
                    : (c.detail? "Last pass: "+c.detail : "Waiting for the next pass."),
      pct: readPct,
      kv:[["read this pass",n(c.read)],["still unread",n(co.unread)]],
      sub: c.live ? "Started "+when(c.started)+" · grades every image against its own word"
                  : "Next pass "+(c.next||"—")
    }) +
    jobCard({
      name:"The Painter", live:p.live, state:p.state,
      status: p.live ? (p.state==="standing-down"?"standing down":"painting") : (p.state==="failed"?"last run failed":"idle"),
      where:"PRIME · the Citadel",
      doing: p.live ? (p.step||"working")
                    : (p.detail? "Last run: "+p.detail : "Sleeps until midnight."),
      pct:null,
      kv:[["painted",n(p.rendered)],["words queued to repaint",n(d.regen)]],
      sub: p.live ? "Started "+when(p.started)+" · stops by 05:00"
                  : "Next run "+(p.next||"—")
    });

  $("corpus").innerHTML =
    card("Images on the shelf", n(co.images), co.words? n(co.words)+" words · "+n(co.senses)+" senses":"") +
    // no hot threshold on progress: being 90% finished is good news, not an alarm
    card("Looked at", n(co.read), (readPct!=null? readPct.toFixed(1)+"% of the shelf":""), readPct) +
    card("Never looked at", n(co.unread), co.unread? "the Curator's remaining backlog":"the whole shelf has been read") +
    card("Below the floor", n(co.rejects), "wrong word or broken — queued to repaint");

  const gpu=(o,name,note)=> o && o.up
    ? card(name, o.util+"<small>% busy</small>",
        `${(o.vram/1024).toFixed(1)} of ${(o.vram_total/1024).toFixed(0)} GB · ${o.temp}°C${o.watts?" · "+o.watts.toFixed(0)+" W":""} — ${note}`,
        o.util, 85)
    : card(name,"—","unreachable");
  $("gpus").innerHTML =
    gpu(d.exxo,"exxo · RTX 3050","grades and, soon, forges") +
    gpu(d.prime,"PRIME · RTX 5060 Ti","paints, midnight to dawn");

  $("stamp").textContent="Updated "+d.at;
}
tick(); setInterval(tick,10000);
</script></body></html>"""


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, body, ctype):
        b = body.encode()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path.startswith("/api"):
            self._send(json.dumps(snapshot()), "application/json")
        elif self.path in ("/health", "/healthz"):
            self._send('{"ok":true}', "application/json")
        else:
            self._send(PAGE, "text/html; charset=utf-8")


if __name__ == "__main__":
    # Bind to the Ley Lines only — this page describes the estate and has no
    # business on the LAN. Loopback would block the phone.
    host = sh("tailscale ip -4 | head -1") or "127.0.0.1"
    print(f"the Foundry Watch → http://{host}:{PORT}", flush=True)
    ThreadingHTTPServer((host, PORT), H).serve_forever()
