// ═══════════════════════════════════════════════════════════════════════════
// THE PARAMETER REGISTRY — the engine's control surface.
//
// Every tunable value in the show registers here with an id, range, and group.
// From that one line it becomes: readable per-frame (with live modulation
// summed in), morphable, snapshot-able into looks/presets, and targetable by
// the LFO engine — without the code that owns it knowing any of that exists.
//
// Ported from PRISM's params.js (Charles's registry — the pattern that lets a
// platform grow a version a day), reshaped for Kinetica: TypeScript, no DOM,
// no app coupling. Plain module store like stemMix/beatClock: zero React.
//
// Two layers per float param:
//   base value  — what a preset stores, what a slider shows, what set() writes
//   modulation  — per-channel additive offsets (LFO, stem-follow, automation)
//                 summed at read time, clamped to range, NEVER serialized.
// ═══════════════════════════════════════════════════════════════════════════

export type ParamType = "float" | "bool" | "select" | "color" | "text";

export interface ParamDef {
  id: string;
  label: string;
  group: string;
  type: ParamType;
  min: number;
  max: number;
  step: number;
  value: number | boolean | string;
  default: number | boolean | string;
  options?: string[];
  locked: boolean;
}

export type ParamValue = number | boolean | string;
type Listener = (id: string, value: ParamValue, source: string, prev: ParamValue) => void;

const params = new Map<string, ParamDef>();
const listeners = new Set<Listener>();
const morphs = new Map<string, { from: number; to: number; t0: number; dur: number }>();
const mods = new Map<string, Map<string, number>>(); // id -> channel -> offset

export const P = {
  register(def: Partial<ParamDef> & { id: string; label: string; group: string; value: ParamValue }): ParamDef {
    const p: ParamDef = {
      type: "float", min: 0, max: 1, step: 0.001, locked: false,
      ...def,
      default: def.value,
    } as ParamDef;
    params.set(p.id, p);
    return p;
  },

  /** Effective value: base + summed modulation channels, clamped to range. */
  get(id: string): number {
    const p = params.get(id);
    if (!p) return 0;
    if (p.type === "float") {
      const m = mods.get(id);
      let v = p.value as number;
      if (m) for (const off of m.values()) v += off;
      return Math.min(p.max, Math.max(p.min, v));
    }
    return p.value as number;
  },
  getBool(id: string): boolean { const p = params.get(id); return !!p?.value; },
  getStr(id: string): string { const p = params.get(id); return p ? String(p.value) : ""; },
  getBase(id: string): ParamValue { const p = params.get(id); return p ? p.value : 0; },

  /** Additive modulation offset for one channel ('lfo', 'stem', 'auto', …).
   * Read-time only — never stored, never serialized. 0/falsy clears it. */
  setMod(id: string, offset: number, channel = "lfo") {
    let m = mods.get(id);
    if (!offset) {
      if (m) { m.delete(channel); if (!m.size) mods.delete(id); }
      return;
    }
    if (!m) { m = new Map(); mods.set(id, m); }
    m.set(channel, offset);
  },
  /** Total live modulation riding a param right now (for UI ribbons). */
  modOf(id: string): number {
    const m = mods.get(id);
    if (!m) return 0;
    let sum = 0;
    for (const off of m.values()) sum += off;
    return sum;
  },

  def(id: string) { return params.get(id); },
  all(): ParamDef[] { return [...params.values()]; },
  group(name: string): ParamDef[] { return [...params.values()].filter((p) => p.group === name); },

  set(id: string, value: ParamValue, source = "code") {
    const p = params.get(id);
    if (!p) return;
    if (p.type === "float") {
      value = Math.min(p.max, Math.max(p.min, +value));
      if (!isFinite(value)) return;
    }
    if (p.value === value) return;
    const prev = p.value;
    p.value = value;
    if (source !== "morph") morphs.delete(id); // a direct write cancels a running morph
    for (const fn of listeners) fn(id, value, source, prev);
  },

  onChange(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // ── Locks (runtime only — Randomize skips locked params) ──────────────────
  lock(id: string, v = true) { const p = params.get(id); if (p) p.locked = v; },
  isLocked(id: string): boolean { return !!params.get(id)?.locked; },
  setLocks(ids: string[]) {
    for (const p of params.values()) p.locked = false;
    for (const id of ids) { const p = params.get(id); if (p) p.locked = true; }
  },

  // ── Serialization: a look = every base value, restorable ──────────────────
  snapshot(): Record<string, ParamValue> {
    const out: Record<string, ParamValue> = {};
    for (const p of params.values()) out[p.id] = p.value;
    return out;
  },
  restore(values: Record<string, ParamValue>, source = "preset") {
    for (const [id, v] of Object.entries(values)) this.set(id, v, source);
  },

  // ── Morphing: glide float params to a target look over durSec ─────────────
  morphTo(values: Record<string, ParamValue>, durSec: number, now: number) {
    for (const [id, target] of Object.entries(values)) {
      const p = params.get(id);
      if (!p) continue;
      if (p.type === "float" && durSec > 0.02) {
        morphs.set(id, { from: p.value as number, to: +target, t0: now, dur: durSec });
      } else {
        this.set(id, target, "morph");
      }
    }
  },
  tickMorphs(now: number) {
    for (const [id, m] of morphs) {
      let t = (now - m.t0) / m.dur;
      if (t >= 1) { t = 1; morphs.delete(id); }
      const e = t * t * (3 - 2 * t); // smoothstep — lands musically, no snap
      this.set(id, m.from + (m.to - m.from) * e, "morph");
    }
  },
  isMorphing(): boolean { return morphs.size > 0; },

  /** Tests / song switches: return every param to its registered default. */
  resetAll() {
    morphs.clear();
    mods.clear();
    for (const p of params.values()) { p.value = p.default; p.locked = false; }
  },
};
