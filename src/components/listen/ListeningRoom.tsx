"use client";

// THE LISTENING ROOM — one song under glass. Everything ultimate.mjs measured,
// finally drawn. Layers render only when the data exists (has.*): a partial
// analysis still gets a room. Facts are measured; reads are labeled as reads.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FAMILY_COLOR, FAMILY_LABEL, camelot, dynamicsLabel, fmtTime, midiToNote,
  toneLabel, type Bundle, type StemFamily,
} from "@/lib/listen/types";
import { Ridgeline } from "./Ridgeline";

export function ListeningRoom({ slug }: { slug: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/analyzer/${slug}.json`)
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((b: Bundle) => { if (alive) setBundle(b); })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, [slug]);

  // Vocal range — computed here because nothing else in the system reports it.
  const range = useMemo(() => {
    const w = bundle?.melody?.words;
    if (!w?.length) return null;
    const m = w.map((x) => x.midi);
    const lo = Math.min(...m), hi = Math.max(...m);
    let leap = 0;
    for (let i = 1; i < w.length; i++) leap = Math.max(leap, Math.abs(w[i].midi - w[i - 1].midi));
    return { lo, hi, semitones: Math.round(hi - lo), leap: Math.round(leap) };
  }, [bundle]);

  const families = useMemo(() => {
    if (!bundle) return [] as StemFamily[];
    return Array.from(new Set(bundle.stems.map((s) => s.family)));
  }, [bundle]);

  if (err) return <Shell><p className="font-mono text-sm text-rose-300">couldn&apos;t load the analysis for “{slug}” ({err})</p></Shell>;
  if (!bundle) return <Shell><p className="font-mono text-sm text-zinc-600">opening the room…</p></Shell>;

  const id = bundle.identity;
  const cam = camelot(id.key, id.mode);

  return (
    <Shell>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">the listening room</p>
          <h1 className="font-display text-3xl font-black tracking-tight text-zinc-50">{bundle.title}</h1>
          <p className="mt-1 max-w-[640px] text-[12px] leading-5 text-zinc-500">
            {id.genre}{id.subGenres.length ? ` · ${id.subGenres.join(", ")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/listen" className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600 transition hover:text-zinc-300">← all songs</Link>
          <Link href={`/splice`} className="font-mono text-[11px] uppercase tracking-[0.2em] text-fuchsia-500/70 transition hover:text-fuchsia-300">splice table →</Link>
        </div>
      </header>

      {/* ── ID plate: measured facts only ───────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="tempo" value={id.bpm ? `${id.bpm}` : "—"} unit="BPM" />
        <Stat label="key" value={id.key ? `${id.key}${id.mode === "minor" ? "m" : ""}` : "—"} unit={cam ?? undefined} />
        <Stat label="length" value={bundle.duration ? fmtTime(bundle.duration) : "—"} />
        <Stat label="dynamics" value={bundle.tone.dynamicsDb != null ? `${bundle.tone.dynamicsDb}` : "—"} unit={dynamicsLabel(bundle.tone.dynamicsDb) ?? "dB"} />
        <Stat label="tone" value={toneLabel(bundle.tone.brightness) ?? "—"} unit={bundle.tone.brightness ? `${Math.round(bundle.tone.brightness)} Hz` : undefined} />
        <Stat label="stems" value={`${bundle.stems.length}`} unit={range ? `${range.semitones} st range` : undefined} />
      </div>

      {/* ── legend: identity is never colour alone (lanes are labelled too) ─── */}
      <div className="mb-2 flex flex-wrap items-center gap-4">
        {families.map((f) => (
          <span key={f} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: FAMILY_COLOR[f] }} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{FAMILY_LABEL[f]}</span>
          </span>
        ))}
        <span className="ml-auto flex items-center gap-3">
          <button onClick={() => setTable(!table)} className={`font-mono text-[10px] uppercase tracking-wider transition ${table ? "text-fuchsia-300" : "text-zinc-600 hover:text-zinc-300"}`}>
            {table ? "chart ✓" : "table view"}
          </button>
        </span>
      </div>

      {/* ── the ridgeline ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
        <Ridgeline bundle={bundle} />
        <p className="mt-1 font-mono text-[10px] text-zinc-600">
          hover anywhere — the crosshair reads every layer at that instant
        </p>
      </div>

      {bundle.coverage != null && bundle.coverage < 0.97 && (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 font-mono text-[11px] leading-5 text-amber-300/90">
          ⚠ stem analysis covers only {Math.round(bundle.coverage * 100)}% of this song
          (ends at {fmtTime(bundle.stemsTo ?? 0)} of {fmtTime(bundle.duration ?? 0)}).
          <span className="text-zinc-500"> The hatched region is unmeasured, not silent. Cause found: libsndfile silently truncated Suno&apos;s malformed-header MP3s during analysis — fixed in analyze_stems.py (2026-07-22), but this song still needs re-analysis to fill in. Until then anything reading senses.json (dossier anatomy, Kinetica stem visuals) is blind there too.</span>
        </p>
      )}

      {/* ── table view (accessibility + the numbers behind the picture) ─────── */}
      {table && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="sections">
            <table className="w-full text-left font-mono text-[11px]">
              <thead><tr className="text-zinc-600"><th className="py-1">section</th><th>start</th><th>len</th><th>intensity</th></tr></thead>
              <tbody>
                {bundle.sections.map((s, i) => (
                  <tr key={i} className="border-t border-zinc-900 text-zinc-400">
                    <td className="py-1">{s.name}</td>
                    <td>{s.start != null ? fmtTime(s.start) : "—"}</td>
                    <td>{s.start != null && s.end != null ? `${Math.round(s.end - s.start)}s` : "—"}</td>
                    <td>{s.intensity != null ? Math.round(s.intensity * 100) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="stems">
            <table className="w-full text-left font-mono text-[11px]">
              <thead><tr className="text-zinc-600"><th className="py-1">stem</th><th>family</th><th>peak</th><th>audible</th></tr></thead>
              <tbody>
                {bundle.stems.map((s) => (
                  <tr key={s.name} className="border-t border-zinc-900 text-zinc-400">
                    <td className="py-1 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-sm" style={{ background: FAMILY_COLOR[s.family] }} />{s.name}</td>
                    <td>{FAMILY_LABEL[s.family]}</td>
                    <td>{s.peak}</td>
                    <td>{s.active}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      )}

      {/* ── the read (labelled as interpretation, not measurement) ──────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {id.summary && (
          <Panel title="the read" note="interpretation">
            <p className="text-[12px] leading-5 text-zinc-400">{id.summary}</p>
            {id.themes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {id.themes.map((t) => <span key={t} className="rounded bg-zinc-800/70 px-1.5 py-0.5 text-[10px] text-zinc-400">{t}</span>)}
              </div>
            )}
          </Panel>
        )}
        {range && (
          <Panel title="vocal range" note="measured">
            <p className="font-display text-2xl font-black text-zinc-100">{midiToNote(range.lo)} – {midiToNote(range.hi)}</p>
            <p className="mt-1 font-mono text-[11px] text-zinc-500">{range.semitones} semitones · widest leap {range.leap} st</p>
            {bundle.melody?.key && (
              <p className="mt-1 font-mono text-[10px] text-zinc-600">melodic key read: {bundle.melody.key.root} {bundle.melody.key.mode} ({Math.round(bundle.melody.key.conf * 100)}% conf)</p>
            )}
          </Panel>
        )}
        <Panel title="what was measured" note="coverage">
          <ul className="space-y-0.5 font-mono text-[11px]">
            {([["stem envelopes", bundle.has.stems], ["drum onsets", bundle.has.onsets], ["melodic contour", bundle.has.melody], ["sections", bundle.has.sections], ["drama map", bundle.has.drama]] as [string, boolean][]).map(([k, v]) => (
              <li key={k} className={v ? "text-zinc-400" : "text-zinc-700"}>{v ? "✓" : "—"} {k}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-[100dvh] bg-[#050510] px-5 py-8 text-zinc-200"><div className="mx-auto max-w-[1400px]">{children}</div></main>;
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600">{label}</p>
      <p className="font-display text-xl font-black leading-tight text-zinc-100">{value}</p>
      {unit && <p className="font-mono text-[10px] text-zinc-500">{unit}</p>}
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        {title}{note && <span className="ml-2 text-zinc-700">{note}</span>}
      </p>
      {children}
    </div>
  );
}
