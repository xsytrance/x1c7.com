"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabase, type TrackRow } from "@/lib/supabase";
import type { ThemeOverride } from "@/lib/theme";
import { LyricsSyncEditor } from "@/components/LyricsSyncEditor";

const GENRE_OPTIONS = ["Electronic", "Synthwave", "Ambient", "Techno", "Industrial", "Pop", "House", "Dance", "Trap", "Drum & Bass", "Reggaeton", "Afrobeat", "Latin", "Lo-Fi", "Cinematic", "Hip-Hop", "R&B", "Rock"];
const MOOD_OPTIONS = ["Euphoric", "Defiant", "Dreamy", "Intense", "Confident", "Energetic", "Nostalgic", "Raw", "Intimate", "Dark", "Playful", "Triumphant", "Melancholic"];

type Status = { kind: "idle" | "ok" | "err" | "busy"; msg?: string };

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [query, setQuery] = useState("");

  // ---- auth bootstrap ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    supabase.rpc("is_admin").then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  const loadRows = useCallback(async () => {
    setStatus({ kind: "busy", msg: "Loading…" });
    const { data, error } = await supabase.from("tracks").select("*").order("sort_order", { ascending: true });
    if (error) { setStatus({ kind: "err", msg: error.message }); return; }
    setRows((data as TrackRow[]) || []);
    setDirty(new Set());
    setStatus({ kind: "idle" });
  }, []);

  useEffect(() => {
    if (session && isAdmin) loadRows();
  }, [session, isAdmin, loadRows]);

  // ---- auth actions ----
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setAuthMsg("Signing in…");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setAuthMsg(error.message);
    else setAuthMsg("");
  }
  async function signOut() {
    await supabase.auth.signOut();
    setPassword(""); setRows([]);
  }
  async function changePassword() {
    const next = window.prompt("New password (min 6 chars):");
    if (!next) return;
    const { error } = await supabase.auth.updateUser({ password: next });
    setStatus(error ? { kind: "err", msg: error.message } : { kind: "ok", msg: "Password updated" });
  }

  // ---- editing ----
  function edit<K extends keyof TrackRow>(id: string, key: K, value: TrackRow[K]) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    setDirty((d) => new Set(d).add(id));
  }

  // Patch a track's site-theme override (tracks.theme jsonb). Empty fields are
  // removed; an empty object collapses to null so the song reverts to
  // auto-extraction / its seed color.
  function setTheme(id: string, patch: Partial<ThemeOverride>) {
    setRows((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      const next: Record<string, unknown> = { ...(r.theme || {}) };
      for (const [k, v] of Object.entries(patch)) {
        if (v === "" || v === undefined || v === null) delete next[k];
        else next[k] = v;
      }
      return { ...r, theme: Object.keys(next).length ? next : null };
    }));
    setDirty((d) => new Set(d).add(id));
  }

  async function saveAll() {
    const changed = rows.filter((r) => dirty.has(r.id));
    if (changed.length === 0) { setStatus({ kind: "ok", msg: "Nothing to save" }); return; }
    setStatus({ kind: "busy", msg: `Saving ${changed.length}…` });
    const { error } = await supabase.from("tracks").upsert(changed, { onConflict: "id" });
    if (error) setStatus({ kind: "err", msg: error.message });
    else { setDirty(new Set()); setStatus({ kind: "ok", msg: `Saved ${changed.length} track${changed.length > 1 ? "s" : ""}` }); }
  }

  async function move(id: string, dir: -1 | 1) {
    const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
    const i = sorted.findIndex((r) => r.id === id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    const ao = a.sort_order, bo = b.sort_order;
    edit(a.id, "sort_order", bo);
    edit(b.id, "sort_order", ao);
  }

  // ---- render: not logged in ----
  if (!session) {
    return (
      <Shell>
        <div className="mx-auto max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <h1 className="font-display text-2xl font-black uppercase tracking-tight text-white">x1c7 · admin</h1>
          <p className="mt-2 font-mono text-xs text-white/50">Sign in to edit the hub.</p>
          <form onSubmit={signIn} className="mt-5 space-y-3">
            <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-signal" />
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password"
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-signal" />
            <button className="w-full rounded-lg bg-signal py-2.5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-void transition hover:brightness-110">Sign in</button>
          </form>
          {authMsg && <p className="mt-4 font-mono text-[11px] text-signal/80">{authMsg}</p>}
        </div>
      </Shell>
    );
  }

  // ---- render: logged in, not admin ----
  if (isAdmin === false) {
    return (
      <Shell>
        <div className="mx-auto max-w-sm rounded-2xl border border-red-400/20 bg-white/[0.04] p-6 text-center backdrop-blur">
          <p className="font-mono text-sm text-red-300">Not authorized.</p>
          <p className="mt-2 font-mono text-[11px] text-white/40">{session.user.email}</p>
          <button onClick={signOut} className="mt-4 rounded-lg border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-white/60 hover:text-white">Sign out</button>
        </div>
      </Shell>
    );
  }

  const filtered = rows
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((r) => r.title.toLowerCase().includes(query.toLowerCase()));

  // ---- render: editor ----
  return (
    <Shell wide>
      <datalist id="genres">{GENRE_OPTIONS.map((g) => <option key={g} value={g} />)}</datalist>
      <datalist id="moods">{MOOD_OPTIONS.map((m) => <option key={m} value={m} />)}</datalist>

      <div className="sticky top-0 z-10 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b border-white/10 bg-void/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <h1 className="font-display text-lg font-black uppercase tracking-tight text-white">x1c7 · admin</h1>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search tracks…"
          className="min-w-[160px] flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-signal" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">{rows.length} tracks · {dirty.size} unsaved</span>
        <button onClick={loadRows} className="rounded-lg border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60 hover:text-white">Reload</button>
        <button onClick={saveAll} disabled={dirty.size === 0}
          className="rounded-lg bg-venom px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-void transition enabled:hover:brightness-110 disabled:opacity-40">Save all</button>
        <Link href="/music" className="rounded-lg border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60 hover:text-white">View site</Link>
        <button onClick={changePassword} className="rounded-lg border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/40 hover:text-white">Password</button>
        <button onClick={signOut} className="rounded-lg border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/40 hover:text-white">Sign out</button>
      </div>

      {status.msg && (
        <p className={`mb-4 font-mono text-xs ${status.kind === "err" ? "text-red-300" : status.kind === "ok" ? "text-venom" : "text-white/50"}`}>{status.msg}</p>
      )}

      <div className="space-y-3 pb-24">
        {filtered.map((r) => (
          <div key={r.id} className={`rounded-xl border p-4 backdrop-blur transition ${dirty.has(r.id) ? "border-venom/40 bg-venom/[0.04]" : "border-white/10 bg-white/[0.03]"}`}>
            <div className="flex items-start gap-3">
              {/* cover preview */}
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10" style={{ background: `${r.color || "#43f7ff"}22` }}>
                {r.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.cover} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0"; }} />
                )}
              </div>

              <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Title"><input value={r.title} onChange={(e) => edit(r.id, "title", e.target.value)} className={inp} /></Field>
                <Field label="Artist"><input value={r.artist || ""} onChange={(e) => edit(r.id, "artist", e.target.value)} className={inp} /></Field>
                <Field label="Genre"><input list="genres" value={r.genre || ""} onChange={(e) => edit(r.id, "genre", e.target.value)} className={inp} /></Field>
                <Field label="Mood"><input list="moods" value={r.mood || ""} onChange={(e) => edit(r.id, "mood", e.target.value)} className={inp} /></Field>
                <Field label="Cover URL"><input value={r.cover || ""} onChange={(e) => edit(r.id, "cover", e.target.value || null)} placeholder="(gradient)" className={inp} /></Field>
                <Field label="Audio URL"><input value={r.audio_url} onChange={(e) => edit(r.id, "audio_url", e.target.value)} className={inp} /></Field>
                <Field label="Color">
                  <div className="flex items-center gap-2">
                    <input type="color" value={r.color || "#43f7ff"} onChange={(e) => edit(r.id, "color", e.target.value)} className="h-8 w-10 rounded border border-white/15 bg-transparent" />
                    <input value={r.color || ""} onChange={(e) => edit(r.id, "color", e.target.value)} className={inp} />
                  </div>
                </Field>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60">
                    <input type="checkbox" checked={r.featured} onChange={(e) => edit(r.id, "featured", e.target.checked)} /> Featured
                  </label>
                  <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-white/60">
                    <input type="checkbox" checked={r.hidden} onChange={(e) => edit(r.id, "hidden", e.target.checked)} /> Hidden
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <button onClick={() => move(r.id, -1)} className="rounded border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/40 hover:text-white">↑</button>
                <button onClick={() => move(r.id, 1)} className="rounded border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/40 hover:text-white">↓</button>
              </div>
            </div>

            <ThemeFields r={r} setTheme={setTheme} />
            <LyricsFields value={r.lyrics || ""} audioUrl={r.audio_url} title={r.title} onChange={(v) => edit(r.id, "lyrics", v || null)} />
          </div>
        ))}
      </div>
    </Shell>
  );
}

const inp = "w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-xs text-white outline-none focus:border-signal";

const THEME_SWATCHES: { key: keyof ThemeOverride; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "bg", label: "Background" },
];

// Per-song site-theme override. Left blank, a song auto-extracts its palette
// from the cover (needs CORS on the art bucket) or derives from its color.
function ThemeFields({ r, setTheme }: { r: TrackRow; setTheme: (id: string, patch: Partial<ThemeOverride>) => void }) {
  const theme = (r.theme || {}) as ThemeOverride;
  const has = Object.keys(theme).length > 0;
  const intensity = typeof theme.intensity === "number" ? theme.intensity : 0.6;

  return (
    <details className="mt-3 rounded-lg border border-white/10 bg-black/20">
      <summary className="cursor-pointer select-none px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/45 hover:text-white/70">
        Site theme (morph) {has && <span className="text-signal">· pinned</span>}
      </summary>
      <div className="flex flex-wrap items-end gap-4 border-t border-white/10 px-3 py-3">
        {THEME_SWATCHES.map(({ key, label }) => {
          const val = (theme[key] as string | undefined) || "";
          return (
            <label key={key} className="block">
              <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-white/35">{label}</span>
              <div className="flex items-center gap-1.5">
                <input type="color" value={val || (key === "bg" ? "#05030b" : "#43f7ff")}
                  onChange={(e) => setTheme(r.id, { [key]: e.target.value })}
                  className="h-7 w-8 rounded border border-white/15 bg-transparent" />
                <input value={val} placeholder="auto" onChange={(e) => setTheme(r.id, { [key]: e.target.value })}
                  className="w-20 rounded border border-white/15 bg-black/40 px-1.5 py-1 font-mono text-[10px] text-white outline-none focus:border-signal" />
              </div>
            </label>
          );
        })}
        <label className="block">
          <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-white/35">Morph intensity · {intensity.toFixed(2)}</span>
          <input type="range" min="0" max="1" step="0.05" value={intensity}
            onChange={(e) => setTheme(r.id, { intensity: parseFloat(e.target.value) })}
            className="w-32" style={{ accentColor: r.color || "#43f7ff" }} />
        </label>
        {has && (
          <button onClick={() => setTheme(r.id, { primary: "", secondary: "", accent: "", bg: "", intensity: undefined })}
            className="rounded border border-white/15 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white/50 hover:text-white">
            Clear → auto
          </button>
        )}
      </div>
    </details>
  );
}

// Per-song lyrics. Plain text renders as static stanzas on /music; paste
// LRC-style [mm:ss.xx] timestamps to unlock the time-synced cinematic view.
function LyricsFields({ value, audioUrl, title, onChange }: { value: string; audioUrl: string; title: string; onChange: (v: string) => void }) {
  const [syncing, setSyncing] = useState(false);
  const synced = /\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/.test(value);
  const lineCount = value.split("\n").filter((l) => l.trim()).length;
  const canSync = lineCount > 0 && !!audioUrl;
  return (
    <details className="mt-3 rounded-lg border border-white/10 bg-black/20">
      <summary className="cursor-pointer select-none px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/45 hover:text-white/70">
        Lyrics {lineCount > 0 && <span className="text-signal">· {lineCount} lines{synced ? " · synced" : ""}</span>}
      </summary>
      <div className="border-t border-white/10 px-3 py-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          placeholder={"One line per row.\nOptional: prefix a line with [00:12.50] for time-synced cinematic lyrics."}
          className="w-full resize-y rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-xs leading-6 text-white outline-none focus:border-signal"
        />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-wider text-white/30">
            Plain text = static lyrics · add <span className="text-white/50">[mm:ss.xx]</span> timestamps = cinematic karaoke sync
          </p>
          <button
            type="button"
            onClick={() => setSyncing(true)}
            disabled={!canSync}
            title={canSync ? "Time-stamp lines to the track" : "Needs lyrics + an audio URL"}
            className="rounded border border-plasma/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-plasma transition enabled:hover:bg-plasma/10 disabled:opacity-30"
          >
            ⏱ Sync to track
          </button>
        </div>
      </div>
      {syncing && (
        <LyricsSyncEditor
          title={title}
          audioUrl={audioUrl}
          value={value}
          onSave={(lrc) => onChange(lrc)}
          onClose={() => setSyncing(false)}
        />
      )}
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-white/35">{label}</span>
      {children}
    </label>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="relative min-h-screen px-4 py-6 sm:px-6">
      <div className={`relative mx-auto ${wide ? "max-w-6xl" : "max-w-xl pt-20"}`}>{children}</div>
    </main>
  );
}
