"use client";

import { useRef, useState } from "react";
import type { TylerMedia, TylerMediaKind } from "@/lib/tyler/types";
import { api } from "./client";
import { Panel } from "./ui";

type Run = (body: Record<string, unknown>, ok?: string) => Promise<boolean>;

const KINDS: { id: TylerMediaKind; label: string; hint: string; accept: string }[] = [
  { id: "photo", label: "Photos", hint: "The gallery on the page.", accept: "image/*" },
  { id: "press", label: "Press", hint: "One-sheets, bios, press shots.", accept: "image/*,application/pdf" },
  { id: "flyer", label: "Flyers", hint: "Show posters, promo art.", accept: "image/*,application/pdf" },
  { id: "logo", label: "Logos", hint: "Marks and wordmarks.", accept: "image/*" },
  { id: "stem", label: "Suno stems", hint: "The ZIP straight from Suno — up to 200MB.", accept: ".zip,application/zip" },
];

export function MediaTab({
  media, run, reload, flash, downscale,
}: {
  media: TylerMedia[];
  run: Run;
  reload: () => Promise<void>;
  flash: (m: string) => void;
  downscale: (f: File) => Promise<File>;
}) {
  const [kind, setKind] = useState<TylerMediaKind>("photo");
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const active = KINDS.find((k) => k.id === kind)!;
  const shown = media.filter((m) => m.kind === kind);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    for (let i = 0; i < files.length; i++) {
      const raw = files[i];
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      const file = kind === "stem" ? raw : await downscale(raw);
      const res = await api.upload(file, kind);
      if (!res.ok) {
        setBusy(null);
        flash(res.error ?? "Upload failed");
        return;
      }
    }
    setBusy(null);
    flash(files.length > 1 ? `${files.length} uploaded` : "Uploaded");
    await reload();
  }

  return (
    <>
      <Panel title="What are you adding?" hint={active.hint}>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className="rounded-full border px-3.5 py-2 text-xs uppercase tracking-wider"
              style={
                kind === k.id
                  ? { borderColor: "var(--t-primary)", color: "var(--t-primary)" }
                  : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)" }
              }
            >
              {k.label}
            </button>
          ))}
        </div>

        <input
          ref={input}
          type="file"
          accept={active.accept}
          multiple={kind !== "stem"}
          className="hidden"
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => input.current?.click()}
          disabled={!!busy}
          className="w-full rounded-xl py-4 text-sm font-bold uppercase tracking-[0.15em] disabled:opacity-50"
          style={{ background: "var(--t-primary)", color: "#fff" }}
        >
          {busy ?? `Choose ${active.label.toLowerCase()}`}
        </button>
        {kind === "photo" && (
          <p className="text-xs text-white/30">
            Photos are shrunk on your phone before they upload — the page never needs more than 2400px.
          </p>
        )}
      </Panel>

      <Panel title={`${active.label} (${shown.length})`} hint="Arrows reorder. The link is copyable for DMs.">
        {!shown.length && <p className="text-sm text-white/35">Nothing here yet.</p>}
        {shown.map((m, i) => (
          <div key={m.id} className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0">
            {m.content_type?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" loading="lazy" />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded bg-white/5 text-lg">◫</span>
            )}
            <div className="min-w-0 flex-1">
              <input
                defaultValue={m.caption ?? ""}
                placeholder="Add a caption…"
                onBlur={(e) => e.target.value !== (m.caption ?? "") && run({ action: "media.update", id: m.id, patch: { caption: e.target.value } }, "Caption saved")}
                className="w-full bg-transparent text-sm outline-none placeholder:text-white/25"
              />
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(m.url);
                  flash("Link copied");
                }}
                className="text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60"
              >
                copy link
              </button>
            </div>
            <button onClick={() => run({ action: "media.reorder", order: reordered(shown, i, -1) }, "Moved")}
                    disabled={i === 0} className="px-1.5 text-lg text-white/40 disabled:opacity-20" aria-label="Move up">↑</button>
            <button onClick={() => run({ action: "media.reorder", order: reordered(shown, i, 1) }, "Moved")}
                    disabled={i === shown.length - 1} className="px-1.5 text-lg text-white/40 disabled:opacity-20" aria-label="Move down">↓</button>
            <button onClick={() => run({ action: "media.delete", id: m.id }, "Deleted")}
                    className="px-1.5 text-white/30 hover:text-red-400" aria-label="Delete">✕</button>
          </div>
        ))}
      </Panel>
    </>
  );
}

function reordered(list: TylerMedia[], i: number, dir: -1 | 1) {
  const j = i + dir;
  return list.map((m, k) => ({ id: m.id, sort_order: k === i ? j : k === j ? i : k }));
}
