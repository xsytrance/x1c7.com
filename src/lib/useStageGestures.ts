"use client";

// STAGE GESTURES — the backdrop itself becomes a control. On the stage
// background only (words/buttons keep their own interactions):
//   swipe ← / →   step to the next/prev scene, pinned (same mechanism as
//                 the ScenesRail: P.set("backdrop.scene", name, "ui"))
//   two-finger tap   release the pin back to AUTO (the decks take over)
//   swipe ↑ / ↓   nudge backdrop.intensity ±0.15, clamped to its range
// Every action ticks the haptics and surfaces a toast string the page can
// wear as a chip near the top of the stage.

import { useCallback, useEffect, useRef, useState } from "react";
import { P } from "@/lib/engine/params";
import { getActiveBackdrop } from "@/lib/engine/backdrop";
import { tick } from "@/lib/haptics";

const SWIPE_PX = 60;
const SWIPE_MS = 600;
const MULTI_TAP_MS = 350;
const TOAST_MS = 1200;
// targets that own their own touch language — never steal from them
const IGNORE = ".kinetic-word, button, a, input, select, textarea, [data-no-gesture]";

export function useStageGestures(enabled: boolean) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);

  /** Ref-callback: hand it the stage wrapper element (or null to detach). */
  const attach = useCallback((node: HTMLElement | null) => { setEl(node); }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (!el || !enabled) return;

    const show = (s: string) => {
      setToast(s);
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
    };

    const stepScene = (dir: 1 | -1) => {
      const names = getActiveBackdrop()?.sceneNames() ?? [];
      if (!names.length) return;
      const cur = P.getStr("backdrop.scene");
      const at = names.indexOf(cur);
      // AUTO (or unknown) starts the walk at 0
      const next = at < 0 ? (dir > 0 ? 0 : names.length - 1) : (at + dir + names.length) % names.length;
      P.set("backdrop.scene", names[next], "ui");
      tick(8);
      show(names[next]);
    };

    const stepIntensity = (delta: number) => {
      const d = P.def("backdrop.intensity");
      if (!d) return;
      const v = Math.min(d.max, Math.max(d.min, (P.getBase(d.id) as number) + delta));
      P.set(d.id, v, "ui");
      tick(8);
      const n = Math.round(((v - d.min) / (d.max - d.min || 1)) * 8);
      show(`INT ${"▮".repeat(n)}${"▯".repeat(8 - n)}`);
    };

    const pointers = new Map<number, { x: number; y: number; t: number }>();
    let multi = false;
    let multiStart = 0;

    const down = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.(IGNORE)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
      if (pointers.size === 2) { multi = true; multiStart = performance.now(); }
    };

    const up = (e: PointerEvent) => {
      const start = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (!start) return;
      if (multi) {
        if (pointers.size === 0) {
          if (performance.now() - multiStart < MULTI_TAP_MS) {
            P.set("backdrop.scene", "AUTO", "ui");
            tick(8);
            show("AUTO");
          }
          multi = false;
        }
        return;
      }
      const dt = performance.now() - start.t;
      if (dt > SWIPE_MS) return; // a press, not a flick
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.4) {
        stepScene(dx < 0 ? 1 : -1); // swipe left = next scene
      } else if (Math.abs(dy) > SWIPE_PX && Math.abs(dy) > Math.abs(dx) * 1.4) {
        stepIntensity(dy < 0 ? 0.15 : -0.15); // swipe up = brighter world
      }
    };

    const cancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) multi = false;
    };

    el.addEventListener("pointerdown", down, { passive: true });
    el.addEventListener("pointerup", up, { passive: true });
    el.addEventListener("pointercancel", cancel, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", cancel);
    };
  }, [el, enabled]);

  return { attach, toast };
}
