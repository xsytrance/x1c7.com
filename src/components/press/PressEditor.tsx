"use client";

// THE PRESSING PLANT — editor shell (P1: game case room, THE DROP → THE LOOK
// → THE FACTS rail; THE PRINT SHOP and THE BOOTH arrive with their phases).
// PRINT IT is always live. All work is on-device; see PrivacyBadge.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COLLECTOR_PALETTES, classifyCollector } from "@/lib/studio/collectorPalettes";
import { buildOverlaySVG, artPlacement, renderCasePNG, W, H } from "@/lib/collector/webEngine";
import { caseSpecFrom } from "@/lib/press/templates/collectorCase";
import { projectStore, useProject, newProject } from "@/lib/press/state/projectStore";
import { loadProject, putAsset, getAsset } from "@/lib/press/state/persist";
import { audioFacts } from "@/lib/press/analysis/audioFacts";
import { classifyPaste, descriptorWords, type PasteKind } from "@/lib/press/analysis/intake";
import { recommend, dominantHue } from "@/lib/press/analysis/recommend";
import type { AnalysisSummary } from "@/lib/press/types";
import { IntakeLedger } from "./IntakeLedger";
import { PrivacyBadge } from "./PrivacyBadge";

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500";
const HINT = "text-[11px] leading-4 text-zinc-600";
const FIELD = "mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-700 focus:border-amber-400/60 focus:outline-none";
const ROOMS = ["THE DROP", "THE LOOK", "THE FACTS"] as const;

export default function PressEditor() {
  const project = useProject();
  const [room, setRoom] = useState<(typeof ROOMS)[number]>("THE DROP");
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [artDim, setArtDim] = useState<{ w: number; h: number } | null>(null);
  const [artHue, setArtHue] = useState<number | null>(null);
  const artImgRef = useRef<HTMLImageElement | null>(null);
  const [paste, setPaste] = useState("");
  const [lastPaste, setLastPaste] = useState<PasteKind | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // restore the draft (JSON from localStorage, art blob from IndexedDB)
  useEffect(() => {
    const saved = loadProject();
    if (saved) projectStore.load(saved);
    else projectStore.load(newProject("collector"));
    const ref = (saved ?? projectStore.get()).art.slots.cover;
    if (ref) {
      getAsset(ref.assetId).then((blob) => { if (blob) attachArt(blob, false); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ctrl-z / ctrl-shift-z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) projectStore.redo(); else projectStore.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const attachArt = useCallback((blob: Blob, persist = true) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      artImgRef.current = img;
      setArtDim({ w: img.naturalWidth, h: img.naturalHeight });
      setArtHue(dominantHue(img));
    };
    img.src = url;
    setArtUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
    if (persist) {
      const assetId = `art-${Date.now()}`;
      void putAsset(assetId, blob);
      projectStore.apply((d) => { d.art.slots.cover = { assetId }; });
      mergeAnalysis({ sources: ["art"] });
    }
  }, []);

  function mergeAnalysis(patch: Partial<AnalysisSummary>) {
    projectStore.apply((d) => {
      const cur: AnalysisSummary = d.analysis ?? { sources: [] };
      const sources = [...new Set([...(cur.sources || []), ...(patch.sources || [])])] as AnalysisSummary["sources"];
      d.analysis = { ...cur, ...patch, sources };
    });
  }

  async function onAudio(f: File | null) {
    if (!f) return;
    setMsg("reading the song on your device…");
    const facts = await audioFacts(f);
    if (!facts) { setMsg("couldn't decode that audio file"); return; }
    projectStore.apply((d) => {
      d.facts.peaks = facts.peaks;
      d.facts.duration = facts.duration;
      if (!d.facts.runtime) d.facts.runtime = facts.runtime;
    });
    mergeAnalysis({ bpm: facts.bpm, duration: facts.duration, peaks: facts.peaks, sources: ["audio"] });
    setMsg(`✓ measured: ${facts.runtime}${facts.bpm ? ` · ~${facts.bpm} BPM (estimate)` : ""} — waveform on the spine`);
  }

  function onPaste() {
    const t = paste.trim();
    if (!t) return;
    const kind = classifyPaste(t);
    applyPaste(t, kind);
  }

  function applyPaste(t: string, kind: PasteKind) {
    setLastPaste(kind);
    if (kind === "lyrics") {
      projectStore.apply((d) => { d.lyrics = t; });
      mergeAnalysis({ sources: ["lyrics"] });
      setMsg("✓ lyrics received — spine words and the booklet will feed on these");
    } else if (kind === "style") {
      mergeAnalysis({ styleWords: descriptorWords(t), sources: ["style"] });
      setMsg("✓ style text read");
    } else {
      mergeAnalysis({ exclusions: descriptorWords(t), sources: ["exclusions"] });
      setMsg("✓ exclusions noted — those looks get shelved, never auto-picked");
    }
    setPaste("");
  }

  async function printIt() {
    if (busy) return;
    const ref = project.art.slots.cover;
    if (!ref || !artImgRef.current) { setMsg("drop your art first — that's the one thing the press needs"); return; }
    setBusy(true); setMsg("pressing 2048² PNG on your device…");
    try {
      const blob = await renderCasePNG(artImgRef.current, caseSpecFrom(project));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(project.identity.title || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "case"}-collector.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg("✓ pressed — check your downloads");
    } catch (e) {
      setMsg(`press failed: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  const spec = useMemo(() => caseSpecFrom(project), [project]);
  const overlaySVG = useMemo(() => buildOverlaySVG(spec), [spec]);
  const place = artDim ? artPlacement(artDim.w, artDim.h) : null;
  const recs = useMemo(() => recommend(project, { artHue }).filter((r) => !dismissed.includes(r.id)), [project, artHue, dismissed]);
  const rec = recs[0] ?? null;
  const autoKey = classifyCollector(project.identity.genre).key;
  const id = project.identity;
  const setId = (patch: Partial<typeof id>) => projectStore.apply((d) => { Object.assign(d.identity, patch); });

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* preview */}
      <section className="lg:sticky lg:top-6 lg:h-fit">
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
            <rect width={W} height={H} fill="#050505" />
            {artUrl && place && artDim && (
              <>
                <defs><clipPath id="pArtClip"><rect x={place.dx} y={place.dy} width={place.dw} height={place.dh} /></clipPath></defs>
                <image href={artUrl}
                  x={place.dx - (place.sx * place.dw) / place.sw}
                  y={place.dy - (place.sy * place.dh) / place.sh}
                  width={(artDim.w * place.dw) / place.sw}
                  height={(artDim.h * place.dh) / place.sh}
                  clipPath="url(#pArtClip)" preserveAspectRatio="none" />
              </>
            )}
            {!artUrl && <text x={W / 2 + 130} y={H / 2} fontFamily="Bebas Neue" fontSize="72" fill="#26262e" textAnchor="middle">FEED ME YOUR SONG</text>}
            <g dangerouslySetInnerHTML={{ __html: overlaySVG.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "") }} />
          </svg>
        </div>
        {/* recommendation strip — one at a time, read → suggestion → override */}
        {rec && (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
            <p className="text-[11px] leading-4 text-zinc-400">
              <span className="text-amber-300">{rec.read}</span> — {rec.suggestion}.
              {rec.overrideHint ? <span className="text-zinc-600"> {rec.overrideHint}.</span> : null}
              {rec.measured ? <span className="ml-1 text-emerald-600">measured on-device</span> : <span className="ml-1 text-zinc-700">our read</span>}
            </p>
            <span className="flex shrink-0 gap-2">
              <button onClick={() => projectStore.apply((d) => rec.apply(d))}
                className="rounded-full border border-amber-400/50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">apply</button>
              <button onClick={() => setDismissed((v) => [...v, rec.id])}
                className="rounded-full border border-zinc-800 px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-600">skip</button>
            </span>
          </div>
        )}
      </section>

      {/* rail + rooms */}
      <aside className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {ROOMS.map((r) => (
              <button key={r} onClick={() => setRoom(r)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition ${room === r ? "border-amber-400/60 text-amber-300" : "border-zinc-800 text-zinc-600 hover:text-zinc-400"}`}>
                {r}
              </button>
            ))}
          </div>
          <span className="flex gap-1">
            <button onClick={() => projectStore.undo()} disabled={!projectStore.canUndo()} title="undo (ctrl-z)"
              className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500 disabled:opacity-30">↺</button>
            <button onClick={() => projectStore.redo()} disabled={!projectStore.canRedo()} title="redo"
              className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500 disabled:opacity-30">↻</button>
          </span>
        </div>

        {room === "THE DROP" && (
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className={LABEL}>Feed me your song <span className="normal-case tracking-normal text-zinc-700">— any of it, in any order</span></p>
            <div>
              <p className={HINT}>Art (the one thing the press needs)</p>
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && attachArt(e.target.files[0])}
                className="mt-1 w-full text-xs text-zinc-500 file:mr-3 file:rounded-full file:border file:border-zinc-700 file:bg-transparent file:px-3 file:py-1 file:text-[10px] file:font-semibold file:uppercase file:tracking-wider file:text-zinc-400" />
            </div>
            <div>
              <p className={HINT}>Audio → true waveform, runtime, BPM</p>
              <input type="file" accept="audio/*" onChange={(e) => onAudio(e.target.files?.[0] || null)}
                className="mt-1 w-full text-xs text-zinc-500 file:mr-3 file:rounded-full file:border file:border-zinc-700 file:bg-transparent file:px-3 file:py-1 file:text-[10px] file:font-semibold file:uppercase file:tracking-wider file:text-zinc-400" />
            </div>
            <div>
              <p className={HINT}>Paste lyrics, style text, or exclusions — I&apos;ll sort out which is which</p>
              <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3}
                placeholder={"lyrics…\nor: dreamy liquid dnb, female vocal\nor: no synthwave, avoid neon"} className={`${FIELD} resize-none`} />
              <div className="mt-1 flex items-center gap-2">
                <button onClick={onPaste} disabled={!paste.trim()}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 disabled:opacity-30">feed it</button>
                {lastPaste && <span className={HINT}>read as <b className="text-zinc-400">{lastPaste}</b> — wrong?{" "}
                  {(["lyrics", "style", "exclusions"] as PasteKind[]).filter((k) => k !== lastPaste).map((k) => (
                    <button key={k} onClick={() => { const t = project.lyrics; void t; setLastPaste(k); setMsg(`re-read as ${k} — paste it again and I'll file it there`); }}
                      className="mr-1 underline decoration-dotted">{k}</button>
                  ))}</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className={HINT}>Title</p>
                <input value={id.title} onChange={(e) => setId({ title: e.target.value })} placeholder="Neon Rain (Night Drive Mix)" className={FIELD} />
              </div>
              <div>
                <p className={HINT}>Your label</p>
                <input value={id.label} onChange={(e) => setId({ label: e.target.value })} placeholder="YOUR LABEL" className={FIELD} />
              </div>
            </div>
            <p className={HINT}>Coming from Suno? Grab the mp3, lyrics, and style text from your library page — feed me any or all. Stems zips get a seat at the table in the next expansion.</p>
          </div>
        )}

        {room === "THE LOOK" && (
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className={LABEL}>The look</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className={HINT}>Genre (drives the bucket)</p>
                <input value={id.genre ?? ""} onChange={(e) => setId({ genre: e.target.value || null })} placeholder="Liquid DnB" className={FIELD} />
                <p className={`${HINT} mt-1`}>bucket: {COLLECTOR_PALETTES[autoKey].label}</p>
              </div>
              <div>
                <p className={HINT}>Palette</p>
                <select value={id.paletteKey ?? "auto"} onChange={(e) => setId({ paletteKey: e.target.value === "auto" ? null : e.target.value })} className={FIELD}>
                  <option value="auto">auto — {COLLECTOR_PALETTES[autoKey].label}</option>
                  {Object.entries(COLLECTOR_PALETTES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <p className={HINT}>Spine word <span className="text-zinc-700">(blank = bucket)</span></p>
                <input value={id.spineWord ?? ""} onChange={(e) => setId({ spineWord: e.target.value || null })} placeholder={COLLECTOR_PALETTES[autoKey].label} className={FIELD} />
              </div>
              <div>
                <p className={HINT}>Handle <span className="text-zinc-700">(small red line)</span></p>
                <input value={id.handle ?? ""} onChange={(e) => setId({ handle: e.target.value || null })} placeholder="yourhandle" className={FIELD} />
              </div>
            </div>
            <p className={HINT}>The header band, seal monogram, and footer carry your imprint — it&apos;s your case, not ours.</p>
          </div>
        )}

        {room === "THE FACTS" && (
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className={LABEL}>The facts <span className="normal-case tracking-normal text-zinc-700">— printed only if you provide them</span></p>
            <div className="grid grid-cols-4 gap-2">
              <div><p className={HINT}>BPM</p><input value={project.facts.bpm ?? ""} onChange={(e) => projectStore.apply((d) => { d.facts.bpm = Number(e.target.value) > 0 ? Math.round(Number(e.target.value)) : null; })} inputMode="numeric" placeholder="124" className={FIELD} /></div>
              <div><p className={HINT}>Runtime</p><input value={project.facts.runtime ?? ""} onChange={(e) => projectStore.apply((d) => { d.facts.runtime = e.target.value || null; })} placeholder="3:24" className={FIELD} /></div>
              <div><p className={HINT}>Lang</p><input value={id.lang ?? ""} onChange={(e) => setId({ lang: e.target.value || null })} placeholder="EN" className={FIELD} /></div>
              <div><p className={HINT}>Geo</p><input value={id.geo ?? ""} onChange={(e) => setId({ geo: e.target.value || null })} placeholder="TOKYO" className={FIELD} /></div>
            </div>
            <div>
              <p className={HINT}>Series</p>
              <input value={id.series ?? ""} onChange={(e) => setId({ series: e.target.value || null })} placeholder="Night Drives" className={FIELD} />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input type="checkbox" checked={!!id.explicit} onChange={(e) => setId({ explicit: e.target.checked })} className="accent-amber-400" /> explicit
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input type="checkbox" checked={!!id.unreleased} onChange={(e) => setId({ unreleased: e.target.checked })} className="accent-amber-400" /> unreleased
              </label>
            </div>
          </div>
        )}

        <IntakeLedger project={project} />

        <button onClick={printIt} disabled={busy}
          className="w-full rounded-full border border-amber-400/50 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-amber-300 transition hover:bg-amber-400/10 disabled:opacity-40">
          {busy ? "pressing…" : "PRINT IT — download PNG"}
        </button>
        {msg && <p className={`${HINT} text-center`}>{msg}</p>}
        <p className={`${HINT} text-center`}>Good to print at any moment — every layer past THE DROP is generosity, not homework.</p>
      </aside>
    </div>
  );
}
