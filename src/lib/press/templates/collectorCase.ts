// Template #1 — the AGENOR collector game-case, wrapped NOT rewritten.
// Pixels come from the untouched legacy engine (src/lib/collector/webEngine);
// this descriptor only teaches the Plant's UI how to talk about it. Its
// space is the legacy 2048px square, not mm — hence legacy: true.

import type { ProjectSpec, TemplateDescriptor } from "../types";
import type { CaseSpec } from "@/lib/collector/webEngine";

export const COLLECTOR_CASE: TemplateDescriptor = {
  id: "collector",
  name: "Game Case",
  era: "2001",
  blurb: "The collector's edition case — spine, seal, braille, the works.",
  surfaces: [
    {
      id: "case",
      name: "The case",
      // Legacy space: 2048px ≈ a 12cm case face at ~433dpi. Nominal only —
      // exports stay exactly 2048² through the legacy engine.
      size: { w: 120, h: 120 },
      bleed: 0,
      safe: 3,
      layers: [], // legacy renderer owns the whole stack
    },
  ],
  shell: null, // the slab shell arrives with THE BOOTH (P6)
  legacy: true,
};

/** ProjectSpec → the legacy engine's CaseSpec. */
export function caseSpecFrom(p: ProjectSpec): CaseSpec {
  return {
    title: p.identity.title || "UNTITLED",
    genre: p.identity.genre ?? null,
    palette: p.identity.paletteKey ?? null,
    spine: p.identity.spineWord ?? null,
    label: p.identity.label || "YOUR LABEL",
    handle: p.identity.handle ?? null,
    monogram: p.identity.monogram ?? null,
    lang: p.identity.lang ?? null,
    geo: p.identity.geo ?? null,
    series: p.identity.series ?? null,
    bpm: p.facts.bpm ?? null,
    runtime: p.facts.runtime ?? null,
    peaks: p.facts.peaks ?? null,
    explicit: !!p.identity.explicit,
    unreleased: !!p.identity.unreleased,
    artTopCrop: p.art.slots.cover?.topCrop,
  };
}
