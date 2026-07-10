"use client";
// THE BOOKLET — the insert inside the case. CD liner notes × game manual,
// flipped one page at a time. Renders nothing until planets/<slug>/booklet.json
// exists on R2 (SonicDossier pattern), so shipping a new booklet needs zero
// deploys. Every page renders defensively: a missing block is simply absent.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BookletData, BookletPage } from "@/lib/booklet";
import { InstrumentGlyph } from "@/components/StemGlyphs";
import type { StemName } from "@/lib/stemSense";
import { cardUrl, fmtTime } from "@/lib/collection";

const PLANET_BASE = "https://pub-d3fd6ef07c3a4fc79ec69aa81645f904.r2.dev";
const LINES_PER_PAGE = 20;

// lyrics arrive as one block — split into booklet pages at line boundaries
function paginate(pages: BookletPage[]): BookletPage[] {
  const out: BookletPage[] = [];
  for (const p of pages) {
    if (p.type !== "lyrics") { out.push(p); continue; }
    const lines = p.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += LINES_PER_PAGE)
      out.push({ ...p, text: lines.slice(i, i + LINES_PER_PAGE).join("\n") });
  }
  return out;
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="font-mono text-[9px] uppercase tracking-[0.32em] text-white/35">{children}</p>
);

function PageBody({ page, slug, accent }: { page: BookletPage; slug: string; accent: string }) {
  switch (page.type) {
    case "cover":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <Label>official transmission manual</Label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardUrl(slug)} alt="" className="w-3/5 rounded-md object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <p className="font-display text-2xl font-black uppercase leading-tight tracking-tight text-white">{page.title}</p>
          {page.tagline ? <p className="max-w-[85%] font-mono text-[11px] leading-5 tracking-[0.12em] text-white/55">“{page.tagline}”</p> : null}
          <p className="font-mono text-[10px] tracking-[0.2em]" style={{ color: accent }}>
            {page.genre ? `${page.genre.toUpperCase()} · ` : ""}№ {page.bookletNo}
          </p>
        </div>
      );
    case "read":
      return (
        <div>
          <Label>the read</Label>
          <p className="mt-3 whitespace-pre-wrap text-[13px] leading-7 text-white/75">{page.body}</p>
          {page.styleSentence ? (
            <p className="mt-4 border-l-2 pl-3 text-[12px] italic leading-6 text-white/50" style={{ borderColor: accent }}>“{page.styleSentence}”</p>
          ) : null}
          {page.mood?.length ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {page.mood.map((m) => <span key={m} className="rounded-sm border border-white/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">{m}</span>)}
            </div>
          ) : null}
        </div>
      );
    case "lyrics":
      return (
        <div>
          <div className="flex items-baseline justify-between">
            <Label>the words</Label>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: accent }}>
              {page.official ? "official lyrics" : "transcribed on device"}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[12px] leading-6 text-white/70">{page.text}</p>
        </div>
      );
    case "world":
      return (
        <div className="flex h-full flex-col">
          <Label>the world</Label>
          <div className="mt-3 grid flex-1 grid-cols-2 content-start gap-2">
            {page.art.slice(0, 6).map((u) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={u} src={u} alt="" loading="lazy" className="aspect-square w-full rounded-md object-cover" />
            ))}
          </div>
          {page.caption ? <p className="mt-3 text-center font-mono text-[10px] uppercase leading-5 tracking-[0.18em] text-white/45">{page.caption}</p> : null}
        </div>
      );
    case "band":
      return (
        <div>
          <Label>the band{page.approx ? " (approx)" : ""}</Label>
          <div className="mt-3 space-y-2.5">
            {page.members.map((m) => (
              <div key={m.stem} className="flex items-center gap-3 rounded-md border border-white/10 bg-black/25 px-3 py-2">
                <InstrumentGlyph stem={m.stem as StemName} size={30} />
                <div className="min-w-0">
                  <p className="font-mono text-[10px] tracking-[0.2em] text-white">{m.name}</p>
                  {m.bio ? <p className="truncate text-[11px] leading-5 text-white/55">{m.bio}</p> : null}
                </div>
              </div>
            ))}
          </div>
          {page.vocalStyle ? <p className="mt-3 font-mono text-[10px] tracking-[0.14em] text-white/40">VOICE · {page.vocalStyle.toUpperCase()}</p> : null}
        </div>
      );
    case "howto":
      return (
        <div>
          <Label>how to play</Label>
          <div className="mt-3 space-y-3 text-[12px] leading-6 text-white/65">
            {page.performs ? <p><b className="text-white/85">▶ PLAY THE SHOW</b> — the words take the stage and perform in time with the music.</p> : null}
            <p><b className="text-white/85">TAP</b> a word to trigger its effect. <b className="text-white/85">DRAG</b> it around the stage. <b className="text-white/85">FLING</b> it and watch it fly.</p>
            {page.stems > 0 ? <p><b className="text-white/85">THE MIXER</b> — {page.stems} isolated instruments. Tap a band member to mute them; the song rebuilds around who&apos;s left.</p> : null}
            {page.dynamicActs > 0 ? <p><b style={{ color: accent }}>⚡ DYNAMIC+</b> — this song ships with a choreographed showcase pass: {page.dynamicActs} staged act{page.dynamicActs === 1 ? "" : "s"}{page.wordFx ? ` and ${page.wordFx} custom word effects` : ""}. Push the phase button to its last stop.</p> : null}
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">no lives. no game over. replay forever.</p>
          </div>
        </div>
      );
    case "map":
      return (
        <div>
          <Label>the map</Label>
          <div className="mt-3 space-y-1.5">
            {page.levels.map((l, i) => (
              <div key={`${l.section}${i}`} className="flex items-center gap-2.5">
                <span className="w-10 shrink-0 font-mono text-[9px] tracking-wider text-white/35">{fmtTime(l.start)}</span>
                <div className="h-2 shrink-0 rounded-sm" style={{ width: `${8 + Math.max(0.1, Math.min(1, l.intensity)) * 40}px`, background: accent, opacity: 0.25 + Math.max(0.1, Math.min(1, l.intensity)) * 0.7 }} />
                <p className="min-w-0 truncate font-mono text-[10px] tracking-[0.14em] text-white/75" title={l.section}>
                  {l.name}{l.boss ? <span title="a drop lives here"> ⚠</span> : null}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-white/30">bar = measured energy · ⚠ = a drop lives here</p>
        </div>
      );
    case "specs":
      return (
        <div>
          <Label>technical specifications</Label>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {([
              ["TEMPO", page.bpm ? `${page.bpm} BPM` : null],
              ["KEY", page.key ? `${page.key}${page.mode === "minor" ? "m" : ""}${page.camelot ? ` · ${page.camelot}` : ""}` : null],
              ["RUNTIME", page.duration ? fmtTime(page.duration) : null],
              ["ENERGY", page.energy?.toUpperCase() ?? null],
              ["DYNAMICS", page.dynamicsDb != null ? `${Math.round(page.dynamicsDb)} dB` : null],
              ["TONE", page.brightness != null ? `${Math.round(page.brightness)} HZ` : null],
            ] as const).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="border-b border-white/10 pb-1.5">
                <p className="font-mono text-[9px] tracking-[0.24em] text-white/35">{k}</p>
                <p className="mt-0.5 font-mono text-[12px] tracking-[0.1em] text-white/80">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 font-mono text-[9px] uppercase leading-5 tracking-[0.18em] text-white/35">
            measured by the agenor ultimate engine{page.generatedAt ? ` · ${page.generatedAt.slice(0, 10)}` : ""}
            {page.officialLyrics ? " · official lyrics" : ""}
          </p>
        </div>
      );
    case "back":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <p className="font-mono text-[11px] tracking-[0.3em] text-white/60">{page.line}</p>
          <p className="font-mono text-[10px] tracking-[0.2em]" style={{ color: accent }}>{page.url}</p>
          <p className="font-mono text-[9px] tracking-[0.24em] text-white/30">№ {page.bookletNo} · KEEP THIS INSERT</p>
        </div>
      );
    default:
      return null;
  }
}

export interface BookletHandle {
  /** open the booklet if one exists; returns whether it did */
  open: () => boolean;
}

const Booklet = forwardRef<BookletHandle, { slug: string; accent: string }>(function Booklet({ slug, accent }, ref) {
  const [data, setData] = useState<BookletData | null>(null);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [touchX, setTouchX] = useState<number | null>(null);

  useImperativeHandle(ref, () => ({
    open: () => {
      if (!data) return false;
      setIdx(0); setOpen(true);
      return true;
    },
  }), [data]);

  useEffect(() => {
    let dead = false;
    fetch(`${PLANET_BASE}/planets/${slug}/booklet.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!dead && j?.pages?.length) setData(j); })
      .catch(() => {});
    return () => { dead = true; };
  }, [slug]);

  const pages = useMemo(() => (data ? paginate(data.pages) : []), [data]);
  const turn = useCallback((d: number) => {
    setDir(d);
    setIdx((i) => Math.max(0, Math.min(pages.length - 1, i + d)));
  }, [pages.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") turn(1);
      else if (e.key === "ArrowLeft") turn(-1);
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, turn]);

  if (!data) return null;

  return (
    <>
      <button onClick={() => { setIdx(0); setOpen(true); }}
        className="mt-4 rounded-sm border border-white/20 px-5 py-3 font-mono text-sm tracking-[0.16em] text-white/70 transition hover:border-white/60 hover:text-white">
        📖 OPEN THE BOOKLET
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={() => setOpen(false)}>
            <div className="relative w-full max-w-[440px] px-4" onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchX == null) return;
                const dx = e.changedTouches[0].clientX - touchX;
                if (Math.abs(dx) > 40) turn(dx < 0 ? 1 : -1);
                setTouchX(null);
              }}>
              {/* the page */}
              <div className="relative overflow-hidden rounded-lg border border-white/15 bg-[#0c0c10]"
                style={{ boxShadow: `0 30px 90px -30px ${accent}55`, aspectRatio: "4 / 5" }}>
                <AnimatePresence mode="popLayout" custom={dir}>
                  <motion.div key={idx}
                    initial={{ rotateY: dir > 0 ? 60 : -60, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: dir > 0 ? -40 : 40, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 26 }}
                    style={{ transformPerspective: 1100 }}
                    className="absolute inset-0 overflow-y-auto p-6">
                    <PageBody page={pages[idx]} slug={slug} accent={accent} />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* controls */}
              <div className="mt-3 flex items-center justify-between">
                <button onClick={() => turn(-1)} disabled={idx === 0}
                  className="rounded-sm border border-white/20 px-4 py-2 font-mono text-xs tracking-[0.2em] text-white/70 transition enabled:hover:border-white/60 enabled:hover:text-white disabled:opacity-30">←</button>
                <p className="font-mono text-[10px] tracking-[0.28em] text-white/40">PAGE {idx + 1} / {pages.length}</p>
                <button onClick={() => turn(1)} disabled={idx === pages.length - 1}
                  className="rounded-sm border border-white/20 px-4 py-2 font-mono text-xs tracking-[0.2em] text-white/70 transition enabled:hover:border-white/60 enabled:hover:text-white disabled:opacity-30">→</button>
              </div>
              <button onClick={() => setOpen(false)}
                className="absolute -top-10 right-4 font-mono text-xs tracking-[0.2em] text-white/50 transition hover:text-white">✕ CLOSE</button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
});

export default Booklet;
