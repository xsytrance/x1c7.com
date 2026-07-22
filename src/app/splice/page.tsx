"use client";

// THE SPLICE TABLE — Suno mashup compiler. Every song is a lego set (style,
// sections, signature). Pick two; EASY mode auto-arranges a Frankenstein and
// compiles a paste-ready Suno prompt — entirely in this tab. The conflict
// resolver reads real BPM/key analysis and tells you if the seams will sing.
//
// FREE  = pick + auto-splice + deterministic compile + copy (in-tab, no server)
// PRO   = the knobs + arrangement (reveal inline)
// AI    = smooth the seams with a model (KEYED/LOCAL) — the ✨ button

import { useEffect, useMemo, useRef, useState } from "react";
import type { Catalog, CatalogEntry, SongLegos, Compiled, FlowKnobs } from "@/lib/splice/types";
import { easyFlow, type ArrangeStep } from "@/lib/splice/autoArrange";
import { compile } from "@/lib/splice/compile";
import { CompatMeter } from "@/components/splice/CompatMeter";
import { SongCard } from "@/components/splice/SongCard";

const songCache = new Map<string, SongLegos>();
async function loadSong(id: string): Promise<SongLegos> {
  if (songCache.has(id)) return songCache.get(id)!;
  const r = await fetch(`/splice/songs/${id}.json`);
  if (!r.ok) throw new Error(`load ${id}: ${r.status}`);
  const s = (await r.json()) as SongLegos;
  songCache.set(id, s);
  return s;
}

export default function SplicePage() {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [pro, setPro] = useState(false);
  const [knobs, setKnobs] = useState<FlowKnobs>({ weirdness: 25, styleStrength: 70, audioInfluence: 0, voice: "auto" });
  const [result, setResult] = useState<{ out: Compiled; steps: ArrangeStep[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/splice/catalog.json").then((r) => r.json()).then((c: Catalog) => setCatalog(c.songs)).catch((e) => setErr(String(e)));
  }, []);

  // Pick logic: first click sets style, second sets guest, re-click clears.
  function pick(id: string) {
    setAiNote(null);
    if (styleId === id) { setStyleId(guestId); setGuestId(null); return; }
    if (guestId === id) { setGuestId(null); return; }
    if (!styleId) setStyleId(id);
    else if (!guestId) setGuestId(id);
    else { setStyleId(id); setGuestId(null); } // both full -> restart with this as style
  }

  function surprise() {
    if (!catalog?.length) return;
    const withHook = catalog.filter((s) => s.provides.includes("chorus") || s.provides.includes("hook"));
    const a = catalog[Math.floor(Math.random() * catalog.length)];
    // bias guest toward same mode for a mash that tends to sing
    const pool = (withHook.length ? withHook : catalog).filter((s) => s.id !== a.id);
    const sameMode = pool.filter((s) => s.mode === a.mode);
    const b = (sameMode.length ? sameMode : pool)[Math.floor(Math.random() * (sameMode.length ? sameMode.length : pool.length))];
    setAiNote(null); setStyleId(a.id); setGuestId(b?.id ?? null);
  }

  // Compile whenever the pair or knobs change (deterministic, in-tab).
  const compileKey = `${styleId}|${guestId}|${JSON.stringify(knobs)}`;
  const lastKey = useRef<string>("");
  useEffect(() => {
    if (!styleId || !guestId) { setResult(null); return; }
    if (lastKey.current === compileKey) return;
    lastKey.current = compileKey;
    let alive = true;
    (async () => {
      try {
        const [s, g] = await Promise.all([loadSong(styleId), loadSong(guestId)]);
        if (!alive) return;
        const lookup = (sid: string) => (sid === s.id ? s : sid === g.id ? g : undefined);
        const { flow, steps } = easyFlow(s, g);
        flow.knobs = knobs;
        const out = compile(flow, lookup);
        setResult({ out, steps });
        setErr(null);
      } catch (e) { if (alive) setErr(String(e)); }
    })();
    return () => { alive = false; };
  }, [compileKey, styleId, guestId, knobs]);

  const styleSong = catalog?.find((s) => s.id === styleId) ?? null;
  const guestSong = catalog?.find((s) => s.id === guestId) ?? null;

  const shown = useMemo(() => {
    if (!catalog) return [];
    const t = q.trim().toLowerCase();
    if (!t) return catalog;
    return catalog.filter((s) => s.title.toLowerCase().includes(t) || (s.genre ?? "").toLowerCase().includes(t) || s.signature.some((w) => w.includes(t)));
  }, [catalog, q]);

  async function smoothWithAI() {
    if (!result || aiBusy) return;
    setAiBusy(true); setAiNote("asking a model to smooth the seams…");
    try {
      const r = await fetch("/api/splice/refine", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ compiled: result.out }),
      });
      const data = await r.json();
      if (!r.ok || data.error) { setAiNote(data.error || `refine unavailable (${r.status}) — deterministic prompt still works`); }
      else { setResult((cur) => cur ? { ...cur, out: { ...cur.out, ...data.compiled } } : cur); setAiNote(`smoothed by ${data.engine ?? "model"}`); }
    } catch (e) { setAiNote(`refine offline — ${String(e).slice(0, 80)}. Deterministic prompt still works.`); }
    finally { setAiBusy(false); }
  }

  return (
    <main className="min-h-[100dvh] bg-[#050510] text-zinc-200">
      <header className="mx-auto flex max-w-[1400px] flex-wrap items-start justify-between gap-3 px-5 pt-8">
        <div>
          <h1 className="font-display text-3xl font-black tracking-[0.18em] text-fuchsia-300">THE SPLICE TABLE</h1>
          <p className="mt-1 max-w-[620px] text-[12px] leading-5 text-zinc-500">
            Every song is a set of legos — style, sections, signature. Pick two; it Frankensteins a
            new one and compiles a paste-ready Suno prompt.
            <span className="text-emerald-500"> It all happens in this tab — the compile never leaves your machine.</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/music" className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600 transition hover:text-zinc-300">← the collection</a>
          <a href="/press" className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-500/70 transition hover:text-amber-300">pressing plant →</a>
          <span className="rounded-full border border-emerald-500/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">⏚ tab-silent</span>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] px-5 pt-6">
        {/* selection bar */}
        <div className="flex flex-wrap items-center gap-3">
          <Slot label="style base" tone="amber" song={styleSong} onClear={() => { setStyleId(guestId); setGuestId(null); }} />
          <span className="font-display text-2xl text-zinc-600">✕</span>
          <Slot label="guest hook" tone="fuchsia" song={guestSong} onClear={() => setGuestId(null)} />
          <div className="ml-auto flex items-center gap-2">
            <button onClick={surprise} className="rounded-lg border border-zinc-700 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-300 transition hover:border-fuchsia-400/60 hover:text-fuchsia-300">🎲 surprise me</button>
            {(styleId || guestId) && <button onClick={() => { setStyleId(null); setGuestId(null); }} className="font-mono text-[11px] uppercase tracking-wider text-zinc-600 hover:text-zinc-300">clear</button>}
          </div>
        </div>

        {err && <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 font-mono text-[11px] text-rose-300">{err}</p>}

        {/* result */}
        {result && (
          <Result result={result} pro={pro} setPro={setPro} knobs={knobs} setKnobs={setKnobs}
            onAI={smoothWithAI} aiBusy={aiBusy} aiNote={aiNote}
            styleTitle={styleSong?.title ?? ""} guestTitle={guestSong?.title ?? ""} />
        )}

        {/* picker */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-600">
            {styleId && guestId ? "swap either — pick to replace" : styleId ? "now pick the guest" : "pick the style base"}
          </p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter…"
            className="w-40 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-700 focus:border-fuchsia-400/60 focus:outline-none" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 pb-16 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((s) => (
            <SongCard key={s.id} song={s} role={s.id === styleId ? "style" : s.id === guestId ? "guest" : null} onPick={() => pick(s.id)} />
          ))}
          {!catalog && <p className="col-span-full font-mono text-xs text-zinc-600">loading the catalog…</p>}
        </div>
      </section>
    </main>
  );
}

function Slot({ label, tone, song, onClear }: { label: string; tone: "amber" | "fuchsia"; song: CatalogEntry | null; onClear: () => void }) {
  const c = tone === "amber" ? "border-amber-400/50 text-amber-300" : "border-fuchsia-400/50 text-fuchsia-300";
  return (
    <div className={`flex min-w-[180px] items-center gap-2 rounded-lg border ${song ? c : "border-zinc-800 text-zinc-600"} bg-zinc-950/60 px-3 py-2`}>
      <div className="min-w-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-70">{label}</p>
        <p className="truncate text-sm font-semibold">{song?.title ?? "—"}</p>
      </div>
      {song && <button onClick={onClear} className="ml-auto font-mono text-xs opacity-60 hover:opacity-100">✕</button>}
    </div>
  );
}

function CopyBox({ label, text, mono = false }: { label: string; text: string; mono?: boolean }) {
  const [ok, setOk] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); } catch { /* ignore */ } }
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</span>
        <button onClick={copy} className={`font-mono text-[10px] uppercase tracking-wider ${ok ? "text-emerald-400" : "text-zinc-400 hover:text-fuchsia-300"}`}>{ok ? "copied ✓" : "copy"}</button>
      </div>
      <pre className={`max-h-[320px] overflow-auto whitespace-pre-wrap px-3 py-2 text-[12px] leading-5 text-zinc-300 ${mono ? "font-mono" : ""}`}>{text}</pre>
    </div>
  );
}

function Result({
  result, pro, setPro, knobs, setKnobs, onAI, aiBusy, aiNote, styleTitle, guestTitle,
}: {
  result: { out: Compiled; steps: ArrangeStep[] };
  pro: boolean; setPro: (b: boolean) => void;
  knobs: FlowKnobs; setKnobs: (k: FlowKnobs) => void;
  onAI: () => void; aiBusy: boolean; aiNote: string | null;
  styleTitle: string; guestTitle: string;
}) {
  const { out, steps } = result;
  return (
    <div className="mt-5 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-950/80 to-[#08000f] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">compiled track</p>
          <h2 className="font-display text-2xl font-black text-zinc-50">{out.title}</h2>
          <p className="mt-0.5 font-mono text-[11px] text-zinc-500">{styleTitle} <span className="text-zinc-700">✕</span> {guestTitle}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <CompatMeter value={out.compatibility} />
          <div className="flex items-center gap-2">
            <button onClick={onAI} disabled={aiBusy} className="rounded-lg border border-emerald-500/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-50">
              {aiBusy ? "smoothing…" : "✨ smooth seams (AI)"}
            </button>
            <button onClick={() => setPro(!pro)} className={`rounded-lg border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition ${pro ? "border-fuchsia-400/60 text-fuchsia-300" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}>
              {pro ? "pro ✓" : "pro"}
            </button>
          </div>
        </div>
      </div>

      {aiNote && <p className="mt-2 font-mono text-[11px] text-zinc-500">{aiNote}</p>}

      {/* PRO knobs */}
      {pro && (
        <div className="mt-4 grid gap-4 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/5 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Knob label={`weirdness ${knobs.weirdness}%`} value={knobs.weirdness} onChange={(v) => setKnobs({ ...knobs, weirdness: v })} />
          <Knob label={`style ${knobs.styleStrength}%`} value={knobs.styleStrength} onChange={(v) => setKnobs({ ...knobs, styleStrength: v })} />
          <Knob label={`audio ${knobs.audioInfluence}%`} value={knobs.audioInfluence} onChange={(v) => setKnobs({ ...knobs, audioInfluence: v })} />
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">voice</span>
            <select value={knobs.voice} onChange={(e) => setKnobs({ ...knobs, voice: e.target.value as FlowKnobs["voice"] })}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-200 focus:border-fuchsia-400/60 focus:outline-none">
              {["auto", "male", "female", "both", "undecided"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">arrangement</p>
            <ol className="space-y-0.5">
              {steps.map((s, i) => (
                <li key={i} className="font-mono text-[11px] text-zinc-400"><span className="text-fuchsia-400">{(s.as ?? "").padEnd(10)}</span> ← {s.why}</li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <CopyBox label="style of music" text={out.styleOfMusic} />
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">provenance</p>
            <ul className="mt-1 space-y-0.5">
              {Object.entries(out.provenance).map(([who, parts]) => (
                <li key={who} className="font-mono text-[11px] text-zinc-400"><span className="text-zinc-200">{who}</span> → {parts.join(", ")}</li>
              ))}
            </ul>
          </div>
          {out.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400">⚠ seam warnings — conflict resolver</p>
              <ul className="mt-1.5 space-y-1.5">
                {out.warnings.map((w, i) => (
                  <li key={i} className="text-[11px]">
                    <span className="font-mono text-zinc-400">{w.ref.split("::").slice(1).join("::")} <span className="text-zinc-600">(from {w.from})</span></span>
                    {w.suggestions.map((s, j) => <p key={j} className="pl-3 text-zinc-500">– {s}</p>)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <CopyBox label="lyrics — paste into suno" text={out.lyrics} />
      </div>
    </div>
  );
}

function Knob({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-fuchsia-400" />
    </label>
  );
}
