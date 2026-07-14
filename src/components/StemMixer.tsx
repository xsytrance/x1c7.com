"use client";

// The stem mixer — the panel where the listener pulls the song apart.
// Presets are the front door (the combinations with a soul); the per-stem
// chips are the escape hatch for tinkerers. Styled after the Reactor panel.
//
// Two bodies, one brain: on desktop the floating right-side card with
// vertical channel strips; on phones a BottomSheet (half snap) where each
// stem is a full-width horizontal strip and the meter fill IS the gain
// control — drag anywhere on the row. The mix logic below is shared.

import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { useMusicPlayer } from "./MusicPlayerContext";
import { useStemMix, stemMixStore, presetsFor, presetGains, STEM_ORDER, STEM_INFO, type StemPreset } from "@/lib/stemMix";
import { stemsFor } from "@/lib/usePreview";
import { envAt, type StemName } from "@/lib/stemSense";
import { BottomSheet } from "./mobile/BottomSheet";
import type { Track } from "@/data/tracks";
import type { StemData } from "@/lib/stemSense";

// ── SHARED BRAIN — stem list, gain/mute/solo/preset handlers, meter
// polling. Both the desktop card and the phone sheet run on these. ──────────

/** md breakpoint — below it the mixer becomes a bottom sheet. */
function useIsPhone() {
  // Mounted post-hydration only (behind mixerOpen), so reading matchMedia
  // in the initializer is safe and kills the desktop-card flash.
  const [phone, setPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

function useMixerBrain(track: Track) {
  const { stemBus } = useMusicPlayer();
  const mix = useStemMix();
  const presets = presetsFor(mix.available);
  const stems = STEM_ORDER.filter((s) => mix.available.includes(s));

  // THE BAND — measured hearing for the meters (cached; null just idles them).
  const [stemData, setStemData] = useState<StemData | null>(null);
  useEffect(() => {
    let dead = false;
    void stemsFor(track).then((d) => { if (!dead) setStemData(d); });
    return () => { dead = true; };
  }, [track]);

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
  /** Drag-to-gain (the phone rows). Engages the bus on first touch. */
  const setStemGain = (s: StemName, g: number) => {
    stemMixStore.setGain(s, g);
    if (!stemMixStore.snapshot().active) stemBus.engage();
  };
  const applyPreset = (p: StemPreset) => {
    stemMixStore.setGains(presetGains(p, mix.available));
    stemMixStore.setSolo(null);
    stemBus.engage();
  };
  const fullMix = () => stemBus.disengage();

  // Which preset (if any) the current gains spell out — for highlighting.
  const activePreset = mix.active
    ? presets.find((p) => {
        const g = presetGains(p, mix.available);
        return mix.available.every((s) => (mix.gains[s] ?? 1) === g[s]);
      })?.id ?? null
    : null;
  const isFullMix = !mix.active;

  return { mix, presets, stems, stemData, soloed, gainOf, toggleMute, toggleSolo, setStemGain, applyPreset, fullMix, activePreset, isFullMix };
}

type MixerBrain = ReturnType<typeof useMixerBrain>;

/** Live per-stem levels — the MEASURED envelope × the audible gain. */
function useStemLevels(stems: StemName[], data: StemData | null, getTime: () => number) {
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
  return levels;
}

const statusLine = (status: string) =>
  status === "loading" ? "separating the song… (loading stems)"
    : status === "error" ? "stems unreachable — the full mix plays on"
    : "the real separated instruments. the mix is yours.";

// ── CHANNEL STRIPS (desktop) — the band as an instrument row: a live meter
// per stem, mute and SOLO under each, ◉ X-RAY badge when a solo has the
// backdrop surfacing that instrument's anatomy. ──
function ChannelStrips({ brain, getTime }: { brain: MixerBrain; getTime: () => number }) {
  const { mix, stems, stemData, soloed, gainOf, toggleMute, toggleSolo } = brain;
  const levels = useStemLevels(stems, stemData, getTime);

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
                className="grid min-h-[20px] min-w-[20px] place-items-center rounded border font-mono text-[9px]"
                style={muted ? { borderColor: "var(--inst-signal)", color: "var(--inst-signal)" } : { borderColor: "var(--inst-line)", color: "var(--inst-faint)" }}
              >M</button>
              <button
                onClick={() => toggleSolo(s)}
                aria-label={`Solo ${STEM_INFO[s].label} — the X-Ray`}
                className="grid min-h-[20px] min-w-[20px] place-items-center rounded border font-mono text-[9px]"
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

// ── STEM SHEET (phones) — full-width horizontal strips inside a BottomSheet.
// The meter fill IS the fader: drag anywhere on the row to set gain 0..1. ──
function SheetStrips({ brain, getTime }: { brain: MixerBrain; getTime: () => number }) {
  const { mix, stems, stemData, soloed, gainOf, toggleMute, toggleSolo, setStemGain } = brain;
  const levels = useStemLevels(stems, stemData, getTime);

  // Drag-to-gain — pointer capture on the row, writes rAF-throttled.
  const dragGain = (e: React.PointerEvent<HTMLDivElement>, s: StemName) => {
    const el = e.currentTarget;
    try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    const rect = el.getBoundingClientRect();
    const id = e.pointerId;
    let raf = 0;
    let x = e.clientX;
    const put = () => { raf = 0; setStemGain(s, Math.max(0, Math.min(1, (x - rect.left) / rect.width))); };
    put();
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      x = ev.clientX;
      if (!raf) raf = requestAnimationFrame(put);
    };
    const done = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", done);
      window.removeEventListener("pointercancel", done);
      if (raf) cancelAnimationFrame(raf);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done);
    window.addEventListener("pointercancel", done);
  };

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {stems.map((s) => {
        const muted = mix.active && gainOf(s) === 0 && soloed !== s;
        const isSolo = soloed === s;
        const gain = gainOf(s);
        return (
          <div key={s} className="flex items-center gap-1.5" style={{ opacity: muted ? 0.45 : 1 }}>
            {/* the fader-meter — drag anywhere to set gain */}
            <div
              onPointerDown={(e) => dragGain(e, s)}
              className="relative h-11 min-w-0 flex-1 touch-none select-none overflow-hidden rounded-lg border"
              style={{
                borderColor: isSolo ? "var(--inst-plasma)" : "var(--inst-line)",
                background: "var(--inst-s2)",
                boxShadow: isSolo ? "0 0 12px color-mix(in srgb, var(--inst-plasma) 35%, transparent)" : "none",
              }}
              role="slider"
              aria-label={`${STEM_INFO[s].label} gain`}
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={Math.round(gain * 100) / 100}
            >
              {/* live fill — envelope × gain, from the shared meter polling */}
              <div
                className="absolute inset-y-0 left-0"
                style={{ width: `${Math.round((levels[s] ?? 0) * 100)}%`, background: "linear-gradient(90deg, color-mix(in srgb, var(--inst-plasma) 30%, transparent), var(--inst-plasma))" }}
              />
              {/* gain tick — where the fader actually sits */}
              <div
                className="absolute inset-y-1 w-px"
                style={{ left: `${Math.round(gain * 100)}%`, background: "color-mix(in srgb, var(--inst-plasma) 70%, white)", opacity: mix.active ? 0.9 : 0.25 }}
              />
              <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center gap-2">
                <span className="text-sm leading-none" aria-hidden>{STEM_INFO[s].icon}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--inst-dim)]">{STEM_INFO[s].label}</span>
                {isSolo && <span className="font-mono text-[8px] tracking-[0.2em]" style={{ color: "var(--inst-plasma)" }}>◉ X-RAY</span>}
              </div>
            </div>
            <button
              onClick={() => toggleMute(s)}
              aria-label={`Mute ${STEM_INFO[s].label}`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border font-mono text-[11px]"
              style={muted ? { borderColor: "var(--inst-signal)", color: "var(--inst-signal)" } : { borderColor: "var(--inst-line)", color: "var(--inst-faint)" }}
            >M</button>
            <button
              onClick={() => toggleSolo(s)}
              aria-label={`Solo ${STEM_INFO[s].label} — the X-Ray`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border font-mono text-[11px]"
              style={isSolo ? { borderColor: "var(--inst-plasma)", color: "var(--inst-plasma)" } : { borderColor: "var(--inst-line)", color: "var(--inst-faint)" }}
            >S</button>
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
  const phone = useIsPhone();
  const brain = useMixerBrain(track);
  const { mix, presets, applyPreset, fullMix, activePreset, isFullMix } = brain;

  // ── PHONE — the Stem Sheet: BottomSheet at half snap; dragging it down
  // to peek closes the mixer (open state stays owned by CinematicLyrics). ──
  if (phone) {
    return (
      <BottomSheet
        defaultSnap="half"
        onSnap={(s) => { if (s === "peek") onClose(); }}
        className="!z-[70]"
        peek={
          <div className="flex items-center justify-between px-4">
            <span className="flex items-baseline gap-2">
              <h3 className="font-display text-sm font-black uppercase tracking-wide" style={{ color: "var(--theme-primary)" }}>🎚 Stems</h3>
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/35">{statusLine(mix.status)}</span>
            </span>
            <button onClick={onClose} aria-label="Close the mixer" className="grid h-11 w-11 place-items-center font-mono text-xs text-white/50 active:text-white">✕</button>
          </div>
        }
      >
        {/* presets — a thumb-scroll row of hairline chips */}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 pt-1 [scrollbar-width:none]">
          <button
            onClick={fullMix}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-wider transition ${isFullMix ? "border-white/40 text-white" : "border-white/12 text-white/60"}`}
          >
            ◐ Full mix
          </button>
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-wider transition ${activePreset === p.id ? "border-[var(--theme-primary)] text-white" : "border-white/12 text-white/70"}`}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>

        {/* the band — drag a row to ride its fader */}
        <p className="mt-2 px-1 font-mono text-[9px] uppercase tracking-widest text-white/25">the band · drag a row = gain · M mutes · S solos (x-ray)</p>
        <SheetStrips brain={brain} getTime={getTime} />

        {/* THE LENS */}
        <button
          onClick={onToggleLens}
          className={`mb-2 mt-3 w-full rounded-lg border px-3 py-2.5 text-left font-mono text-[11px] transition ${lensArmed ? "border-[var(--theme-primary)] text-white" : "border-white/12 text-white/70"}`}
          style={lensArmed ? { background: "color-mix(in srgb, var(--theme-primary) 16%, transparent)" } : undefined}
        >
          🔍 The Lens <span className="text-white/35">— {lensArmed ? "armed · hold the stage to x-ray" : "hold the stage, hear one layer"}</span>
        </button>
      </BottomSheet>
    );
  }

  // ── DESKTOP — the floating card (unchanged look) ──
  return (
    <m.div
      className="absolute right-3 top-16 z-[70] w-[21rem] rounded-2xl border border-[var(--inst-line)] bg-[color-mix(in_srgb,var(--inst-s1)_95%,transparent)] p-3 backdrop-blur-md"
      initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-black uppercase tracking-wide" style={{ color: "var(--theme-primary)" }}>🎚 Stems</h3>
        <button onClick={onClose} className="font-mono text-xs text-white/50 hover:text-white">✕</button>
      </div>
      <p className="mt-0.5 font-mono text-[10px] leading-snug text-white/40">{statusLine(mix.status)}</p>

      <div className="mt-2 grid grid-cols-1 gap-1.5">
        <button onClick={fullMix}
          className={`rounded-lg border px-3 py-2 text-left font-mono text-[11px] transition ${isFullMix ? "border-white/40 text-white" : "border-white/12 text-white/60 hover:text-white"}`}>
          ◐ Full mix <span className="text-white/30">— the mastered song</span>
        </button>
        {presets.map((p) => (
          <button key={p.id}
            onClick={() => applyPreset(p)}
            className={`rounded-lg border px-3 py-2 text-left font-mono text-[11px] transition ${activePreset === p.id ? "border-[var(--theme-primary)] text-white" : "border-white/12 text-white/70 hover:text-white"}`}
            style={activePreset === p.id ? { background: "color-mix(in srgb, var(--theme-primary) 16%, transparent)" } : undefined}>
            {p.icon} {p.label} <span className="text-white/35">— {p.blurb}</span>
          </button>
        ))}
      </div>

      {/* THE BAND — channel strips: live measured meters, mute/solo per stem.
          Solo = the X-Ray: the backdrop surfaces that instrument's anatomy. */}
      <p className="mt-3 px-1 font-mono text-[9px] uppercase tracking-widest text-white/25">the band · live meters · M mutes · S solos (x-ray)</p>
      <ChannelStrips brain={brain} getTime={getTime} />

      {/* THE LENS — hold anywhere on the stage to hear only what lives there. */}
      <button onClick={onToggleLens}
        className={`mt-3 w-full rounded-lg border px-3 py-2 text-left font-mono text-[11px] transition ${lensArmed ? "border-[var(--theme-primary)] text-white" : "border-white/12 text-white/70 hover:text-white"}`}
        style={lensArmed ? { background: "color-mix(in srgb, var(--theme-primary) 16%, transparent)", boxShadow: "0 0 14px color-mix(in srgb, var(--theme-primary) 40%, transparent)" } : undefined}>
        🔍 The Lens <span className="text-white/35">— {lensArmed ? "armed · hold the stage to x-ray" : "hold the stage, hear one layer"}</span>
      </button>
    </m.div>
  );
}
