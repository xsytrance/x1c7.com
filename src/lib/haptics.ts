// HAPTICS — tiny wrappers over navigator.vibrate (Android-only; iOS Safari
// simply ignores it). Guarded everywhere so SSR and desktop never throw.
// tick = a grid/detent click under the finger; fire = something happened.

const buzz = (ms: number) => {
  try {
    if (typeof navigator !== "undefined") navigator.vibrate?.(ms);
  } catch {
    /* vibration blocked (no user gesture yet, or iOS) — silence is fine */
  }
};

export const tick = (ms = 8) => buzz(ms);
export const fire = (ms = 14) => buzz(ms);
