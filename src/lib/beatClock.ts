// Beat clock — the live rhythm authority for the tap-to-the-beat game.
// NowPlayingTheme's analyser loop records bass-energy ONSETS here; consumers
// (KineticStage) score taps against the last beat / predicted next beat.
// Plain module store: zero React, zero re-renders.

const gaps: number[] = [];

export const beatClock = {
  /** performance.now() of the most recent detected beat (0 = none yet). */
  lastBeatAt: 0,
  /** Rolling median inter-beat interval in ms (fallback 500 = 120bpm). */
  interval: 500,
  /** True once enough beats have been seen to trust the clock. */
  ready: false,

  record(now: number) {
    if (this.lastBeatAt > 0) {
      const gap = now - this.lastBeatAt;
      // Only accept musically-plausible gaps (40–200 bpm).
      if (gap > 300 && gap < 1500) {
        gaps.push(gap);
        if (gaps.length > 12) gaps.shift();
        const sorted = [...gaps].sort((a, b) => a - b);
        this.interval = sorted[Math.floor(sorted.length / 2)];
        this.ready = gaps.length >= 4;
      }
    }
    this.lastBeatAt = now;
  },

  reset() {
    this.lastBeatAt = 0;
    this.interval = 500;
    this.ready = false;
    gaps.length = 0;
  },

  /** Distance (ms) from `now` to the nearest beat (last or predicted next). */
  offBy(now: number): number {
    if (!this.ready || !this.lastBeatAt) return Infinity;
    const since = now - this.lastBeatAt;
    const phase = since % this.interval;
    return Math.min(phase, this.interval - phase);
  },
};
