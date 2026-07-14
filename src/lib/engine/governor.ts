// ═══════════════════════════════════════════════════════════════════════════
// FRAME GOVERNOR — performance as a closed loop, not a guess.
//
// Watches real rAF deltas and steps a render-scale multiplier down a ladder
// when sustained frame time says the device can't keep up — then climbs back
// when headroom returns. Applied INSIDE BackdropRenderer.render() as a
// multiplier on backdrop.renderScale, deliberately NOT via P.set: a look
// captured mid-thermal-throttle must never snapshot the throttle, and the
// studio slider keeps showing the user's intent.
//
// Hysteresis: degrade needs ~2s of p75 > 20ms; restore needs 8s of p75 < 12ms
// — it never oscillates on the boundary. At the ladder floor the renderer
// also skips the trails + ghost passes (feedback ping-pong is the fill-rate
// hog). Engine-pure: no app imports; safe for the Kinetica sync.
// ═══════════════════════════════════════════════════════════════════════════

const LADDER = [1, 0.8, 0.62, 0.5];
const DEGRADE_MS = 20;   // p75 above this = struggling
const RESTORE_MS = 12;   // p75 below this = headroom
const DEGRADE_HOLD = 2;  // seconds of struggle before stepping down
const RESTORE_HOLD = 8;  // seconds of headroom before stepping up

class FrameGovernor {
  private deltas: number[] = [];
  private last = 0;
  private step = 0;
  private badSince = 0;
  private goodSince = 0;
  /** Frames evaluated + steps taken — for PerfHUD / probes. */
  stats = { p75: 0, degrades: 0, restores: 0 };

  /** Current render-scale multiplier (1 = full user intent). */
  get scale(): number { return LADDER[this.step]; }
  /** At the ladder floor — renderer should also skip trails/ghost passes. */
  get floor(): boolean { return this.step === LADDER.length - 1; }

  /** Call once per rAF with performance.now(). */
  tick(now: number): void {
    if (this.last > 0) {
      const d = now - this.last;
      if (d < 250) this.deltas.push(d); // ignore tab-switch cliffs
    }
    this.last = now;
    if (this.deltas.length < 90) return;

    const sorted = [...this.deltas].sort((a, b) => a - b);
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    this.stats.p75 = Math.round(p75 * 10) / 10;
    this.deltas.length = 0;
    const t = now / 1000;

    if (p75 > DEGRADE_MS) {
      this.goodSince = 0;
      if (!this.badSince) this.badSince = t;
      else if (t - this.badSince >= DEGRADE_HOLD && this.step < LADDER.length - 1) {
        this.step++; this.badSince = 0; this.stats.degrades++;
      }
    } else if (p75 < RESTORE_MS) {
      this.badSince = 0;
      if (!this.goodSince) this.goodSince = t;
      else if (t - this.goodSince >= RESTORE_HOLD && this.step > 0) {
        this.step--; this.goodSince = 0; this.stats.restores++;
      }
    } else {
      this.badSince = 0; this.goodSince = 0;
    }
  }

  reset(): void { this.step = 0; this.deltas.length = 0; this.badSince = 0; this.goodSince = 0; this.last = 0; }
}

export const governor = new FrameGovernor();
