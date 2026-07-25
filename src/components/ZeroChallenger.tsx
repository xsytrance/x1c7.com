"use client";

import { useEffect, useRef, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// COMING SOON: zer0?!?!?
//
// Chris — zer0 — the third of Ms. Dagnese's second-graders, next to be
// onboarded into the crew. Baker, cook, anime lifer (DBZ), gamer. Runs the
// cupcake / donut / pastry business PINK'S DESIRE.
//
// The look is the arcade cut-in played straight: HERE COMES A NEW CHALLENGER.
// The fighter is a silhouette because he hasn't been revealed yet — a chef's
// hat in a spotlight, filled with nothing, pink aura behind it, one scouter
// arc where the eye would be. Everything animates only once it's on screen,
// and everything stops if the visitor asked for less motion.
//
// It lives on BOTH sites (Tyler's and AGENOR's) — it's a crew announcement.
// ═══════════════════════════════════════════════════════════════════════════

const PINK = "#ff4d9d";

export function ZeroChallenger({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLElement | null>(null);
  const [live, setLive] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = ref.current;
    if (!el) return;
    // The slam only lands if you're there to see it.
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && (setLive(true), io.disconnect()),
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const on = live || reduced;

  return (
    <section
      ref={ref}
      aria-label="Coming soon: zer0"
      className={`relative isolate w-full overflow-hidden ${compact ? "py-16" : "py-20 md:py-28"}`}
      style={{ background: "#050208" }}
    >
      {/* ARENA FLOOR — a perspective grid running to a pink horizon */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-40"
        style={{
          background:
            `linear-gradient(to top, ${PINK}22, transparent 70%),` +
            "repeating-linear-gradient(to right, rgba(255,77,157,0.25) 0 1px, transparent 1px 42px)",
          maskImage: "linear-gradient(to top, #000, transparent)",
          WebkitMaskImage: "linear-gradient(to top, #000, transparent)",
        }}
      />
      {/* SPOTLIGHT */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2"
        style={{ background: `radial-gradient(ellipse at center, ${PINK}2e 0%, transparent 62%)` }}
      />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 text-center md:px-8">
        {/* THE BANNER — slams in from both sides */}
        <div
          className="w-full overflow-hidden border-y-2 py-3"
          style={{
            borderColor: PINK,
            background: "rgba(0,0,0,0.72)",
            clipPath: on ? "inset(0 0% 0 0%)" : "inset(0 50% 0 50%)",
            transition: reduced ? "none" : "clip-path 520ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <p
            className="font-mono text-[11px] font-black uppercase leading-none tracking-[0.35em] md:text-base"
            style={{ color: PINK, textShadow: `0 0 22px ${PINK}` }}
          >
            Here comes a new challenger
          </p>
        </div>

        {/* THE FIGHTER — a chef's hat, unrevealed */}
        <div
          className="relative mt-8 md:mt-10"
          style={{
            opacity: on ? 1 : 0,
            transform: on ? "translateY(0) scale(1)" : "translateY(24px) scale(0.94)",
            transition: reduced ? "none" : "opacity 600ms 260ms ease-out, transform 600ms 260ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl md:h-72 md:w-72"
            style={{ background: `${PINK}55` }}
          />
          <ChefHatSilhouette />
        </div>

        {/* THE NAME — letters land one at a time with the fighting-game shudder */}
        <h2 className="mt-8 flex items-baseline justify-center gap-[0.02em] text-[19vw] leading-none md:text-8xl">
          {"zer0".split("").map((c, i) => (
            <span
              key={i}
              className="inline-block font-black"
              style={{
                color: "#fff",
                textShadow: `0 0 30px ${PINK}, 0 0 6px ${PINK}`,
                opacity: on ? 1 : 0,
                transform: on ? "none" : "translateY(-18px) scale(1.3)",
                transition: reduced ? "none" : `opacity 220ms ${420 + i * 90}ms, transform 260ms ${420 + i * 90}ms cubic-bezier(0.2,1.6,0.4,1)`,
              }}
            >
              {c}
            </span>
          ))}
          <span
            className="inline-block font-black"
            style={{
              color: PINK,
              opacity: on ? 1 : 0,
              transition: reduced ? "none" : "opacity 300ms 820ms",
              animation: reduced || !on ? undefined : "zeroWobble 1.6s ease-in-out infinite 1.2s",
            }}
          >
            ?!?!?
          </span>
        </h2>

        {/* VS-SCREEN CHROME — a bar that fills and never quite completes */}
        <div className="mt-6 w-full max-w-md">
          <div className="h-2 w-full overflow-hidden rounded-full border" style={{ borderColor: `${PINK}66` }}>
            <div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${PINK}, #ffd166)`,
                width: on ? "88%" : "0%",
                transition: reduced ? "none" : "width 2.4s 700ms cubic-bezier(0.2,0.9,0.2,1)",
                boxShadow: `0 0 18px ${PINK}`,
              }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">
            <span>onboarding</span>
            <span>88%</span>
          </div>
        </div>

        <p className="mt-7 text-base font-bold uppercase tracking-[0.3em] md:text-lg" style={{ color: PINK }}>
          Pink&rsquo;s Desire
        </p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/55">
          Cupcakes, donuts, pastries — and the third seat at the table since Ms. Dagnese&rsquo;s class.
          We&rsquo;re getting him set up next.
        </p>

        <p
          className="mt-6 font-mono text-[10px] uppercase tracking-[0.4em] text-white/35"
          style={{ animation: reduced ? undefined : "zeroBlink 1.15s steps(1) infinite" }}
        >
          press start to continue
        </p>
      </div>

      <style jsx>{`
        @keyframes zeroBlink { 0%, 55% { opacity: 0.75 } 56%, 100% { opacity: 0.15 } }
        @keyframes zeroWobble { 0%, 100% { transform: rotate(-4deg) } 50% { transform: rotate(4deg) } }
      `}</style>
    </section>
  );
}

/** The unrevealed fighter: a chef's toque, pure silhouette, no fill detail. */
function ChefHatSilhouette() {
  return (
    <svg viewBox="0 0 200 200" className="relative h-44 w-44 md:h-56 md:w-56" role="img" aria-label="A chef's hat in silhouette">
      <defs>
        <linearGradient id="zeroRim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PINK} stopOpacity="0.95" />
          <stop offset="100%" stopColor={PINK} stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {/* the toque: three puffs over a band */}
      <path
        d="M58 96c-16 0-28-13-28-29 0-15 11-27 26-28 4-16 18-27 36-27 17 0 32 11 36 27 15 1 26 13 26 28 0 16-12 29-28 29z"
        fill="#000"
        stroke="url(#zeroRim)"
        strokeWidth="3"
      />
      <rect x="58" y="96" width="84" height="34" rx="6" fill="#000" stroke="url(#zeroRim)" strokeWidth="3" />
      {/* band pleats — just enough to read as a hat, not enough to read as a face */}
      <path d="M76 100v26M100 100v26M124 100v26" stroke={PINK} strokeOpacity="0.35" strokeWidth="2" />
      {/* shoulders fading into the dark */}
      <path d="M44 176c8-24 27-40 56-40s48 16 56 40z" fill="#000" stroke="url(#zeroRim)" strokeWidth="2.5" strokeOpacity="0.5" />
    </svg>
  );
}
