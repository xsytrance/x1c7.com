"use client";

// THE IDEA SHELF — Lexsycon seeds for the visitor's own words. Opens lazily
// (the 5.8MB public dictionary only loads on demand); each card offers the
// sense painting (or its palette as a tile), the emotion, a one-tap spine
// word, and a copyable imagery prompt for their own image tools.

import { useState } from "react";
import { projectStore } from "@/lib/press/state/projectStore";
import type { LexSeed } from "@/lib/press/seeds/lexiconSeeds";

const HINT = "text-[11px] leading-4 text-zinc-600";

export function SeedDrawer({ lyrics }: { lyrics: string | null | undefined }) {
  const [seeds, setSeeds] = useState<LexSeed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function open() {
    if (busy || !lyrics?.trim()) return;
    setBusy(true); setMsg("opening the idea shelf (public dictionary, none of your data leaves)…");
    try {
      const { lexiconSeeds } = await import("@/lib/press/seeds/lexiconSeeds");
      const out = await lexiconSeeds(lyrics);
      setSeeds(out);
      setMsg(out.length ? `${out.length} of your words live on the shelf` : "none of your words are on the shelf yet — it grows nightly");
    } catch {
      setMsg("the shelf is unreachable right now — everything else works without it");
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">◆ The idea shelf</p>
        <button onClick={open} disabled={busy || !lyrics?.trim()}
          className="rounded-full border border-zinc-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 transition hover:border-amber-400/60 hover:text-amber-300 disabled:opacity-40">
          {busy ? "opening…" : seeds ? "refresh" : "open"}
        </button>
      </div>
      <p className={`${HINT} mt-1`}>{lyrics?.trim() ? "Your heavy words, as the Lexsycon painted them — palettes, moods, prompt seeds." : "Feed me lyrics first — the shelf matches your words."}</p>
      {seeds && seeds.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {seeds.map((sd) => (
            <div key={sd.word} className="flex gap-2 rounded-lg border border-zinc-800 p-1.5">
              {sd.image
                ? /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={sd.image} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded object-cover" />
                : <span className="h-10 w-10 shrink-0 rounded" style={{ background: sd.palette?.length ? `linear-gradient(135deg, ${sd.palette.slice(0, 3).join(",")})` : "#1a1a24" }} />}
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold uppercase tracking-wider text-amber-300/90">{sd.word}</span>
                <span className={`${HINT} block truncate`}>{sd.emotion ?? sd.gravity}</span>
                <span className="mt-0.5 flex gap-1.5">
                  <button onClick={() => { projectStore.apply((d) => { d.identity.spineWord = sd.word.toUpperCase(); }); setMsg(`spine word → ${sd.word.toUpperCase()}`); }}
                    className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 underline decoration-dotted hover:text-amber-300">spine</button>
                  {sd.prompt && (
                    <button onClick={() => { void navigator.clipboard.writeText(sd.prompt!); setMsg(`"${sd.word}" prompt copied — take it to your image tool`); }}
                      className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 underline decoration-dotted hover:text-amber-300">copy prompt</button>
                  )}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
      {msg && <p className={`${HINT} mt-2`}>{msg}</p>}
    </div>
  );
}
