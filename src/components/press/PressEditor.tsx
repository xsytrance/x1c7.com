"use client";

// THE PRESSING PLANT — editor shell (P1: game case room, THE DROP → THE LOOK
// → THE FACTS rail; THE PRINT SHOP and THE BOOTH arrive with their phases).
// PRINT IT is always live. All work is on-device; see PrivacyBadge.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COLLECTOR_PALETTES, classifyCollector } from "@/lib/studio/collectorPalettes";
import { buildOverlaySVG, artPlacement, renderCasePNG, W, H } from "@/lib/collector/webEngine";
import { caseSpecFrom } from "@/lib/press/templates/collectorCase";
import { getTemplate, templateList } from "@/lib/press/templates/registry";
import { renderSurfaceSVG } from "@/lib/press/render/renderSurface";
import { exportSurfacePNG } from "@/lib/press/render/exportPng";
import { projectStore, useProject, newProject } from "@/lib/press/state/projectStore";
import { loadProject, putAsset, getAsset } from "@/lib/press/state/persist";
import { audioFacts } from "@/lib/press/analysis/audioFacts";
import { classifyPaste, descriptorWords, type PasteKind } from "@/lib/press/analysis/intake";
import { recommend, dominantHue, isShelved, surpriseMe } from "@/lib/press/analysis/recommend";
import { SeedDrawer } from "./SeedDrawer";
import { UpgradePath, postureOf, applyDirectionToBooklet } from "./UpgradePath";
import type { Engine } from "@/lib/press/analysis/aiAnalyze";
import type { AnalysisSummary } from "@/lib/press/types";
import { BookletBuilder } from "./BookletBuilder";
import { IntakeLedger } from "./IntakeLedger";
import { PrivacyBadge } from "./PrivacyBadge";

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500";
const HINT = "text-[11px] leading-4 text-zinc-600";
const FIELD = "mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-700 focus:border-amber-400/60 focus:outline-none";
type Room = "THE DROP" | "THE LOOK" | "THE PRINT SHOP" | "THE BINDERY" | "THE FACTS" | "THE BOOTH";
import dynamic from "next/dynamic";
const StudioScene = dynamic(() => import("./three/StudioScene"), { ssr: false, loading: () => <p className="p-6 text-center font-mono text-xs text-zinc-600">warming up the booth (3D loads only here)…</p> });

export default function PressEditor({ templateId }: { templateId?: string }) {
  const project = useProject();
  const [room, setRoom] = useState<Room>("THE DROP");
  const [surfaceId, setSurfaceId] = useState<string | null>(null);
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [artDim, setArtDim] = useState<{ w: number; h: number } | null>(null);
  const [artHue, setArtHue] = useState<number | null>(null);
  const artImgRef = useRef<HTMLImageElement | null>(null);
  const [paste, setPaste] = useState("");
  const [lastPaste, setLastPaste] = useState<PasteKind | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"easy" | "pro">("easy");
  useEffect(() => { try { if (localStorage.getItem("press:mode") === "pro") setMode("pro"); } catch { /* fine */ } }, []);
  const setModePersist = (m: "easy" | "pro") => { setMode(m); try { localStorage.setItem("press:mode", m); } catch { /* fine */ } };
  const [msg, setMsg] = useState<string | null>(null);

  // restore the draft (JSON from localStorage, art blob from IndexedDB)
  useEffect(() => {
    const saved = loadProject();
    if (saved) projectStore.load(saved);
    else projectStore.load(newProject(templateId ?? "collector"));
    if (templateId && projectStore.get().templateId !== templateId) {
      projectStore.apply((d) => { d.templateId = templateId; });
    }
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

  async function onStems(f: File | null) {
    if (!f) return;
    setMsg("chewing your stems on this device — nothing leaves…");
    try {
      const { loadStemZip } = await import("@/lib/press/analysis/stemZip");
      const { analyzeStemFacts } = await import("@/lib/press/analysis/stemAnalysis");
      const stems = await loadStemZip(f, (m) => setMsg(m));
      const facts = await analyzeStemFacts(stems, (m) => setMsg(m));
      projectStore.apply((d) => {
        if (!d.facts.peaks) d.facts.peaks = facts.peaks;
        d.facts.duration = facts.duration;
        if (!d.facts.runtime) d.facts.runtime = `${Math.floor(facts.duration / 60)}:${String(Math.round(facts.duration % 60)).padStart(2, "0")}`;
      });
      mergeAnalysis({ bpm: facts.bpm, duration: facts.duration, sections: facts.sections, roster: facts.roster, sideSplit: facts.sideSplit, sources: ["stems"] });
      setMsg(`✓ the band: ${facts.roster.length} stems · ${facts.sections.length} sections · ~${facts.bpm} BPM${facts.sideSplit ? ` · flip at ${Math.floor(facts.sideSplit / 60)}:${String(Math.round(facts.sideSplit % 60)).padStart(2, "0")}` : ""} — the DELUXE booklet just unlocked`);
    } catch (e) {
      setMsg(`stems: ${(e as Error).message}`);
    }
  }

  const [director, setDirector] = useState<import("@/lib/press/analysis/aiAnalyze").ArtDirection | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);

  const [surpriseRoll, setSurpriseRoll] = useState(0);
  const [receipts, setReceipts] = useState<string[] | null>(null);
  function doSurprise() {
    const { next, receipts: r } = surpriseMe(project, { artHue }, surpriseRoll);
    projectStore.apply(() => next);
    setReceipts(r);
    setSurpriseRoll((v) => v + 1);
    setSurfaceId(null);
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

  const template = getTemplate(project.templateId);
  const legacy = !!template.legacy;
  const activeSurface = !legacy
    ? template.surfaces.find((s) => s.id === surfaceId) ?? template.surfaces[0]
    : null;
  const slug = () => (project.identity.title || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";

  function download(blob: Blob, name: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function printIt() {
    if (busy) return;
    const needsArt = legacy || template.surfaces.some((s) => s.layers.some((l) => l.kind === "art"));
    if (needsArt && (!project.art.slots.cover || !artImgRef.current)) {
      setMsg("drop your art first — that's the one thing the press needs");
      return;
    }
    setBusy(true);
    try {
      if (legacy) {
        setMsg("pressing 2048² PNG on your device…");
        download(await renderCasePNG(artImgRef.current!, caseSpecFrom(project)), `${slug()}-collector.png`);
        setMsg("✓ pressed — check your downloads");
      } else {
        // full press run: every surface, sequentially (one canvas alive at a time)
        const notes: string[] = [];
        for (const s of template.surfaces) {
          setMsg(`pressing ${s.name.toLowerCase()}…`);
          const out = await exportSurfacePNG(s, project, artImgRef.current);
          download(out.blob, `${slug()}-${template.id}-${s.id}.png`);
          notes.push(`${s.id} ${out.widthPx}×${out.heightPx}@${out.dpi}dpi`);
        }
        setMsg(`✓ pressed ${template.surfaces.length} surfaces — ${notes.join(" · ")}`);
      }
    } catch (e) {
      setMsg(`press failed: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  const spec = useMemo(() => caseSpecFrom(project), [project]);
  const overlaySVG = useMemo(() => buildOverlaySVG(spec), [spec]);
  const surfaceSVG = useMemo(() => {
    if (legacy || !activeSurface) return null;
    return renderSurfaceSVG(activeSurface, project, {
      pxPerMm: 96 / 25.4, mode: "all", bleed: false, guides: true,
      artUrl, artDim,
    });
  }, [legacy, activeSurface, project, artUrl, artDim]);
  const place = artDim ? artPlacement(artDim.w, artDim.h) : null;
  const recs = useMemo(() => recommend(project, { artHue }).filter((r) => !dismissed.includes(r.id)), [project, artHue, dismissed]);
  const rec = recs[0] ?? null;
  const autoKey = classifyCollector(project.identity.genre).key;
  const id = project.identity;
  const setId = (patch: Partial<typeof id>) => projectStore.apply((d) => { Object.assign(d.identity, patch); });

  const dropPanel = (
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
              <p className={HINT}>Suno stems zip → the band, sections, the tape flip, DELUXE booklet</p>
              <input type="file" accept=".zip,application/zip" onChange={(e) => onStems(e.target.files?.[0] || null)}
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
            <div>
              <p className={HINT}>The press — switch formats anytime, your song rides along</p>
              <div className="mt-1 grid grid-cols-3 gap-1.5">
                {templateList().map((t) => {
                  const active = project.templateId === t.id;
                  const thumbSurface = t.legacy ? null : t.surfaces[0];
                  return (
                    <button key={t.id} onClick={() => { projectStore.apply((d) => { d.templateId = t.id; }); setSurfaceId(null); }}
                      className={`overflow-hidden rounded-lg border p-1 text-left transition ${active ? "border-amber-400/60" : "border-zinc-800 hover:border-zinc-600"}`}>
                      <div className="pointer-events-none h-14 overflow-hidden rounded bg-black [&>svg]:h-full [&>svg]:w-full [&>svg]:object-contain"
                        dangerouslySetInnerHTML={{
                          __html: thumbSurface
                            ? renderSurfaceSVG(thumbSurface, { ...project, templateId: t.id }, { pxPerMm: 1.4, mode: "all", artUrl, artDim })
                            : overlaySVG.replace("<svg ", `<svg preserveAspectRatio="xMidYMid meet" `),
                        }} />
                      <p className={`mt-1 truncate text-[9px] font-bold uppercase tracking-wider ${active ? "text-amber-300" : "text-zinc-500"}`}>{t.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className={HINT}>Coming from Suno? Grab the mp3, lyrics, and style text from your library page — feed me any or all. Stems zips get a seat at the table in the next expansion.</p>
          </div>
  );

  // ── EASY PRESS (the spoonfeed-first law, owner 2026-07-19) ────────────────
  const spread = useMemo(() => {
    if (legacy) return null;
    return template.surfaces.map((sf) => ({
      sf,
      svg: renderSurfaceSVG(sf, project, { pxPerMm: 2.6, mode: "all", artUrl, artDim }),
    }));
  }, [legacy, template, project, artUrl, artDim]);

  // auto-derive: the moment new food lands, choices are MADE (receipts shown),
  // never asked. The user's chosen format is sacred.
  const autoSig = useRef("");
  useEffect(() => {
    if (mode !== "easy") return;
    const sig = `${project.templateId}|${artHue != null}|${(project.analysis?.sources ?? []).join(",")}`;
    if (sig === autoSig.current) return;
    autoSig.current = sig;
    if (artHue == null && !(project.analysis?.sources?.length)) return;
    const { next, receipts: r } = surpriseMe(project, { artHue }, 0, { keepFormat: true });
    projectStore.apply(() => next);
    setReceipts(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, artHue, project.templateId, project.analysis?.sources?.length]);

  async function pressKit() {
    if (busy) return;
    if (!project.art.slots.cover || !artImgRef.current) { setMsg("drop your art — that's the one thing the press needs"); return; }
    setBusy(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const lines: string[] = [`${(project.identity.title || "UNTITLED").toUpperCase()} — pressed at the pressing plant`, ""];
      if (legacy) {
        setMsg("pressing the case…");
        zip.file(`${slug()}-collector-case.png`, await renderCasePNG(artImgRef.current, caseSpecFrom(project)));
        lines.push("collector-case.png — 2048×2048, the whole case");
      } else {
        for (const sf of template.surfaces) {
          setMsg(`pressing ${sf.name.toLowerCase()}…`);
          const out = await exportSurfacePNG(sf, project, artImgRef.current);
          zip.file(`${slug()}-${sf.id}.png`, out.blob);
          lines.push(`${sf.id}.png — ${sf.name}, ${out.widthPx}×${out.heightPx} @ ${out.dpi}dpi`);
        }
      }
      if (template.id === "jewel") {
        setMsg("binding the booklet…");
        const { newBooklet } = await import("@/lib/press/booklet/model");
        const { imposeBooklet } = await import("@/lib/press/booklet/impose");
        const b = projectStore.get().booklet ?? newBooklet("classic");
        if (!projectStore.get().booklet) projectStore.apply((d) => { d.booklet = b; });
        zip.file(`${slug()}-booklet.pdf`, await imposeBooklet(b, projectStore.get(), artImgRef.current, (m) => setMsg(m)));
        lines.push("booklet.pdf — print duplex (flip on short edge), cut, fold, two staples");
      }
      lines.push("", "everything was rendered on your device. nothing was uploaded. — the pressing plant");
      zip.file("WHATS-IN-THE-BOX.txt", lines.join("\n"));
      setMsg("zipping the kit…");
      download(await zip.generateAsync({ type: "blob" }), `${slug()}-${template.id}-kit.zip`);
      setMsg(`✓ the whole kit — ${legacy ? 1 : template.surfaces.length}${template.id === "jewel" ? " pieces + booklet" : " pieces"}, one zip`);
    } catch (e) {
      setMsg(`kit failed: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  if (mode === "easy") return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-5">
      <div className="flex items-center justify-between">
        <p className={LABEL}>Easy press <span className="normal-case tracking-normal text-zinc-700">— feed it once, get every piece</span></p>
        <span className="flex items-center gap-2">
          <p title={postureOf(engine).blurb}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] ${postureOf(engine).tone}`}>
            {postureOf(engine).label}
          </p>
          <button onClick={() => setModePersist("pro")}
            className="rounded-full border border-zinc-800 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300">⚙ pro mode</button>
        </span>
      </div>
      <div className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
        <aside className="space-y-4">
          {dropPanel}
          {receipts && (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">choices made for you</p>
              <ul className="mt-1 space-y-0.5">{receipts.map((r, i) => <li key={i} className={HINT}>· {r}</li>)}</ul>
              <p className={`${HINT} mt-1 text-zinc-700`}>change anything in ⚙ pro mode · ctrl-z undoes</p>
            </div>
          )}
          <IntakeLedger project={project} />
        </aside>
        <section className="space-y-4">
          {legacy ? (
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
              <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
                <rect width={W} height={H} fill="#050505" />
                {artUrl && place && artDim && (
                  <>
                    <defs><clipPath id="ezArtClip"><rect x={place.dx} y={place.dy} width={place.dw} height={place.dh} /></clipPath></defs>
                    <image href={artUrl}
                      x={place.dx - (place.sx * place.dw) / place.sw}
                      y={place.dy - (place.sy * place.dh) / place.sh}
                      width={(artDim.w * place.dw) / place.sw}
                      height={(artDim.h * place.dh) / place.sh}
                      clipPath="url(#ezArtClip)" preserveAspectRatio="none" />
                  </>
                )}
                {!artUrl && <text x={W / 2 + 130} y={H / 2} fontFamily="Bebas Neue" fontSize="72" fill="#26262e" textAnchor="middle">FEED ME YOUR SONG</text>}
                <g dangerouslySetInnerHTML={{ __html: overlaySVG.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "") }} />
              </svg>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {spread?.map(({ sf, svg }) => (
                <figure key={sf.id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-black p-2">
                  <div className="grid place-items-center [&>svg]:h-auto [&>svg]:max-h-[360px] [&>svg]:w-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
                  <figcaption className={`${HINT} mt-1.5 text-center`}>{sf.name} · {sf.size.w}×{sf.size.h}mm</figcaption>
                </figure>
              ))}
            </div>
          )}
          <button onClick={pressKit} disabled={busy}
            className="w-full rounded-full border border-amber-400/50 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-amber-300 transition hover:bg-amber-400/10 disabled:opacity-40">
            {busy ? "pressing…" : `PRESS THE WHOLE KIT — every piece${template.id === "jewel" ? " + booklet" : ""}, one zip`}
          </button>
          {msg && <p className={`${HINT} text-center`}>{msg}</p>}
          <details className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <summary className={`${LABEL} cursor-pointer select-none`}>See it in 3D <span className="normal-case tracking-normal text-zinc-700">— spin it, film it</span></summary>
            <div className="mt-3"><StudioScene project={project} artImg={artImgRef.current} /></div>
          </details>
        </section>
      </div>
    </div>
  );

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* preview */}
      <section className="lg:sticky lg:top-6 lg:h-fit">
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
          {legacy ? (
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
          ) : (
            <div className="grid place-items-center p-4 [&>svg]:h-auto [&>svg]:max-h-[78vh] [&>svg]:w-auto [&>svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: surfaceSVG ?? "" }} />
          )}
        </div>
        {!legacy && activeSurface && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
            {template.surfaces.map((s) => (
              <button key={s.id} onClick={() => setSurfaceId(s.id)}
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${activeSurface.id === s.id ? "border-amber-400/60 text-amber-300" : "border-zinc-800 text-zinc-600 hover:text-zinc-400"}`}>
                {s.name}
              </button>
            ))}
            <span className={`${HINT} ml-2`}>{activeSurface.size.w}×{activeSurface.size.h}mm{activeSurface.folds?.length ? " · fold guides shown" : ""}</span>
          </div>
        )}
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
          <div className="flex flex-wrap gap-1">
            {(legacy
              ? ["THE DROP", "THE LOOK", "THE FACTS", "THE BOOTH"] as Room[]
              : template.id === "jewel"
                ? ["THE DROP", "THE LOOK", "THE PRINT SHOP", "THE BINDERY", "THE FACTS", "THE BOOTH"] as Room[]
                : ["THE DROP", "THE LOOK", "THE PRINT SHOP", "THE FACTS", "THE BOOTH"] as Room[]).map((r) => (
              <button key={r} onClick={() => setRoom(r)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition ${room === r ? "border-amber-400/60 text-amber-300" : "border-zinc-800 text-zinc-600 hover:text-zinc-400"}`}>
                {r}
              </button>
            ))}
          </div>
          <span className="flex gap-1">
            <button onClick={() => setModePersist("easy")} title="back to the spoonfed spread"
              className="rounded-full border border-zinc-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300">← easy</button>
            <button onClick={doSurprise} title="derive everything derivable, with receipts"
              className="rounded-full border border-amber-400/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300/90 hover:bg-amber-400/10">surprise me</button>
            <button onClick={() => projectStore.undo()} disabled={!projectStore.canUndo()} title="undo (ctrl-z)"
              className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500 disabled:opacity-30">↺</button>
            <button onClick={() => projectStore.redo()} disabled={!projectStore.canRedo()} title="redo"
              className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500 disabled:opacity-30">↻</button>
          </span>
        </div>
        <p title={postureOf(engine).blurb}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] ${postureOf(engine).tone}`}>
          {postureOf(engine).label}
        </p>

        {room === "THE DROP" && dropPanel}

        {room === "THE PRINT SHOP" && !legacy && (
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className={LABEL}>The print shop <span className="normal-case tracking-normal text-zinc-700">— every surface has a sane default</span></p>
            <ul className="space-y-1.5">
              {template.surfaces.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <button onClick={() => setSurfaceId(s.id)} className={`text-left text-xs ${activeSurface?.id === s.id ? "text-amber-300" : "text-zinc-400 hover:text-zinc-200"}`}>
                    {activeSurface?.id === s.id ? "●" : "○"} {s.name}
                  </button>
                  <span className={HINT}>{s.size.w}×{s.size.h}mm{s.shape === "circle" ? " · disc" : ""}{s.holes?.length ? ` · ${s.holes.length} hole${s.holes.length > 1 ? "s" : ""}` : ""}{s.folds?.length ? ` · ${s.folds.length} folds` : ""}</span>
                </li>
              ))}
            </ul>
            <p className={HINT}>Tap a surface to see it on the bench. PRINT IT presses the whole run — one file per surface, fold guides excluded from exports, holes punched to true transparency. Per-surface fine-tuning (move the type, swap the art) opens up in the next expansion.</p>
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
                  {Object.entries(COLLECTOR_PALETTES).filter(([k]) => !isShelved(k, project.analysis?.exclusions)).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                  {Object.entries(COLLECTOR_PALETTES).some(([k]) => isShelved(k, project.analysis?.exclusions)) && (
                    <optgroup label="⊘ shelved by your exclusions">
                      {Object.entries(COLLECTOR_PALETTES).filter(([k]) => isShelved(k, project.analysis?.exclusions)).map(([k, p]) => <option key={k} value={k}>⊘ {p.label}</option>)}
                    </optgroup>
                  )}
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
            <div className="border-t border-zinc-800 pt-3">
              <SeedDrawer lyrics={project.lyrics} />
            </div>
            <div className="border-t border-zinc-800 pt-3">
              <UpgradePath project={project} onEngine={setEngine} onDirection={setDirector}
                onArt={(blob) => { attachArt(blob); }} />
              {director && (
                <div className="mt-2 space-y-1.5">
                  {director.mood && <p className={HINT}>the read: <b className="text-zinc-400">{director.mood}</b></p>}
                  {director.concepts.map((c, i) => (
                    <button key={i} onClick={() => { void navigator.clipboard.writeText(c.prompt); setMsg(`"${c.name}" prompt copied`); }}
                      className="block w-full rounded-lg border border-zinc-800 px-3 py-2 text-left transition hover:border-amber-400/50">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-amber-300/90">{c.name}</span>
                      <span className={`${HINT} line-clamp-2 block`}>{c.prompt}</span>
                    </button>
                  ))}
                  {director.spineWords.length > 0 && (
                    <p className={HINT}>spine picks:{" "}
                      {director.spineWords.map((w) => (
                        <button key={w} onClick={() => projectStore.apply((d) => { d.identity.spineWord = w.toUpperCase(); })}
                          className="mr-1.5 underline decoration-dotted hover:text-amber-300">{w.toUpperCase()}</button>
                      ))}
                    </p>
                  )}
                  <span className="flex gap-2">
                    {director.linerNotes && (
                      <button onClick={() => { if (project.booklet) { applyDirectionToBooklet(director); setMsg("liner notes drafted onto the READ page — labeled a read, not a fact; edit freely"); } else setMsg("open THE BINDERY (jewel case) first — then I can draft the READ page"); }}
                        className="rounded-full border border-zinc-700 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-amber-300">use as liner notes</button>
                    )}
                    {director.levelNames && director.levelNames.length > 0 && (project.analysis?.sections?.length ?? 0) > 0 && (
                      <button onClick={() => { projectStore.apply((d) => { d.analysis!.sections = d.analysis!.sections!.map((sc, i) => ({ ...sc, name: (director.levelNames![i] ?? sc.name).toUpperCase() })); }); setMsg("map levels named — see the DELUXE booklet"); }}
                        className="rounded-full border border-zinc-700 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-amber-300">name the map levels</button>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {room === "THE BINDERY" && template.id === "jewel" && (
          <BookletBuilder project={project} artUrl={artUrl} artDim={artDim} artImg={artImgRef.current} />
        )}

        {room === "THE BOOTH" && (
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className={LABEL}>The booth <span className="normal-case tracking-normal text-zinc-700">— your print is done; this room is for showing it off</span></p>
            <StudioScene project={project} artImg={artImgRef.current} />
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

        {receipts && (
          <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">here&apos;s what I chose, and why</p>
            <ul className="mt-1 space-y-0.5">
              {receipts.map((r, i) => <li key={i} className={HINT}>· {r}</li>)}
            </ul>
            <p className={`${HINT} mt-1 text-zinc-700`}>hit SURPRISE ME again to re-roll · ctrl-z undoes the lot</p>
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
