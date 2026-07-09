"use client";

// The stem mixer — the panel where the listener pulls the song apart.
// Presets are the front door (the combinations with a soul); the per-stem
// chips are the escape hatch for tinkerers. Styled after the Reactor panel.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMusicPlayer } from "./MusicPlayerContext";
import { useStemMix, stemMixStore, presetsFor, presetGains, STEM_ORDER } from "@/lib/stemMix";
import { StemOrchestra } from "./StemGlyphs";
import { stemsFor } from "@/lib/usePreview";
import type { Track } from "@/data/tracks";
import type { StemData } from "@/lib/stemSense";

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
      className="absolute right-3 top-16 z-[70] w-72 rounded-2xl border border-white/12 bg-[#0b0810]/95 p-3 backdrop-blur-md"
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

      {/* THE BAND — every instrument alive on its own stem; tap one to mute it. */}
      <p className="mt-3 px-1 font-mono text-[9px] uppercase tracking-widest text-white/25">the band · tap a musician to mute</p>
      <div className="mt-1.5 rounded-xl border border-white/8 bg-black/25 px-1 py-2">
        <StemOrchestra
          stems={stems}
          data={stemData}
          getTime={getTime}
          gainFor={(s) => (mix.active ? (mix.gains[s] ?? 1) : 1)}
          onTap={(s) => {
            const on = mix.active ? (mix.gains[s] ?? 1) > 0.5 : true;
            // First touch from the full mix = "pull this instrument out".
            if (!mix.active) { stemMixStore.setGain(s, 0); stemBus.engage(); }
            else stemMixStore.setGain(s, on ? 0 : 1);
          }}
        />
      </div>

      {/* THE LENS — hold anywhere on the stage to hear only what lives there. */}
      <button onClick={onToggleLens}
        className={`mt-3 w-full rounded-lg border px-3 py-2 text-left font-mono text-[11px] transition ${lensArmed ? "border-[var(--theme-primary)] text-white" : "border-white/12 text-white/70 hover:text-white"}`}
        style={lensArmed ? { background: "color-mix(in srgb, var(--theme-primary) 16%, transparent)", boxShadow: "0 0 14px color-mix(in srgb, var(--theme-primary) 40%, transparent)" } : undefined}>
        🔍 The Lens <span className="text-white/35">— {lensArmed ? "armed · hold the stage to x-ray" : "hold the stage, hear one layer"}</span>
      </button>
    </motion.div>
  );
}
