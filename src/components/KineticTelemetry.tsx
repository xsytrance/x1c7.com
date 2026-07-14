"use client";

// LIVE TELEMETRY — the readouts that make the chrome an instrument: real BPM
// off the measured grid, the detected key, the section's energy tier, the
// countdown to the next drop, and a beat light that blinks with the actual
// kick. All read from the feature bus at a lazy poll — PRISM shows this much;
// no other music site can, because no other site MEASURED the song offline.
//
// Engine component (synced). Renders quiet placeholders when nothing plays.

import { useEffect, useState } from "react";
import { featureBus } from "@/lib/engine/features";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

interface Tele {
  bpm: string;
  key: string;
  tier: string;
  drop: string;
  beat: number;
  locked: boolean;
}

export function KineticTelemetry({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const [t, setT] = useState<Tele>({ bpm: "—", key: "—", tier: "—", drop: "—", beat: 0, locked: false });
  useEffect(() => {
    const id = window.setInterval(() => {
      const F = featureBus.F;
      setT({
        bpm: F.bpm > 0 ? F.bpm.toFixed(1) : "—",
        key: F.keyPc >= 0 ? `${NOTES[F.keyPc]} ${F.keyMode === 1 ? "MIN" : "MAJ"}` : "—",
        tier: F.level > 0.02 ? F.tier : "—",
        drop: Number.isFinite(F.beatsToDrop) ? `${F.beatsToDrop.toFixed(0)} BT` : "—",
        beat: F.beat,
        locked: F.gridLocked,
      });
    }, 66); // ~15fps — readouts are calm, the beat light still breathes
    return () => window.clearInterval(id);
  }, []);

  const cell = (label: string, value: string, color = "var(--inst-plasma)") => (
    <div className="flex flex-col items-start">
      <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-[var(--inst-dim)]">{label}</span>
      <span className="font-mono tabular-nums" style={{ fontSize: compact ? 12 : 14, color }}>{value}</span>
    </div>
  );

  return (
    <div className={`flex items-center ${compact ? "gap-3" : "gap-5"} ${className}`} data-telemetry>
      {cell("bpm", t.bpm, t.locked ? "var(--inst-plasma)" : "var(--inst-dim)")}
      {!compact && cell("key", t.key)}
      {cell("section", t.tier, "var(--inst-signal)")}
      {!compact && cell("drop in", t.drop, t.drop === "—" ? "var(--inst-dim)" : "var(--inst-warn)")}
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-full transition-none"
        style={{
          background: t.beat > 0.05 ? "var(--inst-signal)" : "#241b36",
          boxShadow: t.beat > 0.05 ? `0 0 ${Math.round(t.beat * 14)}px var(--inst-signal)` : "none",
        }}
        title="the beat, as measured"
      />
    </div>
  );
}
