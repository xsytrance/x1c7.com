// ═══════════════════════════════════════════════════════════════════════════
// STEM ENGINE — plays the actual Suno stems, live-mixable.
//
// The release mp3 stays the master clock and the default sound (it's the
// mastered mix — stem-sum is close but less "glued"). Each stem is its own
// streaming <audio> element routed MediaElementSource → per-stem gain → one
// stem bus, which joins the player's existing graph at the muffle filter — so
// the visualizer's analyser and wipe-muffle hear whatever the listener hears.
//
// Engaging crossfades mp3 → stem bus; the mp3 keeps playing at zero gain so
// the clock, timeline, seek and "ended" behavior never change owners. Stems
// chase the master clock: hard-align on seek, micro-varispeed (±3%) to absorb
// drift. All times honor `lag` — analyze_stems.py's measured offset between
// Suno's stem zip and the release mp3 (stemTime = releaseTime − lag).
//
// The mix itself (gains / Lens solo) lives in stemMixStore; the engine
// subscribes and applies. UI writes the store; the engine writes the sound.
// ═══════════════════════════════════════════════════════════════════════════

import { stemMixStore, STEM_ORDER } from "@/lib/stemMix";
import type { StemName } from "@/lib/stemSense";

interface StemNode {
  name: StemName;
  el: HTMLAudioElement;
  gain: GainNode;
  ready: boolean;
  failed: boolean;
}

export interface StemEngineInit {
  ctx: AudioContext;
  /** Where the stem bus joins the player graph (the muffle filter input). */
  output: AudioNode;
  /** The release-mp3 crossfade gain (1 = mp3 audible, 0 = stems audible). */
  mixGain: GainNode;
  /** The release mp3 element — master clock + user-volume authority. */
  master: HTMLAudioElement;
  urls: Partial<Record<StemName, string>>;
  /** Seconds to ADD to stem time to land on the release clock (align.lag). */
  lag: number;
}

const DRIFT_HARD = 0.3;   // s — beyond this, hard re-seek
const DRIFT_SOFT = 0.03;  // s — beyond this, varispeed nudge
const FADE = 0.06;        // s — crossfade time constant (~200ms settle)
const GAIN_RAMP = 0.045;  // s — per-stem gain time constant

export class StemEngine {
  private ctx: AudioContext;
  private mixGain: GainNode;
  private master: HTMLAudioElement;
  private urls: Partial<Record<StemName, string>>;
  private lag: number;
  private bus: GainNode;
  private nodes: StemNode[] = [];
  private built = false;
  private engaged = false;
  private disposed = false;
  private driftTimer: ReturnType<typeof setInterval> | null = null;
  private parkTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: () => void;
  private detachMaster: () => void;

  constructor(init: StemEngineInit) {
    this.ctx = init.ctx;
    this.mixGain = init.mixGain;
    this.master = init.master;
    this.urls = init.urls;
    this.lag = init.lag;

    this.bus = this.ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(init.output);

    // The mix lives in the store; the engine renders it into the graph.
    this.unsubscribe = stemMixStore.subscribe(() => this.applyGains());

    // Mirror the master's transport so play/pause/seek/volume Just Work
    // without the player context knowing the stems exist.
    const onPlay = () => { if (this.engaged) { this.align(); this.playAll(); } };
    const onPause = () => this.pauseAll();
    const onSeek = () => { if (this.engaged) this.align(); };
    const onVolume = () => this.syncBusVolume();
    this.master.addEventListener("play", onPlay);
    this.master.addEventListener("pause", onPause);
    this.master.addEventListener("seeking", onSeek);
    this.master.addEventListener("seeked", onSeek);
    this.master.addEventListener("volumechange", onVolume);
    this.detachMaster = () => {
      this.master.removeEventListener("play", onPlay);
      this.master.removeEventListener("pause", onPause);
      this.master.removeEventListener("seeking", onSeek);
      this.master.removeEventListener("seeked", onSeek);
      this.master.removeEventListener("volumechange", onVolume);
    };
  }

  /** Crossfade to the stem bus (lazy-loads the stem audio on first call). */
  async engage(): Promise<void> {
    if (this.disposed || this.engaged) return;
    this.engaged = true;
    if (this.parkTimer) { clearTimeout(this.parkTimer); this.parkTimer = null; }
    stemMixStore.setStatus(this.built ? "ready" : "loading");
    this.ctx.resume().catch(() => {});

    if (!this.built) {
      this.built = true;
      this.build();
      await this.waitReady(8000);
      if (this.disposed || !this.engaged) return;
    }
    // Nothing playable (every stem 404'd / graph refused) → stay on the mp3.
    // Checked on EVERY engage so a retry can't crossfade into silence.
    if (this.nodes.length === 0 || this.nodes.every((n) => n.failed)) {
      this.engaged = false;
      stemMixStore.setStatus("error");
      return;
    }

    this.align();
    if (!this.master.paused) this.playAll();
    this.applyGains();
    this.syncBusVolume();
    const t = this.ctx.currentTime;
    this.mixGain.gain.cancelScheduledValues(t);
    this.mixGain.gain.setTargetAtTime(0.0001, t, FADE);
    this.startDriftLoop();
    stemMixStore.setStatus("ready");
    stemMixStore.setActive(true);
  }

  /** Crossfade back to the mastered mp3. The stems park (paused) after the fade. */
  disengage(): void {
    if (this.disposed || !this.engaged) return;
    this.engaged = false;
    const t = this.ctx.currentTime;
    this.mixGain.gain.cancelScheduledValues(t);
    this.mixGain.gain.setTargetAtTime(1, t, FADE);
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(0, t, FADE);
    this.stopDriftLoop();
    this.parkTimer = setTimeout(() => this.pauseAll(), 400);
    stemMixStore.setActive(false);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.engaged = false;
    this.unsubscribe();
    this.detachMaster();
    this.stopDriftLoop();
    if (this.parkTimer) clearTimeout(this.parkTimer);
    const t = this.ctx.currentTime;
    try { this.mixGain.gain.cancelScheduledValues(t); this.mixGain.gain.setTargetAtTime(1, t, FADE); } catch { /* noop */ }
    for (const n of this.nodes) {
      try { n.el.pause(); } catch { /* noop */ }
      n.el.removeAttribute("src");
      try { n.el.load(); } catch { /* noop */ }
      try { n.gain.disconnect(); } catch { /* noop */ }
    }
    try { this.bus.disconnect(); } catch { /* noop */ }
    this.nodes = [];
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private build(): void {
    for (const name of STEM_ORDER) {
      const url = this.urls[name];
      if (!url) continue;
      const el = new Audio();
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      // Varispeed drift-nudges should bend pitch (natural), not time-stretch.
      (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false;
      el.src = url;
      const gain = this.ctx.createGain();
      gain.gain.value = stemMixStore.effectiveGain(name);
      try {
        this.ctx.createMediaElementSource(el).connect(gain);
      } catch {
        continue; // element unusable in this graph — skip the stem
      }
      gain.connect(this.bus);
      this.nodes.push({ name, el, gain, ready: false, failed: false });
    }
  }

  private waitReady(timeoutMs: number): Promise<void> {
    const pending = this.nodes.filter((n) => !n.ready && !n.failed);
    return new Promise((resolve) => {
      let left = pending.length;
      if (!left) return resolve();
      const timer = setTimeout(() => {
        // Slow stems aren't fatal — they join the bus when they arrive.
        resolve();
      }, timeoutMs);
      const done = () => { if (--left <= 0) { clearTimeout(timer); resolve(); } };
      for (const n of pending) {
        const ok = () => { n.ready = true; cleanup(); done(); };
        const bad = () => { n.failed = true; cleanup(); done(); };
        const cleanup = () => {
          n.el.removeEventListener("canplay", ok);
          n.el.removeEventListener("error", bad);
        };
        if (n.el.readyState >= 3) { n.ready = true; done(); continue; }
        n.el.addEventListener("canplay", ok);
        n.el.addEventListener("error", bad);
      }
    });
  }

  /** Snap every stem to the master clock (stem time = release time − lag). */
  private align(): void {
    const t = Math.max(0, this.master.currentTime - this.lag);
    for (const n of this.nodes) {
      if (n.failed) continue;
      try { n.el.currentTime = t; n.el.playbackRate = 1; } catch { /* not seekable yet */ }
    }
  }

  private playAll(): void {
    for (const n of this.nodes) if (!n.failed) n.el.play().catch(() => {});
  }

  private pauseAll(): void {
    for (const n of this.nodes) { try { n.el.pause(); } catch { /* noop */ } }
  }

  private applyGains(): void {
    if (this.disposed) return;
    const t = this.ctx.currentTime;
    for (const n of this.nodes) {
      const v = stemMixStore.effectiveGain(n.name);
      n.gain.gain.cancelScheduledValues(t);
      n.gain.gain.setTargetAtTime(v, t, GAIN_RAMP);
    }
  }

  /** Stem bus level = crossfade(1) × the user's volume (mirrors mp3.volume). */
  private syncBusVolume(): void {
    if (!this.engaged) return;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setTargetAtTime(Math.max(0.0001, this.master.volume), t, FADE);
  }

  private startDriftLoop(): void {
    this.stopDriftLoop();
    this.driftTimer = setInterval(() => {
      if (!this.engaged || this.master.paused) return;
      const want = this.master.currentTime - this.lag;
      for (const n of this.nodes) {
        if (n.failed || n.el.readyState < 2) continue;
        if (n.el.paused) { n.el.currentTime = Math.max(0, want); n.el.play().catch(() => {}); continue; }
        const drift = want - n.el.currentTime;
        if (Math.abs(drift) > DRIFT_HARD) {
          n.el.currentTime = Math.max(0, want);
          n.el.playbackRate = 1;
        } else if (Math.abs(drift) > DRIFT_SOFT) {
          n.el.playbackRate = 1 + Math.max(-0.03, Math.min(0.03, drift * 0.5));
        } else {
          n.el.playbackRate = 1;
        }
      }
    }, 650);
  }

  private stopDriftLoop(): void {
    if (this.driftTimer) { clearInterval(this.driftTimer); this.driftTimer = null; }
  }
}
