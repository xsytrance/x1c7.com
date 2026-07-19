"use client";

// The network-silence lamp — the Plant's privacy promise made inspectable.
// FREE is architecturally fetch-silent (scripts/press/fetch-guard.mjs fails
// the build otherwise), so this badge states facts, not marketing.

import { useState } from "react";

export function PrivacyBadge() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-emerald-500/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-400">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        Tab-silent
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-72 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-4 text-zinc-400 shadow-xl">
          <p className="text-zinc-200">Everything happens in this tab.</p>
          <p className="mt-1">Your song, your stems, your lyrics — none of it is uploaded, logged, or seen by anyone, including us. Close the tab and it&apos;s gone (your draft stays on <em>your</em> device).</p>
          <p className="mt-2">This session&apos;s only network activity: loading the page, the fonts, and (if you open the idea shelf) a public dictionary — a GET that carries none of your data.</p>
          <p className="mt-2 text-zinc-500">Don&apos;t take our word for it: open devtools (F12 → Network), drop your most unreleased song, and watch — zero uploads. The build fails if this ever stops being true.</p>
        </div>
      )}
    </div>
  );
}
