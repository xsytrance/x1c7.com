"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";
import { MagneticCard } from "@/components/MagneticCard";

/* ──────────────────────────────────────────────
   Gallery data — 8 art frames with generative
   CSS patterns, varying aspect ratios for a
   masonry feel.
   ────────────────────────────────────────────── */

interface ArtFrame {
  title: string;
  category: string;
  accent: string;
  aspect: string; // tailwind aspect-* class
  render: React.ReactNode;
}

const ART_FRAMES: ArtFrame[] = [
  {
    title: "Neon Void",
    category: "Abstract",
    accent: "#ff2bd6",
    aspect: "aspect-square",
    render: (
      <div className="relative h-full w-full overflow-hidden bg-[#05030b]">
        {/* Base dark */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, #ff2bd6 0%, transparent 50%), radial-gradient(circle at 70% 70%, #43f7ff 0%, transparent 50%)",
            backgroundColor: "#05030b",
          }}
        />
        {/* Floating blurred orbs */}
        <div
          className="absolute left-[20%] top-[20%] h-20 w-20 rounded-full bg-plasma/40 blur-2xl animate-float"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="absolute bottom-[15%] right-[25%] h-24 w-24 rounded-full bg-signal/30 blur-2xl animate-float"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute right-[10%] top-[50%] h-16 w-16 rounded-full bg-venom/25 blur-2xl animate-float"
          style={{ animationDelay: "3s" }}
        />
      </div>
    ),
  },
  {
    title: "Digital Flora",
    category: "Generative",
    accent: "#8dff4a",
    aspect: "aspect-[3/4]",
    render: (
      <div className="relative grid h-full w-full place-items-center bg-void">
        <div
          className="h-[85%] w-[85%] rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg at 50% 50%, #ff2bd6, #43f7ff, #8dff4a, #ff9b3d, #ff2bd6)",
          }}
        />
        {/* Inner dark circle for ring effect */}
        <div className="absolute left-1/2 top-1/2 h-[40%] w-[40%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-void" />
      </div>
    ),
  },
  {
    title: "Signal Noise",
    category: "Glitch",
    accent: "#43f7ff",
    aspect: "aspect-[4/3]",
    render: (
      <div className="relative h-full w-full overflow-hidden bg-void">
        {/* Noise overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(67,247,255,0.1) 2px, rgba(67,247,255,0.1) 4px)",
          }}
        />
        {/* Vertical bands */}
        <div className="absolute inset-0 flex">
          {[0.15, 0.12, 0.08, 0.2, 0.1, 0.18, 0.06].map((op, i) => (
            <div
              key={i}
              className="flex-1 border-r border-signal/10"
              style={{
                background: `linear-gradient(to bottom, rgba(67,247,255,${op}), transparent)`,
              }}
            />
          ))}
        </div>
        {/* Scanline sweep */}
        <div className="absolute inset-0 animate-[drift_4s_linear_infinite] bg-gradient-to-b from-transparent via-signal/5 to-transparent" />
      </div>
    ),
  },
  {
    title: "Character Study",
    category: "XsyVerse",
    accent: "#ff9b3d",
    aspect: "aspect-square",
    render: (
      <div className="relative grid h-full w-full place-items-center overflow-hidden bg-void">
        {/* Abstract shape with polygon clip-path */}
        <div
          className="h-[70%] w-[60%]"
          style={{
            background:
              "linear-gradient(135deg, #ff9b3d 0%, #ff2bd6 50%, #7c3cff 100%)",
            clipPath:
              "polygon(50% 0%, 80% 10%, 100% 35%, 90% 60%, 70% 80%, 50% 100%, 30% 80%, 10% 60%, 0% 35%, 20% 10%)",
          }}
        />
        {/* Accent line */}
        <div className="absolute left-1/2 top-[85%] h-[1px] w-12 -translate-x-1/2 bg-gradient-to-r from-transparent via-ember/60 to-transparent" />
      </div>
    ),
  },
  {
    title: "XsyVerse Map",
    category: "World",
    accent: "#7c3cff",
    aspect: "aspect-[4/3]",
    render: (
      <div className="relative h-full w-full overflow-hidden bg-void">
        {/* Dotted grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(124,60,255,0.35) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        {/* Central glow */}
        <div
          className="absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(124,60,255,0.27), transparent 70%)",
          }}
        />
        {/* Crosshair */}
        <div className="absolute left-1/2 top-1/2 h-[1px] w-8 -translate-x-1/2 -translate-y-1/2 bg-royal/50" />
        <div className="absolute left-1/2 top-1/2 h-8 w-[1px] -translate-x-1/2 -translate-y-1/2 bg-royal/50" />
      </div>
    ),
  },
  {
    title: "Glitch Portrait",
    category: "Experimental",
    accent: "#ff2bd6",
    aspect: "aspect-[3/4]",
    render: (
      <div className="relative h-full w-full overflow-hidden bg-void">
        {/* Three overlapping offset rectangles */}
        <div
          className="absolute left-[30%] top-[20%] h-[55%] w-[35%] rounded-sm opacity-50"
          style={{
            background: "rgba(255, 43, 214, 0.7)",
            transform: "translate(-2px, 0)",
          }}
        />
        <div
          className="absolute left-[35%] top-[22%] h-[55%] w-[35%] rounded-sm opacity-50"
          style={{
            background: "rgba(67, 247, 255, 0.6)",
            transform: "translate(2px, 0)",
          }}
        />
        <div
          className="absolute left-[33%] top-[24%] h-[55%] w-[35%] rounded-sm opacity-40"
          style={{
            background: "rgba(255, 155, 61, 0.6)",
            transform: "translate(0, 2px)",
          }}
        />
        {/* Glitch scanlines */}
        <div className="absolute inset-0 flex flex-col justify-around">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[1px] w-full"
              style={{
                background: `rgba(67, 247, 255, ${0.05 + (i % 3) * 0.03})`,
              }}
            />
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "Entropy",
    category: "Abstract",
    accent: "#43f7ff",
    aspect: "aspect-square",
    render: (
      <div className="relative h-full w-full overflow-hidden bg-void">
        {/* Random positioned small colored circles via multiple radial-gradient layers */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 15% 20%, #ff2bd6 0%, transparent 5%),
              radial-gradient(circle at 75% 15%, #43f7ff 0%, transparent 4%),
              radial-gradient(circle at 40% 35%, #8dff4a 0%, transparent 6%),
              radial-gradient(circle at 85% 45%, #ff9b3d 0%, transparent 4%),
              radial-gradient(circle at 20% 55%, #7c3cff 0%, transparent 5%),
              radial-gradient(circle at 60% 65%, #ff2bd6 0%, transparent 3%),
              radial-gradient(circle at 90% 75%, #43f7ff 0%, transparent 4%),
              radial-gradient(circle at 30% 85%, #8dff4a 0%, transparent 5%),
              radial-gradient(circle at 70% 90%, #ff9b3d 0%, transparent 3%),
              radial-gradient(circle at 10% 70%, #43f7ff 0%, transparent 4%),
              radial-gradient(circle at 50% 10%, #7c3cff 0%, transparent 5%),
              radial-gradient(circle at 95% 55%, #ff2bd6 0%, transparent 4%),
              radial-gradient(circle at 45% 50%, #ff9b3d 0%, transparent 3%),
              radial-gradient(circle at 80% 30%, #8dff4a 0%, transparent 5%),
              radial-gradient(circle at 25% 40%, #43f7ff 0%, transparent 4%)
            `,
          }}
        />
        {/* Subtle noise texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 1px, white 1px, white 2px)",
          }}
        />
      </div>
    ),
  },
  {
    title: "Portal Ring",
    category: "Motion",
    accent: "#ff9b3d",
    aspect: "aspect-square",
    render: (
      <div className="relative grid h-full w-full place-items-center overflow-hidden bg-void">
        {/* Spinning conic gradient ring */}
        <div
          className="h-[75%] w-[75%] rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, #ff2bd6, #43f7ff, #8dff4a, #ff9b3d, #7c3cff, #ff2bd6)",
            animation: "slowSpin 6s linear infinite",
          }}
        />
        {/* Inner dark circle */}
        <div className="absolute left-1/2 top-1/2 h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-void" />
        {/* Core glow */}
        <div
          className="absolute left-1/2 top-1/2 h-[25%] w-[25%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,155,61,0.5), transparent 70%)",
          }}
        />
      </div>
    ),
  },
];

/* ──────────────────────────────────────────────
   Individual frame component
   ────────────────────────────────────────────── */

function GalleryFrame({
  frame,
  index,
}: {
  frame: ArtFrame;
  index: number;
}) {
  return (
    <ScrollReveal delay={index * 0.06} distance={20}>
      <MagneticCard className="group cursor-pointer" strength={0.08}>
        {/* Art frame */}
        <div
          className={`relative ${frame.aspect} overflow-hidden rounded-2xl border border-white/10 transition-all duration-300 ease-out group-hover:scale-[1.03] group-hover:border-opacity-60`}
          style={
            {
              "--frame-glow": frame.accent,
            } as React.CSSProperties
          }
        >
          {/* The generative art */}
          {frame.render}

          {/* Hover overlay — View label */}
          <div className="absolute inset-x-0 bottom-0 flex justify-center pb-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span
              className="rounded-full px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/90 backdrop-blur-md"
              style={{ backgroundColor: `${frame.accent}33` }}
            >
              View
            </span>
          </div>

          {/* Hover glow border effect */}
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              boxShadow: `inset 0 0 0 1px ${frame.accent}44, 0 0 30px -5px ${frame.accent}33`,
            }}
          />
        </div>

        {/* Title + meta below frame */}
        <div className="mt-3 flex items-center gap-2 px-1">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: frame.accent }}
          />
          <h3 className="font-display text-sm font-bold uppercase tracking-tight text-white/90">
            {frame.title}
          </h3>
        </div>
        <div className="mt-1 flex items-center gap-2 px-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
            {frame.category}
          </span>
          <span className="text-white/20">·</span>
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">
            <span
              className="inline-block h-1 w-1 animate-pulse rounded-full"
              style={{ backgroundColor: frame.accent }}
            />
            forming
          </span>
        </div>
      </MagneticCard>
    </ScrollReveal>
  );
}

/* ──────────────────────────────────────────────
   Page
   ────────────────────────────────────────────── */

export default function ArtPage() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background layers */}
      <div className="scanline" aria-hidden />
      <div className="starfield" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Nav ── */}
        <nav className="mb-10">
          <BackToHub />
        </nav>

        {/* ── Header ── */}
        <motion.header
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-12"
        >
          <p className="font-mono text-xs uppercase tracking-[0.45em] text-ember/80">
            x1c7 portal
          </p>
          <div className="mt-4 flex items-center gap-3">
            <span className="font-mono text-2xl text-ember">&#10022;</span>
            <TextScramble
              text="AI Art"
              as="h1"
              className="font-display text-5xl font-black uppercase tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl"
              delay={300}
            />
          </div>
          <p className="mt-4 max-w-xl text-lg font-semibold leading-8 text-white/70">
            Gallery experiments, XsyVerse visuals, characters, and worlds.
          </p>
          <p className="mt-2 max-w-xl text-sm leading-7 text-white/50">
            A bright weird museum is under construction.
          </p>
        </motion.header>

        {/* ── Gallery Wall ── */}
        <section className="pb-16">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
            {ART_FRAMES.map((frame, i) => (
              <GalleryFrame key={frame.title} frame={frame} index={i} />
            ))}
          </div>
        </section>

        {/* ── Bottom Navigation ── */}
        <footer className="border-t border-white/5 pt-8 pb-12">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <span className="portal-ring grid h-8 w-8 place-items-center rounded-xl p-[2px]">
                <span className="grid h-full w-full place-items-center rounded-xl bg-void text-xs font-black">
                  x
                </span>
              </span>
              <div>
                <span className="block font-display text-sm font-black tracking-[0.2em]">
                  x1c7
                </span>
                <span className="block font-mono text-[9px] uppercase tracking-[0.3em] text-white/35">
                  creative command hub
                </span>
              </div>
            </div>
            <nav className="flex flex-wrap justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              <Link
                href="/"
                className="transition hover:text-signal"
              >
                Hub
              </Link>
              <Link
                href="/music"
                className="transition hover:text-plasma"
              >
                Music
              </Link>
              <Link
                href="/projects"
                className="transition hover:text-royal"
              >
                Projects
              </Link>
              <Link
                href="/classified"
                className="transition hover:text-red-400"
              >
                Classified
              </Link>
            </nav>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/25">
              Built by xsy &middot; {new Date().getFullYear()}
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
