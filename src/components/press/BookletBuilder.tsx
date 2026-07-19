"use client";

// THE BINDERY — the guided booklet room. Pick a thickness, walk the page
// filmstrip with KEEP / EDIT / SKIP, print imposed fold-and-staple sheets.
// A fully kept booklet is legitimate and good; depth is opt-in, as always.

import { useMemo, useState } from "react";
import { projectStore } from "@/lib/press/state/projectStore";
import { renderSurfaceSVG } from "@/lib/press/render/renderSurface";
import { PRESETS, newBooklet, livePages, lyricsRead, type BookletState } from "@/lib/press/booklet/model";
import { pageSurface } from "@/lib/press/booklet/pageSurfaces";
import { imposeBooklet } from "@/lib/press/booklet/impose";
import type { ProjectSpec } from "@/lib/press/types";

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500";
const HINT = "text-[11px] leading-4 text-zinc-600";

export function BookletBuilder({ project, artUrl, artDim, artImg }: {
  project: ProjectSpec;
  artUrl: string | null;
  artDim: { w: number; h: number } | null;
  artImg: HTMLImageElement | null;
}) {
  const booklet = project.booklet ?? null;
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const setBooklet = (b: BookletState | null) => projectStore.apply((d) => { d.booklet = b; });
  const read = lyricsRead(project.lyrics);

  const pages = booklet ? livePages(booklet) : [];
  const thumbs = useMemo(() => pages.map((pg, i) =>
    renderSurfaceSVG(pageSurface(pg, i + 1, pages.length), project, { pxPerMm: 1.1, mode: "all", artUrl, artDim })), [pages, project, artUrl, artDim]);
  const selPage = booklet?.pages.filter((p) => !p.skip)[sel];
  const selIdxInPages = booklet ? booklet.pages.indexOf(selPage!) : -1;

  async function printBooklet() {
    if (!booklet || busy) return;
    setBusy(true);
    try {
      const blob = await imposeBooklet(booklet, project, artImg, (m) => setMsg(m));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(project.identity.title || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-booklet.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg(`✓ bound — ${livePages(booklet).length} pages imposed onto ${livePages(booklet).length / 4} duplex sheets + the fold guide`);
    } catch (e) {
      setMsg(`binding failed: ${(e as Error).message}`);
    }
    setBusy(false);
  }

  if (!booklet) {
    return (
      <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className={LABEL}>The bindery <span className="normal-case tracking-normal text-zinc-700">— how thick is your booklet?</span></p>
        {read && <p className={`${HINT} text-amber-400/80`}>{read} <span className="text-zinc-700">(our read of your lyrics)</span></p>}
        <div className="space-y-2">
          {(Object.keys(PRESETS) as BookletState["preset"][]).map((k) => {
            const locked = k === "deluxe";
            return (
              <button key={k} disabled={locked} onClick={() => setBooklet(newBooklet(k))}
                className={`block w-full rounded-xl border p-3 text-left transition ${locked ? "cursor-not-allowed border-zinc-800/60 opacity-50" : k === "classic" ? "border-amber-400/40 hover:border-amber-400/80" : "border-zinc-800 hover:border-zinc-600"}`}>
                <p className={`text-xs font-black uppercase tracking-[0.15em] ${k === "classic" ? "text-amber-300" : "text-zinc-300"}`}>
                  {PRESETS[k].label} {k === "classic" && <span className="ml-1 text-[9px] text-amber-500/70">recommended</span>}
                </p>
                <p className={HINT}>{PRESETS[k].blurb}{locked ? " — the Band and Map pages feed on stems; they unlock next expansion" : ""}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <p className={LABEL}>The bindery · {PRESETS[booklet.preset].label} <span className="normal-case tracking-normal text-zinc-700">{pages.length}pp</span></p>
        <button onClick={() => setBooklet(null)} className={`${HINT} hover:text-zinc-300`}>↺ change thickness</button>
      </div>

      {/* filmstrip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {thumbs.map((svg, i) => (
          <button key={i} onClick={() => { setSel(i); setEditing(false); }}
            className={`relative w-16 shrink-0 overflow-hidden rounded border transition ${sel === i ? "border-amber-400/70" : "border-zinc-800 hover:border-zinc-600"} [&>svg]:h-auto [&>svg]:w-full`}
            dangerouslySetInnerHTML={{ __html: svg }} />
        ))}
      </div>
      {selPage && (
        <div className="flex items-center justify-between">
          <p className={HINT}>page {sel + 1} — <b className="text-zinc-400">{selPage.kind}</b></p>
          <span className="flex gap-1.5">
            <span className="rounded-full border border-emerald-500/40 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500">keep</span>
            {["read", "credits", "lyrics"].includes(selPage.kind) && (
              <button onClick={() => setEditing((v) => !v)}
                className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-amber-300">{editing ? "done" : "edit"}</button>
            )}
            {selPage.kind !== "cover" && selPage.kind !== "back" && (
              <button onClick={() => { projectStore.apply((d) => { const pg = d.booklet!.pages[selIdxInPages]; pg.skip = true; }); setSel(0); }}
                className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500 hover:text-red-400">skip</button>
            )}
          </span>
        </div>
      )}
      {booklet.pages.some((p) => p.skip) && (
        <p className={HINT}>skipped: {booklet.pages.filter((p) => p.skip).map((p) => p.kind).join(", ")} — pagination healed{" "}
          <button onClick={() => projectStore.apply((d) => { d.booklet!.pages.forEach((pg) => { pg.skip = false; }); })} className="underline decoration-dotted hover:text-zinc-300">unskip all</button>
        </p>
      )}
      {editing && selPage && (
        <textarea rows={6} defaultValue={selPage.text ?? ""} placeholder="your words for this page (blank = the auto-fill)"
          onBlur={(e) => projectStore.apply((d) => { d.booklet!.pages[selIdxInPages].text = e.target.value || undefined; })}
          className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-700 focus:border-amber-400/60 focus:outline-none" />
      )}

      <button onClick={printBooklet} disabled={busy}
        className="w-full rounded-full border border-amber-400/50 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-300 transition hover:bg-amber-400/10 disabled:opacity-40">
        {busy ? "binding…" : "BIND IT — imposed PDF + fold guide"}
      </button>
      {msg && <p className={`${HINT} text-center`}>{msg}</p>}
      <p className={HINT}>Print duplex ("flip on short edge"), cut at the marks, fold at the dashed line, two staples on the spine. The last PDF page walks you through it.</p>
    </div>
  );
}
