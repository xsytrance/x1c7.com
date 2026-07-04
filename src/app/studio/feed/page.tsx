"use client";

// ═══════════════════════════════════════════════════════════════════════════
// FEED THE PLANET — the owner's gravitational feed. Pick a planet, drop a
// reference image + a prompt, and ComfyUI generates guided art from it that
// becomes the planet's star. The album art is the event horizon; the auto
// gallery is the secondary satellite. OWNER-ONLY: gated to private hosts
// (localhost + Tailscale) — the public site shows a locked screen, and the API
// 403s anywhere else. It also needs local ComfyUI + R2 creds, which the deploy
// doesn't have.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import { useTracks } from "@/lib/useTracks";
import { canPerform } from "@/components/KineticStage";
import { isPrivateHost } from "@/lib/privateHost";
import { BackToHub } from "@/components/BackToHub";

/* eslint-disable @next/next/no-img-element */

const R2 = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";

type Guided = { images: string[]; feeds: { prompt: string; ref: string; images: string[] }[] };

export default function FeedPage() {
  const { tracks } = useTracks();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => { setAllowed(isPrivateHost(window.location.hostname)); }, []);

  const planets = useMemo(() => tracks.filter(canPerform), [tracks]);
  const [slug, setSlug] = useState<string | null>(null);
  const sel = planets.find((p) => p.id === slug) || null;

  const [guided, setGuided] = useState<Guided | null>(null);
  const loadGuided = (s: string) =>
    fetch(`${R2}/planets/${s}/guided.json?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => setGuided(g ? { images: g.images || [], feeds: g.feeds || [] } : { images: [], feeds: [] }))
      .catch(() => setGuided({ images: [], feeds: [] }));
  useEffect(() => { if (slug) { setGuided(null); loadGuided(slug); } }, [slug]);

  const [image, setImage] = useState<string | null>(null); // downscaled data URL
  const [prompt, setPrompt] = useState("");
  const [n, setN] = useState(4);
  const [denoise, setDenoise] = useState(0.62);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 1152 / img.width);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d")?.drawImage(img, 0, 0, w, h);
      setImage(c.toDataURL("image/jpeg", 0.9));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const feed = async () => {
    if (!slug || !image || !prompt.trim() || busy) return;
    setBusy(true); setMsg("feeding the planet… img2img can take a minute — keep this tab open.");
    try {
      const r = await fetch("/api/feed", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, image, prompt, n, denoise }),
      });
      const j = await r.json();
      if (!r.ok) setMsg("✗ " + (j.error || "failed") + (j.detail ? ` — ${j.detail}` : ""));
      else { setMsg(`✦ fed ${n} guided images into ${sel?.title}`); setImage(null); setPrompt(""); if (j.guided) setGuided({ images: j.guided.images || [], feeds: j.guided.feeds || [] }); else loadGuided(slug); }
    } catch (e) { setMsg("✗ " + String(e)); }
    setBusy(false);
  };

  const clearGuided = async () => {
    if (!slug || busy || !window.confirm("Clear this planet's guided collection? It falls back to its auto gallery.")) return;
    setBusy(true); setMsg("clearing…");
    try {
      const r = await fetch("/api/feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, clear: true }) });
      const j = await r.json();
      if (r.ok) { setGuided({ images: [], feeds: [] }); setMsg("✦ cleared — back to the auto gallery"); }
      else setMsg("✗ " + (j.error || "failed"));
    } catch (e) { setMsg("✗ " + String(e)); }
    setBusy(false);
  };

  if (allowed === null) return <main className="min-h-screen bg-void" />;
  if (allowed === false) {
    return (
      <main className="grid min-h-screen place-items-center bg-void px-6 text-center">
        <div>
          <p className="font-display text-5xl font-black uppercase tracking-tight text-white/80">🕳️ Owner only</p>
          <p className="mt-3 font-mono text-sm text-white/40">The gravitational feed is only reachable from the owner&apos;s own machine.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-void px-4 py-10 sm:px-8">
      <BackToHub />
      <header className="mx-auto mt-6 max-w-5xl text-center">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight text-white sm:text-6xl glow-text" style={{ color: "var(--theme-primary)" }}>Feed the Planet</h1>
        <p className="mx-auto mt-3 max-w-xl text-white/55">
          Drop a reference image + a prompt. The planet pulls it in — img2img generates a
          <b className="text-white/80"> guided</b> collection that becomes its star. The album art is the
          event horizon; the auto gallery stays the satellite.
        </p>
      </header>

      {/* planet picker */}
      <div className="mx-auto mt-8 flex max-w-5xl flex-wrap justify-center gap-2">
        {planets.map((p) => (
          <button key={p.id} onClick={() => setSlug(p.id)}
            className={`rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition ${slug === p.id ? "border-white/60 bg-white/10 text-white" : "border-white/15 text-white/55 hover:text-white"}`}>
            {p.title}
          </button>
        ))}
      </div>

      {sel && (
        <div className="mx-auto mt-8 grid max-w-5xl gap-6 md:grid-cols-2">
          {/* left: the feed form */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">Event horizon</p>
            {sel.cover
              ? <img src={sel.cover} alt="" className="mt-2 h-40 w-full rounded-xl object-cover ring-1 ring-white/10" />
              : <div className="mt-2 grid h-40 place-items-center rounded-xl bg-white/5 text-white/30">no album art</div>}

            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">Feed a reference</p>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
              className="mt-2 grid h-40 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-white/20 bg-white/[0.02] text-center transition hover:border-white/40"
            >
              {image
                ? <img src={image} alt="" className="h-full w-full object-cover" />
                : <span className="px-4 font-mono text-xs text-white/40">drop an image or click to choose</span>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />

            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
              placeholder="prompt to guide the generation — e.g. 'neon rooftop bar, rain, cinematic'"
              className="mt-3 w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none" />

            <div className="mt-3 flex items-center gap-4 font-mono text-[11px] text-white/50">
              <label className="flex items-center gap-2">count
                <input type="number" min={1} max={12} value={n} onChange={(e) => setN(Math.min(12, Math.max(1, +e.target.value || 1)))} className="w-14 rounded border border-white/15 bg-white/[0.03] px-2 py-1 text-white" />
              </label>
              <label className="flex flex-1 items-center gap-2">guidance {(1 - denoise).toFixed(2)}
                <input type="range" min={0.2} max={0.9} step={0.02} value={denoise} onChange={(e) => setDenoise(+e.target.value)} className="flex-1" />
              </label>
            </div>

            <button onClick={feed} disabled={busy || !image || !prompt.trim()}
              className="mt-4 w-full rounded-full px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-void transition disabled:opacity-40"
              style={{ background: "var(--theme-primary)" }}>
              {busy ? "feeding…" : "⭑ feed the planet"}
            </button>
            {msg && <p className="mt-3 text-center font-mono text-[11px] text-white/60">{msg}</p>}
          </div>

          {/* right: the guided star collection */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                Guided star · {guided?.images.length ?? "…"} image{guided?.images.length === 1 ? "" : "s"}
              </p>
              {guided && guided.images.length > 0 && (
                <button onClick={clearGuided} disabled={busy} className="font-mono text-[10px] uppercase tracking-wider text-white/40 transition hover:text-red-300 disabled:opacity-40">clear</button>
              )}
            </div>
            {guided === null ? (
              <p className="mt-4 font-mono text-xs text-white/30">loading…</p>
            ) : guided.images.length === 0 ? (
              <p className="mt-4 font-mono text-xs text-white/30">nothing fed yet — this planet still runs on its auto gallery.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[...guided.images].reverse().map((u, i) => (
                  <img key={i} src={u} alt="" loading="lazy" className="aspect-video w-full rounded-lg object-cover ring-1 ring-white/10" />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
