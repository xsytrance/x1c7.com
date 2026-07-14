// ═══════════════════════════════════════════════════════════════════════════
// BEAT TARGET — where the per-frame `--beat` CSS variable lands.
//
// Desktop: documentElement (cheap enough, and site-wide chrome may breathe).
// Perf-lite: a `:root` custom-property write forces a TREE-WIDE style recalc
// sixty times a second — but every CSS consumer of --beat (.kinetic-stage,
// .kinetic-word/halo, .cine-line) lives inside the stage subtree. So the
// stage registers itself here, NowPlayingTheme writes to it instead, and the
// recalc scope shrinks to the show. No stage mounted (just browsing) → no
// write at all.
// ═══════════════════════════════════════════════════════════════════════════

let el: HTMLElement | null = null;

export const beatTarget = {
  set(e: HTMLElement) { el = e; },
  clear(e: HTMLElement) { if (el === e) el = null; },
  get(): HTMLElement | null { return el; },
};
