// Splice Table — EASY mode auto-arranger (browser port of splice.mjs).
// Two songs in, a full flow out. Style song donates the skeleton
// (intro/verses/outro); guest brings the earworm hook; both always appear.

import type { Flow, FlowItem, Section, SectionKind, SongLegos } from "./types";

const ALIASES: Partial<Record<SectionKind, SectionKind[]>> = {
  chorus: ["chorus", "hook"],
  hook: ["hook", "chorus"],
};

function sectionsOfKind(song: SongLegos, kind: SectionKind): Section[] {
  const kinds = ALIASES[kind] || [kind];
  return song.sections.filter((s) => kinds.includes(s.kind));
}
function fullest(song: SongLegos, kind: SectionKind): Section | null {
  const c = sectionsOfKind(song, kind);
  return c.length ? c.slice().sort((a, b) => b.lines - a.lines)[0] : null;
}
function nth(song: SongLegos, kind: SectionKind, n: number): Section | null {
  return sectionsOfKind(song, kind)[n] || null;
}

export interface ArrangeStep extends FlowItem { why: string }

export function autoArrange(style: SongLegos, guest: SongLegos): ArrangeStep[] {
  const plan: ArrangeStep[] = [];
  const add = (sec: Section | null, as: SectionKind, why: string): boolean => {
    if (sec) { plan.push({ ref: sec.id, as, why }); return true; }
    return false;
  };

  add(fullest(style, "intro") || nth(style, "intro", 0), "intro", `intro from ${style.title} (skeleton)`);
  add(nth(style, "verse", 0), "verse", `verse 1 from ${style.title}`);
  add(fullest(style, "prechorus"), "prechorus", `pre-chorus from ${style.title} (lead-in)`);

  const hook = fullest(guest, "chorus");
  if (hook) add(hook, "chorus", `hook from ${guest.title} (guest earworm)`);
  else {
    add(fullest(style, "chorus"), "chorus", `chorus from ${style.title} (guest had none)`);
    add(fullest(guest, "verse"), "verse", `featured verse from ${guest.title} (no hook to borrow)`);
  }

  const gotV2 = add(nth(style, "verse", 1), "verse", `verse 2 from ${style.title}`);
  if (!gotV2) add(nth(guest, "verse", 1) || nth(guest, "verse", 0), "verse", `verse 2 borrowed from ${guest.title}`);

  const guestBridge = fullest(guest, "bridge");
  const bridge = guestBridge || fullest(style, "bridge");
  if (bridge) {
    const from = guestBridge ? guest : style;
    add(bridge, "bridge", `bridge from ${from.title} (variety)`);
  }

  if (hook) add(hook, "chorus", `hook reprise from ${guest.title}`);
  add(fullest(style, "outro") || nth(style, "outro", 0), "outro", `outro from ${style.title} (resolve)`);

  return plan;
}

// Build the full compilable flow from two songs, with EASY-mode defaults.
export function easyFlow(styleSong: SongLegos, guestSong: SongLegos): { flow: Flow; steps: ArrangeStep[] } {
  const steps = autoArrange(styleSong, guestSong);
  const flow: Flow = {
    title: null,
    style: { from: styleSong.id, overrides: {} },
    arrangement: steps.map(({ ref, as }) => ({ ref, as })),
    knobs: { weirdness: 25, styleStrength: 70, audioInfluence: 0, voice: "auto" },
    exclude: ["harsh autotune"],
  };
  return { flow, steps };
}
