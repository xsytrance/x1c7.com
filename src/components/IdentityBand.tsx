"use client";

// The person behind the signal — xsy / VG God. The identity art (public/brand/
// identity-x1c7.webp) carries the story: Queens → Brooklyn, USMC, code + music +
// anime, build the system. Presented big with a thin caption.

import { ScrollReveal } from "./ScrollReveal";

export function IdentityBand() {
  return (
    <section className="relative z-10 mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <ScrollReveal>
        <div className="grid gap-6 overflow-hidden rounded-[2rem] border border-white/10 bg-black/25 backdrop-blur lg:grid-cols-[1.1fr_1fr]">
          <div className="relative min-h-[280px] lg:min-h-[420px]">
            <img
              src="/brand/identity-x1c7.webp"
              alt="xsy — the identity behind x1c7: Queens to Brooklyn, code and music and anime, build the system"
              className="absolute inset-0 h-full w-full object-cover object-center"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#05030b]/40 lg:to-[#05030b]" />
          </div>

          <div className="flex flex-col justify-center gap-4 p-7 sm:p-10">
            <p className="font-mono text-xs uppercase tracking-[0.45em] text-plasma/80">the one behind the signal</p>
            <h2 className="font-display text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">
              xsy <span className="text-white/30">/</span> VG God
            </h2>
            <p className="max-w-md text-base leading-7 text-white/65">
              Queens → Brooklyn. Marine, builder, artist. Code, music, anime, and games poured into one
              system — <span className="text-white/85">x1c7</span>. Music without borders, vision without limits.
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/35">
              create always · break it down · build the system
            </p>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
