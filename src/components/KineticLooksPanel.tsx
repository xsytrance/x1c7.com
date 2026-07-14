"use client";

// LOOKS panel — the show's memory, touchable. Fire a look (it morphs in over
// one bar of the real grid), capture the current control surface under a
// name, share packs as JSON. A thin skin over looks.ts: the controller fence
// and versioned migrations live there, not here.
//
// Engine component (synced): imports only engine libs, styled in the house
// language — mono micro-labels, glass panels, the theme's own accents.

import { useEffect, useRef, useState } from "react";
import { looksStore, type Look } from "@/lib/engine/looks";
import { featureBus } from "@/lib/engine/features";

export function KineticLooksPanel({ className = "" }: { className?: string }) {
  const [looks, setLooks] = useState<Look[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [firedId, setFiredId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => setLooks(looksStore.list());
  useEffect(refresh, []);

  // fire over one bar of the measured grid (2.4s when no grid)
  const barSec = () => {
    const bpm = featureBus.F.bpm;
    return bpm > 0 ? (4 * 60) / bpm : 2.4;
  };
  const fire = (l: Look) => {
    looksStore.fire(l.id, barSec());
    setFiredId(l.id);
    window.setTimeout(() => setFiredId((x) => (x === l.id ? null : x)), 900);
  };
  const saveNamed = () => {
    if (!naming) { setNaming(true); return; }
    looksStore.capture(name);
    setName("");
    setNaming(false);
    refresh();
  };
  const doExport = () => {
    const blob = new Blob([looksStore.exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kinetica-looks.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const doImport = async (file: File | undefined) => {
    if (!file) return;
    const n = looksStore.importJson(await file.text());
    if (n >= 0) refresh();
  };

  return (
    <div className={`w-56 rounded-xl border border-white/15 bg-black/60 p-3 backdrop-blur-md ${className}`} data-looks-panel>
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-white/70">Looks</span>
        <span className="ml-auto flex gap-1">
          <button onClick={saveNamed} title="Capture the current look"
            className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/60 hover:border-white/40 hover:text-white">
            {naming ? "OK" : "＋ Save"}
          </button>
          <button onClick={doExport} title="Export looks as JSON"
            className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[9px] text-white/60 hover:border-white/40 hover:text-white">⤓</button>
          <button onClick={() => fileRef.current?.click()} title="Import a looks pack"
            className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[9px] text-white/60 hover:border-white/40 hover:text-white">⤒</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden"
            onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ""; }} />
        </span>
      </div>

      {naming && (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") saveNamed(); if (e.key === "Escape") { setNaming(false); setName(""); } }}
          placeholder="name this look…"
          className="mb-2 w-full rounded border border-white/20 bg-black/50 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white outline-none focus:border-white/50"
        />
      )}

      <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
        {looks.map((l) => {
          const builtin = l.id.startsWith("builtin:");
          return (
            <button
              key={l.id}
              onClick={() => fire(l)}
              onContextMenu={(e) => { if (!builtin) { e.preventDefault(); looksStore.remove(l.id); refresh(); } }}
              title={builtin ? "Built-in look — click to fire (morphs over one bar)" : "Click to fire · right-click to delete"}
              className="group rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition"
              style={{
                borderColor: firedId === l.id ? "var(--theme-accent)" : "rgba(255,255,255,0.15)",
                color: firedId === l.id ? "var(--theme-accent)" : "rgba(255,255,255,0.65)",
                boxShadow: firedId === l.id ? "0 0 10px color-mix(in srgb, var(--theme-accent) 60%, transparent)" : "none",
              }}
            >
              {builtin && <span style={{ color: "var(--theme-primary)" }}>✦ </span>}
              {l.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
