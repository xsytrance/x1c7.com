"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";

/* ── data ─────────────────────────────────────────────── */

const LEVELS = [
  {
    num: "01",
    badge: "LEVEL 1",
    title: "Get Set Up",
    color: "#8dff4a",
    features: ["AI workflow audit", "Tool selection", "Integration planning"],
    status: "Available",
  },
  {
    num: "02",
    badge: "LEVEL 2",
    title: "Smart Automation",
    color: "#43f7ff",
    features: ["Business process automation", "AI-powered responses", "Data pipeline setup"],
    status: "Available",
  },
  {
    num: "03",
    badge: "LEVEL 3",
    title: "Scale Operations",
    color: "#ff2bd6",
    features: ["Multi-agent systems", "Custom AI training", "Full ecosystem integration"],
    status: "Available",
  },
];

const STEPS = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8dff4a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    title: "Signal In",
    desc: "Share your current workflow, pain points, and what success looks like for you.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#43f7ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
      </svg>
    ),
    title: "Process",
    desc: "We analyze, architect, and build your AI-powered automation system.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff2bd6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
    title: "Results",
    desc: "You get measurable time savings, fewer errors, and systems that run themselves.",
  },
];

/* ── checkmark component ──────────────────────────────── */

function CheckDraw({ color, delay = 0 }: { color: string; delay?: number }) {
  const reduce = useReducedMotion();

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      className="mt-[2px] shrink-0"
    >
      <motion.path
        d="M4 9l4 4 6-7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-30px" }}
        transition={{ duration: 0.5, delay, ease: "easeOut" }}
      />
    </svg>
  );
}

/* ── connection line between cards ────────────────────── */

function ConnectionLine({ color }: { color: string }) {
  return (
    <div className="relative mx-auto flex h-10 w-px flex-col items-center justify-center overflow-visible sm:h-12">
      <div className="h-full w-px border-l border-dashed" style={{ borderColor: `${color}30` }} />
      <motion.div
        className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: color }}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/* ── level card ───────────────────────────────────────── */

function LevelCard({
  level,
  index,
}: {
  level: (typeof LEVELS)[number];
  index: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <>
      {/* connection line above (skip first) */}
      {index > 0 && <ConnectionLine color={level.color} />}

      <ScrollReveal delay={index * 0.1}>
        <motion.div
          className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur transition-colors duration-300 sm:p-6"
          style={{
            boxShadow: hovered
              ? `0 0 40px -10px ${level.color}30, inset 0 0 40px -20px ${level.color}10`
              : "0 20px 40px -10px rgba(0,0,0,0.3)",
            borderColor: hovered ? `${level.color}40` : undefined,
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          whileHover={{
            scale: 1.01,
            transition: { duration: 0.3 },
          }}
        >
          {/* subtle glow orb */}
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-10 blur-3xl transition-opacity duration-500 group-hover:opacity-25"
            style={{ backgroundColor: level.color }}
          />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
            {/* left: big number */}
            <div className="flex items-center gap-4 sm:block sm:shrink-0">
              <span
                className="font-display text-6xl font-black leading-none opacity-20 sm:text-7xl"
                style={{ color: level.color }}
              >
                {level.num}
              </span>
            </div>

            {/* middle: content */}
            <div className="flex-1">
              {/* badge */}
              <span
                className="inline-block rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-black"
                style={{ backgroundColor: level.color }}
              >
                {level.badge}
              </span>

              {/* title */}
              <h3 className="mt-3 font-display text-2xl font-bold tracking-[-0.04em] text-white sm:text-3xl">
                {level.title}
              </h3>

              {/* features */}
              <ul className="mt-4 flex flex-col gap-2">
                {level.features.map((f, i) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-white/70">
                    <CheckDraw color={level.color} delay={0.2 + i * 0.15} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* right: status pill */}
            <div className="shrink-0 sm:self-center">
              <span
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60"
                style={{ borderColor: `${level.color}30` }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ backgroundColor: level.color }}
                />
                {level.status}
              </span>
            </div>
          </div>
        </motion.div>
      </ScrollReveal>
    </>
  );
}

/* ── step card ────────────────────────────────────────── */

function StepCard({
  step,
  index,
}: {
  step: (typeof STEPS)[number];
  index: number;
}) {
  return (
    <ScrollReveal delay={index * 0.15} className="flex-1">
      <div className="card-lift h-full rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur sm:p-6">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
          {step.icon}
        </div>
        <h4 className="font-display text-lg font-bold tracking-[-0.03em] text-white">
          {step.title}
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-white/55">{step.desc}</p>
      </div>
    </ScrollReveal>
  );
}

/* ── page ─────────────────────────────────────────────── */

export default function Page() {
  const reduce = useReducedMotion();

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
      {/* scanline + starfield */}
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />

      <div className="relative z-10 mx-auto max-w-4xl">
        {/* nav */}
        <BackToHub />

        {/* ── header ── */}
        <section className="mt-8 text-center sm:mt-12">
          <TextScramble
            text="LEVEL READY"
            className="font-display text-5xl font-black uppercase tracking-[-0.06em] text-white sm:text-7xl md:text-8xl"
            as="h1"
            delay={200}
          />

          <p className="mx-auto mt-5 max-w-lg text-base font-semibold leading-7 text-white/75 sm:text-lg">
            AI help for people and businesses in real life.
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/50">
            Practical automation, setup help, and less &ldquo;what button do I press?&rdquo; energy.
          </p>
        </section>

        {/* ── value proposition ── */}
        <ScrollReveal className="mt-8 sm:mt-12">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 text-center backdrop-blur sm:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#8dff4a]/80">
              What you get
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3 sm:gap-4">
              {["Workflow audit", "Tool setup", "Automation", "Ongoing support"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* ── level cards ── */}
        <section className="mt-10 sm:mt-14">
          <ScrollReveal>
            <p className="mb-6 text-center font-mono text-xs uppercase tracking-[0.3em] text-white/40">
              Choose your level
            </p>
          </ScrollReveal>

          <div className="flex flex-col">
            {LEVELS.map((level, i) => (
              <LevelCard key={level.badge} level={level} index={i} />
            ))}
          </div>
        </section>

        {/* ── how it works ── */}
        <section className="mt-14 sm:mt-20">
          <ScrollReveal className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/40">
              How it works
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">
              Three steps to upgrade
            </h2>
          </ScrollReveal>

          <div className="mt-8 flex flex-col gap-4 sm:mt-10 sm:flex-row sm:gap-5">
            {STEPS.map((step, i) => (
              <StepCard key={step.title} step={step} index={i} />
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mt-14 sm:mt-20">
          <ScrollReveal className="text-center">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 backdrop-blur sm:p-12">
              <h2 className="font-display text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">
                Ready to level up?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/55">
                Start with a free workflow audit. We&rsquo;ll map out exactly where AI can save you time and money.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <motion.a
                  href="mailto:hello@levelready.ai"
                  className="inline-flex w-full items-center justify-center rounded-full bg-white px-8 py-4 font-display text-sm font-black uppercase tracking-[0.2em] text-[#05030b] transition-colors duration-300 hover:bg-[#8dff4a] sm:w-auto"
                  whileHover={reduce ? {} : { scale: 1.05 }}
                  whileTap={reduce ? {} : { scale: 0.97 }}
                >
                  Initialize Setup
                </motion.a>
                <motion.a
                  href="#process"
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/20 px-8 py-4 font-display text-sm font-black uppercase tracking-[0.2em] text-white/70 transition-colors duration-300 hover:border-[#8dff4a] hover:text-white sm:w-auto"
                  whileHover={reduce ? {} : { scale: 1.05 }}
                  whileTap={reduce ? {} : { scale: 0.97 }}
                >
                  Learn More
                </motion.a>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ── footer nav ── */}
        <footer className="mt-10 pb-6 text-center sm:mt-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/25">
            Level Ready &mdash; AI help for people and businesses in real life.
          </p>
        </footer>
      </div>
    </main>
  );
}
