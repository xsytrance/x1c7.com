"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE ATELIER — the owner's private salon. The ENTIRE lexicon hung on one
// endless gallery wall: every word is a numbered room, every image it owns
// hangs framed with a brass plaque (sense · recipe · engine). The public
// /lexicon browser is word-first; this is paint-first — built to watch the
// 21k-image gallery grow night by night.
//
// Internal only: served from the tailnet (isPrivateHost), like the Studio's
// lyrics inbox. On a public host it shows a closed door.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Lexicon, WordEntry, WordSense } from "@/lib/lexicon/types";
import { loadLexicon } from "@/lib/lexicon/lookup";
import { isPrivateHost } from "@/lib/privateHost";
import lexiconData from "@/data/lexicon.json";

/* eslint-disable @next/next/no-img-element */

const BUNDLED = lexiconData as unknown as Lexicon;
const PER_SENSE = 4; // the gallery target the Atelier paints toward

// ── recipe → engine registry (mirror of scripts/lexicon/art.mjs) ────────────
const ENGINE_OF: Record<string, string> = {
  cinema: "SDXL Turbo", noir: "SDXL Turbo",
  photo: "Z-Image", "neon-night": "Z-Image",
  "dream-collage": "FLUX.2 klein", poster: "FLUX.2 klein",
  "word-portrait": "Qwen-Image", "word-neon": "Qwen-Image",
  "dark-surreal": "Chroma", "oil-light": "Chroma",
  "film-still": "Juggernaut", analog: "Juggernaut",
  "concept-art": "DreamShaper", watercolor: "DreamShaper", storybook: "DreamShaper",
  papercut: "DreamShaper", "3d-toy": "DreamShaper", pixel: "DreamShaper",
  stickers: "DreamShaper", chalkboard: "DreamShaper", "neon-sign": "DreamShaper",
  "stained-glass": "DreamShaper", "graphic-novel": "DreamShaper",
  anime: "Animagine", "manga-line": "Animagine",
};
const ENGINE_HUE: Record<string, string> = {
  "SDXL Turbo": "#8b7cf6", "Z-Image": "#22d3ee", "FLUX.2 klein": "#f59e0b",
  "Qwen-Image": "#f472b6", Chroma: "#ef4444", Juggernaut: "#34d399",
  DreamShaper: "#a3e635", Animagine: "#60a5fa", "first brush": "#6b7280",
};

/** s0-3-word-portrait.webp → { slot: "s0-3", recipe: "word-portrait" } */
function parseFrame(url: string): { recipe: string; engine: string } {
  const m = url.match(/\/s\d+-\d+-([a-z0-9-]+)\.webp$/);
  const recipe = m?.[1] ?? "first brush";
  return { recipe, engine: ENGINE_OF[recipe] ?? "first brush" };
}

function moodBucket(emotion: string): "dark" | "sad" | "warm" | "bright" | "any" {
  const e = (emotion || "").toLowerCase();
  if (/dark|angry|aggress|brood|sinister|haunt|ominous|tense|fear|menac|rage/.test(e)) return "dark";
  if (/melanchol|sad|sorrow|longing|grief|bittersweet|wistful|lonel|yearn|regret|somber/.test(e)) return "sad";
  if (/nostalg|warm|tender|love|romantic|intimate|hope|gentle|peace|serene|dream|calm|reflect/.test(e)) return "warm";
  if (/euphor|uplift|joy|happy|celebrat|energetic|playful|triumph|empower|confident|fierce|party|dance|excit/.test(e)) return "bright";
  return "any";
}
const BUCKET_LABEL = { dark: "◆ dark", sad: "◆ blue", warm: "◆ warm", bright: "◆ bright" } as const;
const BUCKET_HUE = { dark: "#7c3aed", sad: "#38bdf8", warm: "#fb923c", bright: "#facc15" } as const;

type Frame = { url: string; word: string; senseIdx: number; emotion: string; gloss: string; recipe: string; engine: string; prompt: string };

// ── one hung painting ────────────────────────────────────────────────────────
function Painting({ f, onOpen }: { f: Frame; onOpen: (f: Frame) => void }) {
  return (
    <figure className="group mb-3 break-inside-avoid">
      <button onClick={() => onOpen(f)} className="block w-full overflow-hidden rounded-md border border-white/12 bg-black/40 p-1.5 transition hover:border-white/35">
        <img src={f.url} alt={`${f.word} — ${f.recipe}`} loading="lazy"
          className="w-full rounded-[3px] object-cover transition duration-500 group-hover:scale-[1.015]" />
      </button>
      <figcaption className="mt-1 flex items-center justify-between gap-2 px-0.5 font-mono text-[8px] uppercase tracking-[0.15em] text-white/40">
        <span className="truncate">{f.emotion}</span>
        <span className="flex shrink-0 items-center gap-1" style={{ color: ENGINE_HUE[f.engine] }}>
          <span className="inline-block h-1 w-1 rounded-full" style={{ background: ENGINE_HUE[f.engine] }} />
          {f.recipe}
        </span>
      </figcaption>
    </figure>
  );
}

// ── one word = one numbered room ─────────────────────────────────────────────
function Room({ entry, no, recipeFilter, onOpen }: { entry: WordEntry; no: number; recipeFilter: string | null; onOpen: (f: Frame) => void }) {
  const frames = useMemo(() => {
    const out: Frame[] = [];
    entry.senses.forEach((s: WordSense, i: number) => {
      for (const url of s.images ?? []) {
        const { recipe, engine } = parseFrame(url);
        if (recipeFilter && recipe !== recipeFilter) continue;
        out.push({ url, word: entry.word, senseIdx: i, emotion: s.emotion, gloss: s.gloss, recipe, engine, prompt: s.imageryPrompts?.[0] ?? "" });
      }
    });
    return out;
  }, [entry, recipeFilter]);

  const queued = entry.senses.reduce((n, s) => n + Math.max(0, PER_SENSE - (s.images?.length ?? 0)), 0);
  if (recipeFilter && frames.length === 0) return null;

  return (
    <section id={`w-${entry.word}`} className="mb-10">
      <header className="mb-3 flex items-baseline gap-3 border-b border-white/8 pb-2">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/25">No. {String(no).padStart(4, "0")}</span>
        <h2 className="font-display text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">{entry.word}</h2>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">
          {entry.senses.length} sense{entry.senses.length !== 1 ? "s" : ""} · ×{entry.freq} · {frames.length} hung{queued > 0 ? ` · ${queued} queued` : " · complete"}
        </span>
      </header>
      {frames.length > 0 ? (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
          {frames.map((f) => <Painting key={f.url} f={f} onOpen={onOpen} />)}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-white/10 px-4 py-6 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-white/25">
          bare walls — {queued} canvases queued for the night shift
        </p>
      )}
    </section>
  );
}

// ── lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ f, onClose, onStep }: { f: Frame; onClose: () => void; onStep: (d: 1 | -1) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onStep(1);
      if (e.key === "ArrowLeft") onStep(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep]);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={onClose}>
      <img src={f.url} alt={f.word} className="max-h-[78vh] max-w-full rounded-lg border border-white/15 object-contain" onClick={(e) => e.stopPropagation()} />
      <div className="mt-4 max-w-2xl text-center" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-2xl font-black uppercase text-white">{f.word}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-white/50">
          {f.emotion} · <span style={{ color: ENGINE_HUE[f.engine] }}>{f.recipe} — {f.engine}</span>
        </p>
        {f.prompt && <p className="mt-2 text-sm italic leading-6 text-white/40">“{f.prompt}”</p>}
        <p className="mt-2 font-mono text-[9px] text-white/25">← → to walk the wall · esc to leave</p>
      </div>
    </div>
  );
}

export default function AtelierPage() {
  const [owner, setOwner] = useState<boolean | null>(null);
  const [lex, setLex] = useState<Lexicon>(BUNDLED);
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<string | null>(null);
  const [sort, setSort] = useState<"painted" | "alpha" | "freq">("painted");
  const [rooms, setRooms] = useState(16); // incremental hang — more rooms as you walk
  const [light, setLight] = useState<Frame | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => { setOwner(isPrivateHost(window.location.hostname)); }, []);
  useEffect(() => { loadLexicon().then(setLex).catch(() => {}); }, []);

  // Light-gravity words are culled from the hanging by default (?all=1 shows
  // the featherweights too — curator/gravity.mjs decides tiers).
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { setShowAll(new URLSearchParams(window.location.search).get("all") === "1"); }, []);
  const entries = useMemo(() => {
    const all = Object.values(lex.entries);
    return showAll ? all : all.filter((e) => e.gravity?.tier !== "light");
  }, [lex, showAll]);

  // gallery-wide ledger: totals + per-recipe counts
  const ledger = useMemo(() => {
    let hung = 0, queued = 0;
    const byRecipe = new Map<string, number>();
    for (const e of entries) for (const s of e.senses) {
      const imgs = s.images ?? [];
      hung += imgs.length;
      queued += Math.max(0, PER_SENSE - imgs.length);
      for (const u of imgs) {
        const r = parseFrame(u).recipe;
        byRecipe.set(r, (byRecipe.get(r) ?? 0) + 1);
      }
    }
    return { hung, queued, target: hung + queued, byRecipe: [...byRecipe.entries()].sort((a, b) => b[1] - a[1]) };
  }, [entries]);

  const painted = (e: WordEntry) => e.senses.reduce((n, s) => n + (s.images?.length ?? 0), 0);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = entries;
    if (t) list = list.filter((e) => e.word.includes(t) || e.senses.some((s) => (s.emotion ?? "").toLowerCase().includes(t)));
    if (bucket) list = list.filter((e) => e.senses.some((s) => moodBucket(s.emotion) === bucket));
    if (recipe) list = list.filter((e) => e.senses.some((s) => (s.images ?? []).some((u) => parseFrame(u).recipe === recipe)));
    return [...list].sort((a, b) =>
      sort === "alpha" ? a.word.localeCompare(b.word)
      : sort === "freq" ? b.freq - a.freq || a.word.localeCompare(b.word)
      : painted(b) - painted(a) || b.freq - a.freq || a.word.localeCompare(b.word));
  }, [entries, q, bucket, recipe, sort]);

  // walk-the-hall pagination
  useEffect(() => { setRooms(16); }, [q, bucket, recipe, sort]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return; // sentinel remounts as filters change — re-observe each time
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) setRooms((r) => r + 16); }, { rootMargin: "1200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length, rooms]);

  // flat frame list of the CURRENT walls, for lightbox prev/next
  const allFrames = useMemo(() => {
    const out: Frame[] = [];
    for (const e of filtered.slice(0, rooms)) e.senses.forEach((s, i) => {
      for (const url of s.images ?? []) {
        const { recipe: r, engine } = parseFrame(url);
        if (recipe && r !== recipe) continue;
        out.push({ url, word: e.word, senseIdx: i, emotion: s.emotion, gloss: s.gloss, recipe: r, engine, prompt: s.imageryPrompts?.[0] ?? "" });
      }
    });
    return out;
  }, [filtered, rooms, recipe]);
  const step = useCallback((d: 1 | -1) => {
    setLight((cur) => {
      if (!cur) return cur;
      const i = allFrames.findIndex((f) => f.url === cur.url);
      return allFrames[(i + d + allFrames.length) % allFrames.length] ?? cur;
    });
  }, [allFrames]);

  if (owner === null) return <main className="min-h-screen bg-void" />;
  if (!owner) {
    return (
      <main className="grid min-h-screen place-items-center bg-void px-6 text-center">
        <div>
          <p className="font-display text-3xl font-black uppercase text-white/80">The Atelier is closed</p>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.3em] text-white/35">private hanging — the artist only</p>
        </div>
      </main>
    );
  }

  const pct = ledger.target ? Math.round((ledger.hung / ledger.target) * 100) : 0;

  return (
    <main className="min-h-screen bg-void px-4 py-10 sm:px-8">
      <header className="mx-auto max-w-6xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-white/40">private hanging · {lex.galaxy}</p>
        <h1 className="mt-2 font-display text-5xl font-black uppercase tracking-tight text-white sm:text-7xl glow-text" style={{ color: "var(--theme-primary)" }}>
          The Atelier
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-white/55">
          The whole lexicon on one wall. Five engines paint it nightly; every frame is plaqued
          with its sense and the brush that made it.
        </p>

        {/* the ledger */}
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-white/45">
            <span><b className="text-white/85">{ledger.hung.toLocaleString()}</b> hung</span>
            <span><b className="text-white/85">{ledger.queued.toLocaleString()}</b> queued for the night shift</span>
            <span>gallery of <b className="text-white/85">{ledger.target.toLocaleString()}</b></span>
            <span><b className="text-white/85">{entries.length.toLocaleString()}</b> rooms</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.max(pct, 1)}%`, background: "linear-gradient(90deg, var(--theme-primary), #22d3ee)" }} />
          </div>
          <p className="mt-1.5 text-right font-mono text-[9px] uppercase tracking-[0.25em] text-white/30">{pct}% painted</p>
          {/* per-recipe census — tap a brush to see only its work */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ledger.byRecipe.map(([r, n]) => (
              <button key={r} onClick={() => setRecipe(recipe === r ? null : r)}
                className={`rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.15em] transition ${recipe === r ? "border-white/60 text-white" : "border-white/12 text-white/50 hover:border-white/30"}`}
                style={{ color: recipe === r ? undefined : ENGINE_HUE[ENGINE_OF[r] ?? "first brush"] }}>
                {r} ×{n}
              </button>
            ))}
          </div>
        </div>

        {/* controls */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="find a word or a feeling…"
            className="w-56 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 font-mono text-xs text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none" />
          {(Object.keys(BUCKET_LABEL) as Array<keyof typeof BUCKET_LABEL>).map((b) => (
            <button key={b} onClick={() => setBucket(bucket === b ? null : b)}
              className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition ${bucket === b ? "border-white/60 text-white" : "border-white/12 text-white/45 hover:border-white/30"}`}
              style={bucket === b ? { color: BUCKET_HUE[b] } : undefined}>
              {BUCKET_LABEL[b]}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/10" />
          {(["painted", "alpha", "freq"] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)}
              className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition ${sort === s ? "border-white/60 text-white" : "border-white/12 text-white/45 hover:border-white/30"}`}>
              {s === "painted" ? "most painted" : s === "alpha" ? "a → z" : "most sung"}
            </button>
          ))}
        </div>
      </header>

      {/* the hall */}
      <div className="mx-auto mt-10 max-w-6xl">
        {filtered.slice(0, rooms).map((e, i) => (
          <Room key={e.word} entry={e} no={i + 1} recipeFilter={recipe} onOpen={setLight} />
        ))}
        {rooms < filtered.length && (
          <div ref={sentinel} className="py-10 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-white/25">
            the hall continues — {filtered.length - rooms} rooms ahead…
          </div>
        )}
        {filtered.length === 0 && (
          <p className="mt-16 text-center font-mono text-sm text-white/40">no rooms match — the atelier hasn’t painted that yet.</p>
        )}
      </div>

      <footer className="mx-auto mt-16 max-w-6xl border-t border-white/8 pt-4 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-white/25">
        the atelier paints while you sleep · next shift 1:00 am · ossicle whispers every five
      </footer>

      {light && <Lightbox f={light} onClose={() => setLight(null)} onStep={step} />}
    </main>
  );
}
