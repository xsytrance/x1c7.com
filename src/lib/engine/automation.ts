// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATION — record live knob rides against the beat grid, loop them per
// bar/phrase. The third modulator: LFOs oscillate, stem-follows listen,
// automation REMEMBERS. Playback rides the registry's 'auto' modulation
// channel, so — like the others — it stacks on top of the base value and
// releases cleanly when stopped.
//
// Workflow (PRISM's automation.js, ported): arm Record → the take starts on
// the next bar of the MEASURED grid (immediately when no grid) → ride any
// sliders → when the loop length elapses, recording stops and playback loops
// automatically. A fresh arm is a fresh take. On a stems planet the loop is
// phase-locked to the real bars, forever, no drift.
// ═══════════════════════════════════════════════════════════════════════════

import { P } from "./params";
import type { EngineFeatures } from "./features";

const LENGTHS: Record<string, number> = { "1 BAR": 4, "2 BARS": 8, "4 BARS": 16, "8 BARS": 32 };

export type AutomationState = "idle" | "waiting" | "recording";

export class Automation {
  /** param id -> [{b, v}] sorted by beat offset into the loop */
  private tracks = new Map<string, { b: number; v: number }[]>();
  state: AutomationState = "idle";
  private b0 = 0;
  private len = 16;
  private curBeats = 0;
  private released = true;

  constructor() {
    P.register({ id: "auto.length", label: "Loop Length", group: "AUTOMATION", type: "select", options: Object.keys(LENGTHS), value: "4 BARS" });
    P.register({ id: "auto.record", label: "Record (arm)", group: "AUTOMATION", type: "bool", value: false });
    P.register({ id: "auto.play", label: "Play", group: "AUTOMATION", type: "bool", value: false });

    P.onChange((id, v, src) => {
      if (this.state !== "recording") return;
      if (src !== "ui" && src !== "midi" && src !== "osc") return;
      const def = P.def(id);
      if (!def || def.type !== "float" || id.startsWith("auto.")) return;
      const b = this.curBeats - this.b0;
      if (b < 0 || b > this.len) return;
      let tr = this.tracks.get(id);
      if (!tr) { tr = []; this.tracks.set(id, tr); }
      tr.push({ b, v: v as number });
    });
  }

  clear() {
    this.releaseMods();
    this.tracks.clear();
    P.set("auto.play", false, "code");
    P.set("auto.record", false, "code");
    this.state = "idle";
  }

  private releaseMods() {
    for (const id of this.tracks.keys()) P.setMod(id, 0, "auto");
    this.released = true;
  }

  hasTracks() { return this.tracks.size > 0; }
  laneCount() { return this.tracks.size; }

  update(F: EngineFeatures) {
    const beats = F.totalBeats;
    this.curBeats = beats;
    const armed = P.getBool("auto.record");

    if (armed && this.state === "idle") {
      this.len = LENGTHS[P.getStr("auto.length")] || 16;
      this.b0 = F.gridLocked ? Math.ceil(beats / 4) * 4 : beats; // the take starts on the next bar
      this.state = "waiting";
      this.tracks.clear(); // fresh take
      this.releaseMods();
      P.set("auto.play", false, "code");
    }
    if (!armed && (this.state === "recording" || this.state === "waiting")) {
      this.state = "idle"; // disarmed mid-take: keep whatever was captured
      if (this.tracks.size) P.set("auto.play", true, "code");
    }
    if (this.state === "waiting" && beats >= this.b0) this.state = "recording";
    if (this.state === "recording" && beats >= this.b0 + this.len) {
      this.state = "idle";
      P.set("auto.record", false, "code");
      if (this.tracks.size) P.set("auto.play", true, "code");
    }

    // ── looped playback through the 'auto' mod channel ──
    if (P.getBool("auto.play") && this.tracks.size && this.state !== "recording") {
      const pos = ((beats - this.b0) % this.len + this.len) % this.len;
      for (const [id, tr] of this.tracks) {
        P.setMod(id, this.valueAt(tr, pos) - (P.getBase(id) as number), "auto");
      }
      this.released = false;
    } else if (!this.released) {
      this.releaseMods();
    }
  }

  // linear interpolation between recorded points, wrapping across the loop seam
  private valueAt(tr: { b: number; v: number }[], pos: number): number {
    if (tr.length === 1) return tr[0].v;
    const first = tr[0], last = tr[tr.length - 1];
    if (pos <= first.b || pos >= last.b) {
      const span = this.len - last.b + first.b;
      const along = pos >= last.b ? pos - last.b : pos + this.len - last.b;
      return span > 0.0001 ? last.v + (first.v - last.v) * (along / span) : last.v;
    }
    let lo = 0, hi = tr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tr[mid].b <= pos) lo = mid; else hi = mid;
    }
    const a = tr[lo], b = tr[hi];
    const t = b.b - a.b > 0.0001 ? (pos - a.b) / (b.b - a.b) : 0;
    return a.v + (b.v - a.v) * t;
  }
}

let inst: Automation | null = null;
/** The one Automation — created on first use, after params exist. */
export function ensureAutomation(): Automation {
  return (inst ??= new Automation());
}
