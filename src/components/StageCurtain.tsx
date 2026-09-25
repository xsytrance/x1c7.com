"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE CURTAIN — the stage closes and opens again.
//
// Built for "the doors swung open, light…", but deliberately NOT built for it:
// the whole point of a reusable moment is that the next song gets it for free.
// So nothing here knows about doors, or gold, or Hajimemashite. It takes a
// trigger and a config and it parts.
//
// The move is slam-then-part, not just part. Panels that are already closed
// have to get closed somehow, and fading them in throws away the best frame in
// the effect — two halves meeting. So: they sweep IN fast (the slam), hold
// shut for a beat, then open slowly. The hold is what sells it; without it the
// eye reads one continuous wipe and the doors never existed.
//
// It is also a free art swap. While the panels are shut the frame is covered,
// so a plate change underneath lands as a REVEAL instead of a crossfade — the
// one moment in the engine where the backdrop is allowed to hard-cut.
// ═══════════════════════════════════════════════════════════════════════════

import { AnimatePresence, motion as m } from "framer-motion";

export interface CurtainCfg {
  /** seconds the panels take to open — the slow half. Default 0.72 */
  dur?: number;
  /** seconds the panels take to slam shut. Default 0.14 */
  shut?: number;
  /** seconds held closed between the two. Default 0.10 */
  hold?: number;
  /** "sides" parts left/right, "updown" parts top/bottom. Default "sides" */
  axis?: "sides" | "updown";
  /** panel fill. Any CSS background — a gradient reads richer than a flat. */
  color?: string;
  /** the lit inner edge. Usually the song's own accent. */
  edge?: string;
  /** 0 = no gap at rest. Leaves the panels slightly parted when open. */
  reveal?: number;
}

export function StageCurtain({ fire, cfg }: { fire: number; cfg?: CurtainCfg }) {
  const dur = cfg?.dur ?? 0.72;
  const shut = cfg?.shut ?? 0.14;
  const hold = cfg?.hold ?? 0.1;
  const vertical = cfg?.axis === "updown";
  const color = cfg?.color ?? "linear-gradient(90deg, #07050c 0%, #120d1c 70%, #07050c 100%)";
  const edge = cfg?.edge ?? "#ffd9a0";
  const total = shut + hold + dur;

  // Keyframes in ONE timeline rather than three chained animations: chaining
  // through state leaves a frame of the old value on screen at every handoff,
  // which on a 0.14s slam is the whole slam.
  const times = [0, shut / total, (shut + hold) / total, 1];
  const ease = ["easeIn", "linear", "easeOut"] as const;

  // Each panel travels its own full width, so the pair meets dead centre.
  const sweep = (sign: -1 | 1) => {
    const closed = "0%";
    const open = `${sign * 100}%`;
    return { from: open, frames: [open, closed, closed, open] };
  };

  const panel = (sign: -1 | 1) => {
    const { from, frames } = sweep(sign);
    const axisKey = vertical ? "y" : "x";
    return (
      <m.div
        className="absolute"
        style={{
          background: color,
          ...(vertical
            ? { left: 0, right: 0, height: "50.5%", [sign < 0 ? "top" : "bottom"]: 0 }
            : { top: 0, bottom: 0, width: "50.5%", [sign < 0 ? "left" : "right"]: 0 }),
        }}
        initial={{ [axisKey]: from }}
        animate={{ [axisKey]: frames }}
        transition={{ duration: total, times, ease: [...ease] }}
      >
        {/* the lit meeting edge — this is the part the eye actually follows */}
        <div
          className="absolute"
          style={{
            background: `linear-gradient(${vertical ? "180deg" : "90deg"}, transparent, ${edge})`,
            filter: "blur(0.5px)",
            opacity: 0.9,
            ...(vertical
              ? { left: 0, right: 0, height: "2.5vh", [sign < 0 ? "bottom" : "top"]: 0, transform: sign < 0 ? "none" : "scaleY(-1)" }
              : { top: 0, bottom: 0, width: "2.2vw", [sign < 0 ? "right" : "left"]: 0, transform: sign < 0 ? "none" : "scaleX(-1)" }),
          }}
        />
      </m.div>
    );
  };

  return (
    <AnimatePresence>
      {fire > 0 && (
        // Keyed on the trigger count: a second curtain inside the first
        // REPLACES it rather than queueing, so a dense passage can't stack
        // four sets of doors on top of each other.
        <m.div
          key={`curtain-${fire}`}
          className="pointer-events-none fixed inset-0 z-[44] overflow-hidden"
          aria-hidden
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          {panel(-1)}
          {panel(1)}
        </m.div>
      )}
    </AnimatePresence>
  );
}
