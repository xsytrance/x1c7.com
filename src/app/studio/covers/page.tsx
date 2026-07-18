"use client";

// Cover Studio 2 — P2 web shell (VIP, owner-gated via the tailnet APIs).
// Wall of every collector cover + a GENERATE deck: pick a song → render
// candidates on the GPU (cover-gen job → prime worker → ComfyUI) → pick one →
// it promotes to originals/ and reprints the case. All data flows through the
// already-gated /api/studio/covers + /api/studio/jobs; nothing new server-side.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CARD = "rounded-3xl border border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s1)_88%,transparent)] p-5 backdrop-blur-md";
const LABEL = "text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--inst-dim)]";
const HINT = "text-[11px] leading-4 text-[var(--inst-faint)]";
const BTN = "rounded-full border border-[var(--inst-line)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--inst-ink)] transition hover:border-[var(--inst-plasma)] hover:text-[var(--inst-plasma)] disabled:opacity-40";

const LANES = [
  { key: "photo", label: "Photo", hint: "cinematic photoreal" },
  { key: "paint", label: "Paint", hint: "painterly / illustrated" },
  { key: "poster", label: "Poster", hint: "graphic / typographic" },
  { key: "anime", label: "Anime", hint: "anime / manga" },
] as const;

const JOB_FACE: Record<string, { mark: string; text: string }> = {
  pending: { mark: "◷", text: "queued" },
  running: { mark: "◍", text: "rendering" },
  done: { mark: "✓", text: "ready" },
  error: { mark: "✕", text: "failed" },
  cancelled: { mark: "⏹", text: "cancelled" },
};

type Cover = {
  slug: string; title: string; genre?: string; mood?: string; color?: string;
  hidden?: boolean; paletteKey?: string; hasCard?: boolean; hasSpine?: boolean;
  original?: string; urls?: { card?: string; spine?: string; collector?: string };
};
type Prog = { key: string; n: number; url: string; seed?: number; at?: string };
type Job = { id: string; kind: string; status: string; total: number; done: number; progress?: Prog[]; error?: string; created_at: string };

export default function CoverStudioPage() {
  const [covers, setCovers] = useState<Cover[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [lane, setLane] = useState<string>("photo");
  const [prompt, setPrompt] = useState("");
  const [n, setN] = useState(4);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [bust, setBust] = useState(0); // cover-image cache-buster after a reprint
  const promptTouched = useRef(false);

  const loadInventory = useCallback(async () => {
    const d = await fetch("/api/studio/covers").then((r) => r.json()).catch(() => null);
    if (d?.ok) { setCovers(d.covers); setLoaded(true); }
    else { setLoaded(true); setMsg(d?.error ? `inventory: ${d.error}` : "inventory unavailable (owner-only)"); }
  }, []);
  useEffect(() => { loadInventory(); }, [loadInventory]);

  // poll jobs for the selected song
  useEffect(() => {
    if (!sel) { setJobs([]); return; }
    let live = true;
    const load = () => fetch(`/api/studio/jobs?slug=${encodeURIComponent(sel)}`).then((r) => r.json())
      .then((d) => { if (live && d?.ok) setJobs(d.jobs || []); }).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { live = false; clearInterval(t); };
  }, [sel]);

  const selCover = useMemo(() => covers.find((c) => c.slug === sel) || null, [covers, sel]);
  const activeJob = jobs.find((j) => j.status === "pending" || j.status === "running") || null;
  const latestDone = jobs.find((j) => j.status === "done") || null;
  // newest candidates first: prefer an active job's partials, else the last done job
  const candidates: Prog[] = (activeJob?.progress?.length ? activeJob.progress : latestDone?.progress) || [];

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? covers.filter((c) => c.slug.includes(s) || c.title.toLowerCase().includes(s) || (c.genre || "").toLowerCase().includes(s)) : covers;
    return base;
  }, [covers, q]);

  function pick(slug: string) {
    setSel(slug); setMsg(null); promptTouched.current = false; setPrompt("");
  }

  async function generate() {
    if (!sel || busy) return;
    setBusy(true); setMsg(null);
    const body = { slug: sel, kind: "cover-gen", payload: { lane, n, ...(prompt.trim() ? { prompt: prompt.trim() } : {}) } };
    const r = await fetch("/api/studio/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((res) => res.json().then((d) => ({ ok: res.ok, ...d }))).catch(() => ({ ok: false, error: "network" }));
    setBusy(false);
    setMsg(r.ok ? `queued ${n} ${lane} candidate${n > 1 ? "s" : ""} — the GPU is on it` : `couldn't queue: ${r.error || "error"}`);
    if (sel) fetch(`/api/studio/jobs?slug=${encodeURIComponent(sel)}`).then((res) => res.json()).then((d) => d?.ok && setJobs(d.jobs || []));
  }

  async function apply(url: string) {
    if (!sel || busy) return;
    setBusy(true); setMsg("applying + reprinting the case…");
    const r = await fetch("/api/studio/covers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: sel, applyCandidate: url }) })
      .then((res) => res.json().then((d) => ({ ok: res.ok, ...d }))).catch(() => ({ ok: false, error: "network" }));
    setBusy(false);
    if (r.ok) { setMsg("✓ applied — new original saved (prior backed up), case reprinted"); setBust(Date.now()); loadInventory(); }
    else setMsg(`apply failed: ${r.error || "error"}`);
  }

  const imgBust = (u?: string) => (u ? `${u}${u.includes("?") ? "&" : "?"}b=${bust}` : "");

  return (
    <main className="relative min-h-[100dvh] bg-[var(--inst-s2)] text-[var(--inst-ink)]">
      {/* header */}
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s2)_92%,transparent)] px-4 backdrop-blur">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-sm font-black tracking-[0.28em] text-[#e8c766]">AGENOR</span>
          <span className={LABEL}>Cover Studio</span>
        </div>
        <a href="/music" className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--inst-dim)] transition hover:text-[var(--inst-ink)]">exit → /music</a>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
        {/* ── WALL ── */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search title · genre · slug"
              className="w-full rounded-full border border-[var(--inst-line)] bg-[var(--inst-s1)] px-4 py-2 font-mono text-sm text-[var(--inst-ink)] placeholder:text-[var(--inst-faint)] focus:border-[var(--inst-plasma)] focus:outline-none" />
            <span className={`${HINT} whitespace-nowrap`}>{list.length} covers</span>
          </div>
          {!loaded ? <p className={HINT}>loading inventory…</p> : list.length === 0 ? <p className={HINT}>no covers match.</p> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {list.map((c) => {
                const thumb = c.urls?.card || c.urls?.collector || c.original;
                const active = c.slug === sel;
                return (
                  <button key={c.slug} onClick={() => pick(c.slug)}
                    style={{ contentVisibility: "auto", containIntrinsicSize: "0 220px" }}
                    className={`group overflow-hidden rounded-xl border text-left transition ${active ? "border-[var(--inst-plasma)]" : "border-[var(--inst-line)] hover:border-[var(--inst-dim)]"}`}>
                    <div className="relative aspect-square bg-[var(--inst-s1)]">
                      {thumb ? <img src={active ? imgBust(thumb) : thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] text-[var(--inst-faint)]">no art</div>}
                      {c.hidden && <span className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[8px] uppercase tracking-wider text-[var(--inst-warn)]">hidden</span>}
                    </div>
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                      <span className="truncate font-mono text-[11px] text-[var(--inst-ink)]">{c.title}</span>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color || "#666" }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── DECK ── */}
        <aside className="lg:sticky lg:top-16 lg:h-fit">
          {!selCover ? (
            <div className={`${CARD} grid min-h-[300px] place-items-center text-center`}>
              <div>
                <p className={LABEL}>Generate deck</p>
                <p className={`${HINT} mt-2 max-w-[240px]`}>Pick a cover from the wall to generate new art, pick a candidate, and reprint the collector case.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={CARD}>
                <div className="flex gap-4">
                  <img src={imgBust(selCover.urls?.collector || selCover.urls?.card || selCover.original)} alt="" className="h-28 w-28 shrink-0 rounded-lg border border-[var(--inst-line)] object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold text-[var(--inst-ink)]">{selCover.title}</p>
                    <p className={`${HINT} mt-1`}>{selCover.genre || "—"}{selCover.mood ? ` · ${selCover.mood}` : ""}</p>
                    <p className={`${HINT} mt-1`}>palette: {selCover.paletteKey || "auto"} · {selCover.hasCard ? "card ✓" : "no card"} {selCover.hasSpine ? "· spine ✓" : ""}</p>
                  </div>
                </div>
              </div>

              {/* generate controls */}
              <div className={`${CARD} space-y-4`}>
                <div>
                  <p className={LABEL}>Lane</p>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {LANES.map((l) => (
                      <button key={l.key} onClick={() => setLane(l.key)} title={l.hint}
                        className={`rounded-lg border px-2 py-2 text-[11px] font-semibold uppercase tracking-wider transition ${lane === l.key ? "border-[var(--inst-plasma)] text-[var(--inst-plasma)]" : "border-[var(--inst-line)] text-[var(--inst-dim)] hover:text-[var(--inst-ink)]"}`}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                  <p className={`${HINT} mt-1.5`}>{LANES.find((l) => l.key === lane)?.hint}</p>
                </div>
                <div>
                  <p className={LABEL}>Prompt <span className="normal-case tracking-normal text-[var(--inst-faint)]">— leave blank to seed from the song&apos;s analysis</span></p>
                  <textarea value={prompt} onChange={(e) => { promptTouched.current = true; setPrompt(e.target.value); }} rows={3}
                    placeholder="e.g. a serene river winding through a green valley, soft dawn light, no people"
                    className="mt-2 w-full resize-none rounded-lg border border-[var(--inst-line)] bg-[var(--inst-s1)] px-3 py-2 font-mono text-xs text-[var(--inst-ink)] placeholder:text-[var(--inst-faint)] focus:border-[var(--inst-plasma)] focus:outline-none" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={LABEL}>Count</span>
                    <input type="range" min={1} max={8} value={n} onChange={(e) => setN(Number(e.target.value))} className="accent-[var(--inst-plasma)]" />
                    <span className="font-mono text-sm text-[var(--inst-ink)]">{n}</span>
                  </div>
                  <button onClick={generate} disabled={busy || !!activeJob} className={BTN}>
                    {activeJob ? "rendering…" : busy ? "…" : "Generate"}
                  </button>
                </div>
                {msg && <p className={HINT}>{msg}</p>}
              </div>

              {/* candidates */}
              {(activeJob || candidates.length > 0) && (
                <div className={`${CARD}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className={LABEL}>Candidates {activeJob ? `· ${JOB_FACE[activeJob.status]?.text} ${activeJob.done}/${activeJob.total}` : ""}</p>
                    {activeJob && <span className="font-mono text-sm text-[var(--inst-plasma)]">{JOB_FACE[activeJob.status]?.mark}</span>}
                  </div>
                  {candidates.length === 0 ? <p className={HINT}>warming up the GPU…</p> : (
                    <div className="grid grid-cols-2 gap-3">
                      {candidates.slice().reverse().map((c) => (
                        <button key={c.url} onClick={() => apply(c.url)} disabled={busy} title="apply this → reprint the case"
                          className="group relative overflow-hidden rounded-lg border border-[var(--inst-line)] transition hover:border-[var(--inst-ok)] disabled:opacity-50">
                          <img src={c.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--inst-ok)] opacity-0 transition group-hover:opacity-100">apply →</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className={`${HINT} mt-3`}>Applying saves the pick as the new original (prior backed up) and reprints the collector case.</p>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
