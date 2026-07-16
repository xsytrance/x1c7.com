"use client";

import { useEffect, useRef } from "react";
import { useMusicPlayer } from "./MusicPlayerContext";
import { resolveTheme, DEFAULT_THEME, type Theme } from "@/lib/theme";
import { extractPalette } from "@/lib/palette";
import { beatClock } from "@/lib/beatClock";
import { themeStore } from "@/lib/themeStore";
import { beatTarget } from "@/lib/beatTarget";

// Writes the resolved theme onto :root as CSS custom properties. The color vars
// are registered via @property (globals.css) so changing them animates.
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", theme.primary);
  root.style.setProperty("--theme-secondary", theme.secondary);
  root.style.setProperty("--theme-accent", theme.accent);
  root.style.setProperty("--theme-bg", theme.bg);
  root.style.setProperty("--theme-intensity", String(theme.intensity));
  themeStore.setTheme(theme);
}

/**
 * Drives the whole-site "morph": when a track plays, the palette shifts to its
 * vibe (manual override > auto-extracted from cover > derived from track color),
 * and a global --beat pulses off the live analyser. Renders nothing.
 */
export function ThemeEngine() {
  const { currentTrack, isPlaying, analyser } = useMusicPlayer();

  // Latest values for the beat loop (avoids re-subscribing per frame).
  const analyserRef = useRef<AnalyserNode | null>(null);
  const playingRef = useRef(false);
  const intensityRef = useRef(DEFAULT_THEME.intensity);
  const startLoopRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    analyserRef.current = analyser;
    playingRef.current = isPlaying;
    if (isPlaying) startLoopRef.current?.();
  }, [analyser, isPlaying]);

  // Resolve + apply the palette whenever the track changes. Palette extraction
  // is async and best-effort (needs CORS on the art bucket); we apply the
  // derived/override theme immediately, then upgrade once extraction resolves.
  useEffect(() => {
    if (!currentTrack) {
      applyTheme(DEFAULT_THEME);
      intensityRef.current = DEFAULT_THEME.intensity;
      return;
    }
    const { color, cover, theme: override } = currentTrack;
    const base = resolveTheme(color, null, override);
    intensityRef.current = base.intensity;
    applyTheme(base);

    let cancelled = false;
    if (cover) {
      extractPalette(cover).then((extracted) => {
        if (cancelled || !extracted) return;
        const upgraded = resolveTheme(color, extracted, override);
        intensityRef.current = upgraded.intensity;
        applyTheme(upgraded);
      });
    }
    return () => { cancelled = true; };
  }, [currentTrack]);

  // Beat loop: real bass energy when the analyser is live + playing, a gentle
  // synthetic pulse when playing without an analyser, and a decay to 0 when
  // paused. Writes both the CSS var (for CSS pulses) and the store (canvas).
  // Parks itself once the pulse has decayed with nothing playing — a 60fps rAF
  // on every route is a real battery cost on phones — and restarts on play.
  useEffect(() => {
    let raf = 0;
    let running = false;
    let beat = 0;
    let freq: Uint8Array<ArrayBuffer> | null = null;
    let energyAvg = 0;
    let lastOnset = 0;
    let lastBeatStr = ""; // dedup the per-frame --beat write
    const root = document.documentElement;

    const tick = () => {
      const an = analyserRef.current;
      let target = 0;
      if (playingRef.current) {
        if (an) {
          if (!freq || freq.length !== an.frequencyBinCount) freq = new Uint8Array(an.frequencyBinCount);
          an.getByteFrequencyData(freq);
          let sum = 0;
          const n = Math.min(8, freq.length); // low bins ≈ bass
          for (let i = 0; i < n; i++) sum += freq[i];
          target = (sum / n / 255) * intensityRef.current;
          // Beat ONSET detection for the tap game: a bass spike well above
          // the running average, with a refractory window.
          const raw = sum / n / 255;
          energyAvg = energyAvg * 0.97 + raw * 0.03;
          const now = performance.now();
          if (raw > Math.max(0.22, energyAvg * 1.45) && now - lastOnset > 280) {
            lastOnset = now;
            beatClock.record(now);
          }
        } else {
          target = (0.35 + 0.25 * Math.sin(performance.now() / 240)) * intensityRef.current;
        }
      }
      // Asymmetric smoothing: snap up on hits, ease down for a natural pulse.
      beat += (target - beat) * (target > beat ? 0.5 : 0.08);
      // A :root write forces a tree-wide style recalc every frame. Every CSS
      // consumer of --beat lives in the stage subtree, so ALWAYS scope the
      // write to the stage when one is mounted (previously only done on lite —
      // desktop was paying a whole-document recalc 60×/s). themeStore.setBeat
      // always fires the full-precision value; JS consumers don't care about
      // scope. The CSS write is quantized to 0.02 (≤1px of word-glow blur) and
      // deduped so plateaus skip the recalc + drop-shadow re-raster entirely.
      const dest = beatTarget.get() || root;
      if (!playingRef.current && beat < 0.001) {
        beat = 0;
        if (lastBeatStr !== "0") { lastBeatStr = "0"; dest?.style.setProperty("--beat", "0"); }
        if (dest !== root) root.style.removeProperty("--beat"); // never strand a stale root value
        themeStore.setBeat(0);
        running = false;
        return;
      }
      const bq = (Math.round(beat / 0.02) * 0.02).toFixed(2);
      if (bq !== lastBeatStr) { lastBeatStr = bq; dest?.style.setProperty("--beat", bq); }
      themeStore.setBeat(beat);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    startLoopRef.current = start;
    start();
    return () => {
      startLoopRef.current = null;
      running = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
