"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  guides,
  guideCategories,
  guideCategoryMeta,
  type Guide,
  type GuideCategory,
} from "@/data/guides";

const DIFFICULTY_LABEL: Record<Guide["difficulty"], string> = {
  intro: "Intro",
  operator: "Operator",
  deep: "Deep",
};

/* ------------------------------------------------------------------ */
/*  GUIDE CARD (expandable)                                            */
/* ------------------------------------------------------------------ */

function GuideCard({ guide, index }: { guide: Guide; index: number }) {
  const reduceMotion = useReducedMotion();
  const meta = guideCategoryMeta[guide.category];
  const accent = meta.color;
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.05, 0.35), duration: 0.4 }}
      className="group relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.04] backdrop-blur transition-colors hover:border-white/20"
    >
      {/* accent edge */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: `linear-gradient(to bottom, transparent, ${accent}, transparent)` }}
        aria-hidden
      />

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-4 p-5 text-left sm:p-6"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          {/* meta row */}
          <div className="mb-2 flex flex-wrap items-center gap-2.5 font-mono text-[10px] uppercase tracking-wider">
            <span
              className="rounded-full px-2 py-0.5"
              style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}33` }}
            >
              {meta.label}
            </span>
            <span className="text-white/35">{DIFFICULTY_LABEL[guide.difficulty]}</span>
            <span className="text-white/20">·</span>
            <span className="text-white/35">{guide.readTime}</span>
          </div>

          <h3 className="font-display text-lg font-bold uppercase tracking-tight text-white sm:text-xl">
            {guide.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/55">{guide.summary}</p>
        </div>

        {/* expand chevron */}
        <span
          className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border transition"
          style={{
            borderColor: open ? `${accent}66` : "#ffffff20",
            color: open ? accent : "#ffffff66",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
          aria-hidden
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {/* expanded steps */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6 sm:px-6">
              <div className="border-t border-dashed border-white/10 pt-5">
                <ol className="space-y-3">
                  {guide.steps.map((step, i) => (
                    <motion.li
                      key={i}
                      initial={reduceMotion ? false : { opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      className="flex gap-3"
                    >
                      <span
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md font-mono text-[10px] font-bold"
                        style={{ background: `${accent}1c`, color: accent, border: `1px solid ${accent}30` }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm leading-6 text-white/70">{step}</span>
                    </motion.li>
                  ))}
                </ol>

                {guide.link && (
                  <a
                    href={guide.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-void transition hover:scale-105"
                    style={{ background: accent }}
                  >
                    {guide.link.label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M7 17 17 7M9 7h8v8" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  FILTER CHIP                                                        */
/* ------------------------------------------------------------------ */

function Chip({ label, count, color, active, onClick }: {
  label: string; count: number; color: string; active: boolean; onClick: () => void;
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
      {active ? "● " : ""}{label} <span className="opacity-50">({count})</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                               */
/* ------------------------------------------------------------------ */

export function GuideList() {
  const [active, setActive] = useState<GuideCategory | "all">("all");

  const filtered = useMemo(
    () => (active === "all" ? guides : guides.filter((g) => g.category === active)),
    [active]
  );

  return (
    <section>
      {/* filter bar */}
      <div className="mb-8 flex flex-wrap gap-2">
        <Chip
          label="All"
          count={guides.length}
          color="#ffffff"
          active={active === "all"}
          onClick={() => setActive("all")}
        />
        {guideCategories.map((cat) => (
          <Chip
            key={cat.id}
            label={cat.label}
            count={guides.filter((g) => g.category === cat.id).length}
            color={cat.color}
            active={active === cat.id}
            onClick={() => setActive(cat.id)}
          />
        ))}
      </div>

      {/* list */}
      <motion.div layout className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((guide, i) => (
            <GuideCard key={guide.id} guide={guide} index={i} />
          ))}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
