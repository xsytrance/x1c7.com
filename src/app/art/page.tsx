"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import { ScrollReveal } from "@/components/ScrollReveal";
import { MagneticCard } from "@/components/MagneticCard";
import { Lightbox, type ArtPiece } from "@/components/Lightbox";

/* ──────────────────────────────────────────────
   Typed art data — 6 real AI-generated pieces
   ────────────────────────────────────────────── */

const ART_PIECES: ArtPiece[] = [
  {
    id: "art-01",
    title: "Neon City",
    category: "Worlds",
    src: "/art/art-01.jpg",
    description:
      "A rain-soaked cyberpunk metropolis bathed in neon pink and cyan. Flying vehicles cut between towering skyscrapers while street-level life pulses beneath the glow.",
    accent: "#ff2bd6",
  },
  {
    id: "art-02",
    title: "Digital Portrait",
    category: "Characters",
    src: "/art/art-02.jpg",
    description:
      "An abstract digital portrait of a mysterious hooded figure, geometric patterns fragmenting across the face like a shattered digital identity.",
    accent: "#7c3cff",
  },
  {
    id: "art-03",
    title: "Star Island",
    category: "Worlds",
    src: "/art/art-03.jpg",
    description:
      "A surreal floating island drifting through a star-filled cosmos, bioluminescent flora pouring waterfalls of light into the infinite void below.",
    accent: "#43f7ff",
  },
  {
    id: "art-04",
    title: "Glitch Eye",
    category: "Abstract",
    src: "/art/art-04.jpg",
    description:
      "A close-up of an otherworldly cybernetic eye, digital glitch artifacts and neon circuit patterns weaving through the iris like living code.",
    accent: "#ff2bd6",
  },
  {
    id: "art-05",
    title: "Energy Forms",
    category: "Abstract",
    src: "/art/art-05.jpg",
    description:
      "Abstract geometric crystalline shapes suspended in darkness, trailing neon green and orange energy paths that map invisible forces.",
    accent: "#8dff4a",
  },
  {
    id: "art-06",
    title: "The Traveler",
    category: "Characters",
    src: "/art/art-06.jpg",
    description:
      "A mysterious hooded figure stands silhouetted in a doorway of blinding light, neon rim outlining the edges of a unknown traveler between worlds.",
    accent: "#ff9b3d",
  },
];

const CATEGORIES = ["All", "Characters", "Abstract", "Worlds"] as const;

/* ──────────────────────────────────────────────
   Aspect ratios for masonry feel
   ────────────────────────────────────────────── */

const ASPECTS = [
  "aspect-[3/4]",
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-[4/5]",
];

/* ──────────────────────────────────────────────
   Gallery card
   ────────────────────────────────────────────── */

function GalleryCard({
  piece,
  index,
  onOpen,
}: {
  piece: ArtPiece;
  index: number;
  onOpen: () => void;
}) {
  const aspect = ASPECTS[index % ASPECTS.length];

  return (
    <ScrollReveal delay={index * 0.08} distance={24}>
      <MagneticCard className="group cursor-pointer" strength={0.08}>
        <div
          className={`relative ${aspect} overflow-hidden rounded-[1.5rem] border border-white/10 transition-all duration-300 ease-out group-hover:scale-[1.03] group-hover:border-opacity-60`}
          onClick={onOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onOpen();
          }}
        >
          {/* Image */}
          <Image
            src={piece.src}
            alt={piece.title}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />

          {/* Hover overlay — title */}
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="px-5 pb-5">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: piece.accent }}
                />
                <h3 className="font-display text-base font-bold uppercase tracking-tight text-white">
                  {piece.title}
                </h3>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
                {piece.category}
              </p>
            </div>
          </div>

          {/* Hover glow border */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[1.5rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              boxShadow: `inset 0 0 0 1px ${piece.accent}44, 0 0 30px -5px ${piece.accent}33`,
            }}
          />
        </div>

        {/* Title row below card */}
        <div className="mt-3 flex items-center gap-2 px-1">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: piece.accent }}
          />
          <h3 className="font-display text-sm font-bold uppercase tracking-tight text-white/90">
            {piece.title}
          </h3>
        </div>
        <div className="mt-1 flex items-center gap-2 px-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
            {piece.category}
          </span>
          <span className="text-white/20">·</span>
          <span
            className="font-mono text-[10px] uppercase tracking-[0.15em]"
            style={{ color: `${piece.accent}aa` }}
          >
            {piece.accent}
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
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const filtered = useMemo(() => {
    if (activeCategory === "All") return ART_PIECES;
    return ART_PIECES.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const handleLightboxNavigate = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

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
          className="mb-10"
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

        {/* ── Category Filters ── */}
        <motion.div
          className="mb-10 flex flex-wrap gap-2"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] transition-all duration-200 ${
                activeCategory === cat
                  ? "text-white shadow-lg"
                  : "border border-white/10 text-white/45 hover:border-white/20 hover:text-white/70"
              }`}
              style={
                activeCategory === cat
                  ? {
                      backgroundColor: "#ff9b3d",
                      boxShadow: "0 0 20px -5px #ff9b3d55",
                    }
                  : undefined
              }
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* ── Gallery Grid ── */}
        <section className="pb-16">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeCategory}
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {filtered.map((piece, i) => (
                <GalleryCard
                  key={piece.id}
                  piece={piece}
                  index={i}
                  onOpen={() => openLightbox(i)}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="font-mono text-sm text-white/40">
                No pieces in this category yet.
              </p>
            </div>
          )}
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
              <Link href="/" className="transition hover:text-signal">
                Hub
              </Link>
              <Link href="/music" className="transition hover:text-plasma">
                Music
              </Link>
              <Link href="/projects" className="transition hover:text-royal">
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

      {/* ── Lightbox ── */}
      <Lightbox
        pieces={filtered}
        activeIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={handleLightboxNavigate}
      />
    </main>
  );
}
