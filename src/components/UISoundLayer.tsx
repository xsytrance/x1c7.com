"use client";

import { useEffect, useState } from "react";
import {
  initUiSound,
  isSfxEnabled,
  setSfxEnabled,
  playSfx,
} from "@/audio/uiSound";

/**
 * Global UI sound layer.
 * - Delegated hover/click listeners play subtle blips on interactive elements.
 * - A small floating toggle persists the on/off preference.
 * Audio can only start after a real user gesture, so nothing plays on load.
 */
export function UISoundLayer() {
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(false);

  // Initialise from saved preference / reduced-motion once on the client.
  useEffect(() => {
    const initial = initUiSound();
    setMounted(true);
    setEnabled(initial);
  }, []);

  // Delegated interaction listeners.
  useEffect(() => {
    if (!mounted) return;

    const INTERACTIVE = "a[href], button, [role='button'], [data-sfx]";
    let lastHover = 0;
    let lastHoverEl: Element | null = null;

    function isInternal(el: Element | null): boolean {
      const a = el?.closest("a[href]") as HTMLAnchorElement | null;
      if (!a) return false;
      const href = a.getAttribute("href") || "";
      return href.startsWith("/") || href.startsWith("#");
    }

    function onOver(e: PointerEvent) {
      if (!isSfxEnabled()) return;
      const el = (e.target as Element)?.closest?.(INTERACTIVE);
      if (!el || el === lastHoverEl) return;
      const now = performance.now();
      if (now - lastHover < 70) return;
      lastHover = now;
      lastHoverEl = el;
      playSfx("hover");
    }

    function onOut(e: PointerEvent) {
      const el = (e.target as Element)?.closest?.(INTERACTIVE);
      if (el === lastHoverEl) lastHoverEl = null;
    }

    function onClick(e: MouseEvent) {
      if (!isSfxEnabled()) return;
      const target = e.target as Element;
      const el = target?.closest?.(INTERACTIVE);
      if (!el) return;
      // Don't double-fire on the sound toggle itself (it plays its own cue).
      if (el.getAttribute("data-sfx") === "skip") return;
      const a = el.closest("a[href]") as HTMLAnchorElement | null;
      if (a && isInternal(el)) {
        const href = a.getAttribute("href") || "";
        playSfx(href === "/" ? "back" : "nav");
      } else {
        playSfx("click");
      }
    }

    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
    };
  }, [mounted]);

  function toggle() {
    const next = !enabled;
    setSfxEnabled(next);
    setEnabled(next);
    if (next) playSfx("toggle");
  }

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      data-sfx="skip"
      aria-pressed={enabled}
      aria-label={enabled ? "Mute interface sounds" : "Enable interface sounds"}
      title={enabled ? "Sound: ON" : "Sound: OFF"}
      className="group fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border bg-black/50 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] backdrop-blur transition hover:scale-105"
      style={{
        borderColor: enabled ? "#43f7ff55" : "#ffffff20",
        color: enabled ? "#43f7ff" : "#ffffff55",
      }}
    >
      {/* equalizer / muted glyph */}
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-[2px] rounded-full"
            style={{
              height: enabled ? 10 : 4,
              background: "currentColor",
              animation: enabled ? `visualizerBounce 0.6s ease-in-out ${i * 0.15}s infinite alternate` : "none",
            }}
          />
        ))}
      </span>
      {enabled ? "Sound" : "Muted"}
    </button>
  );
}
