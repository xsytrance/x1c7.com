"use client";

export default function Loading() {
  return (
    <div className="relative grid min-h-screen place-items-center">
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />
      <div className="relative z-10 text-center">
        <div className="portal-ring mx-auto mb-6 grid h-16 w-16 animate-spin place-items-center rounded-2xl p-[2px] shadow-glow" style={{ animationDuration: "3s" }}>
          <span className="grid h-full w-full place-items-center rounded-2xl bg-void text-xl font-black">x</span>
        </div>
        <p className="animate-pulse font-mono text-xs uppercase tracking-[0.5em] text-signal/80">Tuning in...</p>
      </div>
    </div>
  );
}
