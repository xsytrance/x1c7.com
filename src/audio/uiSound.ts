// ============================================================
// uiSound — tiny procedural UI sound effects (WebAudio)
// Subtle sci-fi blips for hover / click / nav. No assets.
// Audio only starts after a real user gesture (browser policy),
// so nothing ever plays unexpectedly on load.
// ============================================================

export type SfxType = "hover" | "click" | "nav" | "toggle" | "back";

const STORAGE_KEY = "x1c7-sfx";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;
let initialized = false;

function ensureCtx(): boolean {
  if (typeof window === "undefined") return false;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.16; // keep it subtle
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx.state === "running";
}

/** Read persisted preference. Defaults to ON unless the user muted or prefers reduced motion. */
export function initUiSound(): boolean {
  if (initialized) return enabled;
  initialized = true;
  if (typeof window === "undefined") return false;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  enabled = reduced ? false : saved !== "off";
  return enabled;
}

export function isSfxEnabled(): boolean {
  return enabled;
}

export function setSfxEnabled(value: boolean) {
  enabled = value;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
  }
  if (value) ensureCtx();
}

function blip(opts: {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);

  const peak = opts.gain ?? 0.6;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);

  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + opts.dur + 0.02);
  osc.onended = () => {
    try { osc.disconnect(); env.disconnect(); } catch { /* noop */ }
  };
}

export function playSfx(kind: SfxType) {
  if (!enabled) return;
  if (!ensureCtx()) return;
  switch (kind) {
    case "hover":
      blip({ freq: 1320, dur: 0.05, type: "sine", gain: 0.18 });
      break;
    case "click":
      blip({ freq: 880, to: 1480, dur: 0.07, type: "triangle", gain: 0.5 });
      blip({ freq: 2200, dur: 0.04, type: "sine", gain: 0.18, delay: 0.02 });
      break;
    case "nav":
      blip({ freq: 320, to: 760, dur: 0.16, type: "sawtooth", gain: 0.3 });
      blip({ freq: 1400, dur: 0.05, type: "sine", gain: 0.16, delay: 0.05 });
      break;
    case "back":
      blip({ freq: 760, to: 300, dur: 0.16, type: "sawtooth", gain: 0.3 });
      break;
    case "toggle":
      blip({ freq: 520, to: 1040, dur: 0.12, type: "square", gain: 0.28 });
      break;
  }
}
