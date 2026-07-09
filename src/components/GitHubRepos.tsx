"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

interface GitHubRepo {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  html_url: string;
  fork: boolean;
}

type FetchState = { status: "loading" } | { status: "error" } | { status: "ok"; repos: GitHubRepo[] };

/* ------------------------------------------------------------------ */
/*  LANGUAGE COLOR MAP                                                 */
/* ------------------------------------------------------------------ */

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#43f7ff",
  JavaScript: "#f5ff6b",
  Python: "#8dff4a",
  HTML: "#ff9b3d",
  CSS: "#ff2440",
  "C++": "#ff2440",
  Rust: "#ff9b3d",
  Go: "#43f7ff",
  Java: "#ff2440",
  Ruby: "#ff2440",
  Shell: "#8dff4a",
};

function getLanguageColor(lang: string | null): string {
  if (!lang) return "#ffffff";
  return LANGUAGE_COLORS[lang] ?? "#ffffff";
}

/* ------------------------------------------------------------------ */
/*  DATE FORMATTER                                                     */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  ICONS (inline SVG)                                                 */
/* ------------------------------------------------------------------ */

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
    </svg>
  );
}

function ForkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M5 3.25a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0zm0 2.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0zm0 2.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0zM11.5 1.5a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0zM8 4.25a.75.75 0 01.75.75v2.286c.63.22 1.178.64 1.54 1.176l1.37 2.055a.75.75 0 11-1.248.832l-1.37-2.055a1.25 1.25 0 00-2.084 0l-1.37 2.055a.75.75 0 11-1.248-.832l1.37-2.055A3.251 3.251 0 017.25 7.286V5a.75.75 0 01.75-.75zM11.5 9.75a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  SKELETON CARD                                                      */
/* ------------------------------------------------------------------ */

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] backdrop-blur p-5"
      style={{ animationDelay: `${index * 120}ms` }}
    >
      {/* title bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-24 rounded bg-white/[0.08] animate-pulse" />
      </div>
      {/* description lines */}
      <div className="space-y-2 mb-4">
        <div className="h-3 w-full rounded bg-white/[0.05] animate-pulse" />
        <div className="h-3 w-3/4 rounded bg-white/[0.05] animate-pulse" />
      </div>
      {/* meta row */}
      <div className="flex items-center gap-3">
        <div className="h-2.5 w-16 rounded bg-white/[0.06] animate-pulse" />
        <div className="h-2.5 w-12 rounded bg-white/[0.06] animate-pulse" />
        <div className="h-2.5 w-12 rounded bg-white/[0.06] animate-pulse" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  REPO CARD                                                          */
/* ------------------------------------------------------------------ */

function RepoCard({ repo, index }: { repo: GitHubRepo; index: number }) {
  const reduceMotion = useReducedMotion();
  const langColor = getLanguageColor(repo.language);

  return (
    <motion.a
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      className="group block rounded-[1.5rem] border border-white/10 bg-white/[0.04] backdrop-blur p-5 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
    >
      {/* title */}
      <h3 className="font-display text-lg font-bold uppercase tracking-tight text-white truncate">
        {repo.name}
      </h3>

      {/* description */}
      <p className="mt-2 text-sm text-white/55 leading-6 line-clamp-2 min-h-[48px]">
        {repo.description ?? "No description provided."}
      </p>

      {/* meta row */}
      <div className="mt-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-white/40">
        {/* language */}
        {repo.language && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: langColor }}
            />
            <span style={{ color: langColor }}>{repo.language}</span>
          </span>
        )}

        {/* stars */}
        <span className="inline-flex items-center gap-1">
          <StarIcon className="h-3 w-3 text-white/30" />
          <span>{repo.stargazers_count}</span>
        </span>

        {/* forks */}
        <span className="inline-flex items-center gap-1">
          <ForkIcon className="h-3 w-3 text-white/30" />
          <span>{repo.forks_count}</span>
        </span>

        {/* spacer */}
        <span className="flex-1" />

        {/* date */}
        <span className="text-white/25">{formatDate(repo.updated_at)}</span>
      </div>
    </motion.a>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                     */
/* ------------------------------------------------------------------ */

const GITHUB_API_URL = "https://api.github.com/users/xsytrance/repos?sort=updated&per_page=6";

export function GitHubRepos() {
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function fetchRepos() {
      try {
        const res = await fetch(GITHUB_API_URL, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        const data: GitHubRepo[] = await res.json();
        if (!cancelled) setState({ status: "ok", repos: data });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }

    fetchRepos();
    return () => { cancelled = true; };
  }, []);

  /* ---- loading ---- */
  if (state.status === "loading") {
    return (
      <section className="mb-8 sm:mb-12">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Section header */}
          <div className="mb-5 flex items-center gap-3">
            <GitHubIcon className="h-5 w-5 text-white/50" />
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-white">
              Latest Repos
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
              @xsytrance
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} index={i} />
            ))}
          </div>
        </motion.div>
      </section>
    );
  }

  /* ---- error ---- */
  if (state.status === "error") {
    return (
      <section className="mb-8 sm:mb-12">
        <div className="flex items-center justify-center gap-2 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur">
          <GitHubIcon className="h-4 w-4 text-white/30" />
          <span className="font-mono text-xs text-white/40">
            GitHub data unavailable
          </span>
        </div>
      </section>
    );
  }

  /* ---- success ---- */
  return (
    <section className="mb-8 sm:mb-12">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Section header */}
        <div className="mb-5 flex items-center gap-3">
          <GitHubIcon className="h-5 w-5 text-white/50" />
          <h2 className="font-display text-xl font-bold uppercase tracking-tight text-white">
            Latest Repos
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
            @xsytrance
          </span>
          <span className="flex-1" />
          <a
            href="https://github.com/xsytrance"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/40 transition hover:border-white/25 hover:text-white/70"
          >
            View all →
          </a>
        </div>

        {/* Repo grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.repos.map((repo, i) => (
            <RepoCard key={repo.id} repo={repo} index={i} />
          ))}
        </div>
      </motion.div>
    </section>
  );
}
