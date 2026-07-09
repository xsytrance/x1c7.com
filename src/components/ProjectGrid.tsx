"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  projects,
  projectCategories,
  categoryMeta,
  type Project,
  type ProjectCategory,
} from "@/data/projects";

/* ------------------------------------------------------------------ */
/*  LANGUAGE COLORS                                                    */
/* ------------------------------------------------------------------ */

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#43f7ff",
  JavaScript: "#f5ff6b",
  Python: "#8dff4a",
  Rust: "#ff9b3d",
  Kotlin: "#7c3cff",
  GDScript: "#ff2440",
  HTML: "#ff9b3d",
  TeX: "#00ffa8",
};

function langColor(lang: string | null): string {
  if (!lang) return "#ffffff66";
  return LANGUAGE_COLORS[lang] ?? "#ffffff99";
}

/* ------------------------------------------------------------------ */
/*  STATUS PILL                                                        */
/* ------------------------------------------------------------------ */

function StatusPill({ status, color }: { status: Project["status"]; color: string }) {
  const label = status === "live" ? "live" : status === "active" ? "active" : "forming";
  const pulse = status !== "forming";
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">
      <span
        className={`h-1.5 w-1.5 rounded-full ${pulse ? "animate-pulse" : ""}`}
        style={{ background: status === "forming" ? "#ffffff40" : color }}
      />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  PROJECT CARD                                                       */
/* ------------------------------------------------------------------ */

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const reduceMotion = useReducedMotion();
  const meta = categoryMeta[project.category];
  const accent = meta.color;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.4, ease: "easeOut" }}
      whileHover={reduceMotion ? undefined : { y: -6 }}
      className="group relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.04] backdrop-blur transition-colors"
      style={{ borderColor: hovered ? `${accent}55` : undefined }}
    >
      <Link href={`/projects/${project.id}`} className="block p-5">
      {/* accent glow */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl transition-opacity duration-300"
        style={{ background: accent, opacity: hovered ? 0.22 : 0.08 }}
        aria-hidden
      />

      {/* header row */}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-black uppercase tracking-tight text-white">
            {project.name}
          </h3>
          <p className="mt-1 truncate font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: `${accent}cc` }}>
            {project.tagline}
          </p>
        </div>
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-base"
          style={{ background: `${accent}18`, borderColor: `${accent}33`, color: accent }}
          aria-hidden
        >
          {meta.glyph}
        </span>
      </div>

      {/* detail */}
      <p className="relative mt-3 text-sm leading-6 text-white/55 line-clamp-3 min-h-[72px]">
        {project.detail}
      </p>

      {/* meta footer */}
      <div className="relative mt-4 flex items-center gap-3 border-t border-white/[0.07] pt-3">
        {project.language && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-white/45">
            <span className="h-2 w-2 rounded-full" style={{ background: langColor(project.language) }} />
            {project.language}
          </span>
        )}
        <StatusPill status={project.status} color={accent} />
        <span className="flex-1" />
        {project.homepage && (
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">
            live
          </span>
        )}
        <span
          className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35 transition group-hover:text-white/70"
        >
          inspect →
        </span>
      </div>
      </Link>

      {/* bottom accent line */}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        aria-hidden
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  FILTER CHIP                                                        */
/* ------------------------------------------------------------------ */

function FilterChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] transition"
      style={{
        backgroundColor: active ? `${color}22` : "transparent",
        color: active ? color : `${color}aa`,
        border: `1px solid ${active ? `${color}66` : `${color}28`}`,
        transform: active ? "scale(1.04)" : "scale(1)",
      }}
    >
      {active ? "● " : ""}
      {label} <span className="opacity-50">({count})</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                               */
/* ------------------------------------------------------------------ */

export function ProjectGrid() {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<ProjectCategory | "all">("all");

  const filtered = useMemo(
    () => (active === "all" ? projects : projects.filter((p) => p.category === active)),
    [active]
  );

  const activeMeta = active === "all" ? null : categoryMeta[active];

  return (
    <section className="mb-12">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/35">
            full arsenal
          </p>
          <h2 className="mt-2 font-display text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
            All Systems
          </h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-white/30">
          {projects.length} builds · {projectCategories.length} divisions
        </p>
      </div>

      {/* filter bar */}
      <div className="mb-3 flex flex-wrap gap-2">
        <FilterChip
          label="All"
          count={projects.length}
          color="#ffffff"
          active={active === "all"}
          onClick={() => setActive("all")}
        />
        {projectCategories.map((cat) => (
          <FilterChip
            key={cat.id}
            label={cat.label}
            count={projects.filter((p) => p.category === cat.id).length}
            color={cat.color}
            active={active === cat.id}
            onClick={() => setActive(cat.id)}
          />
        ))}
      </div>

      {/* active division blurb */}
      <div className="mb-6 min-h-[18px]">
        <AnimatePresence mode="wait">
          {activeMeta && (
            <motion.p
              key={activeMeta.id}
              initial={reduceMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 4 }}
              transition={{ duration: 0.2 }}
              className="font-mono text-xs text-white/45"
            >
              <span style={{ color: activeMeta.color }}>›</span> {activeMeta.blurb}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* grid */}
      <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} />
          ))}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
