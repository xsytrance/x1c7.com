// Tiny shared UI flag so canvas loops (ParticleField, AudioVisualizer) can pause
// while the fullscreen cinematic lyrics view is taking over — this frees the
// mobile renderer (the heavy /music page is fully occluded + particles idle).

let cinematicActive = false;
const listeners = new Set<(active: boolean) => void>();

export const uiStore = {
  isCinematic: () => cinematicActive,
  setCinematic(active: boolean) {
    if (active === cinematicActive) return;
    cinematicActive = active;
    listeners.forEach((fn) => fn(active));
  },
  subscribe(fn: (active: boolean) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
