"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { m, animate, useInView, useReducedMotion } from "framer-motion";
import { featuredProjects, projects, projectCategories, categoryMeta } from "@/data/projects";
import { tracks, featuredTracks } from "@/data/tracks";
import { agentsData } from "@/data/agents";
import { guides } from "@/data/guides";
import { artImages } from "@/data/images";

/* ------------------------------------------------------------------ */
/*  COUNT-UP STAT                                                      */
/* ------------------------------------------------------------------ */

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView || !ref.current) return;
    if (reduce) {
      ref.current.textContent = String(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [inView, value, reduce]);

  return (
    <div ref={wrapRef} className="text-center">
      <span
        ref={ref}
        className="block font-display text-4xl font-black tabular-nums sm:text-5xl"
        style={{ color }}
      >
        0
      </span>
      <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        {label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FEATURED PROJECT CARD                                              */
/* ------------------------------------------------------------------ */

function FeaturedCard({ id, index }: { id: string; index: number }) {
  const reduce = useReducedMotion();
  const project = projects.find((p) => p.id === id);
  if (!project) return null;
  const accent = categoryMeta[project.category].color;

  return (
    <m.div
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: Math.min(index * 0.06, 0.4), duration: 0.45 }}
      whileHover={reduce ? undefined : { y: -6 }}
      className="group relative overflow-hidden rounded-[1.3rem] border border-white/10 bg-white/[0.04] backdrop-blur transition-colors hover:border-white/25"
    >
      <Link href={`/projects/${project.id}`} className="block p-5">
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl opacity-10 transition-opacity duration-300 group-hover:opacity-30"
          style={{ background: accent }}
          aria-hidden
        />
        <div className="relative flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
          <span>{categoryMeta[project.category].glyph}</span>
          <span>{categoryMeta[project.category].label}</span>
        </div>
        <h3 className="relative mt-2 font-display text-lg font-black uppercase tracking-tight text-white">
          {project.name}
        </h3>
        <p className="relative mt-1 text-sm leading-6 text-white/55 line-clamp-2">
          {project.tagline}
        </p>
        <span className="relative mt-3 inline-block font-mono text-[9px] uppercase tracking-[0.2em] text-white/30 transition group-hover:text-white/70">
          inspect →
        </span>
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
          aria-hidden
        />
      </Link>
    </m.div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                               */
/* ------------------------------------------------------------------ */

export function HomeShowcase() {
  const reduce = useReducedMotion();
  const featured = featuredProjects.slice(0, 6).map((p) => p.id);
  const track = featuredTracks[0] ?? tracks[0];

  const stats = [
    { value: projects.length, label: "Projects", color: "#43f7ff" },
    { value: projectCategories.length, label: "Divisions", color: "#7c3cff" },
    { value: tracks.length, label: "Tracks", color: "#ff2440" },
    { value: agentsData.length, label: "Agents", color: "#00ffa8" },
    { value: artImages.length, label: "Art", color: "#ff9b3d" },
    { value: guides.length, label: "Protocols", color: "#8dff4a" },
  ];

  return (
    <section className="relative mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      {/* Stats band */}
      <m.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.6 }}
        className="rounded-[2rem] border border-white/10 bg-black/25 p-6 backdrop-blur sm:p-8"
      >
        <p className="mb-6 text-center font-mono text-[10px] uppercase tracking-[0.45em] text-signal/70">
          systems online
        </p>
        <div className="grid grid-cols-3 gap-5 sm:grid-cols-6">
          {stats.map((s) => (
            <Stat key={s.label} value={s.value} label={s.label} color={s.color} />
          ))}
        </div>
      </m.div>

      {/* Featured projects */}
      <div className="mt-12">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/35">
              featured systems
            </p>
            <h2 className="mt-2 font-display text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              Latest Builds
            </h2>
          </div>
          <Link
            href="/projects"
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-white/50 transition hover:border-white/30 hover:text-white"
          >
            All systems →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((id, i) => (
            <FeaturedCard key={id} id={id} index={i} />
          ))}
        </div>
      </div>

      {/* Latest transmission (track teaser) */}
      {track && (
        <m.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6 }}
          className="mt-12"
        >
          <Link
            href="/music"
            className="group relative flex flex-col items-start gap-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition hover:border-white/25 sm:flex-row sm:items-center sm:p-8"
          >
            {/* art tile (gradient — no external asset needed) */}
            <div
              className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl"
              style={{ background: `radial-gradient(circle at 30% 30%, ${track.color}55, transparent 70%), linear-gradient(135deg, ${track.color}33, #05030b)` }}
            >
              <span className="flex items-end gap-1" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full"
                    style={{
                      height: 8 + (i % 2) * 14,
                      background: track.color,
                      animation: reduce ? "none" : `visualizerBounce 0.7s ease-in-out ${i * 0.12}s infinite alternate`,
                    }}
                  />
                ))}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.4em]" style={{ color: track.color }}>
                latest transmission
              </p>
              <h3 className="mt-2 truncate font-display text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
                {track.title}
              </h3>
              <p className="mt-1 font-mono text-xs uppercase tracking-wider text-white/45">
                {track.artist} · {track.genre}
              </p>
            </div>

            <span className="rounded-full bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-void transition group-hover:scale-105" style={{ whiteSpace: "nowrap" }}>
              Open music ▸
            </span>
          </Link>
        </m.div>
      )}
    </section>
  );
}
