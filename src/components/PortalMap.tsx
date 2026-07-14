"use client";

import { m, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { portals } from "@/data/portals";
import { PortalConnections } from "./PortalConnections";

// Orbit slots computed for however many portals exist — a fixed list broke
// the homepage prerender the moment a 9th portal was added.
const orbitPositions = portals.map((_, i) => {
  const a = (i / portals.length) * Math.PI * 2; // start at top, clockwise
  return {
    left: `${(50 + 32 * Math.sin(a)).toFixed(1)}%`,
    top: `${(49.5 - 41.5 * Math.cos(a)).toFixed(1)}%`,
  };
});

export function PortalMap() {
  const [activeSlug, setActiveSlug] = useState(portals[0].slug);
  const active = portals.find((portal) => portal.slug === activeSlug) ?? portals[0];
  const activeIndex = portals.findIndex((p) => p.slug === activeSlug);
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative mx-auto w-full max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="relative min-h-[680px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-plasma/10 backdrop-blur md:min-h-[720px] md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(67,247,255,0.16),transparent_32%),radial-gradient(circle_at_20%_20%,rgba(255,36,64,0.16),transparent_28%),radial-gradient(circle_at_80%_75%,rgba(141,255,74,0.12),transparent_30%)]" />
          <div className="starfield" aria-hidden />
          <div className="absolute left-1/2 top-[295px] hidden h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-signal/20 md:block" />
          <div className="absolute left-1/2 top-[295px] hidden h-[610px] w-[610px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-plasma/15 md:block" />

          {/* Connection lines */}
          <PortalConnections activeIndex={activeIndex} />

          <m.button
            type="button"
            onClick={() => setActiveSlug(active.slug)}
            animate={reduceMotion ? undefined : { scale: [1, 1.025, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-1/2 top-[295px] z-10 hidden h-48 w-48 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-void/70 text-center shadow-glow backdrop-blur-xl md:grid"
          >
            <span className="absolute inset-3 rounded-full border border-signal/30" />
            <span className="text-xs uppercase tracking-[0.5em] text-signal/80">x1c7</span>
            <span className="font-display text-5xl font-black">CORE</span>
            <span className="px-8 text-xs uppercase tracking-[0.25em] text-white/55">choose a portal</span>
          </m.button>

          <div className="relative z-20 grid gap-3 md:absolute md:inset-0 md:block">
            {portals.map((portal, index) => {
              const selected = portal.slug === active.slug;
              return (
                <m.button
                  key={portal.slug}
                  type="button"
                  onClick={() => setActiveSlug(portal.slug)}
                  initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`node-orbit group relative flex min-h-24 w-full items-center gap-4 overflow-hidden rounded-3xl border p-4 text-left transition duration-300 md:grid md:h-20 md:min-h-0 md:w-20 md:-translate-x-1/2 md:-translate-y-1/2 md:place-items-center md:rounded-full md:p-0 lg:h-24 lg:w-24 ${selected ? "border-white/45 bg-white/15 shadow-glow" : "border-white/10 bg-void/55 hover:border-white/35 hover:bg-white/10"}`}
                  style={
                    {
                      boxShadow: selected ? `0 0 44px ${portal.color}44` : undefined,
                      "--node-left": orbitPositions[index].left,
                      "--node-top": orbitPositions[index].top,
                    } as CSSProperties
                  }
                >
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/15 text-2xl font-black md:h-14 md:w-14 md:rounded-full md:text-2xl lg:h-16 lg:w-16"
                    style={{ background: `${portal.color}22`, color: portal.color }}
                  >
                    {portal.glyph}
                  </span>
                  <span className="md:sr-only">
                    <span className="block font-display text-lg font-black uppercase leading-tight tracking-wide">{portal.title}</span>
                    <span className="block text-xs uppercase tracking-[0.22em] text-white/45">{portal.status}</span>
                  </span>
                  <span className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 transition group-hover:scale-x-100" style={{ background: portal.color }} />
                </m.button>
              );
            })}
          </div>
        </div>

        <m.aside
          key={active.slug}
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8"
        >
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: `${active.color}44` }} />
          <p className="relative font-mono text-xs uppercase tracking-[0.4em] text-white/45">active portal</p>
          <h2 className="relative mt-3 font-display text-4xl font-black uppercase tracking-tight sm:text-6xl" style={{ color: active.color }}>
            {active.title}
          </h2>
          <p className="relative mt-4 text-xl font-semibold text-white">{active.signal}</p>
          <p className="relative mt-4 max-w-xl text-sm leading-7 text-white/68 sm:text-base">{active.description}</p>
          <div className="relative mt-7 grid gap-3">
            {active.details.map((detail) => (
              <div key={detail} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">
                <span className="h-2 w-2 rounded-full" style={{ background: active.color }} />
                {detail}
              </div>
            ))}
          </div>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link href={`/${active.slug}`} className="rounded-full px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition hover:scale-105" style={{ background: active.color }}>
              {active.cta}
            </Link>
            <a href="#signal" className="rounded-full border border-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-white/75 transition hover:border-white/45 hover:text-white">
              Read signal
            </a>
          </div>
        </m.aside>
      </div>
    </section>
  );
}