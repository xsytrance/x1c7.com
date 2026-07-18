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

type Rec = { palette?: string; spine?: string; explicit?: boolean } | null;
type Cover = {
  slug: string; title: string; genre?: string; mood?: string; color?: string;
  hidden?: boolean; paletteKey?: string; autoPaletteKey?: string; hasCard?: boolean; hasSpine?: boolean;
  record?: Rec; original?: string; urls?: { card?: string; spine?: string; collector?: string };
};
type Prog = { key: string; n: number; url: string; seed?: number; at?: string };
type Job = { id: string; kind: string; status: string; total: number; done: number; progress?: Prog[]; error?: string; payload?: { mode?: string }; created_at: string };
type ScMatch = { slug: string | null; title: string; sc: string; state: "never" | "stale" | "synced"; done: boolean; appliedAt?: string | null };
type ScReport = {
  scanned: boolean; scannedAt?: string | null; note?: string; matches?: ScMatch[];
  unmatchedSc?: { title: string }[]; unmatchedCovers?: { title: string }[];
  counts?: { synced: number; stale: number; never: number; unmatchedSc: number; unmatchedCovers: number };
};

const SC_STATE_FACE: Record<ScMatch["state"], string> = {
  synced: "✓ synced", stale: "⟳ stale — art changed since the push", never: "○ matched, never pushed",
};

export default function CoverStudioPage() {
  const [covers, setCovers] = useState<Cover[]>([]);
  const [palettes, setPalettes] = useState<Record<string, { label?: string; accent?: string }>>({});
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
  const [concepts, setConcepts] = useState<{ label: string; prompt: string }[]>([]);
  const [conceptsBusy, setConceptsBusy] = useState(false);
  const [lexIdeas, setLexIdeas] = useState<{ word: string; prompt: string; emotion?: string; line?: string; image?: string }[]>([]);
  const [lexBusy, setLexBusy] = useState(false);
  const [edPalette, setEdPalette] = useState("auto");
  const [edSpine, setEdSpine] = useState("");
  const [edExplicit, setEdExplicit] = useState(false);
  const promptTouched = useRef(false);
  const [sc, setSc] = useState<ScReport | null>(null);
  const [scJobs, setScJobs] = useState<Job[]>([]);
  const [scBusy, setScBusy] = useState(false);
  const [scMsg, setScMsg] = useState<string | null>(null);
  const scActiveRef = useRef(false);
  const selScActiveRef = useRef(false);

  const loadInventory = useCallback(async () => {
    const d = await fetch("/api/studio/covers").then((r) => r.json()).catch(() => null);
    if (d?.ok) { setCovers(d.covers); setPalettes(d.palettes || {}); setLoaded(true); }
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

  // SoundCloud drift report (prime-local; /api/studio/soundcloud reads the map file)
  const loadSc = useCallback(async () => {
    const d = await fetch("/api/studio/soundcloud").then((r) => r.json()).catch(() => null);
    if (d?.ok) setSc(d);
  }, []);
  useEffect(() => { loadSc(); }, [loadSc]);

  // poll the global soundcloud job lane (slug "soundcloud"); refresh the report when a run lands
  useEffect(() => {
    let live = true;
    const load = () => fetch("/api/studio/jobs?slug=soundcloud").then((r) => r.json()).then((d) => {
      if (!live || !d?.ok) return;
      const js: Job[] = d.jobs || [];
      setScJobs(js);
      const active = js.some((j) => j.status === "pending" || j.status === "running");
      if (scActiveRef.current && !active) loadSc();
      scActiveRef.current = active;
    }).catch(() => {});
    load();
    const t = setInterval(load, 6000);
    return () => { live = false; clearInterval(t); };
  }, [loadSc]);

  const selCover = useMemo(() => covers.find((c) => c.slug === sel) || null, [covers, sel]);
  // the GENERATE deck only speaks cover-gen — sync jobs live in their own panel
  const genJobs = jobs.filter((j) => j.kind === "cover-gen");
  const activeJob = genJobs.find((j) => j.status === "pending" || j.status === "running") || null;
  const latestDone = genJobs.find((j) => j.status === "done") || null;
  // newest candidates first: prefer an active job's partials, else the last done job
  const candidates: Prog[] = (activeJob?.progress?.length ? activeJob.progress : latestDone?.progress) || [];
  const selScJob = jobs.find((j) => j.kind === "soundcloud-sync") || null;
  const selScActive = !!selScJob && (selScJob.status === "pending" || selScJob.status === "running");
  const scGlobalActive = scJobs.find((j) => j.status === "pending" || j.status === "running") || null;
  useEffect(() => { if (selScActiveRef.current && !selScActive) loadSc(); selScActiveRef.current = selScActive; }, [selScActive, loadSc]);
  const selScMatch = sc?.matches?.find((m) => m.slug === sel) || null;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? covers.filter((c) => c.slug.includes(s) || c.title.toLowerCase().includes(s) || (c.genre || "").toLowerCase().includes(s)) : covers;
    return base;
  }, [covers, q]);

  function pick(slug: string) {
    setSel(slug); setMsg(null); promptTouched.current = false; setPrompt(""); setConcepts([]); setLexIdeas([]);
    const rec = covers.find((c) => c.slug === slug)?.record || null;
    setEdPalette(rec?.palette || "auto"); setEdSpine(rec?.spine || ""); setEdExplicit(!!rec?.explicit);
  }

  async function saveEdits() {
    if (!sel || busy) return;
    setBusy(true); setMsg("applying case edits + reprinting…");
    const overrides: Record<string, unknown> = {
      palette: edPalette === "auto" ? null : edPalette,
      spine: edSpine.trim() || null,
      explicit: edExplicit ? true : null,
    };
    const r = await fetch("/api/studio/covers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: sel, overrides, render: true }) })
      .then((res) => res.json().then((d) => ({ ok: res.ok, ...d }))).catch(() => ({ ok: false, error: "network" }));
    setBusy(false);
    if (r.ok) { setMsg("✓ case updated + reprinted"); setBust(Date.now()); loadInventory(); }
    else setMsg(`edit failed: ${r.error || "error"}`);
  }

  async function artDirector() {
    if (!sel || conceptsBusy) return;
    setConceptsBusy(true); setConcepts([]); setMsg("the art director is sketching concepts (~30–40s)…");
    const r = await fetch("/api/studio/concepts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: sel, n: 5 }) })
      .then((res) => res.json().then((d) => ({ ok: res.ok, ...d }))).catch(() => ({ ok: false, error: "network" }));
    setConceptsBusy(false);
    if (r.ok) { setConcepts(r.concepts || []); setMsg(`${r.concepts?.length || 0} concepts — tap one to load it into the prompt`); }
    else setMsg(`art director: ${r.error || "error"}`);
  }

  async function lexiconIdeas() {
    if (!sel || lexBusy) return;
    setLexBusy(true); setLexIdeas([]); setMsg("pulling ideas from the song's Lexsycon…");
    const r = await fetch("/api/studio/lexicon-ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: sel }) })
      .then((res) => res.json().then((d) => ({ ok: res.ok, ...d }))).catch(() => ({ ok: false, error: "network" }));
    setLexBusy(false);
    if (r.ok) { setLexIdeas(r.ideas || []); setMsg(`${r.ideas?.length || 0} Lexsycon ideas — tap a word to load its prompt`); }
    else setMsg(`Lexsycon: ${r.error || "error"}`);
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

  async function scEnqueue(mode: "scan" | "push", slugsArg?: string[]) {
    if (scBusy) return;
    setScBusy(true);
    const perTrack = slugsArg?.length === 1;
    const say = perTrack ? setMsg : setScMsg;
    // per-track pushes queue under the track's slug (they show in its job feed);
    // global scan / sync-all under the "soundcloud" lane
    const body = {
      slug: perTrack ? slugsArg![0] : "soundcloud",
      kind: "soundcloud-sync",
      payload: { mode, ...(slugsArg?.length ? { slugs: slugsArg } : {}) },
    };
    const r = await fetch("/api/studio/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then((res) => res.json().then((d) => ({ ok: res.ok, ...d }))).catch(() => ({ ok: false, error: "network" }));
    setScBusy(false);
    say(r.ok
      ? mode === "scan" ? "rescan queued — a browser will walk your SoundCloud tracks" : perTrack ? "push queued — the cover heads to SoundCloud" : "sync queued — pushing every stale + never-pushed cover"
      : `couldn't queue: ${r.error || "error"}`);
    if (r.ok && perTrack && sel) fetch(`/api/studio/jobs?slug=${encodeURIComponent(sel)}`).then((res) => res.json()).then((d) => d?.ok && setJobs(d.jobs || []));
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
            <div className="space-y-4">
              <div className={`${CARD} grid min-h-[140px] place-items-center text-center`}>
                <div>
                  <p className={LABEL}>Generate deck</p>
                  <p className={`${HINT} mt-2 max-w-[240px]`}>Pick a cover from the wall to generate new art, pick a candidate, and reprint the collector case.</p>
                </div>
              </div>

              {/* SoundCloud drift report + sync-all (P3) — the browser job runs on prime */}
              <div className={`${CARD} space-y-3`}>
                <div className="flex items-center justify-between">
                  <p className={LABEL}>☁ SoundCloud sync</p>
                  <button onClick={() => scEnqueue("scan")} disabled={scBusy || !!scGlobalActive}
                    className="rounded-full border border-[var(--inst-line)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--inst-dim)] transition hover:border-[var(--inst-plasma)] hover:text-[var(--inst-plasma)] disabled:opacity-40">
                    rescan
                  </button>
                </div>
                {!sc ? <p className={HINT}>reading the drift report…</p> : !sc.scanned ? (
                  <p className={HINT}>No SoundCloud map yet — rescan walks your track manager in a browser (logged-in profile on prime) and matches every SoundCloud track to the catalog.</p>
                ) : (
                  <>
                    <p className={HINT}>
                      <span className="text-[var(--inst-ok)]">{sc.counts?.synced ?? 0} synced</span>
                      {" · "}<span className="text-[var(--inst-warn)]">{sc.counts?.stale ?? 0} stale</span>
                      {" · "}{sc.counts?.never ?? 0} never pushed
                      {(sc.counts?.unmatchedSc || sc.counts?.unmatchedCovers) ? ` · ${(sc.counts?.unmatchedSc ?? 0) + (sc.counts?.unmatchedCovers ?? 0)} unmatched` : ""}
                      {sc.scannedAt ? ` · scanned ${new Date(sc.scannedAt).toLocaleDateString()}` : ""}
                    </p>
                    {(sc.matches || []).some((m) => m.state !== "synced") && (
                      <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
                        {(sc.matches || []).filter((m) => m.state !== "synced").map((m) => (
                          <li key={m.sc} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="truncate font-mono text-[var(--inst-ink)]">{m.title}</span>
                            <span className={`shrink-0 ${m.state === "stale" ? "text-[var(--inst-warn)]" : "text-[var(--inst-faint)]"}`}>{m.state}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {(sc.unmatchedSc?.length || sc.unmatchedCovers?.length) ? (
                      <details>
                        <summary className={`${HINT} cursor-pointer select-none`}>unmatched — {sc.unmatchedSc?.length ?? 0} on SoundCloud · {sc.unmatchedCovers?.length ?? 0} in the catalog</summary>
                        <ul className="mt-1 max-h-32 overflow-y-auto pr-1">
                          {(sc.unmatchedSc || []).map((u, i) => <li key={`s${i}`} className={`${HINT} truncate`}>SC · {u.title}</li>)}
                          {(sc.unmatchedCovers || []).map((u, i) => <li key={`c${i}`} className={`${HINT} truncate`}>catalog · {u.title}</li>)}
                        </ul>
                      </details>
                    ) : null}
                    <button onClick={() => scEnqueue("push")}
                      disabled={scBusy || !!scGlobalActive || ((sc.counts?.stale ?? 0) + (sc.counts?.never ?? 0)) === 0}
                      className={`${BTN} w-full`}>
                      {scGlobalActive ? `${JOB_FACE[scGlobalActive.status]?.mark} ${scGlobalActive.payload?.mode === "scan" ? "scanning" : "pushing"} ${scGlobalActive.total ? `${scGlobalActive.done}/${scGlobalActive.total}` : "…"}`
                        : `Sync all (${(sc.counts?.stale ?? 0) + (sc.counts?.never ?? 0)})`}
                    </button>
                  </>
                )}
                {scGlobalActive && sc?.scanned === false && <p className={HINT}>◍ browser job running on prime…</p>}
                {scMsg && <p className={HINT}>{scMsg}</p>}
                <p className={HINT}>Pushing drives soundcloud.com at human pace in the prime worker — a full sync takes a while on purpose.</p>
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

                {/* LLM art director — qwen3:14b writes distinct concepts from the song's profile */}
                <div>
                  <div className="flex items-center justify-between">
                    <p className={LABEL}>✦ Art director</p>
                    <button onClick={artDirector} disabled={conceptsBusy || !!activeJob} className="rounded-full border border-[var(--inst-line)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--inst-dim)] transition hover:border-[var(--inst-plasma)] hover:text-[var(--inst-plasma)] disabled:opacity-40">
                      {conceptsBusy ? "sketching…" : "get concepts"}
                    </button>
                  </div>
                  <p className={`${HINT} mt-1`}>Local qwen3:14b reads the song and pitches distinct cover ideas. Tap one to load its prompt.</p>
                  {concepts.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {concepts.map((c, i) => {
                        const on = prompt === c.prompt;
                        return (
                          <button key={i} onClick={() => { setPrompt(c.prompt); promptTouched.current = true; }}
                            className={`block w-full rounded-lg border px-3 py-2 text-left transition ${on ? "border-[var(--inst-plasma)] bg-[color-mix(in_srgb,var(--inst-plasma)_8%,transparent)]" : "border-[var(--inst-line)] hover:border-[var(--inst-dim)]"}`}>
                            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--inst-plasma)]">{c.label}</span>
                            <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-[var(--inst-faint)]">{c.prompt}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* lexicon idea deck — the song's heavy words → their sense imagery + the painting the lexicon already made */}
                <div>
                  <div className="flex items-center justify-between">
                    <p className={LABEL}>◆ From the Lexsycon</p>
                    <button onClick={lexiconIdeas} disabled={lexBusy || !!activeJob} className="rounded-full border border-[var(--inst-line)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--inst-dim)] transition hover:border-[var(--inst-plasma)] hover:text-[var(--inst-plasma)] disabled:opacity-40">
                      {lexBusy ? "pulling…" : "get ideas"}
                    </button>
                  </div>
                  <p className={`${HINT} mt-1`}>The song&apos;s heavy words, the lyric that summoned each, and the art the Lexsycon already painted. Tap a word to load its prompt.</p>
                  {lexIdeas.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {lexIdeas.map((x, i) => {
                        const on = prompt === x.prompt;
                        return (
                          <button key={i} onClick={() => { setPrompt(x.prompt); promptTouched.current = true; }}
                            className={`flex gap-2 rounded-lg border p-1.5 text-left transition ${on ? "border-[var(--inst-plasma)] bg-[color-mix(in_srgb,var(--inst-plasma)_8%,transparent)]" : "border-[var(--inst-line)] hover:border-[var(--inst-dim)]"}`}>
                            {x.image ? <img src={x.image} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-[var(--inst-s1)] text-[8px] text-[var(--inst-faint)]">—</span>}
                            <span className="min-w-0">
                              <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--inst-plasma)]">{x.word}</span>
                              <span className="line-clamp-2 block text-[10px] leading-3 text-[var(--inst-faint)]">{x.line ? `“${x.line}”` : x.emotion || x.prompt}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
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

              {/* adjust the case — palette / spine / explicit → overrides + reprint (no new art) */}
              <details className={CARD}>
                <summary className={`${LABEL} cursor-pointer select-none`}>Adjust the case <span className="normal-case tracking-normal text-[var(--inst-faint)]">— frame only, keeps the art</span></summary>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className={HINT}>Palette</p>
                    <select value={edPalette} onChange={(e) => setEdPalette(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[var(--inst-line)] bg-[var(--inst-s1)] px-3 py-2 font-mono text-xs text-[var(--inst-ink)] focus:border-[var(--inst-plasma)] focus:outline-none">
                      <option value="auto">auto — {selCover.autoPaletteKey || "genre"}</option>
                      {Object.entries(palettes).map(([k, p]) => <option key={k} value={k}>{p.label || k}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className={HINT}>Spine label <span className="text-[var(--inst-faint)]">(blank = auto from genre)</span></p>
                    <input value={edSpine} onChange={(e) => setEdSpine(e.target.value)} placeholder={selCover.genre || "auto"}
                      className="mt-1 w-full rounded-lg border border-[var(--inst-line)] bg-[var(--inst-s1)] px-3 py-2 font-mono text-xs text-[var(--inst-ink)] placeholder:text-[var(--inst-faint)] focus:border-[var(--inst-plasma)] focus:outline-none" />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[var(--inst-dim)]">
                    <input type="checkbox" checked={edExplicit} onChange={(e) => setEdExplicit(e.target.checked)} className="accent-[var(--inst-plasma)]" />
                    force PARENTAL ADVISORY
                  </label>
                  <button onClick={saveEdits} disabled={busy} className={`${BTN} w-full`}>Apply &amp; reprint</button>
                </div>
              </details>

              {/* SoundCloud — this track's sync state + push (P3) */}
              <div className={`${CARD} flex items-center justify-between gap-3`}>
                <div className="min-w-0">
                  <p className={LABEL}>☁ SoundCloud</p>
                  <p className={`${HINT} mt-1`}>
                    {selScActive ? `${JOB_FACE[selScJob!.status]?.mark} pushing this cover…`
                      : selScJob?.status === "error" ? `✕ last push failed — ${selScJob.error || "see worker log"}`
                      : !sc ? "…"
                      : !sc.scanned ? "no SoundCloud map yet — run a rescan from the deck home"
                      : !selScMatch ? "not matched on SoundCloud — rescan, or match it by hand in the map"
                      : SC_STATE_FACE[selScMatch.state] + (selScMatch.appliedAt ? ` · pushed ${new Date(selScMatch.appliedAt).toLocaleDateString()}` : "")}
                  </p>
                </div>
                <button onClick={() => sel && scEnqueue("push", [sel])}
                  disabled={scBusy || selScActive || !!scGlobalActive || !selScMatch}
                  className={`${BTN} shrink-0`}>
                  Push cover
                </button>
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
