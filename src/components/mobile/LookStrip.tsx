"use client";

// LOOK STRIP — eight 44px pads riding above the pocket sheet: tap fires the
// look as a one-bar morph. The trailing ＋ pad captures the current surface
// on a LONG-PRESS (auto-named LOOK-n, no prompt — a flash confirms). Long-
// press a user look to arm it for deletion (✕, signal red); tap or long-
// press again within 2s to remove, or let it disarm itself.

import { useCallback, useEffect, useRef, useState } from "react";
import { looksStore, type Look } from "@/lib/engine/looks";
import { featureBus } from "@/lib/engine/features";
import { fire as hapticFire, tick } from "@/lib/haptics";

const barSec = () => {
  const bpm = featureBus.F.bpm;
  return bpm > 0 ? 240 / bpm : 2.4;
};

/** 44px pad with tap vs long-press (500ms) discrimination. */
function Pad({ children, onTap, onHold, className = "", style, title }: {
  children: React.ReactNode;
  onTap?: () => void;
  onHold?: () => void;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  const t = useRef(0);
  const held = useRef(false);
  return (
    <button
      type="button"
      title={title}
      className={className}
      style={style}
      onPointerDown={() => {
        held.current = false;
        window.clearTimeout(t.current);
        if (onHold) t.current = window.setTimeout(() => { held.current = true; onHold(); }, 500);
      }}
      onPointerUp={() => window.clearTimeout(t.current)}
      onPointerLeave={() => window.clearTimeout(t.current)}
      onClick={() => { if (!held.current) onTap?.(); held.current = false; }}
    >{children}</button>
  );
}

export function LookStrip({ className = "" }: { className?: string }) {
  const [looks, setLooks] = useState<Look[]>([]);
  const [hot, setHot] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [plus, setPlus] = useState<string | null>(null);
  const disarm = useRef(0);
  const refresh = useCallback(() => setLooks(looksStore.list().slice(0, 8)), []);
  useEffect(refresh, [refresh]);

  const fireLook = (l: Look) => {
    if (armed === l.id) { // armed ✕ pad — the tap is the confirmation
      looksStore.remove(l.id);
      setArmed(null);
      refresh();
      tick(8);
      return;
    }
    looksStore.fire(l.id, barSec());
    setHot(l.id);
    tick(8);
    window.setTimeout(() => setHot((x) => (x === l.id ? null : x)), 700);
  };

  const holdLook = (l: Look) => {
    if (l.id.startsWith("builtin:")) return;
    if (armed === l.id) { // second long-press within the window deletes
      looksStore.remove(l.id);
      setArmed(null);
      refresh();
      hapticFire(12);
      return;
    }
    setArmed(l.id);
    hapticFire(12);
    window.clearTimeout(disarm.current);
    disarm.current = window.setTimeout(() => setArmed(null), 2000);
  };

  const capture = () => {
    const n = looksStore.list().filter((l) => l.id.startsWith("user:")).length + 1;
    looksStore.capture(`LOOK-${n}`);
    refresh();
    hapticFire(14);
    setPlus("SAVED");
    window.setTimeout(() => setPlus((x) => (x === "SAVED" ? null : x)), 900);
  };

  return (
    <div
      className={`flex snap-x gap-1.5 overflow-x-auto px-3 py-1 [scrollbar-width:none] ${className}`}
      data-look-strip
    >
      {looks.map((l) => {
        const builtin = l.id.startsWith("builtin:");
        const isHot = hot === l.id;
        const isArmed = armed === l.id;
        return (
          <Pad
            key={l.id}
            onTap={() => fireLook(l)}
            onHold={() => holdLook(l)}
            title={`${l.name} — tap fires (one-bar morph)${builtin ? "" : " · hold to delete"}`}
            className="flex h-11 w-11 flex-none snap-start flex-col items-center justify-center rounded-lg border font-mono text-[7px] uppercase leading-tight tracking-wide"
            style={{
              borderColor: isArmed ? "var(--inst-signal)" : isHot ? "var(--inst-plasma)" : "var(--inst-line)",
              color: isArmed ? "var(--inst-signal)" : isHot ? "var(--inst-plasma)" : builtin ? "var(--inst-dim)" : "var(--inst-warn)",
              background: "rgba(12,8,22,0.92)",
              boxShadow: isHot ? "0 0 12px color-mix(in srgb, var(--inst-plasma) 45%, transparent)" : "none",
            }}
          >
            {isArmed ? (
              <span className="text-[13px] leading-none">✕</span>
            ) : (
              <>
                {builtin && <span className="text-[8px] leading-none">✦</span>}
                <span className="max-w-full truncate px-0.5">{l.name.slice(0, 7)}</span>
              </>
            )}
          </Pad>
        );
      })}
      <Pad
        onTap={() => { setPlus("HOLD"); window.setTimeout(() => setPlus((x) => (x === "HOLD" ? null : x)), 700); }}
        onHold={capture}
        title="Hold to capture the current look"
        className="flex h-11 flex-none snap-start items-center justify-center rounded-lg border border-dashed px-1 font-mono text-[9px] uppercase tracking-[0.15em]"
        style={{
          minWidth: 44,
          borderColor: plus === "SAVED" ? "var(--inst-ok)" : "var(--inst-line)",
          color: plus === "SAVED" ? "var(--inst-ok)" : plus === "HOLD" ? "var(--inst-warn)" : "var(--inst-faint)",
          background: "rgba(12,8,22,0.92)",
        }}
      >
        {plus ?? "＋"}
      </Pad>
    </div>
  );
}
