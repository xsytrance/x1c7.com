"use client";

// THE SPLICE TABLE — Suno mashup compiler. Every song is a lego set (style,
// sections, signature). Pick two; EASY mode auto-arranges a Frankenstein and
// compiles a paste-ready Suno prompt — entirely in this tab. BUILD mode opens
// the visual bench: reorder legos, pull parts from any number of songs. The
// conflict resolver reads real BPM/key and tells you if the seams will sing.
//
// FREE  = pick + auto-splice + compile + copy (in-tab, no server)
// PRO   = the knobs + the BUILD bench (reveal inline)
// AI    = smooth the seams with a model (owner tier) — the ✨ button

import { useEffect, useMemo, useRef, useState } from "react";
import type { Catalog, CatalogEntry, SongLegos, Compiled, FlowKnobs, Flow } from "@/lib/splice/types";
import { easyFlow, type ArrangeStep } from "@/lib/splice/autoArrange";
import { compile } from "@/lib/splice/compile";
import { CompatMeter } from "@/components/splice/CompatMeter";
import { SongCard } from "@/components/splice/SongCard";
import { SpliceBuilder } from "@/components/splice/SpliceBuilder";

const songCache = new Map<string, SongLegos>();
async function fetchSong(id: string): Promise<SongLegos> {
  if (songCache.has(id)) return songCache.get(id)!;
  const r = await fetch(`/splice/songs/${id}.json`);
  if (!r.ok) throw new Error(`load ${id}: ${r.status}`);
  const s = (await r.json()) as SongLegos;
  songCache.set(id, s);
  return s;
}

// A flow is small (song ids + section ids + knobs) — encode it into the URL
// hash so sharing a mashup is just copying the link. No backend, still in-tab.
type ShareFlow = { from: string; arr: { ref: string; as?: string }[]; k: FlowKnobs; ex: string[] };
function encodeFlow(flow: Flow, knobs: FlowKnobs): string {
  const payload: ShareFlow = {
    from: flow.style.from,
    arr: flow.arrangement.map((a) => ({ ref: a.ref, as: a.as })),
    k: knobs,
    ex: flow.exclude ?? [],
  };
  try { return "#f=" + btoa(unescape(encodeURIComponent(JSON.stringify(payload)))); }
  catch { return ""; }
}
function decodeFlow(hash: string): { flow: Flow; knobs: FlowKnobs } | null {
  const m = hash.match(/#f=(.+)$/);
  if (!m) return null;
  try {
    const p = JSON.parse(decodeURIComponent(escape(atob(m[1])))) as ShareFlow;
    if (!p.from || !Array.isArray(p.arr)) return null;
    return {
      flow: { title: null, style: { from: p.from, overrides: {} }, arrangement: p.arr.map((a) => ({ ref: a.ref, as: a.as as Flow["arrangement"][number]["as"] })), knobs: p.k, exclude: p.ex },
      knobs: p.k,
    };
  } catch { return null; }
}

export default function SplicePage() {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [loaded, setLoaded] = useState<Record<string, SongLegos>>({});
  const [flow, setFlow] = useState<Flow | null>(null);
  const [pending, setPending] = useState<string | null>(null);   // easy: style chosen, awaiting guest
  const [mode, setMode] = useState<"easy" | "build">("easy");
  const [pro, setPro] = useState(false);
  const [knobs, setKnobs] = useState<FlowKnobs>({ weirdness: 25, styleStrength: 70, audioInfluence: 0, voice: "auto" });
  const [q, setQ] = useState("");
  const [out, setOut] = useState<Compiled | null>(null);
  const [steps, setSteps] = useState<ArrangeStep[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiOverride, setAiOverride] = useState<Partial<Compiled> | null>(null);

  useEffect(() => {
    fetch("/splice/catalog.json").then((r) => r.json()).then((c: Catalog) => setCatalog(c.songs)).catch((e) => setErr(String(e)));
  }, []);

  // Restore a shared flow from the URL hash (once, on first load).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || typeof window === "undefined") return;
    const decoded = decodeFlow(window.location.hash);
    if (!decoded) return;
    restored.current = true;
    const ids = Array.from(new Set([decoded.flow.style.from, ...decoded.flow.arrangement.map((a) => a.ref.split("::")[0])]));
    (async () => {
      try {
        const got = await Promise.all(ids.map(fetchSong));
        const pool: Record<string, SongLegos> = {};
        got.forEach((s) => { pool[s.id] = s; });
        setLoaded(pool); setKnobs(decoded.knobs); setFlow(decoded.flow); setAiNote("restored a shared flow");
      } catch (e) { setErr(`couldn't restore shared flow: ${String(e)}`); }
    })();
  }, []);

  function shareLink() {
    if (!flow || typeof window === "undefined") return;
    const url = window.location.origin + window.location.pathname + encodeFlow(flow, knobs);
    try { window.history.replaceState(null, "", url); } catch { /* ignore */ }
    navigator.clipboard?.writeText(url).then(() => setAiNote("share link copied — anyone who opens it rebuilds this exact mashup")).catch(() => setAiNote(url));
  }

  const nameOf = (id: string) => catalog?.find((s) => s.id === id)?.title ?? loaded[id]?.title ?? id;

  async function ensureLoaded(ids: string[]): Promise<Record<string, SongLegos>> {
    const got = await Promise.all(ids.map(fetchSong));
    const merged = { ...loaded };
    got.forEach((s) => { merged[s.id] = s; });
    setLoaded(merged);
    return merged;
  }

  async function startEasy(styleId: string, guestId: string) {
    setAiOverride(null); setAiNote(null);
    const pool = await ensureLoaded([styleId, guestId]);
    const { flow: f } = easyFlow(pool[styleId], pool[guestId]);
    setFlow(f); setPending(null); setMode("easy");
  }

  async function surprise() {
    if (!catalog?.length) return;
    const withHook = catalog.filter((s) => s.provides.includes("chorus") || s.provides.includes("hook"));
    const a = catalog[Math.floor(Math.random() * catalog.length)];
    const poolC = (withHook.length ? withHook : catalog).filter((s) => s.id !== a.id);
    const sameMode = poolC.filter((s) => s.mode === a.mode);
    const b = (sameMode.length ? sameMode : poolC)[Math.floor(Math.random() * (sameMode.length ? sameMode.length : poolC.length))];
    if (b) await startEasy(a.id, b.id);
  }

  function clearAll() { setFlow(null); setPending(null); setOut(null); setAiOverride(null); setAiNote(null); setMode("easy"); }

  // Grid click behaviour depends on mode.
  async function pick(id: string) {
    setAiNote(null);
    if (mode === "build") { await ensureLoaded([id]); return; } // add to the parts bin
    if (!flow) {
      if (!pending) { setPending(id); return; }
      if (pending === id) { setPending(null); return; }
      await startEasy(pending, id);
      return;
    }
    // already have a result in easy mode -> restart the pair with this as style
    setFlow(null); setOut(null); setAiOverride(null); setPending(id);
  }

  // Single compile authority: recompute whenever the flow, pool, or knobs change.
  const compileKey = useMemo(() => (flow ? JSON.stringify({ f: flow.style.from, a: flow.arrangement, k: knobs, e: flow.exclude }) : ""), [flow, knobs]);
  const lastKey = useRef<string>("");
  useEffect(() => {
    if (!flow) { setOut(null); setSteps([]); return; }
    if (lastKey.current === compileKey) return;
    lastKey.current = compileKey;
    try {
      const lookup = (id: string) => loaded[id];
      const compiled = compile({ ...flow, knobs }, lookup);
      setOut(compiled); setErr(null);
    } catch (e) { setErr(String(e)); }
  }, [compileKey, flow, knobs, loaded]);

  // Recompute the EASY "why" steps for the read-out (style + primary guest).
  useEffect(() => {
    if (!flow) { setSteps([]); return; }
    const style = loaded[flow.style.from];
    const guestId = flow.arrangement.map((a) => a.ref.split("::")[0]).find((sid) => sid !== flow.style.from);
    const guest = guestId ? loaded[guestId] : undefined;
    if (style && guest) setSteps(easyFlow(style, guest).steps);
  }, [flow, loaded]);

  const shown = useMemo(() => {
    if (!catalog) return [];
    const t = q.trim().toLowerCase();
    if (!t) return catalog;
    return catalog.filter((s) => s.title.toLowerCase().includes(t) || (s.genre ?? "").toLowerCase().includes(t) || s.signature.some((w) => w.includes(t)));
  }, [catalog, q]);

  const styleId = flow?.style.from ?? pending ?? null;
  const guestId = flow ? flow.arrangement.map((a) => a.ref.split("::")[0]).find((sid) => sid !== flow.style.from) ?? null : null;
  const mixIds = flow ? Array.from(new Set(flow.arrangement.map((a) => a.ref.split("::")[0]))) : [];
  const roleOf = (id: string): "style" | "guest" | null =>
    id === styleId ? "style" : (mixIds.includes(id) && id !== styleId) ? "guest" : null;

  const shownOut: Compiled | null = out ? { ...out, ...(aiOverride || {}) } : null;

  async function smoothWithAI() {
    if (!shownOut || aiBusy) return;
    setAiBusy(true); setAiNote("asking a model to smooth the seams…");
    try {
      const r = await fetch("/api/splice/refine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ compiled: shownOut }) });
      const data = await r.json();
      if (!r.ok || data.error) setAiNote(data.error || `refine unavailable (${r.status}) — deterministic prompt still works`);
      else { setAiOverride(data.compiled); setAiNote(`smoothed by ${data.engine ?? "model"}`); }
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
        <div className="flex flex-wrap items-center gap-3">
          <Slot label="style base" tone="amber" title={styleId ? nameOf(styleId) : null} onClear={() => { setFlow(null); setOut(null); setPending(null); }} />
          <span className="font-display text-2xl text-zinc-600">✕</span>
          <Slot label={mixIds.length > 2 ? `+${mixIds.length - 1} guests` : "guest hook"} tone="fuchsia" title={guestId ? nameOf(guestId) : null} onClear={() => clearAll()} />
          <div className="ml-auto flex items-center gap-2">
            <button onClick={surprise} className="rounded-lg border border-zinc-700 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-300 transition hover:border-fuchsia-400/60 hover:text-fuchsia-300">🎲 surprise me</button>
            {(styleId || flow) && <button onClick={clearAll} className="font-mono text-[11px] uppercase tracking-wider text-zinc-600 hover:text-zinc-300">clear</button>}
          </div>
        </div>

        {err && <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 font-mono text-[11px] text-rose-300">{err}</p>}

        {shownOut && flow && (
          <div className="mt-5 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-950/80 to-[#08000f] p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">compiled track</p>
                <h2 className="font-display text-2xl font-black text-zinc-50">{shownOut.title}</h2>
                <p className="mt-0.5 font-mono text-[11px] text-zinc-500">{mixIds.map(nameOf).join("  ✕  ")}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <CompatMeter value={shownOut.compatibility} />
                <div className="flex items-center gap-2">
                  <button onClick={shareLink} className="rounded-lg border border-zinc-700 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-300 transition hover:border-fuchsia-400/60 hover:text-fuchsia-300">🔗 share</button>
                  <button onClick={smoothWithAI} disabled={aiBusy} className="rounded-lg border border-emerald-500/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-50">{aiBusy ? "smoothing…" : "✨ smooth seams (AI)"}</button>
                  <button onClick={() => setMode(mode === "build" ? "easy" : "build")} className={`rounded-lg border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition ${mode === "build" ? "border-fuchsia-400/60 text-fuchsia-300" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}>{mode === "build" ? "build ✓" : "build"}</button>
                  <button onClick={() => setPro(!pro)} className={`rounded-lg border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition ${pro ? "border-fuchsia-400/60 text-fuchsia-300" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}>{pro ? "knobs ✓" : "knobs"}</button>
                </div>
              </div>
            </div>

            {aiNote && <p className="mt-2 font-mono text-[11px] text-zinc-500">{aiNote}</p>}

            {pro && (
              <div className="mt-4 grid gap-4 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/5 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <Knob label={`weirdness ${knobs.weirdness}%`} value={knobs.weirdness} onChange={(v) => setKnobs({ ...knobs, weirdness: v })} />
                <Knob label={`style ${knobs.styleStrength}%`} value={knobs.styleStrength} onChange={(v) => setKnobs({ ...knobs, styleStrength: v })} />
                <Knob label={`audio ${knobs.audioInfluence}%`} value={knobs.audioInfluence} onChange={(v) => setKnobs({ ...knobs, audioInfluence: v })} />
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">voice</span>
                  <select value={knobs.voice} onChange={(e) => setKnobs({ ...knobs, voice: e.target.value as FlowKnobs["voice"] })} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-200 focus:border-fuchsia-400/60 focus:outline-none">
                    {["auto", "male", "female", "both", "undecided"].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              </div>
            )}

            {mode === "build" ? (
              <div className="mt-4">
                <SpliceBuilder flow={flow} loaded={loaded} onChange={setFlow} />
                <p className="mt-2 font-mono text-[10px] text-zinc-600">tip: click any song in the grid below to drop it into the parts bin.</p>
              </div>
            ) : (
              steps.length > 0 && (
                <div className="mt-4 rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">arrangement <span className="text-zinc-700 normal-case">— open BUILD to edit</span></p>
                  <ol className="space-y-0.5">
                    {steps.map((s, i) => <li key={i} className="font-mono text-[11px] text-zinc-400"><span className="text-fuchsia-400">{(s.as ?? "").padEnd(10)}</span> ← {s.why}</li>)}
                  </ol>
                </div>
              )
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <CopyBox label="style of music" text={shownOut.styleOfMusic} />
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">provenance</p>
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(shownOut.provenance).map(([who, parts]) => (
                      <li key={who} className="font-mono text-[11px] text-zinc-400"><span className="text-zinc-200">{who}</span> → {parts.join(", ")}</li>
                    ))}
                  </ul>
                </div>
                {shownOut.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400">⚠ seam warnings — conflict resolver</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {shownOut.warnings.map((w, i) => (
                        <li key={i} className="text-[11px]">
                          <span className="font-mono text-zinc-400">{w.ref.split("::").slice(1).join("::")} <span className="text-zinc-600">(from {w.from})</span></span>
                          {w.suggestions.map((s, j) => <p key={j} className="pl-3 text-zinc-500">– {s}</p>)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <CopyBox label="lyrics — paste into suno" text={shownOut.lyrics} />
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-600">
            {mode === "build" ? "click to add a song to the parts bin" : flow ? "swap either — pick to replace" : pending ? "now pick the guest" : "pick the style base"}
          </p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter…" className="w-40 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-700 focus:border-fuchsia-400/60 focus:outline-none" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 pb-16 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((s) => <SongCard key={s.id} song={s} role={roleOf(s.id)} onPick={() => pick(s.id)} />)}
          {!catalog && <p className="col-span-full font-mono text-xs text-zinc-600">loading the catalog…</p>}
        </div>
      </section>
    </main>
  );
}

function Slot({ label, tone, title, onClear }: { label: string; tone: "amber" | "fuchsia"; title: string | null; onClear: () => void }) {
  const c = tone === "amber" ? "border-amber-400/50 text-amber-300" : "border-fuchsia-400/50 text-fuchsia-300";
  return (
    <div className={`flex min-w-[180px] items-center gap-2 rounded-lg border ${title ? c : "border-zinc-800 text-zinc-600"} bg-zinc-950/60 px-3 py-2`}>
      <div className="min-w-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-70">{label}</p>
        <p className="truncate text-sm font-semibold">{title ?? "—"}</p>
      </div>
      {title && <button onClick={onClear} className="ml-auto font-mono text-xs opacity-60 hover:opacity-100">✕</button>}
    </div>
  );
}

function CopyBox({ label, text }: { label: string; text: string }) {
  const [ok, setOk] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); } catch { /* ignore */ } }
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</span>
        <button onClick={copy} className={`font-mono text-[10px] uppercase tracking-wider ${ok ? "text-emerald-400" : "text-zinc-400 hover:text-fuchsia-300"}`}>{ok ? "copied ✓" : "copy"}</button>
      </div>
      <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap px-3 py-2 text-[12px] leading-5 text-zinc-300">{text}</pre>
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
