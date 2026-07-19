"use client";

// CASE MAKER — Cover Studio 2 P6, FREE tier (docs/THREE-LEVELS.md).
// Print your own collector case: drop art, name it, pick the genre bucket,
// optionally feed the actual song for a true waveform — download a 2048² PNG.
// Everything runs in this tab; no upload, no account, no server. The same
// layout engine that prints the AGENOR shelf (webEngine.ts twin of
// scripts/song-art/collector/engine.mjs), with YOUR label on the chrome.

import { useEffect, useMemo, useRef, useState } from "react";
import { COLLECTOR_PALETTES, classifyCollector } from "@/lib/studio/collectorPalettes";
import { buildOverlaySVG, artPlacement, peaksFromAudio, audioDuration, fmtTime, renderCasePNG, type CaseSpec, W, H } from "@/lib/collector/webEngine";

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500";
const HINT = "text-[11px] leading-4 text-zinc-600";
const FIELD = "mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-700 focus:border-amber-400/60 focus:outline-none";

export default function CaseMakerPage() {
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [artDim, setArtDim] = useState<{ w: number; h: number } | null>(null);
  const artImgRef = useRef<HTMLImageElement | null>(null);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [palette, setPalette] = useState("auto");
  const [spine, setSpine] = useState("");
  const [label, setLabel] = useState("");
  const [handle, setHandle] = useState("");
  const [lang, setLang] = useState("");
  const [geo, setGeo] = useState("");
  const [bpm, setBpm] = useState("");
  const [runtime, setRuntime] = useState("");
  const [series, setSeries] = useState("");
  const [explicit, setExplicit] = useState(false);
  const [unreleased, setUnreleased] = useState(false);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const spec: CaseSpec = useMemo(() => ({
    title: title || "UNTITLED",
    genre: genre || null,
    palette: palette === "auto" ? null : palette,
    spine: spine.trim() || null,
    label: label.trim() || "YOUR LABEL",
    handle: handle.trim() || null,
    lang: lang.trim() || null,
    geo: geo.trim() || null,
    series: series.trim() || null,
    bpm: Number(bpm) > 0 ? Math.round(Number(bpm)) : null,
    runtime: runtime.trim() || null,
    peaks,
    explicit, unreleased,
  }), [title, genre, palette, spine, label, handle, lang, geo, series, bpm, runtime, peaks, explicit, unreleased]);

  const overlaySVG = useMemo(() => buildOverlaySVG(spec), [spec]);
  const place = artDim ? artPlacement(artDim.w, artDim.h) : null;
  const autoKey = classifyCollector(genre || null).key;

  function onArt(f: File | null) {
    if (!f) return;
    if (artUrl) URL.revokeObjectURL(artUrl);
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { artImgRef.current = img; setArtDim({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.src = url;
    setArtUrl(url);
    setMsg(null);
  }

  async function onAudio(f: File | null) {
    if (!f) return;
    setMsg("reading the song (stays in your browser)…");
    const [p, d] = await Promise.all([peaksFromAudio(f), audioDuration(f)]);
    setPeaks(p);
    if (d && !runtime.trim()) setRuntime(fmtTime(d));
    setAudioName(f.name);
    setMsg(p ? "✓ true waveform captured from your audio" : "couldn't decode that audio file");
  }

  async function download() {
    if (!artImgRef.current || busy) return;
    setBusy(true); setMsg("printing 2048² PNG…");
    try {
      const blob = await renderCasePNG(artImgRef.current, spec);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(title || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "case"}-collector.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg("✓ printed — check your downloads");
    } catch (e) {
      setMsg(`print failed: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  useEffect(() => () => { if (artUrl) URL.revokeObjectURL(artUrl); }, [artUrl]);

  return (
    <main className="min-h-[100dvh] bg-[#050510] text-zinc-200">
      {/* the preview + export SVGs draw with these exact families */}
      <style>{`
        @font-face{font-family:"Bebas Neue";src:url(/fonts/BebasNeue-Regular.ttf) format("truetype")}
        @font-face{font-family:"Barlow Condensed Medium";src:url(/fonts/BarlowCondensed-Medium.ttf) format("truetype")}
        @font-face{font-family:"Barlow Condensed SemiBold";src:url(/fonts/BarlowCondensed-SemiBold.ttf) format("truetype")}
        @font-face{font-family:"Barlow Condensed Bold";src:url(/fonts/BarlowCondensed-Bold.ttf) format("truetype")}
      `}</style>

      <header className="mx-auto flex max-w-[1400px] items-baseline justify-between px-5 pt-8">
        <div>
          <h1 className="font-display text-2xl font-black tracking-[0.2em] text-amber-300">CASE MAKER</h1>
          <p className={`${HINT} mt-1 max-w-[520px]`}>
            Print your song like a collector&apos;s edition — the same case engine behind the AGENOR shelf, with your name on the spine.
            <span className="text-emerald-500"> Everything happens in this tab: your art and audio never leave your machine.</span>
          </p>
        </div>
        <span className="flex flex-col items-end gap-1">
          <a href="/music" className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600 transition hover:text-zinc-300">the shelf →</a>
          <a href="/press" className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-400/70 transition hover:text-amber-300">more formats → the pressing plant</a>
        </span>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── live preview ── */}
        <section className="lg:sticky lg:top-6 lg:h-fit">
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
              <rect width={W} height={H} fill="#050505" />
              {artUrl && place && (
                <>
                  <defs>
                    <clipPath id="artClip"><rect x={place.dx} y={place.dy} width={place.dw} height={place.dh} /></clipPath>
                  </defs>
                  <image
                    href={artUrl}
                    x={place.dx - (place.sx * place.dw) / place.sw}
                    y={place.dy - (place.sy * place.dh) / place.sh}
                    width={(artDim!.w * place.dw) / place.sw}
                    height={(artDim!.h * place.dh) / place.sh}
                    clipPath="url(#artClip)"
                    preserveAspectRatio="none"
                  />
                </>
              )}
              {!artUrl && (
                <text x={W / 2 + 130} y={H / 2} fontFamily="Bebas Neue" fontSize="72" fill="#26262e" textAnchor="middle">DROP YOUR ART TO BEGIN</text>
              )}
              <g dangerouslySetInnerHTML={{ __html: overlaySVG.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "") }} />
            </svg>
          </div>
          <p className={`${HINT} mt-2 text-center`}>live preview · exports at 2048 × 2048</p>
        </section>

        {/* ── controls ── */}
        <aside className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div>
              <p className={LABEL}>Art</p>
              <input type="file" accept="image/*" onChange={(e) => onArt(e.target.files?.[0] || null)}
                className="mt-1 w-full text-xs text-zinc-500 file:mr-3 file:rounded-full file:border file:border-zinc-700 file:bg-transparent file:px-3 file:py-1 file:text-[10px] file:font-semibold file:uppercase file:tracking-wider file:text-zinc-400" />
            </div>
            <div>
              <p className={LABEL}>Title</p>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Midnight Getaway (VIP Mix)" className={FIELD} />
              <p className={`${HINT} mt-1`}>A parenthetical becomes the spine&apos;s subtitle, like the real shelf.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className={LABEL}>Genre</p>
                <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Deep House" className={FIELD} />
                <p className={`${HINT} mt-1`}>bucket: {COLLECTOR_PALETTES[autoKey].label}</p>
              </div>
              <div>
                <p className={LABEL}>Palette</p>
                <select value={palette} onChange={(e) => setPalette(e.target.value)} className={FIELD}>
                  <option value="auto">auto — {COLLECTOR_PALETTES[autoKey].label}</option>
                  {Object.entries(COLLECTOR_PALETTES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className={LABEL}>Your imprint</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className={HINT}>Label / artist name</p>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="YOUR LABEL" className={FIELD} />
              </div>
              <div>
                <p className={HINT}>Handle <span className="text-zinc-700">(small red line)</span></p>
                <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="yourhandle" className={FIELD} />
              </div>
            </div>
            <p className={HINT}>The header band, the seal monogram, and the footer carry this — it&apos;s your case, not ours.</p>
          </div>

          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className={LABEL}>The facts <span className="normal-case tracking-normal text-zinc-700">— printed only if you provide them</span></p>
            <div>
              <p className={HINT}>Audio file → true waveform + runtime {audioName ? <span className="text-emerald-500">({audioName})</span> : null}</p>
              <input type="file" accept="audio/*" onChange={(e) => onAudio(e.target.files?.[0] || null)}
                className="mt-1 w-full text-xs text-zinc-500 file:mr-3 file:rounded-full file:border file:border-zinc-700 file:bg-transparent file:px-3 file:py-1 file:text-[10px] file:font-semibold file:uppercase file:tracking-wider file:text-zinc-400" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <p className={HINT}>BPM</p>
                <input value={bpm} onChange={(e) => setBpm(e.target.value)} inputMode="numeric" placeholder="124" className={FIELD} />
              </div>
              <div>
                <p className={HINT}>Runtime</p>
                <input value={runtime} onChange={(e) => setRuntime(e.target.value)} placeholder="3:24" className={FIELD} />
              </div>
              <div>
                <p className={HINT}>Lang</p>
                <input value={lang} onChange={(e) => setLang(e.target.value)} placeholder="EN" className={FIELD} />
              </div>
              <div>
                <p className={HINT}>Geo</p>
                <input value={geo} onChange={(e) => setGeo(e.target.value)} placeholder="TOKYO" className={FIELD} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className={HINT}>Spine word <span className="text-zinc-700">(blank = genre bucket)</span></p>
                <input value={spine} onChange={(e) => setSpine(e.target.value)} placeholder={COLLECTOR_PALETTES[autoKey].label} className={FIELD} />
              </div>
              <div>
                <p className={HINT}>Series</p>
                <input value={series} onChange={(e) => setSeries(e.target.value)} placeholder="Night Drives" className={FIELD} />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} className="accent-amber-400" />
                explicit
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input type="checkbox" checked={unreleased} onChange={(e) => setUnreleased(e.target.checked)} className="accent-amber-400" />
                unreleased
              </label>
            </div>
          </div>

          <button onClick={download} disabled={!artUrl || busy}
            className="w-full rounded-full border border-amber-400/50 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-amber-300 transition hover:bg-amber-400/10 disabled:opacity-30">
            {busy ? "printing…" : "Print the case — download PNG"}
          </button>
          {msg && <p className={`${HINT} text-center`}>{msg}</p>}
          <p className={`${HINT} text-center`}>FREE edition · no account, no upload, no tracking — the print happens on your device.</p>
        </aside>
      </div>
    </main>
  );
}
