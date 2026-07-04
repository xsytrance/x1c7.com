"use client";

// ═══════════════════════════════════════════════════════════════════════════
// FEED THE PLANET — the owner's gravitational feed studio. Build a reference
// LIBRARY per planet, pick which references to feed, generate guided art from
// them (img2img), and curate the guided STAR (remove any). Album art = event
// horizon; auto gallery = secondary satellite. OWNER-ONLY (isPrivateHost).
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTracks } from "@/lib/useTracks";
import { canPerform } from "@/components/KineticStage";
import { isPrivateHost } from "@/lib/privateHost";
import { BackToHub } from "@/components/BackToHub";

/* eslint-disable @next/next/no-img-element */

type Ref = { id: string; url: string };
type Img = { id: string; url: string; prompt?: string; ref?: string };
type Guided = { slug: string; references: Ref[]; images: Img[] };

async function api(body: Record<string, unknown>): Promise<Guided | null> {
  const r = await fetch("/api/feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "failed");
  return (j.guided as Guided) ?? null;
}
function downscale(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 1152 / img.width);
      const w = Math.round(img.width * s), h = Math.round(img.height * s);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d")?.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.9));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export default function FeedPage() {
  const { tracks } = useTracks();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => { setAllowed(isPrivateHost(window.location.hostname)); }, []);

  const planets = useMemo(() => tracks.filter(canPerform), [tracks]);
  const [slug, setSlug] = useState<string | null>(null);
  const sel = planets.find((p) => p.id === slug) || null;

  const [guided, setGuided] = useState<Guided | null>(null);
  const [selRefs, setSelRefs] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState("");
  const [n, setN] = useState(4);
  const [denoise, setDenoise] = useState(0.62);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (s: string) => fetch(`/api/feed?slug=${encodeURIComponent(s)}`).then((r) => r.json())
    .then((j) => { const g = j.guided as Guided; setGuided(g); setSelRefs(new Set(g.references.map((r) => r.id))); })
    .catch(() => setGuided({ slug: s, references: [], images: [] }));
  useEffect(() => { if (slug) { setGuided(null); setMsg(null); load(slug); } }, [slug]);

  const run = async (body: Record<string, unknown>, working: string, done: string) => {
    if (!slug || busy) return;
    setBusy(true); setMsg(working);
    try {
      const g = await api({ slug, ...body });
      if (g) { setGuided(g); setSelRefs((prev) => new Set(g.references.filter((r) => prev.has(r.id) || body.action === "addRef").map((r) => r.id))); }
      setMsg(done);
    } catch (e) { setMsg("✗ " + (e as Error).message); }
    setBusy(false);
  };

  const addRefs = async (files: FileList) => {
    for (const f of Array.from(files)) {
      const dataUrl = await downscale(f);
      await run({ action: "addRef", image: dataUrl }, `adding ${f.name}…`, "✦ reference added");
    }
  };
  const generate = () => run({ action: "generate", refIds: [...selRefs], prompt, n, denoise }, "feeding the planet… img2img can take a minute — keep this tab open.", `✦ fed ${n} guided image${n > 1 ? "s" : ""}`).then(() => setPrompt(""));
  const toggleRef = (id: string) => setSelRefs((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });

  if (allowed === null) return <main className="min-h-screen bg-void" />;
  if (allowed === false) return (
    <main className="grid min-h-screen place-items-center bg-void px-6 text-center">
      <div>
        <p className="font-display text-5xl font-black uppercase tracking-tight text-white/80">🕳️ Owner only</p>
        <p className="mt-3 font-mono text-sm text-white/40">The gravitational feed only opens on the owner&apos;s own machine.</p>
      </div>
    </main>
  );

  const selCount = selRefs.size;
  return (
    <main className="relative min-h-screen bg-void px-4 py-10 sm:px-8">
      <BackToHub />
      <header className="mx-auto mt-6 max-w-6xl text-center">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight text-white sm:text-6xl glow-text" style={{ color: "var(--theme-primary)" }}>Feed the Planet</h1>
        <p className="mx-auto mt-3 max-w-2xl text-white/55">
          Build a <b className="text-white/80">reference library</b>, choose which to feed, and generate a
          <b className="text-white/80"> guided</b> collection — the planet&apos;s star. Album art is the event
          horizon; the auto gallery stays the satellite.
        </p>
      </header>

      {/* planet picker */}
      <div className="mx-auto mt-8 flex max-w-6xl flex-wrap justify-center gap-2">
        {planets.map((p) => (
          <button key={p.id} onClick={() => setSlug(p.id)}
            className={`rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition ${slug === p.id ? "border-white/60 bg-white/10 text-white" : "border-white/15 text-white/55 hover:text-white"}`}>
            {p.title}
          </button>
        ))}
      </div>

      {sel && (
        <div className="mx-auto mt-8 grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_1fr]">
          {/* ── LEFT: references + generate ── */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">Event horizon</p>
                <Link href={`/studio?play=${sel.id}`} className="font-mono text-[10px] uppercase tracking-wider text-white/40 hover:text-white">preview show →</Link>
              </div>
              {sel.cover
                ? <img src={sel.cover} alt="" className="mt-2 h-36 w-full rounded-xl object-cover ring-1 ring-white/10" />
                : <div className="mt-2 grid h-36 place-items-center rounded-xl bg-white/5 text-white/30">no album art</div>}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">Reference library · {guided?.references.length ?? "…"}</p>
                {guided && guided.references.length > 0 && (
                  <span className="flex gap-3 font-mono text-[10px] uppercase tracking-wider text-white/40">
                    <button onClick={() => setSelRefs(new Set(guided.references.map((r) => r.id)))} className="hover:text-white">all</button>
                    <button onClick={() => setSelRefs(new Set())} className="hover:text-white">none</button>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(guided?.references ?? []).map((r) => {
                  const on = selRefs.has(r.id);
                  return (
                    <div key={r.id} className={`group relative aspect-square overflow-hidden rounded-lg ring-2 transition ${on ? "ring-[color:var(--theme-primary)]" : "ring-white/10"}`}>
                      <img src={r.url} alt="" loading="lazy" className={`h-full w-full cursor-pointer object-cover transition ${on ? "" : "opacity-45"}`} onClick={() => toggleRef(r.id)} />
                      <span className="pointer-events-none absolute left-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-black/50 text-[9px] text-white">{on ? "✓" : ""}</span>
                      <button onClick={() => run({ action: "removeRef", id: r.id }, "removing…", "✦ removed")} disabled={busy}
                        className="absolute right-1 top-1 hidden h-5 w-5 place-items-center rounded-full bg-black/60 text-xs text-white/80 hover:text-red-300 group-hover:grid">×</button>
                    </div>
                  );
                })}
                <button onClick={() => fileRef.current?.click()} disabled={busy}
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) addRefs(e.dataTransfer.files); }}
                  className="grid aspect-square place-items-center rounded-lg border border-dashed border-white/20 text-center font-mono text-[10px] text-white/40 transition hover:border-white/40 hover:text-white/70">
                  + add<br />image
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) addRefs(e.target.files); }} />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">Generate from {selCount} selected</p>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
                placeholder="prompt to steer the generation — e.g. 'neon rooftop bar, rain, cinematic'"
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none" />
              <div className="mt-3 flex items-center gap-4 font-mono text-[11px] text-white/50">
                <label className="flex items-center gap-2">count
                  <input type="number" min={1} max={12} value={n} onChange={(e) => setN(Math.min(12, Math.max(1, +e.target.value || 1)))} className="w-14 rounded border border-white/15 bg-white/[0.03] px-2 py-1 text-white" />
                </label>
                <label className="flex flex-1 items-center gap-2">guidance {(1 - denoise).toFixed(2)}
                  <input type="range" min={0.2} max={0.9} step={0.02} value={denoise} onChange={(e) => setDenoise(+e.target.value)} className="flex-1" />
                </label>
              </div>
              <button onClick={generate} disabled={busy || !prompt.trim() || selCount === 0}
                className="mt-4 w-full rounded-full px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-void transition disabled:opacity-40" style={{ background: "var(--theme-primary)" }}>
                {busy ? "working…" : `⭑ feed from ${selCount} reference${selCount === 1 ? "" : "s"}`}
              </button>
              {msg && <p className="mt-3 text-center font-mono text-[11px] text-white/60">{msg}</p>}
            </div>
          </div>

          {/* ── RIGHT: the guided star (curatable) ── */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">Guided star · {guided?.images.length ?? "…"}</p>
              {guided && guided.images.length > 0 && (
                <button onClick={() => { if (window.confirm("Clear the entire guided collection?")) run({ action: "clear" }, "clearing…", "✦ cleared — back to the auto gallery"); }} disabled={busy}
                  className="font-mono text-[10px] uppercase tracking-wider text-white/40 hover:text-red-300">clear all</button>
              )}
            </div>
            {guided === null ? (
              <p className="mt-4 font-mono text-xs text-white/30">loading…</p>
            ) : guided.images.length === 0 ? (
              <p className="mt-4 font-mono text-xs text-white/30">nothing fed yet — add references, pick some, and feed. Until then this planet runs on its auto gallery.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[...guided.images].reverse().map((im) => (
                  <div key={im.id} className="group relative aspect-video overflow-hidden rounded-lg ring-1 ring-white/10" title={im.prompt || ""}>
                    <img src={im.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <button onClick={() => run({ action: "removeImage", id: im.id }, "removing…", "✦ removed")} disabled={busy}
                      className="absolute right-1 top-1 hidden h-5 w-5 place-items-center rounded-full bg-black/60 text-xs text-white/80 hover:text-red-300 group-hover:grid">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
