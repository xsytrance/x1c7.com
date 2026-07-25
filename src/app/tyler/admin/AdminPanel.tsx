"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { TylerMedia, TylerSite, TylerTrack } from "@/lib/tyler/types";
import { TYLER_SECTION_LABELS, normalizeSite } from "@/lib/tyler/types";
import { api, downscale } from "./client";
import { Field, Panel, Row, SaveBar, TabBar, type Tab } from "./ui";
import { LookTab } from "./LookTab";
import { SongsTab } from "./SongsTab";
import { MediaTab } from "./MediaTab";
import { LabTab } from "./LabTab";
import { AccountTab } from "./AccountTab";

/**
 * Juan's whole toolkit. Phone-first: one column, big targets, a sticky tab bar
 * in the thumb zone, and every save is one tap with a visible result. Desktop
 * gets the same panels with room to breathe rather than a different product.
 */
export function AdminPanel({ username, viaTailnet }: { username: string; viaTailnet: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("songs");
  const [site, setSite] = useState<TylerSite | null>(null);
  const [tracks, setTracks] = useState<TylerTrack[]>([]);
  const [media, setMedia] = useState<TylerMedia[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const json = await api.get();
    if (!json.ok) {
      setError(json.error ?? "Couldn't load your site.");
      return;
    }
    setSite(normalizeSite(json.site));
    setTracks(json.tracks);
    setMedia(json.media);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = useCallback((message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 2200);
  }, []);

  const run = useCallback(
    async (body: Record<string, unknown>, okMessage = "Saved") => {
      setError(null);
      const json = await api.post(body);
      if (!json.ok) {
        setError(json.error ?? "That didn't save.");
        return false;
      }
      flash(okMessage);
      await load();
      router.refresh();
      return true;
    },
    [flash, load, router],
  );

  if (error && !site) {
    return (
      <main className="mx-auto max-w-md px-5 py-32 text-center">
        <p className="text-sm text-white/60">{error}</p>
      </main>
    );
  }
  if (!site) {
    return (
      <main className="mx-auto max-w-md px-5 py-32 text-center">
        <p className="text-sm text-white/40">Loading your site…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-24 md:px-8">
      <header className="mb-6">
        <h1 className="text-4xl leading-none md:text-5xl" style={{ fontFamily: "var(--t-display)" }}>
          Your site
        </h1>
        <p className="mt-2 text-sm text-white/45">
          Signed in as <span className="text-white/75">{username}</span>
          {viaTailnet && " (owner, over the tailnet)"} ·{" "}
          <Link href="/tyler" className="underline underline-offset-4 hover:text-white">
            view it
          </Link>
        </p>
      </header>

      <TabBar tab={tab} onTab={setTab} />

      <div className="mt-6 space-y-4">
        {tab === "songs" && <SongsTab tracks={tracks} run={run} />}
        {tab === "media" && <MediaTab media={media} run={run} reload={load} flash={flash} downscale={downscale} />}
        {tab === "look" && <LookTab site={site} run={run} />}
        {tab === "words" && <WordsTab site={site} run={run} />}
        {tab === "lab" && <LabTab />}
        {tab === "account" && <AccountTab username={username} viaTailnet={viaTailnet} />}
      </div>

      <SaveBar status={status} error={error} />
    </main>
  );
}

// ── WORDS — the copy on the page, plus the section order ───────────────────
function WordsTab({
  site,
  run,
}: {
  site: TylerSite;
  run: (body: Record<string, unknown>, ok?: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(site);
  const set = (patch: Partial<TylerSite>) => setDraft((d) => ({ ...d, ...patch }));

  const move = (i: number, dir: -1 | 1) => {
    const next = [...draft.sections];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set({ sections: next });
  };

  return (
    <>
      <Panel title="The words" hint="What the page says above the music.">
        <Field label="Artist" value={draft.artist} onChange={(v) => set({ artist: v })} />
        <Field label="Also known as" value={draft.by_line} onChange={(v) => set({ by_line: v })} />
        <Field label="Album" value={draft.album} onChange={(v) => set({ album: v })} />
        <Field label="Badge" value={draft.tagline ?? ""} onChange={(v) => set({ tagline: v })} hint="The little pill above the title — e.g. OUT NOW." />
        <Field label="Genre" value={draft.genre ?? ""} onChange={(v) => set({ genre: v })} />
        <Field label="Released" value={draft.released ?? ""} onChange={(v) => set({ released: v })} />
        <Field label="Cover image URL" value={draft.cover ?? ""} onChange={(v) => set({ cover: v })} />
        <Field label="The note" value={draft.message ?? ""} onChange={(v) => set({ message: v })} multiline
               hint="The quote under the hero." />
        <Field label="Advisory line" value={draft.rated ?? ""} onChange={(v) => set({ rated: v })} multiline
               hint="Leave empty to drop the RATED badge." />
      </Panel>

      <Panel title="Section order" hint="Drag-free on purpose — arrows work with one thumb.">
        {draft.sections.map((s, i) => (
          <Row key={s.id}>
            <span className="flex-1 text-sm">{TYLER_SECTION_LABELS[s.id]}</span>
            <button
              onClick={() => set({ sections: draft.sections.map((x) => (x.id === s.id ? { ...x, visible: !x.visible } : x)) })}
              className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] uppercase tracking-wider"
              style={s.visible ? { borderColor: "var(--t-primary)", color: "var(--t-primary)" } : { color: "rgba(255,255,255,0.35)" }}
            >
              {s.visible ? "shown" : "hidden"}
            </button>
            <button onClick={() => move(i, -1)} className="px-2 text-lg text-white/45 disabled:opacity-20" disabled={i === 0} aria-label="Move up">↑</button>
            <button onClick={() => move(i, 1)} className="px-2 text-lg text-white/45 disabled:opacity-20" disabled={i === draft.sections.length - 1} aria-label="Move down">↓</button>
          </Row>
        ))}
      </Panel>

      <button
        onClick={() =>
          run({
            action: "site.update",
            patch: {
              artist: draft.artist, by_line: draft.by_line, album: draft.album, tagline: draft.tagline,
              genre: draft.genre, released: draft.released, cover: draft.cover, message: draft.message,
              rated: draft.rated, sections: draft.sections,
            },
          })
        }
        className="w-full rounded-xl py-4 text-sm font-bold uppercase tracking-[0.2em]"
        style={{ background: "var(--t-primary)", color: "#fff" }}
      >
        Save the words
      </button>
    </>
  );
}
