"use client";

import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BackToHub } from "@/components/BackToHub";
import { TextScramble } from "@/components/TextScramble";
import {
  getProject,
  relatedProjects,
  categoryMeta,
} from "@/data/projects";

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#43f7ff",
  JavaScript: "#f5ff6b",
  Python: "#8dff4a",
  Rust: "#ff9b3d",
  Kotlin: "#7c3cff",
  GDScript: "#ff2bd6",
  HTML: "#ff9b3d",
  TeX: "#00ffa8",
};

function ExternalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

export default function ProjectDossier() {
  const params = useParams();
  const reduceMotion = useReducedMotion();
  const slug = typeof params.slug === "string" ? params.slug : Array.isArray(params.slug) ? params.slug[0] : "";
  const project = getProject(slug);

  if (!project) {
    notFound();
  }

  const meta = categoryMeta[project.category];
  const accent = meta.color;
  const langColor = project.language ? LANGUAGE_COLORS[project.language] ?? "#ffffffaa" : null;
  const related = relatedProjects(project);
  const statusLabel = project.status === "live" ? "Live" : project.status === "active" ? "Active" : "Forming";

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="starfield" aria-hidden />
      <div className="scanline" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 -translate-y-1/3 rounded-full opacity-25 blur-3xl"
        style={{ backgroundColor: accent }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-4xl">
        {/* Nav */}
        <nav className="mb-8 flex items-center justify-between">
          <BackToHub />
          <Link
            href="/projects"
            className="rounded-full border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/55 transition hover:border-white/40 hover:text-white"
          >
            ← all systems
          </Link>
        </nav>

        {/* Division badge */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-5"
        >
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] transition hover:scale-105"
            style={{ borderColor: `${accent}40`, color: accent, background: `${accent}12` }}
          >
            <span>{meta.glyph}</span>
            {meta.label}
          </Link>
        </motion.div>

        {/* Header */}
        <header className="mb-8">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.45em] text-white/35">
            dossier · {project.id}
          </p>
          <TextScramble
            text={project.name}
            as="h1"
            className="font-display text-4xl font-black uppercase leading-[0.9] tracking-[-0.05em] text-white sm:text-6xl"
            delay={100}
          />
          <p className="mt-4 text-lg font-semibold sm:text-2xl" style={{ color: accent }}>
            {project.tagline}
          </p>

          {/* chips */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider"
              style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}30` }}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${project.status !== "forming" ? "animate-pulse" : ""}`} style={{ background: project.status === "forming" ? "#ffffff55" : accent }} />
              {statusLabel}
            </span>
            {project.language && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white/55">
                <span className="h-2 w-2 rounded-full" style={{ background: langColor ?? "#fff" }} />
                {project.language}
              </span>
            )}
          </div>
        </header>

        {/* Body grid */}
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Brief */}
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur sm:p-8"
          >
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full blur-3xl" style={{ background: `${accent}22` }} aria-hidden />
            <p className="relative font-mono text-[10px] uppercase tracking-[0.4em] text-white/35">
              ▣ mission brief
            </p>
            <p className="relative mt-4 text-base leading-8 text-white/75 sm:text-lg">
              {project.detail}
            </p>

            {/* actions */}
            <div className="relative mt-7 flex flex-wrap gap-3">
              <a
                href={project.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-void transition hover:scale-105"
                style={{ background: accent }}
              >
                Source <ExternalIcon />
              </a>
              {project.homepage && (
                <a
                  href={project.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white/80 transition hover:border-white/45 hover:text-white"
                >
                  Live site <ExternalIcon />
                </a>
              )}
            </div>
          </motion.section>

          {/* Intel sidebar */}
          <motion.aside
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="rounded-[1.8rem] border border-white/10 bg-black/25 p-6 backdrop-blur"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/35">
              ▣ intel
            </p>
            <dl className="mt-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
                <dt className="uppercase tracking-wider text-white/35">Division</dt>
                <dd className="text-right" style={{ color: accent }}>{meta.label}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
                <dt className="uppercase tracking-wider text-white/35">Status</dt>
                <dd className="text-right text-white/75">{statusLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
                <dt className="uppercase tracking-wider text-white/35">Stack</dt>
                <dd className="text-right text-white/75">{project.language ?? "Mixed"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="uppercase tracking-wider text-white/35">Codename</dt>
                <dd className="text-right text-white/75">{project.id}</dd>
              </div>
            </dl>
            <p className="mt-5 text-[11px] leading-6 text-white/45">
              {meta.blurb}
            </p>
          </motion.aside>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-10">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-white/35">
              ▣ same division
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {related.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.35 + i * 0.07 }}
                >
                  <Link
                    href={`/projects/${r.id}`}
                    className="group block rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur transition hover:border-white/25 hover:bg-white/[0.06]"
                  >
                    <h3 className="font-display text-sm font-bold uppercase tracking-tight text-white">{r.name}</h3>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: `${accent}bb` }}>
                      {r.tagline}
                    </p>
                    <span className="mt-3 inline-block font-mono text-[9px] uppercase tracking-[0.2em] text-white/30 transition group-hover:text-white/60">
                      inspect →
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-12 pb-6 text-center font-mono text-[10px] text-white/20">
          <span style={{ color: `${accent}66` }}>{meta.glyph}</span> x1c7 dossier — {project.name}
        </footer>
      </div>
    </main>
  );
}
