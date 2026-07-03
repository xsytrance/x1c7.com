"use client";

// The Foundry — search YouTube, pick a song, and forge it into a PRIVATE
// planet. Localhost-only: the pipeline (yt-dlp, Whisper, Ollama) runs on the
// owner's machine, audio lands in gitignored public/private/, and rows are
// hidden=true — the public site never sees any of it.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isPrivateHost } from "@/lib/privateHost";

type Result = { id: string; title: string; channel: string; duration: number | null; thumb: string; url: string };
type Stage = { key: string; label: string };
type Job = {
  slug: string; title: string; thumb: string;
  status: "running" | "applying" | "done" | "error" | "needs-auth";
  stage: number; stages: Stage[]; detail?: string; row?: Record<string, unknown>;
};

const mmss = (s: number | null) => s == null ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function ImporterPage() {
  const [local, setLocal] = useState<boolean | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [collection, setCollection] = useState<{ id: string; title: string; artist: string | null; cover: string | null }[]>([]);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  useEffect(() => {
    setLocal(isPrivateHost(window.location.hostname));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadCollection = useCallback(() => {
    supabase.from("tracks").select("id,title,artist,cover").like("audio_url", "/private/%")
      .order("sort_order").then(({ data }) => setCollection(data || []));
  }, []);
  useEffect(() => { if (local) loadCollection(); }, [local, loadCollection]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setAuthMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setAuthMsg(error.message);
    setPassword("");
  }

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setSearching(true); setSearchErr(""); setResults([]);
    try {
      const r = await fetch("/api/import/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "search failed");
      setResults(data.results);
    } catch (err) { setSearchErr(String((err as Error).message)); }
    setSearching(false);
  }

  const applyRow = useCallback(async (slug: string, row: Record<string, unknown>) => {
    setJobs((j) => ({ ...j, [slug]: { ...j[slug], status: "applying", row } }));
    const { error } = await supabase.from("tracks").upsert(row);
    if (error) {
      const needsAuth = /security|policy|permission|denied|JWT/i.test(error.message);
      setJobs((j) => ({ ...j, [slug]: { ...j[slug], status: needsAuth ? "needs-auth" : "error", detail: error.message, row } }));
      return;
    }
    setJobs((j) => ({ ...j, [slug]: { ...j[slug], status: "done", row } }));
    loadCollection();
  }, [loadCollection]);

  const poll = useCallback((slug: string) => {
    const tick = async () => {
      const cur = jobsRef.current[slug];
      if (!cur || cur.status !== "running") return;
      try {
        const r = await fetch(`/api/import/status?job=${slug}`);
        const data = await r.json();
        if (data.error && data.detail !== undefined) {
          setJobs((j) => ({ ...j, [slug]: { ...j[slug], status: "error", stage: data.stage ?? 0, detail: data.detail } }));
          return;
        }
        setJobs((j) => ({ ...j, [slug]: { ...j[slug], stage: data.stage ?? 0, stages: data.stages ?? j[slug].stages } }));
        if (data.done && data.row) { applyRow(slug, data.row); return; }
      } catch { /* dev server hiccup — keep polling */ }
      setTimeout(tick, 3000);
    };
    setTimeout(tick, 3000);
  }, [applyRow]);

  async function forge(v: Result) {
    const r = await fetch("/api/import/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId: v.id, title: v.title }) });
    const data = await r.json();
    if (!r.ok) { setSearchErr(data.error || "could not start"); return; }
    const slug = data.job as string;
    setJobs((j) => ({ ...j, [slug]: { slug, title: v.title, thumb: v.thumb, status: "running", stage: 0, stages: [] } }));
    poll(slug);
  }

  if (local === null) return null;
  if (!local) {
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-12">
        <div className="starfield" aria-hidden />
        <section className="relative w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center backdrop-blur-xl">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-white/45">the foundry</p>
          <h1 className="mt-3 font-display text-4xl font-black uppercase">Local Only</h1>
          <p className="mt-4 text-sm leading-7 text-white/68">
            Planets are forged on the owner&apos;s machine — the furnace doesn&apos;t exist out here.
            Run the site on localhost to open the Foundry.
          </p>
          <Link href="/galaxy" className="mt-6 inline-block rounded-full border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-white/75">← The Galaxy</Link>
        </section>
      </main>
    );
  }

  const activeJobs = Object.values(jobs);
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="starfield" aria-hidden />
      <div className="relative mx-auto w-full max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/45">private planet furnace · localhost only</p>
            <h1 className="mt-1 font-display text-4xl font-black uppercase tracking-tight sm:text-5xl">The Foundry</h1>
          </div>
          <Link href="/galaxy" className="rounded-full border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-white/60 transition hover:text-white">← The Galaxy</Link>
        </header>

        {!session && (
          <form onSubmit={signIn} className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">sign in to add planets to the collection</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email" autoComplete="email"
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/40" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" autoComplete="current-password"
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/40" />
            <button type="submit" className="rounded-xl bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-black">Sign in</button>
            {authMsg && <span className="text-xs text-red-400">{authMsg}</span>}
          </form>
        )}

        {/* forge queue */}
        {activeJobs.length > 0 && (
          <div className="mt-6 grid gap-3">
            {activeJobs.map((job) => (
              <div key={job.slug} className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={job.thumb} alt="" className="h-14 w-24 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-black uppercase">{job.title}</p>
                  {job.status === "running" && (
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-white/55">
                      {job.stages[job.stage - 1]?.label || "Igniting the furnace"}…
                      <span className="ml-2 text-white/35">{job.stage}/{job.stages.length || 7}</span>
                    </p>
                  )}
                  {job.status === "applying" && <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-white/55">Adding to your collection…</p>}
                  {job.status === "done" && <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-emerald-300">Planet forged ✓</p>}
                  {job.status === "needs-auth" && <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-amber-300">Forged — sign in above, then tap Add</p>}
                  {job.status === "error" && <p className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-red-400">{job.detail || "failed"}</p>}
                </div>
                {job.status === "running" && <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden />}
                {job.status === "needs-auth" && session && job.row && (
                  <button onClick={() => applyRow(job.slug, job.row!)} className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-black">Add</button>
                )}
                {job.status === "done" && (
                  <Link href={`/galaxy?track=${job.slug}`} className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-black">Land ▶</Link>
                )}
              </div>
            ))}
          </div>
        )}

        {/* search */}
        <form onSubmit={search} className="mt-6 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search YouTube for a song…"
            className="w-full rounded-2xl border border-white/15 bg-black/30 px-5 py-4 text-base outline-none backdrop-blur focus:border-white/40" />
          <button type="submit" disabled={searching} className="shrink-0 rounded-2xl bg-white px-6 text-sm font-black uppercase tracking-wider text-black disabled:opacity-50">
            {searching ? "…" : "Search"}
          </button>
        </form>
        {searchErr && <p className="mt-3 font-mono text-xs text-red-400">{searchErr}</p>}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((v) => {
            const vSlug = v.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
            const busy = !!jobs[vSlug] || collection.some((c) => c.id === vSlug);
            return (
              <div key={v.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] transition hover:border-white/25">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.thumb} alt="" className="aspect-video w-full object-cover" loading="lazy" />
                <div className="p-4">
                  <p className="line-clamp-2 text-sm font-bold leading-snug">{v.title}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-white/45">{v.channel}{v.duration ? ` · ${mmss(v.duration)}` : ""}</p>
                  <button onClick={() => forge(v)} disabled={busy}
                    className="mt-3 w-full rounded-xl border border-white/15 bg-white/10 py-2.5 text-xs font-black uppercase tracking-[0.2em] transition hover:bg-white hover:text-black disabled:opacity-40">
                    {busy ? "In the furnace" : "Forge planet 🪐"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* collection */}
        {collection.length > 0 && (
          <section className="mt-12">
            <h2 className="font-mono text-xs uppercase tracking-[0.4em] text-white/45">your private collection · {collection.length}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {collection.map((t) => (
                <Link key={t.id} href={`/galaxy?track=${t.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3 transition hover:border-white/25">
                  {t.cover
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={t.cover} alt="" className="h-12 w-12 rounded-full object-cover" />
                    : <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10">🪐</span>}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{t.title}</span>
                    <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-white/45">{t.artist}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
