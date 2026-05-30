"use client";

export function Vignette() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[15]"
      style={{
        background: "radial-gradient(circle at center, transparent 40%, rgba(5, 3, 11, 0.4) 100%)",
        mixBlendMode: "multiply",
      }}
      aria-hidden="true"
    />
  );
}
