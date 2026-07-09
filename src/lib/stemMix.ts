// The stem mix — one tiny observable store shared by three consumers that
// must never re-render each other: the StemEngine (applies gains to the Web
// Audio graph), the mixer/Lens UI (React, via useStemMix), and KineticStage's
// rAF loop (reads visualGain per frame so muted stems take their visuals with
// them). Pattern follows uiStore/themeStore: module state + subscribe, no
// framework coupling — this file syncs to Kinetica with the engine.

import { useSyncExternalStore } from "react";
import type { StemName } from "@/lib/stemSense";

export const STEM_ORDER: StemName[] = ["lead", "back", "drums", "perc", "bass", "synth", "guitar", "keys", "strings", "woodwinds", "brass", "other"];

export const STEM_INFO: Record<StemName, { label: string; icon: string }> = {
  lead: { label: "Voice", icon: "🎤" },
  back: { label: "Choir", icon: "👥" },
  drums: { label: "Drums", icon: "🥁" },
  perc: { label: "Percussion", icon: "🪘" },
  bass: { label: "Bass", icon: "🔊" },
  synth: { label: "Synth", icon: "🎛" },
  guitar: { label: "Guitar", icon: "🎸" },
  keys: { label: "Keys", icon: "🎹" },
  strings: { label: "Strings", icon: "🎻" },
  woodwinds: { label: "Winds", icon: "🎷" },
  brass: { label: "Brass", icon: "🎺" },
  other: { label: "Other", icon: "✨" },
};

export type StemMixStatus = "idle" | "loading" | "ready" | "error";

export interface StemMixState {
  /** Stems this track ships audio for (empty = no stem audio, mixer hidden). */
  available: StemName[];
  status: StemMixStatus;
  /** True while the stem bus is the audible source (mp3 faded out). */
  active: boolean;
  /** The user's mix, 0..1 per available stem. Survives a Lens solo. */
  gains: Partial<Record<StemName, number>>;
  /** Ephemeral solo overlay (the Lens): only these stems sound. */
  solo: StemName[] | null;
}

const fresh = (available: StemName[]): StemMixState => ({
  available,
  status: "idle",
  active: false,
  gains: Object.fromEntries(available.map((s) => [s, 1])),
  solo: null,
});

let state: StemMixState = fresh([]);
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const stemMixStore = {
  snapshot: (): StemMixState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** New track: declare which stems ship audio and reset the mix to full. */
  reset(available: StemName[]) {
    state = fresh(available);
    emit();
  },
  setStatus(status: StemMixStatus) {
    if (state.status === status) return;
    state = { ...state, status };
    emit();
  },
  setActive(active: boolean) {
    if (state.active === active) return;
    state = { ...state, active };
    emit();
  },
  setGain(stem: StemName, gain: number) {
    state = { ...state, gains: { ...state.gains, [stem]: Math.max(0, Math.min(1, gain)) } };
    emit();
  },
  setGains(gains: Partial<Record<StemName, number>>) {
    state = { ...state, gains: { ...state.gains, ...gains } };
    emit();
  },
  setSolo(solo: StemName[] | null) {
    state = { ...state, solo };
    emit();
  },

  /** What a stem should currently sound (and look) like, solo-aware. */
  effectiveGain(stem: StemName): number {
    if (state.solo) return state.solo.includes(stem) ? 1 : 0;
    return state.gains[stem] ?? 1;
  },
  /** Per-frame hook for the stage: 1 while the mix is inactive (mp3 playing —
   *  every instrument is present), else the effective gain, so stem-driven
   *  visuals honestly follow what the listener hears. */
  visualGain(stem: StemName): number {
    if (!state.active) return 1;
    return this.effectiveGain(stem);
  },
};

/** React view of the mix (mixer panel, Lens, chrome badges). */
export function useStemMix(): StemMixState {
  return useSyncExternalStore(stemMixStore.subscribe, stemMixStore.snapshot, stemMixStore.snapshot);
}

// ── Presets — the combinations with a soul. 9 stems = 511 combinations and
// almost all of them are noise; these are the handful worth naming. Each is
// offered only when the track ships the stems that give it meaning. ─────────

export interface StemPreset {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  /** Which of the available stems stay audible. */
  pick: (available: StemName[]) => StemName[];
  /** Offered only if at least one of these shipped… */
  needsAny?: StemName[];
  /** …and every one of these did. */
  needsAll?: StemName[];
}

const RHYTHM: StemName[] = ["drums", "perc", "bass"];
const BED: StemName[] = ["synth", "guitar", "keys", "strings", "woodwinds", "brass", "other"];

export const STEM_PRESETS: StemPreset[] = [
  {
    id: "acapella", label: "Acapella", icon: "🎤", blurb: "just the voices",
    pick: (a) => a.filter((s) => s === "lead" || s === "back"),
    needsAll: ["lead"],
  },
  {
    id: "karaoke", label: "Karaoke", icon: "🕳", blurb: "the song minus the singer",
    pick: (a) => a.filter((s) => s !== "lead"),
    needsAll: ["lead"], needsAny: [...RHYTHM, ...BED, "back"],
  },
  {
    id: "basement", label: "The Basement", icon: "🥁", blurb: "drums + bass, nothing else",
    pick: (a) => a.filter((s) => RHYTHM.includes(s)),
    needsAny: RHYTHM,
  },
  {
    id: "dream", label: "The Dream", icon: "🌫", blurb: "the bed + ghost voices",
    pick: (a) => a.filter((s) => BED.includes(s) || s === "back"),
    needsAny: BED,
  },
  {
    id: "skeleton", label: "Skeleton", icon: "💀", blurb: "voice over bare drums",
    pick: (a) => a.filter((s) => s === "lead" || s === "drums" || s === "perc"),
    needsAll: ["lead", "drums"],
  },
];

/** The presets this track can actually perform. */
export function presetsFor(available: StemName[]): StemPreset[] {
  return STEM_PRESETS.filter((p) => {
    if (p.needsAll && !p.needsAll.every((s) => available.includes(s))) return false;
    if (p.needsAny && !p.needsAny.some((s) => available.includes(s))) return false;
    // A preset that keeps everything (or nothing) audible isn't a mix.
    const kept = p.pick(available).length;
    return kept > 0 && kept < available.length;
  });
}

/** Gains a preset resolves to on this track (unpicked stems → 0). */
export function presetGains(p: StemPreset, available: StemName[]): Partial<Record<StemName, number>> {
  const keep = new Set(p.pick(available));
  return Object.fromEntries(available.map((s) => [s, keep.has(s) ? 1 : 0]));
}
