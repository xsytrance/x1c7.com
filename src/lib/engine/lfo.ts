// ═══════════════════════════════════════════════════════════════════════════
// MODULATORS — the machine's breathing.
//
// Two kinds, both writing additive offsets into the param registry's
// modulation layer (P.setMod), so the base value a preset stores is never
// disturbed underneath the wobble:
//
//   • LFOs — beat-synced oscillators (PRISM's lfo.js, ported): sine/triangle/
//     saw/square/S&H at musical rates from 1/4 beat to 4 bars, phase-locked to
//     featureBus.totalBeats. On a stems planet that grid is the REAL beat grid,
//     so a 1-BAR sine breathes exactly with the song's bars, forever, no drift.
//
//   • Stem follows — a measured instrument riding a param directly (drums →
//     grain, voice → glow, charge → vignette…). This is PRISM's roadmap item
//     "stem-aware LFO/FX routing" — trivially real here because the stems are.
//
// Configuration lives in the registry itself (lfoN.* / followN.* params), so
// presets can store modulation routings like any other look value.
// ═══════════════════════════════════════════════════════════════════════════

import { P } from "./params";
import type { EngineFeatures } from "./features";

export const LFO_COUNT = 3;
export const FOLLOW_COUNT = 3;
const SHAPES = ["SINE", "TRIANGLE", "SAW", "SQUARE", "RANDOM"] as const;
const RATES = ["4 BARS", "2 BARS", "1 BAR", "2 BEATS", "1 BEAT", "1/2", "1/4"] as const;
const RATE_BEATS: Record<string, number> = { "4 BARS": 16, "2 BARS": 8, "1 BAR": 4, "2 BEATS": 2, "1 BEAT": 1, "1/2": 0.5, "1/4": 0.25 };
export const FOLLOW_SOURCES = ["DRUMS", "BASS", "VOICE", "CHOIR", "BED", "LEVEL", "KICK", "CHARGE"] as const;

function shapeValue(shape: string, phase: number, cycle: number, slot: number): number {
  switch (shape) {
    case "SINE": return Math.sin(phase * Math.PI * 2);
    case "TRIANGLE": return 1 - 4 * Math.abs(phase - 0.5);
    case "SAW": return phase * 2 - 1;
    case "SQUARE": return phase < 0.5 ? 1 : -1;
    case "RANDOM": { // sample & hold, deterministic per cycle (replay-stable)
      const x = Math.sin(cycle * 127.1 + slot * 311.7) * 43758.5453;
      return (x - Math.floor(x)) * 2 - 1;
    }
    default: return 0;
  }
}

function followValue(F: EngineFeatures, src: string): number {
  switch (src) {
    case "DRUMS": return F.drums;
    case "BASS": return F.bass;
    case "VOICE": return F.voice;
    case "CHOIR": return F.choir;
    case "BED": return F.bed;
    case "LEVEL": return F.level;
    case "KICK": return F.kick;
    case "CHARGE": return F.charge;
    default: return 0;
  }
}

let inst: ModEngine | null = null;
/** The one ModEngine. Created on first use — AFTER the caller has imported
 * every module that registers targetable params (import order = target list). */
export function ensureModEngine(): ModEngine {
  return (inst ??= new ModEngine());
}

export class ModEngine {
  // Reused across frames — this runs every frame, so allocating fresh
  // Maps/Sets here was steady GC pressure even with nothing routed.
  private lastLfo = new Set<string>();
  private lastFollow = new Set<string>();
  private lfoSum = new Map<string, number>();
  private followSum = new Map<string, number>();

  /** Register lfoN.* / followN.* AFTER every target param exists, so the
   * target lists are complete (PRISM's ordering rule, same reason). */
  constructor() {
    const targets = ["NONE", ...P.all()
      .filter((p) => p.type === "float" && !p.id.startsWith("lfo") && !p.id.startsWith("follow"))
      .map((p) => p.id)];
    for (let i = 1; i <= LFO_COUNT; i++) {
      const g = `LFO ${i}`;
      P.register({ id: `lfo${i}.enabled`, label: "Enabled", group: g, type: "bool", value: false });
      P.register({ id: `lfo${i}.target`, label: "Target", group: g, type: "select", options: targets, value: "NONE" });
      P.register({ id: `lfo${i}.shape`, label: "Shape", group: g, type: "select", options: [...SHAPES], value: "SINE" });
      P.register({ id: `lfo${i}.rate`, label: "Rate", group: g, type: "select", options: [...RATES], value: "1 BAR" });
      P.register({ id: `lfo${i}.depth`, label: "Depth", group: g, min: 0, max: 1, value: 0.3 });
    }
    for (let i = 1; i <= FOLLOW_COUNT; i++) {
      const g = `FOLLOW ${i}`;
      P.register({ id: `follow${i}.enabled`, label: "Enabled", group: g, type: "bool", value: false });
      P.register({ id: `follow${i}.source`, label: "Source", group: g, type: "select", options: [...FOLLOW_SOURCES], value: "VOICE" });
      P.register({ id: `follow${i}.target`, label: "Target", group: g, type: "select", options: targets, value: "NONE" });
      P.register({ id: `follow${i}.depth`, label: "Depth", group: g, min: -1, max: 1, value: 0.5 });
    }
  }

  update(F: EngineFeatures) {
    // ── LFOs: summed per target so stacked LFOs compose ──
    const lfoSum = this.lfoSum; lfoSum.clear();
    for (let i = 1; i <= LFO_COUNT; i++) {
      if (!P.getBool(`lfo${i}.enabled`)) continue;
      const target = P.getStr(`lfo${i}.target`);
      if (target === "NONE") continue;
      const def = P.def(target);
      if (!def || def.type !== "float") continue;
      const periodBeats = RATE_BEATS[P.getStr(`lfo${i}.rate`)] || 4;
      const phase = ((F.totalBeats / periodBeats) % 1 + 1) % 1;
      const cycle = Math.floor(F.totalBeats / periodBeats);
      const v = shapeValue(P.getStr(`lfo${i}.shape`), phase, cycle, i);
      const offset = v * P.get(`lfo${i}.depth`) * (def.max - def.min) * 0.5;
      lfoSum.set(target, (lfoSum.get(target) || 0) + offset);
    }
    for (const [target, offset] of lfoSum) P.setMod(target, offset, "lfo");
    for (const t of this.lastLfo) if (!lfoSum.has(t)) P.setMod(t, 0, "lfo");
    this.lastLfo.clear();
    for (const k of lfoSum.keys()) this.lastLfo.add(k);

    // ── Stem follows: a real instrument's envelope rides the param ──
    const followSum = this.followSum; followSum.clear();
    for (let i = 1; i <= FOLLOW_COUNT; i++) {
      if (!P.getBool(`follow${i}.enabled`)) continue;
      const target = P.getStr(`follow${i}.target`);
      if (target === "NONE") continue;
      const def = P.def(target);
      if (!def || def.type !== "float") continue;
      const v = followValue(F, P.getStr(`follow${i}.source`));
      const offset = v * P.get(`follow${i}.depth`) * (def.max - def.min);
      followSum.set(target, (followSum.get(target) || 0) + offset);
    }
    for (const [target, offset] of followSum) P.setMod(target, offset, "stem");
    for (const t of this.lastFollow) if (!followSum.has(t)) P.setMod(t, 0, "stem");
    this.lastFollow.clear();
    for (const k of followSum.keys()) this.lastFollow.add(k);
  }
}
