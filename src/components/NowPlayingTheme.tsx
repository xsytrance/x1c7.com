"use client";

import { useEffect, useRef } from "react";
import { useMusicPlayer } from "./MusicPlayerContext";
import { resolveTheme, DEFAULT_THEME, type Theme } from "@/lib/theme";
import { extractPalette } from "@/lib/palette";
import { beatClock } from "@/lib/beatClock";
import { themeStore } from "@/lib/themeStore";

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

  // Latest values for the always-on beat loop (avoids re-subscribing per frame).
  const analyserRef = useRef<AnalyserNode | null>(null);
  const playingRef = useRef(false);
  const intensityRef = useRef(DEFAULT_THEME.intensity);
  useEffect(() => {
    analyserRef.current = analyser;
    playingRef.current = isPlaying;
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

  // Always-on beat loop: real bass energy when the analyser is live + playing,
  // a gentle synthetic pulse when playing without an analyser, and a decay to 0
  // when paused. Writes both the CSS var (for CSS pulses) and the store (canvas).
  useEffect(() => {
    let raf = 0;
    let beat = 0;
    let freq: Uint8Array<ArrayBuffer> | null = null;
    let energyAvg = 0;
    let lastOnset = 0;
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
      root.style.setProperty("--beat", beat.toFixed(3));
      themeStore.setBeat(beat);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return null;
}
