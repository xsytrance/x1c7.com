"use client";

// THE SELF-BUILDING PANEL — PRISM's ui.js idea, in React: hand it registry
// group names and it renders every parameter as a proper control. Add one
// P.register() anywhere in the engine and it appears here with a slider, a
// live readout, a modulation ribbon when an LFO/follow is riding it, a lock,
// and a ☆ pin — nothing else to wire. This is why the registry exists.
//
// Engine component (synced). House instrument tokens; the amber ribbon above
// a track is the live modulation swing (base value stays where you left it).

import { useEffect, useMemo, useRef, useState } from "react";
import { P, type ParamDef } from "@/lib/engine/params";

const PIN_KEY = "kinetica-pins";
const loadPins = (): string[] => {
  try { return JSON.parse(window.localStorage.getItem(PIN_KEY) || "[]"); } catch { return []; }
};
const savePins = (ids: string[]) => {
  try { window.localStorage.setItem(PIN_KEY, JSON.stringify(ids)); } catch { /* private mode */ }
};

const fmt = (v: number, step: number) => (step >= 1 ? String(Math.round(v)) : v.toFixed(2).replace(/^(-?)0\./, "$1."));

function FloatRow({ p, pinned, onPin }: { p: ParamDef; pinned: boolean; onPin: () => void }) {
  const base = P.getBase(p.id) as number;
  const eff = P.get(p.id);
  const span = p.max - p.min || 1;
  const basePct = ((base - p.min) / span) * 100;
  const effPct = ((eff - p.min) / span) * 100;
  const ribbon = Math.abs(effPct - basePct) > 0.5;
  const locked = P.isLocked(p.id);
  return (
    <div className="grid grid-cols-[92px_1fr_38px_16px_16px] items-center gap-2 py-1" data-param={p.id}>
      <label className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--inst-dim)]" title={p.id}>{p.label}</label>
      <div className="relative flex h-6 items-center">
        <div className="relative h-1.5 w-full rounded-full bg-[#221a35]">
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${basePct}%`, background: "color-mix(in srgb, var(--inst-plasma) 55%, #2b3f55)" }} />
          {ribbon && (
            <div
              className="absolute -top-[5px] h-[3px] rounded-full bg-[var(--inst-warn)] opacity-90"
              style={{ left: `${Math.min(basePct, effPct)}%`, width: `${Math.abs(effPct - basePct)}%` }}
              title="live modulation (LFO / stem-follow)"
            />
          )}
          <div className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--inst-ink)] shadow" style={{ left: `${basePct}%` }} />
        </div>
        <input
          type="range"
          aria-label={p.label}
          min={p.min}
          max={p.max}
          step={p.step}
          value={base}
          onChange={(e) => P.set(p.id, +e.target.value, "ui")}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <span className="text-right font-mono text-[10px] tabular-nums" style={{ color: ribbon ? "var(--inst-warn)" : "var(--inst-plasma)" }}>
        {fmt(ribbon ? eff : base, p.step)}
      </span>
      <button
        onClick={() => { P.lock(p.id, !locked); }}
        title={locked ? "Locked — Randomize/looks skip it" : "Unlocked"}
        className="grid h-5 w-4 place-items-center text-[9px]"
        // color emoji ignores CSS color — desaturate the open padlock instead
        style={{ filter: locked ? "none" : "grayscale(1) opacity(0.35)" }}
      >{locked ? "🔒" : "🔓"}</button>
      <button
        onClick={onPin}
        title={pinned ? "Unpin" : "Pin to the top of every workspace"}
        className="grid h-5 w-4 place-items-center text-[10px]"
        style={{ color: pinned ? "var(--inst-warn)" : "var(--inst-faint)" }}
      >{pinned ? "★" : "☆"}</button>
    </div>
  );
}

function BoolRow({ p }: { p: ParamDef }) {
  const on = P.getBool(p.id);
  return (
    <div className="grid grid-cols-[92px_1fr] items-center gap-2 py-1" data-param={p.id}>
      <label className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--inst-dim)]">{p.label}</label>
      <button
        onClick={() => P.set(p.id, !on, "ui")}
        className="h-6 w-14 rounded border font-mono text-[9px] uppercase tracking-[0.15em]"
        style={on
          ? { background: "var(--inst-plasma)", borderColor: "var(--inst-plasma)", color: "#001016", fontWeight: 700 }
          : { borderColor: "var(--inst-line)", color: "var(--inst-dim)" }}
      >{on ? "on" : "off"}</button>
    </div>
  );
}

function SelectRow({ p }: { p: ParamDef }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-center gap-2 py-1" data-param={p.id}>
      <label className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--inst-dim)]">{p.label}</label>
      <select
        value={String(P.getBase(p.id))}
        onChange={(e) => P.set(p.id, e.target.value, "ui")}
        className="h-6 w-full rounded border border-[var(--inst-line)] bg-[var(--inst-s2)] px-1.5 font-mono text-[10px] uppercase text-[var(--inst-ink)] outline-none focus:border-[var(--inst-plasma)]"
      >
        {(p.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function KineticParamPanel({ groups, className = "" }: {
  /** Registry groups to render, in order. Omit = every group in the registry. */
  groups?: string[];
  className?: string;
}) {
  const [, force] = useState(0);
  const [pins, setPins] = useState<string[]>([]);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  useEffect(() => setPins(loadPins()), []);

  // value writes → one rerender per frame, not per set()
  useEffect(() => {
    let queued = false;
    return P.onChange(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; force((n) => n + 1); });
    });
  }, []);
  // modulation ribbons breathe (~12 fps is plenty for the eye, cheap for the CPU)
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 85);
    return () => window.clearInterval(id);
  }, []);

  const groupNames = useMemo(() => {
    if (groups) return groups;
    const all: string[] = [];
    for (const p of P.all()) if (!all.includes(p.group)) all.push(p.group);
    return all;
  }, [groups]);

  const togglePin = (id: string) => {
    setPins((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      savePins(next);
      return next;
    });
  };

  const row = (p: ParamDef) => {
    const pinned = pins.includes(p.id);
    if (p.type === "float") return <FloatRow key={p.id} p={p} pinned={pinned} onPin={() => togglePin(p.id)} />;
    if (p.type === "bool") return <BoolRow key={p.id} p={p} />;
    if (p.type === "select") return <SelectRow key={p.id} p={p} />;
    return null;
  };

  const pinnedDefs = pins.map((id) => P.def(id)).filter(Boolean) as ParamDef[];

  return (
    <div className={`rounded-xl border border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s1)_88%,transparent)] p-3 backdrop-blur-md ${className}`} data-kinetic-panel>
      {pinnedDefs.length > 0 && (
        <div className="mb-2 border-b border-[var(--inst-line)] pb-2">
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--inst-warn)]">★ Pinned</div>
          {pinnedDefs.map(row)}
        </div>
      )}
      {groupNames.map((g) => {
        const defs = P.group(g);
        if (!defs.length) return null;
        const isClosed = closed[g];
        return (
          <div key={g} className="border-b border-[var(--inst-line)] py-1.5 last:border-b-0">
            <button
              onClick={() => setClosed((c) => ({ ...c, [g]: !c[g] }))}
              className="flex w-full items-center gap-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--inst-dim)] hover:text-[var(--inst-ink)]"
            >
              {g}<span className="ml-auto text-[var(--inst-faint)]">{isClosed ? "▸" : "▾"}</span>
            </button>
            {!isClosed && defs.map(row)}
          </div>
        );
      })}
    </div>
  );
}
