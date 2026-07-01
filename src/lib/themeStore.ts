// Tiny module-level store bridging the React theme engine to canvas consumers
// (ParticleField) that run their own rAF loops and shouldn't parse CSS vars per
// frame. ThemeEngine writes; consumers read the mutable object directly.

import { DEFAULT_THEME, type Theme } from "./theme";

interface ThemeSnapshot {
  theme: Theme;
  beat: number; // 0..1 smoothed bass energy
}

const state: ThemeSnapshot = {
  theme: { ...DEFAULT_THEME },
  beat: 0,
};

const listeners = new Set<(s: ThemeSnapshot) => void>();

export const themeStore = {
  get(): ThemeSnapshot {
    return state;
  },
  setTheme(theme: Theme) {
    state.theme = theme;
    listeners.forEach((fn) => fn(state));
  },
  setBeat(beat: number) {
    state.beat = beat;
  },
  subscribe(fn: (s: ThemeSnapshot) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
