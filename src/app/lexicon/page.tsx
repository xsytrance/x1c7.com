"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE LEXICON — the word dictionary as a place you can wander. Every word is a
// little sub-planet: tap it and its senses bloom open — the vibes, palettes,
// imagery, and effect "legos" it can wear, plus which songs it came from.
//
// This is the shelf. The nightly pipeline keeps stocking it — words, legos, and
// real generated ART per word — while nobody's looking; one day a creator picks
// from here instead of calling an LLM. Renders the bundled shelf instantly, then
// upgrades to the LIVE hosted one on R2 so it always shows the latest.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BackToHub } from "@/components/BackToHub";
import type { Lexicon, WordEntry } from "@/lib/lexicon/types";
import { loadLexicon } from "@/lib/lexicon/lookup";
import { isPrivateHost } from "@/lib/privateHost";
import lexiconData from "@/data/lexicon.json";

/* eslint-disable @next/next/no-img-element */

const BUNDLED = lexiconData as unknown as Lexicon;

// A glyph for every lego, so the shelf reads at a glance.
const GLYPH: Record<string, string> = {
  // weather
  embers: "🔥", ash: "🌫️", rain: "🌧️", snow: "❄️", dust: "🌪️", bubbles: "🫧", sparks: "✨", petals: "🌸", pollen: "🌼",
  // surface
  mud: "🟤", rust: "🟧", cracks: "🕸️", condensation: "💧", vines: "🌿", moss: "🍀", blood: "🩸", sand: "🏜️",
  // veils
  fog: "🌁", frost: "🧊", steam: "♨️", static: "📺", smoke: "💨",
  // text
  burn: "🔥", shatter: "💥", dissolve: "👻", bloom: "🌷", glitch: "📼", freeze: "🧊", melt: "🫠", carve: "🪨",
  // light
  godrays: "🌅", flare: "🔆", flicker: "💡", blackout: "⬛",
};
const glyph = (m: string) => GLYPH[m] ?? "◆";

const CLASS_LABEL: Record<string, string> = {
  weather: "Weather", surface: "Surface", veils: "Veils", text: "Text", light: "Light",
};

function LegoRow({ kind, modes }: { kind: string; modes: string[] }) {
  if (!modes.length) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="w-16 shrink-0 font-mono text-[9px] uppercase tracking-[0.25em] text-white/35">{CLASS_LABEL[kind]}</span>
      <span className="flex flex-wrap gap-1.5">
        {modes.map((m) => (
          <span key={m} className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-white/75">
            <span aria-hidden>{glyph(m)}</span>{m}
          </span>
        ))}
      </span>
    </div>
  );
}

function WordPanel({ entry, onClose }: { entry: WordEntry; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0a0714]/95 p-6 sm:rounded-3xl sm:p-8"
        initial={{ y: 40, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">{entry.word}</h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
              {entry.senses.length} sense{entry.senses.length > 1 ? "s" : ""} · appears in {entry.sources.length} song{entry.sources.length > 1 ? "s" : ""} · seen ×{entry.freq}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/60 transition hover:text-white">✕</button>
        </div>

        <div className="space-y-4">
          {entry.senses.map((s, i) => (
            <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: s.palette?.[0] || "var(--theme-primary)" }}>{s.emotion}</span>
                <span className="flex gap-1">
                  {(s.palette ?? []).slice(0, 5).map((c, j) => (
                    <span key={j} className="h-3.5 w-3.5 rounded-full ring-1 ring-white/10" style={{ background: c }} title={c} />
                  ))}
                </span>
              </div>
              <div className="space-y-1.5">
                <LegoRow kind="weather" modes={s.legos?.weather ?? []} />
                <LegoRow kind="surface" modes={s.legos?.surface ?? []} />
                <LegoRow kind="veils" modes={s.legos?.veils ?? []} />
                <LegoRow kind="text" modes={s.legos?.text ?? []} />
                <LegoRow kind="light" modes={s.legos?.light ?? []} />
              </div>
              {s.images && s.images.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {s.images.map((u, j) => (
                    <img key={j} src={u} alt="" loading="lazy"
                      className="h-24 w-32 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
                  ))}
                </div>
              )}
              {s.imageryPrompts?.[0] && (
                <p className="mt-3 border-l-2 border-white/10 pl-3 text-sm italic leading-6 text-white/45">“{s.imageryPrompts[0]}”</p>
              )}
            </div>
          ))}
        </div>

        <p className="mt-5 font-mono text-[9px] uppercase tracking-wider text-white/25">
          from: {entry.sources.join(" · ")}
        </p>
      </motion.div>
    </motion.div>
  );
}

export default function LexiconPage() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  // Start with the bundled shelf (instant), then upgrade to the LIVE hosted one
  // on R2 — so the browser always shows the latest words + generated art as the
  // nightly pipeline grows it, no redeploy.
  const [lex, setLex] = useState<Lexicon>(BUNDLED);
  const [ownerHost, setOwnerHost] = useState(false);
  useEffect(() => { loadLexicon().then(setLex).catch(() => {}); }, []);
  useEffect(() => { setOwnerHost(isPrivateHost(window.location.hostname)); }, []);

  // Deep-link: open ?word= on load (shareable); reflect selection in the URL.
  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get("word");
    if (w && lex.entries[w]) setSelected((cur) => cur ?? w);
  }, [lex]);
  const open = (w: string | null) => {
    setSelected(w);
    const url = new URL(window.location.href);
    if (w) url.searchParams.set("word", w); else url.searchParams.delete("word");
    window.history.replaceState(null, "", url.toString());
  };
  const wander = () => { const ks = Object.keys(lex.entries); if (ks.length) open(ks[(Math.random() * ks.length) | 0]); };

  // Featherweight (light-gravity) words stay off the public shelf by default.
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { setShowAll(new URLSearchParams(window.location.search).get("all") === "1"); }, []);
  const entries = useMemo(() => {
    const all = Object.values(lex.entries);
    const vis = showAll ? all : all.filter((e) => e.gravity?.tier !== "light");
    return vis.sort((a, b) => b.freq - a.freq || a.word.localeCompare(b.word));
  }, [lex, showAll]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return entries;
    return entries.filter((e) => e.word.includes(t) || e.senses.some((s) => (s.emotion ?? "").toLowerCase().includes(t)));
  }, [entries, q]);

  const legoCount = useMemo(() =>
    entries.reduce((n, e) => n + e.senses.reduce((m, s) => m + Object.values(s.legos ?? {}).reduce((k, a) => k + (a?.length ?? 0), 0), 0), 0), [entries]);
  const imageCount = useMemo(() =>
    entries.reduce((n, e) => n + e.senses.reduce((m, s) => m + (s.images?.length || 0), 0), 0), [entries]);

  const sel = selected ? lex.entries[selected] : null;

  return (
    <main className="relative min-h-screen bg-void px-4 py-10 sm:px-8">
      <BackToHub />

      <header className="mx-auto mt-6 max-w-5xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-white/40">Galaxy · {lex.galaxy}</p>
        <h1 className="mt-3 font-display text-5xl font-black uppercase tracking-tight text-white sm:text-7xl glow-text" style={{ color: "var(--theme-primary)" }}>
          The Lexicon
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/55">
          Every word is a little world. A growing shelf of vibes, palettes, imagery, and effect
          “legos” — pre-built so a lyric video can be conjured without ever calling an LLM.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-white/45">
          <span><b className="text-white/80">{entries.length}</b> words</span>
          <span><b className="text-white/80">{lex.stats?.senses ?? 0}</b> senses</span>
          <span><b className="text-white/80">{legoCount}</b> legos</span>
          <span><b className="text-white/80">{imageCount}</b> images</span>
        </div>
        {ownerHost && (
          <a href="/atelier"
            className="mt-5 inline-block rounded-full border border-white/15 bg-white/[0.03] px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/60 transition hover:border-white/40 hover:text-white">
            🖼 enter the atelier — the private hanging
          </a>
        )}
      </header>

      <div className="mx-auto mt-8 flex max-w-md items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search a word or a feeling…"
          className="w-full rounded-full border border-white/15 bg-white/[0.03] px-5 py-3 text-center font-mono text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
        />
        <button onClick={wander} title="Wander to a random word"
          className="shrink-0 rounded-full border border-white/15 bg-white/[0.03] px-4 py-3 text-sm transition hover:border-white/40 hover:bg-white/10">🎲</button>
      </div>

      <div className="mx-auto mt-8 grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((e) => {
          const c = e.senses[0]?.palette?.[0] || "var(--theme-primary)";
          const allModes = e.senses.flatMap((s) => [...(s.legos?.weather ?? []), ...(s.legos?.text ?? [])]);
          const preview = Array.from(new Set(allModes)).slice(0, 4);
          const thumb = e.senses.map((s) => s.images?.[0]).find(Boolean);
          return (
            <button
              key={e.word}
              onClick={() => open(e.word)}
              className="group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 p-3 text-center transition hover:scale-[1.03] hover:border-white/25"
              style={{ background: `radial-gradient(circle at 50% 32%, color-mix(in srgb, ${c} 34%, transparent), transparent 68%), #0a0714` }}
            >
              {thumb && (
                <img src={thumb} alt="" loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-45 transition duration-500 group-hover:opacity-65 group-hover:scale-105" />
              )}
              <span className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,7,20,0.92), rgba(10,7,20,0.35) 55%, rgba(10,7,20,0.15))" }} />
              <span className="relative font-display text-lg font-black uppercase tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] sm:text-xl">{e.word}</span>
              <span className="relative mt-1 font-mono text-[8px] uppercase tracking-[0.2em] text-white/55">{e.senses.length} sense{e.senses.length > 1 ? "s" : ""}</span>
              <span className="relative mt-2 flex gap-0.5 text-sm opacity-85 transition group-hover:opacity-100">
                {preview.map((m, j) => <span key={j} aria-hidden>{glyph(m)}</span>)}
              </span>
              {e.freq > 1 && (
                <span className="absolute right-2 top-2 z-10 rounded-full bg-black/40 px-1.5 py-0.5 font-mono text-[8px] text-white/70 backdrop-blur-sm">×{e.freq}</span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="mt-16 text-center font-mono text-sm text-white/40">no words match “{q}” — yet. the shelf keeps growing.</p>
      )}

      <AnimatePresence>
        {sel && <WordPanel entry={sel} onClose={() => open(null)} />}
      </AnimatePresence>
    </main>
  );
}
