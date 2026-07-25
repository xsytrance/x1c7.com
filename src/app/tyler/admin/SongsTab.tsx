"use client";

import { useState } from "react";
import type { TylerTrack } from "@/lib/tyler/types";
import { Field, Panel, Toggle } from "./ui";

type Run = (body: Record<string, unknown>, ok?: string) => Promise<boolean>;

/**
 * Songs. One row per song; tap to open it in place. Reordering is arrows, not
 * drag — dragging a list item on a phone fights the page scroll and loses.
 */
export function SongsTab({ tracks, run }: { tracks: TylerTrack[]; run: Run }) {
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= tracks.length) return;
    const order = tracks.map((t, k) => ({
      id: t.id,
      sort_order: k === i ? j : k === j ? i : k,
    }));
    await run({ action: "track.reorder", order }, "Moved");
  };

  return (
    <>
      <Panel title="Add a song" hint="Title now, everything else whenever you like.">
        {adding ? (
          <div className="space-y-3">
            <Field label="Title" value={title} onChange={setTitle} placeholder="New song" />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!title.trim()) return;
                  const ok = await run(
                    { action: "track.create", row: { title: title.trim(), sort_order: tracks.length } },
                    "Song added",
                  );
                  if (ok) {
                    setTitle("");
                    setAdding(false);
                  }
                }}
                className="flex-1 rounded-xl py-3.5 text-sm font-bold uppercase tracking-[0.15em]"
                style={{ background: "var(--t-primary)", color: "#fff" }}
              >
                Add it
              </button>
              <button onClick={() => setAdding(false)} className="rounded-xl border border-white/15 px-5 text-sm text-white/60">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full rounded-xl border border-dashed border-white/25 py-4 text-sm uppercase tracking-[0.15em] text-white/60"
          >
            + New song
          </button>
        )}
      </Panel>

      <Panel title={`Songs (${tracks.length})`} hint="Tap one to edit it.">
        {tracks.map((t, i) => (
          <div key={t.id} className="border-b border-white/5 last:border-0">
            <div className="flex items-center gap-2 py-2">
              <button onClick={() => setOpen(open === t.id ? null : t.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold" style={{ opacity: t.hidden ? 0.4 : 1 }}>
                  {t.title}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-white/30">
                  {t.hidden ? "hidden" : t.spotlight ? "in the rotation" : "not in the rotation"}
                </span>
              </button>
              <button onClick={() => move(i, -1)} disabled={i === 0} className="px-2 text-lg text-white/40 disabled:opacity-20" aria-label="Move up">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === tracks.length - 1} className="px-2 text-lg text-white/40 disabled:opacity-20" aria-label="Move down">↓</button>
            </div>
            {open === t.id && <SongEditor track={t} run={run} onDone={() => setOpen(null)} />}
          </div>
        ))}
      </Panel>
    </>
  );
}

function SongEditor({ track, run, onDone }: { track: TylerTrack; run: Run; onDone: () => void }) {
  const [d, setD] = useState(track);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: Partial<TylerTrack>) => setD((prev) => ({ ...prev, ...patch }));

  return (
    <div className="space-y-3 pb-5 pt-1">
      <Field label="Title" value={d.title} onChange={(v) => set({ title: v })} />
      <Field label="Subtitle" value={d.subtitle ?? ""} onChange={(v) => set({ subtitle: v })} />
      <Field label="The story" value={d.story ?? ""} onChange={(v) => set({ story: v })} multiline
             hint="One or two lines. This is what shows when the song is tonight's track." />
      <Field label="Key words" value={d.words.join(", ")} onChange={(v) => set({ words: v.split(",").map((w) => w.trim()).filter(Boolean) })}
             hint="Comma separated — they show as tags." />
      <Field label="Artwork URL" value={d.art ?? ""} onChange={(v) => set({ art: v })} />
      <Field label="Audio URL" value={d.audio_url ?? ""} onChange={(v) => set({ audio_url: v })} />
      <Field label="Suno link" value={d.suno_url ?? ""} onChange={(v) => set({ suno_url: v })} />
      <Field label="Show slug" value={d.show_slug ?? ""} onChange={(v) => set({ show_slug: v })}
             hint="If this song has a full x1c7 show — e.g. madetobreak." />

      <Toggle on={d.spotlight} onToggle={() => set({ spotlight: !d.spotlight })}>
        <span>
          <span className="block">Can be tonight&rsquo;s track</span>
          <span className="text-xs text-white/35">Included in the every-refresh rotation.</span>
        </span>
      </Toggle>
      <Toggle on={!d.hidden} onToggle={() => set({ hidden: !d.hidden })}>
        <span>
          <span className="block">Visible on the site</span>
          <span className="text-xs text-white/35">Hiding keeps it here without showing it publicly.</span>
        </span>
      </Toggle>

      <div className="flex gap-2 pt-1">
        <button
          onClick={async () => {
            const ok = await run({
              action: "track.update",
              id: d.id,
              patch: {
                title: d.title, subtitle: d.subtitle, story: d.story, words: d.words,
                art: d.art, audio_url: d.audio_url, suno_url: d.suno_url,
                show_slug: d.show_slug, spotlight: d.spotlight, hidden: d.hidden,
              },
            });
            if (ok) onDone();
          }}
          className="flex-1 rounded-xl py-3.5 text-sm font-bold uppercase tracking-[0.15em]"
          style={{ background: "var(--t-primary)", color: "#fff" }}
        >
          Save
        </button>
        <button
          onClick={async () => {
            if (!confirmDelete) return setConfirmDelete(true);
            await run({ action: "track.delete", id: d.id }, "Deleted");
          }}
          className="rounded-xl border px-5 text-sm"
          style={{ borderColor: confirmDelete ? "#ff5c7a" : "rgba(255,255,255,0.15)", color: confirmDelete ? "#ff8fa3" : "rgba(255,255,255,0.5)" }}
        >
          {confirmDelete ? "Really delete?" : "Delete"}
        </button>
      </div>
    </div>
  );
}
