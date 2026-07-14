"use client";

// SHOW DOCK — the cinematic takeover's thumb bar. On phones the instrument
// bar's phase/mode segmented control and the STEMS/REACTOR chips are hidden;
// this bottom-center pill carries them instead, floating just above the
// safe area: transport | phase (+ mode when unlocked) | 🎚 stems | ⚛ reactor.
// Solid surface + hairline border per the mobile chrome law; 52px targets.

import type { StageMode } from "../KineticStage";

/** Compact mono tags for the viewing style — dock real estate is scarce. */
const MODE_TAG: Record<StageMode, string> = {
  dynamic: "DYN",
  "focus+": "FO+",
  focus: "FOC",
  phrase: "PHR",
};

export function ShowDock({
  performs,
  pass,
  setPass,
  maxPass,
  mode,
  cycleMode,
  mixerOpen,
  setMixerOpen,
  reactorOpen,
  setReactorOpen,
  hasStems,
  isPlaying,
  togglePlay,
  next,
  prev,
}: {
  performs: boolean;
  pass: number;
  setPass: (fn: (p: number) => number) => void;
  maxPass: number;
  mode: StageMode;
  cycleMode: () => void;
  mixerOpen: boolean;
  setMixerOpen: (fn: (v: boolean) => boolean) => void;
  reactorOpen: boolean;
  setReactorOpen: (fn: (v: boolean) => boolean) => void;
  hasStems: boolean;
  isPlaying: boolean;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
}) {
  return (
    <div
      className="absolute left-1/2 z-[60] flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-[var(--inst-line)] px-1.5 py-1 md:hidden"
      style={{ bottom: "calc(var(--safe-b) + 12px)", background: "#0b0812" }}
    >
      {/* Transport */}
      <button
        onClick={prev}
        aria-label="Previous song"
        className="grid h-[52px] min-w-[44px] place-items-center rounded-full text-white/70 transition active:text-white"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
      </button>
      <button
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="grid h-[52px] w-[52px] place-items-center rounded-full"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: "var(--theme-primary)" }}>
          {isPlaying
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="#05030b"><path d="M8 5v14l11-7z" /></svg>}
        </span>
      </button>
      <button
        onClick={next}
        aria-label="Next song"
        className="grid h-[52px] min-w-[44px] place-items-center rounded-full text-white/70 transition active:text-white"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" /></svg>
      </button>

      {performs && (
        <>
          <span aria-hidden className="mx-0.5 h-6 w-px bg-[var(--inst-line)]" />
          {/* Viewing style — unlocked from phase 3, like the top bar */}
          {pass >= 3 && (
            <button
              onClick={cycleMode}
              aria-label="Viewing style — tap to cycle"
              className="grid h-[52px] min-w-[44px] place-items-center rounded-full px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--inst-dim)] transition active:text-white"
            >
              {MODE_TAG[mode]}
            </button>
          )}
          {/* Phase — tap cycles the pass, same walk as the top bar's control */}
          <button
            onClick={() => setPass((p) => (p > 1 ? p - 1 : maxPass))}
            aria-label="Phase — tap to switch the show's look"
            className="grid h-[52px] min-w-[48px] place-items-center rounded-full px-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white"
          >
            {pass >= 6 ? "⚡D+" : `P·${pass}`}
          </button>
          {/* THE STEMS — the live mixer */}
          {hasStems && (
            <button
              onClick={() => setMixerOpen((v) => !v)}
              aria-label="Stems — the live instrument mixer"
              className="grid h-[52px] min-w-[48px] place-items-center rounded-full text-base leading-none transition"
              style={mixerOpen ? { color: "var(--inst-plasma)", textShadow: "0 0 12px var(--inst-plasma)" } : { color: "var(--inst-dim)" }}
            >
              🎚
            </button>
          )}
          {/* THE REACTOR — experimental modes */}
          <button
            onClick={() => setReactorOpen((v) => !v)}
            aria-label="The Reactor — experimental modes"
            className="grid h-[52px] min-w-[48px] place-items-center rounded-full text-base leading-none transition"
            style={reactorOpen ? { color: "var(--inst-signal)", textShadow: "0 0 12px var(--inst-signal)" } : { color: "var(--inst-dim)" }}
          >
            ⚛
          </button>
        </>
      )}
    </div>
  );
}
