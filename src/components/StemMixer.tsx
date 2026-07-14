"use client";

// The stem mixer — the panel where the listener pulls the song apart.
// Presets are the front door (the combinations with a soul); the per-stem
// chips are the escape hatch for tinkerers. Styled after the Reactor panel.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMusicPlayer } from "./MusicPlayerContext";
import { useStemMix, stemMixStore, presetsFor, presetGains, STEM_ORDER, STEM_INFO } from "@/lib/stemMix";
import { stemsFor } from "@/lib/usePreview";
import { envAt, type StemName } from "@/lib/stemSense";
import type { Track } from "@/data/tracks";
import type { StemData } from "@/lib/stemSense";

// ── CHANNEL STRIPS (UI overhaul phase 4) — the band as an instrument row:
// a live meter per stem (the MEASURED envelope, not an FFT guess), mute and
// SOLO under each, and an ◉ X-RAY badge when a solo has the backdrop
// surfacing that instrument's anatomy. ──
function ChannelStrips({ stems, data, getTime }: {
  stems: StemName[];
  data: StemData | null;
  getTime: () => number;
}) {
  const mix = useStemMix();
  const { stemBus } = useMusicPlayer();
  const [levels, setLevels] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!data) return;
    const id = window.setInterval(() => {
      const t = getTime();
      const next: Record<string, number> = {};
      for (const s of stems) next[s] = envAt(data, s, t) * stemMixStore.visualGain(s);
      setLevels(next);
    }, 80); // ~12fps — smooth to the eye, invisible to the CPU
    return () => window.clearInterval(id);
  }, [data, stems, getTime]);

  const soloed = mix.solo?.[0] ?? null;
  const gainOf = (s: StemName) => (mix.active ? (mix.gains[s] ?? 1) : 1);
  const toggleMute = (s: StemName) => {
    if (!mix.active) { stemMixStore.setGain(s, 0); stemBus.engage(); return; }
    stemMixStore.setGain(s, gainOf(s) > 0.5 ? 0 : 1);
  };
  const toggleSolo = (s: StemName) => {
    if (soloed === s) { stemMixStore.setSolo(null); return; }
    if (!mix.active) stemBus.engage();
    stemMixStore.setSolo([s]);
  };

  return (
    <div className="mt-1.5 flex flex-wrap justify-center gap-1.5 rounded-xl border border-[var(--inst-line)] bg-black/25 p-2">
      {stems.map((s) => {
        const muted = mix.active && gainOf(s) === 0 && soloed !== s;
        const isSolo = soloed === s;
        return (
          <div
            key={s}
            className="flex w-[52px] flex-col items-center gap-1 rounded-lg border p-1.5"
            style={{
              borderColor: isSolo ? "var(--inst-plasma)" : "var(--inst-line)",
              background: "var(--inst-s2)",
              boxShadow: isSolo ? "0 0 12px color-mix(in srgb, var(--inst-plasma) 35%, transparent)" : "none",
              opacity: muted ? 0.45 : 1,
            }}
          >
            <span className="text-[13px] leading-none" aria-hidden>{STEM_INFO[s].icon}</span>
            <div className="relative h-11 w-1.5 overflow-hidden rounded-full bg-[#1c142e]">
              <div
                className="absolute inset-x-0 bottom-0 rounded-full"
                style={{ height: `${Math.round((levels[s] ?? 0) * 100)}%`, background: "linear-gradient(180deg, var(--inst-warn), var(--inst-plasma))" }}
              />
            </div>
            <span className="max-w-full truncate font-mono text-[7px] uppercase tracking-[0.12em] text-[var(--inst-dim)]">{STEM_INFO[s].label}</span>
            <div className="flex gap-1">
              <button
                onClick={() => toggleMute(s)}
                aria-label={`Mute ${STEM_INFO[s].label}`}
                className="rounded border px-1 font-mono text-[8px]"
                style={muted ? { borderColor: "var(--inst-signal)", color: "var(--inst-signal)" } : { borderColor: "var(--inst-line)", color: "var(--inst-faint)" }}
              >M</button>
              <button
                onClick={() => toggleSolo(s)}
                aria-label={`Solo ${STEM_INFO[s].label} — the X-Ray`}
                className="rounded border px-1 font-mono text-[8px]"
                style={isSolo ? { borderColor: "var(--inst-plasma)", color: "var(--inst-plasma)" } : { borderColor: "var(--inst-line)", color: "var(--inst-faint)" }}
              >S</button>
            </div>
            <span className="font-mono text-[6.5px] tracking-[0.2em]" style={{ color: "var(--inst-plasma)", opacity: isSolo ? 1 : 0.15 }}>◉ X-RAY</span>
          </div>
        );
      })}
    </div>
  );
}

export function StemMixer({ track, getTime, onClose, lensArmed, onToggleLens }: {
  track: Track;
  getTime: () => number;
  onClose: () => void;
  lensArmed: boolean;
  onToggleLens: () => void;
}) {
  const { stemBus } = useMusicPlayer();
  const mix = useStemMix();
  const presets = presetsFor(mix.available);
  const stems = STEM_ORDER.filter((s) => mix.available.includes(s));

  // THE BAND — measured hearing for the glyphs (cached; null just idles them).
  const [stemData, setStemData] = useState<StemData | null>(null);
  useEffect(() => {
    let dead = false;
    void stemsFor(track).then((d) => { if (!dead) setStemData(d); });
    return () => { dead = true; };
  }, [track]);

  // Which preset (if any) the current gains spell out — for highlighting.
  const activePreset = mix.active
    ? presets.find((p) => {
        const g = presetGains(p, mix.available);
        return mix.available.every((s) => (mix.gains[s] ?? 1) === g[s]);
      })?.id ?? null
    : null;
  const fullMix = !mix.active;

  return (
    <motion.div
      className="absolute right-3 top-16 z-[70] w-[21rem] rounded-2xl border border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s1)_95%,transparent)] p-3 backdrop-blur-md"
      initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-black uppercase tracking-wide" style={{ color: "var(--theme-primary)" }}>🎚 Stems</h3>
        <button onClick={onClose} className="font-mono text-xs text-white/50 hover:text-white">✕</button>
      </div>
      <p className="mt-0.5 font-mono text-[10px] leading-snug text-white/40">
        {mix.status === "loading" ? "separating the song… (loading stems)"
          : mix.status === "error" ? "stems unreachable — the full mix plays on"
          : "the real separated instruments. the mix is yours."}
      </p>

      <div className="mt-2 grid grid-cols-1 gap-1.5">
        <button onClick={() => stemBus.disengage()}
          className={`rounded-lg border px-3 py-2 text-left font-mono text-[11px] transition ${fullMix ? "border-white/40 text-white" : "border-white/12 text-white/60 hover:text-white"}`}>
          ◐ Full mix <span className="text-white/30">— the mastered song</span>
        </button>
        {presets.map((p) => (
          <button key={p.id}
            onClick={() => { stemMixStore.setGains(presetGains(p, mix.available)); stemMixStore.setSolo(null); stemBus.engage(); }}
            className={`rounded-lg border px-3 py-2 text-left font-mono text-[11px] transition ${activePreset === p.id ? "border-[var(--theme-primary)] text-white" : "border-white/12 text-white/70 hover:text-white"}`}
            style={activePreset === p.id ? { background: "color-mix(in srgb, var(--theme-primary) 16%, transparent)" } : undefined}>
            {p.icon} {p.label} <span className="text-white/35">— {p.blurb}</span>
          </button>
        ))}
      </div>

      {/* THE BAND — channel strips: live measured meters, mute/solo per stem.
          Solo = the X-Ray: the backdrop surfaces that instrument's anatomy. */}
      <p className="mt-3 px-1 font-mono text-[9px] uppercase tracking-widest text-white/25">the band · live meters · M mutes · S solos (x-ray)</p>
      <ChannelStrips stems={stems} data={stemData} getTime={getTime} />

      {/* THE LENS — hold anywhere on the stage to hear only what lives there. */}
      <button onClick={onToggleLens}
        className={`mt-3 w-full rounded-lg border px-3 py-2 text-left font-mono text-[11px] transition ${lensArmed ? "border-[var(--theme-primary)] text-white" : "border-white/12 text-white/70 hover:text-white"}`}
        style={lensArmed ? { background: "color-mix(in srgb, var(--theme-primary) 16%, transparent)", boxShadow: "0 0 14px color-mix(in srgb, var(--theme-primary) 40%, transparent)" } : undefined}>
        🔍 The Lens <span className="text-white/35">— {lensArmed ? "armed · hold the stage to x-ray" : "hold the stage, hear one layer"}</span>
      </button>
    </motion.div>
  );
}
