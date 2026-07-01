"use client";

import { useEffect, useRef } from "react";

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isTouch) return;

    // Positions kept in plain objects — no React state, so no re-renders.
    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ring = { x: pointer.x, y: pointer.y };
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      // The dot tracks the pointer 1:1 — instant, no perceived lag.
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${pointer.x}px, ${pointer.y}px) translate(-50%, -50%)`;
      }
    };

    const onOver = (e: PointerEvent) => {
      const el = e.target as Element | null;
      const interactive = !!el?.closest?.(
        "a[href], button, [role='button'], input, textarea, select, .cursor-pointer, [data-sfx]"
      );
      ringRef.current?.classList.toggle("cursor-ring--hover", interactive);
    };

    // Only the ring is eased (a smooth trailing halo) — cheap, and the actual
    // pointer indicator (the dot) is never delayed.
    const animate = () => {
      ring.x += (pointer.x - ring.x) * 0.22;
      ring.y += (pointer.y - ring.y) * 0.22;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ring.x}px, ${ring.y}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(animate);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* Trailing ring */}
      <div
        ref={ringRef}
        className="cursor-ring pointer-events-none fixed left-0 top-0 z-[9998] hidden h-8 w-8 rounded-full border lg:block"
        style={{ willChange: "transform", borderColor: "color-mix(in srgb, var(--theme-accent) 40%, transparent)", transition: "width .18s ease, height .18s ease, border-color .18s ease" }}
        aria-hidden
      />
      {/* Pointer dot */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-[9999] hidden h-2.5 w-2.5 rounded-full lg:block"
        style={{ willChange: "transform", background: "var(--theme-primary)", boxShadow: "0 0 10px color-mix(in srgb, var(--theme-primary) 60%, transparent)" }}
        aria-hidden
      />
      <style>{`
        @media (hover: hover) and (pointer: fine) { * { cursor: none !important; } }
        .cursor-ring--hover { width: 2.75rem; height: 2.75rem; border-color: color-mix(in srgb, var(--theme-accent) 70%, transparent) !important; }
      `}</style>
    </>
  );
}
