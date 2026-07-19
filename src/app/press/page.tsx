"use client";

// THE PRESSING PLANT — landing. Light by design: the format shelf and the
// privacy stance load instantly; the editor (and later the 3D Booth, the
// zip cruncher, the idea shelf) are separate lazy chunks.

import { useState, type ComponentType } from "react";
import { templateList } from "@/lib/press/templates/registry";
import { PrivacyBadge } from "@/components/press/PrivacyBadge";

// The editor loads ONLY on interaction (a handler-level import()) — a
// module-scope next/dynamic gets preloaded on landing, which blew the
// light-landing budget in P1 (~+700KB at networkidle). Doctrine: the FREE
// front door stays feather-weight.

const COMING = [
  { name: "The Booth (3D)", era: "next", blurb: "Rotate it, spin it, film it." },
];

export default function PressPage() {
  const [Editor, setEditor] = useState<ComponentType<{ templateId?: string }> | null>(null);
  const [pressing, setPressing] = useState(false);
  const [pickedId, setPickedId] = useState<string>("collector");
  async function enter(templateId: string) {
    setPickedId(templateId);
    setPressing(true);
    if (!Editor) {
      const m = await import("@/components/press/PressEditor");
      setEditor(() => m.default);
    }
  }
  return (
    <main className="min-h-[100dvh] bg-[#050510] text-zinc-200">
      <style>{`
        @font-face{font-family:"Bebas Neue";src:url(/fonts/BebasNeue-Regular.ttf) format("truetype")}
        @font-face{font-family:"Barlow Condensed Medium";src:url(/fonts/BarlowCondensed-Medium.ttf) format("truetype")}
        @font-face{font-family:"Barlow Condensed SemiBold";src:url(/fonts/BarlowCondensed-SemiBold.ttf) format("truetype")}
        @font-face{font-family:"Barlow Condensed Bold";src:url(/fonts/BarlowCondensed-Bold.ttf) format("truetype")}
      `}</style>
      <header className="mx-auto flex max-w-[1400px] items-start justify-between px-5 pt-8">
        <div>
          <h1 className="font-display text-3xl font-black tracking-[0.18em] text-amber-300">THE PRESSING PLANT</h1>
          <p className="mt-1 max-w-[560px] text-[12px] leading-5 text-zinc-500">
            Your song goes in. Physical media comes out. Cases today — cassettes, vinyl, jewel
            cases and their booklets are on the line next.
            <span className="text-emerald-500"> Everything happens in this tab: your art, audio, and lyrics never leave your machine.</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PrivacyBadge />
          <a href="/covers/make" className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600 transition hover:text-zinc-300">classic case maker →</a>
        </div>
      </header>

      {!pressing ? (
        <section className="mx-auto max-w-[1400px] p-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-600">The press — pick your format</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {templateList().map((t) => (
              <button key={t.id} onClick={() => enter(t.id)}
                className="group rounded-2xl border border-amber-400/30 bg-zinc-900/40 p-5 text-left transition hover:border-amber-400/70">
                <p className="font-display text-lg font-black tracking-widest text-zinc-100 group-hover:text-amber-300">{t.name.toUpperCase()}</p>
                <p className="mt-1 text-[11px] text-zinc-600">est. {t.era} · {t.blurb}</p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/80">press it →</p>
              </button>
            ))}
            {COMING.map((c) => (
              <div key={c.name} className="rounded-2xl border border-zinc-800/60 p-5 opacity-60">
                <p className="font-display text-lg font-black tracking-widest text-zinc-500">{c.name.toUpperCase()}</p>
                <p className="mt-1 text-[11px] text-zinc-700">est. {c.era} · {c.blurb}</p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-700">on the line — next press run</p>
              </div>
            ))}
          </div>
        </section>
      ) : Editor ? (
        <Editor templateId={pickedId} />
      ) : (
        <p className="p-8 text-center font-mono text-xs text-zinc-600">warming up the press…</p>
      )}
    </main>
  );
}
