"use client";

import { useEffect, useRef, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// COMING SOON: KIZUNA SATO — LevelReady Records
//
// The label's first lady, teased before her debut drops. Osaka neon on one
// side, East-LA gold on the other — sakura petals, gold chain sparkle, a
// tilted photocard like it slipped out of an album sleeve, and a typewriter
// line that never quite finishes its ellipsis.
//
// Cute is the brief: petals drift, sparkles breathe, the ♡ is load-bearing.
// Everything animates only once it's on screen, and everything stops if the
// visitor asked for less motion.
// ═══════════════════════════════════════════════════════════════════════════

const SAKURA = "#ffa4c9";
const GOLD = "#f2c46d";

const TAGLINE = "Coming soon to LevelReady Records...";
// The typed line's true width: one ch per glyph PLUS the tracking each glyph
// carries — animating to a bare Nch clips the tail of the line.
const TAGLINE_W = `calc(${TAGLINE.length}ch + ${(TAGLINE.length * 0.18).toFixed(2)}em)`;

// Petals get fixed lanes so the drift reads as weather, not confetti.
const PETALS = [
  { left: "6%", delay: 0, dur: 11, size: 18, glyph: "❀" },
  { left: "18%", delay: 3.2, dur: 13, size: 13, glyph: "✿" },
  { left: "34%", delay: 6.1, dur: 10, size: 15, glyph: "❀" },
  { left: "52%", delay: 1.4, dur: 14, size: 12, glyph: "✿" },
  { left: "67%", delay: 4.8, dur: 11.5, size: 17, glyph: "❀" },
  { left: "81%", delay: 2.3, dur: 12.5, size: 14, glyph: "✿" },
  { left: "92%", delay: 7.4, dur: 10.5, size: 16, glyph: "❀" },
] as const;

export function KizunaTeaser({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLElement | null>(null);
  const [live, setLive] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && (setLive(true), io.disconnect()),
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const on = live || reduced;

  return (
    <section
      ref={ref}
      aria-label="Coming soon: Kizuna Sato"
      className={`relative isolate w-full overflow-hidden ${compact ? "py-16" : "py-20 md:py-28"}`}
      style={{ background: "#10060e" }}
    >
      {/* OSAKA DUSK — a soft pink-to-gold glow rising from the floor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 opacity-50"
        style={{
          background:
            `radial-gradient(ellipse at 30% 100%, ${SAKURA}2a 0%, transparent 60%),` +
            `radial-gradient(ellipse at 75% 100%, ${GOLD}22 0%, transparent 55%)`,
        }}
      />

      {/* SAKURA WEATHER */}
      {!reduced && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {PETALS.map((p, i) => (
            <span
              key={i}
              className="absolute top-[-6%] select-none"
              style={{
                left: p.left,
                fontSize: p.size,
                color: i % 3 === 2 ? GOLD : SAKURA,
                opacity: 0,
                animation: on ? `kzFall ${p.dur}s linear ${p.delay}s infinite` : undefined,
                textShadow: `0 0 12px ${i % 3 === 2 ? GOLD : SAKURA}66`,
              }}
            >
              {p.glyph}
            </span>
          ))}
        </div>
      )}

      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 text-center md:px-8">
        {/* THE PHOTOCARD — tilted like it slid out of an album sleeve */}
        <div
          className="relative"
          style={{
            opacity: on ? 1 : 0,
            transform: on ? "rotate(-2.5deg) translateY(0)" : "rotate(-2.5deg) translateY(28px)",
            transition: reduced ? "none" : "opacity 700ms ease-out, transform 700ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          {/* aura */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] blur-3xl"
            style={{
              background: `linear-gradient(160deg, ${SAKURA}40, ${GOLD}33)`,
              animation: reduced || !on ? undefined : "kzBreathe 4.5s ease-in-out infinite",
            }}
          />
          <figure
            className="relative w-64 overflow-hidden rounded-[1.4rem] border-2 p-2 md:w-80"
            style={{
              borderColor: `${GOLD}88`,
              background: "linear-gradient(160deg, rgba(255,164,201,0.14), rgba(242,196,109,0.10))",
              boxShadow: `0 24px 60px -18px ${SAKURA}55, 0 0 0 1px ${SAKURA}22`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/art/kizuna/kizuna-teaser.webp"
              alt="Kizuna Sato throwing a peace sign in a rain-slicked, neon-lit Dotonbori street at night"
              className="w-full rounded-[1rem] object-cover"
              loading="lazy"
            />
            {/* corner sticker */}
            <span
              aria-hidden
              className="absolute right-4 top-4 text-lg"
              style={{
                color: SAKURA,
                textShadow: `0 0 10px ${SAKURA}`,
                animation: reduced || !on ? undefined : "kzTwinkle 2.2s ease-in-out infinite 0.6s",
              }}
            >
              ♡
            </span>
          </figure>
          {/* sparkles pinned to the card's aura */}
          {[
            { top: "-4%", left: "-7%", d: "0s", s: 20 },
            { top: "18%", left: "103%", d: "0.9s", s: 14 },
            { top: "88%", left: "-9%", d: "1.5s", s: 15 },
          ].map((sp, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute select-none"
              style={{
                top: sp.top,
                left: sp.left,
                fontSize: sp.s,
                color: GOLD,
                textShadow: `0 0 14px ${GOLD}`,
                animation: reduced || !on ? undefined : `kzTwinkle 2.6s ease-in-out ${sp.d} infinite`,
              }}
            >
              ✦
            </span>
          ))}
        </div>

        {/* THE NAME */}
        <h2
          className="mt-9 text-4xl font-black tracking-[0.08em] text-white md:text-6xl"
          style={{
            textShadow: `0 0 34px ${SAKURA}aa, 0 0 8px ${SAKURA}66`,
            opacity: on ? 1 : 0,
            transform: on ? "none" : "translateY(14px)",
            transition: reduced ? "none" : "opacity 500ms 350ms ease-out, transform 500ms 350ms ease-out",
          }}
        >
          KIZUNA SATO
        </h2>
        <p
          className="mt-2 text-lg tracking-[0.5em] md:text-xl"
          style={{
            color: GOLD,
            textShadow: `0 0 18px ${GOLD}66`,
            opacity: on ? 1 : 0,
            transition: reduced ? "none" : "opacity 500ms 550ms ease-out",
          }}
        >
          絆 さとう
        </p>

        {/* THE PROMISE — typed out, cursor blinking, ellipsis never done */}
        <p
          className="mt-7 inline-block overflow-hidden whitespace-nowrap font-mono text-[11px] font-bold uppercase tracking-[0.18em] md:text-sm"
          style={{
            color: SAKURA,
            textShadow: `0 0 16px ${SAKURA}88`,
            borderRight: `2px solid ${GOLD}`,
            width: on ? TAGLINE_W : "0ch",
            animation: reduced || !on
              ? undefined
              : `kzType 2.6s steps(${TAGLINE.length}) 600ms both, kzCursor 0.9s steps(1) infinite 600ms`,
          }}
        >
          {TAGLINE}
        </p>

        {/* the bilingual wink — Osaka meets East LA */}
        <p
          className="mt-4 text-sm tracking-[0.12em] text-white/55"
          style={{
            opacity: on ? 1 : 0,
            transition: reduced ? "none" : "opacity 600ms 3.4s ease-out",
          }}
        >
          はじめまして, mi gente{" "}
          <span style={{ color: SAKURA }} aria-hidden>
            ♡
          </span>
        </p>
      </div>

      <style jsx>{`
        @keyframes kzFall {
          0% { transform: translateY(-4vh) translateX(0) rotate(0deg); opacity: 0; }
          8% { opacity: 0.85; }
          50% { transform: translateY(52vh) translateX(3.2rem) rotate(150deg); }
          92% { opacity: 0.75; }
          100% { transform: translateY(108vh) translateX(-1.6rem) rotate(320deg); opacity: 0; }
        }
        @keyframes kzTwinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes kzBreathe {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.95; }
        }
        @keyframes kzType {
          from { width: 0ch; }
          to { width: ${TAGLINE_W}; }
        }
        @keyframes kzCursor {
          0%, 55% { border-right-color: ${GOLD}; }
          56%, 100% { border-right-color: transparent; }
        }
      `}</style>
    </section>
  );
}
